/**
 * Tests for useWebRtcSignaling — answer application, candidate buffering,
 * SIPSorcery prefix normalization, null-pc guard, and rejection handling.
 *
 * The hook is injected with a pcRef pointing to an RtcStub; no real
 * RTCPeerConnection is needed. WebRTC globals are installed for the
 * RTCSessionDescription / RTCIceCandidate constructors that the hook calls.
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
import { useRef } from "react";
import {
  makeRtcStub,
  installRtcGlobals,
  restoreRtcGlobals,
  type RtcStub,
} from "./__tests__/rtcStub";

// -----------------------------------------------------------------------
// Module mocks
// -----------------------------------------------------------------------

vi.mock("src/utils/logger", () => ({
  frontendLogger: {
    log: vi.fn(),
    timing: vi.fn(),
  },
}));

import { useWebRtcSignaling } from "./useWebRtcSignaling";

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------

/**
 * Render the hook with a pcRef pointing to the given stub.
 * Returns the hook result and the stub for driving events.
 */
function setup(stub: RtcStub | null = makeRtcStub()) {
  let hook: ReturnType<typeof renderHook<ReturnType<typeof useWebRtcSignaling>, unknown>>;

  if (stub === null) {
    // null pc: pcRef.current is null from the start
    hook = renderHook(() => {
      const pcRef = useRef<RTCPeerConnection | null>(null);
      return useWebRtcSignaling({ pcRef });
    });
  } else {
    hook = renderHook(() => {
      const pcRef = useRef<RTCPeerConnection | null>(stub as unknown as RTCPeerConnection);
      return useWebRtcSignaling({ pcRef });
    });
  }

  return { hook, stub };
}

// -----------------------------------------------------------------------
// Suite
// -----------------------------------------------------------------------

