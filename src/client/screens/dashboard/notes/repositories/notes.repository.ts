import type { NotesStateEntity } from '../models/notes.models';
import { LocalWorkspace } from '@/src/client/personal-workspace/local/facade';
import { canvasRepository } from './canvas.repository';
import { canonicalJsonStringify, computeSha256 } from '@/src/shared/personal-workspace/serialization';

const EMPTY_NOTES_STATE: NotesStateEntity = {
  notebooks: [],
  notes: [],
  selectedNotebookId: null,
  selectedNoteId: null,
  notebookSort: 'manual',
  noteSort: 'manual',
  filter: 'all',
};

const NOTES_CACHE_PREFIX = 'sidequest_notes_state_v1:';
const memoryNotesStateByUser = new Map<string, NotesStateEntity>();

export interface NotesSaveResult {
  ok: boolean;
  localSaved: boolean;
  remoteSaved: boolean;
  data: NotesStateEntity;
  error?: string;
}

export class NotesRepository {
  private getCacheKey(userId?: string | null): string {
    return `${NOTES_CACHE_PREFIX}${userId || 'anon'}`;
  }

  getInitialState(userId?: string | null): NotesStateEntity {
    const memoryKey = userId || 'anon';
    const memory = memoryNotesStateByUser.get(memoryKey) || (userId === 'local-user' ? memoryNotesStateByUser.get('anon') : undefined);
    if (memory) return structuredClone(memory);
    if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'test') {
      try {
        const raw = localStorage.getItem(this.getCacheKey(userId)) || (userId === 'local-user' ? localStorage.getItem(this.getCacheKey(null)) : null);
        if (raw) {
          const parsed = JSON.parse(raw) as NotesStateEntity;
          if (parsed && Array.isArray(parsed.notebooks) && Array.isArray(parsed.notes)) {
            memoryNotesStateByUser.set(memoryKey, parsed);
            return structuredClone(parsed);
          }
        }
      } catch {}
    }
    return structuredClone(EMPTY_NOTES_STATE);
  }

  async load(userId?: string | null): Promise<NotesStateEntity> {
    if (typeof window === 'undefined') return structuredClone(EMPTY_NOTES_STATE);
    const memoryKey = userId || 'anon';
    const targetUserId = userId || 'local-user';
    canvasRepository.setActiveUserId(targetUserId);
    let localState: NotesStateEntity | null = null;
    try {
      const snapshot = await LocalWorkspace.getLocalWorkspace(targetUserId).open({ userId: targetUserId });
      localState = snapshot.notesState;
      if (snapshot.pendingOutbox.length > 0 || localState.notes.length > 0 || localState.notebooks.length > 0) {
        memoryNotesStateByUser.set(memoryKey, localState);
        return localState;
      }
    } catch {}

    try {
      const response = await fetch('/api/workspace/notes');
      if (response.status === 401) {
        return localState || this.getInitialState(userId);
      }
      if (!response.ok) throw new Error('Failed to fetch notes');
      const loaded = (await response.json()) as NotesStateEntity;
      memoryNotesStateByUser.set(memoryKey, loaded);
      if (process.env.NODE_ENV !== 'test') {
        try {
          localStorage.setItem(this.getCacheKey(userId), JSON.stringify(loaded));
        } catch {}
      }
      return loaded;
    } catch {
      return localState || this.getInitialState(userId);
    }
  }

  async save(
    state: NotesStateEntity,
    userId?: string | null,
  ): Promise<NotesSaveResult> {
    const memoryKey = userId || 'anon';
    if (typeof window === 'undefined') {
      return {
        ok: false,
        localSaved: false,
        remoteSaved: false,
        data: state,
        error: 'Notes cannot be persisted during server rendering',
      };
    }

    try {
      await this.syncWithLocalWorkspace(state, userId);
    } catch (err) {
      return {
        ok: false,
        localSaved: false,
        remoteSaved: false,
        data: state,
        error: err instanceof Error ? err.message : String(err),
      };
    }

    memoryNotesStateByUser.set(memoryKey, state);
    if (process.env.NODE_ENV !== 'test') {
      try {
        localStorage.setItem(this.getCacheKey(userId), JSON.stringify(state));
      } catch {}
    }

    try {
      const response = await fetch('/api/workspace/notes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state),
      });
      if (!response.ok) {
        return { ok: false, localSaved: true, remoteSaved: false, data: state };
      }

      const saved = (await response.json()) as NotesStateEntity;
      memoryNotesStateByUser.set(memoryKey, saved);
      return { ok: true, localSaved: true, remoteSaved: true, data: saved };
    } catch (err) {
      return {
        ok: false,
        localSaved: true,
        remoteSaved: false,
        data: state,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async syncWithLocalWorkspace(state: NotesStateEntity, userId?: string | null): Promise<void> {
    if (typeof window === 'undefined') return;
    const targetUserId = userId || 'local-user';
    canvasRepository.setActiveUserId(targetUserId);
    const workspace = LocalWorkspace.getLocalWorkspace(targetUserId);
    const repo = workspace.getRepository();
    await repo.initialize();
    const requireSaved = (receipt: { ok: boolean; error?: string }) => {
      if (!receipt.ok) throw new Error(receipt.error || 'Local workspace transaction failed');
    };

      // 1. Sync notebooks
      for (const nb of state.notebooks) {
        requireSaved(await workspace.saveNotebook({
          id: nb.id,
          title: nb.title,
          description: nb.description,
          color: nb.color,
          icon: nb.icon,
          favorite: nb.favorite ?? false,
          shared: nb.shared ?? false,
          archived: nb.archived ?? false,
          collapsed: nb.collapsed ?? false,
          order: nb.order ?? 0,
          createdAt: nb.createdAt,
          updatedAt: nb.updatedAt,
        }));
      }

      // 2. Sync notes
      for (const note of state.notes) {
        if (note.contentType === 'canvas') {
          const existingNote = await repo.getNote(note.id);
          if (existingNote && existingNote.contentType === 'canvas') {
            requireSaved(await workspace.apply({
              type: 'save_canvas_note',
              note: {
                ...existingNote,
                title: note.title,
                notebookId: note.notebookId,
                order: note.order ?? 0,
                updatedAt: note.updatedAt || new Date().toISOString(),
                tags: note.tags || [],
                favorite: note.favorite ?? false,
                shared: note.shared ?? false,
                archived: note.archived ?? false,
              },
            }));
          } else {
            const legacyDoc = await canvasRepository.load(note.id);
            let sceneObj: { elements: unknown[]; appState: unknown; files: Record<string, unknown> } = {
              elements: [],
              appState: {},
              files: {},
            };
            if (legacyDoc?.scene) {
              try {
                sceneObj = JSON.parse(legacyDoc.scene);
              } catch {}
            }
            requireSaved(await workspace.saveCanvasScene(note.id, sceneObj, {
              title: note.title,
              notebookId: note.notebookId,
            }));
          }
        } else if (note.contentType === 'kanban') {
          requireSaved(await workspace.apply({
            type: 'save_kanban_note',
            note: {
              id: note.id,
              notebookId: note.notebookId,
              title: note.title,
              order: note.order ?? 0,
              createdAt: note.createdAt || new Date().toISOString(),
              updatedAt: note.updatedAt || new Date().toISOString(),
              ownerId: note.ownerId,
              permission: note.permission,
              tags: note.tags || [],
              favorite: note.favorite ?? false,
              shared: note.shared ?? false,
              archived: note.archived ?? false,
              contentType: 'kanban',
              kanbanData: {
                columns: (note.kanbanColumns || []).map((c, i) => ({ id: c.id, title: c.label, order: i })),
                cards: note.kanbanCards || [],
              },
            },
          }));
        }
      }

      // 3. Remove deleted notebooks
      const existingNotebooks = await repo.getAllNotebooks();
      const stateNotebookIds = new Set(state.notebooks.map((nb) => nb.id));
      for (const existing of existingNotebooks) {
        if (!stateNotebookIds.has(existing.id)) {
          requireSaved(await workspace.deleteEntity('notebook', existing.id));
        }
      }

      // 4. Remove deleted notes
      const existingNotes = await repo.getAllNotes();
      const stateNoteIds = new Set(state.notes.map((n) => n.id));
      for (const existing of existingNotes) {
        if (!stateNoteIds.has(existing.id)) {
          requireSaved(await workspace.deleteEntity('note', existing.id));
        }
      }
  }

  async migrateLegacyState(state: NotesStateEntity, userId?: string | null): Promise<void> {
    const targetUserId = userId || 'local-user';
    const workspace = LocalWorkspace.getLocalWorkspace(targetUserId);
    const repository = workspace.getRepository();
    const before = await repository.getSyncSnapshot();
    if (
      before.notebooks.length || before.notes.length || before.assets.length || before.schedules.length || before.outbox.length
    ) {
      throw new Error('Legacy import requires an empty local workspace; existing data was left untouched.');
    }

    await this.syncWithLocalWorkspace(state, targetUserId);
    const inventory = await repository.getMigrationInventory();
    const after = await repository.getSyncSnapshot();
    const projection = (value: NotesStateEntity) => ({
      notebooks: value.notebooks.map(({ id, title, color, order }) => ({ id, title, color, order })).sort((a, b) => a.id.localeCompare(b.id)),
      notes: value.notes.map(({ id, title, notebookId, contentType, order }) => ({ id, title, notebookId, contentType, order })).sort((a, b) => a.id.localeCompare(b.id)),
    });
    const importedProjection = {
      notebooks: after.notebooks.map(({ id, title, color, order }) => ({ id, title, color, order })).sort((a, b) => a.id.localeCompare(b.id)),
      notes: after.notes.map(({ id, title, notebookId, contentType, order }) => ({ id, title, notebookId, contentType, order })).sort((a, b) => a.id.localeCompare(b.id)),
    };
    const sourceHash = computeSha256(canonicalJsonStringify(projection(state)));
    const importedHash = computeSha256(canonicalJsonStringify(importedProjection));
    if (
      inventory.counts.notebooks !== state.notebooks.length ||
      inventory.counts.notes !== state.notes.length ||
      sourceHash !== importedHash
    ) {
      throw new Error('Legacy notes import verification failed; the original local cache was retained.');
    }
    await repository.getDatabase().runTransaction(['metadata'], 'readwrite', (ctx) => {
      ctx.put('metadata', 'legacyMigrationReceipt', {
        key: 'legacyMigrationReceipt', schemaVersion: 1, importedAt: new Date().toISOString(),
        counts: inventory.counts, hashes: inventory.hashes, assetBytes: inventory.assetBytes,
        serializedBytes: inventory.serializedBytes, sourceHash,
      });
    });
  }

  async mergeLegacyServerState(source: NotesStateEntity, userId?: string | null): Promise<void> {
    const targetUserId = userId || 'local-user';
    const workspace = LocalWorkspace.getLocalWorkspace(targetUserId);
    const repo = workspace.getRepository();
    const local = workspace.getNotesState();
    const localNoteIds = new Set(local.notes.map((note) => note.id));
    const legacyCanvases = new Set(canvasRepository.getLegacyStorageInventory().map((entry) => entry.noteId));
    const incompleteCanvasIds = source.notes
      .filter((note) => note.contentType === 'canvas' && !localNoteIds.has(note.id) && !legacyCanvases.has(note.id))
      .map((note) => note.id);
    if (incompleteCanvasIds.length) {
      throw new Error(`Legacy server canvas scenes are unavailable on this device: ${incompleteCanvasIds.join(', ')}`);
    }

    const mergeById = <T extends { id: string }>(localItems: T[], sourceItems: T[]) => {
      const merged = new Map(localItems.map((item) => [item.id, item]));
      const collisions: Array<{ local: T; legacy: T }> = [];
      for (const item of sourceItems) {
        const existing = merged.get(item.id);
        if (!existing) merged.set(item.id, item);
        else if (canonicalJsonStringify(existing) !== canonicalJsonStringify(item)) {
          collisions.push({ local: existing, legacy: item });
        }
      }
      return { items: Array.from(merged.values()), collisions };
    };
    const notebooks = mergeById(local.notebooks, source.notebooks || []);
    const notes = mergeById(local.notes, source.notes || []);
    const mergedState: NotesStateEntity = {
      ...local,
      notebooks: notebooks.items,
      notes: notes.items,
      selectedNotebookId: local.selectedNotebookId || notebooks.items[0]?.id || null,
      selectedNoteId: local.selectedNoteId || notes.items[0]?.id || null,
    };

    const collisionRecords = [...notebooks.collisions.map((entry) => ({ entityType: 'notebook', ...entry })),
      ...notes.collisions.map((entry) => ({ entityType: 'note', ...entry }))];
    if (collisionRecords.length) {
      await repo.getDatabase().runTransaction(['conflicts'], 'readwrite', (ctx) => {
        for (const entry of collisionRecords) {
          const localHash = computeSha256(canonicalJsonStringify(entry.local));
          const legacyHash = computeSha256(canonicalJsonStringify(entry.legacy));
          const id = `legacy-${computeSha256(`${entry.entityType}:${entry.local.id}:${localHash}:${legacyHash}`)}`;
          ctx.put('conflicts', id, {
            id, entityType: entry.entityType, entityId: entry.local.id,
            recoveredAutomatically: true, source: 'legacy-server',
            localVersion: entry.local, remoteVersion: entry.legacy,
            localHash, remoteHash: legacyHash, detectedAt: new Date().toISOString(),
          });
        }
      });
    }

    await this.syncWithLocalWorkspace(mergedState, targetUserId);
    const inventory = await repo.getMigrationInventory();
    const after = await repo.getSyncSnapshot();
    const expectedNoteIds = new Set(mergedState.notes.map((note) => note.id));
    const expectedNotebookIds = new Set(mergedState.notebooks.map((notebook) => notebook.id));
    if (
      after.notes.length !== expectedNoteIds.size || after.notebooks.length !== expectedNotebookIds.size ||
      after.notes.some((note) => !expectedNoteIds.has(note.id)) ||
      after.notebooks.some((notebook) => !expectedNotebookIds.has(notebook.id))
    ) {
      throw new Error('Legacy server workspace merge verification failed; the MongoDB source was retained.');
    }
    const sourceHash = computeSha256(canonicalJsonStringify({
      notebooks: [...(source.notebooks || [])].sort((a, b) => a.id.localeCompare(b.id)),
      notes: [...(source.notes || [])].sort((a, b) => a.id.localeCompare(b.id)),
    }));
    await repo.getDatabase().runTransaction(['metadata'], 'readwrite', (ctx) => {
      ctx.put('metadata', 'legacyServerMergeReceipt', {
        key: 'legacyServerMergeReceipt', schemaVersion: 1, importedAt: new Date().toISOString(),
        counts: { notebooks: source.notebooks?.length || 0, notes: source.notes?.length || 0 },
        sourceHash, localInventory: { counts: inventory.counts, hashes: inventory.hashes },
      });
    });
  }
}

export const notesRepository = new NotesRepository();
