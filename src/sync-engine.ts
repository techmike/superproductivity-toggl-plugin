import { CurrentTaskPayload, PluginSettings, SPTask } from './types';
import { loadSettings } from './settings';
import { getMapping, setMapping, saveMappingStore } from './mapping-store';
import { startEntry, stopEntry, stopCurrentRunningEntry } from './toggl-client';

const LOG = '[toggl-sync]';

function resolveProjectId(settings: PluginSettings, task: SPTask): number | null {
  if (task.projectId && settings.spToTogglProjectMap?.[task.projectId]) {
    return settings.spToTogglProjectMap[task.projectId];
  }
  return settings.defaultProjectId;
}

// Track the previously active SP task ID in memory
let _previousTaskId: string | null = null;

export async function onCurrentTaskChange(task: CurrentTaskPayload): Promise<void> {
  console.log(LOG, 'currentTaskChange', task ? task.title : 'null');

  const settings = loadSettings();
  if (!settings) {
    console.warn(LOG, 'No settings configured — skipping sync');
    return;
  }

  const previousTaskId = _previousTaskId;
  _previousTaskId = task?.id ?? null;

  // STOP phase — stop whatever was running before
  if (previousTaskId) {
    const mapping = getMapping(previousTaskId);
    if (mapping && mapping.status === 'running') {
      console.log(LOG, 'Stopping Toggl entry', mapping.togglEntryId, 'for task', previousTaskId);
      const result = await stopEntry(settings, mapping.togglEntryId);
      console.log(LOG, 'Stop result:', result.ok, result.status);
      if (result.ok) {
        setMapping({ ...mapping, status: 'stopped', stoppedAt: new Date().toISOString() });
      } else {
        setMapping({ ...mapping, status: 'error' });
        PluginAPI.showSnack({
          msg: `Toggl Sync: failed to stop timer (HTTP ${result.status}).`,
          type: 'ERROR',
        });
      }
      await saveMappingStore();
    }
  }

  // START phase
  if (task) {
    const existing = getMapping(task.id);
    if (existing && existing.status === 'running') {
      console.log(LOG, 'Already tracking task', task.id, '— skipping duplicate start');
      return;
    }

    if (settings.stopExistingTogglTimer) {
      console.log(LOG, 'Stopping any existing Toggl timer');
      await stopCurrentRunningEntry(settings);
    }

    console.log(LOG, 'Creating Toggl entry for:', task.title);
    const projectId = resolveProjectId(settings, task);
    const result = await startEntry(settings, task, projectId);
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
    console.log(LOG, 'Task stopped — no new task to start');
  }
}
