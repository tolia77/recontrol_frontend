import { describe, expect, it } from 'vitest';
import { ClipboardLoopGate } from './clipboardLoopGate';

class FakeClock {
  private now = 0;
  nowMs(): number {
    return this.now;
  }
  advance(ms: number): void {
    this.now += ms;
  }
}

async function hash8(text: string): Promise<Uint8Array> {
  const encoded = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return new Uint8Array(digest).slice(0, 8);
}

describe('ClipboardLoopGate', () => {
  it('suppresses outbound within ttl and releases after ttl', async () => {
    const clock = new FakeClock();
    const gate = new ClipboardLoopGate(clock);
    const hash = await hash8('hello');

    gate.recordSent(hash);
    expect(gate.shouldSuppressOutbound(hash)).toBe(true);
    clock.advance(2500);
    expect(gate.shouldSuppressOutbound(hash)).toBe(false);
  });

  it('suppresses inbound within ttl and releases after ttl', async () => {
    const clock = new FakeClock();
    const gate = new ClipboardLoopGate(clock);
    const hash = await hash8('inbound');

    gate.recordApplied(hash);
    expect(gate.shouldSuppressInbound(hash)).toBe(true);
    clock.advance(2500);
    expect(gate.shouldSuppressInbound(hash)).toBe(false);
  });

  it('evicts oldest entry after ring capacity', async () => {
    const clock = new FakeClock();
    const gate = new ClipboardLoopGate(clock);
    const hashes = await Promise.all(Array.from({ length: 9 }, (_, i) => hash8(`h-${i}`)));

    for (const h of hashes) {
      gate.recordApplied(h);
      clock.advance(1);
    }

    expect(gate.shouldSuppressInbound(hashes[0])).toBe(false);
    expect(gate.shouldSuppressInbound(hashes[8])).toBe(true);
  });

  it('reset clears sent and receiver ring', async () => {
    const clock = new FakeClock();
    const gate = new ClipboardLoopGate(clock);
    const sent = await hash8('sent');
    const inbound = await hash8('inbound');

    gate.recordSent(sent);
    gate.recordApplied(inbound);
    gate.reset();

    expect(gate.shouldSuppressOutbound(sent)).toBe(false);
    expect(gate.shouldSuppressInbound(inbound)).toBe(false);
  });
});
