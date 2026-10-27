// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { SyncCoordinator, type IWorkspaceSyncRepository } from '../coordinator';
import type {
  NotebookRecord,
  NoteRecord,
  AssetRecord,
  OutboxMutation,
} from '@/src/shared/personal-workspace/contracts';

describe('SyncCoordinator', () => {
  let mockNotebooks: NotebookRecord[];
  let mockNotes: NoteRecord[];
  let mockAssets: AssetRecord[];
  let mockOutbox: OutboxMutation[];
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
    mockOutbox = [];
    acknowledgedBatch = [];
    savedConflictNotes = [];

    mockRepo = {
      userId: 'user-test-1',
      storageName: 'workspace_user-test-1',
      getPendingOutboxMutations: vi.fn(async () => [...mockOutbox]),
      getPendingOutbox: vi.fn(async () => [...mockOutbox]),
      acknowledgeOutboxBatch: vi.fn(async (ids: string[]) => {
        acknowledgedBatch.push(...ids);
        mockOutbox = mockOutbox.filter((m) => !ids.includes(m.id));
      }),
      acknowledgeOutboxUpTo: vi.fn(async (gen: number) => {
        mockOutbox = mockOutbox.filter((m) => (m.generation ?? 0) > gen);
      }),
      getAllNotebooks: vi.fn(async () => [...mockNotebooks]),
      getAllNotes: vi.fn(async () => [...mockNotes]),
      getAllAssets: vi.fn(async () => [...mockAssets]),
      saveNoteAtomic: vi.fn(async (note: NoteRecord) => {
        savedConflictNotes.push(note);
        mockNotes.push(note);
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
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        connected: true,
        repoFullName: 'testowner/notes',
        lastCommitSha: 'sha-remote-123',
      }),
    });

    const coordinator = new SyncCoordinator(mockRepo, { fetchFn: mockFetch });
    const result = await coordinator.syncNow();

    expect(result.ok).toBe(true);
    expect(result.status).toBe('synced');
    expect(coordinator.status).toBe('synced');
    expect(coordinator.lastRemoteCommitSha).toBe('sha-remote-123');
    // Ensure publish was not called
    expect(mockFetch).toHaveBeenCalledTimes(1);
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
          json: async () => ({
            ok: true,
            connected: true,
            lastCommitSha: 'sha-base-000',
          }),
        };
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
    coordinator.lastRemoteCommitSha = 'sha-base-000';

    const result = await coordinator.syncNow();

    expect(result.ok).toBe(true);
    expect(result.newCommitSha).toBe('sha-published-999');
    expect(coordinator.status).toBe('synced');
    expect(coordinator.lastRemoteCommitSha).toBe('sha-published-999');
    expect(coordinator.lastSyncedAt).not.toBeNull();

    // Verify outbox batch acknowledgement
    expect(mockRepo.acknowledgeOutboxBatch).toHaveBeenCalledWith(['outbox-1']);
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
          json: async () => ({ ok: true, connected: true, lastCommitSha: 'sha-initial' }),
        };
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
      if (url.includes('/pull')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            remoteCommitSha: 'sha-remote-diverged-555',
            state: {
              notebooks: mockNotebooks,
              notes: [remoteNote],
              assets: [],
            },
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
      if (url.includes('/publish')) {
        await publishPromise;
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: true, newCommitSha: 'sha-multi-1' }),
        };
      }
      return { ok: true, json: async () => ({}) };
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
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        connected: true,
        lastCommitSha: 'sha-broadcast',
      }),
    });

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

  it('handles startAutoSync, window online/offline listeners, and stopAutoSync', async () => {
    vi.useFakeTimers();

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        connected: true,
        lastCommitSha: 'sha-timer',
      }),
    });

    const coordinator = new SyncCoordinator(mockRepo, {
      fetchFn: mockFetch,
      autoSyncIntervalMs: 10000,
    });

    coordinator.startAutoSync();

    // Fast forward 10 seconds
    await vi.advanceTimersByTimeAsync(10000);
    expect(mockFetch).toHaveBeenCalled();

    // Simulate offline event
    window.dispatchEvent(new Event('offline'));
    expect(coordinator.status).toBe('offline');

    // Simulate online event
    mockFetch.mockClear();
    window.dispatchEvent(new Event('online'));
    // online triggers syncNow
    expect(mockFetch).toHaveBeenCalled();

    // Clean up
    coordinator.stopAutoSync();
    coordinator.dispose();
  });
});
