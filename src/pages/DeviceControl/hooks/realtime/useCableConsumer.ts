import { useEffect, useRef, useState } from "react";
import { createConsumer } from "@rails/actioncable";
import { getAccessToken } from "src/utils/auth";
import { refreshAccessTokenOnce } from "src/services/backend/config";

/**
 * Minimal structural view of the parts of an ActionCable consumer this app
 * touches. Lets the channel hooks and tests depend on a small interface rather
 * than the full library type.
 */
export interface CableConsumerLike {
  subscriptions: {
    create: (params: object, callbacks: object) => unknown;
  };
  connect: () => void;
  disconnect: () => void;
  connection: {
    monitor: { isRunning: () => boolean };
    events: Record<string, ((event?: unknown) => void) | undefined>;
  };
}

type CreateConsumerFn = (url: () => string) => CableConsumerLike;

export interface UseCableConsumerReturn {
  consumer: CableConsumerLike | null;
}

/**
 * Owns the single ActionCable consumer for a device session.
 *
 * Auth is connection-level: the backend Connection#connect reads access_token
 * and device_id from the URL query string. We pass a URL *function* so
 * ActionCable re-reads the freshest cached token on every (re)connect.
 *
 * Reactive token refresh (design decision): reconnect with the cached token and
 * only refresh when the backend rejects it. On reject_unauthorized_connection
 * the server sends {type:"disconnect", reason:"unauthorized", reconnect:false};
 * ActionCable then stops the monitor, so the connection-level close fires with
 * monitor.isRunning() === false. We detect that, refresh, and reopen. A
 * transient drop leaves the monitor running, so ActionCable auto-reconnects and
 * we do nothing.
 *
 * This is the ONE place that reaches into ActionCable internals (wrapping the
 * connection-level close handler), kept isolated here on purpose.
 */
export function useCableConsumer(
  wsUrl: string,
  deviceId: string | null,
  createConsumerFn: CreateConsumerFn = createConsumer as unknown as CreateConsumerFn,
): UseCableConsumerReturn {
  const [consumer, setConsumer] = useState<CableConsumerLike | null>(null);
  const handlingAuthRef = useRef(false);

  useEffect(() => {
    if (!deviceId) return;

    const c = createConsumerFn(() => {
      const token = getAccessToken() ?? "";
      return `${wsUrl}?access_token=${encodeURIComponent(token)}&device_id=${encodeURIComponent(deviceId)}`;
    });

    // Shadow the prototype `events` object with an own-property copy so our
    // close wrapper does not mutate Connection.prototype (shared across
    // consumers). installEventHandlers() runs on the first open() — which
    // happens when the first child subscription is created — and reads
    // `this.events`, so this must be set before any subscription. It is: this
    // parent effect runs and calls setConsumer before child hooks mount.
    const originalClose = c.connection.events.close;
    c.connection.events = {
      ...c.connection.events,
      close(this: unknown, event?: unknown) {
        // Preserve ActionCable's own close handling (fires `disconnected` on
        // every subscription).
        originalClose?.call(this, event);
        // willAttemptReconnect === monitor.isRunning(). False => terminal
        // (auth) => refresh + reopen.
        if (!c.connection.monitor.isRunning() && !handlingAuthRef.current) {
          handlingAuthRef.current = true;
          void (async () => {
            try {
              await refreshAccessTokenOnce();
              c.connect(); // re-reads the url function (fresh token), restarts
              // the monitor, and resubscribes all channels on `welcome`.
            } finally {
              handlingAuthRef.current = false;
            }
          })();
        }
      },
    };

    setConsumer(c);
    return () => {
      c.disconnect();
      setConsumer(null);
    };
  }, [wsUrl, deviceId, createConsumerFn]);

  return { consumer };
}
