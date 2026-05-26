import { describe, expect, it } from "vitest";
import {
  normalizeClipboard,
  NON_TEXT_THRESHOLD,
} from "./clipboardNormalization";

describe("normalizeClipboard", () => {
  it("strips embedded NUL bytes", () => {
    expect(normalizeClipboard("a\0b\0c")).toEqual({
      text: "abc",
      refused: false,
    });
  });

  it("converts CRLF and lone CR to LF", () => {
    expect(normalizeClipboard("line1\r\nline2\rline3")).toEqual({
      text: "line1\nline2\nline3",
      refused: false,
    });
  });

  it("handles the empty string", () => {
    expect(normalizeClipboard("")).toEqual({ text: "", refused: false });
  });

  it("passes through plain ASCII text unchanged", () => {
    expect(normalizeClipboard("hello")).toEqual({
      text: "hello",
      refused: false,
    });
  });

  it("refuses input that is ~96% control bytes", () => {
    const raw = "\x01".repeat(50) + "ab";
    const { refused } = normalizeClipboard(raw);
    expect(refused).toBe(true);
  });

  it("accepts input with 15% control bytes (below threshold)", () => {
    const raw = "a".repeat(85) + "\x01".repeat(15);
    const { refused } = normalizeClipboard(raw);
    expect(refused).toBe(false);
  });

  it("refuses input with 25% control bytes (above threshold)", () => {
    const raw = "a".repeat(75) + "\x01".repeat(25);
    const { refused } = normalizeClipboard(raw);
    expect(refused).toBe(true);
  });

  it("does not count tab/LF/CR as control characters", () => {
    const { refused } = normalizeClipboard("\t\n\r normal text");
    expect(refused).toBe(false);
  });

  it("passes Cyrillic + CJK + ZWJ emoji family unchanged", () => {
    const raw = "Привет 你好 👨‍👩";
    expect(normalizeClipboard(raw)).toEqual({ text: raw, refused: false });
  });

  it("boundary: exactly 20% control bytes is accepted (strict > threshold)", () => {
    const raw = "a".repeat(80) + "\x01".repeat(20);
    const { refused } = normalizeClipboard(raw);
    expect(refused).toBe(false);
  });

  it("exposes NON_TEXT_THRESHOLD as 0.20", () => {
    expect(NON_TEXT_THRESHOLD).toBe(0.2);
  });
});
