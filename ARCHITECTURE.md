# Architecture and Design Decisions

This document covers the technical design of the Super Productivity → Toggl Track Sync plugin: why it is structured the way it is, what tradeoffs were made, and how the pieces fit together.

---

## Overview

The plugin is a single-page TypeScript project that bundles to one IIFE JavaScript file (`dist/plugin.js`). Super Productivity loads the file directly, injects a global `PluginAPI` object, and calls registered hooks as the user works.

```
Super Productivity runtime
  │
  ├── injects PluginAPI global
  ├── calls registerConfigHandler callback  ← opens settings dialog
  └── calls currentTaskChange hook          ← fires on every task switch
        │
        └── sync-engine.ts
              ├── resolves project ID (SP project map or fallback)
              ├── stops previous Toggl entry (toggl-client.ts)
              └── starts new Toggl entry    (toggl-client.ts)
```

---

## Module breakdown

### `src/index.ts` — entry point

Registers all hooks synchronously, then kicks off an async data load. The hooks must be registered before any async work because SP may fire them immediately after loading the plugin file.

```
registerConfigHandler(openSettingsDialog)   // sync
registerHook('currentTaskChange', handler)  // sync
loadPluginData()                            // async, resolves in background
```

If data loads after the first hook fires, the hook handler calls `loadSettings()` which reads from the in-memory store. Since `loadPluginData` populates that store before any awaits complete, the race window is negligible in practice (the user cannot switch tasks in the milliseconds between plugin load and data load).

---

### `src/storage.ts` — single source of truth

All persistent state lives in one JSON blob serialized through `PluginAPI.persistDataSynced` / `PluginAPI.loadSyncedData`. The shape is:

```typescript
interface PluginData {
  settings: PluginSettings | null;
  mappings: MappingStore;         // { version: 1, entries: Record<string, TaskMapping> }
}
```

**Decision: one blob, not multiple keys.** SP's plugin storage API exposes a single string slot (`loadSyncedData` / `persistDataSynced`). Splitting state across multiple calls would require serializing and deserializing twice and introduce partial-write failure modes. One JSON object is simpler and atomic.

**Decision: in-memory cache.** All reads go to `_data` (a module-level variable). Writes update `_data` then call `persistDataSynced`. This means there is never an async read on the hot path (task change events). Storage is only async on writes.

---

### `src/mapping-store.ts` — task-to-entry mapping

Tracks which Toggl entry ID corresponds to each SP task ID, and the entry's current status (`running`, `stopped`, `error`).

```typescript
interface TaskMapping {
  spTaskId: string;
  togglEntryId: number;
  status: 'running' | 'stopped' | 'error';
  startedAt: string;
  stoppedAt: string | null;
}
```

**Decision: persist mappings.** If SP or the machine restarts while a Toggl entry is running, we need the entry ID to stop it correctly on the next task change. Without persistence, we would leak open Toggl entries on every restart.

**Decision: keyed by SP task ID.** Lookups on task change are O(1). The mapping grows slowly (one entry per task ever worked on) and is never pruned in the current implementation — an acceptable tradeoff at MVP scale.

---

### `src/types.ts` — shared interfaces and PluginAPI declaration

All TypeScript interfaces live here. The `PluginAPI` global is declared with `declare global` so every module can use it without importing anything. The shape is a minimal subset of what SP actually exposes — only the methods this plugin uses.

**Decision: minimal PluginAPI declaration.** Declaring the full SP plugin API would require maintaining a separate type package. Declaring only what we call is accurate, self-documenting, and avoids false type safety on untested surface area.

---

### `src/toggl-client.ts` — Toggl API wrapper

Three exported functions:

| Function | HTTP call | Purpose |
|----------|-----------|---------|
| `fetchTogglProjects` | `GET /workspaces/{wid}/projects` | Fetch active projects for name matching |
| `startEntry` | `POST /workspaces/{wid}/time_entries` | Create a running entry |
| `stopEntry` | `PATCH /workspaces/{wid}/time_entries/{id}/stop` | Stop a specific entry by ID |
| `stopCurrentRunningEntry` | `PATCH /me/time_entries/current/stop` | Stop whatever is running (used for "stop existing timer" option) |

All calls go through a shared `togglRequest` helper that:
- Adds the `Authorization: Basic` header (base64 of `token:api_token`)
- Logs the method and URL at debug level
- Parses the response as JSON (or falls back to raw text)
- Never throws — returns `{ ok: false, status: 0 }` on network errors

**Decision: never throw from togglRequest.** The sync engine always checks `result.ok` and surfaces errors via `PluginAPI.showSnack`. Unhandled promise rejections in a plugin context can silently kill the hook handler.

**Decision: `startEntry` accepts an explicit `projectId` parameter.** Early versions read `settings.defaultProjectId` directly. When project mapping was added, passing `projectId` as a parameter made `startEntry` a pure function of its inputs, with the resolution logic cleanly isolated in `sync-engine.ts`.

---

### `src/sync-engine.ts` — core logic

Handles `currentTaskChange` events. The event payload is either an `SPTask` object (a task became active) or `null` (the user stopped tracking).

The engine keeps one piece of in-memory state: `_previousTaskId`. This is needed because the `currentTaskChange` payload only contains the *new* active task, not the task that just stopped.

**Flow on each event:**

