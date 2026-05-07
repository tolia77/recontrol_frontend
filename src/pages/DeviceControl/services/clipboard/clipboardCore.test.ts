import { describe, expect, it, vi } from 'vitest';
import { ClipboardLoopGate } from './clipboardLoopGate';
import {
  detectCapability,
  prepareOutbound,
  decideInbound,
  bindFocusVisibilityListeners,
  MAX_CONTENT_BYTES,
} from './clipboardCore';
import { hashHex16 } from './clipboardHash';
import type {
  ClipboardCapabilitiesEnvelope,
  ClipboardSetEnvelope,
} from './clipboardProtocol.generated';

class FakeClock {
  private now = 0;
  nowMs() {
    return this.now;
  }
  advance(ms: number) {
    this.now += ms;
  }
}

function makeCaps(overrides: Partial<ClipboardCapabilitiesEnvelope> = {}): ClipboardCapabilitiesEnvelope {
  return {
    kind: 'capabilities',
    originId: 'DESKTOP',
    outboundEnabled: true,
    inboundEnabled: true,
    maxBytes: 2_000_000,
    protocolVersion: '1.0',
    seq: 1,
    ts: 0,
    ...overrides,
  };
}

function baseInput(
  rawText: string | null,
  overrides: Partial<Parameters<typeof prepareOutbound>[0]> = {},
) {
  return {
    rawText,
    isPaused: false,
    hasFocus: true,
    visibilityVisible: true,
    nowMs: 10_000,
    lastRemoteApplyTimeMs: 0,
    loopGate: new ClipboardLoopGate(new FakeClock()),
    originId: 'ABC',
    cachedDesktopCaps: makeCaps(),
    capsTimedOut: false,
    ...overrides,
  };
}

let seqCounter = 0;
function nextSeq() {
  seqCounter += 1;
  return seqCounter;
}

describe('detectCapability', () => {
  it('C1: nav=undefined -> all false', () => {
    expect(detectCapability(undefined, false)).toEqual({
      canRead: false,
      canWrite: false,
      isSecureContext: false,
    });
  });

  it('C2: readText+writeText present, isSecure=true -> all true', () => {
    const fakeNav = {
      clipboard: {
        readText: async () => '',
        writeText: async () => {},
      },
    } as unknown as Navigator;
    expect(detectCapability(fakeNav, true)).toEqual({
      canRead: true,
      canWrite: true,
      isSecureContext: true,
    });
  });

  it('C3: only readText present -> canRead=true, canWrite=false', () => {
    const fakeNav = {
      clipboard: { readText: async () => '' },
    } as unknown as Navigator;
    expect(detectCapability(fakeNav, true)).toEqual({
      canRead: true,
      canWrite: false,
      isSecureContext: true,
    });
  });

  it('C4: isSecure=false -> isSecureContext=false regardless of clipboard', () => {
    const fakeNav = {
      clipboard: { readText: async () => '', writeText: async () => {} },
    } as unknown as Navigator;
    expect(detectCapability(fakeNav, false).isSecureContext).toBe(false);
  });
});

