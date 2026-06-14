# Project Document: Super Productivity → Toggl Track Sync Plugin

**Date:** June 2026
**Repository (private/dev):** techcode007/superproductivity-to-toggl-2
**Repository (public):** techmike/superproductivity-toggl-plugin
**Status:** Shipped — active debugging for SP version compatibility

---

## 1. Project Overview

A Super Productivity plugin that automatically syncs task timers to Toggl Track in real time. When a user starts a task in Super Productivity, a Toggl time entry starts. When the user stops or switches tasks, the Toggl entry stops. The plugin is one-way only: Super Productivity → Toggl. No build is required for end users — they download a pre-built zip from GitHub Releases.

---

## 2. Goals & Requirements

| Goal | Status |
|------|--------|
| Auto-start Toggl entry when SP task starts | Done |
| Auto-stop Toggl entry when SP task stops or switches | Done |
| Match SP projects to Toggl projects by name | Done |
| Fallback project for inbox/unmatched tasks | Done |
| Configurable tag, billable flag, stop-existing-timer option | Done |
| Settings dialog inside SP (no DevTools required) | Done |
| Persist settings and mappings across restarts | Done |
| Public release with downloadable zip | Done |
| Automated CI (typecheck, lint, test, build) | Done |
| Automated security scanning (CodeQL + npm audit) | Done |
| Automated release packaging | Done |
| Unit tests | Done — 23 tests |
| SP version upgrade compatibility | In progress |

---

## 3. Architecture

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Language | TypeScript 5.4, strict mode |
| Bundler | esbuild (IIFE format, ES2020 target) |
| Test framework | Vitest 1.6 |
| Linter | ESLint 9 with @typescript-eslint |
| Runtime | Super Productivity plugin sandbox (browser/Electron) |
| External API | Toggl Track REST API v9 |

### Output

The entire plugin compiles to a single file: `dist/plugin.js` (~15 KB unminified, ~8 KB minified). This file plus `manifest.json` are zipped into `toggl-sync-plugin.zip` for distribution.

### Module Map

```
src/
  index.ts          — Entry point. Registers hooks synchronously, loads
                      persisted data async.
  types.ts          — All TypeScript interfaces. Declares the PluginAPI
                      global (injected by SP at runtime).
  storage.ts        — Single JSON blob persistence via PluginAPI.
                      In-memory cache for sync reads on hot path.
  mapping-store.ts  — In-memory SP task ID → Toggl entry ID mapping.
                      Persisted across restarts.
  sync-engine.ts    — Core logic. Handles currentTaskChange events:
                      stop previous entry, resolve project, start new entry.
  toggl-client.ts   — Toggl API wrapper (start, stop, fetch projects).
                      Never throws — returns {ok, status} on all errors.
  settings.ts       — Settings dialog HTML + project sync logic.
```

### Data Flow

```
SP task switch
    │
    ▼
currentTaskChange hook (index.ts)
    │
    ▼
onCurrentTaskChange (sync-engine.ts)
    ├── loadSettings()              ← in-memory read (storage.ts)
    ├── getMapping(previousTaskId)  ← in-memory read (mapping-store.ts)
    ├── stopEntry(togglEntryId)     ← PATCH Toggl API (toggl-client.ts)
    ├── resolveProjectId()
    │     └── spToTogglProjectMap[task.projectId] ?? defaultProjectId
    ├── startEntry(settings, task, projectId)  ← POST Toggl API
    └── saveMappingStore()          ← PluginAPI.persistDataSynced
```

### Key Design Decisions

- **One storage blob** — SP exposes a single string slot; one JSON object is simpler and atomic
- **In-memory cache** — all reads are synchronous; writes are async; no await on the hot path
- **Never throw in togglRequest** — unhandled rejections in plugin context can silently kill the hook handler
- **Stop before start** — ensures the previous Toggl entry gets the correct end time even if the start call fails
- **Dedup guard** — checks for an existing `running` mapping before starting to prevent double entries on duplicate hook fires
- **Project mapping by name** — fetches both SP and Toggl project lists, matches case-insensitively, stores `spProjectId → togglProjectId`; rebuilt in one pass, no merge logic needed
- **resolveProjectId exported** — exported for unit testability; previously private

---

## 4. Settings

Configured via a dialog in SP's plugin settings panel (gear icon):

| Setting | Type | Description |
|---------|------|-------------|
| Toggl API Token | string | From Toggl profile settings |
| Workspace ID | number | Numeric ID from Toggl URL |
| Fallback Project ID | number \| null | Used for inbox/unmatched tasks |
| Tag | string \| null | Applied to every entry (default: `super-productivity`) |
| Mark entries as billable | boolean | Applied to all new entries |
| Stop any running Toggl timer | boolean | Prevents overlapping timers |
| spToTogglProjectMap | Record<string, number> | Auto-populated by "Sync Projects by Name" button |

---

## 5. Project Sync Feature

The settings dialog includes a **"Sync Projects by Name"** button that:
1. Calls `GET /api/v9/workspaces/{wid}/projects` → active Toggl projects
2. Calls `PluginAPI.getAllProjects()` → SP projects
3. Matches by name (case-insensitive, trimmed)
4. Stores the `spProjectId → togglProjectId` map in settings
5. Shows a snack with match count (e.g. "matched 3 project(s)")

Supports unlimited projects. Re-clicking rebuilds the map from scratch (cleans up renames/deletions automatically).

---

## 6. CI/CD Pipelines

All workflows live in `.github/workflows/` and run on the public repo (`techmike/superproductivity-toggl-plugin`).

