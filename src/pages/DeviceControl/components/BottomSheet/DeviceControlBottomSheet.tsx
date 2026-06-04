import { useEffect, useRef, type ReactNode } from "react";
import { CloseIcon } from "src/pages/DeviceControl/components/icons/icons";
import { useOrientation } from "src/pages/DeviceControl/hooks/useOrientation";

export interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Single active panel node (Files/Assistant/Scenarios) — one tool at a time (D-07) */
  children: ReactNode;
  /**
   * When true and portrait orientation, expands the sheet to h-dvh so the
   * active panel (e.g. Assistant) is fully visible above the soft keyboard
   * (DCTL-04 D-10). Landscape is always h-dvh so this has no effect there.
   */
  forceFullHeight?: boolean;
}

/**
 * DeviceControlBottomSheet — always-mounted custom slide-up sheet.
 *
 * CRITICAL: This component NEVER returns null based on `open`. It must stay
 * mounted so the `<video>` stream behind it is never disturbed (DCTL-02,
 * T-36-08). Closed state uses CSS translate-y-full + invisible, NOT
 * conditional rendering.
 *
 * NOT ui/Modal: Modal does `if(!open) return null` which would tear down
 * children and risk the video.
 *
 * Portrait:  h-[50dvh]  (stream stays visible above the sheet)
 * Landscape: h-dvh      (full-screen; landscape viewport too short for half)
 * (D-05; driven off useOrientation hook, NEVER md:/lg: — S5 landmine)
 */
function DeviceControlBottomSheet({ open, onClose, title, children, forceFullHeight }: Props) {
  const { isLandscape } = useOrientation();

  // Drag state for swipe-down dismiss
  const dragStartY = useRef<number | null>(null);
  const dragCurrentY = useRef<number>(0);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Scroll lock — replicate Modal.tsx lines 70-77
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Drag handle pointer event handlers for swipe-down dismiss (D-06)
  const handleDragPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragStartY.current = e.clientY;
    dragCurrentY.current = e.clientY;
    // setPointerCapture may not be available in all environments (e.g., jsdom in tests)
    try {
      (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    } catch {
      // Gracefully ignore — the drag gesture still works without pointer capture
    }
  };

  const handleDragPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragStartY.current === null) return;
    const delta = e.clientY - dragStartY.current;
    dragCurrentY.current = e.clientY;
    // Only allow downward drag (delta >= 0)
    if (delta > 0 && sheetRef.current) {
      sheetRef.current.style.transform = `translateY(${delta}px)`;
    }
  };

  const handleDragPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragStartY.current === null) return;
    const delta = e.clientY - dragStartY.current;
    dragStartY.current = null;

    if (delta >= 80) {
      // Threshold met — dismiss
      if (sheetRef.current) {
        sheetRef.current.style.transform = "";
      }
      onClose();
    } else {
      // Spring back to resting position
      if (sheetRef.current) {
        sheetRef.current.style.transform = "";
      }
    }
  };

  // Sheet panel CSS classes — always mounted, toggle visibility via CSS
  const baseClasses = [
    "fixed left-0 right-0 bottom-0 z-30",
    "bg-background border-t border-lightgray shadow-xl",
    "pb-[calc(env(safe-area-inset-bottom)+1rem)]",
    "overflow-y-auto",
    "transition-transform duration-300 ease-out",
  ].join(" ");

  const orientationClasses = isLandscape
    ? "inset-0 h-dvh rounded-none"
    : forceFullHeight
      ? "h-dvh rounded-t-2xl"
      : "h-[50dvh] rounded-t-2xl";

  const visibilityClasses = open
    ? "translate-y-0"
    : "translate-y-full invisible pointer-events-none";

  return (
    <>
      {/* Backdrop — only rendered when open (D-06 dismiss path 2) */}
      {open && (
        <div
          data-testid="sheet-backdrop"
          className="fixed inset-0 z-30 bg-black/40"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sheet panel — ALWAYS MOUNTED; visibility toggled via CSS (DCTL-02, T-36-08) */}
      <div
        ref={sheetRef}
        data-testid="bottom-sheet"
        aria-hidden={!open}
        aria-modal={open ? "true" : undefined}
        role={open ? "dialog" : undefined}
        aria-label={open ? title : undefined}
        className={`${baseClasses} ${orientationClasses} ${visibilityClasses}`}
      >
        {/* Drag handle zone — 40px tall target for swipe-down dismiss (D-06 path 1) */}
        <div
          data-testid="drag-handle-zone"
          className="flex h-10 cursor-grab items-center justify-center active:cursor-grabbing"
          onPointerDown={handleDragPointerDown}
          onPointerMove={handleDragPointerMove}
          onPointerUp={handleDragPointerUp}
          aria-hidden="true"
        >
          {/* Centered pill — w-10 h-1 bg-lightgray rounded-full */}
          <div className="h-1 w-10 rounded-full bg-lightgray" />
        </div>

        {/* Header — title left, close button right (D-06 dismiss path 3) */}
        <div className="flex items-center justify-between px-4 pb-0 pt-2">
          <span className="text-[20px] font-medium text-text">{title}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            className="flex h-[44px] w-[44px] items-center justify-center rounded-lg bg-transparent text-darkgray transition-colors hover:text-text"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Panel content — one tool at a time per rightPaneActive (D-07) */}
        <div className="overflow-y-auto px-4 py-2">{children}</div>
      </div>
    </>
  );
}

export default DeviceControlBottomSheet;
