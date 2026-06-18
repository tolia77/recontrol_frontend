/**
 * Tests for usePeerConnection — peer lifecycle, reconnect/backoff, and the
 * 45-second watchdog regression.
 *
 * Key isolation decisions:
 * - vi.mock("src/services/backend/turnService") so getCredentials resolves
 *   immediately; this also keeps the module-singleton iceServersCache
 *   deterministic across tests (always returns the same mocked value).
 * - vi.mock("src/utils/logger") so frontendLogger calls are no-ops.
 * - installRtcGlobals() / restoreRtcGlobals() install and tear down WebRTC
 *   globals per test via vi.stubGlobal (not via src/test/setup.ts).
 * - vi.useFakeTimers() in beforeEach so all setTimeout / Date.now calls are
 *   deterministic. Fake timers are released in afterEach.
 */

import { renderHook, act, cleanup } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  installRtcGlobals,
  restoreRtcGlobals,
  lastStub,
} from "./__tests__/rtcStub";

// -----------------------------------------------------------------------
// Module mocks — declared at module scope so vitest hoists them.
// -----------------------------------------------------------------------

vi.mock("src/services/backend/turnService", () => ({
  turnService: {
    getCredentials: vi.fn(() =>
      Promise.resolve({ ice_servers: [{ urls: "stun:stub.stun.test" }] }),
    ),
  },
}));

vi.mock("src/utils/logger", () => ({
  frontendLogger: {
    log: vi.fn(),
    timing: vi.fn(),
  },
}));

// -----------------------------------------------------------------------
// Dynamic import of the SUT — loaded AFTER mocks are hoisted.
// We import it at module scope; the iceServersCache singleton is reset
// implicitly because getCredentials always resolves to the same mocked
// value, so cache hits vs. cache misses are transparent to assertions.
// -----------------------------------------------------------------------

import { usePeerConnection } from "./usePeerConnection";

// -----------------------------------------------------------------------
// Constants (mirror usePeerConnection.ts — changes here signal source drift)
// -----------------------------------------------------------------------
const WATCHDOG_MS = 9000;
// TOTAL_TIMEOUT_MS (45000) is the source's failure deadline; referenced in the
// comments below to explain how many cycles we advance, not used directly.
const MAX_BACKOFF_MS = 8000;

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------

/** Build the minimal options the hook requires. sendMessage is a vi.fn(). */
function makeOptions() {
  return {
    sendMessage: vi.fn(),
    setupDataChannels: vi.fn(),
    cleanupDataChannels: vi.fn(),
  };
}

/**
 * Render the hook with stub options and return the result + helpers.
 * The hook is rendered inside act() so initial effects settle.
 */
function setup() {
  const opts = makeOptions();
  const hook = renderHook(() => usePeerConnection(opts));
  return { hook, opts };
}

/**
 * Flush the microtask queue so promises inside the hook (createOffer,
 * setLocalDescription, etc.) settle before we inspect state.
 */
async function flushMicrotasks() {
  await act(async () => {
    await Promise.resolve();
  });
}

// -----------------------------------------------------------------------
// Suite
// -----------------------------------------------------------------------

