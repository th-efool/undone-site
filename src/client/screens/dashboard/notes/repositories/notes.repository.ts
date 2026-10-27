import type { NotesStateEntity } from '../models/notes.models';

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
}

export const notesRepository = new NotesRepository();
