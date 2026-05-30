import { CurrentTaskChangePayload } from './types';
import { loadPluginData } from './storage';
import { loadSettings, openSettingsDialog } from './settings';
import { onCurrentTaskChange } from './sync-engine';

async function init(): Promise<void> {
  await loadPluginData();

  PluginAPI.registerConfigHandler(openSettingsDialog);

  if (!loadSettings()) {
    PluginAPI.showSnack({
      msg: 'Toggl Sync: click the settings icon on the plugin to configure your API token.',
      type: 'WARNING',
    });
  }

  PluginAPI.registerHook('currentTaskChange', (payload: unknown) => {
    onCurrentTaskChange(payload as CurrentTaskChangePayload).catch(() => {
      // Unhandled errors must not crash the plugin host
    });
  });
}

init().catch(() => {});
