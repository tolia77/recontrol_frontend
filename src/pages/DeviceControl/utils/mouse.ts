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
  const PIXELS_PER_LINE = 16;
  let deltaLines: number;
  if (deltaMode === 0) {
    deltaLines = deltaY / PIXELS_PER_LINE;
  } else if (deltaMode === 1) {
    deltaLines = deltaY;
  } else {
    deltaLines = deltaY * 60;
  }
  return deltaLines === 0 ? 0 : Math.sign(deltaLines) * Math.max(1, Math.round(Math.abs(deltaLines)));
}

