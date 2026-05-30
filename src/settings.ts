import { PluginSettings } from './types';

const STORAGE_KEY = 'toggl-plugin-settings';

export function loadSettings(): PluginSettings | null {
  const raw = PluginAPI.loadSyncedData(STORAGE_KEY) as PluginSettings | null;
  if (!raw || !raw.togglApiToken || !raw.workspaceId) {
    PluginAPI.showSnack({
      msg: 'Toggl Sync: open plugin settings and enter your API token and workspace ID.',
      type: 'WARN',
    });
    return null;
  }
  return raw;
}

export function saveSettings(settings: PluginSettings): void {
  PluginAPI.persistDataSynced(STORAGE_KEY, settings);
}
