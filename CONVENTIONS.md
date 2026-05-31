# Frontend Conventions

This document is the single source of truth for how the `recontrol_frontend` codebase is organized.
It covers naming, component placement, export style, and the state-management rule.
Topic-local READMEs (`src/services/backend/README.md`, `src/pages/DeviceControl/hooks/README.md`)
stay as detailed references and link back here.

---

## 1. Naming (CONV-03 / D-11)

### Files

| Kind | Casing | Examples |
|---|---|---|
| React component files | `PascalCase.tsx` | `TopBar.tsx`, `ClipboardPill.tsx` |
| Hook files | `camelCase.ts` | `useStreamControls.ts`, `usePermissions.ts` |
| Utility / service files | `camelCase.ts` | `authService.ts`, `getErrorMessage.ts` |
| Sibling icon collections | `ComponentName.icons.tsx` | `ClipboardPill.icons.tsx` |
| General icon files inside a feature folder | `icons.tsx` | `Assistant/icons.tsx`, `components/icons/` |
| Type declaration files | `camelCase.ts` or co-located | `types.ts`, inside `DeviceControl.tsx` |

The dotted `ComponentName.icons.tsx` sibling-asset pattern is sanctioned — it keeps icon
SVG definitions co-located with the component that owns them without cluttering the folder.

### Identifiers

- **React component identifiers:** `PascalCase` — `function TopBar(...)`, `function ClipboardPill(...)`
- **Hook names:** `use*` prefix, `camelCase` — `useStreamControls`, `usePermissions`
- **Utility / service functions:** `camelCase` — `getErrorMessage`, `buildPermissions`
- **Types and interfaces:** `PascalCase` — `ClipboardPillProps`, `UseWebRtcReturn`
- **Constants:** `UPPER_SNAKE_CASE` — `ACCESS_TOKEN_KEY`, `REFRESH_TOKEN_KEY`

---

## 2. Component Placement (D-01 / D-02 / D-03)

### Rule

Every component lives inside a `components/<Feature>/` subfolder.
The page root holds **only** the orchestrator (`DeviceControl.tsx`) and its shared types (`types.ts`).
No loose component files sit directly in `components/` or at the page root.

### Feature-folder layout (final state after Phase 28 Plan 01)

```
src/pages/DeviceControl/
├── DeviceControl.tsx       ← orchestrator (only file at page root)
├── types.ts                ← shared TS types for this page
│
└── components/
    ├── icons/              ← page-level icon utilities
    ├── Layout/             ← chrome: TopBar, MainContent, QuickActions (D-03)
    ├── Manual/             ← manual-input controls: container + keyboard/mouse/power/terminal (D-02)
    ├── Stream/             ← stream controls: FpsControls, QualityPopover, ResolutionControl, StreamStatsOverlay
    ├── Power/              ← power actions: PowerPopover
    ├── Clipboard/          ← clipboard pill + its icons: ClipboardPill, ClipboardPill.icons.tsx
    ├── Transfer/           ← file-transfer header pill: HeaderTransferPill
    ├── Terminal/           ← terminal-adjacent UI: ProcessesModal
    ├── Assistant/          ← AI assistant panel and sub-components
    ├── FileManager/        ← file manager panel and sub-components
    └── Scenarios/          ← scenarios library, run mode, AI draft
```

### Sub-rules

- **No barrel / index files.** Feature folders have no `index.ts`. Callers import directly
  from the specific file: `import TopBar from "./components/Layout/TopBar"`.
- **Sibling imports stay relative.** Within a feature folder, components import siblings with
  `./` (e.g. `import { ManualKeyboardControls } from "./ManualKeyboardControls"`).
- **Up-tree imports use the `src/*` alias.** Any import that crosses the feature boundary
  uses `src/` not `../../`: `import { Button } from "src/components/ui/Button"`.
- **New components follow the same rule immediately.** There is no "temporary" flat placement.

---

