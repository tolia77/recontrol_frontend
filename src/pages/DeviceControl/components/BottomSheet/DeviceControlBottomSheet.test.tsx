import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import { deviceControl as deviceControlEn } from "src/locales/en/deviceControl";
import DeviceControlBottomSheet from "./DeviceControlBottomSheet";

beforeAll(async () => {
  if (!i18next.isInitialized) {
    await i18next.use(initReactI18next).init({
      lng: "en",
      fallbackLng: "en",
      ns: ["deviceControl"],
      defaultNS: "deviceControl",
      resources: { en: { deviceControl: deviceControlEn } },
      interpolation: { escapeValue: false },
      react: { useSuspense: false },
    });
  } else {
    await i18next.changeLanguage("en");
  }
});

// Override matchMedia to simulate portrait (default) or landscape
function mockMatchMedia(isLandscape: boolean) {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: query.includes("orientation: landscape") ? isLandscape : false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(() => false),
    }) as unknown as MediaQueryList;
}

beforeEach(() => {
  mockMatchMedia(false); // portrait by default
});

afterEach(() => {
  // Restore body overflow after each test
  document.body.style.overflow = "";
  // Manual cleanup since globals:false means RTL can't auto-register afterEach
  cleanup();
});

describe("DeviceControlBottomSheet", () => {
  it("mounts children in the DOM even when closed (always-mounted)", () => {
    const onClose = vi.fn();
    render(
      <DeviceControlBottomSheet open={false} onClose={onClose} title="Files">
        <div data-testid="sheet-content">File content</div>
      </DeviceControlBottomSheet>
    );

    // Children must be present in the DOM when closed (not unmounted)
    expect(screen.getByTestId("sheet-content")).toBeTruthy();
    expect(screen.getByText("Files")).toBeTruthy();
  });

  it("applies closed CSS classes (translate-y-full, invisible) when open=false", () => {
    const onClose = vi.fn();
    const { container } = render(
      <DeviceControlBottomSheet open={false} onClose={onClose} title="Files">
        <div>content</div>
      </DeviceControlBottomSheet>
    );

    // The sheet container should have translate-y-full and invisible classes
    const sheet = container.querySelector("[data-testid='bottom-sheet']");
    expect(sheet).toBeTruthy();
    expect(sheet?.className).toContain("translate-y-full");
    expect(sheet?.className).toContain("invisible");
  });

  it("does not render the backdrop when closed", () => {
    const onClose = vi.fn();
    render(
      <DeviceControlBottomSheet open={false} onClose={onClose} title="Files">
        <div>content</div>
      </DeviceControlBottomSheet>
    );

    // Backdrop should not be present when closed
    expect(screen.queryByTestId("sheet-backdrop")).toBeNull();
  });

  it("renders the backdrop when open", () => {
    const onClose = vi.fn();
    render(
      <DeviceControlBottomSheet open={true} onClose={onClose} title="Files">
        <div>content</div>
      </DeviceControlBottomSheet>
    );

    expect(screen.getByTestId("sheet-backdrop")).toBeTruthy();
  });

  it("applies open CSS classes (translate-y-0) when open=true", () => {
    const onClose = vi.fn();
    const { container } = render(
      <DeviceControlBottomSheet open={true} onClose={onClose} title="Files">
        <div>content</div>
      </DeviceControlBottomSheet>
    );

    const sheet = container.querySelector("[data-testid='bottom-sheet']");
    expect(sheet?.className).toContain("translate-y-0");
    expect(sheet?.className).not.toContain("translate-y-full");
    expect(sheet?.className).not.toContain("invisible");
  });

  it("calls onClose when close button is clicked", () => {
    const onClose = vi.fn();
    render(
      <DeviceControlBottomSheet open={true} onClose={onClose} title="Files">
        <div>content</div>
      </DeviceControlBottomSheet>
    );

    const closeButton = screen.getByRole("button", { name: "Close panel" });
    fireEvent.click(closeButton);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when backdrop is clicked", () => {
    const onClose = vi.fn();
    render(
      <DeviceControlBottomSheet open={true} onClose={onClose} title="Files">
        <div>content</div>
      </DeviceControlBottomSheet>
    );

    const backdrop = screen.getByTestId("sheet-backdrop");
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when swipe-down past 80px threshold on drag handle", () => {
    const onClose = vi.fn();
    const { container } = render(
      <DeviceControlBottomSheet open={true} onClose={onClose} title="Files">
        <div>content</div>
      </DeviceControlBottomSheet>
    );

    const dragHandle = container.querySelector("[data-testid='drag-handle-zone']");
    expect(dragHandle).toBeTruthy();

    // Simulate pointerdown then pointermove 95px down then pointerup
    fireEvent.pointerDown(dragHandle as Element, { clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(dragHandle as Element, { clientY: 195, pointerId: 1 }); // delta = 95px (≥80)
    fireEvent.pointerUp(dragHandle as Element, { clientY: 195, pointerId: 1 });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does NOT call onClose when swipe-down is less than 80px threshold", () => {
    const onClose = vi.fn();
    const { container } = render(
      <DeviceControlBottomSheet open={true} onClose={onClose} title="Files">
        <div>content</div>
      </DeviceControlBottomSheet>
    );

    const dragHandle = container.querySelector("[data-testid='drag-handle-zone']");

    // Simulate swipe-down of only 50px — below threshold
    fireEvent.pointerDown(dragHandle as Element, { clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(dragHandle as Element, { clientY: 150, pointerId: 1 }); // delta = 50px (<80)
    fireEvent.pointerUp(dragHandle as Element, { clientY: 150, pointerId: 1 });

    expect(onClose).not.toHaveBeenCalled();
  });

  it("has correct close button aria-label 'Close panel'", () => {
    const onClose = vi.fn();
    render(
      <DeviceControlBottomSheet open={true} onClose={onClose} title="Files">
        <div>content</div>
      </DeviceControlBottomSheet>
    );

    const closeButton = screen.getByRole("button", { name: "Close panel" });
    expect(closeButton).toBeTruthy();
  });

  it("renders title in the header", () => {
    const onClose = vi.fn();
    render(
      <DeviceControlBottomSheet open={true} onClose={onClose} title="Scenarios">
        <div>content</div>
      </DeviceControlBottomSheet>
    );

    expect(screen.getByText("Scenarios")).toBeTruthy();
  });
});
