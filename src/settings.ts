import { PluginSettings } from './types';
import { getSettings, setSettings, savePluginData } from './storage';

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
  };

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
    '<label style="display:block;font-size:12px;opacity:0.7;margin-bottom:4px">Default Project ID (optional)</label>' +
    '<input type="number" id="tgs-project" value="' + escHtml(String(current.defaultProjectId ?? '')) + '" placeholder="Leave blank for no project" style="width:100%;box-sizing:border-box">' +
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

          saveSettings({
            togglApiToken: token,
            workspaceId,
            defaultProjectId: projectRaw ? parseInt(projectRaw, 10) : null,
            defaultBillable: billable,
            tag: tag || null,
            stopExistingTogglTimer: stopExisting,
          }).then(function () {
            PluginAPI.showSnack({ msg: 'Toggl Sync: settings saved.', type: 'SUCCESS' });
          });
        },
      },
    ],
  });
}

function escHtml(str: string | null | undefined): string {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str ?? ''));
  return div.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
