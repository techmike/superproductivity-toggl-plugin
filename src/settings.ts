import { PluginSettings } from './types';
import { getSettings, setSettings, savePluginData } from './storage';
import { fetchTogglProjects } from './toggl-client';

export function loadSettings(): PluginSettings | null {
  return getSettings();
}

export async function saveSettings(settings: PluginSettings): Promise<void> {
  setSettings(settings);
  await savePluginData();
}

export function openSettingsDialog(): void {
  const current = getSettings() ?? {
    togglApiToken: '',
    workspaceId: 0,
    defaultProjectId: null,
    defaultBillable: false,
    tag: 'super-productivity',
    stopExistingTogglTimer: true,
    spToTogglProjectMap: {},
  };

  const matchMap = current.spToTogglProjectMap ?? {};

  const html =
    '<div style="min-width:320px">' +
    '<div style="margin-bottom:12px">' +
    '<label style="display:block;font-size:12px;opacity:0.7;margin-bottom:4px">Toggl API Token *</label>' +
    '<input type="text" id="tgs-token" value="' + escHtml(current.togglApiToken) + '" placeholder="Your Toggl API token" style="width:100%;box-sizing:border-box">' +
    '<div style="font-size:11px;opacity:0.5;margin-top:2px">Profile Settings → API Token at track.toggl.com</div>' +
    '</div>' +
    '<div style="margin-bottom:12px">' +
    '<label style="display:block;font-size:12px;opacity:0.7;margin-bottom:4px">Workspace ID *</label>' +
    '<input type="number" id="tgs-workspace" value="' + escHtml(String(current.workspaceId || '')) + '" placeholder="e.g. 1234567" style="width:100%;box-sizing:border-box">' +
    '<div style="font-size:11px;opacity:0.5;margin-top:2px">Found in Toggl URL: track.toggl.com/workspaces/1234567/</div>' +
    '</div>' +
    '<div style="margin-bottom:12px">' +
    '<label style="display:block;font-size:12px;opacity:0.7;margin-bottom:4px">Fallback Project ID (optional)</label>' +
    '<input type="number" id="tgs-project" value="' + escHtml(String(current.defaultProjectId ?? '')) + '" placeholder="Used for inbox tasks or unmatched projects" style="width:100%;box-sizing:border-box">' +
    '<div style="font-size:11px;opacity:0.5;margin-top:2px">Used when a task has no SP project or no name match is found</div>' +
    '</div>' +
    '<div style="margin-bottom:12px">' +
    '<label style="display:block;font-size:12px;opacity:0.7;margin-bottom:4px">Project Mapping</label>' +
    '<button id="tgs-sync-projects" style="padding:4px 12px;cursor:pointer">Sync Projects by Name</button>' +
    '<div style="font-size:11px;opacity:0.5;margin-top:2px">Matches SP projects to Toggl projects by name (case-insensitive)</div>' +
    buildMatchSummaryHtml(matchMap) +
    '</div>' +
    '<div style="margin-bottom:12px">' +
    '<label style="display:block;font-size:12px;opacity:0.7;margin-bottom:4px">Tag (optional)</label>' +
    '<input type="text" id="tgs-tag" value="' + escHtml(current.tag ?? '') + '" placeholder="e.g. super-productivity" style="width:100%;box-sizing:border-box">' +
    '</div>' +
    '<div style="margin-bottom:8px">' +
    '<label style="display:flex;align-items:center;gap:8px;cursor:pointer">' +
    '<input type="checkbox" id="tgs-billable"' + (current.defaultBillable ? ' checked' : '') + '>' +
    ' Mark entries as billable by default' +
    '</label>' +
    '</div>' +
    '<div>' +
    '<label style="display:flex;align-items:center;gap:8px;cursor:pointer">' +
    '<input type="checkbox" id="tgs-stop-existing"' + (current.stopExistingTogglTimer ? ' checked' : '') + '>' +
    ' Stop any running Toggl timer when starting a new task' +
    '</label>' +
    '</div>' +
    '</div>';

  PluginAPI.openDialog({
    title: 'Toggl Track Sync — Settings',
    htmlContent: html,
    buttons: [
      {
        label: 'Cancel',
        onClick: function () {},
      },
      {
        label: 'Save',
        color: 'primary',
        icon: 'save',
        raised: true,
        onClick: function () {
          const token = (document.getElementById('tgs-token') as HTMLInputElement | null)?.value.trim() ?? '';
          const workspaceRaw = (document.getElementById('tgs-workspace') as HTMLInputElement | null)?.value.trim() ?? '';
          const projectRaw = (document.getElementById('tgs-project') as HTMLInputElement | null)?.value.trim() ?? '';
          const tag = (document.getElementById('tgs-tag') as HTMLInputElement | null)?.value.trim() ?? '';
          const billable = (document.getElementById('tgs-billable') as HTMLInputElement | null)?.checked ?? false;
          const stopExisting = (document.getElementById('tgs-stop-existing') as HTMLInputElement | null)?.checked ?? true;

          if (!token) {
            PluginAPI.showSnack({ msg: 'Toggl Sync: API token is required.', type: 'WARNING' });
            return;
          }
          const workspaceId = parseInt(workspaceRaw, 10);
          if (!workspaceId) {
            PluginAPI.showSnack({ msg: 'Toggl Sync: Workspace ID is required.', type: 'WARNING' });
            return;
          }

          const existing = getSettings();
          saveSettings({
            togglApiToken: token,
            workspaceId,
            defaultProjectId: projectRaw ? parseInt(projectRaw, 10) : null,
            defaultBillable: billable,
            tag: tag || null,
            stopExistingTogglTimer: stopExisting,
            spToTogglProjectMap: existing?.spToTogglProjectMap ?? {},
          }).then(function () {
            PluginAPI.showSnack({ msg: 'Toggl Sync: settings saved.', type: 'SUCCESS' });
          });
        },
      },
    ],
  });

  // Wire up Sync Projects button after dialog renders
  setTimeout(function () {
    const btn = document.getElementById('tgs-sync-projects');
    if (!btn) return;
    btn.addEventListener('click', function () {
      const tokenEl = document.getElementById('tgs-token') as HTMLInputElement | null;
      const workspaceEl = document.getElementById('tgs-workspace') as HTMLInputElement | null;
      const token = tokenEl?.value.trim() ?? '';
      const workspaceId = parseInt(workspaceEl?.value.trim() ?? '', 10);
      if (!token || !workspaceId) {
        PluginAPI.showSnack({ msg: 'Toggl Sync: enter API token and Workspace ID first.', type: 'WARNING' });
        return;
      }
      btn.textContent = 'Syncing…';
      (btn as HTMLButtonElement).disabled = true;
      syncProjectsByName({ ...current, togglApiToken: token, workspaceId }).then(function (matched) {
        btn.textContent = 'Sync Projects by Name';
        (btn as HTMLButtonElement).disabled = false;
        PluginAPI.showSnack({ msg: `Toggl Sync: matched ${matched} project(s).`, type: 'SUCCESS' });
        // Refresh summary in dialog
        const summaryEl = document.getElementById('tgs-match-summary');
        if (summaryEl) {
          const updatedMap = getSettings()?.spToTogglProjectMap ?? {};
          summaryEl.innerHTML = buildMatchSummaryHtml(updatedMap);
        }
      }).catch(function () {
        btn.textContent = 'Sync Projects by Name';
        (btn as HTMLButtonElement).disabled = false;
        PluginAPI.showSnack({ msg: 'Toggl Sync: project sync failed.', type: 'ERROR' });
      });
    });
  }, 100);
}

