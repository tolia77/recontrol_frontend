/**
 * Smoke test for useWebRtc (composer hook).
 *
 * The composer's value lives in the leaf-hook tests (usePeerConnection,
 * useWebRtcSignaling). This test only verifies that the flat surface
 * returned by useWebRtc contains the keys documented in UseWebRtcReturn.
 * Internal sub-hook wiring is intentionally NOT asserted here.
 */

import { renderHook, act, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installRtcGlobals, restoreRtcGlobals } from "./__tests__/rtcStub";

// -----------------------------------------------------------------------
// Module mocks — required because sub-hooks call these modules
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

import { useWebRtc } from "./useWebRtc";

// -----------------------------------------------------------------------
// Suite
// -----------------------------------------------------------------------

describe("useWebRtc (composer smoke test)", () => {
  beforeEach(() => {
    installRtcGlobals();
  });

  afterEach(() => {
    act(() => {});
    cleanup();
    vi.restoreAllMocks();
    restoreRtcGlobals();
  });

  it("returns the flat surface with all expected keys", () => {
    const sendMessage = vi.fn();
    const { result } = renderHook(() => useWebRtc({ sendMessage }));

    const surface = result.current;

    // Peer connection lifecycle (usePeerConnection)
    expect(surface.startWebRtc).toBeTypeOf("function");
    expect(surface.stopWebRtc).toBeTypeOf("function");
    expect(surface.retryWebRtc).toBeTypeOf("function");
    expect(surface.connectionState).toBeDefined();
    expect(surface.hasReceivedFrame).toBeDefined();
    expect(surface.videoRef).toBeDefined();
    expect(surface.setVideoNode).toBeTypeOf("function");
    expect(surface.pcRef).toBeDefined();
    expect(surface.desktopStatsRef).toBeDefined();

    // Signaling (useWebRtcSignaling)
    expect(surface.handleSignalingMessage).toBeTypeOf("function");

    // Data channels (useDataChannels)
    expect(surface.filesCtlRef).toBeDefined();
    expect(surface.filesCtlOpen).toBeDefined();
    expect(surface.clipboardCtlOpen).toBeDefined();
  });
});
