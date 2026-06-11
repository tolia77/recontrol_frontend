// Phase 15 Plan 04 hook integration tests.
//
// Coverage: hook-level wiring of CAP-01 (caps send on open), CAP-04/05 (refusal
// feed sourced from BOTH remote and local), CAP-06 (cache populated for
// prepareOutbound consumption), POLICY-04 (discrete fields exposed), D-15
// (pause stays browser-local; no wire activity), D-18 (re-advertise on
// permission resolve).
//
// Decision logic (prepareOutbound / decideInbound) lives in clipboardCore and is
// covered by clipboardCore.test.ts. These tests assert React-glue behavior:
// effect lifecycle, state transitions, dispatch on incoming envelopes.
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  useClipboardSync,
  type UseClipboardSyncArgs,
} from "./realtime/useClipboardSync";
import type { ClipboardCapability } from "./useClipboardCapability";
import { ClipboardLoopGate } from "src/pages/DeviceControl/services/clipboard/clipboardLoopGate";

describe("useClipboardSync (module load)", () => {
  it("imports cleanly without side effects", async () => {
    const mod = await import("./realtime/useClipboardSync");
    expect(typeof mod.useClipboardSync).toBe("function");
  });
});

// Test harness

interface MockDataChannel {
  readyState: RTCDataChannelState;
  send: ReturnType<typeof vi.fn>;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
  /** Fires the registered 'message' listener with a JSON payload. */
  dispatch(json: string): void;
}

function makeMockDc(): MockDataChannel {
  let messageHandler: ((ev: MessageEvent) => void) | null = null;
  const dc: MockDataChannel = {
    readyState: "open",
    send: vi.fn(),
    addEventListener: vi.fn(
      (evt: string, handler: (ev: MessageEvent) => void) => {
        if (evt === "message") messageHandler = handler;
      },
    ),
    removeEventListener: vi.fn((evt: string) => {
      if (evt === "message") messageHandler = null;
    }),
    dispatch(json: string) {
      if (messageHandler) {
        messageHandler({ data: json } as MessageEvent);
      }
    },
  };
  return dc;
}

const FULL_CAPS: ClipboardCapability = {
  canRead: true,
  canWrite: true,
  isSecureContext: true,
};

interface Harness {
  dc: MockDataChannel;
  loopGate: ClipboardLoopGate;
  pcRef: React.RefObject<RTCPeerConnection | null>;
  clipboardCtlRef: React.RefObject<RTCDataChannel | null>;
  clipboardOriginIdRef: React.RefObject<string | null>;
  lastRemoteApplyTimeRef: React.MutableRefObject<number>;
  /** Build a stable-ref args object for renderHook. */
  args(overrides?: {
    caps?: ClipboardCapability;
    clipboardCtlOpen?: boolean;
  }): UseClipboardSyncArgs;
}

function makeHarness(opts: { originId?: string | null } = {}): Harness {
  const dc = makeMockDc();
  const loopGate = new ClipboardLoopGate();
  const pcRef = { current: null };
  const clipboardCtlRef = { current: dc as unknown as RTCDataChannel };
  const clipboardOriginIdRef = {
    current: opts.originId === undefined ? "origin-browser-1" : opts.originId,
  };
  const lastRemoteApplyTimeRef = { current: 0 };
  return {
    dc,
    loopGate,
    pcRef: pcRef as unknown as React.RefObject<RTCPeerConnection | null>,
    clipboardCtlRef:
      clipboardCtlRef as unknown as React.RefObject<RTCDataChannel | null>,
    clipboardOriginIdRef: clipboardOriginIdRef as unknown as React.RefObject<
      string | null
    >,
    lastRemoteApplyTimeRef:
      lastRemoteApplyTimeRef as unknown as React.MutableRefObject<number>,
    args(overrides = {}) {
      return {
        pcRef: this.pcRef,
        connectionState: "connected",
        clipboardCtlRef: this.clipboardCtlRef,
        clipboardOriginIdRef: this.clipboardOriginIdRef,
        loopGate: this.loopGate,
        lastRemoteApplyTimeRef: this.lastRemoteApplyTimeRef,
        clipboardCtlOpen: overrides.clipboardCtlOpen ?? true,
        caps: overrides.caps ?? FULL_CAPS,
      };
    },
  };
}

// Tests

