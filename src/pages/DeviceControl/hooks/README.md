# DeviceControl Hooks

This directory contains all hooks used exclusively by the `DeviceControl` feature.
No current hook is imported outside of this feature — "shared" here means
**shared across DeviceControl components and sub-hooks**, not app-wide.
If a hook ever needs to be consumed outside DeviceControl, promote it to the
top-level `src/hooks/` directory at that point.

## Folder Layout (D-14)

Realized layout as of Phase 26 Plan 05.

```
hooks/
├── README.md             ← this file
│
├── realtime/             ← transport + channel + WebRTC hooks
│   ├── useDeviceSocket.ts          full WS lifecycle + onmessage dispatcher (D-04/D-06/D-07)
│   ├── useWebRtc.ts                peer connection composer — returns flat UseWebRtcReturn (D-08)
│   ├── usePeerConnection.ts        peer lifecycle sub-unit (D-09)
│   ├── useWebRtcSignaling.ts       signaling sub-unit (D-09)
│   ├── useDataChannels.ts          files + clipboard data-channel sub-unit (D-09)
│   ├── useClipboardSync.ts         clipboard RTCDataChannel sync; options-object signature
│   ├── useFilesChannel.ts          derived files-channel status; documented exception (D-13)
│   ├── useAssistantChannel.ts      raw-ws subscriber; options-object signature (D-11)
│   ├── useScenarioRunChannel.ts    raw-ws subscriber; options-object signature (D-11)
│   ├── useOrderedBroadcast.ts      shared seq-ordered reorder buffer base hook (D-12)
│   └── useStreamStats.ts           RTCPeerConnection frame-rate / encoder stats
│
├── state/                ← feature state sub-hooks (each owns a coherent state slice)
│   ├── usePermissions.ts           permissions + buildPermissions + canSend (D-01/D-03)
│   ├── useTerminalSession.ts       terminalResults + processes + processesLoading (D-01)
│   ├── useStreamControls.ts        showStats + currentFps + currentResolution (D-01)
│   ├── useFileManagerState.ts      file manager panel persistent state (localStorage)
│   ├── useTransferQueue.ts         transfer queue snapshot subscriber
│   ├── useFileManagerSelection.ts  Windows-Explorer-style multi-selection state machine
│   └── useFilesRoots.ts            file system roots listing (depends on realtime/useFilesChannel)
│
├── files/                ← FileManager I/O operation hooks (upload, download, drag-drop, CRUD)
│   ├── useFileUpload.ts            sequential batch upload loop + large-file/conflict gates
│   ├── useFileDownload.ts          download capability gate + large-file routing
│   ├── useFileDragDrop.ts          drag-depth counter + native addEventListener drag effect
│   └── useFileOperations.ts        mkdir/rename/delete/move/copy over the files-ctl channel
│
└── (top-level, cross-cutting)      ← hooks used by multiple DeviceControl concerns
    ├── useClipboardCapability.ts   one-shot browser Clipboard API capability detection
    ├── useKeyboardShortcuts.ts     keyboard shortcut bindings for file manager panel
    ├── useRefusalToastThrottle.ts  throttled clipboard-refusal toast firing
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

### `files/`
Hooks that encapsulate FileManager I/O operations (upload, download, drag-drop, CRUD
operations over the files-ctl channel). These hooks orchestrate protocol calls and
transfer-queue interactions; they dispatch against the `fileManagerUiReducer` for
dialog/flow state. The four existing `state/` FileManager hooks
(`useFileManagerState`, `useFileManagerSelection`, `useFilesRoots`, `useTransferQueue`)
stay in `state/` because they own coherent state slices, not I/O operations.

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

---

See the consolidated frontend conventions reference: [`CONVENTIONS.md`](../../../CONVENTIONS.md) (naming, component placement, export style, state-management rule).
