# Super Productivity → Toggl Track Sync

[![CI](https://github.com/YOUR_USERNAME/YOUR_REPO/actions/workflows/ci.yml/badge.svg)](https://github.com/YOUR_USERNAME/YOUR_REPO/actions/workflows/ci.yml)
[![CodeQL](https://github.com/YOUR_USERNAME/YOUR_REPO/actions/workflows/security.yml/badge.svg)](https://github.com/YOUR_USERNAME/YOUR_REPO/actions/workflows/security.yml)

A plugin for [Super Productivity](https://super-productivity.com/) that automatically syncs your task timers to [Toggl Track](https://toggl.com/track/) in real time.

When you start a task in Super Productivity, a Toggl time entry starts. When you stop or switch tasks, Toggl stops. Projects are matched by name automatically — no manual ID entry required.

---

## Features

- Starts and stops Toggl time entries automatically as you work in Super Productivity
- Matches SP projects to Toggl projects by name (case-insensitive, unlimited projects)
- Falls back to a configurable default project for inbox tasks or unmatched projects
- Optional tag applied to every entry (e.g. `super-productivity`)
- Optional billable flag on all entries
- Optionally stops any other running Toggl timer when a new task starts
- Persists all settings and task-entry mappings via Super Productivity's sync storage

---

## Requirements

- Super Productivity (desktop or web) with plugin support
- A Toggl Track account (free tier works)
- Node.js 18+ and npm (for building from source)

---

## Setup

### 1. Get your Toggl credentials

**API Token**
1. Log in at [track.toggl.com](https://track.toggl.com)
2. Click your avatar → **Profile Settings**
3. Scroll to the bottom → copy your **API Token**

**Workspace ID**
1. In Toggl, open your workspace
2. The URL will look like `track.toggl.com/workspaces/1234567/` — `1234567` is your workspace ID

**Default Project ID** (optional — used for inbox tasks)
```bash
# List all projects in your workspace
curl -u YOUR_API_TOKEN:api_token \
  "https://api.track.toggl.com/api/v9/workspaces/YOUR_WORKSPACE_ID/projects" \
  | jq '.[] | {id, name}'
```
Copy the `id` of the project you want as the fallback.

---

### 2. Build the plugin

```bash
git clone https://github.com/techcode007/superproductivity-to-toggl-2.git
cd superproductivity-to-toggl-2
npm install
npm run build
```

The output is `dist/plugin.js`.

For a minified production build:
```bash
npm run build:prod
```

To rebuild automatically while developing:
```bash
npm run watch
```

---

### 3. Install in Super Productivity

1. Open Super Productivity
2. Go to **Settings → Plugins**
3. Click **Add Plugin** and select `dist/plugin.js`
4. The plugin loads immediately; you will see a banner prompting you to configure it

---

### 4. Configure the plugin

Click the settings (gear) icon on the plugin card. Fill in:

| Field | Required | Description |
|-------|----------|-------------|
| Toggl API Token | Yes | From your Toggl profile settings |
| Workspace ID | Yes | Numeric ID from the Toggl URL |
| Fallback Project ID | No | Used for inbox tasks or unmatched projects |
| Tag | No | Added to every Toggl entry (default: `super-productivity`) |
| Mark entries as billable | No | Applies to all new entries |
| Stop any running Toggl timer | No | Prevents overlapping timers |

Click **Save**.

---

### 5. Sync projects by name

If your SP projects have the same names as your Toggl projects:

1. Make sure **API Token** and **Workspace ID** are filled in and saved
2. Click **Sync Projects by Name**
3. The plugin fetches both project lists and matches them case-insensitively
4. A snack message confirms how many were matched (e.g. "matched 3 project(s)")

The mapping is stored permanently. Re-click the button any time you add or rename projects.

---

## Usage

Once configured, everything is automatic:

- **Start a task** in SP → Toggl entry starts using the matched project (or fallback)
- **Switch tasks** → previous entry stops, new one starts
- **Stop tracking** → entry stops in Toggl
- **Inbox tasks** (no SP project assigned) → use the fallback project ID

---

## Testing with curl

Replace `YOUR_API_TOKEN` and `YOUR_WORKSPACE_ID` throughout.

### Verify your API token works
```bash
curl -u YOUR_API_TOKEN:api_token \
  "https://api.track.toggl.com/api/v9/me" \
  | jq '{id, email, fullname}'
```

### List workspaces
```bash
curl -u YOUR_API_TOKEN:api_token \
  "https://api.track.toggl.com/api/v9/workspaces" \
  | jq '.[] | {id, name}'
```

### List projects in a workspace
```bash
curl -u YOUR_API_TOKEN:api_token \
  "https://api.track.toggl.com/api/v9/workspaces/YOUR_WORKSPACE_ID/projects" \
  | jq '.[] | {id, name, active}'
```

### Check the currently running Toggl entry
```bash
curl -u YOUR_API_TOKEN:api_token \
  "https://api.track.toggl.com/api/v9/me/time_entries/current" \
  | jq '{id, description, project_id, start}'
```

### Manually start a time entry
```bash
curl -u YOUR_API_TOKEN:api_token \
  -H "Content-Type: application/json" \
  -X POST \
  "https://api.track.toggl.com/api/v9/workspaces/YOUR_WORKSPACE_ID/time_entries" \
  -d '{
    "description": "Test entry",
    "workspace_id": YOUR_WORKSPACE_ID,
    "project_id": null,
    "start": "'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'",
    "duration": -1,
    "billable": false,
    "tags": ["super-productivity"],
    "created_with": "super-productivity-toggl-plugin"
  }' | jq '{id, description, start}'
```

### Manually stop a running entry
```bash
curl -u YOUR_API_TOKEN:api_token \
  -X PATCH \
  "https://api.track.toggl.com/api/v9/workspaces/YOUR_WORKSPACE_ID/time_entries/ENTRY_ID/stop" \
  | jq '{id, stop, duration}'
```

### List recent time entries
```bash
curl -u YOUR_API_TOKEN:api_token \
  "https://api.track.toggl.com/api/v9/me/time_entries" \
  | jq '[.[:10][] | {id, description, project_id, start, stop}]'
```

### Stop the currently running entry (any workspace)
```bash
curl -u YOUR_API_TOKEN:api_token \
  -X PATCH \
  "https://api.track.toggl.com/api/v9/me/time_entries/current/stop" \
  | jq '{id, stop}'
```

---

## Debugging

### View plugin logs

Open the browser developer console (or Electron DevTools in the desktop app):

- **Electron desktop**: `Ctrl+Shift+I` (Windows/Linux) or `Cmd+Option+I` (Mac)
- **Web**: `F12`

Filter for `[toggl-sync]` to see only plugin messages.

### Key log messages

| Log message | Meaning |
|-------------|---------|
| `plugin loading` | Plugin file parsed and started |
| `hooks registered, loading persisted data...` | About to load saved settings |
| `data loaded, settings: {...}` | Settings loaded from storage |
| `currentTaskChange hook fired` | SP task switch detected |
| `Creating Toggl entry for: <title>` | About to POST to Toggl |
| `Start result: true <status> <entry-id>` | Entry created successfully |
| `Stopping Toggl entry <id>` | About to PATCH stop |
| `Stop result: true <status>` | Entry stopped successfully |
| `Already tracking task — skipping duplicate start` | Dedup guard fired |
| `fetch threw: ...` | Network error reaching Toggl |

### Settings not saving

Look for errors around `failed to load persisted data` in the console. This usually means `PluginAPI.persistDataSynced` rejected — check that the plugin has storage permission in SP.

### Project mapping not working

1. Confirm token and workspace ID are correct
2. Click **Sync Projects by Name** and check the match count in the snack
3. If 0 matched, the names do not align — use the curl command above to list Toggl project names and compare them character-for-character with SP project names (the match is case-insensitive but whitespace-sensitive)

### Toggl entries not starting

Check the console for `Start result: false` and note the HTTP status:

| Status | Cause |
|--------|-------|
| `403` | API token is wrong, or workspace ID does not belong to this token |
| `400` | Invalid request body — check the project ID is a number, not a string |
| `0` | Network error — SP cannot reach `api.track.toggl.com` |

### Duplicate entries appearing

The plugin checks for an existing `running` mapping before starting a new entry. If duplicates appear, two `currentTaskChange` events fired for the same task. Check the console for `Already tracking task — skipping duplicate start`.

---

## Privacy

- Your Toggl API token is stored only in Super Productivity's local synced storage
- Task data is sent exclusively to `api.track.toggl.com` — nothing else
- The API token never appears in logs or error messages

---

## Project structure

```
src/
  index.ts          — Plugin entry point; registers hooks
  settings.ts       — Settings dialog UI and project sync logic
  storage.ts        — Load/save all plugin data via PluginAPI
  sync-engine.ts    — Core task change handler; resolves project ID
  toggl-client.ts   — Toggl API calls (start, stop, fetch projects)
  mapping-store.ts  — In-memory SP task → Toggl entry ID mapping
  types.ts          — All TypeScript interfaces and global declarations
dist/
  plugin.js         — Bundled output loaded by Super Productivity
```

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run build` | Bundle `src/index.ts` → `dist/plugin.js` |
| `npm run build:prod` | Same, minified |
| `npm run watch` | Rebuild on every file save |
| `npm run typecheck` | TypeScript type check (no output files) |
| `npm run lint` | ESLint across all source files |
| `npm run test` | Run Vitest unit tests once |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run test:coverage` | Run tests with V8 coverage report |

---

## Releases

Each tagged release (`v*`) automatically triggers a GitHub Actions workflow that builds a minified `dist/plugin.js` and attaches it to the GitHub Release alongside `manifest.json`.

**To install without building from source:**
1. Go to the [Releases page](../../releases)
2. Download `plugin.js` from the latest release
3. Install it in Super Productivity via **Settings → Plugins → Add Plugin**

---

## Contributing

1. Fork the repository and create a branch from `main`
2. Install dependencies: `npm install`
3. Make your changes in `src/`
4. Run `npm run typecheck` — must pass
5. Run `npm run lint` — must pass
6. Run `npm run test` — all tests must pass
7. Run `npm run build` — must produce `dist/plugin.js`
8. Open a pull request against `main`

CI will automatically run typecheck, lint, tests, and build on your PR.

---

## Scope

This plugin is one-way only: Super Productivity → Toggl. There is no sync in the reverse direction and no multi-device conflict resolution.
