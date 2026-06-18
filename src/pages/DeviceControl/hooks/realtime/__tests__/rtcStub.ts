/**
 * Hand-rolled RTCPeerConnection stub for WebRTC hook tests.
 *
 * Design mirrors mockConsumer.ts: a make*() factory returns the fake object
 * plus a test-only emit surface. No WebRTC mock library is used.
 *
 * Globals must be installed PER TEST FILE via installRtcGlobals() /
 * restoreRtcGlobals() — never via src/test/setup.ts.
 *
 * Members implemented are exactly those consumed by usePeerConnection.ts and
 * useWebRtcSignaling.ts (enumerated from source reads):
 *   methods:  addTransceiver, createOffer, setLocalDescription,
 *             setRemoteDescription, addIceCandidate, close
 *   handlers: onicecandidate, ontrack, onconnectionstatechange, ondatachannel
 *   props:    connectionState (settable), remoteDescription (settable)
 *   static:   RTCRtpReceiver.getCapabilities (returns null by default)
 *   globals:  RTCPeerConnection (factory), RTCSessionDescription,
 *             RTCIceCandidate, RTCRtpReceiver, MediaStream
 */

import { vi } from "vitest";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FakeTransceiver {
  setCodecPreferences: ReturnType<typeof vi.fn>;
}

export interface RtcStub {
  // Methods
  addTransceiver: ReturnType<typeof vi.fn>;
  createOffer: ReturnType<typeof vi.fn>;
  setLocalDescription: ReturnType<typeof vi.fn>;
  setRemoteDescription: ReturnType<typeof vi.fn>;
  addIceCandidate: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;

  // Event handler slots
  onicecandidate: ((event: { candidate: RTCIceCandidate | null }) => void) | null;
  ontrack: ((event: Partial<RTCTrackEvent>) => void) | null;
  onconnectionstatechange: (() => void) | null;
  ondatachannel: ((event: { channel: Partial<RTCDataChannel> }) => void) | null;

  // Settable props
  connectionState: RTCPeerConnectionState;
  remoteDescription: RTCSessionDescription | null;

