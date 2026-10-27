/**
 * Comprehensive Unit Tests for Production Local Storage Engine & Repository
 * Tests:
 * - src/client/personal-workspace/local/database.ts
 * - src/client/personal-workspace/local/repository.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  PersonalWorkspaceDatabase,
  TabLockCoordinator,
  TransactionAbortError,
  LockAcquisitionTimeoutError,
  FROZEN_OFFLINE_CAPABILITY_PROMISES,
  ALL_STORE_NAMES,
  type SaveSuccessEvent,
} from '../database';
import { PersonalWorkspaceRepository } from '../repository';
import {
  FIXTURE_NOTEBOOK,
  FIXTURE_CANVAS_NOTE,
  FIXTURE_CANVAS_ASSET,
  FIXTURE_KANBAN_NOTE,
  SYNTHETIC_ASSET_HASH,
} from '@/src/client/screens/dashboard/notes/validation/fixtures';

describe('Production Personal Workspace Local Storage Engine & Repository', () => {
  const TEST_USER_1 = 'user-alice-prod';
  const TEST_USER_2 = 'user-bob-prod';
  let repo1: PersonalWorkspaceRepository;

  beforeEach(async () => {
    TabLockCoordinator.resetAllLocks();
    repo1 = new PersonalWorkspaceRepository(TEST_USER_1, { useMemory: true });
    await repo1.clearAll();
  });

  afterEach(async () => {
    await repo1.clearAll();
    TabLockCoordinator.resetAllLocks();
  });

  describe('1. Store Names & Account Isolation', () => {
    it('verifies all 8 production stores exist in engine', () => {
      expect(ALL_STORE_NAMES).toEqual([
        'notebooks',
        'notes',
        'assets',
        'outbox',
        'editor_buffers',
        'metadata',
        'conflicts',
        'schedules',
      ]);
    });

    it('strictly isolates storage by userId: workspace_${userId}', async () => {
      const repo2 = new PersonalWorkspaceRepository(TEST_USER_2, { useMemory: true });
      await repo2.clearAll();

      expect(repo1.storageName).toBe(`workspace_${TEST_USER_1}`);
      expect(repo2.storageName).toBe(`workspace_${TEST_USER_2}`);

      // User 1 saves notebook
      const saveRes = await repo1.saveNotebookAtomic(FIXTURE_NOTEBOOK);
      expect(saveRes.ok).toBe(true);

      const user1Notebooks = await repo1.getAllNotebooks();
      expect(user1Notebooks).toHaveLength(1);
      expect(user1Notebooks[0].id).toBe(FIXTURE_NOTEBOOK.id);

      // User 2 sees zero notebooks
      const user2Notebooks = await repo2.getAllNotebooks();
      expect(user2Notebooks).toHaveLength(0);

      await repo2.clearAll();
    });

    it('rejects initialization with empty or whitespace userId', () => {
      expect(() => new PersonalWorkspaceRepository('')).toThrow(
        'User ID is required for account-scoped repository',
      );
      expect(() => new PersonalWorkspaceRepository('   ')).toThrow(
        'User ID is required for account-scoped repository',
      );
      expect(() => new PersonalWorkspaceDatabase('')).toThrow(
        'User ID is required for account-scoped repository',
      );
      expect(() => new PersonalWorkspaceDatabase('   ')).toThrow(
        'User ID is required for account-scoped repository',
      );
      expect(() => new PersonalWorkspaceDatabase('workspace_')).toThrow(
        'User ID is required for account-scoped repository',
      );
    });
  });

  it('serializes concurrent transactions so neither staged snapshot overwrites the other', async () => {
    const db = new PersonalWorkspaceDatabase(TEST_USER_1, { useMemory: true });
    await db.clear();

    await Promise.all([
      db.runTransaction(['metadata'], 'readwrite', async (ctx) => {
        await Promise.resolve();
        ctx.put('metadata', 'first', { value: 1 });
      }),
      db.runTransaction(['metadata'], 'readwrite', async (ctx) => {
        await Promise.resolve();
        ctx.put('metadata', 'second', { value: 2 });
      }),
    ]);

    const values = await db.runTransaction(['metadata'], 'readonly', (ctx) => ctx.getAll('metadata'));
    expect(values).toEqual([{ value: 1 }, { value: 2 }]);
  });

  it('applies a verified remote snapshot without overwriting dirty local rows or queuing remote writes', async () => {
    const localNotebook = { ...FIXTURE_NOTEBOOK, title: 'Pending local title' };
    await repo1.saveNotebookAtomic(localNotebook, 'create');
    const pendingBefore = await repo1.getPendingOutbox();
    const remoteNotebook = { ...FIXTURE_NOTEBOOK, id: 'remote-notebook', title: 'Remote title' };
    const remoteApplied = vi.fn();
    const unsubscribe = repo1.onRemoteSnapshotApplied(remoteApplied);

    await repo1.applyRemoteSnapshot(
      {
        notebooks: [remoteNotebook, { ...FIXTURE_NOTEBOOK, title: 'Stale remote title' }],
        notes: [],
        assets: [],
        schedules: [],
      },
      'verified-commit-sha',
    );
    unsubscribe();

    expect(remoteApplied).toHaveBeenCalledOnce();
    expect((await repo1.getNotebook(FIXTURE_NOTEBOOK.id))?.title).toBe('Pending local title');
    expect((await repo1.getNotebook('remote-notebook'))?.title).toBe('Remote title');
    expect(await repo1.getRemoteBaseCommitSha()).toBe('verified-commit-sha');
    expect(await repo1.getPendingOutbox()).toEqual(pendingBefore);
  });

  describe('2. Atomic Multi-Store Transactions & Outbox Commit', () => {
    it('atomically commits notebook and queues outbox mutation with monotonic generation', async () => {
      let eventPayload: SaveSuccessEvent | null = null;
      repo1.onSaveSuccess((ev) => {
        eventPayload = ev;
      });

      const res = await repo1.saveNotebookAtomic(FIXTURE_NOTEBOOK, 'create');
      expect(res.ok).toBe(true);
      expect(res.committedAt).toBeTruthy();
      expect(res.outboxEntryId).toBeTruthy();

      expect(eventPayload).toBeDefined();
      expect(eventPayload.entityType).toBe('notebook');
      expect(eventPayload.entityId).toBe(FIXTURE_NOTEBOOK.id);

      const notebook = await repo1.getNotebook(FIXTURE_NOTEBOOK.id);
      expect(notebook).toEqual(FIXTURE_NOTEBOOK);

      const outbox = await repo1.getPendingOutbox();
      expect(outbox).toHaveLength(1);
      expect(outbox[0].entityType).toBe('notebook');
      expect(outbox[0].mutationType).toBe('create');
      expect(outbox[0].generation).toBe(1);
    });

    it('atomically commits canvas note, embedded assets, outbox, and clears editor buffer', async () => {
      repo1.updateEditorBuffer(FIXTURE_CANVAS_NOTE.id, { draft: 'wip' }, 'canvas', 1);
      expect(repo1.getEditorBuffer(FIXTURE_CANVAS_NOTE.id)).toBeDefined();

      const res = await repo1.saveCanvasNoteAtomic(FIXTURE_CANVAS_NOTE, [FIXTURE_CANVAS_ASSET]);
      expect(res.ok).toBe(true);

      // Verify in-memory buffer was cleared on commit
      expect(repo1.getEditorBuffer(FIXTURE_CANVAS_NOTE.id)).toBeNull();

      // Note stored
      const note = await repo1.getNote(FIXTURE_CANVAS_NOTE.id);
      expect(note).toBeDefined();
      expect(note.id).toBe(FIXTURE_CANVAS_NOTE.id);

      // Asset stored
      const asset = await repo1.getAsset(FIXTURE_CANVAS_ASSET.id);
      expect(asset).toBeDefined();
      expect(asset.hash).toBe(SYNTHETIC_ASSET_HASH);

      // Outbox entries created for both note and asset
      const outbox = await repo1.getPendingOutbox();
      expect(outbox.length).toBeGreaterThanOrEqual(2);
      expect(outbox.some((e) => e.entityType === 'note')).toBe(true);
      expect(outbox.some((e) => e.entityType === 'asset')).toBe(true);
    });

    it('atomically commits kanban note mutations', async () => {
      const res = await repo1.saveKanbanNoteAtomic(FIXTURE_KANBAN_NOTE);
      expect(res.ok).toBe(true);

      const note = await repo1.getNote(FIXTURE_KANBAN_NOTE.id);
      expect(note).toBeDefined();
      expect(note.contentType).toBe('kanban');

      const outbox = await repo1.getPendingOutbox();
      expect(outbox.some((e) => e.entityId === FIXTURE_KANBAN_NOTE.id)).toBe(true);
    });

    it('atomically commits schedule task mutations', async () => {
      const task = {
        id: 'task-test-1',
        title: 'Review Excalidraw GIF fixes',
        date: '2026-10-28',
        status: 'pending' as const,
        priority: 'urgent' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const res = await repo1.saveScheduleTaskAtomic(task);
      expect(res.ok).toBe(true);

      const fetched = await repo1.getScheduleTask('task-test-1');
      expect(fetched).toBeDefined();
      expect(fetched?.title).toBe('Review Excalidraw GIF fixes');
      expect(fetched?.priority).toBe('urgent');

      const allTasks = await repo1.getAllScheduleTasks();
      expect(allTasks.some((t) => t.id === 'task-test-1')).toBe(true);

      const delRes = await repo1.deleteScheduleTaskAtomic('task-test-1');
      expect(delRes.ok).toBe(true);
      expect(await repo1.getScheduleTask('task-test-1')).toBeNull();
    });

    it('atomically deletes an entity and queues delete mutation', async () => {
      await repo1.saveNotebookAtomic(FIXTURE_NOTEBOOK);
      expect(await repo1.getNotebook(FIXTURE_NOTEBOOK.id)).toBeDefined();

      const delRes = await repo1.deleteEntityAtomic('notebook', FIXTURE_NOTEBOOK.id);
      expect(delRes.ok).toBe(true);

      expect(await repo1.getNotebook(FIXTURE_NOTEBOOK.id)).toBeNull();

      const outbox = await repo1.getPendingOutbox();
      const delEntry = outbox.find((e) => e.mutationType === 'delete');
      expect(delEntry).toBeDefined();
      expect(delEntry?.entityId).toBe(FIXTURE_NOTEBOOK.id);
      expect(delEntry?.payload).toBeNull();
    });

    it('acknowledges outbox mutations up to a given generation', async () => {
      await repo1.saveNotebookAtomic(FIXTURE_NOTEBOOK); // gen 1
      await repo1.saveKanbanNoteAtomic(FIXTURE_KANBAN_NOTE); // gen 2

      let outbox = await repo1.getPendingOutbox();
      expect(outbox).toHaveLength(2);

      await repo1.acknowledgeOutboxUpTo(1);

      outbox = await repo1.getPendingOutbox();
      expect(outbox).toHaveLength(1);
      expect(outbox[0].entityId).toBe(FIXTURE_KANBAN_NOTE.id);
      expect(outbox[0].generation).toBe(2);
    });
  });

  describe('3. Transaction Rollback & Failure/Quota Injection', () => {
    it('guarantees 100% rollback on simulated transaction failure with zero half-writes', async () => {
      await repo1.saveNotebookAtomic(FIXTURE_NOTEBOOK);
      const outboxBefore = await repo1.getPendingOutbox();

      const successSpy = vi.fn();
      const errorSpy = vi.fn();
      repo1.onSaveSuccess(successSpy);
      repo1.onSaveError(errorSpy);

      repo1.setSimulateFailure(true, new TransactionAbortError('Simulated crash on disk'));

      const res = await repo1.saveNotebookAtomic(
        { ...FIXTURE_NOTEBOOK, title: 'Corrupted Uncommitted Modification' },
        'update',
      );

      expect(res.ok).toBe(false);
      expect(res.error).toContain('Simulated crash on disk');

      expect(successSpy).not.toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          entityId: FIXTURE_NOTEBOOK.id,
          rolledBack: true,
        }),
      );

      repo1.setSimulateFailure(false);

      // Verify original state preserved completely
      const currentNb = await repo1.getNotebook(FIXTURE_NOTEBOOK.id);
      expect(currentNb?.title).toBe(FIXTURE_NOTEBOOK.title);

      const outboxAfter = await repo1.getPendingOutbox();
      expect(outboxAfter).toEqual(outboxBefore);
    });

    it('guarantees atomic rollback on quota exceeded', async () => {
      repo1.setQuotaBytes(200);

      const res = await repo1.saveCanvasNoteAtomic(FIXTURE_CANVAS_NOTE, [FIXTURE_CANVAS_ASSET]);
      expect(res.ok).toBe(false);
      expect(res.error).toContain('quota limit');

      const notes = await repo1.getAllNotes();
      expect(notes).toHaveLength(0);

      const assets = await repo1.getAllAssets();
      expect(assets).toHaveLength(0);

      const outbox = await repo1.getPendingOutbox();
      expect(outbox).toHaveLength(0);
    });
  });

  describe('4. Live Unsaved Editor Buffers', () => {
    it('manages editor buffers and persists them asynchronously for crash recovery', async () => {
      const noteId = 'draft-note-101';
      const draftData = { scene: { shapes: ['circle', 'line'] } };

      repo1.updateEditorBuffer(noteId, draftData, 'canvas', 1);

      const buffer = repo1.getEditorBuffer(noteId);
      expect(buffer).toBeDefined();
      expect(buffer?.noteId).toBe(noteId);
      expect(buffer?.isDirty).toBe(true);
      expect(buffer?.bufferPayload).toEqual(draftData);

      // Wait a tick for async transaction staging
      await new Promise((r) => setTimeout(r, 10));

      const persisted = await repo1.getPersistedEditorBuffer(noteId);
      expect(persisted).toBeDefined();
      expect(persisted?.noteId).toBe(noteId);
      expect(persisted?.bufferPayload).toEqual(draftData);

      repo1.discardEditorBuffer(noteId);
      expect(repo1.getEditorBuffer(noteId)).toBeNull();
    });
  });

  describe('5. Bundle Export & Clean Lossless Import', () => {
    it('exports complete bundle with checksum and losslessly imports into fresh profile', async () => {
      await repo1.saveNotebookAtomic(FIXTURE_NOTEBOOK);
      await repo1.saveCanvasNoteAtomic(FIXTURE_CANVAS_NOTE, [FIXTURE_CANVAS_ASSET]);
      await repo1.saveKanbanNoteAtomic(FIXTURE_KANBAN_NOTE);

      repo1.updateEditorBuffer('draft-buf-01', { text: 'in-progress' }, 'markdown', 1);

      const bundle = await repo1.exportLocalStateBundle(true);
      expect(bundle.formatVersion).toBe('1.0.0');
      expect(bundle.sourceUserId).toBe(TEST_USER_1);
      expect(bundle.checksum).toBeTruthy();
      expect(bundle.committedState.notebooks).toHaveLength(1);
      expect(bundle.committedState.notes).toHaveLength(2);
      expect(bundle.committedState.assets).toHaveLength(1);
      expect(bundle.unsavedBuffers).toHaveLength(1);

      // Fresh user profile
      const repoClean = new PersonalWorkspaceRepository('user-fresh-prod', { useMemory: true });
      await repoClean.clearAll();

      const importResult = await repoClean.importLocalStateBundle(bundle, { restoreBuffers: true });
      expect(importResult.importedCounts.notebooks).toBe(1);
      expect(importResult.importedCounts.notes).toBe(2);
      expect(importResult.importedCounts.assets).toBe(1);
      expect(importResult.importedCounts.buffers).toBe(1);

      const restoredNb = await repoClean.getNotebook(FIXTURE_NOTEBOOK.id);
      expect(restoredNb).toEqual(FIXTURE_NOTEBOOK);

      const restoredNote = await repoClean.getNote(FIXTURE_CANVAS_NOTE.id);
      expect(restoredNote.id).toBe(FIXTURE_CANVAS_NOTE.id);

      const restoredBuffer = repoClean.getEditorBuffer('draft-buf-01');
      expect(restoredBuffer?.recoveredFromBuffer).toBe(true);

      await repoClean.clearAll();
    });

    it('rejects bundle import if payload is tampered', async () => {
      await repo1.saveNotebookAtomic(FIXTURE_NOTEBOOK);
      const bundle = await repo1.exportLocalStateBundle(false);

      // Tamper with content
      bundle.committedState.notebooks[0].title = 'Illegally Modified Title';

      const repoClean = new PersonalWorkspaceRepository('user-tamper-test', { useMemory: true });
      await expect(repoClean.importLocalStateBundle(bundle)).rejects.toThrow(
        /Bundle checksum mismatch/,
      );
      await repoClean.clearAll();
    });
  });

  describe('6. Cross-Tab Lock Coordinator', () => {
    it('serializes writers across simulated tabs with timeout and ifAvailable controls', async () => {
      const coord1 = new TabLockCoordinator(repo1.storageName, 'tab-1');
      const coord2 = new TabLockCoordinator(repo1.storageName, 'tab-2');

      const executionOrder: string[] = [];

      const p1 = coord1.requestLock('workspace-writer', { timeoutMs: 2000 }, async () => {
        executionOrder.push('t1-start');
        await new Promise((r) => setTimeout(r, 50));
        executionOrder.push('t1-end');
        return 't1-done';
      });

      await new Promise((r) => setTimeout(r, 5));

      // Immediate acquisition fails if currently held
      await expect(
        coord2.requestLock('workspace-writer', { ifAvailable: true }, async () => 't2-immediate'),
      ).rejects.toThrow(/currently held by tab-1/);

      // Queues up and executes after tab 1 finishes
      const p2 = coord2.requestLock('workspace-writer', { timeoutMs: 2000 }, async () => {
        executionOrder.push('t2-start');
        await new Promise((r) => setTimeout(r, 10));
        executionOrder.push('t2-end');
        return 't2-done';
      });

      const [res1, res2] = await Promise.all([p1, p2]);
      expect(res1).toBe('t1-done');
      expect(res2).toBe('t2-done');

      expect(executionOrder).toEqual(['t1-start', 't1-end', 't2-start', 't2-end']);

      coord1.close();
      coord2.close();
    });

    it('throws LockAcquisitionTimeoutError when acquisition deadline is exceeded', async () => {
      const coord1 = new TabLockCoordinator(repo1.storageName, 'tab-slow');
      const coord2 = new TabLockCoordinator(repo1.storageName, 'tab-timeout');

      // Tab 1 holds lock for 200ms
      const p1 = coord1.requestLock('writer-lock', { timeoutMs: 2000 }, async () => {
        await new Promise((r) => setTimeout(r, 200));
      });

      await new Promise((r) => setTimeout(r, 5));

      // Tab 2 has a timeout of only 30ms
      await expect(
        coord2.requestLock('writer-lock', { timeoutMs: 30 }, async () => 'tab2'),
      ).rejects.toThrowError(LockAcquisitionTimeoutError);

      await p1;
      coord1.close();
      coord2.close();
    });
  });

  describe('7. Frozen Capability Promises Table', () => {
    it('verifies all 3 frozen capability promises match E4 contracts', () => {
      const p = FROZEN_OFFLINE_CAPABILITY_PROMISES;
      expect(p.OFFLINE_EDITING.tier).toBe('R1_MANDATORY');
      expect(p.OFFLINE_EDITING.status).toBe('PROVEN');
      expect(p.OFFLINE_REOPENING.tier).toBe('R1_TARGET');
      expect(p.CROSS_DEVICE_RECOVERY.tier).toBe('R2_DEFERRED');
    });
  });
});
