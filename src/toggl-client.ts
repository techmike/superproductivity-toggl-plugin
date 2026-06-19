import { PluginSettings, SPTask, TogglProject, TogglResult, TogglTimeEntry } from './types';

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
    console.log('[toggl-sync] fetch', method, url);
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: authHeader(settings),
        'Content-Type': 'application/json',
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await response.text();
    let data: unknown = text;
    try { data = JSON.parse(text); } catch { /* keep raw text */ }
    console.log('[toggl-sync] response', response.status, typeof data === 'object' ? JSON.stringify(data) : data);
    return { ok: response.ok, status: response.status, data };
  } catch (err) {
    console.error('[toggl-sync] fetch threw:', err);
    return { ok: false, status: 0, data: null };
  }
}

export async function fetchTogglProjects(
  settings: PluginSettings,
): Promise<TogglProject[]> {
  const url = `${BASE_URL}/workspaces/${settings.workspaceId}/projects`;
  const result = await togglRequest('GET', url, settings);
  if (!result.ok) return [];
  const projects = result.data as TogglProject[];
  return projects.filter((p) => p.active);
}

export async function startEntry(
  settings: PluginSettings,
  task: SPTask,
  projectId: number | null,
): Promise<TogglResult> {
  const url = `${BASE_URL}/workspaces/${settings.workspaceId}/time_entries`;
  const body = {
    description: task.title,
    workspace_id: settings.workspaceId,
    project_id: projectId,
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

const SP_ENTRY_PREFIX = '[SP]';

function wasCreatedByThisPlugin(entry: TogglTimeEntry | null | undefined): boolean {
  return !!entry?.description?.startsWith(SP_ENTRY_PREFIX);
}

export async function stopEntry(
  settings: PluginSettings,
  togglEntryId: number,
): Promise<TogglResult> {
  const getUrl = `${BASE_URL}/workspaces/${settings.workspaceId}/time_entries/${togglEntryId}`;
  const getResult = await togglRequest('GET', getUrl, settings);
  if (!getResult.ok) return { ok: false, status: getResult.status };

  const entry = getResult.data as TogglTimeEntry;
  if (!wasCreatedByThisPlugin(entry)) {
    console.warn('[toggl-sync] refusing to stop entry not created by this plugin:', togglEntryId);
    return { ok: false, status: 403 };
  }

  const url = `${BASE_URL}/workspaces/${settings.workspaceId}/time_entries/${togglEntryId}/stop`;
  const result = await togglRequest('PATCH', url, settings);
  return { ok: result.ok, status: result.status };
}

export async function stopCurrentRunningEntry(
  settings: PluginSettings,
): Promise<TogglResult> {
  const currentUrl = `${BASE_URL}/me/time_entries/current`;
  const currentResult = await togglRequest('GET', currentUrl, settings);
  if (!currentResult.ok || !currentResult.data) return { ok: false, status: currentResult.status };

  const entry = currentResult.data as TogglTimeEntry;
  if (!wasCreatedByThisPlugin(entry)) {
    console.warn('[toggl-sync] refusing to stop current entry not created by this plugin');
    return { ok: false, status: 403 };
  }

  const stopUrl = `${BASE_URL}/workspaces/${settings.workspaceId}/time_entries/${entry.id}/stop`;
  const result = await togglRequest('PATCH', stopUrl, settings);
  return { ok: result.ok, status: result.status };
}
