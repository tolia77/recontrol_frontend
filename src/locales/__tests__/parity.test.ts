import { describe, expect, it } from "vitest";

import { adminUsers as en_adminUsers } from "../en/adminUsers";
import { adminUsers as uk_adminUsers } from "../uk/adminUsers";
import { assistant as en_assistant } from "../en/assistant";
import { assistant as uk_assistant } from "../uk/assistant";
import { auth as en_auth } from "../en/auth";
import { auth as uk_auth } from "../uk/auth";
import { clipboard as en_clipboard } from "../en/clipboard";
import { clipboard as uk_clipboard } from "../uk/clipboard";
import { common as en_common } from "../en/common";
import { common as uk_common } from "../uk/common";
import { deviceControl as en_deviceControl } from "../en/deviceControl";
import { deviceControl as uk_deviceControl } from "../uk/deviceControl";
import { deviceSettings as en_deviceSettings } from "../en/deviceSettings";
import { deviceSettings as uk_deviceSettings } from "../uk/deviceSettings";
import { devices as en_devices } from "../en/devices";
import { devices as uk_devices } from "../uk/devices";
import { fileManager as en_fileManager } from "../en/fileManager";
import { fileManager as uk_fileManager } from "../uk/fileManager";
import { help as en_help } from "../en/help";
import { help as uk_help } from "../uk/help";
import { indexPage as en_index } from "../en/index";
import { indexPage as uk_index } from "../uk/index";
import { pricing as en_pricing } from "../en/pricing";
import { pricing as uk_pricing } from "../uk/pricing";
import { scenarios as en_scenarios } from "../en/scenarios";
import { scenarios as uk_scenarios } from "../uk/scenarios";
import { subscription as en_subscription, subscription_uk as uk_subscription } from "../subscription";
import { userSettings as en_userSettings } from "../en/userSettings";
import { userSettings as uk_userSettings } from "../uk/userSettings";

const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;

function collectKeys(
  obj: unknown,
  prefix = "",
  acc = new Set<string>(),
): Set<string> {
  if (obj === null || typeof obj !== "object") {
    acc.add(prefix);
    return acc;
  }
  for (const k of Object.keys(obj as Record<string, unknown>)) {
    const baseKey = k.replace(PLURAL_SUFFIX, "");
    const nextPrefix = prefix ? `${prefix}.${baseKey}` : baseKey;
    collectKeys((obj as Record<string, unknown>)[k], nextPrefix, acc);
  }
  return acc;
}

const NAMESPACE_PAIRS = [
  ["adminUsers", en_adminUsers, uk_adminUsers],
  ["assistant", en_assistant, uk_assistant],
  ["auth", en_auth, uk_auth],
  ["clipboard", en_clipboard, uk_clipboard],
  ["common", en_common, uk_common],
  ["deviceControl", en_deviceControl, uk_deviceControl],
  ["deviceSettings", en_deviceSettings, uk_deviceSettings],
  ["devices", en_devices, uk_devices],
  ["fileManager", en_fileManager, uk_fileManager],
  ["help", en_help, uk_help],
  ["index", en_index, uk_index],
  ["pricing", en_pricing, uk_pricing],
  ["userSettings", en_userSettings, uk_userSettings],
  ["scenarios", en_scenarios, uk_scenarios],
  ["subscription", en_subscription, uk_subscription],
] as const;

describe.each(NAMESPACE_PAIRS)("i18n parity: %s", (name, en, uk) => {
  it(`EN and UK have identical key sets (after CLDR plural normalization)`, () => {
    const enKeys = [...collectKeys(en)].sort();
    const ukKeys = [...collectKeys(uk)].sort();
    const onlyEn = enKeys.filter((k) => !ukKeys.includes(k));
    const onlyUk = ukKeys.filter((k) => !enKeys.includes(k));
    expect(onlyEn, `[${name}] keys present only in EN`).toEqual([]);
    expect(onlyUk, `[${name}] keys present only in UK`).toEqual([]);
  });
});

// Defense-in-depth (Pitfall 2): assert UK has all four CLDR plural categories for sizeCap.
// Suffix normalization in collectKeys would let UK ship only _one+_other and still pass parity;
// this narrow check guarantees Ukrainian grammar correctness at runtime.
describe("uk clipboard sizeCap plural coverage", () => {
  it("has all four CLDR plural suffix variants", () => {
    expect("sizeCap_one" in uk_clipboard).toBe(true);
    expect("sizeCap_few" in uk_clipboard).toBe(true);
    expect("sizeCap_many" in uk_clipboard).toBe(true);
    expect("sizeCap_other" in uk_clipboard).toBe(true);
  });
});

// Defense-in-depth: assert UK has all four CLDR plural categories for the
// scenarios.library count-bearing keys (I18N-03). The PLURAL_SUFFIX normalisation
// in collectKeys would otherwise let UK ship only _one+_other and still pass.
describe("uk scenarios plural coverage", () => {
  it("library.runCount has all four CLDR plural variants", () => {
    expect("runCount_one" in uk_scenarios.library).toBe(true);
    expect("runCount_few" in uk_scenarios.library).toBe(true);
    expect("runCount_many" in uk_scenarios.library).toBe(true);
    expect("runCount_other" in uk_scenarios.library).toBe(true);
  });
  it("library.stepCount has all four CLDR plural variants", () => {
    expect("stepCount_one" in uk_scenarios.library).toBe(true);
    expect("stepCount_few" in uk_scenarios.library).toBe(true);
    expect("stepCount_many" in uk_scenarios.library).toBe(true);
    expect("stepCount_other" in uk_scenarios.library).toBe(true);
  });
  it("run.stepCounter has all four CLDR plural variants", () => {
    expect("stepCounter_one" in uk_scenarios.run).toBe(true);
    expect("stepCounter_few" in uk_scenarios.run).toBe(true);
    expect("stepCounter_many" in uk_scenarios.run).toBe(true);
    expect("stepCounter_other" in uk_scenarios.run).toBe(true);
  });
  it("history.runCount has all four CLDR plural variants", () => {
    expect("runCount_one" in uk_scenarios.history).toBe(true);
    expect("runCount_few" in uk_scenarios.history).toBe(true);
    expect("runCount_many" in uk_scenarios.history).toBe(true);
    expect("runCount_other" in uk_scenarios.history).toBe(true);
  });
  it("history.stepCount has all four CLDR plural variants", () => {
    expect("stepCount_one" in uk_scenarios.history).toBe(true);
    expect("stepCount_few" in uk_scenarios.history).toBe(true);
    expect("stepCount_many" in uk_scenarios.history).toBe(true);
    expect("stepCount_other" in uk_scenarios.history).toBe(true);
  });
});

// The subscription namespace has no count-bearing keys (no {{count}} interpolation is
// used by any component), so no CLDR plural coverage block is needed for it.

// Verifier-greppable assertion that the PILL-06 banner literal is byte-exact.
// This protects against the em-dash → hyphen-minus drift (Pitfall 1, RESEARCH lines 611-615).
describe("clipboard PILL-06 banner literal", () => {
  it("has em dash U+2014 in en.toast.firstSync", () => {
    expect(en_clipboard.toast.firstSync).toBe(
      "Clipboard sync is active — copies are mirrored both ways",
    );
  });
});
