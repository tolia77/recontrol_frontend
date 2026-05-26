import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { Modal } from "../Modal";

afterEach(() => cleanup());

describe("Modal", () => {
  it("returns null when open=false", () => {
    const { container } = render(
      <Modal open={false} onClose={() => {}}>
        <Modal.Body>content</Modal.Body>
      </Modal>,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders children with role="dialog" aria-modal="true" when open=true', () => {
    render(
      <Modal open={true} onClose={() => {}}>
        <Modal.Header>Title</Modal.Header>
        <Modal.Body>body text</Modal.Body>
      </Modal>,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(screen.getByText("body text")).toBeDefined();
  });

  it("calls onClose when Escape is pressed", () => {
    const onClose = vi.fn();
    render(
      <Modal open={true} onClose={onClose}>
        <Modal.Body>content</Modal.Body>
      </Modal>,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does NOT call onClose on Escape when suppressEsc=true", () => {
    const onClose = vi.fn();
    render(
      <Modal open={true} onClose={onClose} suppressEsc>
        <Modal.Body>content</Modal.Body>
      </Modal>,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("calls onClose when clicking the backdrop", () => {
    const onClose = vi.fn();
    render(
      <Modal open={true} onClose={onClose}>
        <Modal.Body>content</Modal.Body>
      </Modal>,
    );
    const backdrop = document.querySelector(
      '[role="presentation"]',
    ) as HTMLElement;
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does NOT call onClose on backdrop click when suppressOverlayClick=true", () => {
    const onClose = vi.fn();
    render(
      <Modal open={true} onClose={onClose} suppressOverlayClick>
        <Modal.Body>content</Modal.Body>
      </Modal>,
    );
    const backdrop = document.querySelector(
      '[role="presentation"]',
    ) as HTMLElement;
    fireEvent.click(backdrop);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("does NOT call onClose when clicking the inner card (stopPropagation)", () => {
    const onClose = vi.fn();
    render(
      <Modal open={true} onClose={onClose}>
        <Modal.Body>card content</Modal.Body>
      </Modal>,
    );
    fireEvent.click(screen.getByRole("dialog"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("applies body scroll-lock on open and restores on close", () => {
    const { rerender } = render(
      <Modal open={true} onClose={() => {}}>
        <Modal.Body>content</Modal.Body>
      </Modal>,
    );
    expect(document.body.style.overflow).toBe("hidden");

    rerender(
      <Modal open={false} onClose={() => {}}>
        <Modal.Body>content</Modal.Body>
      </Modal>,
    );
    expect(document.body.style.overflow).not.toBe("hidden");
  });

  it('size="full" renders w-full max-w-5xl (not centered max-w-md)', () => {
    render(
      <Modal open={true} onClose={() => {}} size="full">
        <Modal.Body>full</Modal.Body>
      </Modal>,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog.className).toContain("max-w-5xl");
    expect(dialog.className).not.toContain("max-w-md");
  });

  it('size="md" (default) renders centered max-w-md', () => {
    render(
      <Modal open={true} onClose={() => {}}>
        <Modal.Body>md</Modal.Body>
      </Modal>,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog.className).toContain("max-w-md");
  });

  it("aria-labelledby on dialog resolves to the Modal.Header h2 id", () => {
    render(
      <Modal open={true} onClose={() => {}}>
        <Modal.Header>Title</Modal.Header>
        <Modal.Body>body</Modal.Body>
      </Modal>,
    );
    const dialog = screen.getByRole("dialog");
    const heading = screen.getByRole("heading", { name: "Title" });
    const labelledById = dialog.getAttribute("aria-labelledby");
    const headingId = heading.getAttribute("id");
    expect(labelledById).toBeTruthy();
    expect(headingId).toBeTruthy();
    expect(labelledById).toBe(headingId);
  });

  it("ariaLabel prop sets aria-label and omits aria-labelledby (no dangling id)", () => {
    render(
      <Modal open={true} onClose={() => {}} ariaLabel="Processes">
        <Modal.Body>content without header</Modal.Body>
      </Modal>,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-label")).toBe("Processes");
    expect(dialog.hasAttribute("aria-labelledby")).toBe(false);
  });

  it('size="full" backdrop contains flex centering classes', () => {
    render(
      <Modal open={true} onClose={() => {}} size="full">
        <Modal.Body>full content</Modal.Body>
      </Modal>,
    );
    const backdrop = document.querySelector(
      '[role="presentation"]',
    ) as HTMLElement;
    expect(backdrop.className).toContain("items-center");
    expect(backdrop.className).toContain("justify-center");
  });
});
