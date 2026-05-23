// Hook integration coverage strategy:
//   - selectPillState is a pure function with `now` injected; no React, no real time.
//   - One fixture per precedence rung in D-02; first-true-wins behavior verified by
//     constructing inputs that satisfy multiple rungs and asserting the higher rung wins.
//   - vitest.config.ts has `globals: false`, so describe/expect/it are explicit imports
//     (mirrors useClipboardCapability.test.ts).
import { describe, expect, it } from 'vitest';
import { selectPillState } from './selectPillState';
import type { SelectPillStateInput } from './selectPillState';
import type { ClipboardCapabilitiesEnvelope } from '../services/clipboard/clipboardProtocol.generated';

function caps(overrides: Partial<ClipboardCapabilitiesEnvelope> = {}): ClipboardCapabilitiesEnvelope {
  return {
    inboundEnabled: true,
    outboundEnabled: true,
    kind: 'capabilities',
    maxBytes: 2_000_000,
    originId: 'desk-test',
    protocolVersion: '1.0',
    seq: 0,
    ts: 0,
    ...overrides,
  };
}

function baseInput(overrides: Partial<SelectPillStateInput> = {}): SelectPillStateInput {
  return {
    webRtcUp: true,
    browserCaps: { canRead: true, canWrite: true, isSecureContext: true },
    cachedDesktopCaps: caps(),
    lastRefusal: null,
    isPaused: false,
    lastSyncAt: null,
    hookStatus: 'idle',
    now: 10_000,
    ...overrides,
  };
}