describe('prepareOutbound', () => {
  it('C5: rawText=null -> skip-empty', async () => {
    seqCounter = 0;
    const result = await prepareOutbound(baseInput(null), nextSeq);
    expect(result.kind).toBe('skip-empty');
  });

  it('C6: isPaused=true -> skip-paused (POLICY-06)', async () => {
    seqCounter = 0;
    const result = await prepareOutbound(baseInput('hello', { isPaused: true }), nextSeq);
    expect(result.kind).toBe('skip-paused');
  });

  it('C7: hasFocus=false -> skip-not-focused', async () => {
    seqCounter = 0;
    const result = await prepareOutbound(baseInput('hello', { hasFocus: false }), nextSeq);
    expect(result.kind).toBe('skip-not-focused');
  });

  it('C8: visibilityVisible=false -> skip-not-focused', async () => {
    seqCounter = 0;
    const result = await prepareOutbound(
      baseInput('hello', { visibilityVisible: false }),
      nextSeq,
    );
    expect(result.kind).toBe('skip-not-focused');
  });

  it('C9: dampened (delta=500 < 1000) -> skip-dampened (DEGRADE-04)', async () => {
    seqCounter = 0;
    const result = await prepareOutbound(
      baseInput('hello', { nowMs: 10_500, lastRemoteApplyTimeMs: 10_000 }),
      nextSeq,
    );
    expect(result.kind).toBe('skip-dampened');
  });

  it('C10: dampening boundary (delta=1000) -> NOT dampened (strict <)', async () => {
    seqCounter = 0;
    const result = await prepareOutbound(
      baseInput('hello', { nowMs: 11_000, lastRemoteApplyTimeMs: 10_000 }),
      nextSeq,
    );
    expect(result.kind).toBe('send');
  });

  it('C11: non-text refused (96% control bytes) -> refused-local NON_TEXT (CLIP-08, D-14)', async () => {
    seqCounter = 0;
    // 24 control chars (U+0001), 1 normal char => 24/25 = 96%
    const controlText = '\x01'.repeat(24) + 'a';
    const result = await prepareOutbound(baseInput(controlText), nextSeq);
    expect(result.kind).toBe('refused-local');
    if (result.kind === 'refused-local') {
      expect(result.reason).toBe('NON_TEXT');
    }
  });

  it('C12: CRLF normalized (CLIP-07)', async () => {
    seqCounter = 0;
    const result = await prepareOutbound(baseInput('a\r\nb'), nextSeq);
    expect(result.kind).toBe('send');
    if (result.kind === 'send') {
      expect(result.envelope.content).toBe('a\nb');
    }
  });

  it('C13: rawText utf8 length > 2MB -> refused-local TOO_LARGE (D-14)', async () => {
    seqCounter = 0;
    // Build a string that's just over 2 MB of ASCII (each char = 1 byte in UTF-8)
    const bigText = 'A'.repeat(MAX_CONTENT_BYTES + 1);
    const result = await prepareOutbound(baseInput(bigText), nextSeq);
    expect(result.kind).toBe('refused-local');
    if (result.kind === 'refused-local') {
      expect(result.reason).toBe('TOO_LARGE');
    }
  });

  it('C14: loop-gate suppresses outbound (sender second-guard LOOP-01)', async () => {
    seqCounter = 0;
    const clock = new FakeClock();
    const loopGate = new ClipboardLoopGate(clock);
    const utf8 = new TextEncoder().encode('hello');
    const hex = await hashHex16(utf8);
    // Pre-seed as sent
    const hashBytes = new Uint8Array(8);
    for (let i = 0; i < 8; i++) {
      hashBytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
    }
    loopGate.recordSent(hashBytes);
    const result = await prepareOutbound(baseInput('hello', { loopGate }), nextSeq);
    expect(result.kind).toBe('skip-loop-gate');
  });

  it('C15: loop-gate suppresses inbound echo (echo-of-just-applied LOOP-01)', async () => {
    seqCounter = 0;
    const clock = new FakeClock();
    const loopGate = new ClipboardLoopGate(clock);
    const utf8 = new TextEncoder().encode('hello');
    const hex = await hashHex16(utf8);
    const hashBytes = new Uint8Array(8);
    for (let i = 0; i < 8; i++) {
      hashBytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
    }
    loopGate.recordApplied(hashBytes);
    const result = await prepareOutbound(baseInput('hello', { loopGate }), nextSeq);
    expect(result.kind).toBe('skip-loop-gate');
  });

  it('C16: happy path -> send with correct fields', async () => {
    seqCounter = 0;
    const result = await prepareOutbound(baseInput('hello'), nextSeq);
    expect(result.kind).toBe('send');
    if (result.kind === 'send') {
      expect(result.envelope.kind).toBe('set');
      expect(result.envelope.content).toBe('hello');
      expect(result.envelope.originId).toBe('ABC');
      expect(result.envelope.seq).toBe(1);
      expect(result.envelope.ts).toBe(10_000);
      // Verify hash matches expected SHA-256 first 8 bytes of 'hello'
      expect(result.envelope.contentHash).toBe('2cf24dba5fb0a30e');
    }
  });

  it('C17: seq increments across two consecutive calls', async () => {
    seqCounter = 0;
    const input1 = baseInput('hello');
    const input2 = baseInput('world');
    const r1 = await prepareOutbound(input1, nextSeq);
    const r2 = await prepareOutbound(input2, nextSeq);
    expect(r1.kind).toBe('send');
    expect(r2.kind).toBe('send');
    if (r1.kind === 'send' && r2.kind === 'send') {
      expect(r2.envelope.seq).toBe(r1.envelope.seq + 1);
    }
  });

  it('C18: originId=null -> skip-no-channel (channel not attached)', async () => {
    seqCounter = 0;
    const result = await prepareOutbound(baseInput('hello', { originId: null }), nextSeq);
    expect(result.kind).toBe('skip-no-channel');
  });

  it('C19a: capsTimedOut + no cached caps -> refused-local MASTER_DISABLED (D-08)', async () => {
    seqCounter = 0;
    const result = await prepareOutbound(
      baseInput('hello', { capsTimedOut: true, cachedDesktopCaps: null }),
      nextSeq,
    );
    expect(result.kind).toBe('refused-local');
    if (result.kind === 'refused-local') {
      expect(result.reason).toBe('MASTER_DISABLED');
    }
  });

  it('C19b: cap-cache says inboundEnabled=false -> refused-local INBOUND_DISABLED (D-13)', async () => {
    seqCounter = 0;
    const caps = makeCaps({ inboundEnabled: false });
    const result = await prepareOutbound(
      baseInput('hello', { cachedDesktopCaps: caps }),
      nextSeq,
    );
    expect(result.kind).toBe('refused-local');
    if (result.kind === 'refused-local') {
      expect(result.reason).toBe('INBOUND_DISABLED');
    }
  });

  it('C19c: cap-cache inboundEnabled=false preempts even with capsTimedOut=true', async () => {
    // D-13: if a cache exists and says no, that's the answer regardless of timer state.
    seqCounter = 0;
    const caps = makeCaps({ inboundEnabled: false });
    const result = await prepareOutbound(
      baseInput('hello', { cachedDesktopCaps: caps, capsTimedOut: true }),
      nextSeq,
    );
    expect(result.kind).toBe('refused-local');
    if (result.kind === 'refused-local') {
      expect(result.reason).toBe('INBOUND_DISABLED');
    }
  });

  it('C19d: caps gate ordering -- capsTimedOut blocks even when isPaused=true', async () => {
    // D-08 ordering invariant: caps gates run BEFORE pause check.
    seqCounter = 0;
    const result = await prepareOutbound(
      baseInput('hello', {
        capsTimedOut: true,
        cachedDesktopCaps: null,
        isPaused: true,
      }),
      nextSeq,
    );
    expect(result.kind).toBe('refused-local');
    if (result.kind === 'refused-local') {
      expect(result.reason).toBe('MASTER_DISABLED');
    }
  });

  it('C19e: regression -- existing skip-paused / skip-no-channel kinds preserved with valid caps', async () => {
    // Make sure adding the new branches did not poison the existing skip-* paths.
    seqCounter = 0;
    const noChannel = await prepareOutbound(
      baseInput('hello', { originId: null }),
      nextSeq,
    );
    expect(noChannel.kind).toBe('skip-no-channel');

    const paused = await prepareOutbound(
      baseInput('hello', { isPaused: true }),
      nextSeq,
    );
    expect(paused.kind).toBe('skip-paused');
  });
});

