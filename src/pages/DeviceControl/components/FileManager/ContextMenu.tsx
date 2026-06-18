import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ContextMenuItem, ContextMenuState } from "./types";

interface ContextMenuProps {
  state: ContextMenuState | null;
  onClose: () => void;
}

/**
 * Cursor-positioned popup primitive used by the file manager listing for
 * right-click row + empty-area menus. Holds 4-8 short items; outside-click
 * and Esc both close; auto-flips when near a viewport edge.
 *
 * Layered z-index strategy:
 *   - Invisible full-viewport overlay at z-40 catches outside clicks and right-
 *     clicks; clicking the overlay (any button) closes the menu.
 *   - Menu itself is `fixed` at z-50 with `pointer-events-auto` so its
 *     buttons receive clicks before the overlay does.
 *
 * Auto-flip: after the first paint we measure the rendered menu and, if it
 * extends past `window.innerWidth` / `window.innerHeight`, shift it left /
 * up by its own measured size. Done in `useLayoutEffect` so the user never
 * sees a flicker frame at the unflipped position.
 *
 * Esc-to-close: a document-level keydown listener is registered while the
 * menu is open. The listener does NOT use the focus-ownership guard pattern
 * because the menu is a transient global popup, not part of any panel root.
 */
function ContextMenu({ state, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [adjusted, setAdjusted] = useState<{
    left: number;
    top: number;
  } | null>(null);

  // Measure + flip after the menu paints.
  useLayoutEffect(() => {
    if (!state) {
      setAdjusted(null);
      return;
    }
    const el = menuRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    let left = state.x;
    let top = state.y;
    if (left + rect.width > window.innerWidth) {
      left = Math.max(0, left - rect.width);
    }
    if (top + rect.height > window.innerHeight) {
      top = Math.max(0, top - rect.height);
    }
    if (left !== state.x || top !== state.y) {
      setAdjusted({ left, top });
    } else {
      setAdjusted({ left, top });
    }
  }, [state]);

  // Esc closes (document-level so it works regardless of focus).
  useEffect(() => {
    if (!state) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [state, onClose]);

  if (!state) return null;

  const left = adjusted?.left ?? state.x;
  const top = adjusted?.top ?? state.y;

  const handleItemClick = (item: ContextMenuItem) => {
    if (item.disabled || item.separator) return;
    item.onSelect();
    onClose();
  };

  return (
    <>
      {/* Full-viewport overlay: any click (including right-click) closes the menu. */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
        onContextMenu={(e) => {
          e.preventDefault();
          onClose();
        }}
      />
      <div
        ref={menuRef}
        role="menu"
        className="bg-surface border-border fixed z-50 min-w-[180px] rounded-md border py-1 shadow-overlay"
        style={{ left, top }}
        // Stop click bubbling so clicks INSIDE the menu don't hit the overlay.
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.preventDefault()}
      >
        {state.items.map((item, idx) => {
          if (item.separator) {
            return (
              <hr
                key={`sep-${idx}`}
                className="border-border my-1 border-t"
              />
            );
          }
          const cls = [
            "block w-full text-left px-3 py-1.5 text-body transition-colors",
            item.disabled
              ? "opacity-50 cursor-not-allowed text-muted-foreground"
              : item.danger
                ? "hover:bg-destructive/10 cursor-pointer"
                : "hover:bg-surface-muted cursor-pointer",
            item.danger && !item.disabled ? "text-destructive" : "",
            item.danger && item.disabled ? "text-destructive/50" : "",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <button
              key={`${item.label}-${idx}`}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => handleItemClick(item)}
              className={cls}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </>
  );
}

export default ContextMenu;
