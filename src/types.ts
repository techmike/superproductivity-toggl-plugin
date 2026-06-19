export interface PluginSettings {
  togglApiToken: string;
  workspaceId: number;
  defaultProjectId: number | null;
  defaultBillable: boolean;
  tag: string | null;
  stopExistingTogglTimer: boolean;
  spToTogglProjectMap: Record<string, number>; // spProjectId → togglProjectId
}

export interface TogglProject {
  id: number;
  name: string;
  active: boolean;
}

export interface TaskMapping {
  spTaskId: string;
  togglEntryId: number;
  status: 'running' | 'stopped' | 'error';
  startedAt: string;
  stoppedAt: string | null;
}

export interface MappingStore {
  version: 1;
  entries: Record<string, TaskMapping>;
}

// The hook delivers { current, previous } — each SPTask or null — not the raw task
export interface CurrentTaskChangePayload {
  current: SPTask | null;
  previous: SPTask | null;
}

export interface TogglStartRequest {
  description: string;
  workspace_id: number;
  project_id: number | null;
  start: string;
  duration: -1;
  billable: boolean;
  tags: string[];
  created_with: string;
}

export interface TogglTimeEntry {
  id: number;
  workspace_id: number;
  description: string;
  start: string;
  stop: string | null;
  duration: number;
}

export interface SPTask {
  id: string;
  title: string;
  projectId: string | null;
  tagIds: string[];
}

export interface TogglResult {
  ok: boolean;
  entry?: TogglTimeEntry;
  status?: number;
}

export interface DialogButton {
  label: string;
  icon?: string;
  color?: 'primary' | 'warn';
  raised?: boolean;
  onClick: () => void | Promise<void>;
}

// Minimal PluginAPI type declaration — the real object is injected by Super Productivity
declare global {
  const PluginAPI: {
    loadSyncedData(): Promise<string | null>;
    persistDataSynced(data: string): Promise<void>;
    showSnack(opts: { msg: string; type: 'SUCCESS' | 'ERROR' | 'INFO' | 'WARNING'; ico?: string }): void;
    getTask(taskId: string): SPTask;
    getAllProjects(): Promise<Array<{ id: string; title: string }>>;
    registerHook(hook: string, handler: (payload: unknown) => void): void;
    registerConfigHandler(fn: () => void): void;
    openDialog(opts: { title?: string; htmlContent?: string; buttons: DialogButton[] }): void;
    translate(key: string, params?: unknown): string;
  };
}