describe('decideInbound', () => {
  async function makeEnvelope(text: string): Promise<ClipboardSetEnvelope> {
    const utf8 = new TextEncoder().encode(text);
    const hash = await hashHex16(utf8);
    return {
      kind: 'set',
      content: text,
      originId: 'REMOTE',
      contentHash: hash,
      seq: 1,
      ts: Date.now(),
    };
  }

  it('C19: self-origin drop', async () => {
    const env = await makeEnvelope('hello');
    env.originId = 'OUR_ID';
    const result = await decideInbound(env, 'OUR_ID', false, new ClipboardLoopGate());
    expect(result.kind).toBe('drop-self-origin');
  });

  it('C20: paused -> drop-paused', async () => {
    const env = await makeEnvelope('hello');
    const result = await decideInbound(env, null, true, new ClipboardLoopGate());
    expect(result.kind).toBe('drop-paused');
  });

  it('C21: bad-hash (invalid hex16) -> drop-bad-hash', async () => {
    const env = await makeEnvelope('hello');
    env.contentHash = 'notvalidhex!!!!!';
    const result = await decideInbound(env, null, false, new ClipboardLoopGate());
    expect(result.kind).toBe('drop-bad-hash');
  });

  it('C21b: mismatched hash -> drop-bad-hash', async () => {
    const env = await makeEnvelope('hello');
    env.contentHash = 'aaaaaaaaaaaaaaaa'; // valid hex16 but wrong
    const result = await decideInbound(env, null, false, new ClipboardLoopGate());
    expect(result.kind).toBe('drop-bad-hash');
  });

  it('C22: content too large -> drop-too-large', async () => {
    // Build content that's over 2MB but has a matching hash
    // Simpler: use a short content but override the byte check by using a
    // separate env with length just above MAX_CONTENT_BYTES
    // We need to construct a valid hash for content > 2MB, but that's expensive.
    // Instead override: create text with lots of chars and a valid hash.
    // Actually easier: build content exactly 2_000_001 bytes long (ASCII),
    // compute real hash for it.
    const bigContent = 'B'.repeat(MAX_CONTENT_BYTES + 1);
    const utf8Big = new TextEncoder().encode(bigContent);
    const hash = await hashHex16(utf8Big);
    const env: ClipboardSetEnvelope = {
      kind: 'set',
      content: bigContent,
      originId: 'REMOTE',
      contentHash: hash,
      seq: 1,
      ts: Date.now(),
    };
    const result = await decideInbound(env, null, false, new ClipboardLoopGate());
    expect(result.kind).toBe('drop-too-large');
  });

  it('C23: loop-gate inbound dup -> drop-loop-gate', async () => {
    const env = await makeEnvelope('hello');
    const loopGate = new ClipboardLoopGate(new FakeClock());
    const utf8 = new TextEncoder().encode('hello');
    const hex = await hashHex16(utf8);
    const hashBytes = new Uint8Array(8);
    for (let i = 0; i < 8; i++) {
      hashBytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
    }
    loopGate.recordApplied(hashBytes);
    const result = await decideInbound(env, null, false, loopGate);
    expect(result.kind).toBe('drop-loop-gate');
  });

  it('C24: valid envelope + clear gate -> apply', async () => {
    const env = await makeEnvelope('hello');
    const result = await decideInbound(env, null, false, new ClipboardLoopGate());
    expect(result.kind).toBe('apply');
    if (result.kind === 'apply') {
      expect(result.text).toBe('hello');
      expect(result.hashBytes).toBeInstanceOf(Uint8Array);
      expect(result.hashBytes.length).toBe(8);
    }
  });
});

