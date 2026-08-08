import { seedNotesState } from '../mock/notes.seed';
import type { NotesStateEntity } from '../models/notes.models';

const KEY_V3 = 'sidequesthq.notes.v3';

export class NotesRepository {
  async load(): Promise<NotesStateEntity> {
    if (typeof window === 'undefined') return structuredClone(seedNotesState);
    
    const saved = window.localStorage.getItem(KEY_V3);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse notes from storage', e);
      }
    }
    
    // Fallback to fresh seed
    const seed = structuredClone(seedNotesState);
    window.localStorage.setItem(KEY_V3, JSON.stringify(seed));
    return seed;
  }

  async save(state: NotesStateEntity): Promise<NotesStateEntity> {
    if (typeof window !== 'undefined') window.localStorage.setItem(KEY_V3, JSON.stringify(state));
    return state;
  }
}

export const notesRepository = new NotesRepository();
