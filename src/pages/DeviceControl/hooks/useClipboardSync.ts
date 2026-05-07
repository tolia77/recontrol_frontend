import { useCallback, useEffect, useRef, useState } from 'react';
import type { ClipboardLoopGate } from '../services/clipboard';
import {
  bindFocusVisibilityListeners,
  decideInbound,
  prepareOutbound,
} from '../services/clipboard';
import { ClipboardChannelClient } from '../services/clipboard';
import type {
  ClipboardCapabilitiesEnvelope,
  ClipboardRefusalReason,
} from '../services/clipboard/clipboardProtocol.generated';
import type { ClipboardCapability } from './useClipboardCapability';
import type { WebRtcConnectionState } from './useWebRtc';

export type ClipboardSyncStatus = 'idle' | 'permission-required' | 'unsupported' | 'paused';

export interface UseClipboardSync {
  isPaused: boolean;
  togglePause: () => void;
  status: ClipboardSyncStatus;
  lastSyncAt: number | null;
  // Phase 15 D-10: discrete fields for Phase 16's selectPillState() consumption.
  cachedDesktopCaps: ClipboardCapabilitiesEnvelope | null;
  lastRefusal: { reason: ClipboardRefusalReason; at: number; source: 'remote' | 'local' } | null;
  capsTimedOut: boolean;
}

export interface UseClipboardSyncArgs {
  pcRef: React.RefObject<RTCPeerConnection | null>;
  connectionState: WebRtcConnectionState;
  clipboardCtlRef: React.RefObject<RTCDataChannel | null>;
  clipboardOriginIdRef: React.RefObject<string | null>;
  loopGate: ClipboardLoopGate;
  lastRemoteApplyTimeRef: React.MutableRefObject<number>;
  /**
   * CR-04: clipboard data-channel readyState mirrored as React state so the
   * inbound subscription effect can re-run when the channel actually opens
   * (which fires AFTER connectionState='connected'). Without this state,
   * the effect deps only see ref identity and never re-run.
   */
  clipboardCtlOpen: boolean;
  /**
   * Phase 15 CAP-01 / D-18: browser-side capability detection (from
   * useClipboardCapability) used to construct the outgoing capabilities
   * envelope. Defaults to the same all-false shape useClipboardCapability
   * returns at first render so legacy callers keep type-checking.
   */
  caps?: ClipboardCapability;
}

