import { vi } from "vitest";

export interface ChannelCallbacks {
  received?: (data: unknown) => void;
  connected?: (meta?: { reconnected: boolean }) => void;
  disconnected?: (meta?: { willAttemptReconnect: boolean }) => void;
  rejected?: () => void;
}

export interface MockSubscription {
  perform: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
  unsubscribe: ReturnType<typeof vi.fn>;
}

export interface MockConsumer {
  subscriptions: {
    create: (
      params: { channel: string } & Record<string, unknown>,
      callbacks: ChannelCallbacks,
    ) => MockSubscription;
  };
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  connection: {
    monitor: { isRunning: () => boolean };
    events: Record<string, ((event?: unknown) => void) | undefined>;
  };
  /** Test-only registry of created subscriptions. */
  records: Array<{
    channel: string;
    params: Record<string, unknown>;
    callbacks: ChannelCallbacks;
    sub: MockSubscription;
  }>;
  emitReceived: (channel: string, payload: unknown) => void;
  emitConnected: (channel: string, reconnected?: boolean) => void;
  emitDisconnected: (channel: string, willAttemptReconnect: boolean) => void;
  emitRejected: (channel: string) => void;
  /** Drive the connection-level close handler useCableConsumer installs. */
  emitConnectionClose: (willAttemptReconnect: boolean) => void;
}

export function makeMockConsumer(): MockConsumer {
  const records: MockConsumer["records"] = [];
  let monitorRunning = true;

  const forEachSub = (channel: string, fn: (cb: ChannelCallbacks) => void) =>
    records.filter((r) => r.channel === channel).forEach((r) => fn(r.callbacks));

  const consumer: MockConsumer = {
    subscriptions: {
      create: (params, callbacks) => {
        const sub: MockSubscription = {
          perform: vi.fn(),
          send: vi.fn(),
          unsubscribe: vi.fn(),
        };
        records.push({ channel: params.channel, params, callbacks, sub });
        return sub;
      },
    },
    connect: vi.fn(() => {
      monitorRunning = true;
    }),
    disconnect: vi.fn(() => {
      monitorRunning = false;
    }),
    connection: {
      monitor: { isRunning: () => monitorRunning },
      events: {},
    },
    records,
    emitReceived: (channel, payload) => forEachSub(channel, (cb) => cb.received?.(payload)),
    emitConnected: (channel, reconnected = false) =>
      forEachSub(channel, (cb) => cb.connected?.({ reconnected })),
    emitDisconnected: (channel, willAttemptReconnect) => {
      // Keep the monitor signal in sync with willAttemptReconnect so a reconnect
      // path exercised after an explicit disconnect() does not read stale state.
      monitorRunning = willAttemptReconnect;
      forEachSub(channel, (cb) => cb.disconnected?.({ willAttemptReconnect }));
    },
    emitRejected: (channel) => forEachSub(channel, (cb) => cb.rejected?.()),
    emitConnectionClose: (willAttemptReconnect) => {
      monitorRunning = willAttemptReconnect;
      consumer.connection.events.close?.call(consumer.connection);
    },
  };
  return consumer;
}