  // Test-only emit surface
  emitIceCandidate: (candidate: RTCIceCandidate) => void;
  emitTrack: (event: Partial<RTCTrackEvent>) => void;
  emitConnectionState: (state: RTCPeerConnectionState) => void;
  emitDataChannel: (channel: Partial<RTCDataChannel>) => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a fresh RtcStub. Most promise-returning methods resolve by default.
 * Make specific methods reject for rejection-path tests:
 *   stub.setRemoteDescription.mockRejectedValueOnce(new Error("fail"))
 */
export function makeRtcStub(): RtcStub {
  const fakeTransceiver: FakeTransceiver = {
    setCodecPreferences: vi.fn(),
  };

  const stub: RtcStub = {
    // --- methods ---
    addTransceiver: vi.fn(() => fakeTransceiver),
    createOffer: vi.fn(() => Promise.resolve({ sdp: "<stub-sdp>", type: "offer" as RTCSdpType })),
    setLocalDescription: vi.fn(() => Promise.resolve()),
    setRemoteDescription: vi.fn(() => Promise.resolve()),
    addIceCandidate: vi.fn(() => Promise.resolve()),
    close: vi.fn(),

    // --- handler slots ---
    onicecandidate: null,
    ontrack: null,
    onconnectionstatechange: null,
    ondatachannel: null,

    // --- props ---
    connectionState: "new",
    remoteDescription: null,

    // --- emit surface ---
    emitIceCandidate(candidate: RTCIceCandidate) {
      stub.onicecandidate?.({ candidate });
    },
    emitTrack(event: Partial<RTCTrackEvent>) {
      stub.ontrack?.(event);
    },
    emitConnectionState(state: RTCPeerConnectionState) {
      stub.connectionState = state;
      stub.onconnectionstatechange?.();
    },
    emitDataChannel(channel: Partial<RTCDataChannel>) {
      stub.ondatachannel?.({ channel });
    },
  };

  return stub;
}

// ---------------------------------------------------------------------------
// Global installer
// ---------------------------------------------------------------------------

/**
 * The most recently constructed stub via the RTCPeerConnection constructor
 * installed by installRtcGlobals(). Tests grab it as:
 *   const stub = lastStub();
 *
 * Scoped to the current installRtcGlobals/restoreRtcGlobals pair — reset on
 * both install and restore so it cannot leak across test files or between
 * beforeEach/afterEach cycles.
 */
let _lastStub: RtcStub | null = null;
export function lastStub(): RtcStub | null {
  return _lastStub;
}

// Names of the globals this helper installs — used for targeted restoration.
const STUBBED_GLOBALS = [
  "RTCPeerConnection",
  "RTCSessionDescription",
  "RTCIceCandidate",
  "RTCRtpReceiver",
  "MediaStream",
] as const;

// Saved original values, set during installRtcGlobals and consumed by
// restoreRtcGlobals. Typed as unknown because these globals are undefined in
// jsdom and we just need to round-trip the original value.
let _savedGlobals: Record<string, unknown> = {};

/**
 * Install WebRTC globals that jsdom does not provide. Call in beforeEach (or
 * at the top of the describe block) of any test file that exercises WebRTC hooks.
 * Pair with restoreRtcGlobals() in afterEach.
 *
 * RTCPeerConnection is installed as a constructor-factory: each `new RTCPeerConnection()`
 * call creates a fresh RtcStub and stores it in lastStub() so tests can reach it.
 */
export function installRtcGlobals(): void {
  // Reset stub tracker so previous test-file state cannot bleed in.
  _lastStub = null;

  // Save originals before overwriting so restoreRtcGlobals can do a targeted
  // restore without touching globals owned by other infrastructure.
  for (const name of STUBBED_GLOBALS) {
    _savedGlobals[name] = (globalThis as Record<string, unknown>)[name];
  }

  // RTCPeerConnection — constructor that always returns a fresh stub
  function FakeRTCPeerConnection(_config?: RTCConfiguration) {
    const stub = makeRtcStub();
    _lastStub = stub;
    return stub;
  }
  vi.stubGlobal("RTCPeerConnection", FakeRTCPeerConnection);

  // RTCSessionDescription — simple passthrough constructor
  function FakeRTCSessionDescription(init: RTCSessionDescriptionInit) {
    return { type: init.type, sdp: init.sdp ?? "" };
  }
  vi.stubGlobal("RTCSessionDescription", FakeRTCSessionDescription);

  // RTCIceCandidate — simple passthrough constructor
  function FakeRTCIceCandidate(init: RTCIceCandidateInit) {
    return {
      candidate: init.candidate ?? "",
      sdpMid: init.sdpMid ?? null,
      sdpMLineIndex: init.sdpMLineIndex ?? null,
    };
  }
  vi.stubGlobal("RTCIceCandidate", FakeRTCIceCandidate);

  // RTCRtpReceiver — only getCapabilities is needed; returns null (code null-guards)
  vi.stubGlobal("RTCRtpReceiver", {
    getCapabilities: vi.fn((_kind: string) => null),
  });

  // MediaStream — minimal stub; usePeerConnection falls back to new MediaStream([track])
  function FakeMediaStream(_tracks?: MediaStreamTrack[]) {
    return { id: "fake-stream", getTracks: () => [] };
  }
  vi.stubGlobal("MediaStream", FakeMediaStream);
}

/**
 * Restore ONLY the globals stubbed by installRtcGlobals(). Call in afterEach.
 *
 * Uses targeted restoration (vi.stubGlobal back to saved originals) instead of
 * vi.unstubAllGlobals() to avoid nuking globals installed by other test
 * infrastructure running in the same worker.
 */
export function restoreRtcGlobals(): void {
  _lastStub = null;
  for (const name of STUBBED_GLOBALS) {
    vi.stubGlobal(name, _savedGlobals[name]);
  }
  _savedGlobals = {};
}