### ci.yml — runs on every push and PR to `main`

```
npm ci → typecheck → lint → test → build → zip → upload artifact
```
Artifact: `toggl-sync-plugin.zip` retained for 7 days.

### security.yml — runs on push/PR to `main` + weekly Monday 08:00 UTC

- **CodeQL** — static analysis for JavaScript/TypeScript
- **npm audit** — fails on high or critical severity vulnerabilities

### release.yml — runs on `v*` tag push

```
npm ci → build:prod (minified) → zip → attach to GitHub Release
```
Release artifact: `toggl-sync-plugin.zip` attached alongside auto-generated release notes.

---

## 7. Test Suite

**Framework:** Vitest 1.6 — 23 tests across 4 files. All pass.

| File | Tests | What is covered |
|------|-------|----------------|
| `sync-engine.test.ts` | 8 | `resolveProjectId` (5 cases), `onCurrentTaskChange` (bail, start, dedup) |
| `toggl-client.test.ts` | 7 | `startEntry` (success/403/network error), `stopEntry` (URL), `fetchTogglProjects` (filter/error/auth) |
| `mapping-store.test.ts` | 4 | Get/set/overwrite mappings, save delegates to storage |
| `storage.test.ts` | 4 | Parse/default/invalid JSON, serialization roundtrip |

Mocking strategy: `PluginAPI` stubbed as a global via `vi.stubGlobal`; `fetch` stubbed per-test via `vi.stubGlobal`; `storage.ts` and `toggl-client.ts` mocked via `vi.mock` in sync-engine tests.

---

## 8. Repository Structure

```
.github/
  workflows/
    ci.yml
    security.yml
    release.yml
src/
  __tests__/
    mapping-store.test.ts
    storage.test.ts
    sync-engine.test.ts
    toggl-client.test.ts
  index.ts
  mapping-store.ts
  settings.ts
  storage.ts
  sync-engine.ts
  toggl-client.ts
  types.ts
dist/
  plugin.js             ← gitignored; built by CI and locally
manifest.json
package.json
tsconfig.json
vitest.config.ts
eslint.config.js
README.md
ARCHITECTURE.md
```

---

## 9. npm Scripts

| Command | Description |
|---------|-------------|
| `npm run build` | Bundle to `dist/plugin.js` (unminified) |
| `npm run build:prod` | Bundle to `dist/plugin.js` (minified) |
| `npm run watch` | Rebuild on file save |
| `npm run typecheck` | TypeScript type check, no emit |
| `npm run lint` | ESLint across `src/` |
| `npm run test` | Vitest single run |
| `npm run test:watch` | Vitest watch mode |
| `npm run test:coverage` | Vitest with V8 coverage |

---

## 10. Installation (End Users)

1. Go to [Releases](https://github.com/techmike/superproductivity-toggl-plugin/releases)
2. Download `toggl-sync-plugin.zip` from the latest release
3. In Super Productivity: **Settings → Plugins → Add Plugin** → select the zip
4. Click the gear icon on the plugin card → enter Toggl API token and Workspace ID → Save
5. Click **Sync Projects by Name** to auto-map projects

---

## 11. Local Build (Contributors)

```bash
git clone https://github.com/techmike/superproductivity-toggl-plugin.git
cd superproductivity-toggl-plugin
npm install && npm run build
zip -j toggl-sync-plugin.zip manifest.json dist/plugin.js
```

---

## 12. Release Process

```bash
git tag -a v1.0.x -m "Release notes here"
git push public v1.0.x
```

GitHub Actions builds the minified zip and attaches it to the release automatically.

---

## 13. Multi-Remote Strategy

| Remote | Repo | Purpose |
|--------|------|---------|
| `origin` | techcode007/superproductivity-to-toggl-2 | Private dev repo |
| `public` | techmike/superproductivity-toggl-plugin | Public release repo |

Work happens on `origin`. When ready to publish: `git push public main` and/or push a version tag.

---

## 14. Known Issues / In Progress

### SP Version Compatibility (Active)

After a Super Productivity upgrade, the plugin is not consistently starting or stopping Toggl entries. Root cause not yet confirmed. Likely candidates:

1. **Hook name changed** — SP may have renamed `currentTaskChange`
2. **Payload shape changed** — task may now be wrapped (e.g. `{ task: {...} }`) rather than delivered directly
3. **Timing regression** — data may not be loaded before the first hook fires

**Debugging steps provided to user:**
- Filter DevTools console for `[toggl-sync]` and check if `currentTaskChange hook fired` appears
- Run in console: `PluginAPI.registerHook('currentTaskChange', (p) => console.log('RAW PAYLOAD:', JSON.stringify(p, null, 2)))` and start a task to inspect the live payload shape
- Check SP changelog for breaking plugin API changes between the old and new version

**Pending:** User to provide console output and raw payload for diagnosis.

---

## 15. Toggl API Reference (Used Endpoints)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/v9/me` | Verify API token |
| GET | `/api/v9/workspaces` | List workspaces |
| GET | `/api/v9/workspaces/{wid}/projects` | Fetch active projects |
| POST | `/api/v9/workspaces/{wid}/time_entries` | Start a new entry |
| PATCH | `/api/v9/workspaces/{wid}/time_entries/{id}/stop` | Stop a specific entry |
| PATCH | `/api/v9/me/time_entries/current/stop` | Stop whatever is running |
| GET | `/api/v9/me/time_entries/current` | Check running entry |

Authentication: `Authorization: Basic base64(token:api_token)`
