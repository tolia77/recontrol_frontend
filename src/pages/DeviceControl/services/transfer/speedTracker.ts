export interface SpeedEstimate {
  bytesPerSecond: number | null;
  etaSeconds: number | null;
}

interface SpeedTrackerOptions {
  alpha?: number;
  minSamplesForEta?: number;
}

export class SpeedTracker {
  private readonly alpha: number;
  private readonly minSamplesForEta: number;
  private sampleCount = 0;
  private emaBytesPerSecond: number | null = null;
  private lastBytesSoFar: number | null = null;
  private lastTimestampMs: number | null = null;

  constructor(options?: SpeedTrackerOptions) {
    this.alpha = options?.alpha ?? 0.25;
    this.minSamplesForEta = options?.minSamplesForEta ?? 2;
  }

  update(bytesSoFar: number, totalBytes: number, nowMs = Date.now()): SpeedEstimate {
    if (this.lastTimestampMs === null || this.lastBytesSoFar === null) {
      this.lastTimestampMs = nowMs;
      this.lastBytesSoFar = bytesSoFar;
      return { bytesPerSecond: null, etaSeconds: null };
    }

    const deltaBytes = bytesSoFar - this.lastBytesSoFar;
    const deltaMs = nowMs - this.lastTimestampMs;

    this.lastTimestampMs = nowMs;
    this.lastBytesSoFar = bytesSoFar;

    if (deltaBytes > 0 && deltaMs > 0) {
      const instantBytesPerSecond = (deltaBytes * 1000) / deltaMs;
      this.emaBytesPerSecond =
        this.emaBytesPerSecond === null
          ? instantBytesPerSecond
          : this.emaBytesPerSecond + (instantBytesPerSecond - this.emaBytesPerSecond) * this.alpha;
      this.sampleCount += 1;
    }

    const speed = this.emaBytesPerSecond;
    const bytesRemaining = Math.max(0, totalBytes - bytesSoFar);
    const hasEnoughSamples = this.sampleCount >= this.minSamplesForEta;
    const etaSeconds =
      speed !== null && speed > 0 && hasEnoughSamples
        ? Math.ceil(bytesRemaining / speed)
        : null;

    return { bytesPerSecond: speed, etaSeconds };
  }
}
