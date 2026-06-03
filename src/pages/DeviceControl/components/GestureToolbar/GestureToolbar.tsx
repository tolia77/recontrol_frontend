import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router";
import PowerPopover from "src/pages/DeviceControl/components/Power/PowerPopover";
import { PowerIcon, CloseIcon, ScenariosIcon } from "src/pages/DeviceControl/components/icons/icons";
import { FilesToggleIcon } from "src/pages/DeviceControl/components/FileManager/icons";
import { AssistantToggleIcon } from "src/pages/DeviceControl/components/Assistant/icons";
import type { CommandAction } from "src/pages/DeviceControl/types";

export interface Props {
  addAction: (a: CommandAction) => void;
  disabled?: boolean;
  rightPaneActive: "files" | "assistant" | "scenarios" | null;
  /** Sets rightPaneActive AND opens the sheet — combined handler from Plan 04 */
  onSelectPanel: (p: "files" | "assistant" | "scenarios") => void;
  aiAllowed: boolean;
  /** Called when Assistant tapped while AI is gated — show UpgradeModal upstream */
  onAiBlocked: () => void;
  onDisconnect: () => void;
  deviceName?: string;
}

// Inline SVG: three horizontal dots (hamburger/more)
function DotsIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
    </svg>
  );
}

// Inline SVG: keyboard glyph
function KeyboardIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8" />
    </svg>
  );
}

/**
 * GestureToolbar — collapsible FAB cluster for the mobile DeviceControl shell.
 *
 * Collapsed: a single 52×52 bg-primary circle anchored to the bottom-right
 * corner, respecting safe-area insets (KBD-01, D-01, D-02).
 *
 * Expanded: a vertical stack of action items expanding upward from the FAB
 * anchor (D-03). Actions: touch-mode indicator, Files, Assistant, Scenarios,
 * Keyboard (raises native soft keyboard via synchronous .focus() — D-10),
 * Power (re-hosts PowerPopover), Disconnect.
 *
 * iOS gotcha: keyboard focus() MUST be synchronous inside the tap handler.
 */
