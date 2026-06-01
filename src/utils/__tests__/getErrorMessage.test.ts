import { describe, it, expect } from "vitest";
import { getErrorMessage } from "../getErrorMessage";

describe("getErrorMessage", () => {
  it("returns the envelope error message", () => {
    const err = { response: { data: { error: { code: "not_found", message: "Device not found", details: {} } } } };
    expect(getErrorMessage(err)).toBe("Device not found");
  });

  it("prefers a normalized apiError when present", () => {
    const err = { apiError: { code: "forbidden", message: "Forbidden", details: {} } };
    expect(getErrorMessage(err)).toBe("Forbidden");
  });

  it("expands validation field errors from details", () => {
    const err = { response: { data: { error: { code: "validation_failed", message: "Validation failed", details: { name: ["can't be blank"] } } } } };
    expect(getErrorMessage(err)).toMatch(/can't be blank/);
  });

  it("falls back for unknown shapes", () => {
    expect(getErrorMessage(undefined)).toBe("An unexpected error occurred");
    expect(getErrorMessage({})).toBe("An unexpected error occurred");
  });
});
