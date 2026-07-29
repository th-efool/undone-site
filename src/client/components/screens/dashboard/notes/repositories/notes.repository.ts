import { seedNotesState } from '../mock/notes.seed';
import type { NotesStateEntity } from '../models/notes.models';

const KEY = 'sidequesthq.notes.v1';

export class NotesRepository {
  async load(): Promise<NotesStateEntity> {
    if (typeof window === 'undefined') return structuredClone(seedNotesState);
    const saved = window.localStorage.getItem(KEY);
    return saved ? JSON.parse(saved) : structuredClone(seedNotesState);
  }

  async save(state: NotesStateEntity): Promise<NotesStateEntity> {
    if (typeof window !== 'undefined') window.localStorage.setItem(KEY, JSON.stringify(state));
    return state;
  }
}

export const notesRepository = new NotesRepository();
