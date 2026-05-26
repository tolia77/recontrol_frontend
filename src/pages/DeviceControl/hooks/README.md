# DeviceControl Hooks

This directory contains all hooks used exclusively by the `DeviceControl` feature.
No current hook is imported outside of this feature — "shared" here means
**shared across DeviceControl components and sub-hooks**, not app-wide.
If a hook ever needs to be consumed outside DeviceControl, promote it to the
top-level `src/hooks/` directory at that point.

## Folder Layout (D-14)

This is the **target layout** for Phase 26. Files are relocated incrementally across
Phase 26 plans; not all files have physically moved yet.

```
hooks/
├── README.md             ← this file
│
├── realtime/             ← transport + channel + WebRTC hooks
│   ├── useDeviceSocket.ts          (new — Plan 02) full WS lifecycle + onmessage dispatcher
│   ├── useWebRtc.ts                (moved — Plan 03/04) peer connection + signaling + data channels
│   ├── usePeerConnection.ts        (new internal — Plan 03/04) peer lifecycle sub-unit
│   ├── useWebRtcSignaling.ts       (new internal — Plan 03/04) signaling sub-unit
│   ├── useDataChannels.ts          (new internal — Plan 03/04) files + clipboard data-channel sub-unit
│   ├── useClipboardSync.ts         (moved — Plan 05) clipboard RTCDataChannel sync
│   ├── useFilesChannel.ts          (moved — Plan 05) derived files-channel status
│   ├── useAssistantChannel.ts      (moved — Plan 02/05) raw-ws subscriber, options-object signature
│   ├── useScenarioRunChannel.ts    (moved — Plan 02/05) raw-ws subscriber, options-object signature
│   └── useOrderedBroadcast.ts      (new — Plan 02) shared seq-ordered reorder buffer base hook
│
├── state/                ← feature state sub-hooks (each owns a coherent state slice)
│   ├── usePermissions.ts           (new — Plan 01) permissions + buildPermissions + canSend
│   ├── useTerminalSession.ts       (new — Plan 01) terminalResults + processes + processesLoading
│   ├── useStreamControls.ts        (new — Plan 01) showStats + currentFps + currentResolution
│   ├── useFileManagerState.ts      (moved — Plan 05) file manager panel persistent state
│   └── useTransferQueue.ts         (moved — Plan 05) transfer queue snapshot
│
└── (top-level, cross-cutting)      ← hooks used by multiple DeviceControl concerns
    ├── useStreamStats.ts           RTCPeerConnection frame-rate / encoder stats
    ├── useClipboardCapability.ts   one-shot browser Clipboard API capability detection
    ├── useKeyboardShortcuts.ts     keyboard shortcut bindings for panel toggles
    ├── useRefusalToastThrottle.ts  throttled clipboard-refusal toast firing
    ├── useFileManagerSelection.ts  file manager selection state
    ├── useFilesRoots.ts            file system roots listing
    └── selectPillState.ts          pure selector (not a React hook) for clipboard pill state
```

## Grouping Rules

### `realtime/`
Hooks that connect to a live transport (WebSocket or WebRTC data channel) or derive
state from one. Includes:
- The WebSocket lifecycle hook (`useDeviceSocket`)
- The WebRTC peer-connection and data-channel hooks (`useWebRtc` and its internal units)
- Raw WebSocket subscriber hooks (`useAssistantChannel`, `useScenarioRunChannel`)
- Hooks that react to WebRTC channel state (`useClipboardSync`, `useFilesChannel`)
- The shared ordered-broadcast base (`useOrderedBroadcast`)

### `state/`
Hooks that own a coherent slice of DeviceControl feature state, expose typed setters,
and have no direct dependency on a live transport. The dispatcher in `useDeviceSocket`
writes into these via **injected callbacks** (D-06) — the state hooks themselves stay
transport-agnostic.

### Top-level `hooks/`
Hooks that are genuinely cross-cutting within DeviceControl: either they straddle both
realtime and state concerns, or they serve multiple unrelated sub-components. A utility
function that happens to call a React hook but isn't cleanly a state slice or transport
subscriber also lives here.

## State Sub-Hook Pattern (D-01 / D-02)

Each `state/` hook follows the same shape (modeled on `useFileManagerState`):

```typescript
export interface UseXReturn { /* typed fields */ }

/**
 * Owns the <X> state slice for DeviceControl. Per D-01.
 */
export function useX(): UseXReturn {
  // plain useState (D-02: useReducer only if transitions are genuinely interrelated)
  return useMemo(() => ({ ...fields, ...callbacks }), [...deps]);
}
```

The orchestrator (`DeviceControl.tsx`) calls each state sub-hook and composes their
returns, passing relevant callbacks to `useDeviceSocket` as injected callbacks.

## Channel Hook Pattern (D-11)

Raw WebSocket subscriber hooks in `realtime/` follow an options-object signature:

```typescript
export function useAssistantChannel({ socket, onBroadcast }: UseAssistantChannelOptions) { ... }
```

Documented exceptions (D-13):
- `useWebRtc` — peer-connection driven, takes `{ sendMessage }` (not a raw subscriber)
- `useFilesChannel` — derived-status hook, takes positional args from `UseWebRtcReturn`
