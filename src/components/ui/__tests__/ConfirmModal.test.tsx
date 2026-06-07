import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import ConfirmModal from "../ConfirmModal";

afterEach(() => cleanup());

function defaultProps(
  overrides: Partial<React.ComponentProps<typeof ConfirmModal>> = {},
) {
  return {
    open: true,
    title: "Confirm Action",
    body: "Are you sure?",
    onConfirm: () => {},
    onCancel: () => {},
    ...overrides,
  };
}

describe("ConfirmModal", () => {
  it("renders nothing when open=false", () => {
    const { container } = render(
      <ConfirmModal {...defaultProps({ open: false })} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("dangerous=true: Cancel is before Confirm in DOM order", () => {
    render(<ConfirmModal {...defaultProps({ dangerous: true })} />);
    const cancel = screen.getByText("Cancel");
    const ok = screen.getByText("OK");
    const position = cancel.compareDocumentPosition(ok);
    // DOCUMENT_POSITION_FOLLOWING = 4 means ok comes after cancel
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("dangerous=true: Cancel button receives focus on open", () => {
    render(<ConfirmModal {...defaultProps({ dangerous: true })} />);
    const cancel = screen.getByText("Cancel");
    expect(document.activeElement).toBe(cancel);
  });

  it("dangerous=false (default): Cancel button receives focus on open", () => {
    render(<ConfirmModal {...defaultProps()} />);
    const cancel = screen.getByText("Cancel");
    expect(document.activeElement).toBe(cancel);
  });

  it("isBusy=true: both buttons are disabled", () => {
    render(<ConfirmModal {...defaultProps({ isBusy: true })} />);
    const buttons = screen.getAllByRole("button") as HTMLButtonElement[];
    buttons.forEach((btn) => expect(btn.disabled).toBe(true));
  });

  it("isBusy=true: Escape does NOT call onCancel", () => {
    const onCancel = vi.fn();
    render(<ConfirmModal {...defaultProps({ isBusy: true, onCancel })} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("isBusy=true: a spinner is rendered inside the Confirm button", () => {
    render(
      <ConfirmModal
        {...defaultProps({ isBusy: true, confirmLabel: "Delete" })}
      />,
    );
    // The Button's loading spinner is a span with animate-spin inside the button
    const confirmBtn = screen
      .getByText("Delete")
      .closest("button") as HTMLElement;
    const spinner = confirmBtn.querySelector(".animate-spin");
    expect(spinner).toBeTruthy();
  });

  it("checkbox slot renders and fires onChange", () => {
    const onChange = vi.fn();
    render(
      <ConfirmModal
        {...defaultProps({
          checkbox: { label: "Also delete files", checked: false, onChange },
        })}
      />,
    );
    const checkbox = screen.getByRole("checkbox") as HTMLInputElement;
    expect(screen.getByText("Also delete files")).toBeDefined();
    fireEvent.click(checkbox);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("dangerous=true: confirm button uses danger variant (bg-destructive)", () => {
    render(
      <ConfirmModal
        {...defaultProps({ dangerous: true, confirmLabel: "Delete" })}
      />,
    );
    const confirmBtn = screen
      .getByText("Delete")
      .closest("button") as HTMLElement;
    expect(confirmBtn.className).toContain("bg-destructive");
  });

  it("dangerous=false: confirm button uses primary variant (bg-primary)", () => {
    render(<ConfirmModal {...defaultProps({ confirmLabel: "Save" })} />);
    const confirmBtn = screen
      .getByText("Save")
      .closest("button") as HTMLElement;
    expect(confirmBtn.className).toContain("bg-primary");
  });

  it("calls onConfirm when confirm button is clicked", () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmModal {...defaultProps({ onConfirm, confirmLabel: "Yes" })} />,
    );
    fireEvent.click(screen.getByText("Yes"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when cancel button is clicked", () => {
    const onCancel = vi.fn();
    render(<ConfirmModal {...defaultProps({ onCancel })} />);
    fireEvent.click(screen.getByText("Cancel"));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
