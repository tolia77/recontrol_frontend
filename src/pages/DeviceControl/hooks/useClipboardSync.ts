import { useCallback, useEffect, useRef, useState } from 'react';
import type { ClipboardLoopGate } from '../services/clipboard';
import {
  bindFocusVisibilityListeners,
  decideInbound,
  prepareOutbound,
} from '../services/clipboard';
import { ClipboardChannelClient } from '../services/clipboard';
import type { WebRtcConnectionState } from './useWebRtc';

export type ClipboardSyncStatus = 'idle' | 'permission-required' | 'unsupported' | 'paused';

export interface UseClipboardSync {
  isPaused: boolean;
  togglePause: () => void;
  status: ClipboardSyncStatus;
  lastSyncAt: number | null;
}

export interface UseClipboardSyncArgs {
  pcRef: React.RefObject<RTCPeerConnection | null>;
  connectionState: WebRtcConnectionState;
  clipboardCtlRef: React.RefObject<RTCDataChannel | null>;
  clipboardOriginIdRef: React.RefObject<string | null>;
  loopGate: ClipboardLoopGate;
  lastRemoteApplyTimeRef: React.MutableRefObject<number>;
}

export function useClipboardSync(args: UseClipboardSyncArgs): UseClipboardSync {
  const [isPaused, setIsPaused] = useState(false);
  const [status, setStatus] = useState<ClipboardSyncStatus>('idle');
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);

  const isPausedRef = useRef(isPaused);
  const seqRef = useRef(0);
  const clientRef = useRef<ClipboardChannelClient | null>(null);
  const statusRef = useRef(status);

  // Keep refs in sync with state so async callbacks read live values.
  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  // Expose a stable nextSeq for prepareOutbound.
  const nextSeq = useCallback(() => {
    seqRef.current += 1;
    return seqRef.current;
  }, []);

  const togglePause = useCallback(() => setIsPaused((p) => !p), []);

  // ---- Outbound: focus / visibilitychange driven readText -> envelope ----
  const maybeReadAndPush = useCallback(async () => {
    if (args.connectionState !== 'connected') return;
    const dc = args.clipboardCtlRef.current;
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
      if (now - args.lastRemoteApplyTimeRef.current < 1000) {
        console.log('[clipboard] skipped focus-read due to recent remote write');
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
        lastRemoteApplyTimeMs: args.lastRemoteApplyTimeRef.current,
        loopGate: args.loopGate,
        originId: args.clipboardOriginIdRef.current,
      },
      nextSeq,
    );

    if (decision.kind === 'send') {
      if (clientRef.current) {
        clientRef.current.send(decision.envelope);
        setLastSyncAt(Date.now());
        if (statusRef.current === 'permission-required') setStatus('idle');
      }
    }
  }, [args, nextSeq]);

  // ---- Inbound: subscribe to ClipboardChannelClient on dc 'open' ----
  useEffect(() => {
    if (args.connectionState !== 'connected') return;
    const dc = args.clipboardCtlRef.current;
    if (!dc) return;

    const startSubscription = (): void => {
      if (clientRef.current) clientRef.current.dispose();
      const client = new ClipboardChannelClient(dc);
      clientRef.current = client;
      client.subscribe(async (env) => {
        const decision = await decideInbound(
          env,
          args.clipboardOriginIdRef.current,
          isPausedRef.current,
          args.loopGate,
        );
        if (decision.kind !== 'apply') return;
        // Pitfall 1: RECORD FIRST, THEN WRITE (T-14-34).
        args.loopGate.recordApplied(decision.hashBytes);
        try {
          if (typeof navigator?.clipboard?.writeText !== 'function') {
            setStatus('unsupported');
            return;
          }
          await navigator.clipboard.writeText(decision.text);
          args.lastRemoteApplyTimeRef.current = Date.now();
          setLastSyncAt(Date.now());
          if (statusRef.current === 'permission-required') setStatus('idle');
        } catch {
          setStatus('permission-required');
        }
      });
    };

    if (dc.readyState === 'open') {
      startSubscription();
    } else {
      const onOpen = (): void => {
        startSubscription();
      };
      dc.addEventListener('open', onOpen);
      return () => {
        dc.removeEventListener('open', onOpen);
        clientRef.current?.dispose();
        clientRef.current = null;
      };
    }
    return () => {
      clientRef.current?.dispose();
      clientRef.current = null;
    };
  }, [args.connectionState, args.clipboardCtlRef, args.clipboardOriginIdRef, args.loopGate, args.lastRemoteApplyTimeRef]);

  // ---- Listener registration: window 'focus' + document 'visibilitychange' (DEGRADE-02) ----
  useEffect(() => {
    if (args.connectionState !== 'connected') return;
    const cleanup = bindFocusVisibilityListeners(
      { window, document },
      () => {
        void maybeReadAndPush();
      },
    );
    return cleanup;
  }, [args.connectionState, maybeReadAndPush]);

  const effectiveStatus: ClipboardSyncStatus = isPaused ? 'paused' : status;
  return { isPaused, togglePause, status: effectiveStatus, lastSyncAt };
}
