import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDownIcon } from "../icons";
import { ResolutionControl } from "./ResolutionControl";
import { FpsControls } from "./FpsControls";

interface QualityPopoverProps {
  currentResolution: number;
  onResolutionChange: (resolution: number) => void;
  currentFps: number;
  onFpsChange: (fps: number) => void;
  showStats: boolean;
  onToggleStats: () => void;
  disabled?: boolean;
}

/**
 * Quality summary chip (`1080p · 24fps ▾`) that opens a dropdown bundling the
 * existing ResolutionControl + FpsControls + stats toggle. Replaces the three
 * separate stream controls that used to live stacked in the sidebar.
 *
 * The reused ResolutionControl / FpsControls are styled for a dark surface
 * (gray-400 labels, bg-white/10 inputs), so they sit in a dark "control well"
 * inside the otherwise-light popover — keeping them unchanged per the handoff.
 */
export function QualityPopover({
  currentResolution,
  onResolutionChange,
  currentFps,
  onFpsChange,
  showStats,
  onToggleStats,
  disabled,
}: QualityPopoverProps) {
  const { t } = useTranslation("deviceControl");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="text-text flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-100 px-2.5 py-1 font-mono text-xs transition-colors hover:bg-gray-200"
      >
        <span>{`${currentResolution}p · ${currentFps}fps`}</span>
        <ChevronDownIcon
          className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={t("topbar.quality.title")}
          className="absolute top-full right-0 z-50 mt-2 w-64 rounded-xl border border-gray-200 bg-white p-3 shadow-lg"
        >
          <h3 className="text-darkgray mb-2 text-xs font-semibold tracking-wide uppercase">
            {t("topbar.quality.title")}
          </h3>
          <div className="space-y-3 rounded-lg bg-gray-800 p-3">
            <div className="flex items-center justify-between">
              <ResolutionControl
                currentResolution={currentResolution}
                onResolutionChange={onResolutionChange}
                disabled={disabled}
              />
            </div>
            <div className="flex items-center justify-between">
              <FpsControls
                currentFps={currentFps}
                onFpsChange={onFpsChange}
                disabled={disabled}
              />
            </div>
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={onToggleStats}
                aria-pressed={showStats}
                className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                  showStats
                    ? "bg-indigo-500 text-white"
                    : "bg-white/10 text-gray-300 hover:bg-white/20"
                }`}
              >
                {showStats ? t("sidebar.hideStats") : t("sidebar.showStats")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
