export interface RealCoords {
  x: number;
  y: number;
  debug: {
    clientX: number;
    clientY: number;
    rect: DOMRect;
    nW: number;
    nH: number;
    dispW: number;
    dispH: number;
    offsetX: number;
    offsetY: number;
  };
}

export function computeRealImageCoords(
  rect: DOMRect,
  nW: number,
  nH: number,
  clientX: number,
  clientY: number
): RealCoords {
  const scale = Math.min(rect.width / nW, rect.height / nH);
  const dispW = nW * scale;
  const dispH = nH * scale;
  const offsetX = (rect.width - dispW) / 2;
  const offsetY = (rect.height - dispH) / 2;

  const relX = clientX - rect.left - offsetX;
  const relY = clientY - rect.top - offsetY;

  const x = Math.max(0, Math.min(nW, (relX / dispW) * nW));
  const y = Math.max(0, Math.min(nH, (relY / dispH) * nH));

  return {
    x,
    y,
    debug: { clientX, clientY, rect, nW, nH, dispW, dispH, offsetX, offsetY },
  };
}