describe('bindFocusVisibilityListeners', () => {
  it('L1: adds focus to window and visibilitychange to document', () => {
    const winListeners: Record<string, EventListener[]> = {};
    const docListeners: Record<string, EventListener[]> = {};
    const fakeWindow = {
      addEventListener: vi.fn((type: string, fn: EventListener) => {
        (winListeners[type] = winListeners[type] ?? []).push(fn);
      }),
      removeEventListener: vi.fn(),
    };
    const fakeDoc = {
      addEventListener: vi.fn((type: string, fn: EventListener) => {
        (docListeners[type] = docListeners[type] ?? []).push(fn);
      }),
      removeEventListener: vi.fn(),
      visibilityState: 'visible' as DocumentVisibilityState,
    };
    bindFocusVisibilityListeners(
      { window: fakeWindow as unknown as Window, document: fakeDoc as unknown as Document },
      () => {},
    );
    expect(fakeWindow.addEventListener).toHaveBeenCalledWith('focus', expect.any(Function));
    expect(fakeDoc.addEventListener).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
  });

  it('L2: cleanup removes both listeners', () => {
    const fakeWindow = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    const fakeDoc = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      visibilityState: 'visible' as DocumentVisibilityState,
    };
    const cleanup = bindFocusVisibilityListeners(
      { window: fakeWindow as unknown as Window, document: fakeDoc as unknown as Document },
      () => {},
    );
    cleanup();
    expect(fakeWindow.removeEventListener).toHaveBeenCalledWith('focus', expect.any(Function));
    expect(fakeDoc.removeEventListener).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
  });

  it('L3: focus event calls onTrigger', () => {
    const onTrigger = vi.fn();
    const captured: { focusHandler: (() => void) | null } = { focusHandler: null };
    const fakeWindow = {
      addEventListener: vi.fn((type: string, fn: EventListener) => {
        if (type === 'focus') captured.focusHandler = fn as unknown as () => void;
      }),
      removeEventListener: vi.fn(),
    };
    const fakeDoc = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      visibilityState: 'visible' as DocumentVisibilityState,
    };
    bindFocusVisibilityListeners(
      { window: fakeWindow as unknown as Window, document: fakeDoc as unknown as Document },
      onTrigger,
    );
    captured.focusHandler?.();
    expect(onTrigger).toHaveBeenCalledTimes(1);
  });

  it('L4: visibilitychange fires onTrigger only when visibilityState=visible', () => {
    const onTrigger = vi.fn();
    const captured: { visHandler: (() => void) | null } = { visHandler: null };
    const fakeWindow = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    const fakeDoc = {
      addEventListener: vi.fn((type: string, fn: EventListener) => {
        if (type === 'visibilitychange') captured.visHandler = fn as unknown as () => void;
      }),
      removeEventListener: vi.fn(),
      visibilityState: 'hidden' as DocumentVisibilityState,
    };
    bindFocusVisibilityListeners(
      { window: fakeWindow as unknown as Window, document: fakeDoc as unknown as Document },
      onTrigger,
    );
    // Simulate event when hidden -- should NOT trigger
    captured.visHandler?.();
    expect(onTrigger).not.toHaveBeenCalled();

    // Simulate event when visible -- SHOULD trigger
    fakeDoc.visibilityState = 'visible';
    captured.visHandler?.();
    expect(onTrigger).toHaveBeenCalledTimes(1);
  });
});
