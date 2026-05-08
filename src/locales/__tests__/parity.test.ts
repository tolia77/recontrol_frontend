import { describe, expect, it } from 'vitest';

import en_adminUsers from '../en/adminUsers';
import uk_adminUsers from '../uk/adminUsers';
import en_auth from '../en/auth';
import uk_auth from '../uk/auth';
import en_clipboard from '../en/clipboard';
import uk_clipboard from '../uk/clipboard';
import en_common from '../en/common';
import uk_common from '../uk/common';
import en_deviceControl from '../en/deviceControl';
import uk_deviceControl from '../uk/deviceControl';
import en_deviceSettings from '../en/deviceSettings';
import uk_deviceSettings from '../uk/deviceSettings';
import en_devices from '../en/devices';
import uk_devices from '../uk/devices';
import en_fileManager from '../en/fileManager';
import uk_fileManager from '../uk/fileManager';
import en_help from '../en/help';
import uk_help from '../uk/help';
import en_index from '../en/index';
import uk_index from '../uk/index';
import en_userSettings from '../en/userSettings';
import uk_userSettings from '../uk/userSettings';

const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;

function collectKeys(obj: unknown, prefix = '', acc = new Set<string>()): Set<string> {
  if (obj === null || typeof obj !== 'object') {
    acc.add(prefix);
    return acc;
  }
  for (const k of Object.keys(obj as Record<string, unknown>)) {
    const baseKey = k.replace(PLURAL_SUFFIX, '');
    const nextPrefix = prefix ? `${prefix}.${baseKey}` : baseKey;
    collectKeys((obj as Record<string, unknown>)[k], nextPrefix, acc);
  }
  return acc;
}

const NAMESPACE_PAIRS = [
  ['adminUsers', en_adminUsers, uk_adminUsers],
  ['auth', en_auth, uk_auth],
  ['clipboard', en_clipboard, uk_clipboard],
  ['common', en_common, uk_common],
  ['deviceControl', en_deviceControl, uk_deviceControl],
  ['deviceSettings', en_deviceSettings, uk_deviceSettings],
  ['devices', en_devices, uk_devices],
  ['fileManager', en_fileManager, uk_fileManager],
  ['help', en_help, uk_help],
  ['index', en_index, uk_index],
  ['userSettings', en_userSettings, uk_userSettings],
] as const;

describe.each(NAMESPACE_PAIRS)('i18n parity: %s', (name, en, uk) => {
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
describe('uk clipboard sizeCap plural coverage', () => {
  it('has all four CLDR plural suffix variants', () => {
    expect('sizeCap_one' in uk_clipboard).toBe(true);
    expect('sizeCap_few' in uk_clipboard).toBe(true);
    expect('sizeCap_many' in uk_clipboard).toBe(true);
    expect('sizeCap_other' in uk_clipboard).toBe(true);
  });
});

// Verifier-greppable assertion that the PILL-06 banner literal is byte-exact.
// This protects against the em-dash → hyphen-minus drift (Pitfall 1, RESEARCH lines 611-615).
describe('clipboard PILL-06 banner literal', () => {
  it('has em dash U+2014 in en.toast.firstSync', () => {
    expect(en_clipboard.toast.firstSync).toBe('Clipboard sync is active — copies are mirrored both ways');
  });
});
