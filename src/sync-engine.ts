import { CurrentTaskChangePayload } from './types';
import { loadSettings } from './settings';
import { getMapping, setMapping, saveMappingStore } from './mapping-store';
import { startEntry, stopEntry, stopCurrentRunningEntry } from './toggl-client';

export async function onCurrentTaskChange(
  payload: CurrentTaskChangePayload,
): Promise<void> {
  const settings = loadSettings();
  if (!settings) return;

  // STOP phase — always runs before start on a task switch
  if (payload.previous) {
    const mapping = getMapping(payload.previous.id);
    if (mapping && mapping.status === 'running') {
      const result = await stopEntry(settings, mapping.togglEntryId);
      if (result.ok) {
        setMapping({ ...mapping, status: 'stopped', stoppedAt: new Date().toISOString() });
      } else {
        setMapping({ ...mapping, status: 'error' });
        const task = PluginAPI.getTask(payload.previous.id);
        PluginAPI.showSnack({
          msg: `Toggl Sync: failed to stop timer for "${task.title}".`,
          type: 'ERROR',
        });
      }
      saveMappingStore();
    }
  }

  // START phase
  if (payload.current) {
    const mapping = getMapping(payload.current.id);

    // Duplicate protection: skip if already tracking this task
    if (mapping && mapping.status === 'running') return;

    if (settings.stopExistingTogglTimer) {
      await stopCurrentRunningEntry(settings);
    }

    const task = PluginAPI.getTask(payload.current.id);
    const result = await startEntry(settings, task);

    if (result.ok && result.entry) {
      setMapping({
        spTaskId: task.id,
        togglEntryId: result.entry.id,
        status: 'running',
        startedAt: result.entry.start,
        stoppedAt: null,
      });
      saveMappingStore();
    } else {
      PluginAPI.showSnack({
        msg: `Toggl Sync: failed to start timer for "${task.title}".`,
        type: 'ERROR',
      });
    }
  }
}
