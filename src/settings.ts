import { PluginSettings } from './types';

const STORAGE_KEY = 'toggl-plugin-settings';

export function loadSettings(): PluginSettings | null {
  const raw = PluginAPI.loadSyncedData(STORAGE_KEY) as PluginSettings | null;
  if (!raw || !raw.togglApiToken || !raw.workspaceId) {
    return null;
  }
  return raw;
}

export function saveSettings(settings: PluginSettings): void {
  PluginAPI.persistDataSynced(STORAGE_KEY, settings);
}

export function openSettingsDialog(): void {
  const current = (PluginAPI.loadSyncedData(STORAGE_KEY) as PluginSettings | null) ?? {
    togglApiToken: '',
    workspaceId: 0,
    defaultProjectId: null,
    defaultBillable: false,
    tag: 'super-productivity',
    stopExistingTogglTimer: true,
  };

  const html = `
    <style>
      .tgs-field { display: flex; flex-direction: column; margin-bottom: 12px; }
      .tgs-field label { font-size: 12px; margin-bottom: 4px; opacity: 0.7; }
      .tgs-field input[type="text"],
      .tgs-field input[type="number"] {
        padding: 6px 8px;
        border: 1px solid rgba(255,255,255,0.2);
        border-radius: 4px;
        background: rgba(255,255,255,0.05);
        color: inherit;
        font-size: 14px;
      }
      .tgs-row { display: flex; align-items: center; gap: 8px; }
      .tgs-hint { font-size: 11px; opacity: 0.5; margin-top: 2px; }
      .tgs-section { margin-bottom: 16px; }
    </style>
    <div style="min-width:320px">
      <div class="tgs-section">
        <div class="tgs-field">
          <label>Toggl API Token *</label>
          <input type="text" id="tgs-token" value="${escHtml(current.togglApiToken)}" placeholder="Your Toggl API token" />
          <span class="tgs-hint">Profile Settings → API Token at track.toggl.com</span>
        </div>
        <div class="tgs-field">
          <label>Workspace ID *</label>
          <input type="number" id="tgs-workspace" value="${current.workspaceId || ''}" placeholder="e.g. 1234567" />
          <span class="tgs-hint">Found in the Toggl URL: /workspaces/1234567/</span>
        </div>
        <div class="tgs-field">
          <label>Default Project ID (optional)</label>
          <input type="number" id="tgs-project" value="${current.defaultProjectId ?? ''}" placeholder="Leave blank for no project" />
        </div>
        <div class="tgs-field">
          <label>Tag (optional)</label>
          <input type="text" id="tgs-tag" value="${escHtml(current.tag ?? '')}" placeholder="e.g. super-productivity" />
        </div>
        <div class="tgs-row" style="margin-bottom:8px">
          <input type="checkbox" id="tgs-billable" ${current.defaultBillable ? 'checked' : ''} />
          <label for="tgs-billable">Mark entries as billable by default</label>
        </div>
        <div class="tgs-row">
          <input type="checkbox" id="tgs-stop-existing" ${current.stopExistingTogglTimer ? 'checked' : ''} />
          <label for="tgs-stop-existing">Stop any running Toggl timer when starting a new task</label>
        </div>
      </div>
    </div>
  `;

  PluginAPI.openDialog({
    title: 'Toggl Track Sync — Settings',
    htmlContent: html,
    buttons: [
      {
        label: 'Cancel',
        onClick: () => {},
      },
      {
        label: 'Save',
        color: 'primary',
        icon: 'save',
        raised: true,
        onClick: () => {
          const token = (document.getElementById('tgs-token') as HTMLInputElement).value.trim();
          const workspaceRaw = (document.getElementById('tgs-workspace') as HTMLInputElement).value.trim();
          const projectRaw = (document.getElementById('tgs-project') as HTMLInputElement).value.trim();
          const tag = (document.getElementById('tgs-tag') as HTMLInputElement).value.trim();
          const billable = (document.getElementById('tgs-billable') as HTMLInputElement).checked;
          const stopExisting = (document.getElementById('tgs-stop-existing') as HTMLInputElement).checked;

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
          });

          PluginAPI.showSnack({ msg: 'Toggl Sync: settings saved.', type: 'SUCCESS' });
        },
      },
    ],
  });
}

function escHtml(str: string | null | undefined): string {
  return (str ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
