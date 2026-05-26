import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { SegmentedControl } from "../SegmentedControl";

type Seg = "a" | "b";

const OPTIONS: ReadonlyArray<{ value: Seg; label: string }> = [
  { value: "a", label: "Alpha" },
  { value: "b", label: "Beta" },
];

afterEach(() => cleanup());

describe("SegmentedControl", () => {
  it("renders one button per option", () => {
    render(
      <SegmentedControl value="a" options={OPTIONS} onChange={() => {}} />,
    );
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(2);
  });

  it("marks the active pill via aria-selected=true and others false", () => {
    render(
      <SegmentedControl value="a" options={OPTIONS} onChange={() => {}} />,
    );
    const tabs = screen.getAllByRole("tab");
    // First tab is the 'a' (active) option.
    expect(tabs[0].getAttribute("aria-selected")).toBe("true");
    expect(tabs[1].getAttribute("aria-selected")).toBe("false");
  });

  it("calls onChange when an inactive pill is clicked", () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl value="a" options={OPTIONS} onChange={onChange} />,
    );
    fireEvent.click(screen.getByText("Beta"));
    expect(onChange).toHaveBeenCalledWith("b");
  });

  it("still fires onChange when the already-active pill is clicked (parent decides to dedupe)", () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl value="a" options={OPTIONS} onChange={onChange} />,
    );
    fireEvent.click(screen.getByText("Alpha"));
    expect(onChange).toHaveBeenCalledWith("a");
  });

  it("activates pill via Enter key", () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl value="a" options={OPTIONS} onChange={onChange} />,
    );
    const beta = screen.getByText("Beta");
    fireEvent.keyDown(beta, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("b");
  });

  it("activates pill via Space key", () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl value="a" options={OPTIONS} onChange={onChange} />,
    );
    const beta = screen.getByText("Beta");
    fireEvent.keyDown(beta, { key: " " });
    expect(onChange).toHaveBeenCalledWith("b");
  });

  it("exposes data-testid passthrough on root and per-pill", () => {
    render(
      <SegmentedControl
        value="a"
        options={OPTIONS}
        onChange={() => {}}
        data-testid="seg"
      />,
    );
    expect(screen.getByTestId("seg")).toBeDefined();
    expect(screen.getByTestId("seg-a")).toBeDefined();
    expect(screen.getByTestId("seg-b")).toBeDefined();
  });

  it("applies className passthrough on root container", () => {
    const { container } = render(
      <SegmentedControl
        value="a"
        options={OPTIONS}
        onChange={() => {}}
        className="extra-class"
      />,
    );
    const root = container.querySelector('[role="tablist"]');
    expect(root?.className.includes("extra-class")).toBe(true);
  });

  it("exposes aria-label on the tablist when provided", () => {
    render(
      <SegmentedControl
        value="a"
        options={OPTIONS}
        onChange={() => {}}
        ariaLabel="view-switcher"
      />,
    );
    const tablist = screen.getByRole("tablist");
    expect(tablist.getAttribute("aria-label")).toBe("view-switcher");
  });
});
