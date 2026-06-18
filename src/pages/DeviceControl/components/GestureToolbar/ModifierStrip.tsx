import { useState, useRef, useEffect, forwardRef, useImperativeHandle, useCallback } from "react";
import type { SyntheticEvent } from "react";
import type { CommandAction } from "src/pages/DeviceControl/types";
import { generateUUID } from "src/utils/uuid";

// VK constants (derived from utils/keyboard.ts — raw Windows VK codes)
// The strip calls addAction directly with VK numbers (bypasses mapToVirtualKey
// which requires a React.KeyboardEvent).

const MODIFIER_VK = {
  Ctrl: 17,
  Alt: 18,
  Win: 91,
  Shift: 16,
  Esc: 27,
  Tab: 9,
  ArrowLeft: 37,
  ArrowUp: 38,
  ArrowRight: 39,
  ArrowDown: 40,
  Delete: 46, // used for Ctrl+Alt+Del
} as const;

const FN_KEYS = Array.from({ length: 12 }, (_, i) => ({
  label: `F${i + 1}`,
  vk: 112 + i,
}));

// Types

export interface ModifierStripHandle {
  /** True if at least one modifier key is currently sticky. */
  hasActiveModifier(): boolean;
  /**
   * Route printable text through the active sticky modifiers.
   * For each character: keyDown(charVk), keyUp(charVk). After the full string
   * is delivered, sends keyUp for each active modifier in reverse order, then
   * clears all sticky state. Callers should only pass single Latin characters
   * (charCodeAt cannot map non-ASCII to a meaningful VK); the GestureToolbar
   * routes non-Latin / multi-char commits through typeText instead.
   */
  deliverPrintable(text: string): void;
}

type StickyKey = "ctrl" | "alt" | "win" | "shift";

interface ModifierStripProps {
  addAction: (a: CommandAction) => void;
  disabled?: boolean;
  /** Keyboard height in CSS px (from useVisualViewport); strip docks above this. */
  keyboardHeightPx: number;
  /** Translation function — strip is i18n-namespace-agnostic; caller owns useTranslation. */
  t: (key: string) => string;
}

// Component

/**
 * ModifierStrip — sticky modifier + special-key row, docked above the soft
 * keyboard using VisualViewport positioning.
 *
 * Provides one-shot sticky modifiers (Ctrl/Alt/Win/Shift), non-sticky special
 * keys (Esc/Tab/arrows), an Fn page with F1–F12 + Ctrl+Alt+Del, and the
 * `deliverPrintable` imperative API for combo routing in GestureToolbar.
 */
