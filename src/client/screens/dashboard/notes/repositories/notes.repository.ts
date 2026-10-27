import type { NotesStateEntity } from '../models/notes.models';
import { LocalWorkspace } from '@/src/client/personal-workspace/local/facade';
import { canvasRepository } from './canvas.repository';

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

export class NotesRepository {
  private getCacheKey(userId?: string | null): string {
    return `${NOTES_CACHE_PREFIX}${userId || 'anon'}`;
  }

  getInitialState(userId?: string | null): NotesStateEntity {
    const memoryKey = userId || 'anon';
    const memory = memoryNotesStateByUser.get(memoryKey);
    if (memory) return structuredClone(memory);
    if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'test') {
      try {
        const raw = localStorage.getItem(this.getCacheKey(userId));
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
    try {
      const response = await fetch('/api/workspace/notes');
      if (response.status === 401) {
        return this.getInitialState(userId);
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
      return this.getInitialState(userId);
    }
  }

  async save(
    state: NotesStateEntity,
    userId?: string | null,
  ): Promise<{ ok: boolean; data: NotesStateEntity }> {
    const memoryKey = userId || 'anon';
    memoryNotesStateByUser.set(memoryKey, state);
    if (typeof window !== 'undefined') {
      this.syncWithLocalWorkspace(state, userId).catch((err) => {
        console.warn('[notesRepository] LocalWorkspace sync error:', err);
      });
      if (process.env.NODE_ENV !== 'test') {
        try {
          localStorage.setItem(this.getCacheKey(userId), JSON.stringify(state));
        } catch {}
      }
      try {
        const response = await fetch('/api/workspace/notes', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(state),
        });

        if (response.status === 401) {
          return { ok: true, data: state };
        }

        if (!response.ok) {
          return { ok: false, data: state };
        }

        const saved = (await response.json()) as NotesStateEntity;
        memoryNotesStateByUser.set(memoryKey, saved);
        return { ok: true, data: saved };
      } catch {
        return { ok: false, data: state };
      }
    }
    return { ok: true, data: state };
  }

  async syncWithLocalWorkspace(state: NotesStateEntity, userId?: string | null): Promise<void> {
    if (typeof window === 'undefined') return;
    const targetUserId = userId || 'local-user';
    try {
      const workspace = LocalWorkspace.getLocalWorkspace(targetUserId);
      const repo = workspace.getRepository();
      await repo.initialize();

      // 1. Sync notebooks
      for (const nb of state.notebooks) {
        await workspace.saveNotebook({
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
        });
      }

      // 2. Sync notes
      for (const note of state.notes) {
        if (note.contentType === 'canvas') {
          const existingNote = await repo.getNote(note.id);
          if (existingNote && existingNote.contentType === 'canvas') {
            await workspace.apply({
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
            });
          } else {
            const legacyDoc = await canvasRepository.load(note.id);
            let sceneObj: any = { elements: [], appState: {}, files: {} };
            if (legacyDoc?.scene) {
              try {
                sceneObj = JSON.parse(legacyDoc.scene);
              } catch {}
            }
            await workspace.saveCanvasScene(note.id, sceneObj, {
              title: note.title,
              notebookId: note.notebookId,
            });
          }
        } else if (note.contentType === 'kanban') {
          await workspace.apply({
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
          });
        }
      }

      // 3. Remove deleted notebooks
      const existingNotebooks = await repo.getAllNotebooks();
      const stateNotebookIds = new Set(state.notebooks.map((nb) => nb.id));
      for (const existing of existingNotebooks) {
        if (!stateNotebookIds.has(existing.id)) {
          await workspace.deleteEntity('notebook', existing.id);
        }
      }

      // 4. Remove deleted notes
      const existingNotes = await repo.getAllNotes();
      const stateNoteIds = new Set(state.notes.map((n) => n.id));
      for (const existing of existingNotes) {
        if (!stateNoteIds.has(existing.id)) {
          await workspace.deleteEntity('note', existing.id);
        }
      }
    } catch (err) {
      console.warn('[notesRepository] syncWithLocalWorkspace error:', err);
    }
  }
}

export const notesRepository = new NotesRepository();
