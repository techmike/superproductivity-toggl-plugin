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

function mockFetchSequence(responses: Array<{ ok: boolean; status: number; body: unknown }>) {
  const fn = vi.fn();
  for (const { ok, status, body } of responses) {
    const text = typeof body === 'string' ? body : JSON.stringify(body);
    fn.mockResolvedValueOnce({ ok, status, text: () => Promise.resolve(text) });
  }
  vi.stubGlobal('fetch', fn);
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
      expect(body.description).toBe('[SP] Test task');
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

    it('creates an entry whose description passes stopEntry\'s "[SP]" ownership check', async () => {
      const task = { id: 'sp-1', title: 'Test task', projectId: null, tagIds: [] };
      const createdEntry = { id: 42, workspace_id: 12345, description: '', start: '2024-01-01T10:00:00Z', stop: null, duration: -1 };

      // Capture the description startEntry actually sends, and echo it back as the created entry.
      vi.stubGlobal('fetch', vi.fn().mockImplementation((_url: string, opts: RequestInit) => {
        const body = JSON.parse(opts.body as string);
        createdEntry.description = body.description;
        return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify(createdEntry)) });
      }));

      const { startEntry, stopEntry } = await import('../toggl-client');
      const startResult = await startEntry(settings, task, 99);
      expect(startResult.ok).toBe(true);

      // Now drive stopEntry against the entry startEntry just "created", via a fresh GET+PATCH mock.
      vi.stubGlobal('fetch', vi.fn()
        .mockResolvedValueOnce({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify(createdEntry)) })
        .mockResolvedValueOnce({ ok: true, status: 200, text: () => Promise.resolve('{}') }));

      const stopResult = await stopEntry(settings, createdEntry.id);
      expect(stopResult.ok).toBe(true);
    });
  });

  describe('stopEntry', () => {
    it('fetches the entry, confirms the "[SP]" prefix, then PATCHes the stop URL', async () => {
      mockFetchSequence([
        { ok: true, status: 200, body: { id: 77, workspace_id: 12345, description: '[SP] Test task', start: '', stop: null, duration: -1 } },
        { ok: true, status: 200, body: {} },
      ]);
      const { stopEntry } = await import('../toggl-client');
      const result = await stopEntry(settings, 77);
      expect(result.ok).toBe(true);

      const calls = (fetch as ReturnType<typeof vi.fn>).mock.calls;
      expect(calls[0][0]).toBe('https://api.track.toggl.com/api/v9/workspaces/12345/time_entries/77');
      expect(calls[0][1].method).toBe('GET');
      expect(calls[1][0]).toBe('https://api.track.toggl.com/api/v9/workspaces/12345/time_entries/77/stop');
      expect(calls[1][1].method).toBe('PATCH');
    });

    it('refuses to stop an entry whose description does not start with "[SP]"', async () => {
      mockFetchSequence([
        { ok: true, status: 200, body: { id: 77, workspace_id: 12345, description: 'Some other app entry', start: '', stop: null, duration: -1 } },
      ]);
      const { stopEntry } = await import('../toggl-client');
      const result = await stopEntry(settings, 77);
      expect(result.ok).toBe(false);
      expect((fetch as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);
    });
  });

  describe('stopCurrentRunningEntry', () => {
    it('fetches the current entry, confirms the "[SP]" prefix, then PATCHes the stop URL', async () => {
      mockFetchSequence([
        { ok: true, status: 200, body: { id: 88, workspace_id: 12345, description: '[SP] Test task', start: '', stop: null, duration: -1 } },
        { ok: true, status: 200, body: {} },
      ]);
      const { stopCurrentRunningEntry } = await import('../toggl-client');
      const result = await stopCurrentRunningEntry(settings);
      expect(result.ok).toBe(true);

      const calls = (fetch as ReturnType<typeof vi.fn>).mock.calls;
      expect(calls[0][0]).toBe('https://api.track.toggl.com/api/v9/me/time_entries/current');
      expect(calls[1][0]).toBe('https://api.track.toggl.com/api/v9/workspaces/12345/time_entries/88/stop');
    });

    it('refuses to stop a current entry not created by this plugin', async () => {
      mockFetchSequence([
        { ok: true, status: 200, body: { id: 88, workspace_id: 12345, description: 'Manual entry', start: '', stop: null, duration: -1 } },
      ]);
      const { stopCurrentRunningEntry } = await import('../toggl-client');
      const result = await stopCurrentRunningEntry(settings);
      expect(result.ok).toBe(false);
      expect((fetch as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);
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
