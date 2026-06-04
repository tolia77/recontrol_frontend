import { useState, useEffect } from "react";

/**
 * Tracks the virtual keyboard height via the VisualViewport API.
 *
 * Returns `keyboardHeight` in CSS px — the number of pixels the soft keyboard
 * occupies at the bottom of the screen. When no keyboard is visible, returns 0.
 *
 * Used by ModifierStrip to dock itself above the keyboard (KBD-03 D-05) and by
 * AssistantPanel to pin the InputBox above the keyboard (DCTL-04 D-10).
 *
 * Guards `if (!vv) return` so jsdom tests do not crash (window.visualViewport
 * is undefined in the test environment).
 */
export function useVisualViewport(): { keyboardHeight: number } {
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      setKeyboardHeight(Math.max(0, window.innerHeight - (vv.offsetTop + vv.height)));
    };
    vv.addEventListener("resize", update);
    update(); // seed initial value
    return () => vv.removeEventListener("resize", update);
  }, []);

  return { keyboardHeight };
}
