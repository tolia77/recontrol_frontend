import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { useState } from "react";

import ChipInput, { type ChipInputProps } from "../ChipInput";

afterEach(() => cleanup());

// Controlled-component test harness so the input behaves like a real consumer.
function Harness(props: Partial<ChipInputProps> & { initial?: string[] }) {
  const { initial = [], onChange, ...rest } = props;
  const [chips, setChips] = useState<string[]>(initial);
  return (
    <ChipInput
      value={chips}
      onChange={(next) => {
        setChips(next);
        onChange?.(next);
      }}
      aria-label="chips"
      data-testid="chip-input"
      {...rest}
    />
  );
}

function getInput(): HTMLInputElement {
  return screen.getByLabelText("chips") as HTMLInputElement;
}

describe("ChipInput", () => {
  it("renders existing chips from value prop", () => {
    render(<Harness initial={["foo", "bar", "baz"]} />);
    expect(screen.getByText("foo")).toBeDefined();
    expect(screen.getByText("bar")).toBeDefined();
    expect(screen.getByText("baz")).toBeDefined();
  });

  it("Enter commits a new chip and clears the input", () => {
    const onChange = vi.fn();
    render(<Harness initial={[]} onChange={onChange} />);
    const input = getInput();
    fireEvent.change(input, { target: { value: "hello" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenLastCalledWith(["hello"]);
    expect(input.value).toBe("");
  });

  it("Tab commits a new chip and clears the input", () => {
    const onChange = vi.fn();
    render(<Harness initial={["a"]} onChange={onChange} />);
    const input = getInput();
    fireEvent.change(input, { target: { value: "b" } });
    fireEvent.keyDown(input, { key: "Tab" });
    expect(onChange).toHaveBeenLastCalledWith(["a", "b"]);
    expect(input.value).toBe("");
  });

  it("Backspace on empty input deletes the last chip", () => {
    const onChange = vi.fn();
    render(<Harness initial={["x", "y", "z"]} onChange={onChange} />);
    const input = getInput();
    fireEvent.keyDown(input, { key: "Backspace" });
    expect(onChange).toHaveBeenLastCalledWith(["x", "y"]);
  });

  it("Backspace on non-empty input does not delete chips", () => {
    const onChange = vi.fn();
    render(<Harness initial={["x", "y"]} onChange={onChange} />);
    const input = getInput();
    fireEvent.change(input, { target: { value: "draft" } });
    onChange.mockClear();
    fireEvent.keyDown(input, { key: "Backspace" });
    // The default Backspace behaviour for the text input is a browser concern;
    // ChipInput must NOT call onChange in this case.
    expect(onChange).not.toHaveBeenCalled();
  });

  it("pasting whitespace-separated text creates three chips at once", () => {
    const onChange = vi.fn();
    render(<Harness initial={[]} onChange={onChange} />);
    const input = getInput();
    fireEvent.paste(input, {
      clipboardData: { getData: () => "foo bar baz" },
    });
    expect(onChange).toHaveBeenLastCalledWith(["foo", "bar", "baz"]);
  });

  it("paste of quoted text splits naively on whitespace per D-07", () => {
    // D-07 trade-off: --message='hello world' becomes two chips, not one quoted chip.
    const onChange = vi.fn();
    render(<Harness initial={[]} onChange={onChange} />);
    const input = getInput();
    fireEvent.paste(input, {
      clipboardData: { getData: () => "--message='hello world'" },
    });
    expect(onChange).toHaveBeenLastCalledWith(["--message='hello", "world'"]);
  });

  it("clicking the × on a chip removes only that chip", () => {
    const onChange = vi.fn();
    render(
      <Harness initial={["alpha", "beta", "gamma"]} onChange={onChange} />,
    );
    const removeBeta = screen.getByLabelText("Remove beta");
    fireEvent.click(removeBeta);
    expect(onChange).toHaveBeenLastCalledWith(["alpha", "gamma"]);
  });

  it('33rd chip on paste is rejected and onChipOverflow("count") fires', () => {
    const onChipOverflow = vi.fn();
    const onChange = vi.fn();
    const existing = Array.from({ length: 30 }, (_, i) => `chip${i}`);
    render(
      <Harness
        initial={existing}
        onChange={onChange}
        onChipOverflow={onChipOverflow}
      />,
    );
    const input = getInput();
    fireEvent.paste(input, {
      clipboardData: { getData: () => "a b c d e" }, // 5 tokens, only 2 fit
    });
    // First two accepted, the rest rejected due to count cap.
    expect(onChange).toHaveBeenLastCalledWith([...existing, "a", "b"]);
    expect(onChipOverflow).toHaveBeenCalledWith("count");
  });

  it('chip longer than max length is rejected and onChipOverflow("length") fires', () => {
    const onChipOverflow = vi.fn();
    const onChange = vi.fn();
    const tooLong = "x".repeat(1025);
    render(
      <Harness
        initial={[]}
        onChange={onChange}
        onChipOverflow={onChipOverflow}
      />,
    );
    const input = getInput();
    fireEvent.change(input, { target: { value: tooLong } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).not.toHaveBeenCalled();
    expect(onChipOverflow).toHaveBeenCalledWith("length");
  });

  it("comma key commits the draft", () => {
    const onChange = vi.fn();
    render(<Harness initial={[]} onChange={onChange} />);
    const input = getInput();
    fireEvent.change(input, { target: { value: "q" } });
    fireEvent.keyDown(input, { key: "," });
    expect(onChange).toHaveBeenLastCalledWith(["q"]);
  });

  it("disabled mode blocks key handlers and × buttons", () => {
    const onChange = vi.fn();
    render(<Harness initial={["only"]} onChange={onChange} disabled />);
    const input = getInput();
    fireEvent.change(input, { target: { value: "never" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).not.toHaveBeenCalled();
  });
});
