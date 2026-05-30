import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { PluginSettings } from '../types';

const settings: PluginSettings = {
  togglApiToken: 'test-token',
  workspaceId: 12345,
  defaultProjectId: 99,
  defaultBillable: false,
  tag: 'sp',
  stopExistingTogglTimer: false,
  spToTogglProjectMap: {},
};

function mockFetch(ok: boolean, status: number, body: unknown) {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok,
    status,
    text: () => Promise.resolve(text),
  }));
}

describe('toggl-client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('startEntry', () => {
    it('POSTs to the correct URL with auth header and returns entry on success', async () => {
      const entry = { id: 42, workspace_id: 12345, description: 'Test task', start: '2024-01-01T10:00:00Z', stop: null, duration: -1 };
      mockFetch(true, 200, entry);
      const { startEntry } = await import('../toggl-client');
      const task = { id: 'sp-1', title: 'Test task', projectId: null, tagIds: [] };
      const result = await startEntry(settings, task, 99);
      expect(result.ok).toBe(true);
      expect(result.entry?.id).toBe(42);
      const [url, opts] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(url).toBe('https://api.track.toggl.com/api/v9/workspaces/12345/time_entries');
      expect(opts.method).toBe('POST');
      expect(opts.headers.Authorization).toMatch(/^Basic /);
      const body = JSON.parse(opts.body);
      expect(body.project_id).toBe(99);
      expect(body.description).toBe('Test task');
    });

    it('returns ok:false on HTTP error', async () => {
      mockFetch(false, 403, { message: 'Forbidden' });
      const { startEntry } = await import('../toggl-client');
      const result = await startEntry(settings, { id: 'x', title: 'x', projectId: null, tagIds: [] }, null);
      expect(result.ok).toBe(false);
      expect(result.status).toBe(403);
    });

    it('returns ok:false and status 0 on network error', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network failure')));
      const { startEntry } = await import('../toggl-client');
      const result = await startEntry(settings, { id: 'x', title: 'x', projectId: null, tagIds: [] }, null);
      expect(result.ok).toBe(false);
      expect(result.status).toBe(0);
    });
  });

  describe('stopEntry', () => {
    it('PATCHes the correct stop URL', async () => {
      mockFetch(true, 200, {});
      const { stopEntry } = await import('../toggl-client');
      const result = await stopEntry(settings, 77);
      expect(result.ok).toBe(true);
      const [url, opts] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(url).toBe('https://api.track.toggl.com/api/v9/workspaces/12345/time_entries/77/stop');
      expect(opts.method).toBe('PATCH');
    });
  });

  describe('fetchTogglProjects', () => {
    it('returns only active projects', async () => {
      const projects = [
        { id: 1, name: 'Active', active: true },
        { id: 2, name: 'Archived', active: false },
      ];
      mockFetch(true, 200, projects);
      const { fetchTogglProjects } = await import('../toggl-client');
      const result = await fetchTogglProjects(settings);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Active');
    });

    it('returns empty array on API error', async () => {
      mockFetch(false, 403, {});
      const { fetchTogglProjects } = await import('../toggl-client');
      const result = await fetchTogglProjects(settings);
      expect(result).toEqual([]);
    });

    it('includes correct auth header', async () => {
      mockFetch(true, 200, []);
      const { fetchTogglProjects } = await import('../toggl-client');
      await fetchTogglProjects(settings);
      const [, opts] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      // test-token:api_token base64 encoded
      const expected = 'Basic ' + btoa('test-token:api_token');
      expect(opts.headers.Authorization).toBe(expected);
    });
  });
});
