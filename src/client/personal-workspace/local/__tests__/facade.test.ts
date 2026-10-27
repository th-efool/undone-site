/**
 * Comprehensive Unit Tests for Production LocalWorkspace Facade
 *
 * Conforms to Section 4.2 of `plans/undone-local-first-github-sync.md`:
 * - Facade open, lifecycle, and account isolation
 * - Atomic command application (notebooks, canvas notes with embedded binary image assets)
 * - Concurrency control with expected generation validation
 * - Subscription notifications on mutations and buffer updates
 * - Outbox mutation queuing and sync summary status
 * - Export and import recovery bundles with cryptographic checksum validation
 * - UI preferences and NotesStateEntity domain model synchronization
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  LocalWorkspace,
  getLocalWorkspace,
  extractAssetsFromSceneFiles,
  type WorkspaceCommand,
} from '../facade';
import { TabLockCoordinator } from '../database';
import {
  FIXTURE_NOTEBOOK,
  FIXTURE_CANVAS_NOTE,
  FIXTURE_CANVAS_ASSET,
  SYNTHETIC_PNG_BASE64,
  SYNTHETIC_ASSET_HASH,
  SYNTHETIC_ASSET_BYTES,
} from '@/src/client/screens/dashboard/notes/validation/fixtures';
import type { NotebookRecord } from '@/src/shared/personal-workspace/contracts';

describe('LocalWorkspace Facade & Hook Integration', () => {
  const TEST_USER_1 = 'user-alice-facade';
  const TEST_USER_2 = 'user-bob-facade';
  let workspace: LocalWorkspace;

  beforeEach(async () => {
    TabLockCoordinator.resetAllLocks();
    LocalWorkspace.resetAllInstances();
    workspace = new LocalWorkspace(TEST_USER_1, { useMemory: true });
    await workspace.getRepository().clearAll();
  });

  afterEach(async () => {
    await workspace.close();
    LocalWorkspace.resetAllInstances();
    TabLockCoordinator.resetAllLocks();
  });

  describe('1. Workspace Opening, Scope & Account Isolation', () => {
    it('opens workspace and returns complete WorkspaceSnapshot', async () => {
      const snapshot = await workspace.open({ userId: TEST_USER_1 });

      expect(snapshot.scope.userId).toBe(TEST_USER_1);
      expect(snapshot.notebooks).toEqual([]);
      expect(snapshot.notes).toEqual([]);
      expect(snapshot.assets).toEqual([]);
      expect(snapshot.pendingOutbox).toEqual([]);
      expect(snapshot.generation).toBe(0);
      expect(snapshot.notesState).toBeDefined();
      expect(snapshot.notesState.notebooks).toHaveLength(0);
    });

    it('rejects opening when scope userId does not match workspace userId', async () => {
      await expect(workspace.open({ userId: 'wrong-user' })).rejects.toThrow(
        'Scope userId "wrong-user" does not match workspace userId "user-alice-facade"'
      );
    });

    it('manages singleton instances per userId', () => {
      const instance1 = getLocalWorkspace(TEST_USER_1, { useMemory: true });
      const instance2 = getLocalWorkspace(TEST_USER_1, { useMemory: true });
      const instance3 = getLocalWorkspace(TEST_USER_2, { useMemory: true });

      expect(instance1).toBe(instance2);
      expect(instance1).not.toBe(instance3);
      expect(instance1.userId).toBe(TEST_USER_1);
      expect(instance3.userId).toBe(TEST_USER_2);
    });

    it('strictly isolates data between two different user workspaces', async () => {
      const ws2 = new LocalWorkspace(TEST_USER_2, { useMemory: true });
      await ws2.getRepository().clearAll();

      await workspace.open({ userId: TEST_USER_1 });
      await ws2.open({ userId: TEST_USER_2 });

      // Save notebook in User 1's workspace
      const receipt = await workspace.saveNotebook(FIXTURE_NOTEBOOK);
      expect(receipt.ok).toBe(true);

      expect(workspace.getNotesState().notebooks).toHaveLength(1);
      expect(ws2.getNotesState().notebooks).toHaveLength(0);

      await ws2.close();
    });
  });

  describe('2. Notebook Commands & Generation Concurrency', () => {
    beforeEach(async () => {
      await workspace.open({ userId: TEST_USER_1 });
    });

    it('saves a notebook via high-level saveNotebook and queues outbox mutation', async () => {
      const receipt = await workspace.saveNotebook(FIXTURE_NOTEBOOK);

      expect(receipt.ok).toBe(true);
      expect(receipt.committedAt).toBeTruthy();
      expect(receipt.outboxEntryId).toBeTruthy();

      const state = workspace.getNotesState();
      expect(state.notebooks).toHaveLength(1);
      expect(state.notebooks[0].id).toBe(FIXTURE_NOTEBOOK.id);
      expect(state.notebooks[0].title).toBe(FIXTURE_NOTEBOOK.title);

      const outbox = await workspace.getRepository().getPendingOutbox();
      expect(outbox).toHaveLength(1);
      expect(outbox[0].entityType).toBe('notebook');
      expect(outbox[0].entityId).toBe(FIXTURE_NOTEBOOK.id);
      expect(outbox[0].mutationType).toBe('create');
      expect(workspace.getGeneration()).toBeGreaterThan(0);
    });

    it('updates existing notebook via saveNotebook with mutationType update', async () => {
      await workspace.saveNotebook(FIXTURE_NOTEBOOK);
      await new Promise((r) => setTimeout(r, 15));

      const updatedNotebook: NotebookRecord = {
        ...FIXTURE_NOTEBOOK,
        title: 'Updated Architecture Notebook',
      };
      const receipt2 = await workspace.saveNotebook(updatedNotebook);
      expect(receipt2.ok).toBe(true);

      const state = workspace.getNotesState();
      expect(state.notebooks[0].title).toBe('Updated Architecture Notebook');

      const outbox = await workspace.getRepository().getPendingOutbox();
      expect(outbox).toHaveLength(2);
      expect(outbox[1].mutationType).toBe('update');
    });

    it('applies save_notebook command with expectedGeneration validation', async () => {
      const gen0 = workspace.getGeneration();

      // Successful apply matching current generation
      const cmd1: WorkspaceCommand = {
        type: 'save_notebook',
        notebook: FIXTURE_NOTEBOOK,
      };
      const receipt1 = await workspace.apply(cmd1, gen0);
      expect(receipt1.ok).toBe(true);

      const gen1 = workspace.getGeneration();
      expect(gen1).toBeGreaterThan(gen0);

      // Fails with generation mismatch when expected generation is stale
      const cmd2: WorkspaceCommand = {
        type: 'save_notebook',
        notebook: { ...FIXTURE_NOTEBOOK, title: 'Conflicting Edit' },
      };
      const receipt2 = await workspace.apply(cmd2, gen0); // Stale gen0 passed
      expect(receipt2.ok).toBe(false);
      expect(receipt2.error).toContain('Generation mismatch');
      expect(receipt2.committedAt).toBeNull();
    });

    it('deletes notebook entity and cascades deletion to child notes', async () => {
      await workspace.saveNotebook(FIXTURE_NOTEBOOK);
      await workspace.saveCanvasScene('child-note-1', {
        elements: [],
        appState: {},
      }, { notebookId: FIXTURE_NOTEBOOK.id });

      expect(workspace.getNotesState().notebooks).toHaveLength(1);
      expect(workspace.getNotesState().notes).toHaveLength(1);

      const delReceipt = await workspace.deleteEntity('notebook', FIXTURE_NOTEBOOK.id);
      expect(delReceipt.ok).toBe(true);

      const state = workspace.getNotesState();
      expect(state.notebooks).toHaveLength(0);
      expect(state.notes).toHaveLength(0);

      const outbox = await workspace.getRepository().getPendingOutbox();
      const delEntries = outbox.filter((e) => e.mutationType === 'delete');
      expect(delEntries.length).toBeGreaterThanOrEqual(2); // notebook + child note
    });
  });

  describe('3. Canvas Notes, Binary Assets & Live Buffers', () => {
    beforeEach(async () => {
      await workspace.open({ userId: TEST_USER_1 });
      await workspace.saveNotebook(FIXTURE_NOTEBOOK);
    });

    it('extracts and validates AssetRecords from Excalidraw scene files', () => {
      const files = {
        'img-01': {
          id: 'img-01',
          dataURL: `data:image/png;base64,${SYNTHETIC_PNG_BASE64}`,
          mimeType: 'image/png',
        },
      };

      const assets = extractAssetsFromSceneFiles(files);
      expect(assets).toHaveLength(1);
      expect(assets[0].id).toBe('img-01');
      expect(assets[0].hash).toBe(SYNTHETIC_ASSET_HASH);
      expect(assets[0].mimeType).toBe('image/png');
      expect(assets[0].byteLength).toBe(SYNTHETIC_ASSET_BYTES.byteLength);
    });

    it('atomically saves canvas scene with embedded image asset and queues outbox entries', async () => {
      const scene = {
        elements: [
          {
            id: 'elem-1',
            type: 'image',
            fileId: 'asset-img-01',
            x: 50,
            y: 50,
            width: 100,
            height: 100,
          },
        ],
        appState: { viewBackgroundColor: '#ffffff' },
        files: {
          'asset-img-01': {
            id: 'asset-img-01',
            dataURL: `data:image/png;base64,${SYNTHETIC_PNG_BASE64}`,
            mimeType: 'image/png',
          },
        },
      };

      const receipt = await workspace.saveCanvasScene('canvas-note-101', scene, {
        title: 'Network Diagram with Image',
        notebookId: FIXTURE_NOTEBOOK.id,
      });

      expect(receipt.ok).toBe(true);
      expect(receipt.committedAt).toBeTruthy();
      expect(receipt.outboxEntryId).toBeTruthy();

      // Verify Note in domain state
      const state = workspace.getNotesState();
      expect(state.notes).toHaveLength(1);
      expect(state.notes[0].id).toBe('canvas-note-101');
      expect(state.notes[0].title).toBe('Network Diagram with Image');

      // Verify Asset in repository
      const savedAsset = await workspace.getRepository().getAsset('asset-img-01');
      expect(savedAsset).toBeDefined();
      expect(savedAsset.hash).toBe(SYNTHETIC_ASSET_HASH);
      expect(savedAsset.byteLength).toBe(SYNTHETIC_ASSET_BYTES.byteLength);

      // Verify atomic Outbox entries for both note and asset
      const outbox = await workspace.getRepository().getPendingOutbox();
      const noteOutbox = outbox.find((e) => e.entityType === 'note' && e.entityId === 'canvas-note-101');
      const assetOutbox = outbox.find((e) => e.entityType === 'asset' && e.entityId === 'asset-img-01');

      expect(noteOutbox).toBeDefined();
      expect(assetOutbox).toBeDefined();
      expect(assetOutbox?.mutationType).toBe('create');
    });

    it('updates live editor buffer and clears it upon committed save', async () => {
      const noteId = 'canvas-buffer-test';
      const liveScene = { elements: [{ id: 'draft-1', text: 'Typing in progress...' }] };

      // Keystroke in progress
      workspace.updateCanvasEditorBuffer(noteId, liveScene);

      const buffer = workspace.getRepository().getEditorBuffer(noteId);
      expect(buffer).toBeDefined();
      expect(buffer?.isDirty).toBe(true);
      expect(buffer?.bufferPayload).toEqual(liveScene);

      // Commit save
      const receipt = await workspace.saveCanvasScene(noteId, {
        elements: liveScene.elements,
        appState: {},
      });
      expect(receipt.ok).toBe(true);

      // Buffer should be automatically cleared on commit
      const bufferAfterCommit = workspace.getRepository().getEditorBuffer(noteId);
      expect(bufferAfterCommit).toBeNull();
    });

    it('applies save_canvas_scene command via apply dispatch', async () => {
      const cmd: WorkspaceCommand = {
        type: 'save_canvas_scene',
        noteId: 'canvas-via-cmd',
        scene: {
          elements: [{ id: 'box-1', type: 'rectangle' }],
          appState: {},
        },
        title: 'Command Dispatched Canvas',
        notebookId: FIXTURE_NOTEBOOK.id,
      };

      const receipt = await workspace.apply(cmd);
      expect(receipt.ok).toBe(true);

      const state = workspace.getNotesState();
      expect(state.notes.some((n) => n.id === 'canvas-via-cmd')).toBe(true);
    });

    it('deletes note entity and writes outbox delete entry', async () => {
      await workspace.saveCanvasScene('note-to-delete', { elements: [], appState: {} });
      expect(workspace.getNotesState().notes).toHaveLength(1);

      const delReceipt = await workspace.deleteEntity('note', 'note-to-delete');
      expect(delReceipt.ok).toBe(true);

      expect(workspace.getNotesState().notes).toHaveLength(0);
      const outbox = await workspace.getRepository().getPendingOutbox();
      const delEntry = outbox.find((e) => e.entityId === 'note-to-delete' && e.mutationType === 'delete');
      expect(delEntry).toBeDefined();
      expect(delEntry?.mutationType).toBe('delete');
    });
  });

  describe('4. Subscription Notifications', () => {
    beforeEach(async () => {
      await workspace.open({ userId: TEST_USER_1 });
    });

    it('notifies subscribers on notebook save, canvas save, buffer update, and delete', async () => {
      const listener = vi.fn();
      const unsubscribe = workspace.subscribe(listener);

      // 1. Notebook save
      await workspace.saveNotebook(FIXTURE_NOTEBOOK);
      expect(listener).toHaveBeenCalled();
      const callCount1 = listener.mock.calls.length;

      // 2. Buffer update
      workspace.updateCanvasEditorBuffer('test-n', { draft: true });
      expect(listener.mock.calls.length).toBeGreaterThan(callCount1);
      const callCount2 = listener.mock.calls.length;

      // 3. Canvas save
      await workspace.saveCanvasScene('test-n', { elements: [], appState: {} });
      expect(listener.mock.calls.length).toBeGreaterThan(callCount2);
      const callCount3 = listener.mock.calls.length;

      // 4. Delete
      await workspace.deleteEntity('note', 'test-n');
      expect(listener.mock.calls.length).toBeGreaterThan(callCount3);

      // 5. Unsubscribe stops future notifications
      unsubscribe();
      const finalCount = listener.mock.calls.length;
      await workspace.saveNotebook({ ...FIXTURE_NOTEBOOK, id: 'nb-2' });
      expect(listener.mock.calls.length).toBe(finalCount);
    });
  });

  describe('5. Sync Summary & Outbox Status', () => {
    beforeEach(async () => {
      await workspace.open({ userId: TEST_USER_1 });
    });

    it('reflects synced status when outbox is empty and queued status when mutations are pending', async () => {
      // Empty workspace -> synced
      let summary = await workspace.getSyncSummary();
      expect(summary.status).toBe('synced');
      expect(summary.pendingMutations).toBe(0);

      // Add a notebook mutation -> queued
      await workspace.saveNotebook(FIXTURE_NOTEBOOK);
      summary = await workspace.getSyncSummary();
      expect(summary.status).toBe('queued');
      expect(summary.pendingMutations).toBe(1);

      // Add canvas note -> 2 pending mutations
      await workspace.saveCanvasScene('c-1', { elements: [], appState: {} });
      summary = await workspace.getSyncSummary();
      expect(summary.pendingMutations).toBe(2);

      // Acknowledge outbox up to current generation -> returns to synced
      await workspace.getRepository().acknowledgeOutboxUpTo(workspace.getGeneration());
      summary = await workspace.getSyncSummary();
      expect(summary.status).toBe('synced');
      expect(summary.pendingMutations).toBe(0);
    });
  });

  describe('6. Export & Import Recovery Bundle', () => {
    beforeEach(async () => {
      await workspace.open({ userId: TEST_USER_1 });
      await workspace.saveNotebook(FIXTURE_NOTEBOOK);
      await workspace.saveCanvasScene('note-canvas-01', {
        elements: [
          { id: 'el-1', type: 'image', fileId: 'asset-img-01', x: 0, y: 0, width: 50, height: 50 },
        ],
        appState: {},
        files: {
          'asset-img-01': {
            id: 'asset-img-01',
            dataURL: `data:image/png;base64,${SYNTHETIC_PNG_BASE64}`,
            mimeType: 'image/png',
          },
        },
      });
      workspace.updateCanvasEditorBuffer('draft-note', { text: 'Unsaved draft' });
    });

    it('exports recovery bundle as Blob containing committed state and valid checksum', async () => {
      const blob = await workspace.exportRecoveryBundle();

      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('application/json');

      const jsonText = await blob.text();
      const parsed = JSON.parse(jsonText);

      expect(parsed.formatVersion).toBe('1.0.0');
      expect(parsed.sourceUserId).toBe(TEST_USER_1);
      expect(parsed.checksum).toBeDefined();
      expect(parsed.checksum).toMatch(/^[0-9a-f]{64}$/);

      // Verifies committed notebooks, notes, and assets exist in export
      expect(parsed.committedState.notebooks).toHaveLength(1);
      expect(parsed.committedState.notes).toHaveLength(1);
      expect(parsed.committedState.assets).toHaveLength(1);
      expect(parsed.committedState.assets[0].hash).toBe(SYNTHETIC_ASSET_HASH);

      // Verifies unsaved live editor buffers are preserved in recovery bundle
      expect(parsed.unsavedBuffers.some((b: any) => b.noteId === 'draft-note')).toBe(true);
    });

    it('restores recovery bundle cleanly into a fresh workspace repository', async () => {
      const blob = await workspace.exportRecoveryBundle();

      // Fresh workspace for User 2
      const freshWs = new LocalWorkspace(TEST_USER_2, { useMemory: true });
      await freshWs.open({ userId: TEST_USER_2 });

      expect(freshWs.getNotesState().notebooks).toHaveLength(0);

      const importRes = await freshWs.importRecoveryBundle(blob);
      expect(importRes.importedCounts.notebooks).toBe(1);
      expect(importRes.importedCounts.notes).toBe(1);
      expect(importRes.importedCounts.assets).toBe(1);

      const restoredState = freshWs.getNotesState();
      expect(restoredState.notebooks).toHaveLength(1);
      expect(restoredState.notebooks[0].id).toBe(FIXTURE_NOTEBOOK.id);
      expect(restoredState.notes).toHaveLength(1);
      expect(restoredState.notes[0].id).toBe('note-canvas-01');

      await freshWs.close();
    });
  });

  describe('7. UI Preferences & NotesStateEntity Synchronization', () => {
    beforeEach(async () => {
      await workspace.open({ userId: TEST_USER_1 });
      await workspace.saveNotebook(FIXTURE_NOTEBOOK);
      await workspace.saveCanvasScene('note-canvas-01', { elements: [], appState: {} });
    });

    it('updates selection and sort preferences without creating outbox mutations', async () => {
      const outboxBefore = (await workspace.getRepository().getPendingOutbox()).length;
      const listener = vi.fn();
      workspace.subscribe(listener);

      workspace.setSelectedNotebook(FIXTURE_NOTEBOOK.id);
      workspace.setSelectedNote('note-canvas-01');
      workspace.setFilter('favorites');
      workspace.setNoteSort('alphabetical');

      const state = workspace.getNotesState();
      expect(state.selectedNotebookId).toBe(FIXTURE_NOTEBOOK.id);
      expect(state.selectedNoteId).toBe('note-canvas-01');
      expect(state.filter).toBe('favorites');
      expect(state.noteSort).toBe('alphabetical');

      // Preferences must NEVER dirty remote outbox per Section 4.2
      const outboxAfter = (await workspace.getRepository().getPendingOutbox()).length;
      expect(outboxAfter).toBe(outboxBefore);
      expect(listener).toHaveBeenCalled();
    });
  });
});
