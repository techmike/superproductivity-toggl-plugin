import { CurrentTaskChangePayload } from './types';
import { initMappingStore } from './mapping-store';
import { loadSettings } from './settings';
import { onCurrentTaskChange } from './sync-engine';

function init(): void {
  initMappingStore();
  loadSettings(); // show setup snack on first run if unconfigured

  PluginAPI.on('CURRENT_TASK_CHANGE', (payload: unknown) => {
    onCurrentTaskChange(payload as CurrentTaskChangePayload).catch(() => {
      // Unhandled errors must not crash the plugin host
    });
  });
}

init();
