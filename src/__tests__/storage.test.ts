import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockPluginAPI = {
  loadSyncedData: vi.fn(),
  persistDataSynced: vi.fn().mockResolvedValue(undefined),
  showSnack: vi.fn(),
  getTask: vi.fn(),
  getAllProjects: vi.fn(),
  registerHook: vi.fn(),
  registerConfigHandler: vi.fn(),
  openDialog: vi.fn(),
  translate: vi.fn(),
};

vi.stubGlobal('PluginAPI', mockPluginAPI);

import { loadPluginData, savePluginData, getSettings, setSettings, getMappingStore } from '../storage';

describe('storage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loadPluginData', () => {
    it('defaults to null settings and empty entries when storage is empty', async () => {
      mockPluginAPI.loadSyncedData.mockResolvedValue(null);
      await loadPluginData();
      expect(getSettings()).toBeNull();
      expect(getMappingStore().entries).toEqual({});
    });

    it('parses valid JSON from storage', async () => {
      const stored = {
        settings: {
          togglApiToken: 'tok123',
          workspaceId: 999,
          defaultProjectId: null,
          defaultBillable: false,
          tag: null,
          stopExistingTogglTimer: true,
          spToTogglProjectMap: {},
        },
        mappings: { version: 1, entries: { 'task-1': { spTaskId: 'task-1', togglEntryId: 5, status: 'stopped', startedAt: '', stoppedAt: '' } } },
      };
      mockPluginAPI.loadSyncedData.mockResolvedValue(JSON.stringify(stored));
      await loadPluginData();
      expect(getSettings()?.togglApiToken).toBe('tok123');
      expect(getMappingStore().entries['task-1'].togglEntryId).toBe(5);
    });

    it('falls back to empty state on invalid JSON', async () => {
      mockPluginAPI.loadSyncedData.mockResolvedValue('not-json{{{');
      await loadPluginData();
      expect(getSettings()).toBeNull();
    });
  });

  describe('savePluginData', () => {
    it('serializes current state and calls persistDataSynced', async () => {
      mockPluginAPI.loadSyncedData.mockResolvedValue(null);
      await loadPluginData();
      setSettings({ togglApiToken: 'abc', workspaceId: 1, defaultProjectId: null, defaultBillable: false, tag: null, stopExistingTogglTimer: false, spToTogglProjectMap: {} });
      await savePluginData();
      expect(mockPluginAPI.persistDataSynced).toHaveBeenCalledOnce();
      const saved = JSON.parse(mockPluginAPI.persistDataSynced.mock.calls[0][0]);
      expect(saved.settings.togglApiToken).toBe('abc');
    });
  });
});
