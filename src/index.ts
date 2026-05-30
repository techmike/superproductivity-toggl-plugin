import { CurrentTaskPayload } from './types';
import { loadPluginData } from './storage';
import { loadSettings, openSettingsDialog } from './settings';
import { onCurrentTaskChange } from './sync-engine';

console.log('[toggl-sync] plugin loading');

// Register hooks synchronously — SP may call these before any async work completes
PluginAPI.registerConfigHandler(openSettingsDialog);

PluginAPI.registerHook('currentTaskChange', (payload: unknown) => {
  console.log('[toggl-sync] currentTaskChange hook fired', JSON.stringify(payload));
  onCurrentTaskChange(payload as CurrentTaskPayload).catch((err) => {
    console.error('[toggl-sync] unhandled error in onCurrentTaskChange', err);
  });
});

console.log('[toggl-sync] hooks registered, loading persisted data...');

// Load persisted data async — hooks above will still fire correctly
loadPluginData()
  .then(() => {
    console.log('[toggl-sync] data loaded, settings:', JSON.stringify(loadSettings()));
    if (!loadSettings()) {
      PluginAPI.showSnack({
        msg: 'Toggl Sync: click the settings icon on the plugin to configure your API token.',
        type: 'WARNING',
      });
    }
  })
  .catch((err) => {
    console.error('[toggl-sync] failed to load persisted data', err);
  });
