# Backend Service Placement Convention

This document defines where service modules live and how they are named so new service placement is unambiguous.

## Rules

### 1. Backend resource services — `src/services/backend/`

All services that call the Rails API belong here, named `*Service.ts`.

Examples: `authService.ts`, `devicesService.ts`, `usersService.ts`, `deviceSharesService.ts`,
`permissionsGroupsService.ts`, `turnService.ts`, `scenariosService.ts`, `scenarioRunsService.ts`.

### 2. DeviceControl protocol/feature services — `src/pages/DeviceControl/services/`

Services that implement DeviceControl-specific real-time protocols or UI features live here,
organized in subfolders: `clipboard/`, `files/`, `transfer/`.

### 3. Non-backend feature services — `src/services/<feature>/`

Feature logic that is not a backend API wrapper *and* is shared across multiple pages lives
in a named subfolder under `src/services/`.

If such logic has a single page or component as its only consumer, colocate it with that
consumer instead — e.g. a peer module under `src/pages/<Page>/components/<Feature>/` (as
`irreversibleIntentCatalog.ts` sits beside `PolicyPreviewModal.tsx`). Reserve `src/services/`
for genuinely cross-page features.

### 4. New service placement

Apply the rules in order:
- Calls the Rails REST API → `src/services/backend/*Service.ts`
- DeviceControl real-time protocol or feature → `src/pages/DeviceControl/services/<feature>/`
- Other frontend feature service → `src/services/<feature>/`

---

See the consolidated frontend conventions reference: [`CONVENTIONS.md`](../../CONVENTIONS.md) (naming, component placement, export style, state-management rule).
