import { PluginSettings, SPTask, TogglResult, TogglTimeEntry } from './types';

const BASE_URL = 'https://api.track.toggl.com/api/v9';

function authHeader(settings: PluginSettings): string {
  return 'Basic ' + btoa(settings.togglApiToken + ':api_token');
}

async function togglRequest(
  method: string,
  url: string,
  settings: PluginSettings,
  body?: unknown,
): Promise<{ ok: boolean; status: number; data: unknown }> {
  try {
    const headers: Record<string, string> = {
      Authorization: authHeader(settings),
      'Content-Type': 'application/json',
    };
    const response = await PluginAPI.request({ url, method, headers, body });
    const ok = response.status >= 200 && response.status < 300;
    return { ok, status: response.status, data: response.data };
  } catch {
    return { ok: false, status: 0, data: null };
  }
}

export async function startEntry(
  settings: PluginSettings,
  task: SPTask,
): Promise<TogglResult> {
  const url = `${BASE_URL}/workspaces/${settings.workspaceId}/time_entries`;
  const body = {
    description: task.title,
    workspace_id: settings.workspaceId,
    project_id: settings.defaultProjectId,
    start: new Date().toISOString(),
    duration: -1,
    billable: settings.defaultBillable,
    tags: settings.tag ? [settings.tag] : [],
    created_with: 'super-productivity-toggl-plugin',
  };
  const result = await togglRequest('POST', url, settings, body);
  if (!result.ok) return { ok: false, status: result.status };
  const entry = result.data as TogglTimeEntry;
  return { ok: true, entry };
}

export async function stopEntry(
  settings: PluginSettings,
  togglEntryId: number,
): Promise<TogglResult> {
  const url = `${BASE_URL}/workspaces/${settings.workspaceId}/time_entries/${togglEntryId}/stop`;
  const result = await togglRequest('PATCH', url, settings);
  return { ok: result.ok, status: result.status };
}

export async function stopCurrentRunningEntry(
  settings: PluginSettings,
): Promise<void> {
  const url = `${BASE_URL}/me/time_entries/current/stop`;
  // 404 = no running entry, treat as success
  await togglRequest('PATCH', url, settings);
}