describe("useWebRtcSignaling", () => {
  beforeEach(() => {
    installRtcGlobals();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    restoreRtcGlobals();
  });

  // ---------------------------------------------------------------------
  // 1. applies remote description on webrtc.answer
  // ---------------------------------------------------------------------
  it("applies remote desc on webrtc.answer", async () => {
    const stub = makeRtcStub();
    const { hook } = setup(stub);

    await act(async () => {
      hook.result.current.handleSignalingMessage("webrtc.answer", {
        sdp: "v=0\r\n...",
      });
      await Promise.resolve();
    });

    expect(stub.setRemoteDescription).toHaveBeenCalledTimes(1);
    const arg = stub.setRemoteDescription.mock.calls[0][0] as {
      type: string;
      sdp: string;
    };
    expect(arg.type).toBe("answer");
    expect(arg.sdp).toBe("v=0\r\n...");
  });

  // ---------------------------------------------------------------------
  // 2. buffers a candidate that arrives before remote desc
  // ---------------------------------------------------------------------
  it("buffers a candidate that arrives before remote desc", async () => {
    const stub = makeRtcStub();
    // remoteDescription is null (default)
    const { hook } = setup(stub);

    await act(async () => {
      hook.result.current.handleSignalingMessage("webrtc.ice_candidate", {
        candidate: "candidate:123 1 udp 2122260223 192.168.1.1 60000 typ host",
        sdpMid: "0",
        sdpMLineIndex: 0,
      });
      await Promise.resolve();
    });

    // NOT applied immediately — remoteDescription is null
    expect(stub.addIceCandidate).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------
  // 3. flushes buffered candidates after answer resolves
  // ---------------------------------------------------------------------
  it("flushes buffered candidates after answer resolves", async () => {
    const stub = makeRtcStub();
    // remoteDescription starts null → candidates buffered
    const { hook } = setup(stub);

    // Send two candidates before the answer
    await act(async () => {
      hook.result.current.handleSignalingMessage("webrtc.ice_candidate", {
        candidate: "candidate:111 1 udp 2122260223 10.0.0.1 50001 typ host",
        sdpMid: "0",
        sdpMLineIndex: 0,
      });
      hook.result.current.handleSignalingMessage("webrtc.ice_candidate", {
        candidate: "candidate:222 1 udp 2122260223 10.0.0.2 50002 typ host",
        sdpMid: "1",
        sdpMLineIndex: 1,
      });
      await Promise.resolve();
    });

    expect(stub.addIceCandidate).not.toHaveBeenCalled();

    // Now send the answer — setRemoteDescription resolves, triggering flush
    await act(async () => {
      hook.result.current.handleSignalingMessage("webrtc.answer", {
        sdp: "v=0\r\n...",
      });
      // Wait for setRemoteDescription's promise + flush loop
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(stub.addIceCandidate).toHaveBeenCalledTimes(2);
  });

  // ---------------------------------------------------------------------
  // 4. normalizes a prefix-less SIPSorcery candidate (Phase 42.1 Fix C)
  // ---------------------------------------------------------------------
  it("normalizes a prefix-less SIPSorcery candidate", async () => {
    const stub = makeRtcStub();
    // Set remoteDescription so the candidate is applied immediately
    stub.remoteDescription = { type: "answer", sdp: "" } as RTCSessionDescription;
    const { hook } = setup(stub);

    const rawWithoutPrefix =
      "122548911 1 udp 2122260223 192.168.1.100 56789 typ host generation 0 ufrag abc network-id 1";

    await act(async () => {
      hook.result.current.handleSignalingMessage("webrtc.ice_candidate", {
        candidate: rawWithoutPrefix,
        sdpMid: "0",
        sdpMLineIndex: 0,
      });
      await Promise.resolve();
    });

    expect(stub.addIceCandidate).toHaveBeenCalledTimes(1);
    const receivedInit = stub.addIceCandidate.mock.calls[0][0] as {
      candidate: string;
    };
    // Must have been prefixed with "candidate:"
    expect(receivedInit.candidate).toMatch(/^candidate:/);
    expect(receivedInit.candidate).toBe(`candidate:${rawWithoutPrefix}`);
  });

  // ---------------------------------------------------------------------
  // 5. passes a prefixed candidate through unchanged
  // ---------------------------------------------------------------------
  it("passes a prefixed candidate through unchanged", async () => {
    const stub = makeRtcStub();
    stub.remoteDescription = { type: "answer", sdp: "" } as RTCSessionDescription;
    const { hook } = setup(stub);

    const alreadyPrefixed =
      "candidate:122548911 1 udp 2122260223 192.168.1.100 56789 typ host";

    await act(async () => {
      hook.result.current.handleSignalingMessage("webrtc.ice_candidate", {
        candidate: alreadyPrefixed,
        sdpMid: "0",
        sdpMLineIndex: 0,
      });
      await Promise.resolve();
    });

    const receivedInit = stub.addIceCandidate.mock.calls[0][0] as {
      candidate: string;
    };
    expect(receivedInit.candidate).toBe(alreadyPrefixed);
  });

  // ---------------------------------------------------------------------
  // 6. early-returns on null pc (no throw)
  // ---------------------------------------------------------------------
  it("early-returns on null pc without throwing", () => {
    const { hook } = setup(null);

    expect(() => {
      act(() => {
        hook.result.current.handleSignalingMessage("webrtc.answer", {
          sdp: "v=0\r\n...",
        });
      });
    }).not.toThrow();
  });

  // ---------------------------------------------------------------------
  // 7. catches addIceCandidate rejection (no unhandled rejection)
  // ---------------------------------------------------------------------
  it("catches addIceCandidate rejection without throwing", async () => {
    const stub = makeRtcStub();
    stub.remoteDescription = { type: "answer", sdp: "" } as RTCSessionDescription;
    // Make addIceCandidate reject
    stub.addIceCandidate.mockRejectedValueOnce(
      new Error("OperationError: Error processing ICE candidate"),
    );
    const { hook } = setup(stub);

    // Should not throw or produce an unhandled rejection
    await act(async () => {
      hook.result.current.handleSignalingMessage("webrtc.ice_candidate", {
        candidate: "candidate:123 1 udp 2122260223 10.0.0.1 50001 typ host",
        sdpMid: "0",
        sdpMLineIndex: 0,
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    // addIceCandidate was called and rejected; no unhandled rejection surfaced
    expect(stub.addIceCandidate).toHaveBeenCalledTimes(1);
  });
});
