import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock storage before importing mapping-store
const mockMappingStore = { version: 1 as const, entries: {} as Record<string, any> };

vi.mock('../storage', () => ({
  getMappingStore: () => mockMappingStore,
  savePluginData: vi.fn().mockResolvedValue(undefined),
}));

import { getMapping, setMapping, saveMappingStore } from '../mapping-store';

describe('mapping-store', () => {
  beforeEach(() => {
    mockMappingStore.entries = {};
  });

  it('returns undefined for unknown task IDs', () => {
    expect(getMapping('unknown-id')).toBeUndefined();
  });

  it('stores and retrieves a mapping', () => {
    const mapping = {
      spTaskId: 'task-1',
      togglEntryId: 99,
      status: 'running' as const,
      startedAt: '2024-01-01T10:00:00Z',
      stoppedAt: null,
    };
    setMapping(mapping);
    expect(getMapping('task-1')).toEqual(mapping);
  });

  it('overwrites an existing mapping with updated status', () => {
    setMapping({ spTaskId: 'task-2', togglEntryId: 42, status: 'running', startedAt: '2024-01-01T10:00:00Z', stoppedAt: null });
    setMapping({ spTaskId: 'task-2', togglEntryId: 42, status: 'stopped', startedAt: '2024-01-01T10:00:00Z', stoppedAt: '2024-01-01T11:00:00Z' });
    expect(getMapping('task-2')?.status).toBe('stopped');
    expect(getMapping('task-2')?.stoppedAt).toBe('2024-01-01T11:00:00Z');
  });

  it('saveMappingStore calls savePluginData', async () => {
    const { savePluginData } = await import('../storage');
    await saveMappingStore();
    expect(savePluginData).toHaveBeenCalled();
  });
});