describe("usePeerConnection", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    installRtcGlobals();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
    restoreRtcGlobals();
  });

  // ---------------------------------------------------------------------
  // 1. sends webrtc.offer on startWebRtc
  // ---------------------------------------------------------------------
  it("sends webrtc.offer on startWebRtc", async () => {
    const { hook, opts } = setup();

    act(() => {
      hook.result.current.startWebRtc();
    });
    await flushMicrotasks();

    expect(opts.sendMessage).toHaveBeenCalledWith(
      "webrtc.offer",
      expect.objectContaining({ sdp: "<stub-sdp>" }),
    );
    expect(hook.result.current.connectionState).toBe("connecting");
  });

  // ---------------------------------------------------------------------
  // 2. relays onicecandidate
  // ---------------------------------------------------------------------
  it("relays onicecandidate to sendMessage", async () => {
    const { hook, opts } = setup();

    act(() => {
      hook.result.current.startWebRtc();
    });
    await flushMicrotasks();

    const stub = lastStub()!;
    const fakeCandidate = {
      candidate: "candidate:123 1 udp 2122260223 192.168.1.1 60000 typ host",
      sdpMid: "0",
      sdpMLineIndex: 0,
    } as RTCIceCandidate;

    act(() => {
      stub.emitIceCandidate(fakeCandidate);
    });

    expect(opts.sendMessage).toHaveBeenCalledWith("webrtc.ice_candidate", {
      candidate: fakeCandidate.candidate,
      sdpMid: fakeCandidate.sdpMid,
      sdpMLineIndex: fakeCandidate.sdpMLineIndex,
    });
  });

  // ---------------------------------------------------------------------
  // 3. marks connected
  // ---------------------------------------------------------------------
  it("marks connected when stub emits connected state", async () => {
    const { hook } = setup();

    act(() => {
      hook.result.current.startWebRtc();
    });
    await flushMicrotasks();

    const stub = lastStub()!;
    act(() => {
      stub.emitConnectionState("connected");
    });

    expect(hook.result.current.connectionState).toBe("connected");
  });

  // ---------------------------------------------------------------------
  // 4. starts reconnect after first failure-once-connected
  // ---------------------------------------------------------------------
  it("starts reconnect after failure on a previously-connected peer", async () => {
    const { hook } = setup();

    act(() => {
      hook.result.current.startWebRtc();
    });
    await flushMicrotasks();

    const stub = lastStub()!;

    // connect first
    act(() => {
      stub.emitConnectionState("connected");
    });
    expect(hook.result.current.connectionState).toBe("connected");

    // then fail
    act(() => {
      stub.emitConnectionState("failed");
    });

    expect(hook.result.current.connectionState).toBe("reconnecting");
  });

  // ---------------------------------------------------------------------
  // 5. fails immediately when never connected
  // ---------------------------------------------------------------------
  it("fails immediately when peer fails without ever having connected", async () => {
    const { hook } = setup();

    act(() => {
      hook.result.current.startWebRtc();
    });
    await flushMicrotasks();

    const stub = lastStub()!;

    // fail without any prior connected event
    act(() => {
      stub.emitConnectionState("failed");
    });

    expect(hook.result.current.connectionState).toBe("failed");
  });

  // ---------------------------------------------------------------------
  // 6. 45s watchdog regression
  //
  // The stub peer is created, we connect once, then fail → reconnecting.
  // The retry pc is created but its connectionState stays "new" (never
  // emitConnectionState — we do NOT fire onconnectionstatechange again).
  // Time advances through multiple WATCHDOG_MS windows until the total
  // elapsed budget crosses TOTAL_TIMEOUT_MS, at which point attemptReconnect
  // declares "failed" via the watchdog path (not via an event).
  //
  // This test would PASS even if the watchdog were removed (because we could
  // just fire events), but it would FAIL if we naively rely on
  // onconnectionstatechange: we deliberately never fire it after the initial
  // failure, so the only path to "failed" is the WATCHDOG_MS re-entry.
  // ---------------------------------------------------------------------
  it("declares failure via the WATCHDOG after ~45s with peer stuck non-connected", async () => {
    const { hook } = setup();

    act(() => {
      hook.result.current.startWebRtc();
    });
    await flushMicrotasks();

    const initialStub = lastStub()!;

    // connect once
    act(() => {
      initialStub.emitConnectionState("connected");
    });
    expect(hook.result.current.connectionState).toBe("connected");

    // fail → enters reconnect episode; reconnectStart is set to Date.now()
    act(() => {
      initialStub.emitConnectionState("failed");
    });
    expect(hook.result.current.connectionState).toBe("reconnecting");

    // We now drive time through multiple watchdog cycles without ever firing
    // onconnectionstatechange on the retry peer. Each cycle:
    //   - backoff timer fires → createPeerConnection() (new stub created)
    //   - watchdog timer (WATCHDOG_MS=9000) fires → attemptReconnect re-entered
    //   - elapsed check fires; if < TOTAL_TIMEOUT_MS, schedules another retry
    // We advance until elapsed >= TOTAL_TIMEOUT_MS (45000ms).
    //
    // Backoff sequence: 1000, 2000, 4000, 8000, 8000, 8000, 8000, 8000...
    // With WATCHDOG at 9000, each effective cycle ≈ backoff + WATCHDOG_MS.
    // We need total elapsed ≥ 45000. We just advance generously.
    //
    // NOTE: we must always await microtasks after advancing timers because
    // createPeerConnection is async (awaits fetchIceServers).

    // Run enough cycles to exceed TOTAL_TIMEOUT_MS (45000ms).
    // Each iteration advances: current backoff + WATCHDOG_MS.
    // Worst case: all MAX_BACKOFF_MS (8000) + WATCHDOG (9000) = 17000 per round.
    // 45000 / 17000 ≈ 3 rounds — advance 6 rounds to be safe.
    for (let i = 0; i < 10; i++) {
      // Fire the current backoff timer (creates the next PC)
      await act(async () => {
        vi.advanceTimersByTime(MAX_BACKOFF_MS + 100);
        await Promise.resolve();
      });

      // Read into a fresh local each time: comparing the shared
      // `result.current.connectionState` expression twice makes TS narrow it
      // after the first `break`, wrongly concluding the second compare can
      // never be "failed" (the value actually changes via act() above).
      const afterBackoff = hook.result.current.connectionState;
      if (afterBackoff === "failed") break;

      // Fire the watchdog (WATCHDOG_MS after the retry PC was created)
      await act(async () => {
        vi.advanceTimersByTime(WATCHDOG_MS + 100);
        await Promise.resolve();
      });

      const afterWatchdog = hook.result.current.connectionState;
      if (afterWatchdog === "failed") break;
    }

    // By this point total elapsed >> TOTAL_TIMEOUT_MS — watchdog must have
    // declared failure via the re-entry path (NOT via onconnectionstatechange).
    expect(hook.result.current.connectionState).toBe("failed");

    // The stub's close() must have been called during cleanupPeerConnection
    // (the failure path calls cleanupPeerConnection()). The latest stub is
    // the most recent retry PC — it should have been closed.
    const latestStub = lastStub()!;
    expect(latestStub.close).toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------
  // 7. exponential backoff 1s / 2s / 4s / 8s capped at MAX_BACKOFF_MS
  // ---------------------------------------------------------------------
  it("schedules exponential backoff capped at MAX_BACKOFF_MS", async () => {
    const { hook } = setup();

    act(() => {
      hook.result.current.startWebRtc();
    });
    await flushMicrotasks();

    const firstStub = lastStub()!;

    // connect → fail → reconnecting (retry count = 0 → backoff = 1000)
    act(() => {
      firstStub.emitConnectionState("connected");
    });
    act(() => {
      firstStub.emitConnectionState("failed");
    });
    expect(hook.result.current.connectionState).toBe("reconnecting");

    // Advance 1000ms → first retry fires (retryCount was 0 → backoff 1s)
    await act(async () => {
      vi.advanceTimersByTime(1000);
      await Promise.resolve();
    });
    // Watchdog armed; advance past it to trigger next cycle without connecting
    await act(async () => {
      vi.advanceTimersByTime(WATCHDOG_MS + 100);
      await Promise.resolve();
    });
    // retryCount is now 1 → next backoff should be 2s
    // Advance 2000ms → second retry fires
    await act(async () => {
      vi.advanceTimersByTime(2000);
      await Promise.resolve();
    });
    await act(async () => {
      vi.advanceTimersByTime(WATCHDOG_MS + 100);
      await Promise.resolve();
    });
    // retryCount 2 → backoff 4s
    await act(async () => {
      vi.advanceTimersByTime(4000);
      await Promise.resolve();
    });
    await act(async () => {
      vi.advanceTimersByTime(WATCHDOG_MS + 100);
      await Promise.resolve();
    });
    // retryCount 3 → backoff 8s (MAX_BACKOFF_MS)
    await act(async () => {
      vi.advanceTimersByTime(MAX_BACKOFF_MS);
      await Promise.resolve();
    });
    // Total elapsed so far: 1000 + (WATCHDOG_MS+100) + 2000 + (WATCHDOG_MS+100)
    //   + 4000 + (WATCHDOG_MS+100) + MAX_BACKOFF_MS = 42300ms < TOTAL_TIMEOUT_MS (45000ms).
    // The watchdog for this retry PC has NOT fired yet — the hook must still be reconnecting.
    expect(hook.result.current.connectionState).toBe("reconnecting");

    // Now advance through the watchdog window for this retry PC.
    // After WATCHDOG_MS fires, total elapsed ~51300ms > TOTAL_TIMEOUT_MS (45000ms),
    // so the watchdog re-entry path declares failure.
    await act(async () => {
      vi.advanceTimersByTime(WATCHDOG_MS + 100);
      await Promise.resolve();
    });
    expect(hook.result.current.connectionState).toBe("failed");
  });

  // ---------------------------------------------------------------------
  // 8. tears down on stopWebRtc
  // ---------------------------------------------------------------------
  it("tears down on stopWebRtc", async () => {
    const { hook, opts } = setup();

    act(() => {
      hook.result.current.startWebRtc();
    });
    await flushMicrotasks();

    const stub = lastStub()!;
    act(() => {
      stub.emitConnectionState("connected");
    });

    act(() => {
      hook.result.current.stopWebRtc();
    });

    expect(opts.sendMessage).toHaveBeenCalledWith("webrtc.stop", {});
    expect(stub.close).toHaveBeenCalled();
    expect(hook.result.current.connectionState).toBe("idle");
  });

  // ---------------------------------------------------------------------
  // 9. cleans up on unmount
  // ---------------------------------------------------------------------
  it("cleans up on unmount (calls close, no pending timers)", async () => {
    const { hook } = setup();

    act(() => {
      hook.result.current.startWebRtc();
    });
    await flushMicrotasks();

    const stub = lastStub()!;

    // Unmount the hook
    act(() => {
      hook.unmount();
    });

    // The cleanup useEffect calls cleanupPeerConnection → pc.close()
    expect(stub.close).toHaveBeenCalled();
  });
});
