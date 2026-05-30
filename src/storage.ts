import { MappingStore, PluginSettings } from './types';

interface PluginData {
  settings: PluginSettings | null;
  mappings: MappingStore;
}

const EMPTY: PluginData = {
  settings: null,
  mappings: { version: 1, entries: {} },
};

let _data: PluginData = { ...EMPTY, mappings: { version: 1, entries: {} } };

export async function loadPluginData(): Promise<void> {
  try {
    const raw = (await PluginAPI.loadSyncedData()) as string | null;
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PluginData>;
      _data = {
        settings: parsed.settings ?? null,
        mappings: parsed.mappings ?? { version: 1, entries: {} },
      };
    }
  } catch {
    _data = { settings: null, mappings: { version: 1, entries: {} } };
  }
}

export async function savePluginData(): Promise<void> {
  await PluginAPI.persistDataSynced(JSON.stringify(_data));
}

export function getSettings(): PluginSettings | null {
  return _data.settings;
}

export function setSettings(s: PluginSettings): void {
  _data.settings = s;
}

export function getMappingStore(): MappingStore {
  return _data.mappings;
}
