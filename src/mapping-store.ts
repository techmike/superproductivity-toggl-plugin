import { TaskMapping } from './types';
import { getMappingStore, savePluginData } from './storage';

export function getMapping(spTaskId: string): TaskMapping | undefined {
  return getMappingStore().entries[spTaskId];
}

export function setMapping(mapping: TaskMapping): void {
  getMappingStore().entries[mapping.spTaskId] = mapping;
}

export async function saveMappingStore(): Promise<void> {
  await savePluginData();
}