## 3. Export Style (D-04 / D-05)

### Default exports — React component files

Every `.tsx` file that is a React component default-exports exactly one component.

```typescript
// Inline default:
export default function TopBar({ ... }: TopBarProps) { ... }

// Or separate declaration + export (both are acceptable):
function TopBar({ ... }: TopBarProps) { ... }
export default TopBar;
```

### Named exports — hooks, utilities, services, icon collections

Hooks, utility functions, services, and multi-icon files use named exports.

```typescript
// Hook — named:
export function useStreamControls(): UseStreamControlsReturn { ... }

// Service — named:
export async function getMyDevicesRequest(): Promise<Device[]> { ... }

// Icon collection — all named:
export const PauseIcon: React.FC<IconProps> = ({ ... }) => ( ... );
export const ArrowRightIcon: React.FC<IconProps> = ({ ... }) => ( ... );
```

### Co-located Props and types — stay named in the same file

A `Props` interface or local type defined alongside a component stays as a named export
in the same file. Do not force it out to a separate `types.ts`.

```typescript
// Props interface stays here — named export:
export interface ClipboardPillProps {
  webRtcUp: boolean;
  isPaused: boolean;
}

// Component is the default export:
export default function ClipboardPill(props: ClipboardPillProps) { ... }
```

### One exported component per file (D-05)

A component file default-exports exactly one component. If two exported sibling components
exist in one file, split them into separate files. File-private helper components (not
exported) may be co-located.

### Summary table

| Module kind | Export style |
|---|---|
| React component | `export default` |
| Hook (`use*`) | named `export function` |
| Utility function | named `export function` / `export const` |
| Service function | named `export async function` |
| Icon collection file | named `export const` (all icons) |
| Types / interfaces co-located with component | named `export interface` / `export type` |

---

## 4. State Management Rule (CONV-05 / D-09)

This rule documents the precedent established by Phases 26–27. It reflects what the
milestone actually did — not new rules.

### Default: `useState`

Use plain `useState` for all local component and hook state.
The overwhelming majority of DeviceControl hooks follow this pattern.

```typescript
// Correct default — plain useState:
const [showStats, setShowStats] = useState(false);
const [currentFps, setCurrentFps] = useState(30);
```

### `useReducer` — only where transitions genuinely interrelate

Upgrade to `useReducer` only when multiple state fields must transition together
and the valid combinations are non-obvious (i.e. the reducer's case logic encodes
real invariants). Applying `useReducer` to state that can be expressed with independent
`useState` calls adds complexity with no benefit.

**Live examples established by the milestone:**

- `fileManagerUiReducer` (Phase 27) — dialog open/closed, active-operation tracking, and
  conflict-resolution mode interrelate: opening a conflict dialog while an upload is in
  progress requires holding both states consistently.
- `transcriptReducer` (Phase 26) — sequence-ordered assistant message assembly requires
  atomic transitions across buffer + rendered rows + sequence counter.

```typescript
// Only when transitions interrelate — useReducer:
const [state, dispatch] = useReducer(fileManagerUiReducer, initialFileManagerUiState);
```

### `context` — reserved for genuinely cross-cutting shared state

React context is appropriate when state must be consumed by components spread across
independent subtrees with no shared ancestor at a reasonable depth.

As of v1.6, **no DeviceControl hook has been promoted to app-wide context.** All hooks
are DeviceControl-local; the orchestrator (`DeviceControl.tsx`) composes them and passes
data down via props. Promote a hook to context only when a second unrelated feature needs it.

### Decision rule

```
Is state local to one hook or component?      → useState (default)
Do multiple fields transition atomically?     → useReducer (only if invariants are real)
Does cross-feature sharing require context?   → context (only when truly cross-cutting)
```

---

## See also

- `src/pages/DeviceControl/hooks/README.md` — hooks layer layout, grouping rules, sub-hook and channel patterns
- `src/services/backend/README.md` — service placement and naming rules
