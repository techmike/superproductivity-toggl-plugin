import { CurrentTaskChangePayload } from './types';
import { initMappingStore } from './mapping-store';
import { loadSettings, openSettingsDialog } from './settings';
import { onCurrentTaskChange } from './sync-engine';

function init(): void {
  initMappingStore();

  // Register the gear icon handler in SP's plugin settings panel
  PluginAPI.registerConfigHandler(openSettingsDialog);

  // Prompt unconfigured users to open settings
  if (!loadSettings()) {
    PluginAPI.showSnack({
      msg: 'Toggl Sync: click the settings icon on the plugin to configure your API token.',
      type: 'WARNING',
    });
  }

  PluginAPI.on('CURRENT_TASK_CHANGE', (payload: unknown) => {
    onCurrentTaskChange(payload as CurrentTaskChangePayload).catch(() => {
      // Unhandled errors must not crash the plugin host
    });
  });
}

init();