```
1. Load settings — bail early if not configured
2. STOP phase:
   a. Look up _previousTaskId in mapping store
   b. If status === 'running', call stopEntry(togglEntryId)
   c. Update mapping status to 'stopped' or 'error'
   d. Persist
3. START phase (only if task !== null):
   a. Guard: if task already has a running mapping, skip (dedup)
   b. If stopExistingTogglTimer, call stopCurrentRunningEntry
   c. Resolve projectId: spToTogglProjectMap[task.projectId] ?? defaultProjectId
   d. Call startEntry(settings, task, projectId)
   e. Write new mapping with status 'running'
   f. Persist
```

**Decision: stop before start.** Stopping first ensures the previous entry gets the correct end time even if the start call fails.

**Decision: dedup guard on start.** Without it, a double-fire of `currentTaskChange` for the same task would create two open Toggl entries with no way to stop the first one.

---

### `src/settings.ts` — settings dialog and project sync

Builds and opens a settings dialog using `PluginAPI.openDialog`. The dialog is plain HTML injected as a string — SP renders it in an Angular Material dialog.

**Settings saved:**

```typescript
interface PluginSettings {
  togglApiToken: string;
  workspaceId: number;
  defaultProjectId: number | null;
  defaultBillable: boolean;
  tag: string | null;
  stopExistingTogglTimer: boolean;
  spToTogglProjectMap: Record<string, number>; // spProjectId → togglProjectId
}
```

**Project sync flow (triggered by "Sync Projects by Name" button):**

```
fetchTogglProjects(settings)   → GET /workspaces/{wid}/projects, filter active:true
PluginAPI.getAllProjects()      → SP project list [{id, title}]

Build Map<lowerName, togglId> from Toggl projects
For each SP project:
  if lowerName match found → add spId → togglId to map
Save map into settings.spToTogglProjectMap
```

The entire map is rebuilt on every sync — no merging with the previous map. This means renamed or deleted projects are automatically cleaned up.

**Decision: unlimited project mapping.** The map is a plain JavaScript object with no imposed size limit. All SP projects and all Toggl projects are processed in a single pass regardless of count.

**Decision: `setTimeout(..., 100)` to wire the Sync button.** `PluginAPI.openDialog` renders the HTML asynchronously. The button does not exist in the DOM at the time `openDialog` returns, so the event listener is attached after a short delay. A proper solution would use a `MutationObserver`, but the 100ms delay is reliable in practice and much simpler.

**Decision: preserve `spToTogglProjectMap` on Save.** The Save button reads the current stored map and writes it back unchanged. This means clicking Save does not wipe out a previously synced project map even if the user never re-clicks Sync.

---

## Build system

**esbuild** bundles `src/index.ts` and all its imports into a single IIFE targeting ES2020 browsers. No framework, no runtime dependencies — the output is entirely self-contained.

```
npm run build       → dist/plugin.js (~15 KB unminified)
npm run build:prod  → dist/plugin.js (~8 KB minified)
npm run watch       → incremental rebuild on file change
npm run typecheck   → tsc --noEmit (type check only, no emit)
```

**Decision: esbuild over webpack/rollup.** esbuild is an order of magnitude faster and requires zero configuration for this use case. The plugin has no CSS, no assets, no code splitting, and no tree-shaking requirements beyond what esbuild provides by default.

**Decision: IIFE format.** SP loads the plugin as a script tag, not a module. IIFE wraps all code in a function scope, preventing accidental globals and matching how SP expects plugins to behave.

**Decision: ES2020 target.** SP's Electron shell and supported browser versions all support ES2020. Targeting lower would require transpiling optional chaining and nullish coalescing, adding ~2 KB to the bundle for no benefit.

---

## Data flow diagram

```
SP task switch
    │
    ▼
currentTaskChange hook (index.ts)
    │
    ▼
onCurrentTaskChange (sync-engine.ts)
    ├── loadSettings() ──────────────────── storage.ts (in-memory read)
    ├── getMapping(previousTaskId) ────────  mapping-store.ts (in-memory read)
    ├── stopEntry(togglEntryId) ──────────── toggl-client.ts → PATCH Toggl API
    ├── setMapping({status:'stopped'}) ──── mapping-store.ts (in-memory write)
    ├── saveMappingStore() ──────────────── storage.ts → PluginAPI.persistDataSynced
    ├── resolveProjectId(settings, task)
    │     └── spToTogglProjectMap[task.projectId] ?? defaultProjectId
    ├── startEntry(settings, task, pid) ─── toggl-client.ts → POST Toggl API
    ├── setMapping({status:'running'}) ──── mapping-store.ts (in-memory write)
    └── saveMappingStore() ──────────────── storage.ts → PluginAPI.persistDataSynced
```

---

## Tradeoffs and known limitations

| Area | Current behavior | Alternative not taken |
|------|-----------------|----------------------|
| Sync direction | SP → Toggl only | Bidirectional would require polling Toggl and interpreting changes back into SP tasks |
| Project mapping | By name, rebuilt on demand | Could auto-sync on every settings save, but the button makes the action explicit |
| Mapping cleanup | Entries accumulate forever | Could prune mappings older than N days; deferred as a future improvement |
| Stop-on-stop | No Toggl stop when user closes SP without stopping a task | Would require an unload hook; not available in the SP plugin API |
| Error recovery | Shows a snack, sets status to 'error' | Could auto-retry on transient failures; adds complexity for uncommon cases |
| Multi-workspace | Single workspace only | Supporting multiple workspaces would require restructuring settings |
