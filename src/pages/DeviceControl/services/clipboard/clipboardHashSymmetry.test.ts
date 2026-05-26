// @ts-nocheck
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

interface Fixture {
  name: string;
  utf8Hex?: string;
  utf8Pattern?: string;
  utf8RepeatCount?: number;
  expectedHash16: string;
}

interface FixtureDoc {
  version: number;
  fixtures: Fixture[];
}

function fixturePath(): string {
  return resolve(
    process.cwd(),
    "../recontrol_desktop/protocol/test-fixtures/clipboard-hash-fixtures.json",
  );
}

function decodeFixtureBytes(f: Fixture): Uint8Array {
  if (f.utf8Hex !== undefined)
    return Uint8Array.from(Buffer.from(f.utf8Hex, "hex"));
  if (!f.utf8Pattern || !f.utf8RepeatCount)
    throw new Error(`invalid fixture ${f.name}`);
  const pattern = Buffer.from(f.utf8Pattern, "hex");
  const out = Buffer.alloc(pattern.length * f.utf8RepeatCount);
  for (let i = 0; i < f.utf8RepeatCount; i += 1) {
    pattern.copy(out, i * pattern.length);
  }
  return Uint8Array.from(out);
}

async function hash16(utf8Bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", utf8Bytes);
  const first8 = Buffer.from(digest).subarray(0, 8);
  return first8.toString("hex");
}

describe("clipboard hash symmetry fixtures", () => {
  it("matches expectedHash16 for all fixtures", async () => {
    const doc = JSON.parse(readFileSync(fixturePath(), "utf8")) as FixtureDoc;
    for (const fixture of doc.fixtures) {
      const bytes = decodeFixtureBytes(fixture);
      const actual = await hash16(bytes);
      expect(actual).toBe(fixture.expectedHash16);
    }
  });
});
