export const RING_CAPACITY = 8;
export const TTL_MS = 2000;

export interface Clock {
  nowMs(): number;
}

class SystemClock implements Clock {
  nowMs(): number {
    return Date.now();
  }
}

interface RingEntry {
  hash8: Uint8Array;
  atMs: number;
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function copyHash(hash8: Uint8Array): Uint8Array {
  if (hash8.length !== 8) {
    throw new Error('hash must be exactly 8 bytes');
  }
  return new Uint8Array(hash8);
}

export class ClipboardLoopGate {
  private readonly clock: Clock;
  private lastSentHash: Uint8Array | null = null;
  private lastSentAtMs: number | null = null;
  private readonly recentApplied: RingEntry[] = [];

  constructor(clock: Clock = new SystemClock()) {
    this.clock = clock;
  }

  shouldSuppressOutbound(hash8: Uint8Array): boolean {
    const incoming = copyHash(hash8);
    if (!this.lastSentHash || this.lastSentAtMs === null) return false;
    if (this.clock.nowMs() - this.lastSentAtMs > TTL_MS) return false;
    return bytesEqual(incoming, this.lastSentHash);
  }

  recordSent(hash8: Uint8Array): void {
    this.lastSentHash = copyHash(hash8);
    this.lastSentAtMs = this.clock.nowMs();
  }

  shouldSuppressInbound(hash8: Uint8Array): boolean {
    const incoming = copyHash(hash8);
    this.pruneExpired();
    return this.recentApplied.some((e) => bytesEqual(incoming, e.hash8));
  }

  recordApplied(hash8: Uint8Array): void {
    this.pruneExpired();
    this.recentApplied.push({ hash8: copyHash(hash8), atMs: this.clock.nowMs() });
    while (this.recentApplied.length > RING_CAPACITY) {
      this.recentApplied.shift();
    }
  }

  reset(): void {
    this.lastSentHash = null;
    this.lastSentAtMs = null;
    this.recentApplied.length = 0;
  }

  private pruneExpired(): void {
    const now = this.clock.nowMs();
    for (let i = this.recentApplied.length - 1; i >= 0; i -= 1) {
      if (now - this.recentApplied[i].atMs > TTL_MS) {
        this.recentApplied.splice(i, 1);
      }
    }
  }
}
