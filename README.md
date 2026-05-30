# Super Productivity → Toggl Track Sync Plugin

A Super Productivity plugin that syncs task timer events to Toggl Track — one-way, automatic, no daemon required.

## How it works

- Start a task in Super Productivity → a running Toggl time entry is created
- Stop or switch tasks → the Toggl entry is stopped with the correct duration
- Task titles, project, billable flag, and a `super-productivity` tag are set automatically

## Setup

### 1. Get your Toggl API token

1. Log in at [track.toggl.com](https://track.toggl.com)
2. Go to **Profile Settings → API Token**
3. Copy your token

### 2. Get your Workspace ID

In Toggl, go to **Settings** — the workspace ID appears in the URL:
`https://track.toggl.com/workspaces/123456/settings`

### 3. Configure the plugin

After loading the plugin in Super Productivity, open the browser/Electron DevTools console and run:

```javascript
PluginAPI.persistDataSynced('toggl-plugin-settings', {
  togglApiToken: 'YOUR_API_TOKEN',
  workspaceId: 123456,
  defaultProjectId: null,        // optional: Toggl project ID for all entries
  defaultBillable: false,
  tag: 'super-productivity',     // set to null to skip tagging
  stopExistingTogglTimer: true,  // stop any running Toggl timer before starting a new one
});
```

Reload Super Productivity. The plugin is now active.

### 4. Install the plugin in Super Productivity

1. Build: `npm install && npm run build`
2. In Super Productivity go to **Settings → Plugins**
3. Click **Load Plugin** and select the `manifest.json` file from this directory

## Development

```bash
npm install
npm run watch      # rebuild on save
npm run typecheck  # TypeScript type check
npm run build:prod # minified production build
```

## Reset / remove API token

```javascript
PluginAPI.persistDataSynced('toggl-plugin-settings', {
  togglApiToken: '',
  workspaceId: 0,
  defaultProjectId: null,
  defaultBillable: false,
  tag: null,
  stopExistingTogglTimer: false,
});
```

## Privacy

- Your Toggl API token is stored only in Super Productivity's local synced storage.
- Task data is sent exclusively to `api.track.toggl.com`. Nothing else.
- The API token is never written to logs or error messages.

## MVP scope

- One-way sync: Super Productivity → Toggl only
- Single workspace and default project
- No Toggl → Super Productivity sync
- No multi-device conflict resolution
