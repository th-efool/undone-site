// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { SyncCoordinator, type IWorkspaceSyncRepository } from '../coordinator';
import type {
  NotebookRecord,
  NoteRecord,
  AssetRecord,
  OutboxMutation,
  ScheduleTaskRecord,
} from '@/src/shared/personal-workspace/contracts';
import { canonicalJsonStringify, computeSha256 } from '@/src/shared/personal-workspace/serialization';

describe('SyncCoordinator', () => {
  let mockNotebooks: NotebookRecord[];
  let mockNotes: NoteRecord[];
  let mockAssets: AssetRecord[];
  let mockSchedules: ScheduleTaskRecord[];
  let mockOutbox: OutboxMutation[];
  let mockRemoteBaseSha: string | null;
  let acknowledgedBatch: string[];
  let savedConflictNotes: NoteRecord[];
  let mockRepo: IWorkspaceSyncRepository;

  beforeEach(() => {
    mockNotebooks = [
      {
        id: 'nb-1',
        title: 'Work Notebook',
        color: '#ff0000',
        favorite: false,
        archived: false,
        order: 0,
      },
    ];

    mockNotes = [
      {
        id: 'note-1',
        notebookId: 'nb-1',
        title: 'Project Roadmap',
        contentType: 'canvas',
        order: 0,
        createdAt: '2026-10-27T10:00:00Z',
        updatedAt: '2026-10-27T10:00:00Z',
        canvasData: {
          elements: [{ id: 'el-1', type: 'rectangle' }],
          appState: {},
        },
      },
    ];

    mockAssets = [];
    mockSchedules = [];
    mockOutbox = [];
    mockRemoteBaseSha = null;
    acknowledgedBatch = [];
    savedConflictNotes = [];

    mockRepo = {
      userId: 'user-test-1',
      storageName: 'workspace_user-test-1',
      getPendingOutboxMutations: vi.fn(async () => [...mockOutbox]),
      getPendingOutbox: vi.fn(async () => [...mockOutbox]),
      getRemoteBaseCommitSha: vi.fn(async () => mockRemoteBaseSha),
      applyRemoteSnapshot: vi.fn(async (snapshot, sha) => {
        const merge = <T extends { id: string }>(
          local: T[], remote: T[], entityType: OutboxMutation['entityType'],
        ) => {
          const dirty = new Set(mockOutbox.filter((m) => m.entityType === entityType).map((m) => m.entityId));
          return [
            ...local.filter((item) => dirty.has(item.id)),
            ...remote.filter((item) => !dirty.has(item.id)),
          ];
        };
        mockNotebooks = merge(mockNotebooks, snapshot.notebooks, 'notebook');
        mockNotes = merge(mockNotes, snapshot.notes, 'note');
        mockAssets = merge(mockAssets, snapshot.assets, 'asset');
        mockSchedules = merge(mockSchedules, snapshot.schedules, 'schedule');
        mockRemoteBaseSha = sha;
      }),
      getSyncSnapshot: vi.fn(async () => ({
        notebooks: [...mockNotebooks], notes: [...mockNotes], assets: [...mockAssets],
        schedules: [...mockSchedules], outbox: [...mockOutbox],
      })),
      acknowledgePublishedBatch: vi.fn(async (ids: string[], sha: string) => {
        acknowledgedBatch.push(...ids);
        mockOutbox = mockOutbox.filter((m) => !ids.includes(m.id));
        mockRemoteBaseSha = sha;
      }),
      acknowledgeOutboxBatch: vi.fn(async (ids: string[]) => {
        acknowledgedBatch.push(...ids);
        mockOutbox = mockOutbox.filter((m) => !ids.includes(m.id));
      }),
      acknowledgeOutboxUpTo: vi.fn(async (gen: number) => {
        mockOutbox = mockOutbox.filter((m) => (m.generation ?? 0) > gen);
      }),
      getAllNotebooks: (async <T = NotebookRecord>() => [...mockNotebooks] as unknown as T[]) as IWorkspaceSyncRepository['getAllNotebooks'],
      getAllNotes: (async <T = NoteRecord>() => [...mockNotes] as unknown as T[]) as IWorkspaceSyncRepository['getAllNotes'],
      getAllAssets: (async <T = AssetRecord>() => [...mockAssets] as unknown as T[]) as IWorkspaceSyncRepository['getAllAssets'],
      saveNoteAtomic: vi.fn(async <T extends { id: string; contentType?: string } = NoteRecord>(note: T) => {
        savedConflictNotes.push(note as unknown as NoteRecord);
        mockNotes.push(note as unknown as NoteRecord);
        return { ok: true };
      }),
      getDatabase: vi.fn(() => ({
        runTransaction: vi.fn(async (_stores, _mode, cb) => {
          return cb({
            get: vi.fn(),
            getAll: vi.fn(() => []),
            put: vi.fn(),
            delete: vi.fn(),
          });
        }),
      })),
    };
  });

  const makePullResponse = (
    commitSha: string | null = mockRemoteBaseSha ?? 'sha-remote',
    records: {
      notebooks?: NotebookRecord[];
      notes?: NoteRecord[];
      assets?: AssetRecord[];
      schedules?: ScheduleTaskRecord[];
    } = {},
  ) => {
    const notebooks = records.notebooks ?? mockNotebooks;
    const notes = records.notes ?? mockNotes;
    const assets = records.assets ?? mockAssets;
    const schedules = records.schedules ?? mockSchedules;
    return {
      ok: true,
      commitSha,
      manifest: commitSha ? {
        manifestVersion: 1 as const,
        workspaceId: 'user-test-1',
        notebooks: notebooks.map((nb) => ({ id: nb.id, path: `undone/notebooks/${nb.id}.json`, hash: computeSha256(canonicalJsonStringify(nb)) })),
        notes: notes.map((note) => ({ id: note.id, path: `undone/notes/${note.id}.json`, hash: computeSha256(canonicalJsonStringify(note)), contentType: note.contentType })),
        assets: assets.map((asset) => ({ id: asset.id, path: `undone/assets/${asset.id}`, sha256: asset.hash, gitSha: 'c'.repeat(40), mimeType: asset.mimeType })),
        schedules: schedules.length ? [{ id: 'tasks', path: 'undone/schedules/tasks.json', hash: computeSha256(canonicalJsonStringify(schedules)) }] : undefined,
      } : null,
      notebooks,
      notes,
      assets,
      schedules,
    };
  };

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('initializes with idle status and clean properties', () => {
    const coordinator = new SyncCoordinator(mockRepo);

    expect(coordinator.status).toBe('idle');
    expect(coordinator.lastSyncedAt).toBeNull();
    expect(coordinator.lastRemoteCommitSha).toBeNull();
    expect(coordinator.isSyncing).toBe(false);
    expect(coordinator.conflictCount).toBe(0);

    const summary = coordinator.getCurrentSummary();
    expect(summary.status).toBe('idle');
    expect(summary.conflictCount).toBe(0);
  });

  it('returns not connected error if GitHub status check fails or indicates disconnected', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, connected: false }),
    });

    const coordinator = new SyncCoordinator(mockRepo, { fetchFn: mockFetch });
    const result = await coordinator.syncNow();

    expect(result.ok).toBe(false);
    expect(result.error).toBe('Not connected');
    expect(coordinator.status).toBe('reconnect_required');
    expect(mockFetch).toHaveBeenCalledWith('/api/personal-workspace/github/status', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
  });

  it('marks status as reconnect_required on HTTP 401 or 403', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Unauthorized' }),
    });

    const coordinator = new SyncCoordinator(mockRepo, { fetchFn: mockFetch });
    const result = await coordinator.syncNow();

    expect(result.ok).toBe(false);
    expect(result.error).toBe('Not connected');
    expect(coordinator.status).toBe('reconnect_required');
  });

  it('marks status as synced when there are no pending mutations', async () => {
    const mockFetch = vi.fn().mockImplementation(async (url: string) =>
      url.includes('/status')
        ? { ok: true, status: 200, json: async () => ({ connected: true, repoFullName: 'testowner/notes' }) }
        : { ok: true, status: 200, json: async () => makePullResponse('sha-remote-123') },
    );

    const coordinator = new SyncCoordinator(mockRepo, { fetchFn: mockFetch });
    const result = await coordinator.syncNow();

    expect(result.ok).toBe(true);
    expect(result.status).toBe('synced');
    expect(coordinator.status).toBe('synced');
    expect(coordinator.lastRemoteCommitSha).toBe('sha-remote-123');
    expect(mockRepo.applyRemoteSnapshot).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(String(mockFetch.mock.calls[1][0])).toContain('/pull');
  });

  it('applies remote-only records on an empty-outbox sync', async () => {
    const remoteNote = { ...mockNotes[0], id: 'remote-note', title: 'Remote-only note' };
    const mockFetch = vi.fn().mockImplementation(async (url: string) =>
      url.includes('/status')
        ? { ok: true, status: 200, json: async () => ({ connected: true }) }
        : { ok: true, status: 200, json: async () => makePullResponse('sha-remote-only', { notes: [remoteNote] }) },
    );

    const coordinator = new SyncCoordinator(mockRepo, { fetchFn: mockFetch });
    const result = await coordinator.syncNow();

    expect(result.ok).toBe(true);
    expect(mockNotes.map((note) => note.id)).toEqual(['remote-note']);
    expect(coordinator.lastRemoteCommitSha).toBe('sha-remote-only');
    expect(mockFetch.mock.calls.some((call) => String(call[0]).includes('/publish'))).toBe(false);
  });

  it('keeps a local edit made while pull is in flight and publishes that latest generation', async () => {
    const latestLocalNote = { ...mockNotes[0], title: 'Edited during pull' };
    const remoteNote = { ...mockNotes[0], title: 'Remote title' };
    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/status')) return { ok: true, status: 200, json: async () => ({ connected: true }) };
      if (url.includes('/pull')) {
        mockNotes = [latestLocalNote];
        mockOutbox = [{
          id: 'outbox-during-pull', clientTimestamp: new Date().toISOString(), mutationType: 'update',
          entityType: 'note', entityId: 'note-1', payload: latestLocalNote, status: 'pending',
          retryCount: 0, generation: 2,
        }];
        return { ok: true, status: 200, json: async () => makePullResponse('sha-before-publish', { notes: [remoteNote] }) };
      }
      if (url.includes('/publish')) return { ok: true, status: 200, json: async () => ({ ok: true, newCommitSha: 'sha-published-latest' }) };
      return { ok: false, status: 404, json: async () => ({}) };
    });

    const coordinator = new SyncCoordinator(mockRepo, { fetchFn: mockFetch });
    const result = await coordinator.syncNow();
    const publishCall = mockFetch.mock.calls.find((call) => String(call[0]).includes('/publish'));
    const body = JSON.parse(publishCall![1].body);

    expect(result.ok).toBe(true);
    expect(mockNotes.find((note) => note.id === 'note-1')?.title).toBe('Edited during pull');
    expect(body.state.notes.find((note: NoteRecord) => note.id === 'note-1').title).toBe('Edited during pull');
    expect(body.mutations.map((mutation: OutboxMutation) => mutation.id)).toContain('outbox-during-pull');
  });

  it('successfully publishes pending outbox mutations, acknowledges batch, and advances commit sha', async () => {
    mockOutbox = [
      {
        id: 'outbox-1',
        clientTimestamp: new Date().toISOString(),
        mutationType: 'update',
        entityType: 'note',
        entityId: 'note-1',
        payload: mockNotes[0],
        status: 'pending',
        retryCount: 0,
        generation: 1,
      },
    ];

    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/status')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: true, connected: true }),
        };
      }
      if (url.includes('/pull')) {
        return { ok: true, status: 200, json: async () => makePullResponse('sha-base-000') };
      }
      if (url.includes('/publish')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            newCommitSha: 'sha-published-999',
          }),
        };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    });

    const coordinator = new SyncCoordinator(mockRepo, { fetchFn: mockFetch });
    const result = await coordinator.syncNow();

    expect(result.ok).toBe(true);
    expect(result.newCommitSha).toBe('sha-published-999');
    expect(coordinator.status).toBe('synced');
    expect(coordinator.lastRemoteCommitSha).toBe('sha-published-999');
    expect(coordinator.lastSyncedAt).not.toBeNull();

    // Verify outbox batch acknowledgement
    expect(mockRepo.acknowledgePublishedBatch).toHaveBeenCalledWith(['outbox-1'], 'sha-published-999');
    expect(acknowledgedBatch).toContain('outbox-1');

    // Verify publish request body
    const publishCall = mockFetch.mock.calls.find((call) =>
      String(call[0]).includes('/publish'),
    );
    expect(publishCall).toBeDefined();
    const sentBody = JSON.parse(publishCall![1].body);
    expect(sentBody.expectedRemoteCommitSha).toBe('sha-base-000');
    expect(sentBody.mutations).toHaveLength(1);
    expect(sentBody.state.notes).toHaveLength(1);
  });

  it('detects CAS conflict (422), pulls remote state, and creates branched conflict copy with no lost edits', async () => {
    // Local has an edit on note-1
    mockOutbox = [
      {
        id: 'outbox-conflict-1',
        clientTimestamp: new Date().toISOString(),
        mutationType: 'update',
        entityType: 'note',
        entityId: 'note-1',
        payload: { ...mockNotes[0], title: 'Local Version Title' },
        status: 'pending',
        retryCount: 0,
        generation: 2,
      },
    ];

    const remoteNote: NoteRecord = {
      id: 'note-1',
      notebookId: 'nb-1',
      title: 'Remote Edited Title',
      contentType: 'canvas',
      order: 0,
      createdAt: '2026-10-27T10:00:00Z',
      updatedAt: '2026-10-27T10:15:00Z',
      canvasData: {
        elements: [{ id: 'el-remote', type: 'circle' }],
        appState: {},
      },
    };

    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/status')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: true, connected: true }),
        };
      }
      if (url.includes('/pull')) {
        return {
          ok: true,
          status: 200,
          json: async () => makePullResponse('sha-remote-diverged-555', { notes: [remoteNote] }),
        };
      }
      if (url.includes('/pull')) {
        return { ok: true, status: 200, json: async () => makePullResponse() };
      }
      if (url.includes('/publish')) {
        return {
          ok: false,
          status: 422,
          json: async () => ({
            ok: false,
            conflict: true,
            error: 'CAS conflict: remote ref has diverged',
          }),
        };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    });

    const coordinator = new SyncCoordinator(mockRepo, { fetchFn: mockFetch });
    const result = await coordinator.syncNow();

    expect(result.ok).toBe(false);
    expect(result.status).toBe('conflict');
    expect(result.conflict).toBe(true);
    expect(coordinator.status).toBe('conflict');
    expect(coordinator.conflictCount).toBe(1);
    expect(coordinator.lastRemoteCommitSha).toBe('sha-remote-diverged-555');

    // Verify branched conflict copy was created
    expect(mockRepo.saveNoteAtomic).toHaveBeenCalled();
    expect(savedConflictNotes).toHaveLength(1);

    const conflictCopy = savedConflictNotes[0];
    expect(conflictCopy.id).not.toBe('note-1');
    expect(conflictCopy.title).toContain('Remote Edited Title (Remote Conflict');
    expect(conflictCopy.contentType).toBe('canvas');

    // Local outbox was NOT deleted because of conflict
    expect(acknowledgedBatch).toHaveLength(0);
  });

  it('handles queued sync requests when sync is already in progress', async () => {
    let resolveFirstPublish: (val: unknown) => void;
    const publishPromise = new Promise((resolve) => {
      resolveFirstPublish = resolve;
    });

    mockOutbox = [
      {
        id: 'outbox-first',
        clientTimestamp: new Date().toISOString(),
        mutationType: 'update',
        entityType: 'note',
        entityId: 'note-1',
        payload: mockNotes[0],
        status: 'pending',
        retryCount: 0,
        generation: 1,
      },
    ];

    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/status')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: true, connected: true }),
        };
      }
      if (url.includes('/pull')) {
        return { ok: true, status: 200, json: async () => makePullResponse() };
      }
      if (url.includes('/publish')) {
        await publishPromise;
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: true, newCommitSha: 'sha-multi-1' }),
        };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    });

    const coordinator = new SyncCoordinator(mockRepo, { fetchFn: mockFetch });

    // Start first sync
    const firstSyncPromise = coordinator.syncNow();
    expect(coordinator.isSyncing).toBe(true);

    // Call syncNow() again concurrently
    const secondSyncPromise = coordinator.syncNow();

    // Finish first publish
    resolveFirstPublish!({ ok: true });

    const [firstResult, secondResult] = await Promise.all([firstSyncPromise, secondSyncPromise]);
    expect(firstResult.ok).toBe(true);
    expect(secondResult.ok).toBe(true);
    expect(coordinator.isSyncing).toBe(false);
  });

  it('manages subscriptions and broadcasts sync summary updates', async () => {
    const mockFetch = vi.fn().mockImplementation(async (url: string) =>
      url.includes('/status')
        ? { ok: true, status: 200, json: async () => ({ connected: true }) }
        : { ok: true, status: 200, json: async () => makePullResponse('sha-broadcast') },
    );

    const coordinator = new SyncCoordinator(mockRepo, { fetchFn: mockFetch });
    const listener = vi.fn();

    const unsubscribe = coordinator.subscribe(listener);
    // Initial emission upon subscription
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'idle',
        conflictCount: 0,
      }),
    );

    listener.mockClear();

    // Trigger sync
    await coordinator.syncNow();

    // Listener should have received synced summary
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'synced',
      }),
    );

    // Unsubscribe and trigger again
    unsubscribe();
    listener.mockClear();
    await coordinator.syncNow();
    expect(listener).not.toHaveBeenCalled();
  });

  it('retries transient failures with bounded backoff', async () => {
    vi.useFakeTimers();
    let statusAttempts = 0;
    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/status')) {
        statusAttempts += 1;
        if (statusAttempts === 1) return { ok: false, status: 503, json: async () => ({}) };
        return { ok: true, status: 200, json: async () => ({ connected: true }) };
      }
      return { ok: true, status: 200, json: async () => makePullResponse('sha-retried') };
    });
    const coordinator = new SyncCoordinator(mockRepo, { fetchFn: mockFetch });

    const failed = await coordinator.syncNow();
    expect(failed.status).toBe('error');
    await vi.advanceTimersByTimeAsync(1000);

    expect(coordinator.status).toBe('synced');
    expect(coordinator.lastRemoteCommitSha).toBe('sha-retried');
    coordinator.dispose();
  });

  it('handles startAutoSync, window online/offline listeners, and stopAutoSync', async () => {
    vi.useFakeTimers();

    const mockFetch = vi.fn().mockImplementation(async (url: string) =>
      url.includes('/status')
        ? { ok: true, status: 200, json: async () => ({ connected: true }) }
        : { ok: true, status: 200, json: async () => makePullResponse('sha-timer') },
    );

    const coordinator = new SyncCoordinator(mockRepo, {
      fetchFn: mockFetch,
      autoSyncIntervalMs: 10000,
    });

    coordinator.startAutoSync();

    // Fast forward 10 seconds
    await vi.advanceTimersByTimeAsync(10000);
    expect(mockFetch).toHaveBeenCalled();

    mockFetch.mockClear();
    window.dispatchEvent(new Event('focus'));
    expect(mockFetch).toHaveBeenCalled();

    // Simulate offline event
    window.dispatchEvent(new Event('offline'));
    expect(coordinator.status).toBe('offline');

    // Simulate online event
    mockFetch.mockClear();
    window.dispatchEvent(new Event('online'));
    await coordinator.syncNow();
    // online triggers syncNow
    expect(mockFetch).toHaveBeenCalled();

    // Clean up
    coordinator.stopAutoSync();
    coordinator.dispose();
  });
});
