import { describe, expect, it } from 'vitest';
import { hashHex16 } from './clipboardHash';

// Expected hashes are SHA-256 first-8-bytes lowercase hex of the UTF-8 input.
// Verifiable: `printf 'hello' | sha256sum | cut -c1-16` -> 2cf24dba5fb0a30e
const HELLO_HASH = '2cf24dba5fb0a30e';
// `printf '' | sha256sum | cut -c1-16` -> e3b0c44298fc1c14
const EMPTY_HASH = 'e3b0c44298fc1c14';

async function nodeHash16(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const view = new Uint8Array(digest);
  let hex = '';
  for (let i = 0; i < 8; i += 1) {
    hex += view[i].toString(16).padStart(2, '0');
  }
  return hex;
}

describe('hashHex16', () => {
  it('matches SHA-256 first-8-bytes lowercase hex of "hello"', async () => {
    const bytes = new TextEncoder().encode('hello');
    const result = await hashHex16(bytes);
    expect(result).toBe(HELLO_HASH);
  });

  it('matches SHA-256 first-8-bytes lowercase hex of empty input', async () => {
    const bytes = new TextEncoder().encode('');
    const result = await hashHex16(bytes);
    expect(result).toBe(EMPTY_HASH);
  });

  it('always returns exactly 16 lowercase hex characters', async () => {
    const samples = ['', 'a', 'hello world', 'Привет', '你好', '👨‍👩'];
    for (const s of samples) {
      const result = await hashHex16(new TextEncoder().encode(s));
      expect(result).toMatch(/^[0-9a-f]{16}$/);
    }
  });

  it('is deterministic for Cyrillic UTF-8 input and self-consistent with crypto.subtle', async () => {
    const bytes = new TextEncoder().encode('Привет');
    const a = await hashHex16(bytes);
    const b = await hashHex16(bytes);
    const expected = await nodeHash16(bytes);
    expect(a).toBe(b);
    expect(a).toBe(expected);
  });
});
