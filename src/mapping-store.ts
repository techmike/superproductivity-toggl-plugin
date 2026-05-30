import { MappingStore, TaskMapping } from './types';

const STORAGE_KEY = 'toggl-plugin-mappings';

let _store: MappingStore = { version: 1, entries: {} };

export function initMappingStore(): void {
  const raw = PluginAPI.loadPersistedData(STORAGE_KEY) as MappingStore | null;
  if (raw && raw.version === 1 && typeof raw.entries === 'object') {
    _store = raw;
  } else {
    _store = { version: 1, entries: {} };
  }
}

export function getMapping(spTaskId: string): TaskMapping | undefined {
  return _store.entries[spTaskId];
}

export function setMapping(mapping: TaskMapping): void {
  _store.entries[mapping.spTaskId] = mapping;
}

export function saveMappingStore(): void {
  PluginAPI.persistDataSynced(STORAGE_KEY, _store);
}
