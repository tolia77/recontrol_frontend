import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import PowerPopover from "src/pages/DeviceControl/components/Power/PowerPopover";
import { PowerIcon, CloseIcon, ScenariosIcon } from "src/pages/DeviceControl/components/icons/icons";
import { FilesToggleIcon } from "src/pages/DeviceControl/components/FileManager/icons";
import { AssistantToggleIcon } from "src/pages/DeviceControl/components/Assistant/icons";
import type { CommandAction } from "src/pages/DeviceControl/types";
import { mapToVirtualKey } from "src/pages/DeviceControl/utils/keyboard";
import { useVisualViewport } from "src/pages/DeviceControl/hooks/useVisualViewport";
import { generateUUID } from "src/utils/uuid";
import ModifierStrip, { type ModifierStripHandle } from "./ModifierStrip";
import React from "react";

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
  /**
   * Whether the user has `access_keyboard` permission (T-37-01 security gate).
   * All keyboard.* dispatches are gated behind this flag.
   * Threaded from DeviceControl.tsx which reads it from usePermissions.
   */
  canUseKeyboard?: boolean;
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
 *
 * Phase 37 additions (KBD-02/KBD-03):
 * - onInput/onKeyDown handlers on the hidden input forward chars + control keys
 * - ModifierStrip mounted when keyboardRaised && rightPaneActive === null
 * - canUseKeyboard prop gates all keyboard.* dispatches (T-37-01)
 */
