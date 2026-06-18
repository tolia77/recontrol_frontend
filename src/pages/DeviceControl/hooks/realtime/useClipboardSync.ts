import { useCallback, useEffect, useRef, useState } from "react";
import type { ClipboardLoopGate } from "src/pages/DeviceControl/services/clipboard/clipboardLoopGate";
import {
  bindFocusVisibilityListeners,
  decideInbound,
  prepareOutbound,
} from "src/pages/DeviceControl/services/clipboard/clipboardCore";
import { ClipboardChannelClient } from "src/pages/DeviceControl/services/clipboard/ClipboardChannelClient";
import type {
  ClipboardCapabilitiesEnvelope,
  ClipboardRefusalReason,
} from "src/pages/DeviceControl/services/clipboard/clipboardProtocol.generated";
import type { ClipboardCapability } from "src/pages/DeviceControl/hooks/useClipboardCapability";
import type { WebRtcConnectionState } from "./useWebRtc";

export type ClipboardSyncStatus =
  | "idle"
  | "permission-required"
  | "unsupported"
  | "paused";

export interface UseClipboardSync {
  isPaused: boolean;
  togglePause: () => void;
  status: ClipboardSyncStatus;
  lastSyncAt: number | null;
  // Discrete fields consumed by selectPillState().
  cachedDesktopCaps: ClipboardCapabilitiesEnvelope | null;
  lastRefusal: {
    reason: ClipboardRefusalReason;
    at: number;
    source: "remote" | "local";
  } | null;
}

export interface UseClipboardSyncArgs {
  pcRef: React.RefObject<RTCPeerConnection | null>;
  connectionState: WebRtcConnectionState;
  clipboardCtlRef: React.RefObject<RTCDataChannel | null>;
  clipboardOriginIdRef: React.RefObject<string | null>;
  loopGate: ClipboardLoopGate;
  lastRemoteApplyTimeRef: React.MutableRefObject<number>;
  /**
   * Clipboard data-channel readyState mirrored as React state so the inbound
   * subscription effect can re-run when the channel actually opens (which fires
   * AFTER connectionState='connected'). Without this state, the effect deps
   * only see ref identity and never re-run.
   */
  clipboardCtlOpen: boolean;
  /**
   * Browser-side capability detection (from useClipboardCapability) used to
   * construct the outgoing capabilities envelope. Defaults to the same all-false
   * shape useClipboardCapability returns at first render so callers that omit it
   * keep type-checking.
   */
  caps?: ClipboardCapability;
}

const DEFAULT_CAPS: ClipboardCapability = {
  canRead: false,
  canWrite: false,
  isSecureContext: false,
};

/**
 * Clipboard sync over the WebRTC data channel.
 *
 * Does NOT subscribe to a raw WebSocket — it uses the clipboard RTCDataChannel
 * via ClipboardChannelClient. pcRef and clipboardCtlRef are the integration
 * surface from useWebRtc.
 */
