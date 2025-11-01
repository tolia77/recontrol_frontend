import type React from 'react';

export function mapToVirtualKey(e: React.KeyboardEvent): number {
  const code = e.code || '';
  const key = e.key || '';
  const named: Record<string, number> = {
    Escape: 27, Enter: 13, Tab: 9, Backspace: 8, Space: 32, ' ': 32,
    ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40,
    Delete: 46, Insert: 45, Home: 36, End: 35, PageUp: 33, PageDown: 34,
    CapsLock: 20, PrintScreen: 44, Pause: 19, ScrollLock: 145, NumLock: 144,
    ContextMenu: 93,
    ShiftLeft: 16, ShiftRight: 16, ControlLeft: 17, ControlRight: 17,
    AltLeft: 18, AltRight: 18, MetaLeft: 91, MetaRight: 92,
  };
  if (named[code]) return named[code];
  if (named[key]) return named[key];

  const fMatch = /^F(\d{1,2})$/.exec(code || key);
  if (fMatch) {
    const n = parseInt(fMatch[1], 10);
    if (n >= 1 && n <= 24) return 111 + n;
  }

  const keyChar = key.length === 1 ? key.toUpperCase() : '';
  if (keyChar >= 'A' && keyChar <= 'Z') return keyChar.charCodeAt(0);

  const digitMatch = /^Digit([0-9])$/.exec(code);
  if (digitMatch) return 48 + parseInt(digitMatch[1], 10);

  const npDigit = /^Numpad([0-9])$/.exec(code);
  if (npDigit) return 96 + parseInt(npDigit[1], 10);
  if (code === 'NumpadAdd') return 107;
  if (code === 'NumpadSubtract') return 109;
  if (code === 'NumpadMultiply') return 106;
  if (code === 'NumpadDivide') return 111;
  if (code === 'NumpadDecimal') return 110;

  const punct: Record<string, number> = {
    Minus: 189, Equal: 187, BracketLeft: 219, BracketRight: 221,
    Backslash: 220, Semicolon: 186, Quote: 222, Comma: 188,
    Period: 190, Slash: 191, Backquote: 192,
  };
  if (punct[code]) return punct[code];

  // @ts-ignore
  if (typeof e.keyCode === 'number' && e.keyCode) return e.keyCode;
  // @ts-ignore
  if (e.nativeEvent && typeof e.nativeEvent.keyCode === 'number' && e.nativeEvent.keyCode) {
    // @ts-ignore
    return e.nativeEvent.keyCode;
  }
  return 0;
}