async function syncProjectsByName(settings: PluginSettings): Promise<number> {
  const [togglProjects, spProjects] = await Promise.all([
    fetchTogglProjects(settings),
    PluginAPI.getAllProjects(),
  ]);

  const togglByName = new Map<string, number>();
  for (const p of togglProjects) {
    togglByName.set(p.name.trim().toLowerCase(), p.id);
  }

  const map: Record<string, number> = {};
  let matched = 0;
  for (const sp of spProjects) {
    const togglId = togglByName.get(sp.title.trim().toLowerCase());
    if (togglId !== undefined) {
      map[sp.id] = togglId;
      matched++;
    }
  }

  const existing = getSettings();
  if (existing) {
    await saveSettings({ ...existing, spToTogglProjectMap: map });
  }
  return matched;
}

function buildMatchSummaryHtml(map: Record<string, number>): string {
  const count = Object.keys(map).length;
  if (count === 0) {
    return '<div id="tgs-match-summary" style="font-size:11px;opacity:0.5;margin-top:4px">No projects synced yet — click the button above</div>';
  }
  return '<div id="tgs-match-summary" style="font-size:11px;opacity:0.6;margin-top:4px">' + count + ' project(s) mapped. Click button to refresh.</div>';
}

function escHtml(str: string | null | undefined): string {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str ?? ''));
  return div.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