const ModifierStrip = forwardRef<ModifierStripHandle, ModifierStripProps>(
  function ModifierStrip({ addAction, disabled, keyboardHeightPx, t }, ref) {
    const [sticky, setSticky] = useState<Record<StickyKey, boolean>>({
      ctrl: false,
      alt: false,
      win: false,
      shift: false,
    });
    const [fnPage, setFnPage] = useState(false);

    // Refs for unmount cleanup (so the cleanup closure captures the latest values)
    const stickyRef = useRef(sticky);
    useEffect(() => { stickyRef.current = sticky; }, [sticky]);

    const disabledRef = useRef(disabled);
    useEffect(() => { disabledRef.current = disabled; }, [disabled]);

    // Maps timerId → VK(s) to flush if the timer is still pending on unmount.
    // CAD stores a special sentinel value (-1) — the cleanup handles it specially.
    const pendingTimers = useRef<Map<number, number | number[]>>(new Map());

    // Unmount cleanup: flush pending non-sticky keyUp timers and release sticky modifiers.
    useEffect(() => {
      return () => {
        // 1. Flush any pending keyUp timers synchronously.
        for (const [id, vkOrVks] of pendingTimers.current) {
          clearTimeout(id);
          const vks = Array.isArray(vkOrVks) ? vkOrVks : [vkOrVks];
          for (const vk of vks) {
            addAction({ id: generateUUID(), type: "keyboard.keyUp", payload: { Key: vk } });
          }
        }
        pendingTimers.current.clear();

        // 2. Release any sticky modifiers (skip if disabled — keyDowns never went out).
        if (!disabledRef.current) {
          const s = stickyRef.current;
          const order: Array<[StickyKey, number]> = [
            ["shift", MODIFIER_VK.Shift],
            ["win", MODIFIER_VK.Win],
            ["alt", MODIFIER_VK.Alt],
            ["ctrl", MODIFIER_VK.Ctrl],
          ];
          for (const [k, vk] of order) {
            if (s[k]) {
              addAction({ id: generateUUID(), type: "keyboard.keyUp", payload: { Key: vk } });
            }
          }
        }
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Core dispatch — no-ops when disabled (keyboard-permission gate)

    const send = useCallback(
      (type: string, payload: Record<string, unknown>) => {
        if (disabled) return;
        addAction({ id: generateUUID(), type, payload });
      },
      [addAction, disabled],
    );

    // Focus-steal guard — the strip only exists while the hidden input is
    // focused (GestureToolbar unmounts it on blur). Without this, tapping any
    // strip button blurs the input → keyboard collapses → the strip unmounts
    // between pointerdown and click, so onClick NEVER fires and no key is sent.
    // Canceling pointerdown suppresses the focus change but click still fires
    // (Pointer Events spec); mousedown preventDefault covers non-PE browsers.

    const preventFocusSteal = (e: SyntheticEvent) => {
      e.preventDefault();
    };

    // Modifier tap — toggles sticky state

    const handleModifierTap = (key: StickyKey, vk: number) => {
      // Dispatch outside the setSticky updater: updaters must be pure, and
      // StrictMode double-invokes them in dev (would double-send keyDown).
      const next = !sticky[key];
      send(next ? "keyboard.keyDown" : "keyboard.keyUp", { Key: vk });
      setSticky((prev) => ({ ...prev, [key]: next }));
    };

    // Non-sticky key tap — keyDown immediately, keyUp after 50ms

    const handleNonStickyTap = (vk: number) => {
      send("keyboard.keyDown", { Key: vk });
      const id = window.setTimeout(() => {
        pendingTimers.current.delete(id);
        send("keyboard.keyUp", { Key: vk });
      }, 50);
      pendingTimers.current.set(id, vk);
    };

    // Ctrl+Alt+Del compound action — not sticky, single compound press

    const handleCtrlAltDel = () => {
      send("keyboard.keyDown", { Key: 17 }); // Ctrl
      send("keyboard.keyDown", { Key: 18 }); // Alt
      send("keyboard.keyDown", { Key: 46 }); // Delete
      // CAD keyUp order: Delete(46), Alt(18), Ctrl(17)
      const id = window.setTimeout(() => {
        pendingTimers.current.delete(id);
        send("keyboard.keyUp", { Key: 46 });
        send("keyboard.keyUp", { Key: 18 });
        send("keyboard.keyUp", { Key: 17 });
      }, 50);
      pendingTimers.current.set(id, [46, 18, 17]);
    };

    // Imperative handle for GestureToolbar combo routing

    useImperativeHandle(
      ref,
      () => ({
        hasActiveModifier() {
          return Object.values(sticky).some(Boolean);
        },
        deliverPrintable(text: string) {
          // Collect active modifiers in order (matches keyDown order)
          const allModifiers: Array<{ key: StickyKey; vk: number }> = [
            { key: "ctrl" as StickyKey, vk: MODIFIER_VK.Ctrl },
            { key: "alt" as StickyKey, vk: MODIFIER_VK.Alt },
            { key: "win" as StickyKey, vk: MODIFIER_VK.Win },
            { key: "shift" as StickyKey, vk: MODIFIER_VK.Shift },
          ];
          const activeModifiers = allModifiers.filter((m) => sticky[m.key]);

          // Send each character keyDown + keyUp so a batched commit (e.g. a
          // word-suggestion or swipe-to-type) is not silently truncated to its
          // first character while a modifier is armed.
          for (const ch of text) {
            const charVk = ch.toUpperCase().charCodeAt(0);
            send("keyboard.keyDown", { Key: charVk });
            send("keyboard.keyUp", { Key: charVk });
          }

          // Release modifiers in reverse order ONLY after the full string is
          // delivered, so every character sees the modifier held down.
          for (let i = activeModifiers.length - 1; i >= 0; i--) {
            send("keyboard.keyUp", { Key: activeModifiers[i].vk });
          }

          // Clear all sticky state
          setSticky({ ctrl: false, alt: false, win: false, shift: false });
        },
      }),
      [sticky, send],
    );

    // Style helpers

    const modifierClass = (isActive: boolean) =>
      [
        "flex min-h-[44px] min-w-[44px] items-center justify-center rounded-sm px-2 py-1 text-body font-medium select-none transition-colors duration-150 border",
        isActive
          ? "bg-primary/15 border-primary text-primary"
          : "bg-surface border-border text-muted-foreground hover:bg-primary/8",
        disabled ? "opacity-50 pointer-events-none" : "",
      ]
        .filter(Boolean)
        .join(" ");

    const nonStickyClass = [
      "flex min-h-[44px] min-w-[44px] items-center justify-center rounded-sm px-2 py-1 text-body font-medium select-none transition-colors duration-150 border border-border bg-surface text-muted-foreground hover:bg-primary/8",
      disabled ? "opacity-50 pointer-events-none" : "",
    ]
      .filter(Boolean)
      .join(" ");

    // Render

    return (
      <div
        className="fixed left-0 right-0 z-50 flex items-center gap-1 overflow-x-auto border-t border-border bg-surface px-2 py-1"
        style={{ bottom: keyboardHeightPx }}
        aria-label={t("mobile.modifierStrip.ariaLabel")}
        role="toolbar"
        onPointerDown={preventFocusSteal}
        onMouseDown={preventFocusSteal}
      >
        {fnPage ? (
          // Fn page: F1–F12 + CAD + Fn toggle back
          <>
            {FN_KEYS.map(({ label, vk }) => (
              <button
                key={label}
                type="button"
                className={nonStickyClass}
                disabled={disabled}
                onClick={() => handleNonStickyTap(vk)}
                aria-label={label}
              >
                {label}
              </button>
            ))}

            {/* CAD — Ctrl+Alt+Del compound button */}
            <button
              type="button"
              className={nonStickyClass}
              disabled={disabled}
              onClick={handleCtrlAltDel}
              aria-label={t("mobile.modifierStrip.ctrlAltDel")}
            >
              {t("mobile.modifierStrip.ctrlAltDel")}
            </button>

            {/* Fn toggle back */}
            <button
              type="button"
              className={modifierClass(fnPage)}
              onClick={() => setFnPage(false)}
              aria-pressed={fnPage}
            >
              {t("mobile.modifierStrip.fn")}
            </button>
          </>
        ) : (
          // Main row: modifiers + special keys + Fn toggle
          <>
            {/* Sticky modifiers */}
            <button
              type="button"
              className={modifierClass(sticky.ctrl)}
              disabled={disabled}
              onClick={() => handleModifierTap("ctrl", MODIFIER_VK.Ctrl)}
              aria-pressed={sticky.ctrl}
            >
              {t("mobile.modifierStrip.ctrl")}
            </button>

            <button
              type="button"
              className={modifierClass(sticky.alt)}
              disabled={disabled}
              onClick={() => handleModifierTap("alt", MODIFIER_VK.Alt)}
              aria-pressed={sticky.alt}
            >
              {t("mobile.modifierStrip.alt")}
            </button>

            <button
              type="button"
              className={modifierClass(sticky.win)}
              disabled={disabled}
              onClick={() => handleModifierTap("win", MODIFIER_VK.Win)}
              aria-pressed={sticky.win}
            >
              {t("mobile.modifierStrip.win")}
            </button>

            <button
              type="button"
              className={modifierClass(sticky.shift)}
              disabled={disabled}
              onClick={() => handleModifierTap("shift", MODIFIER_VK.Shift)}
              aria-pressed={sticky.shift}
            >
              {t("mobile.modifierStrip.shift")}
            </button>

            {/* Non-sticky special keys */}
            <button
              type="button"
              className={nonStickyClass}
              disabled={disabled}
              onClick={() => handleNonStickyTap(MODIFIER_VK.Esc)}
            >
              {t("mobile.modifierStrip.esc")}
            </button>

            <button
              type="button"
              className={nonStickyClass}
              disabled={disabled}
              onClick={() => handleNonStickyTap(MODIFIER_VK.Tab)}
            >
              {t("mobile.modifierStrip.tab")}
            </button>

            {/* Arrow keys */}
            <button
              type="button"
              className={nonStickyClass}
              disabled={disabled}
              onClick={() => handleNonStickyTap(MODIFIER_VK.ArrowLeft)}
              aria-label={t("mobile.modifierStrip.arrowLeft")}
            >
              ←
            </button>

            <button
              type="button"
              className={nonStickyClass}
              disabled={disabled}
              onClick={() => handleNonStickyTap(MODIFIER_VK.ArrowUp)}
              aria-label={t("mobile.modifierStrip.arrowUp")}
            >
              ↑
            </button>

            <button
              type="button"
              className={nonStickyClass}
              disabled={disabled}
              onClick={() => handleNonStickyTap(MODIFIER_VK.ArrowDown)}
              aria-label={t("mobile.modifierStrip.arrowDown")}
            >
              ↓
            </button>

            <button
              type="button"
              className={nonStickyClass}
              disabled={disabled}
              onClick={() => handleNonStickyTap(MODIFIER_VK.ArrowRight)}
              aria-label={t("mobile.modifierStrip.arrowRight")}
            >
              →
            </button>

            {/* Fn page toggle */}
            <button
              type="button"
              className={modifierClass(false)}
              onClick={() => setFnPage(true)}
              aria-pressed={false}
            >
              {t("mobile.modifierStrip.fn")}
            </button>
          </>
        )}
      </div>
    );
  },
);

export default ModifierStrip;
