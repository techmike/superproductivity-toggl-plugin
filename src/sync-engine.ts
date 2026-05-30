import { CurrentTaskChangePayload } from './types';
import { loadSettings } from './settings';
import { getMapping, setMapping, saveMappingStore } from './mapping-store';
import { startEntry, stopEntry, stopCurrentRunningEntry } from './toggl-client';

const LOG = '[toggl-sync]';

export async function onCurrentTaskChange(
  payload: CurrentTaskChangePayload,
): Promise<void> {
  console.log(LOG, 'currentTaskChange', JSON.stringify(payload));

  const settings = loadSettings();
  if (!settings) {
    console.warn(LOG, 'No settings configured — skipping sync');
    return;
  }

  // STOP phase — always runs before start on a task switch
  if (payload.previous) {
    const prev = payload.previous;
    console.log(LOG, 'STOP phase — previous task:', prev.id, prev.title);
    const mapping = getMapping(prev.id);
    if (mapping && mapping.status === 'running') {
      console.log(LOG, 'Stopping Toggl entry', mapping.togglEntryId);
      const result = await stopEntry(settings, mapping.togglEntryId);
      console.log(LOG, 'Stop result:', result.ok, result.status);
      if (result.ok) {
        setMapping({ ...mapping, status: 'stopped', stoppedAt: new Date().toISOString() });
      } else {
        setMapping({ ...mapping, status: 'error' });
        PluginAPI.showSnack({
          msg: `Toggl Sync: failed to stop timer for "${prev.title}" (HTTP ${result.status}).`,
          type: 'ERROR',
        });
      }
      await saveMappingStore();
    } else {
      console.log(LOG, 'No running mapping for previous task — nothing to stop');
    }
  }

  // START phase
  if (payload.current) {
    const task = payload.current;
    console.log(LOG, 'START phase — current task:', task.id, task.title);
    const mapping = getMapping(task.id);

    // Duplicate protection: skip if already tracking this task
    if (mapping && mapping.status === 'running') {
      console.log(LOG, 'Already tracking this task — skipping duplicate start');
      return;
    }

    if (settings.stopExistingTogglTimer) {
      console.log(LOG, 'Stopping any existing Toggl timer');
      await stopCurrentRunningEntry(settings);
    }

    console.log(LOG, 'Creating Toggl entry for:', task.title);
    const result = await startEntry(settings, task);
    console.log(LOG, 'Start result:', result.ok, result.status, result.entry?.id);

    if (result.ok && result.entry) {
      setMapping({
        spTaskId: task.id,
        togglEntryId: result.entry.id,
        status: 'running',
        startedAt: result.entry.start,
        stoppedAt: null,
      });
      await saveMappingStore();
      console.log(LOG, 'Toggl entry created:', result.entry.id);
    } else {
      PluginAPI.showSnack({
        msg: `Toggl Sync: failed to start timer for "${task.title}" (HTTP ${result.status}).`,
        type: 'ERROR',
      });
    }
  } else {
    console.log(LOG, 'No current task — timer stopped in SP');
  }
}
