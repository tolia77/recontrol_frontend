/**
 * Structured frontend logger singleton.
 *
 * Provides a ring-buffer-backed logger with:
 *   - log(level, area, event, data)  — general logging; mirrors to console for non-timing levels
 *   - timing(area, event, data)      — hot-path silent accumulation; NO console output
 *   - download(filename?)            — exports the buffer as JSONL via Blob download
 *
 * Security contract: CALLERS MUST NOT pass clipboard contents, terminal I/O,
 * file contents, or auth tokens in `data`. The logger is a neutral sink; redaction
 * is the caller's responsibility (enforced at instrumentation call sites).
 *
 * No external dependencies — all APIs are browser built-ins.
 */

export interface LogEntry {
  /** performance.now() - sessionOrigin (monotonic ms since page load) */
  ts: number;
  /** Date.now() at entry creation (UTC epoch ms — cross-machine anchor) */
  wallMs: number;
  level: 'timing' | 'info' | 'warn' | 'error';
  /** Area / subsystem tag: 'webrtc' | 'command' | 'ui' | 'terminal' | 'clipboard' | 'files' | ... */
  area: string;
  event: string;
  data: Record<string, unknown>;
}

const RING_SIZE = 5000;

class FrontendLogger {
  private readonly ring: LogEntry[] = new Array<LogEntry>(RING_SIZE);
  private head = 0;
  private count = 0;
  private readonly sessionOrigin: number = performance.now();

  /**
   * Append a structured log entry and mirror to console for non-timing levels.
   */
  log(
    level: 'info' | 'warn' | 'error',
    area: string,
    event: string,
    data: Record<string, unknown>,
  ): void {
    const entry: LogEntry = {
      ts: performance.now() - this.sessionOrigin,
      wallMs: Date.now(),
      level,
      area,
      event,
      data,
    };
    this.ring[this.head % RING_SIZE] = entry;
    this.head++;
    this.count++;

    // Mirror to browser console with area/event prefix
    const prefix = `[${area}] ${event}`;
    if (level === 'error') {
      console.error(prefix, data);
    } else if (level === 'warn') {
      console.warn(prefix, data);
    } else {
      console.log(prefix, data);
    }
  }

  /**
   * Append a timing entry to the ring buffer. Silent — no console output.
   * Designed for hot-path use (e.g. per-frame callbacks) where console spam
   * would skew the measurements being collected.
   */
  timing(area: string, event: string, data: Record<string, unknown>): void {
    const entry: LogEntry = {
      ts: performance.now() - this.sessionOrigin,
      wallMs: Date.now(),
      level: 'timing',
      area,
      event,
      data,
    };
    this.ring[this.head % RING_SIZE] = entry;
    this.head++;
    this.count++;
    // Intentionally no console output — too noisy at frame rate
  }

  /**
   * Download the accumulated ring buffer as a JSONL file.
   *
   * Entries are serialized oldest-first (chronological order, accounting for
   * wrap). The Blob URL is revoked immediately after the programmatic click
   * to prevent a handle leak in browser memory (Pitfall 5).
   *
   * No-op when the buffer is empty.
   */
  download(filename = `recontrol-${Date.now()}.jsonl`): void {
    const liveCount = Math.min(this.count, RING_SIZE);
    if (liveCount === 0) return;

    // If the ring has wrapped, oldest slot is at `head % RING_SIZE`; otherwise 0.
    const start = this.count > RING_SIZE ? this.head % RING_SIZE : 0;
    const lines: string[] = [];
    for (let i = 0; i < liveCount; i++) {
      lines.push(JSON.stringify(this.ring[(start + i) % RING_SIZE]));
    }

    const blob = new Blob([lines.join('\n')], { type: 'application/jsonl' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    // Revoke immediately — the click initiates the download; the handle is no
    // longer needed and must not be held for the page lifetime.
    URL.revokeObjectURL(url);
  }
}

export const frontendLogger = new FrontendLogger();

// Expose on window so an operator can run `frontendLogger.download()`
// directly from the DevTools console during a streaming session.
if (typeof window !== "undefined") {
  (window as Window & { frontendLogger?: FrontendLogger }).frontendLogger = frontendLogger;
}