export function useClipboardSync(args: UseClipboardSyncArgs): UseClipboardSync {
  const {
    connectionState,
    clipboardCtlRef,
    clipboardOriginIdRef,
    loopGate,
    lastRemoteApplyTimeRef,
    clipboardCtlOpen,
    caps = DEFAULT_CAPS,
  } = args;

  const [isPaused, setIsPaused] = useState(false);
  const [status, setStatus] = useState<ClipboardSyncStatus>("idle");
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);

  // Discrete fields consumed by the clipboard pill.
  const [cachedDesktopCaps, setCachedDesktopCaps] =
    useState<ClipboardCapabilitiesEnvelope | null>(null);
  const [lastRefusal, setLastRefusal] = useState<{
    reason: ClipboardRefusalReason;
    at: number;
    source: "remote" | "local";
  } | null>(null);

  const isPausedRef = useRef(isPaused);
  const seqRef = useRef(0);
  const clientRef = useRef<ClipboardChannelClient | null>(null);
  const statusRef = useRef(status);

  // Refs mirror the state so async callbacks read live values without
  // stale-closure.
  const cachedDesktopCapsRef = useRef(cachedDesktopCaps);
  const lastRefusalRef = useRef(lastRefusal);
  // Re-advertise tracking: remember the last advertised flag pair so we only
  // re-send when the flag combination actually flips (avoids a flap-loop).
  const prevSentCapsRef = useRef<{
    outboundEnabled: boolean;
    inboundEnabled: boolean;
  } | null>(null);
  // Mirror current caps into a ref so buildCapsEnvelope is stable across caps
  // changes. Listing caps.* in its deps would make the inbound-subscribe effect
  // tear down (wiping the cache) every time useClipboardCapability flips from
  // initial-false to detected; a separate re-advertise effect (below) keeps the
  // channel lifecycle isolated from caps changes.
  const capsRef = useRef(caps);
  useEffect(() => {
    capsRef.current = caps;
  }, [caps]);

  // Inbound writeText requires document focus on Chrome/Edge. When the user is
  // focused on another window (a VM, the desktop client itself), the apply
  // throws NotAllowedError and the inbound text is dropped. Stash the latest
  // failed apply here and retry from the focus / copy / cut listeners below.
  const pendingInboundRef = useRef<{
    text: string;
    hashBytes: Uint8Array;
  } | null>(null);

  // Keep refs in sync with state so async callbacks read live values.
  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    cachedDesktopCapsRef.current = cachedDesktopCaps;
  }, [cachedDesktopCaps]);

  useEffect(() => {
    lastRefusalRef.current = lastRefusal;
  }, [lastRefusal]);

  // Expose a stable nextSeq for prepareOutbound.
  const nextSeq = useCallback(() => {
    seqRef.current += 1;
    return seqRef.current;
  }, []);

  // Build the outgoing capabilities envelope from current browser-side caps
  // detection. Returns null if originId is not yet minted. Reads `caps` via
  // capsRef so the callback identity is stable across caps flips: the inbound
  // subscribe effect lists this in its deps and must NOT re-run when caps
  // detection resolves, or it wipes the cache.
  const buildCapsEnvelope =
    useCallback((): ClipboardCapabilitiesEnvelope | null => {
      const originId = clipboardOriginIdRef.current;
      if (!originId) return null;
      const c = capsRef.current;
      return {
        kind: "capabilities",
        originId,
        outboundEnabled: c.canRead && c.isSecureContext,
        inboundEnabled: c.canWrite && c.isSecureContext,
        maxBytes: 2_000_000,
        protocolVersion: "1.0",
        seq: nextSeq(),
        ts: Date.now(),
      };
    }, [clipboardOriginIdRef, nextSeq]);

  const togglePause = useCallback(() => setIsPaused((p) => !p), []);

  // Outbound: focus / visibilitychange driven readText -> envelope.
  // Use explicit primitive/ref deps instead of the entire `args` object. The
  // args object is reconstructed on every parent render via inline
  // destructuring, so `[args, nextSeq]` would re-bind focus/visibilitychange
  // listeners every render -- the unsubscribe-resubscribe window can drop a
  // focus event.
  const maybeReadAndPush = useCallback(async () => {
    if (connectionState !== "connected") return;
    const dc = clipboardCtlRef.current;
    if (!dc || dc.readyState !== "open") return;

    let raw: string | null = null;
    try {
      if (typeof navigator?.clipboard?.readText !== "function") {
        setStatus("unsupported");
        return;
      }
      // Pause gates BEFORE readText to avoid unnecessary permission prompts
      // while paused.
      if (isPausedRef.current) return;
      if (document.visibilityState !== "visible") return;
      // writeText/readText require document focus on Chrome/Edge.
      if (!document.hasFocus()) return;
      // Dampening pre-check: avoid readText immediately after a remote apply
      // (reduces permission-prompt churn on browsers that prompt every read).
      const now = Date.now();
      if (now - lastRemoteApplyTimeRef.current < 1000) {
        // console.debug, not console.log: this branch fires on every focus
        // event during the 1s post-remote-write dampening window -- in normal
        // use once per paste -- so a higher level would spam the console.
        console.debug(
          "[clipboard] skipped focus-read due to recent remote write",
        );
        return;
      }
      raw = await navigator.clipboard.readText();
    } catch {
      // readText rejection -> permission-required (no permissions.query call).
      setStatus("permission-required");
      return;
    }

    const decision = await prepareOutbound(
      {
        rawText: raw,
        isPaused: isPausedRef.current,
        hasFocus: document.hasFocus(),
        visibilityVisible: document.visibilityState === "visible",
        nowMs: Date.now(),
        lastRemoteApplyTimeMs: lastRemoteApplyTimeRef.current,
        loopGate,
        originId: clipboardOriginIdRef.current,
        cachedDesktopCaps: cachedDesktopCapsRef.current,
      },
      nextSeq,
    );

    if (decision.kind === "send") {
      if (clientRef.current) {
        clientRef.current.send(decision.envelope);
        setLastSyncAt(Date.now());
        if (statusRef.current === "permission-required") setStatus("idle");
        // Re-advertise on permission resolve: a successful readText+send proves
        // canRead is now actually true; if our flag pair flipped from the last
        // advertised, send a fresh capabilities envelope so the desktop unblocks
        // its inbound gate.
        const c = capsRef.current;
        const desired = {
          outboundEnabled: c.canRead && c.isSecureContext,
          inboundEnabled: c.canWrite && c.isSecureContext,
        };
        if (
          !prevSentCapsRef.current ||
          prevSentCapsRef.current.outboundEnabled !== desired.outboundEnabled ||
          prevSentCapsRef.current.inboundEnabled !== desired.inboundEnabled
        ) {
          const envelope = buildCapsEnvelope();
          if (envelope) {
            clientRef.current.send(envelope);
            prevSentCapsRef.current = desired;
          }
        }
      }
    } else if (decision.kind === "refused-local") {
      // Surface local refusal to the pill feed; source='local' disambiguates
      // from a desktop-replied refusal.
      setLastRefusal({
        reason: decision.reason as ClipboardRefusalReason,
        at: Date.now(),
        source: "local",
      });
    }
    // caps.* read via capsRef so this callback's identity is stable.
  }, [
    connectionState,
    clipboardCtlRef,
    clipboardOriginIdRef,
    loopGate,
    lastRemoteApplyTimeRef,
    nextSeq,
    buildCapsEnvelope,
  ]);

  // Inbound: subscribe to ClipboardChannelClient when the channel opens.
  // Depend on clipboardCtlOpen state so the effect re-runs when the data
  // channel actually transitions to 'open' (normally AFTER
  // connectionState='connected'). Snapshotting clipboardCtlRef.current once
  // would never re-run when the ref's inner value changed -- silently dropping
  // all inbound clipboard messages.
  useEffect(() => {
    if (connectionState !== "connected") return;
    if (!clipboardCtlOpen) return;
    const dc = clipboardCtlRef.current;
    if (!dc || dc.readyState !== "open") return;

    if (clientRef.current) clientRef.current.dispose();
    const client = new ClipboardChannelClient(dc);
    clientRef.current = client;

    // Reset the per-channel seq counter on every channel-open so the first
    // capabilities envelope is seq=1 and matches the desktop's reset. Without
    // this, the browser-side counter carries across reconnects, breaking log
    // correlation symmetry with the desktop.
    seqRef.current = 0;
    // Also clear the prev-sent tracker so the first send on the new channel is
    // unconditional (the previous channel's tracker is meaningless here).
    prevSentCapsRef.current = null;

    client.subscribe(async (env) => {
      const decision = await decideInbound(
        env,
        clipboardOriginIdRef.current,
        isPausedRef.current,
        loopGate,
      );
      if (decision.kind !== "apply") return;
      // Record the applied hash BEFORE writing, so the resulting OS clipboard
      // event is recognized as our own and suppressed by the loop gate.
      loopGate.recordApplied(decision.hashBytes);
      try {
        if (typeof navigator?.clipboard?.writeText !== "function") {
          setStatus("unsupported");
          return;
        }
        await navigator.clipboard.writeText(decision.text);
        lastRemoteApplyTimeRef.current = Date.now();
        setLastSyncAt(Date.now());
        if (statusRef.current === "permission-required") setStatus("idle");
        // Re-advertise: writeText resolved cleanly -> canWrite is actually true.
        // Re-send the caps envelope if the flag pair flipped from the last
        // advertised value.
        const c = capsRef.current;
        const desired = {
          outboundEnabled: c.canRead && c.isSecureContext,
          inboundEnabled: c.canWrite && c.isSecureContext,
        };
        if (
          !prevSentCapsRef.current ||
          prevSentCapsRef.current.outboundEnabled !== desired.outboundEnabled ||
          prevSentCapsRef.current.inboundEnabled !== desired.inboundEnabled
        ) {
          const envelope = buildCapsEnvelope();
          if (envelope) {
            client.send(envelope);
            prevSentCapsRef.current = desired;
          }
        }
      } catch {
        // writeText rejects when the document lacks focus — common when the
        // user is in the VM window. Roll back the loop-gate record (the apply
        // didn't happen, so the OS clipboard event we were suppressing won't
        // fire) and stash the text for retry on focus regain.
        loopGate.reset();
        pendingInboundRef.current = {
          text: decision.text,
          hashBytes: decision.hashBytes,
        };
        setStatus("permission-required");
      }
    });

    // Cache desktop caps on receipt so the pill and outbound gate reflect the
    // desktop's advertised policy.
    client.subscribeCapabilities((capsEnv: ClipboardCapabilitiesEnvelope) => {
      setCachedDesktopCaps(capsEnv);
    });

    // Refusal feed, source='remote' for desktop-replied refusals.
    client.subscribeRefused((refusedEnv) => {
      setLastRefusal({
        reason: refusedEnv.reason as ClipboardRefusalReason,
        at: Date.now(),
        source: "remote",
      });
    });

    // Send the browser's capabilities envelope on open. Uses optimistic
    // detection from useClipboardCapability output -- the re-advertise paths
    // cover the case where a permission prompt later flips the actual flag.
    const capsEnvelope = buildCapsEnvelope();
    if (capsEnvelope) {
      client.send(capsEnvelope);
      prevSentCapsRef.current = {
        outboundEnabled: capsEnvelope.outboundEnabled,
        inboundEnabled: capsEnvelope.inboundEnabled,
      };
    }

    return () => {
      // Cache cleared on channel close so a fresh channel re-handshakes from
      // scratch. prevSentCapsRef is also reset so the next channel always
      // re-advertises on open.
      setCachedDesktopCaps(null);
      prevSentCapsRef.current = null;
      clientRef.current?.dispose();
      clientRef.current = null;
    };
    // caps.* are intentionally NOT in this effect's dependency array: the
    // subscribe lifecycle is per-CHANNEL, not per-caps. caps flipping must not
    // tear down the cache or re-create the client. A separate effect below
    // handles re-advertise on caps change.
  }, [
    connectionState,
    clipboardCtlOpen,
    clipboardCtlRef,
    clipboardOriginIdRef,
    loopGate,
    lastRemoteApplyTimeRef,
    buildCapsEnvelope,
  ]);

  // Dedicated re-advertise effect. Runs whenever the browser-side caps
  // detection flips and a client is currently attached, sending a fresh
  // capabilities envelope WITHOUT touching the inbound subscription or the
  // cached desktop caps.
  useEffect(() => {
    const client = clientRef.current;
    if (!client) return;
    const desired = {
      outboundEnabled: caps.canRead && caps.isSecureContext,
      inboundEnabled: caps.canWrite && caps.isSecureContext,
    };
    if (
      prevSentCapsRef.current &&
      prevSentCapsRef.current.outboundEnabled === desired.outboundEnabled &&
      prevSentCapsRef.current.inboundEnabled === desired.inboundEnabled
    ) {
      return; // unchanged — nothing to advertise
    }
    const env = buildCapsEnvelope();
    if (!env) return;
    client.send(env);
    prevSentCapsRef.current = desired;
  }, [caps.canRead, caps.canWrite, caps.isSecureContext, buildCapsEnvelope]);

  // Retry a previously-failed inbound apply once the document has focus again.
  // No-op when nothing is pending. Resets the gate before recordApplied so a
  // second failure does not poison subsequent outbound for this hash.
  const flushPendingInbound = useCallback(async () => {
    const pending = pendingInboundRef.current;
    if (!pending) return;
    if (typeof navigator?.clipboard?.writeText !== "function") return;
    if (!document.hasFocus() || document.visibilityState !== "visible") return;
    loopGate.recordApplied(pending.hashBytes);
    try {
      await navigator.clipboard.writeText(pending.text);
      pendingInboundRef.current = null;
      lastRemoteApplyTimeRef.current = Date.now();
      setLastSyncAt(Date.now());
      if (statusRef.current === "permission-required") setStatus("idle");
    } catch {
      loopGate.reset();
    }
  }, [loopGate, lastRemoteApplyTimeRef]);

  // Listener registration: window 'focus' + document 'visibilitychange'.
  // Browsers expose no clipboard-change event, and a user controlling a remote
  // desktop in-tab never loses browser focus — so 'copy'/'cut' are also bound
  // here. Without them, Ctrl+C in the browser does not push outbound until the
  // user alt-tabs. The setTimeout(0) defers the read past the 'copy' default
  // action so readText() sees the new clipboard contents. Each trigger flushes
  // any pending inbound apply BEFORE the outbound read so we don't echo the
  // browser's stale clipboard back to the desktop.
  useEffect(() => {
    if (connectionState !== "connected") return;
    const onTrigger = (): void => {
      void (async () => {
        await flushPendingInbound();
        void maybeReadAndPush();
      })();
    };
    const cleanup = bindFocusVisibilityListeners(
      { window, document },
      onTrigger,
    );
    const onCopyOrCut = (): void => {
      setTimeout(onTrigger, 0);
    };
    document.addEventListener("copy", onCopyOrCut);
    document.addEventListener("cut", onCopyOrCut);
    return () => {
      cleanup();
      document.removeEventListener("copy", onCopyOrCut);
      document.removeEventListener("cut", onCopyOrCut);
    };
  }, [connectionState, maybeReadAndPush, flushPendingInbound]);

  const effectiveStatus: ClipboardSyncStatus = isPaused ? "paused" : status;
  return {
    isPaused,
    togglePause,
    status: effectiveStatus,
    lastSyncAt,
    cachedDesktopCaps,
    lastRefusal,
  };
}
