import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import i18next from "i18next";
import { initReactI18next } from "react-i18next";

import { scenarios as scenariosEn } from "../../../../../locales/en/scenarios";
import { scenarios as scenariosUk } from "../../../../../locales/uk/scenarios";
import MassDeleteConfirmModal from "../MassDeleteConfirmModal";

afterEach(() => cleanup());

beforeAll(async () => {
  if (!i18next.isInitialized) {
    await i18next.use(initReactI18next).init({
      lng: "en",
      fallbackLng: "en",
      ns: ["scenarios"],
      defaultNS: "scenarios",
      resources: {
        en: { scenarios: scenariosEn },
        uk: { scenarios: scenariosUk },
      },
      interpolation: { escapeValue: false },
      react: { useSuspense: false },
    });
  } else {
    await i18next.changeLanguage("en");
  }
});

function defaultProps(
  overrides: Partial<React.ComponentProps<typeof MassDeleteConfirmModal>> = {},
) {
  return {
    open: true,
    count: 5,
    onConfirm: () => {},
    onCancel: () => {},
    ...overrides,
  };
}

function typeInto(input: HTMLElement, value: string) {
  fireEvent.change(input, { target: { value } });
}

describe("MassDeleteConfirmModal", () => {
  it("renders nothing when open=false", () => {
    const { container } = render(
      <MassDeleteConfirmModal {...defaultProps({ open: false })} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders the count in the body copy", () => {
    render(<MassDeleteConfirmModal {...defaultProps({ count: 42 })} />);
    const body = screen.getByTestId("mass-delete-body");
    expect(body.textContent).toContain("42");
  });

  it("disables [Delete all] when typedPhrase is empty", () => {
    render(<MassDeleteConfirmModal {...defaultProps()} />);
    const confirm = screen.getByTestId(
      "mass-delete-confirm",
    ) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
  });

  it('disables [Delete all] when typedPhrase is "delete" (case mismatch)', () => {
    render(<MassDeleteConfirmModal {...defaultProps()} />);
    const input = screen.getByTestId("mass-delete-input");
    typeInto(input, "delete");
    const confirm = screen.getByTestId(
      "mass-delete-confirm",
    ) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
  });

  it('disables [Delete all] when typedPhrase is "DELETE " (trailing space)', () => {
    render(<MassDeleteConfirmModal {...defaultProps()} />);
    const input = screen.getByTestId("mass-delete-input");
    typeInto(input, "DELETE ");
    const confirm = screen.getByTestId(
      "mass-delete-confirm",
    ) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
  });

  it('enables [Delete all] when typedPhrase is exactly "DELETE"', () => {
    render(<MassDeleteConfirmModal {...defaultProps()} />);
    const input = screen.getByTestId("mass-delete-input");
    typeInto(input, "DELETE");
    const confirm = screen.getByTestId(
      "mass-delete-confirm",
    ) as HTMLButtonElement;
    expect(confirm.disabled).toBe(false);
  });

  it("calls onConfirm exactly once when [Delete all] is clicked", () => {
    const onConfirm = vi.fn();
    render(<MassDeleteConfirmModal {...defaultProps({ onConfirm })} />);
    const input = screen.getByTestId("mass-delete-input");
    typeInto(input, "DELETE");
    fireEvent.click(screen.getByTestId("mass-delete-confirm"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when [Keep history] is clicked", () => {
    const onCancel = vi.fn();
    render(<MassDeleteConfirmModal {...defaultProps({ onCancel })} />);
    fireEvent.click(screen.getByTestId("mass-delete-cancel"));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel on Escape keydown", () => {
    const onCancel = vi.fn();
    render(<MassDeleteConfirmModal {...defaultProps({ onCancel })} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel on backdrop click but NOT when inner card is clicked", () => {
    const onCancel = vi.fn();
    render(<MassDeleteConfirmModal {...defaultProps({ onCancel })} />);
    // Clicking the inner card should not trigger cancel
    const card = screen.getByTestId("mass-delete-card");
    fireEvent.mouseDown(card);
    expect(onCancel).not.toHaveBeenCalled();
    // Clicking the backdrop should
    const backdrop = screen.getByTestId("mass-delete-modal");
    fireEvent.mouseDown(backdrop);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("resets typedPhrase when open transitions false -> true", () => {
    const { rerender } = render(<MassDeleteConfirmModal {...defaultProps()} />);
    const input1 = screen.getByTestId("mass-delete-input") as HTMLInputElement;
    typeInto(input1, "DELETE");
    expect(input1.value).toBe("DELETE");
    // Close
    rerender(<MassDeleteConfirmModal {...defaultProps({ open: false })} />);
    // Reopen
    rerender(<MassDeleteConfirmModal {...defaultProps({ open: true })} />);
    const input2 = screen.getByTestId("mass-delete-input") as HTMLInputElement;
    expect(input2.value).toBe("");
  });

  it("disables both buttons when loading=true", () => {
    render(<MassDeleteConfirmModal {...defaultProps({ loading: true })} />);
    const cancel = screen.getByTestId(
      "mass-delete-cancel",
    ) as HTMLButtonElement;
    const confirm = screen.getByTestId(
      "mass-delete-confirm",
    ) as HTMLButtonElement;
    expect(cancel.disabled).toBe(true);
    expect(confirm.disabled).toBe(true);
  });

  it('keeps [Delete all] disabled in Ukrainian until literal "DELETE" is typed', async () => {
    await i18next.changeLanguage("uk");
    render(<MassDeleteConfirmModal {...defaultProps()} />);
    const body = screen.getByTestId("mass-delete-body");
    // UK body must contain the literal latin string DELETE (D-22 mandate)
    expect(body.textContent).toContain("DELETE");
    const input = screen.getByTestId("mass-delete-input");
    typeInto(input, "Видалити");
    const confirm = screen.getByTestId(
      "mass-delete-confirm",
    ) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    typeInto(input, "DELETE");
    expect(confirm.disabled).toBe(false);
    await i18next.changeLanguage("en");
  });

  it("renders exactly one dialog boundary (the Modal shell, not the inner wrapper)", () => {
    render(<MassDeleteConfirmModal {...defaultProps()} />);
    // WR-04: the inner wrapper must NOT carry role="dialog" — only the Modal shell should.
    const inner = screen.getByTestId("mass-delete-modal");
    expect(inner.getAttribute("role")).toBeNull();
    expect(inner.getAttribute("aria-modal")).toBeNull();
    // The single dialog boundary belongs to the Modal shell.
    const dialogs = document.querySelectorAll('[role="dialog"]');
    expect(dialogs.length).toBe(1);
  });
});
