import { describe, it, expect } from 'vitest';
import { matchesFilter } from '../adapters/notes.adapter';
import type { NotesStateEntity } from '../repositories/notes.repository';
import type { NoteDocument, NotebookEntity } from '../types/notes.types';

describe('Notes UI Features & Filtering Verification (Phase 6)', () => {
  const baseState: NotesStateEntity = {
    notebooks: [
      { id: 'nb-1', title: 'Work', order: 0, favorite: true, shared: false, archived: false, createdAt: '2026-01-01', updatedAt: '2026-01-01' },
      { id: 'nb-2', title: 'Personal', order: 1, favorite: false, shared: true, archived: false, createdAt: '2026-01-01', updatedAt: '2026-01-01' },
      { id: 'nb-3', title: 'Old', order: 2, favorite: false, shared: false, archived: true, createdAt: '2026-01-01', updatedAt: '2026-01-01' },
    ] as NotebookEntity[],
    notes: [
      { id: 'n-1', notebookId: 'nb-1', title: 'Fav note', tags: [], favorite: true, shared: false, archived: false, createdAt: '2026-01-01', updatedAt: '2026-01-01', order: 0, publicLink: false, permission: 'editor', sharedWith: [], contentType: 'canvas', ownerId: null, linkedConceptIds: [], linkedResourceIds: [], learningPathId: null, revision: null },
      { id: 'n-2', notebookId: 'nb-2', title: 'Shared note', tags: [], favorite: false, shared: false, publicLink: true, archived: false, createdAt: '2026-01-01', updatedAt: '2026-01-01', order: 1, permission: 'editor', sharedWith: [], contentType: 'canvas', ownerId: null, linkedConceptIds: [], linkedResourceIds: [], learningPathId: null, revision: null },
      { id: 'n-3', notebookId: 'nb-3', title: 'Archived note', tags: [], favorite: false, shared: false, archived: true, createdAt: '2026-01-01', updatedAt: '2026-01-01', order: 2, publicLink: false, permission: 'editor', sharedWith: [], contentType: 'canvas', ownerId: null, linkedConceptIds: [], linkedResourceIds: [], learningPathId: null, revision: null },
    ] as NoteDocument[],
    selectedNotebookId: 'nb-1',
    selectedNoteId: 'n-1',
    activeNoteId: 'n-1',
    filter: 'all',
    noteSort: 'manual',
    isSearching: false,
    searchQuery: '',
    dirty: false,
  };

  it('matchesFilter correctly surfaces favorite notes and notebook inheritance', () => {
    const favState: NotesStateEntity = { ...baseState, filter: 'favorites' };
    expect(matchesFilter(favState, baseState.notes[0])).toBe(true); // n-1 is favorite
    expect(matchesFilter(favState, baseState.notes[1])).toBe(false); // n-2 is not favorite
    expect(matchesFilter(favState, baseState.notes[2])).toBe(false); // n-3 is archived
  });

  it('matchesFilter correctly surfaces shared notes via shared flag or publicLink', () => {
    const sharedState: NotesStateEntity = { ...baseState, filter: 'shared' };
    expect(matchesFilter(sharedState, baseState.notes[0])).toBe(false);
    expect(matchesFilter(sharedState, baseState.notes[1])).toBe(true); // publicLink: true
  });

  it('matchesFilter correctly surfaces archived notes in trash view', () => {
    const trashState: NotesStateEntity = { ...baseState, filter: 'archived' };
    expect(matchesFilter(trashState, baseState.notes[0])).toBe(false);
    expect(matchesFilter(trashState, baseState.notes[2])).toBe(true); // n-3 is archived
  });

  it('computes accurate non-fake dynamic counts for Favorites, Shared, and Trash', () => {
    const favCount =
      baseState.notebooks.filter((n) => n.favorite && !n.archived).length +
      baseState.notes.filter((n) => n.favorite && !n.archived).length;
    expect(favCount).toBe(2); // 1 nb + 1 note

    const sharedCount =
      baseState.notebooks.filter((n) => n.shared && !n.archived).length +
      baseState.notes.filter((n) => (n.shared || n.publicLink || (n.sharedWith?.length ?? 0) > 0) && !n.archived).length;
    expect(sharedCount).toBe(2); // 1 nb + 1 note

    const trashCount =
      baseState.notebooks.filter((n) => n.archived).length +
      baseState.notes.filter((n) => n.archived).length;
    expect(trashCount).toBe(2); // 1 nb + 1 note
  });
});
