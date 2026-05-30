# Super Productivity → Toggl Track Sync Plugin

A Super Productivity plugin that syncs task timer events to Toggl Track — one-way, automatic, no daemon required.

## How it works

- Start a task in Super Productivity → a running Toggl time entry is created
- Stop or switch tasks → the Toggl entry is stopped with the correct duration
- Task titles, project, billable flag, and a `super-productivity` tag are set automatically

## Setup

### 1. Build the plugin

```bash
npm install
npm run build
```

### 2. Package as a zip

```bash
zip -j toggl-sync-plugin.zip manifest.json dist/plugin.js
```

### 3. Install in Super Productivity

1. Go to **Settings → Plugins**
2. Click **Install Plugin** and select `toggl-sync-plugin.zip`

### 4. Configure your Toggl credentials

After installation, a warning snack appears at the bottom of the screen. Click the **gear icon** on the Toggl Sync plugin card in **Settings → Plugins** to open the settings form.

Fill in:
- **Toggl API Token** — from [track.toggl.com](https://track.toggl.com) → Profile Settings → API Token
- **Workspace ID** — visible in your Toggl URL: `track.toggl.com/workspaces/123456/`
- **Default Project ID** — optional, leave blank for no project
- **Tag** — defaults to `super-productivity`
- **Billable** and **Stop existing timer** checkboxes

Click **Save**. The plugin is now active — no reload needed.

## Development

```bash
npm install
npm run watch      # rebuild on save
npm run typecheck  # TypeScript type check
npm run build:prod # minified production build
```

## Reset / remove API token

Open the settings form (gear icon on the plugin card), clear the API Token field, and save. The plugin will stop syncing and show a setup prompt on the next task start.

## Privacy

- Your Toggl API token is stored only in Super Productivity's local synced storage.
- Task data is sent exclusively to `api.track.toggl.com`. Nothing else.
- The API token is never written to logs or error messages.

## MVP scope

- One-way sync: Super Productivity → Toggl only
- Single workspace and default project
- No Toggl → Super Productivity sync
- No multi-device conflict resolution