describe("useClipboardSync — Phase 15 Plan 04", () => {
  beforeEach(() => {
    Object.defineProperty(globalThis.navigator, "clipboard", {
      configurable: true,
      value: {
        readText: vi.fn().mockResolvedValue(""),
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("sends capabilities envelope on data channel open", () => {
    const h = makeHarness();
    renderHook(() => useClipboardSync(h.args({ caps: FULL_CAPS })));
    expect(h.dc.send).toHaveBeenCalledTimes(1);
    const sent = JSON.parse((h.dc.send.mock.calls[0]?.[0] as string) ?? "{}");
    expect(sent).toMatchObject({
      kind: "capabilities",
      originId: "origin-browser-1",
      outboundEnabled: true,
      inboundEnabled: true,
      maxBytes: 2_000_000,
      protocolVersion: "1.0",
      seq: 1,
    });
    expect(typeof sent.ts).toBe("number");
  });

  it("capabilities envelope reflects caps flags", () => {
    const h = makeHarness();
    const partialCaps: ClipboardCapability = {
      canRead: false,
      canWrite: true,
      isSecureContext: true,
    };
    renderHook(() => useClipboardSync(h.args({ caps: partialCaps })));
    const sent = JSON.parse((h.dc.send.mock.calls[0]?.[0] as string) ?? "{}");
    expect(sent.outboundEnabled).toBe(false);
    expect(sent.inboundEnabled).toBe(true);
  });

  it("inbound capabilities envelope populates cache", () => {
    const h = makeHarness();
    const { result } = renderHook(() => useClipboardSync(h.args()));
    act(() => {
      h.dc.dispatch(
        JSON.stringify({
          kind: "capabilities",
          originId: "desk-1",
          outboundEnabled: false,
          inboundEnabled: true,
          maxBytes: 2_000_000,
          protocolVersion: "1.0",
          seq: 1,
          ts: Date.now(),
        }),
      );
    });
    expect(result.current.cachedDesktopCaps).not.toBeNull();
    expect(result.current.cachedDesktopCaps?.inboundEnabled).toBe(true);
  });

  it("inbound refused envelope sets lastRefusal source='remote'", () => {
    const h = makeHarness();
    const { result } = renderHook(() => useClipboardSync(h.args()));
    act(() => {
      h.dc.dispatch(
        JSON.stringify({
          kind: "refused",
          originId: "origin-browser-1",
          reason: "INBOUND_DISABLED",
          seq: 5,
          ts: Date.now(),
        }),
      );
    });
    expect(result.current.lastRefusal).not.toBeNull();
    expect(result.current.lastRefusal?.reason).toBe("INBOUND_DISABLED");
    expect(result.current.lastRefusal?.source).toBe("remote");
    expect(typeof result.current.lastRefusal?.at).toBe("number");
  });

  it("inbound refused PERMISSION_DENIED is accepted (not dropped by WR-01 gate)", () => {
    const h = makeHarness();
    const { result } = renderHook(() => useClipboardSync(h.args()));
    act(() => {
      h.dc.dispatch(
        JSON.stringify({
          kind: "refused",
          originId: "origin-browser-1",
          reason: "PERMISSION_DENIED",
          seq: 6,
          ts: Date.now(),
        }),
      );
    });
    expect(result.current.lastRefusal).not.toBeNull();
    expect(result.current.lastRefusal?.reason).toBe("PERMISSION_DENIED");
    expect(result.current.lastRefusal?.source).toBe("remote");
  });

  it("local refused-local from prepareOutbound sets lastRefusal source='local'", async () => {
    // C11 fixture from clipboardCore.test.ts: 24 control chars + 1 letter -> 96% control
    const controlText = "\x01".repeat(24) + "a";
    const readText = vi.fn().mockResolvedValue(controlText);
    Object.defineProperty(globalThis.navigator, "clipboard", {
      configurable: true,
      value: { readText, writeText: vi.fn().mockResolvedValue(undefined) },
    });
    // jsdom defaults: document.hasFocus()=true (we'll override), visibilityState='visible'.
    vi.spyOn(document, "hasFocus").mockReturnValue(true);
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
    const h = makeHarness();
    const { result } = renderHook(() => useClipboardSync(h.args()));
    await act(async () => {
      window.dispatchEvent(new FocusEvent("focus"));
      // Allow the async readText + prepareOutbound chain to resolve.
      for (let i = 0; i < 8; i += 1) await Promise.resolve();
    });
    expect(result.current.lastRefusal).not.toBeNull();
    expect(result.current.lastRefusal?.reason).toBe("NON_TEXT");
    expect(result.current.lastRefusal?.source).toBe("local");
  });

  it("cleanup on channel close clears cachedDesktopCaps", () => {
    const h = makeHarness();
    const { result, rerender } = renderHook(
      (props: { open: boolean }) =>
        useClipboardSync(h.args({ clipboardCtlOpen: props.open })),
      { initialProps: { open: true } },
    );
    // Populate the cache via inbound caps envelope.
    act(() => {
      h.dc.dispatch(
        JSON.stringify({
          kind: "capabilities",
          originId: "desk-1",
          outboundEnabled: true,
          inboundEnabled: true,
          maxBytes: 2_000_000,
          protocolVersion: "1.0",
          seq: 1,
          ts: Date.now(),
        }),
      );
    });
    expect(result.current.cachedDesktopCaps).not.toBeNull();
    // Close the channel.
    rerender({ open: false });
    expect(result.current.cachedDesktopCaps).toBeNull();

    // Re-open: a fresh capabilities envelope is sent (prevSentCapsRef was reset).
    const sendCallsBeforeReopen = h.dc.send.mock.calls.length;
    rerender({ open: true });
    expect(h.dc.send.mock.calls.length).toBeGreaterThan(sendCallsBeforeReopen);
    const sentOnReopen = JSON.parse(
      (h.dc.send.mock.calls[h.dc.send.mock.calls.length - 1]?.[0] as string) ??
        "{}",
    );
    expect(sentOnReopen.kind).toBe("capabilities");
  });

  it("togglePause does NOT send a capabilities envelope (D-15 wire-quiet pause)", () => {
    const h = makeHarness();
    const { result } = renderHook(() => useClipboardSync(h.args()));
    // Initial caps send already happened. Reset.
    h.dc.send.mockClear();
    act(() => {
      result.current.togglePause();
    });
    expect(h.dc.send).not.toHaveBeenCalled();
    expect(result.current.isPaused).toBe(true);
  });

  it("CR-01 regression: caps flip does NOT wipe cachedDesktopCaps", () => {
    // CR-01 in 15-REVIEW.md: the previous shape listed caps.* in the inbound
    // subscribe effect's deps, so the effect tore down (clearing the cache)
    // every time useClipboardCapability flipped from initial-false to detected.
    // The fix splits re-advertise into a separate effect that does NOT touch
    // subscription state.
    const h = makeHarness();
    const initialCaps: ClipboardCapability = {
      canRead: false,
      canWrite: false,
      isSecureContext: true,
    };
    const { result, rerender } = renderHook(
      (props: { caps: ClipboardCapability }) =>
        useClipboardSync(h.args({ caps: props.caps })),
      { initialProps: { caps: initialCaps } },
    );
    // Desktop sends a capabilities envelope before caps flip (e.g. arrived in
    // the first window after channel-open, before useClipboardCapability has
    // resolved its detection).
    act(() => {
      h.dc.dispatch(
        JSON.stringify({
          kind: "capabilities",
          originId: "desk-1",
          outboundEnabled: true,
          inboundEnabled: true,
          maxBytes: 2_000_000,
          protocolVersion: "1.0",
          seq: 1,
          ts: Date.now(),
        }),
      );
    });
    expect(result.current.cachedDesktopCaps).not.toBeNull();

    // Caps flip — must not wipe the cache.
    act(() => {
      rerender({ caps: FULL_CAPS });
    });
    expect(result.current.cachedDesktopCaps).not.toBeNull();
    expect(result.current.cachedDesktopCaps?.inboundEnabled).toBe(true);
  });

  it("re-advertise on permission resolve (caps flip causes fresh capabilities send)", () => {
    // D-18: when the browser's optimistic caps detection later flips (e.g. the
    // user grants the permission prompt), the hook re-advertises so the desktop
    // unblocks its inbound gate. After CR-01, this is driven by a dedicated
    // re-advertise effect that watches caps.* and calls client.send WITHOUT
    // touching the inbound subscription.
    const h = makeHarness();
    const initialCaps: ClipboardCapability = {
      canRead: false,
      canWrite: false,
      isSecureContext: true,
    };
    const { rerender } = renderHook(
      (props: { caps: ClipboardCapability }) =>
        useClipboardSync(h.args({ caps: props.caps })),
      { initialProps: { caps: initialCaps } },
    );
    const initialSent = JSON.parse(
      (h.dc.send.mock.calls[0]?.[0] as string) ?? "{}",
    );
    expect(initialSent.kind).toBe("capabilities");
    expect(initialSent.outboundEnabled).toBe(false);
    expect(initialSent.inboundEnabled).toBe(false);

    h.dc.send.mockClear();
    // Caps flip to all-true (user granted permission).
    rerender({ caps: FULL_CAPS });

    // Effect re-ran: a new capabilities envelope with the flipped flags should
    // have been sent.
    const capsSends = h.dc.send.mock.calls
      .map((c) => {
        try {
          return JSON.parse(c[0] as string);
        } catch {
          return null;
        }
      })
      .filter((env) => env && env.kind === "capabilities");
    expect(capsSends.length).toBeGreaterThanOrEqual(1);
    const last = capsSends[capsSends.length - 1];
    expect(last.outboundEnabled).toBe(true);
    expect(last.inboundEnabled).toBe(true);
  });
});
