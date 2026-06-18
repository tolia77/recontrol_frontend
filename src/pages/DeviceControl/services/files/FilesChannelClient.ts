import type { FilesError, FilesErrorCode } from "./filesProtocol.generated";

/**
 * Error thrown (via Promise rejection) by FilesChannelClient.request when the
 * desktop peer returns a structured error envelope, the channel closes while a
 * request is pending, the request times out, or the channel is already closed.
 *
 * The `info` field carries the structured FilesError from the generated schema,
 * so callers can branch on `err.info.code` (e.g. `UNKNOWN_COMMAND`, `TIMEOUT`)
 * and render localized messages via the i18n layer.
 */
export class FilesChannelError extends Error {
  readonly info: FilesError;

  constructor(info: FilesError) {
    super(info.message);
    this.name = "FilesChannelError";
    this.info = info;
  }
}

interface PendingEntry {
  resolve: (v: unknown) => void;
  reject: (e: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

interface FilesResponse {
  id?: string;
  status?: "success" | "error";
  result?: unknown;
  error?: FilesError;
}

/**
 * Frontend-side JSON request/response client for the `files-ctl` WebRTC data
 * channel. Each call to {@link request} sends a `{id, command, payload}`
 * envelope to the desktop peer and returns a promise that resolves with
 * `result` on a success envelope or rejects with a {@link FilesChannelError}
 * on error / timeout / channel teardown.
 *
 * Correlation is by UUID (crypto.randomUUID); the default timeout is 15 s and
 * can be overridden per-call via the third argument.
 */
export class FilesChannelClient {
  private readonly dc: RTCDataChannel;
  private readonly defaultTimeoutMs: number;
  private readonly pending = new Map<string, PendingEntry>();
  private readonly eventListeners = new Map<
    string,
    Set<(payload: unknown) => void>
  >();
  private disposed = false;

  constructor(dc: RTCDataChannel, defaultTimeoutMs: number = 15_000) {
    this.dc = dc;
    this.defaultTimeoutMs = defaultTimeoutMs;
    dc.addEventListener("message", this.onMessage);
    dc.addEventListener("close", this.onClose);
  }

  /**
   * Send a command envelope over files-ctl and await the matching response.
   * Resolves with `result` on success; rejects with {@link FilesChannelError}
   * on structured error, timeout, malformed response, or channel teardown.
   *
   * @param command Dot-namespaced command identifier, e.g. `files.list`.
   * @param payload Command-specific request payload.
   * @param timeoutMs Optional override of the default (15_000 ms).
   */
  request<TPayload, TResult>(
    command: string,
    payload: TPayload,
    timeoutMs?: number,
  ): Promise<TResult> {
    if (this.disposed) {
      return Promise.reject(
        new FilesChannelError({
          code: "DISPOSED" as FilesErrorCode,
          message: "FilesChannelClient is disposed",
        }),
      );
    }
    if (this.dc.readyState !== "open") {
      return Promise.reject(
        new FilesChannelError({
          code: "CHANNEL_NOT_OPEN" as FilesErrorCode,
          message: `files-ctl state is ${this.dc.readyState}`,
        }),
      );
    }

    const id = crypto.randomUUID();
    const envelope = { id, command, payload };
    const ms = timeoutMs ?? this.defaultTimeoutMs;

    return new Promise<TResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(
          new FilesChannelError({
            code: "TIMEOUT" as FilesErrorCode,
            message: `${command} timed out after ${ms} ms`,
            data: { command, timeoutMs: ms },
          }),
        );
      }, ms);

      this.pending.set(id, {
        resolve: (v) => resolve(v as TResult),
        reject,
        timer,
      });

      try {
        this.dc.send(JSON.stringify(envelope));
      } catch (err) {
        this.pending.delete(id);
        clearTimeout(timer);
        reject(
          new FilesChannelError({
            code: "CHANNEL_NOT_OPEN" as FilesErrorCode,
            message: `send failed: ${(err as Error).message}`,
          }),
        );
      }
    });
  }

  /**
   * Subscribe to server-push events on this channel. Multiple subscribers
   * can attach to the same command. The returned function unsubscribes
   * (and is idempotent). Listeners are invoked synchronously on the
   * onmessage event-loop turn; do not throw from listeners (the channel
   * is shared by every transfer).
   *
   * Events: `files.download.complete` (payload: FilesDownloadCompletePayload)
   * and `files.transfer.error` (payload: FilesTransferErrorPayload). The
   * payload is delivered untyped (`unknown`); callers that want type-safety
   * should cast at the subscription site.
   */
  onEvent(command: string, listener: (payload: unknown) => void): () => void {
    let set = this.eventListeners.get(command);
    if (!set) {
      set = new Set();
      this.eventListeners.set(command, set);
    }
    set.add(listener);
    return () => {
      set?.delete(listener);
      if (set && set.size === 0) this.eventListeners.delete(command);
    };
  }

  private onMessage = (ev: MessageEvent): void => {
    let parsed: FilesResponse;
    try {
      const raw =
        typeof ev.data === "string"
          ? ev.data
          : new TextDecoder().decode(ev.data);
      parsed = JSON.parse(raw);
    } catch {
      // Malformed JSON -- no id to correlate, nothing to do.
      return;
    }

    // Server-push event branch. Event envelopes have no id; they correlate
    // by command name to the listener registry, NOT to the pending-request
    // map. Returns immediately so the rest of the method only runs for
    // request/response correlation.
    const maybeEvent = parsed as unknown as {
      status?: string;
      command?: string;
      payload?: unknown;
    };
    if (
      maybeEvent.status === "event" &&
      typeof maybeEvent.command === "string"
    ) {
      const set = this.eventListeners.get(maybeEvent.command);
      if (set) {
        for (const cb of set) {
          try {
            cb(maybeEvent.payload);
          } catch (err) {
            console.error("[files-ctl] event listener threw", err);
          }
        }
      }
      return;
    }

    if (!parsed.id) return;

    const entry = this.pending.get(parsed.id);
    if (!entry) return; // already timed out or unknown id

    this.pending.delete(parsed.id);
    clearTimeout(entry.timer);

    if (parsed.status === "success") {
      entry.resolve(parsed.result);
    } else if (parsed.status === "error" && parsed.error) {
      entry.reject(new FilesChannelError(parsed.error));
    } else {
      entry.reject(
        new FilesChannelError({
          code: "MALFORMED_RESPONSE" as FilesErrorCode,
          message: "files-ctl response missing status or error",
        }),
      );
    }
  };

  private onClose = (): void => {
    for (const [, entry] of this.pending) {
      clearTimeout(entry.timer);
      entry.reject(
        new FilesChannelError({
          code: "CHANNEL_NOT_OPEN" as FilesErrorCode,
          message: "files-ctl closed while request was pending",
        }),
      );
    }
    this.pending.clear();
  };

  /**
   * Tear down this client: unregister DataChannel listeners, reject every
   * outstanding request with a {@link FilesChannelError} of code DISPOSED,
   * and mark the client so any subsequent request() call rejects immediately.
   *
   * Does NOT call `dc.close()` -- the desktop never observes a
   * frontend-initiated dc.close(), so tear-down is driven by `pc.close()` on
   * the RTCPeerConnection instead. Repeated calls are safe.
   */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.dc.removeEventListener("message", this.onMessage);
    this.dc.removeEventListener("close", this.onClose);
    for (const [, entry] of this.pending) {
      clearTimeout(entry.timer);
      entry.reject(
        new FilesChannelError({
          code: "DISPOSED" as FilesErrorCode,
          message: "FilesChannelClient disposed",
        }),
      );
    }
    this.pending.clear();
    this.eventListeners.clear();
  }
}