function GestureToolbar({
  addAction,
  disabled,
  rightPaneActive,
  onSelectPanel,
  aiAllowed,
  onAiBlocked,
  onDisconnect,
  canUseKeyboard = false,
}: Props) {
  const navigate = useNavigate();
  const { t } = useTranslation("deviceControl");
  const [open, setOpen] = useState(false);
  const [keyboardRaised, setKeyboardRaised] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const hiddenInputRef = useRef<HTMLInputElement>(null);
  const modifierStripRef = React.useRef<ModifierStripHandle>(null);

  // Maps timerId → vk for pending hidden-input keyUp timers (CR-02 fix)
  const pendingKeyUpTimers = useRef<Map<number, number>>(new Map());

  // Unmount cleanup: flush any pending hidden-input keyUp timers synchronously.
  useEffect(() => {
    return () => {
      for (const [id, vk] of pendingKeyUpTimers.current) {
        clearTimeout(id);
        addAction({ id: generateUUID(), type: "keyboard.keyUp", payload: { Key: vk } });
      }
      pendingKeyUpTimers.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track keyboard height from VisualViewport for strip docking (D-05)
  const { keyboardHeight } = useVisualViewport();

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
    // Sheet-wins: blur hidden input so the strip unmounts (rightPaneActive !== null)
    hiddenInputRef.current?.blur();
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

  // ---------------------------------------------------------------------------
  // KBD-02: Hidden input typing pipeline
  // ---------------------------------------------------------------------------

  /**
   * handleHiddenInput — processes characters typed on the soft keyboard.
   *
   * - Bail if keyboard not raised, disabled, or canUseKeyboard is false (T-37-01)
   * - If a modifier is sticky, route char through deliverPrintable (D-09)
   * - Otherwise dispatch keyboard.typeText (D-01 hybrid)
   * - Clear input value after every send (D-03 no local echo)
   */
  const handleHiddenInput = useCallback(
    (e: React.FormEvent<HTMLInputElement>) => {
      if (!keyboardRaised || disabled || !canUseKeyboard) return;
      const text = e.currentTarget.value;
      if (!text) return;

      // Combo routing only handles a single printable ASCII character — VK
      // mapping via charCodeAt cannot represent non-Latin input (Cyrillic) or
      // multi-char commits (word suggestions, swipe-to-type, paste). Anything
      // else falls through to typeText so it is delivered verbatim instead of
      // being truncated or corrupted.
      const isSingleLatinChar = text.length === 1 && /[\x20-\x7e]/.test(text);
      if (isSingleLatinChar && modifierStripRef.current?.hasActiveModifier()) {
        // D-09: combo routing — route through sticky modifiers
        modifierStripRef.current.deliverPrintable(text);
      } else {
        // D-01: printable char — typeText envelope
        addAction({ id: generateUUID(), type: "keyboard.typeText", payload: { Text: text } });
      }
      // D-03: clear after send (RustDesk pattern, also fixes Pitfall 3)
      e.currentTarget.value = "";
    },
    [keyboardRaised, disabled, canUseKeyboard, addAction],
  );

  /**
   * handleHiddenKeyDown — processes control key presses.
   *
   * Passthrough keys (Enter, Backspace, Delete, Escape, Tab, arrows) are sent
   * as keyDown/keyUp pairs. Printable keys fall through to onInput.
   * All dispatches gated on canUseKeyboard (T-37-01).
   */
  const handleHiddenKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!keyboardRaised || !canUseKeyboard) return;

      const PASSTHROUGH = new Set([
        "Enter",
        "Backspace",
        "Delete",
        "Escape",
        "Tab",
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "ArrowDown",
      ]);

      if (!PASSTHROUGH.has(e.key)) return; // printable → handled by onInput

      e.preventDefault();
      const vk = mapToVirtualKey(e);
      if (!vk) return;

      addAction({ id: generateUUID(), type: "keyboard.keyDown", payload: { Key: vk } });
      const timerId = window.setTimeout(() => {
        pendingKeyUpTimers.current.delete(timerId);
        addAction({ id: generateUUID(), type: "keyboard.keyUp", payload: { Key: vk } });
      }, 50);
      pendingKeyUpTimers.current.set(timerId, vk);
    },
    [keyboardRaised, canUseKeyboard, addAction],
  );

  // Strip is mounted only when keyboard is raised AND no panel is open (sheet wins)
  const showStrip = keyboardRaised && rightPaneActive === null;

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
          Phase 37: onInput/onKeyDown handlers attached + D-02 autocorrect suppression. */}
      <input
        ref={hiddenInputRef}
        type="text"
        aria-hidden="true"
        className="absolute -left-[9999px] opacity-0"
        onFocus={handleInputFocus}
        onBlur={handleInputBlur}
        onInput={handleHiddenInput}
        onKeyDown={handleHiddenKeyDown}
        readOnly={false}
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        autoComplete="off"
      />

      {/* Modifier strip — docked above the soft keyboard, rendered when strip is active */}
      {showStrip && (
        <ModifierStrip
          ref={modifierStripRef}
          addAction={addAction}
          disabled={!canUseKeyboard}
          keyboardHeightPx={keyboardHeight}
          t={t}
        />
      )}

      {/* Expanded action stack — appears above the FAB, transition via opacity/transform */}
      {open && (
        <div className="mb-3 flex flex-col items-end gap-2">
          {/* 1. Touch mode indicator — read-only pill (D-04: Interactive-only on mobile) */}
          <div
            className="flex min-h-[44px] min-w-[44px] items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 shadow-overlay"
            aria-label={t("mobile.toolbar.trackpadMode")}
          >
            <span className="h-2 w-2 shrink-0 rounded-full bg-success" aria-hidden="true" />
            <span className="text-body text-foreground">{t("mobile.toolbar.trackpadMode")}</span>
          </div>

          {/* 2. Files launcher */}
          <button
            type="button"
            onClick={() => handleSelectPanel("files")}
            className={`flex min-h-[44px] min-w-[44px] items-center gap-2 rounded-md border px-3 py-2 shadow-overlay transition-colors duration-150 ${
              rightPaneActive === "files"
                ? "border-primary/30 bg-primary/10 text-foreground"
                : "border-border bg-surface text-muted-foreground hover:text-foreground hover:bg-primary/8"
            }`}
          >
            <FilesToggleIcon className="h-5 w-5" />
            <span className="text-body">{t("mobile.toolbar.files")}</span>
          </button>

          {/* 3. Assistant launcher (AI-gated) */}
          <button
            type="button"
            onClick={handleAssistant}
            className={`flex min-h-[44px] min-w-[44px] items-center gap-2 rounded-md border px-3 py-2 shadow-overlay transition-colors duration-150 ${
              rightPaneActive === "assistant"
                ? "border-primary/30 bg-primary/10 text-foreground"
                : "border-border bg-surface text-muted-foreground hover:text-foreground hover:bg-primary/8"
            }`}
          >
            <AssistantToggleIcon className="h-5 w-5" />
            <span className="text-body">{t("mobile.toolbar.assistant")}</span>
          </button>

          {/* 4. Scenarios launcher */}
          <button
            type="button"
            onClick={() => handleSelectPanel("scenarios")}
            className={`flex min-h-[44px] min-w-[44px] items-center gap-2 rounded-md border px-3 py-2 shadow-overlay transition-colors duration-150 ${
              rightPaneActive === "scenarios"
                ? "border-primary/30 bg-primary/10 text-foreground"
                : "border-border bg-surface text-muted-foreground hover:text-foreground hover:bg-primary/8"
            }`}
          >
            <ScenariosIcon className="h-5 w-5" />
            <span className="text-body">{t("mobile.toolbar.scenarios")}</span>
          </button>

          {/* 5. Keyboard toggle (D-10) */}
          <button
            type="button"
            onClick={handleKeyboardToggle}
            className={`flex min-h-[44px] min-w-[44px] items-center gap-2 rounded-md border px-3 py-2 shadow-overlay transition-colors duration-150 ${
              keyboardRaised
                ? "border-primary text-primary bg-surface"
                : "border-border bg-surface text-muted-foreground hover:text-foreground hover:bg-primary/8"
            }`}
            aria-pressed={keyboardRaised}
          >
            <KeyboardIcon className="h-5 w-5" />
            <span className="text-body">
              {keyboardRaised
                ? t("mobile.toolbar.keyboardOn")
                : t("mobile.toolbar.keyboard")}
            </span>
          </button>

          {/* 6. Power — re-hosts the existing PowerPopover (T-36-06 gate) */}
          <div className="flex min-h-[44px] min-w-[44px] items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 shadow-overlay text-destructive">
            <PowerIcon className="h-5 w-5" />
            <span className="text-body">{t("mobile.toolbar.power")}</span>
            <div className="ml-auto">
              <PowerPopover addAction={addAction} disabled={disabled} />
            </div>
          </div>

          {/* 7. Disconnect */}
          <button
            type="button"
            onClick={handleDisconnect}
            className="flex min-h-[44px] min-w-[44px] items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 shadow-overlay text-destructive transition-colors duration-150 hover:bg-destructive/10"
          >
            <CloseIcon className="h-5 w-5" />
            <span className="text-body">{t("mobile.toolbar.disconnect")}</span>
          </button>

          {/* Back to devices (alternative to disconnect) */}
          <button
            type="button"
            onClick={handleNavigateBack}
            className="flex min-h-[44px] min-w-[44px] items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 shadow-overlay text-muted-foreground transition-colors duration-150 hover:text-foreground hover:bg-primary/8"
          >
            <span className="text-body">{t("mobile.toolbar.back")}</span>
          </button>
        </div>
      )}

      {/* Collapsed FAB button — 52×52 bg-primary circle */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={t("mobile.toolbar.openControls") as string}
        aria-expanded={open}
        className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-primary text-white shadow-overlay transition-colors duration-150 hover:bg-primary-hover active:bg-primary-active"
      >
        <DotsIcon className="h-6 w-6" />
      </button>
    </div>
  );
}

export default GestureToolbar;
