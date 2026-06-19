import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resolveProjectId } from '../sync-engine';
import type { PluginSettings, SPTask } from '../types';

// sync-engine imports settings, mapping-store, and toggl-client — mock them all
vi.mock('../settings', () => ({ loadSettings: vi.fn() }));
vi.mock('../mapping-store', () => ({
  getMapping: vi.fn(),
  setMapping: vi.fn(),
  saveMappingStore: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../toggl-client', () => ({
  startEntry: vi.fn(),
  stopEntry: vi.fn(),
  stopCurrentRunningEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.stubGlobal('PluginAPI', {
  showSnack: vi.fn(),
  loadSyncedData: vi.fn(),
  persistDataSynced: vi.fn(),
  getTask: vi.fn(),
  getAllProjects: vi.fn(),
  registerHook: vi.fn(),
  registerConfigHandler: vi.fn(),
  openDialog: vi.fn(),
  translate: vi.fn(),
});

function makeSettings(overrides: Partial<PluginSettings> = {}): PluginSettings {
  return {
    togglApiToken: 'tok',
    workspaceId: 1,
    defaultProjectId: 55,
    defaultBillable: false,
    tag: null,
    stopExistingTogglTimer: false,
    spToTogglProjectMap: {},
    ...overrides,
  };
}

function makeTask(overrides: Partial<SPTask> = {}): SPTask {
  return { id: 'task-1', title: 'My Task', projectId: null, tagIds: [], ...overrides };
}

describe('resolveProjectId', () => {
  it('returns defaultProjectId when task has no projectId', () => {
    const settings = makeSettings({ defaultProjectId: 55 });
    expect(resolveProjectId(settings, makeTask({ projectId: null }))).toBe(55);
  });

  it('returns matched Toggl project ID when SP project is in the map', () => {
    const settings = makeSettings({ spToTogglProjectMap: { 'sp-proj-1': 777 }, defaultProjectId: 55 });
    expect(resolveProjectId(settings, makeTask({ projectId: 'sp-proj-1' }))).toBe(777);
  });

  it('falls back to defaultProjectId when SP project is not in the map', () => {
    const settings = makeSettings({ spToTogglProjectMap: { 'other-proj': 888 }, defaultProjectId: 55 });
    expect(resolveProjectId(settings, makeTask({ projectId: 'sp-proj-1' }))).toBe(55);
  });

  it('returns null when no defaultProjectId and no map match', () => {
    const settings = makeSettings({ defaultProjectId: null, spToTogglProjectMap: {} });
    expect(resolveProjectId(settings, makeTask({ projectId: null }))).toBeNull();
  });

  it('handles missing spToTogglProjectMap gracefully', () => {
    const settings = makeSettings({ defaultProjectId: 55 });
    // @ts-expect-error — simulate missing field from old stored data
    delete settings.spToTogglProjectMap;
    expect(resolveProjectId(settings, makeTask({ projectId: 'sp-proj-1' }))).toBe(55);
  });
});

describe('onCurrentTaskChange', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('bails early when settings are not configured', async () => {
    const { loadSettings } = await import('../settings');
    vi.mocked(loadSettings).mockReturnValue(null);
    const { startEntry } = await import('../toggl-client');
    const { onCurrentTaskChange } = await import('../sync-engine');
    await onCurrentTaskChange({ current: { id: 'task-1', title: 'T', projectId: null, tagIds: [] }, previous: null });
    expect(startEntry).not.toHaveBeenCalled();
  });

  it('starts a Toggl entry for a new task', async () => {
    const { loadSettings } = await import('../settings');
    vi.mocked(loadSettings).mockReturnValue(makeSettings());
    const { getMapping } = await import('../mapping-store');
    vi.mocked(getMapping).mockReturnValue(undefined);
    const { startEntry } = await import('../toggl-client');
    vi.mocked(startEntry).mockResolvedValue({ ok: true, entry: { id: 42, workspace_id: 1, description: 'T', start: '2024-01-01T00:00:00Z', stop: null, duration: -1 } });

    const { onCurrentTaskChange } = await import('../sync-engine');
    await onCurrentTaskChange({ current: { id: 'task-new', title: 'T', projectId: null, tagIds: [] }, previous: null });
    expect(startEntry).toHaveBeenCalledOnce();
    expect(startEntry).toHaveBeenCalledWith(
      makeSettings(),
      { id: 'task-new', title: 'T', projectId: null, tagIds: [] },
      expect.anything(),
    );
  });

  it('skips start when task is already running', async () => {
    const { loadSettings } = await import('../settings');
    vi.mocked(loadSettings).mockReturnValue(makeSettings());
    const { getMapping } = await import('../mapping-store');
    // Return undefined for any previous task (stop phase), running for the current task (dedup guard)
    vi.mocked(getMapping).mockImplementation((id) =>
      id === 'task-dup'
        ? { spTaskId: 'task-dup', togglEntryId: 5, status: 'running', startedAt: '', stoppedAt: null }
        : undefined,
    );
    const { startEntry, stopEntry } = await import('../toggl-client');
    vi.mocked(stopEntry).mockResolvedValue({ ok: true });

    const { onCurrentTaskChange } = await import('../sync-engine');
    await onCurrentTaskChange({ current: { id: 'task-dup', title: 'Dup', projectId: null, tagIds: [] }, previous: null });
    expect(startEntry).not.toHaveBeenCalled();
  });

  it('treats a wrapped null current as "no task" and stops the previous mapping', async () => {
    const { loadSettings } = await import('../settings');
    vi.mocked(loadSettings).mockReturnValue(makeSettings());
    const { getMapping, setMapping } = await import('../mapping-store');
    vi.mocked(getMapping).mockImplementation((id) =>
      id === 'task-running'
        ? { spTaskId: 'task-running', togglEntryId: 7, status: 'running', startedAt: '', stoppedAt: null }
        : undefined,
    );
    const { startEntry, stopEntry } = await import('../toggl-client');
    vi.mocked(stopEntry).mockResolvedValue({ ok: true });

    const { onCurrentTaskChange } = await import('../sync-engine');
    // First call establishes the in-memory "previous task" tracking.
    await onCurrentTaskChange({ current: { id: 'task-running', title: 'Running', projectId: null, tagIds: [] }, previous: null });
    // Second call delivers the wrapped payload with current: null (task stopped in SP).
    await onCurrentTaskChange({ current: null, previous: { id: 'task-running', title: 'Running', projectId: null, tagIds: [] } });

    expect(stopEntry).toHaveBeenCalledWith(makeSettings(), 7);
    expect(setMapping).toHaveBeenCalledWith(expect.objectContaining({ status: 'stopped' }));
    expect(startEntry).not.toHaveBeenCalled();
  });

  it('stops the previous task and starts the new one when switching directly between two tasks', async () => {
    const { loadSettings } = await import('../settings');
    vi.mocked(loadSettings).mockReturnValue(makeSettings());
    const { getMapping } = await import('../mapping-store');
    vi.mocked(getMapping).mockImplementation((id) =>
      id === 'task-a'
        ? { spTaskId: 'task-a', togglEntryId: 11, status: 'running', startedAt: '', stoppedAt: null }
        : undefined,
    );
    const { startEntry, stopEntry } = await import('../toggl-client');
    vi.mocked(stopEntry).mockResolvedValue({ ok: true });
    vi.mocked(startEntry).mockResolvedValue({ ok: true, entry: { id: 99, workspace_id: 1, description: 'B', start: '2024-01-01T00:00:00Z', stop: null, duration: -1 } });

    const { onCurrentTaskChange } = await import('../sync-engine');
    const taskA = { id: 'task-a', title: 'Task A', projectId: null, tagIds: [] };
    const taskB = { id: 'task-b', title: 'Task B', projectId: null, tagIds: [] };

    await onCurrentTaskChange({ current: taskA, previous: null });
    await onCurrentTaskChange({ current: taskB, previous: taskA });

    expect(stopEntry).toHaveBeenCalledWith(makeSettings(), 11);
    expect(startEntry).toHaveBeenCalledWith(makeSettings(), taskB, expect.anything());
  });
});