function GestureToolbar({
  addAction,
  disabled,
  rightPaneActive,
  onSelectPanel,
  aiAllowed,
  onAiBlocked,
  onDisconnect,
}: Props) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [keyboardRaised, setKeyboardRaised] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const hiddenInputRef = useRef<HTMLInputElement>(null);

  // Outside-click + Escape to collapse (mirrors PowerPopover lines 50-65)
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Track keyboard raised state via focus/blur on the hidden input
  const handleInputFocus = () => setKeyboardRaised(true);
  const handleInputBlur = () => setKeyboardRaised(false);

  // Keyboard toggle — CRITICAL: focus() MUST be synchronous (iOS requirement)
  const handleKeyboardToggle = () => {
    if (keyboardRaised) {
      hiddenInputRef.current?.blur();
    } else {
      // Synchronous focus — no await/setTimeout (iOS Safari ignores async focus)
      hiddenInputRef.current?.focus();
    }
  };

  const handleDisconnect = () => {
    setOpen(false);
    onDisconnect();
  };

  const handleSelectPanel = (panel: "files" | "assistant" | "scenarios") => {
    setOpen(false);
    onSelectPanel(panel);
  };

  const handleAssistant = () => {
    if (!aiAllowed) {
      onAiBlocked();
    } else {
      handleSelectPanel("assistant");
    }
    setOpen(false);
  };

  const handleNavigateBack = () => {
    navigate("/devices");
  };

  return (
    <div
      ref={containerRef}
      className="fixed z-40"
      style={{
        bottom: "calc(env(safe-area-inset-bottom) + 16px)",
        right: "calc(env(safe-area-inset-right) + 16px)",
      }}
    >
      {/* Hidden off-screen input for native soft keyboard raise (D-10, KBD-01).
          Must NOT be display:none or visibility:hidden — must remain focusable.
          No onKeyDown/onKeyUp this phase (forwarding is Phase 37). */}
      <input
        ref={hiddenInputRef}
        type="text"
        aria-hidden="true"
        className="absolute -left-[9999px] opacity-0"
        onFocus={handleInputFocus}
        onBlur={handleInputBlur}
        readOnly={false}
      />

      {/* Expanded action stack — appears above the FAB, transition via opacity/transform */}
      {open && (
        <div className="mb-3 flex flex-col items-end gap-2">
          {/* 1. Touch mode indicator — read-only pill (D-04: Interactive-only on mobile) */}
          <div
            className="flex min-h-[44px] min-w-[44px] items-center gap-2 rounded-lg border border-lightgray bg-background px-3 py-2 shadow-md"
            aria-label="Touch mode"
          >
            <span className="h-2 w-2 shrink-0 rounded-full bg-accent" aria-hidden="true" />
            <span className="text-sm text-text">Trackpad mode</span>
          </div>

          {/* 2. Files launcher */}
          <button
            type="button"
            onClick={() => handleSelectPanel("files")}
            className={`flex min-h-[44px] min-w-[44px] items-center gap-2 rounded-lg border px-3 py-2 shadow-md transition-colors ${
              rightPaneActive === "files"
                ? "border-accent/30 bg-tertiary text-text"
                : "border-lightgray bg-background text-darkgray hover:text-text hover:bg-tertiary"
            }`}
          >
            <FilesToggleIcon className="h-5 w-5" />
            <span className="text-sm">Files</span>
          </button>

          {/* 3. Assistant launcher (AI-gated) */}
          <button
            type="button"
            onClick={handleAssistant}
            className={`flex min-h-[44px] min-w-[44px] items-center gap-2 rounded-lg border px-3 py-2 shadow-md transition-colors ${
              rightPaneActive === "assistant"
                ? "border-accent/30 bg-tertiary text-text"
                : "border-lightgray bg-background text-darkgray hover:text-text hover:bg-tertiary"
            }`}
          >
            <AssistantToggleIcon className="h-5 w-5" />
            <span className="text-sm">Assistant</span>
          </button>

          {/* 4. Scenarios launcher */}
          <button
            type="button"
            onClick={() => handleSelectPanel("scenarios")}
            className={`flex min-h-[44px] min-w-[44px] items-center gap-2 rounded-lg border px-3 py-2 shadow-md transition-colors ${
              rightPaneActive === "scenarios"
                ? "border-accent/30 bg-tertiary text-text"
                : "border-lightgray bg-background text-darkgray hover:text-text hover:bg-tertiary"
            }`}
          >
            <ScenariosIcon className="h-5 w-5" />
            <span className="text-sm">Scenarios</span>
          </button>

          {/* 5. Keyboard toggle (D-10) */}
          <button
            type="button"
            onClick={handleKeyboardToggle}
            className={`flex min-h-[44px] min-w-[44px] items-center gap-2 rounded-lg border px-3 py-2 shadow-md transition-colors ${
              keyboardRaised
                ? "border-accent text-accent bg-background"
                : "border-lightgray bg-background text-darkgray hover:text-text hover:bg-tertiary"
            }`}
            aria-pressed={keyboardRaised}
          >
            <KeyboardIcon className="h-5 w-5" />
            <span className="text-sm">{keyboardRaised ? "Keyboard on" : "Keyboard"}</span>
          </button>

          {/* 6. Power — re-hosts the existing PowerPopover (T-36-06 gate) */}
          <div className="flex min-h-[44px] min-w-[44px] items-center gap-2 rounded-lg border border-lightgray bg-background px-3 py-2 shadow-md text-error">
            <PowerIcon className="h-5 w-5" />
            <span className="text-sm">Power</span>
            <div className="ml-auto">
              <PowerPopover addAction={addAction} disabled={disabled} />
            </div>
          </div>

          {/* 7. Disconnect */}
          <button
            type="button"
            onClick={handleDisconnect}
            className="flex min-h-[44px] min-w-[44px] items-center gap-2 rounded-lg border border-lightgray bg-background px-3 py-2 shadow-md text-error transition-colors hover:bg-tertiary"
          >
            <CloseIcon className="h-5 w-5" />
            <span className="text-sm">Disconnect</span>
          </button>

          {/* Back to devices (alternative to disconnect) */}
          <button
            type="button"
            onClick={handleNavigateBack}
            className="flex min-h-[44px] min-w-[44px] items-center gap-2 rounded-lg border border-lightgray bg-background px-3 py-2 shadow-md text-darkgray transition-colors hover:text-text hover:bg-tertiary"
          >
            <span className="text-sm">Back</span>
          </button>
        </div>
      )}

      {/* Collapsed FAB button — 52×52 bg-primary circle */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Open controls"
        aria-expanded={open}
        className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-primary text-white shadow-lg transition-opacity hover:opacity-90 active:opacity-80"
      >
        <DotsIcon className="h-6 w-6" />
      </button>
    </div>
  );
}

export default GestureToolbar;