describe('selectPillState precedence ladder (D-02)', () => {
  it('rung 1: disconnected when webRtcUp is false (outranks every other signal)', () => {
    const r = selectPillState(baseInput({ webRtcUp: false, isPaused: true }));
    expect(r.state).toBe('disconnected');
    expect(r.tooltipKey).toBe('pill.tooltip.disconnected');
  });

  it('rung 2a: unsupported-browser when both canRead and canWrite are false', () => {
    const r = selectPillState(
      baseInput({ browserCaps: { canRead: false, canWrite: false, isSecureContext: true } }),
    );
    expect(r.state).toBe('unsupported-browser');
    expect(r.tooltipKey).toBe('pill.tooltip.unsupportedBrowser');
  });

  it('rung 2b: unsupported-browser when isSecureContext is false even if read/write available (RESEARCH OQ 1)', () => {
    const r = selectPillState(
      baseInput({ browserCaps: { canRead: true, canWrite: true, isSecureContext: false } }),
    );
    expect(r.state).toBe('unsupported-browser');
  });

  it('rung 3: permission-required when hookStatus is permission-required', () => {
    const r = selectPillState(baseInput({ hookStatus: 'permission-required' }));
    expect(r.state).toBe('permission-required');
    expect(r.tooltipKey).toBe('pill.tooltip.permissionRequired');
  });

  it('rung 4: disabled when both directions disabled (D-04 master-off inference)', () => {
    const r = selectPillState(
      baseInput({
        cachedDesktopCaps: caps({ outboundEnabled: false, inboundEnabled: false }),
      }),
    );
    expect(r.state).toBe('disabled');
    expect(r.tooltipKey).toBe('pill.tooltip.disabled');
  });

  it('rung 5: read-only when only outbound disabled', () => {
    const r = selectPillState(
      baseInput({
        cachedDesktopCaps: caps({ outboundEnabled: false, inboundEnabled: true }),
      }),
    );
    expect(r.state).toBe('read-only');
    expect(r.tooltipKey).toBe('pill.tooltip.readOnly');
  });

  it('rung 5 reverse: read-only when only inbound disabled', () => {
    const r = selectPillState(
      baseInput({
        cachedDesktopCaps: caps({ outboundEnabled: true, inboundEnabled: false }),
      }),
    );
    expect(r.state).toBe('read-only');
  });

  it('rung 6: refused-too-large when TOO_LARGE refusal within 5s window', () => {
    const r = selectPillState(
      baseInput({
        lastRefusal: { reason: 'TOO_LARGE', at: 8_000, source: 'local' },
        now: 10_000,
      }),
    );
    expect(r.state).toBe('refused-too-large');
    expect(r.tooltipKey).toBe('pill.tooltip.refusedTooLarge');
  });

  it('rung 6 timeout: falls through after 5s', () => {
    const r = selectPillState(
      baseInput({
        lastRefusal: { reason: 'TOO_LARGE', at: 1_000, source: 'local' },
        now: 7_000,
      }),
    );
    expect(r.state).toBe('connected-idle');
  });

  it('rung 6 wrong-reason: only TOO_LARGE pins refused-too-large; PAUSED falls through', () => {
    const r = selectPillState(
      baseInput({
        lastRefusal: { reason: 'PAUSED', at: 9_500, source: 'remote' },
        now: 10_000,
      }),
    );
    expect(r.state).toBe('connected-idle');
  });

  it('rung 7: paused when isPaused and no higher rung matches', () => {
    const r = selectPillState(baseInput({ isPaused: true }));
    expect(r.state).toBe('paused');
    expect(r.tooltipKey).toBe('pill.tooltip.paused');
  });

  it('rung 7 outranked: disabled outranks paused (hardware/policy beats operator intent)', () => {
    const r = selectPillState(
      baseInput({
        isPaused: true,
        cachedDesktopCaps: caps({ outboundEnabled: false, inboundEnabled: false }),
      }),
    );
    expect(r.state).toBe('disabled');
  });

  it('rung 8: pulsing within 400ms after lastSyncAt', () => {
    const r = selectPillState(baseInput({ lastSyncAt: 9_800, now: 10_000 }));
    expect(r.state).toBe('pulsing');
    expect(r.tooltipKey).toBe('pill.tooltip.pulsingJustSynced');
  });

  it('rung 8 expired: connected-idle after 400ms', () => {
    const r = selectPillState(baseInput({ lastSyncAt: 9_000, now: 10_000 }));
    expect(r.state).toBe('connected-idle');
  });

  it('rung 9: connected-idle when nothing else matches', () => {
    const r = selectPillState(baseInput());
    expect(r.state).toBe('connected-idle');
    expect(r.tooltipKey).toBe('pill.tooltip.idle');
  });

  it('refused-too-large outranks paused (D-02 — most recent volitional outcome wins mid-pause)', () => {
    const r = selectPillState(
      baseInput({
        isPaused: true,
        lastRefusal: { reason: 'TOO_LARGE', at: 9_900, source: 'local' },
        now: 10_000,
      }),
    );
    expect(r.state).toBe('refused-too-large');
  });

  it('emits the correct tooltipKey for every state', () => {
    const cases: Array<{ in: Partial<SelectPillStateInput>; expectedKey: string }> = [
      { in: { webRtcUp: false }, expectedKey: 'pill.tooltip.disconnected' },
      {
        in: { browserCaps: { canRead: false, canWrite: false, isSecureContext: true } },
        expectedKey: 'pill.tooltip.unsupportedBrowser',
      },
      { in: { hookStatus: 'permission-required' }, expectedKey: 'pill.tooltip.permissionRequired' },
      {
        in: { cachedDesktopCaps: caps({ outboundEnabled: false, inboundEnabled: false }) },
        expectedKey: 'pill.tooltip.disabled',
      },
      {
        in: { cachedDesktopCaps: caps({ outboundEnabled: true, inboundEnabled: false }) },
        expectedKey: 'pill.tooltip.readOnly',
      },
      {
        in: { lastRefusal: { reason: 'TOO_LARGE', at: 9_500, source: 'local' }, now: 10_000 },
        expectedKey: 'pill.tooltip.refusedTooLarge',
      },
      { in: { isPaused: true }, expectedKey: 'pill.tooltip.paused' },
      { in: { lastSyncAt: 9_900, now: 10_000 }, expectedKey: 'pill.tooltip.pulsingJustSynced' },
      { in: {}, expectedKey: 'pill.tooltip.idle' },
    ];
    for (const c of cases) {
      expect(selectPillState(baseInput(c.in)).tooltipKey).toBe(c.expectedKey);
    }
  });
});
