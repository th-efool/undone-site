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

const NOTES_CACHE_KEY = 'sidequest_notes_state_v1';
let memoryNotesState: NotesStateEntity | null = null;

export class NotesRepository {
  getInitialState(): NotesStateEntity {
    if (memoryNotesState) return structuredClone(memoryNotesState);
    if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'test') {
      try {
        const raw = localStorage.getItem(NOTES_CACHE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as NotesStateEntity;
          if (parsed && Array.isArray(parsed.notebooks) && Array.isArray(parsed.notes)) {
            memoryNotesState = parsed;
            return structuredClone(parsed);
          }
        }
      } catch {}
    }
    return structuredClone(EMPTY_NOTES_STATE);
  }

  async load(): Promise<NotesStateEntity> {
    if (typeof window === 'undefined') return structuredClone(EMPTY_NOTES_STATE);
    
    try {
      const response = await fetch('/api/workspace/notes');
      if (!response.ok) throw new Error('Failed to fetch notes');
      const loaded = (await response.json()) as NotesStateEntity;
      memoryNotesState = loaded;
      if (process.env.NODE_ENV !== 'test') {
        try {
          localStorage.setItem(NOTES_CACHE_KEY, JSON.stringify(loaded));
        } catch {}
      }
      return loaded;
    } catch (e) {
      console.error('Failed to load notes from API', e);
      return this.getInitialState();
    }
  }

  async save(state: NotesStateEntity): Promise<NotesStateEntity> {
    memoryNotesState = state;
    if (typeof window !== 'undefined') {
      if (process.env.NODE_ENV !== 'test') {
        try {
          localStorage.setItem(NOTES_CACHE_KEY, JSON.stringify(state));
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
        
        if (!response.ok) {
          throw new Error('Failed to save notes');
        }
        
        const saved = (await response.json()) as NotesStateEntity;
        memoryNotesState = saved;
        return saved;
      } catch (error) {
        console.error('Failed to save notes to API', error);
      }
    }
    return state;
  }
}

export const notesRepository = new NotesRepository();
