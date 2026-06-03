import { describe, it, expect } from "vitest";
import { accumulate } from "./useVirtualCursor";

const rect = (w: number, h: number) =>
  ({
    left: 0,
    top: 0,
    width: w,
    height: h,
    right: w,
    bottom: h,
    x: 0,
    y: 0,
    toJSON() {},
  }) as DOMRect;

describe("accumulate (useVirtualCursor pure helper)", () => {
  const nW = 1920;
  const nH = 1080;
  // Container 390×219 (approximate 16:9 at scale≈0.2031, same ratio as coords test)
  // scale = Math.min(390/1920, 219/1080) = Math.min(0.2031, 0.2028) ≈ 0.2028
  const r = rect(390, 219);

  it("initializes position to remote center {nW/2, nH/2}", () => {
    const initPos = { x: nW / 2, y: nH / 2 };
    expect(initPos.x).toBe(960);
    expect(initPos.y).toBe(540);
  });

  it("delta accumulates position by delta * scale", () => {
    const pos = { x: nW / 2, y: nH / 2 }; // {960, 540}
    const prev = { x: 100, y: 100 };
    // move by +10 CSS px in x, +5 CSS px in y
    const clientX = 110;
    const clientY = 105;
    const { nextPos } = accumulate(pos, prev, clientX, clientY, r, nW, nH);
    const scale = Math.min(r.width / nW, r.height / nH);
    expect(nextPos.x).toBeCloseTo(960 + 10 * scale, 5);
    expect(nextPos.y).toBeCloseTo(540 + 5 * scale, 5);
  });

  it("sequential moves accumulate", () => {
    const scale = Math.min(r.width / nW, r.height / nH);
    let pos = { x: nW / 2, y: nH / 2 };
    let prev = { x: 200, y: 200 };

    // first move: +20 px
    const res1 = accumulate(pos, prev, 220, 215, r, nW, nH);
    pos = res1.nextPos;
    prev = res1.nextPrev;

    // second move: +10 px from new prev
    const res2 = accumulate(pos, prev, 230, 225, r, nW, nH);
    const finalPos = res2.nextPos;

    expect(finalPos.x).toBeCloseTo(960 + 30 * scale, 5);
    expect(finalPos.y).toBeCloseTo(540 + 25 * scale, 5);
  });

  it("clamps low: negative delta clamps x and y to 0", () => {
    // Start at center and drive far negative
    const pos = { x: 0, y: 0 };
    const prev = { x: 500, y: 500 };
    const { nextPos } = accumulate(pos, prev, 0, 0, r, nW, nH);
    expect(nextPos.x).toBe(0);
    expect(nextPos.y).toBe(0);
  });

  it("clamps high: large positive delta clamps x to nW and y to nH", () => {
    // Start at max and drive further positive
    const pos = { x: nW, y: nH };
    const prev = { x: 0, y: 0 };
    const { nextPos } = accumulate(pos, prev, 1000, 1000, r, nW, nH);
    expect(nextPos.x).toBe(nW);
    expect(nextPos.y).toBe(nH);
  });
});
