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

export class NotesRepository {
  async load(): Promise<NotesStateEntity> {
    if (typeof window === 'undefined') return structuredClone(EMPTY_NOTES_STATE);
    
    try {
      const response = await fetch('/api/workspace/notes');
      if (!response.ok) throw new Error('Failed to fetch notes');
      return await response.json();
    } catch (e) {
      console.error('Failed to load notes from API', e);
      return structuredClone(EMPTY_NOTES_STATE);
    }
  }

  async save(state: NotesStateEntity): Promise<NotesStateEntity> {
    if (typeof window !== 'undefined') {
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
        
        return await response.json();
      } catch (error) {
        console.error('Failed to save notes to API', error);
      }
    }
    return state;
  }
}

export const notesRepository = new NotesRepository();
