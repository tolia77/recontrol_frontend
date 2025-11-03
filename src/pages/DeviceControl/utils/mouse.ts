export function buttonName(button: number | undefined): string {
  switch (button) {
    case 0: return 'left';
    case 1: return 'middle';
    case 2: return 'right';
    case 3: return 'back';
    case 4: return 'forward';
    default: return 'unknown';
  }
}

export function pressedButtonsFromMask(mask: number): string[] {
  const names: string[] = [];
  if (mask & 1) names.push('left');
  if (mask & 2) names.push('right');
  if (mask & 4) names.push('middle');
  if (mask & 8) names.push('back');
  if (mask & 16) names.push('forward');
  return names;
}

export function normalizeWheelToClicks(deltaY: number, deltaMode: number): number {
  // Invert to match Windows: positive = wheel forward (scroll up), negative = down
  const dy = -deltaY;

  if (deltaMode === 1) {
    // DOM_DELTA_LINE: use line units, round and ensure at least ±1 when non-zero
    const lines = dy;
    return lines === 0 ? 0 : Math.sign(lines) * Math.max(1, Math.round(Math.abs(lines)));
  }

  if (deltaMode === 2) {
    // DOM_DELTA_PAGE: approximate as multiple lines (heuristic)
    const approxLines = dy * 3;
    return approxLines === 0 ? 0 : Math.sign(approxLines) * Math.max(1, Math.round(Math.abs(approxLines)));
  }

  // DOM_DELTA_PIXEL: map pixels to notches using typical WHEEL_DELTA = 120
  const PIXELS_PER_NOTCH = 120;
  const clicks = dy / PIXELS_PER_NOTCH;
  return clicks === 0 ? 0 : Math.sign(clicks) * Math.max(1, Math.round(Math.abs(clicks)));
}

export function mapButtonToBackend(jsButton: number | undefined): number {
  // Browser: 0=left, 1=middle, 2=right
  // Backend expects middle/right swapped
  if (jsButton === 1) return 2; // middle -> right
  if (jsButton === 2) return 1; // right -> middle
  return jsButton ?? 0;         // default to left if undefined
}
