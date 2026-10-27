/**
 * Unit Tests for IndexedDB Local Workspace Repository Prototype (Stage V3)
 *
 * Verifies:
 * 1. Account scoping & isolation (`workspace_${userId}`)
 * 2. Atomic Outbox: entity mutations + outbox entries committed together in 1 transaction
 * 3. Save success emitted ONLY after transaction commits
 * 4. Atomic rollback on simulated transaction failure / quota exhaustion (no half-writes)
 * 5. Live unsaved editor buffer recovery
 * 6. Complete export bundle generation and lossless restore into a clean profile
 * 7. Multi-tab Web Locks / BroadcastChannel writer serialization
 * 8. Frozen offline capability promises table
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  LocalWorkspaceRepository,
  TabLockCoordinator,
  FROZEN_OFFLINE_CAPABILITY_PROMISES,
  QuotaExceededError,
  TransactionAbortError,
} from '../indexeddb-prototype';
import {
  FIXTURE_NOTEBOOK,
  FIXTURE_CANVAS_NOTE,
  FIXTURE_CANVAS_ASSET,
  FIXTURE_KANBAN_NOTE,
  SYNTHETIC_ASSET_HASH,
} from '../fixtures';

describe('V3 IndexedDB Prototype: Local Durability, Atomic Outbox & Offline Proof', () => {
  const TEST_USER_A = 'user-alice-v3';
  const TEST_USER_B = 'user-bob-v3';
  let repoA: LocalWorkspaceRepository;

  beforeEach(async () => {
    TabLockCoordinator.resetAllLocks();
    repoA = new LocalWorkspaceRepository(TEST_USER_A);
    await repoA.clearAll();
  });

  afterEach(async () => {
    await repoA.clearAll();
    TabLockCoordinator.resetAllLocks();
  });

  describe('1. Account Scoping & Multi-Tenant Isolation', () => {
    it('strictly isolates storage by userId and prevents cross-user leakage', async () => {
      const repoB = new LocalWorkspaceRepository(TEST_USER_B);
      await repoB.clearAll();

      // Alice writes a notebook
      const saveRes = await repoA.saveNotebookAtomic(FIXTURE_NOTEBOOK);
      expect(saveRes.ok).toBe(true);

      // Alice has the notebook
      const aliceNotebooks = await repoA.getAllNotebooks();
      expect(aliceNotebooks).toHaveLength(1);
      expect(aliceNotebooks[0].id).toBe(FIXTURE_NOTEBOOK.id);

      // Bob's repository is completely empty
      const bobNotebooks = await repoB.getAllNotebooks();
      expect(bobNotebooks).toHaveLength(0);
      const bobOutbox = await repoA.getPendingOutbox();
      expect(bobOutbox).toHaveLength(1);

      const bobActualOutbox = await repoB.getPendingOutbox();
      expect(bobActualOutbox).toHaveLength(0);

      await repoB.clearAll();
    });

    it('rejects initialization with empty or blank userId', () => {
      expect(() => new LocalWorkspaceRepository('')).toThrow(
        'User ID is required for account-scoped repository',
      );
      expect(() => new LocalWorkspaceRepository('   ')).toThrow(
        'User ID is required for account-scoped repository',
      );
    });
  });

  describe('2. Atomic Outbox Commits', () => {
    it('atomically commits notebook and outbox mutation in a single transaction', async () => {
      let emittedSuccess = false;
      let emittedEvent: any = null;

      repoA.onSaveSuccess((event) => {
        emittedSuccess = true;
        emittedEvent = event;
      });

      const res = await repoA.saveNotebookAtomic(FIXTURE_NOTEBOOK, 'create');
      expect(res.ok).toBe(true);
      expect(res.committedAt).toBeTruthy();
      expect(res.outboxEntryId).toBeTruthy();

      // Verify emitted event
      expect(emittedSuccess).toBe(true);
      expect(emittedEvent.entityId).toBe(FIXTURE_NOTEBOOK.id);
      expect(emittedEvent.entityType).toBe('notebook');
      expect(emittedEvent.outboxId).toBe(res.outboxEntryId);

      // Verify notebook store
      const savedNotebook = await repoA.getNotebook(FIXTURE_NOTEBOOK.id);
      expect(savedNotebook).toEqual(FIXTURE_NOTEBOOK);

      // Verify outbox store
      const pending = await repoA.getPendingOutbox();
      expect(pending).toHaveLength(1);
      expect(pending[0].entityId).toBe(FIXTURE_NOTEBOOK.id);
      expect(pending[0].mutationType).toBe('create');
      expect(pending[0].status).toBe('pending');
      expect(pending[0].payload).toEqual(FIXTURE_NOTEBOOK);
    });

    it('atomically commits canvas note, embedded assets, and outbox mutations', async () => {
      const res = await repoA.saveCanvasNoteAtomic(FIXTURE_CANVAS_NOTE, [FIXTURE_CANVAS_ASSET]);
      expect(res.ok).toBe(true);

      // Note stored
      const note = await repoA.getNote(FIXTURE_CANVAS_NOTE.id);
      expect(note).toBeDefined();
      expect(note?.id).toBe(FIXTURE_CANVAS_NOTE.id);

      // Asset stored with matching SHA-256 hash
      const asset = await repoA.getAsset(FIXTURE_CANVAS_ASSET.id);
      expect(asset).toBeDefined();
      expect(asset?.hash).toBe(SYNTHETIC_ASSET_HASH);
      expect(asset?.byteLength).toBe(FIXTURE_CANVAS_ASSET.byteLength);

      // Outbox entries created for both note and asset
      const pending = await repoA.getPendingOutbox();
      expect(pending.length).toBeGreaterThanOrEqual(2);

      const noteEntry = pending.find((e) => e.entityType === 'note');
      const assetEntry = pending.find((e) => e.entityType === 'asset');
      expect(noteEntry).toBeDefined();
      expect(assetEntry).toBeDefined();
      expect(noteEntry?.entityId).toBe(FIXTURE_CANVAS_NOTE.id);
      expect(assetEntry?.entityId).toBe(FIXTURE_CANVAS_ASSET.id);
    });

    it('atomically commits kanban note mutations', async () => {
      const res = await repoA.saveKanbanNoteAtomic(FIXTURE_KANBAN_NOTE);
      expect(res.ok).toBe(true);

      const note = (await repoA.getNote(FIXTURE_KANBAN_NOTE.id)) as any;
      expect(note).toBeDefined();
      expect(note.kanbanColumns).toHaveLength(3);
      expect(note.kanbanCards).toHaveLength(2);

      const pending = await repoA.getPendingOutbox();
      expect(pending.some((e) => e.entityId === FIXTURE_KANBAN_NOTE.id)).toBe(true);
    });
  });

  describe('3. Transaction Abort & Quota Failure Simulation (Zero Half-Writes)', () => {
    it('guarantees rollback on simulated transaction failure with NO false save success', async () => {
      // First save notebook successfully
      await repoA.saveNotebookAtomic(FIXTURE_NOTEBOOK);
      const initialOutbox = await repoA.getPendingOutbox();
      expect(initialOutbox).toHaveLength(1);

      // Now prepare a modified notebook
      const modifiedNotebook = {
        ...FIXTURE_NOTEBOOK,
        title: 'Corrupted Uncommitted Title',
      };

      const successSpy = vi.fn();
      const errorSpy = vi.fn();
      repoA.onSaveSuccess(successSpy);
      repoA.onSaveError(errorSpy);

      // Inject simulated failure
      repoA.setSimulateFailure(true, new TransactionAbortError('Disk transaction write failed'));

      const res = await repoA.saveNotebookAtomic(modifiedNotebook, 'update');
      expect(res.ok).toBe(false);
      expect(res.error).toContain('Disk transaction write failed');

      // Verify save success was NEVER emitted
      expect(successSpy).not.toHaveBeenCalled();
      // Verify save error was emitted with rolledBack: true
      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          entityId: FIXTURE_NOTEBOOK.id,
          rolledBack: true,
        }),
      );

      // Disable simulation and inspect database state
      repoA.setSimulateFailure(false);

      // Storage remains in original uncorrupted state: NO half-write!
      const currentNotebook = await repoA.getNotebook(FIXTURE_NOTEBOOK.id);
      expect(currentNotebook?.title).toBe(FIXTURE_NOTEBOOK.title);
      expect(currentNotebook?.title).not.toBe('Corrupted Uncommitted Title');

      // Outbox remains at original length: NO orphaned outbox mutation!
      const currentOutbox = await repoA.getPendingOutbox();
      expect(currentOutbox).toHaveLength(1);
      expect(currentOutbox[0].mutationType).toBe('create');
    });

    it('guarantees rollback on quota exhaustion without partial writes', async () => {
      // Set very small quota (e.g. 200 bytes)
      repoA.setQuotaBytes(200);

      const successSpy = vi.fn();
      const errorSpy = vi.fn();
      repoA.onSaveSuccess(successSpy);
      repoA.onSaveError(errorSpy);

      // Attempt to save canvas note + image asset which exceeds 200 bytes
      const res = await repoA.saveCanvasNoteAtomic(FIXTURE_CANVAS_NOTE, [FIXTURE_CANVAS_ASSET]);
      expect(res.ok).toBe(false);
      expect(res.error).toContain('quota limit');

      expect(successSpy).not.toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          rolledBack: true,
        }),
      );

      // Verify ZERO records written into any store
      const notes = await repoA.getAllNotes();
      expect(notes).toHaveLength(0);

      const assets = await repoA.getAllAssets();
      expect(assets).toHaveLength(0);

      const outbox = await repoA.getPendingOutbox();
      expect(outbox).toHaveLength(0);
    });
  });

  describe('4. Live Unsaved Editor Buffer Recovery', () => {
    it('manages active keystroke buffer in-memory and clears it on atomic commit', async () => {
      const noteId = FIXTURE_CANVAS_NOTE.id;
      const draftPayload = {
        elements: [{ id: 'elem-draft-1', text: 'Uncommitted draft in progress' }],
      };

      // 1. User types in editor
      repoA.updateEditorBuffer(noteId, draftPayload, 'canvas', 1);

      // 2. Buffer is available immediately for crash recovery
      const buffer = repoA.getEditorBuffer(noteId);
      expect(buffer).toBeDefined();
      expect(buffer?.noteId).toBe(noteId);
      expect(buffer?.isDirty).toBe(true);
      expect(buffer?.bufferPayload).toEqual(draftPayload);

      // 3. User hits Save -> atomic commit clears editor buffer
      const saveRes = await repoA.saveCanvasNoteAtomic(FIXTURE_CANVAS_NOTE);
      expect(saveRes.ok).toBe(true);

      const bufferAfterSave = repoA.getEditorBuffer(noteId);
      expect(bufferAfterSave).toBeNull();
    });

    it('recovers persisted buffer if in-memory Map is cleared', async () => {
      const noteId = 'note-unsaved-test';
      repoA.updateEditorBuffer(noteId, { draft: 'critical unsaved thoughts' }, 'markdown', 1);

      // Wait a tick for async transaction to stage
      await new Promise((r) => setTimeout(r, 10));

      const persisted = await repoA.getPersistedEditorBuffer(noteId);
      expect(persisted).toBeDefined();
      expect(persisted?.noteId).toBe(noteId);
      expect((persisted?.bufferPayload as any).draft).toBe('critical unsaved thoughts');
    });
  });

  describe('5. Bundle Export & Lossless Clean Restore', () => {
    it('generates a complete export bundle and losslessly restores into a clean profile', async () => {
      // Setup source repository with full realistic dataset
      await repoA.saveNotebookAtomic(FIXTURE_NOTEBOOK);
      await repoA.saveCanvasNoteAtomic(FIXTURE_CANVAS_NOTE, [FIXTURE_CANVAS_ASSET]);
      await repoA.saveKanbanNoteAtomic(FIXTURE_KANBAN_NOTE);

      // Add one uncommitted draft buffer
      repoA.updateEditorBuffer('note-draft-01', { text: 'WIP idea' }, 'markdown', 1);

      // Export bundle
      const bundle = await repoA.exportLocalStateBundle(true);

      expect(bundle.formatVersion).toBe('1.0.0');
      expect(bundle.sourceUserId).toBe(TEST_USER_A);
      expect(bundle.checksum).toBeTruthy();
      expect(bundle.committedState.notebooks).toHaveLength(1);
      expect(bundle.committedState.notes).toHaveLength(2);
      expect(bundle.committedState.assets).toHaveLength(1);
      expect(bundle.committedState.outbox.length).toBeGreaterThanOrEqual(4);
      expect(bundle.unsavedBuffers).toHaveLength(1);

      // Create a fresh target repository for a brand new profile
      const freshUser = 'user-fresh-profile-99';
      const repoFresh = new LocalWorkspaceRepository(freshUser);
      await repoFresh.clearAll();

      // Restore bundle into fresh profile
      const importResult = await repoFresh.importLocalStateBundle(bundle, { restoreBuffers: true });

      expect(importResult.importedCounts.notebooks).toBe(1);
      expect(importResult.importedCounts.notes).toBe(2);
      expect(importResult.importedCounts.assets).toBe(1);
      expect(importResult.importedCounts.buffers).toBe(1);

      // Verify exact data fidelity on target
      const restoredNotebook = await repoFresh.getNotebook(FIXTURE_NOTEBOOK.id);
      expect(restoredNotebook).toEqual(FIXTURE_NOTEBOOK);

      const restoredCanvas = (await repoFresh.getNote(FIXTURE_CANVAS_NOTE.id)) as any;
      expect(restoredCanvas.title).toBe(FIXTURE_CANVAS_NOTE.title);
      expect(restoredCanvas.scene.elements).toHaveLength(3);

      const restoredAsset = await repoFresh.getAsset(FIXTURE_CANVAS_ASSET.id);
      expect(restoredAsset?.hash).toBe(SYNTHETIC_ASSET_HASH);
      expect(restoredAsset?.base64Data).toBe(FIXTURE_CANVAS_ASSET.base64Data);

      const restoredBuffer = repoFresh.getEditorBuffer('note-draft-01');
      expect(restoredBuffer).toBeDefined();
      expect(restoredBuffer?.recoveredFromBuffer).toBe(true);

      await repoFresh.clearAll();
    });

    it('rejects tampered bundle when checksum does not match', async () => {
      await repoA.saveNotebookAtomic(FIXTURE_NOTEBOOK);
      const bundle = await repoA.exportLocalStateBundle(false);

      // Tamper with payload
      bundle.committedState.notebooks[0].title = 'Tampered Title';

      const repoFresh = new LocalWorkspaceRepository('user-tamper-check');
      await expect(repoFresh.importLocalStateBundle(bundle)).rejects.toThrow(
        /Bundle checksum mismatch/,
      );
      await repoFresh.clearAll();
    });
  });

  describe('6. Cross-Tab Web Locks & Writer Serialization', () => {
    it('serializes concurrent writers across tabs using lock coordinator', async () => {
      const coordinatorTab1 = new TabLockCoordinator(repoA.storageName, 'tab-1');
      const coordinatorTab2 = new TabLockCoordinator(repoA.storageName, 'tab-2');

      const executionOrder: string[] = [];

      // Tab 1 acquires lock and performs long operation
      const p1 = coordinatorTab1.requestLock('editor-writer', { timeoutMs: 2000 }, async () => {
        executionOrder.push('tab-1-start');
        await new Promise((r) => setTimeout(r, 60));
        executionOrder.push('tab-1-end');
        return 'tab-1-done';
      });

      // Small delay to ensure Tab 1 acquires first
      await new Promise((r) => setTimeout(r, 5));

      // Tab 2 attempts to acquire lock immediately with ifAvailable: true
      await expect(
        coordinatorTab2.requestLock('editor-writer', { ifAvailable: true }, async () => 'tab-2'),
      ).rejects.toThrow(/currently held by tab-1/);

      // Tab 2 queues up for the lock normally
      const p2 = coordinatorTab2.requestLock('editor-writer', { timeoutMs: 2000 }, async () => {
        executionOrder.push('tab-2-start');
        await new Promise((r) => setTimeout(r, 20));
        executionOrder.push('tab-2-end');
        return 'tab-2-done';
      });

      const [res1, res2] = await Promise.all([p1, p2]);
      expect(res1).toBe('tab-1-done');
      expect(res2).toBe('tab-2-done');

      // Verify strict serialization: Tab 1 completely finishes before Tab 2 starts
      expect(executionOrder).toEqual(['tab-1-start', 'tab-1-end', 'tab-2-start', 'tab-2-end']);

      coordinatorTab1.close();
      coordinatorTab2.close();
    });

    it('broadcasts lock and mutation notifications via BroadcastChannel', async () => {
      const coordinatorTab1 = new TabLockCoordinator(repoA.storageName, 'tab-1');
      const coordinatorTab2 = new TabLockCoordinator(repoA.storageName, 'tab-2');

      const receivedNotifications: any[] = [];
      const channel2 = coordinatorTab2.getChannel();
      if (channel2) {
        channel2.onmessage = (ev) => {
          receivedNotifications.push(ev.data);
        };
      }

      await coordinatorTab1.requestLock('workspace-lock', { timeoutMs: 1000 }, async () => {
        coordinatorTab1.broadcast({
          type: 'WORKSPACE_MUTATED',
          tabId: 'tab-1',
          entityType: 'note',
          entityId: 'note-123',
        });
      });

      // Wait a tick for BroadcastChannel message dispatch
      await new Promise((r) => setTimeout(r, 30));

      if (channel2) {
        expect(receivedNotifications.length).toBeGreaterThanOrEqual(1);
        expect(receivedNotifications.some((n) => n.type === 'WRITER_ELECTED')).toBe(true);
        expect(receivedNotifications.some((n) => n.type === 'WORKSPACE_MUTATED')).toBe(true);
        expect(receivedNotifications.some((n) => n.type === 'LOCK_RELEASED')).toBe(true);
      }

      coordinatorTab1.close();
      coordinatorTab2.close();
    });
  });

  describe('7. Frozen Capability Promises Table', () => {
    it('freezes explicit delivery contracts for Offline Editing, Reopening, and Cross-Device Recovery', () => {
      const promises = FROZEN_OFFLINE_CAPABILITY_PROMISES;

      // 1. Offline Editing
      expect(promises.OFFLINE_EDITING.tier).toBe('R1_MANDATORY');
      expect(promises.OFFLINE_EDITING.status).toBe('PROVEN');
      expect(promises.OFFLINE_EDITING.deliveryContract).toBe(
        'Already-open, provisioned workspace edits without network/GitHub',
      );

      // 2. Offline Reopening
      expect(promises.OFFLINE_REOPENING.tier).toBe('R1_TARGET');
      expect(promises.OFFLINE_REOPENING.status).toBe('PROVEN_WITH_PREREQUISITES');
      expect(promises.OFFLINE_REOPENING.prerequisites).toContain(
        'Application shell/assets cached by ServiceWorker or PWA manifest',
      );
      expect(promises.OFFLINE_REOPENING.boundaryNotes).toContain(
        'Never advertise "fully offline" on IndexedDB alone',
      );

      // 3. Cross-Device Recovery
      expect(promises.CROSS_DEVICE_RECOVERY.tier).toBe('R2_DEFERRED');
      expect(promises.CROSS_DEVICE_RECOVERY.status).toBe('DEFERRED_TO_V4_R2');
      expect(promises.CROSS_DEVICE_RECOVERY.deliveryContract).toBe(
        'Fresh authorized device restores complete remote snapshot',
      );
    });
  });
});