const DEFAULT_CAPS: ClipboardCapability = { canRead: false, canWrite: false, isSecureContext: false };

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
  const [status, setStatus] = useState<ClipboardSyncStatus>('idle');
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);

  // Phase 15: three new discrete fields for Phase 16's pill (D-10).
  const [cachedDesktopCaps, setCachedDesktopCaps] = useState<ClipboardCapabilitiesEnvelope | null>(null);
  const [lastRefusal, setLastRefusal] = useState<
    { reason: ClipboardRefusalReason; at: number; source: 'remote' | 'local' } | null
  >(null);
  const [capsTimedOut, setCapsTimedOut] = useState(false);

  const isPausedRef = useRef(isPaused);
  const seqRef = useRef(0);
  const clientRef = useRef<ClipboardChannelClient | null>(null);
  const statusRef = useRef(status);

  // Phase 15: refs mirror the new state so async callbacks read live values
  // without stale-closure (Pattern F: dual state + ref mirroring).
  const cachedDesktopCapsRef = useRef(cachedDesktopCaps);
  const lastRefusalRef = useRef(lastRefusal);
  const capsTimedOutRef = useRef(capsTimedOut);
  // D-18 re-advertise tracking: remember last advertised flag pair so we only
  // re-send when the flag combination actually flips (avoids T-15-19 flap-loop).
  const prevSentCapsRef = useRef<{ outboundEnabled: boolean; inboundEnabled: boolean } | null>(null);
  // CR-01: mirror current caps into a ref so buildCapsEnvelope is stable across
  // caps changes. The previous shape listed caps.* in buildCapsEnvelope's deps,
  // which made the inbound-subscribe effect tear down (wiping the cache and
  // restarting the CAP-07 timer) every time useClipboardCapability flipped from
  // initial-false to detected. Splitting into a separate re-advertise effect
  // (below) preserves the channel-lifecycle isolation D-06 demands.
  const capsRef = useRef(caps);
  useEffect(() => {
    capsRef.current = caps;
  }, [caps]);

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

  useEffect(() => {
    capsTimedOutRef.current = capsTimedOut;
  }, [capsTimedOut]);

  // Expose a stable nextSeq for prepareOutbound.
  const nextSeq = useCallback(() => {
    seqRef.current += 1;
    return seqRef.current;
  }, []);

  // Phase 15 D-17 / D-18: build the outgoing capabilities envelope from current
  // browser-side caps detection. Returns null if originId is not yet minted.
  // CR-01: reads `caps` via capsRef so the callback identity is stable across
  // caps flips. The inbound subscribe effect lists this in its deps and must
  // NOT re-run when caps detection resolves -- doing so wipes the cache and
  // restarts the CAP-07 timer (see CR-01 in 15-REVIEW.md).
  const buildCapsEnvelope = useCallback((): ClipboardCapabilitiesEnvelope | null => {
    const originId = clipboardOriginIdRef.current;
    if (!originId) return null;
    const c = capsRef.current;
    return {
      kind: 'capabilities',
      originId,
      outboundEnabled: c.canRead && c.isSecureContext,
      inboundEnabled: c.canWrite && c.isSecureContext,
      maxBytes: 2_000_000,
      protocolVersion: '1.0',
      seq: nextSeq(),
      ts: Date.now(),
    };
  }, [clipboardOriginIdRef, nextSeq]);

  const togglePause = useCallback(() => setIsPaused((p) => !p), []);

  // ---- Outbound: focus / visibilitychange driven readText -> envelope ----
  // WR-10: use explicit primitive/ref deps instead of the entire `args` object.
  // The args object is reconstructed on every parent render via inline destructuring,
  // so `[args, nextSeq]` would re-bind focus/visibilitychange listeners on every
  // render -- the unsubscribe-resubscribe window can drop a focus event.
  const maybeReadAndPush = useCallback(async () => {
    if (connectionState !== 'connected') return;
    const dc = clipboardCtlRef.current;
    if (!dc || dc.readyState !== 'open') return;

    let raw: string | null = null;
    try {
      if (typeof navigator?.clipboard?.readText !== 'function') {
        setStatus('unsupported');
        return;
      }
      // POLICY-06 listener-layer: pause gates BEFORE readText to avoid
      // unnecessary permission prompts while paused.
      if (isPausedRef.current) return;
      if (document.visibilityState !== 'visible') return;
      if (!document.hasFocus()) return; // Pitfall 13
      // DEGRADE-04 dampening pre-check: avoid readText immediately after a remote
      // apply (reduces permission-prompt churn on browsers that prompt every read).
      const now = Date.now();
      if (now - lastRemoteApplyTimeRef.current < 1000) {
        // IN-01: demoted from console.log to console.debug. This branch fires
        // on every focus event during the 1s post-remote-write dampening
        // window -- in normal use that's once per paste -- and the prior level
        // was spamming the production console with no operator value.
        console.debug('[clipboard] skipped focus-read due to recent remote write');
        return;
      }
      raw = await navigator.clipboard.readText();
    } catch {
      // D-12: catch readText rejection -> permission-required. NO permissions.query.
      setStatus('permission-required');
      return;
    }

    const decision = await prepareOutbound(
      {
        rawText: raw,
        isPaused: isPausedRef.current,
        hasFocus: document.hasFocus(),
        visibilityVisible: document.visibilityState === 'visible',
        nowMs: Date.now(),
        lastRemoteApplyTimeMs: lastRemoteApplyTimeRef.current,
        loopGate,
        originId: clipboardOriginIdRef.current,
        cachedDesktopCaps: cachedDesktopCapsRef.current,
        capsTimedOut: capsTimedOutRef.current,
      },
      nextSeq,
    );

    if (decision.kind === 'send') {
      if (clientRef.current) {
        clientRef.current.send(decision.envelope);
        setLastSyncAt(Date.now());
        if (statusRef.current === 'permission-required') setStatus('idle');
        // D-18 re-advertise on permission resolve: a successful readText+send
        // proves canRead is now actually true; if our flag pair flipped from the
        // last advertised, send a fresh capabilities envelope so the desktop
        // unblocks its inbound gate.
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
    } else if (decision.kind === 'refused-local') {
      // D-13 / D-14: surface local refusal to the pill feed. source='local'
      // disambiguates from desktop-replied refused for any future direction-
      // specific UX in Phase 16.
      setLastRefusal({
        reason: decision.reason as ClipboardRefusalReason,
        at: Date.now(),
        source: 'local',
      });
    }
    // CR-01: caps.* read via capsRef so this callback's identity is stable.
  }, [
    connectionState,
    clipboardCtlRef,
    clipboardOriginIdRef,
    loopGate,
    lastRemoteApplyTimeRef,
    nextSeq,
    buildCapsEnvelope,
  ]);

  // ---- Inbound: subscribe to ClipboardChannelClient when channel opens ----
  // CR-04: depend on clipboardCtlOpen state so the effect re-runs when the data
  // channel actually transitions to 'open' (which is normally AFTER
  // connectionState='connected'). The previous version snapshotted
  // clipboardCtlRef.current once and never re-ran when the ref's inner value
  // changed -- silently dropping all inbound clipboard messages.
  useEffect(() => {
    if (connectionState !== 'connected') return;
    if (!clipboardCtlOpen) return;
    const dc = clipboardCtlRef.current;
    if (!dc || dc.readyState !== 'open') return;

    if (clientRef.current) clientRef.current.dispose();
    const client = new ClipboardChannelClient(dc);
    clientRef.current = client;

    // WR-03: reset the per-channel seq counter on every channel-open so the
    // first capabilities envelope is seq=1 and matches the desktop's
    // AttachChannel reset. Without this, the browser-side counter carries
    // across reconnects, breaking log correlation symmetry with the desktop.
    seqRef.current = 0;
    // CR-01: also clear the prev-sent tracker so the first send on the new
    // channel is unconditional (the previous channel's tracker is meaningless
    // here).
    prevSentCapsRef.current = null;

    // Phase 15 D-07 / CAP-07: 2-second timer; if no caps envelope arrives in
    // that window, set capsTimedOut=true so prepareOutbound treats the desktop
    // as a v1.2 client and blocks outbound (D-08). Cleared by either the
    // capabilities-receipt handler below or effect cleanup.
    let capsTimer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
      setCapsTimedOut(true);
      capsTimer = null;
    }, 2000);

    client.subscribe(async (env) => {
      const decision = await decideInbound(
        env,
        clipboardOriginIdRef.current,
        isPausedRef.current,
        loopGate,
      );
      if (decision.kind !== 'apply') return;
      // Pitfall 1: RECORD FIRST, THEN WRITE (T-14-34).
      loopGate.recordApplied(decision.hashBytes);
      try {
        if (typeof navigator?.clipboard?.writeText !== 'function') {
          setStatus('unsupported');
          return;
        }
        await navigator.clipboard.writeText(decision.text);
        lastRemoteApplyTimeRef.current = Date.now();
        setLastSyncAt(Date.now());
        if (statusRef.current === 'permission-required') setStatus('idle');
        // D-18 re-advertise: writeText resolved cleanly -> canWrite is actually
        // true. Re-send caps envelope if the flag pair flipped from the last
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
        setStatus('permission-required');
      }
    });

    // Phase 15 D-06: cache desktop caps + clear timer + flip capsTimedOut back
    // to false. Late-arriving caps unblock outbound cleanly (CONTEXT
    // "Claude's Discretion" recommendation).
    client.subscribeCapabilities((capsEnv: ClipboardCapabilitiesEnvelope) => {
      setCachedDesktopCaps(capsEnv);
      setCapsTimedOut(false);
      if (capsTimer !== null) {
        clearTimeout(capsTimer);
        capsTimer = null;
      }
    });

    // Phase 15 D-11: refusal feed source='remote' for desktop-replied refusals.
    client.subscribeRefused((refusedEnv) => {
      setLastRefusal({
        reason: refusedEnv.reason as ClipboardRefusalReason,
        at: Date.now(),
        source: 'remote',
      });
    });

    // Phase 15 D-17: send browser's capabilities envelope on open. Synchronous
    // (mirrors desktop's WR-06-safe send). Uses optimistic detection from
    // useClipboardCapability output -- D-18 re-advertise covers the case where
    // a permission prompt later flips the actual flag.
    const capsEnvelope = buildCapsEnvelope();
    if (capsEnvelope) {
      client.send(capsEnvelope);
      prevSentCapsRef.current = {
        outboundEnabled: capsEnvelope.outboundEnabled,
        inboundEnabled: capsEnvelope.inboundEnabled,
      };
    }

    return () => {
      if (capsTimer !== null) {
        clearTimeout(capsTimer);
        capsTimer = null;
      }
      // D-06: cache cleared on channel close so a fresh channel re-handshakes
      // from scratch (mirrors Phase 13 D-17 reset philosophy). prevSentCapsRef
      // also reset so the next channel always re-advertises on open.
      setCachedDesktopCaps(null);
      setCapsTimedOut(false);
      prevSentCapsRef.current = null;
      clientRef.current?.dispose();
      clientRef.current = null;
    };
    // CR-01: caps.* are intentionally NOT in this effect's dependency array.
    // The subscribe lifecycle is per-CHANNEL, not per-caps. caps flipping must
    // not tear down the cache, restart the CAP-07 timer, or re-create the
    // client. A separate effect below handles re-advertise on caps change.
  }, [
    connectionState,
    clipboardCtlOpen,
    clipboardCtlRef,
    clipboardOriginIdRef,
    loopGate,
    lastRemoteApplyTimeRef,
    buildCapsEnvelope,
  ]);

  // CR-01 / D-18: dedicated re-advertise effect. Runs whenever the browser-side
  // caps detection flips and a client is currently attached, sending a fresh
  // capabilities envelope WITHOUT touching the inbound subscription, the
  // cached desktop caps, or the CAP-07 timer. This is the per-caps surface
  // that the previous design conflated with channel teardown.
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

  // ---- Listener registration: window 'focus' + document 'visibilitychange' (DEGRADE-02) ----
  useEffect(() => {
    if (connectionState !== 'connected') return;
    const cleanup = bindFocusVisibilityListeners(
      { window, document },
      () => {
        void maybeReadAndPush();
      },
    );
    return cleanup;
  }, [connectionState, maybeReadAndPush]);

  const effectiveStatus: ClipboardSyncStatus = isPaused ? 'paused' : status;
  return {
    isPaused,
    togglePause,
    status: effectiveStatus,
    lastSyncAt,
    cachedDesktopCaps,
    lastRefusal,
    capsTimedOut,
  };
}
