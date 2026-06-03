import { describe, it, expect } from "vitest";
import { computeRealImageCoords } from "./coords";

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

describe("computeRealImageCoords", () => {
  it("letterbox: center touch maps to remote center", () => {
    // nW=1920, nH=1080 (16:9), container 390×780 (portrait)
    // scale = min(390/1920, 780/1080) = min(0.2031, 0.7222) = 0.2031 (width binds)
    // dispW=390, dispH≈219.4, offsetX=0, offsetY≈280.3
    // clientX=195, clientY=390 → center of displayed video
    const r = computeRealImageCoords(rect(390, 780), 1920, 1080, 195, 390);
    expect(Math.round(r.x)).toBe(960);
    expect(Math.round(r.y)).toBe(540);
  });

  it("pillarbox: center touch maps to remote center", () => {
    // nW=1280, nH=1024 (5:4), container 844×390 (landscape)
    // scale = min(844/1280, 390/1024) = min(0.6594, 0.3809) = 0.3809 (height binds)
    // dispW≈487.5, dispH=390, offsetX≈178.25, offsetY=0
    // clientX=422, clientY=195 → center of displayed video
    const r = computeRealImageCoords(rect(844, 390), 1280, 1024, 422, 195);
    expect(Math.round(r.x)).toBe(640);
    expect(Math.round(r.y)).toBe(512);
  });

  it("letterbox: touch in top black bar clamps to top edge", () => {
    // clientY=100 is inside the top letterbox bar (0..280.3) → relY < 0 → y clamps to 0
    const r = computeRealImageCoords(rect(390, 780), 1920, 1080, 195, 100);
    expect(r.y).toBe(0);
  });

  it("pillarbox: touch in left black bar clamps to left edge", () => {
    // clientX=50 is inside the left pillar bar (0..178.25) → relX < 0 → x clamps to 0
    const r = computeRealImageCoords(rect(844, 390), 1280, 1024, 50, 195);
    expect(r.x).toBe(0);
  });
});
