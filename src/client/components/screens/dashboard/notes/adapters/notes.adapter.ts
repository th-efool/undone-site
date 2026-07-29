import type {
  NoteEntity,
  NotebookEntity,
  NotebookListItem,
  NotesFilter,
  NotesSort,
  NotesStateEntity,
} from '../models/notes.models';

const byDate =
  <T extends { createdAt: string; updatedAt: string }>(
    field: 'createdAt' | 'updatedAt',
    dir: 1 | -1,
  ) =>
  (a: T, b: T) =>
    (new Date(a[field]).getTime() - new Date(b[field]).getTime()) * dir;

export function sortItems<
  T extends {
    title: string;
    order: number;
    createdAt: string;
    updatedAt: string;
  },
>(items: T[], sort: NotesSort): T[] {
  const copy = [...items];
  if (sort === 'alphabetical') return copy.sort((a, b) => a.title.localeCompare(b.title));
  if (sort === 'recentlyEdited') return copy.sort(byDate('updatedAt', -1));
  if (sort === 'recentlyCreated' || sort === 'newestFirst')
    return copy.sort(byDate('createdAt', -1));
  if (sort === 'oldestFirst') return copy.sort(byDate('createdAt', 1));
  return copy.sort((a, b) => a.order - b.order);
}

const isRecent = (item: { updatedAt: string }) =>
  Date.now() - new Date(item.updatedAt).getTime() < 14 * 86400000;
const notebookFor = (state: NotesStateEntity, note: NoteEntity) =>
  state.notebooks.find((book) => book.id === note.notebookId);

export function matchesFilter(state: NotesStateEntity, item: NoteEntity | NotebookEntity): boolean {
  if (state.filter === 'archived') return item.archived;
  if (item.archived) return false;
  if (state.filter === 'all') return true;
  if (state.filter === 'favorites')
    return item.favorite || ('notebookId' in item && Boolean(notebookFor(state, item)?.favorite));
  if (state.filter === 'recent') return isRecent(item);
  if (state.filter === 'shared') return item.shared;
  return true;
}

export function filterNotes(state: NotesStateEntity, query: string) {
  const q = query.trim().toLowerCase();
  return sortItems(state.notes, state.noteSort).filter((note) => {
    const matchesQuery =
      !q ||
      `${note.title} ${note.tags.join(' ')} ${note.body.replace(/<[^>]*>/g, ' ')}`
        .toLowerCase()
        .includes(q);
    return matchesFilter(state, note) && matchesQuery;
  });
}

export function toNotebookItems(
  state: NotesStateEntity,
  notebookQuery: string,
  noteQuery = '',
): NotebookListItem[] {
  const q = notebookQuery.trim().toLowerCase();
  const notes = filterNotes(state, noteQuery);
  return sortItems(state.notebooks, state.notebookSort)
    .filter(
      (book) => matchesFilter(state, book) || notes.some((note) => note.notebookId === book.id),
    )
    .filter((book) => !q || `${book.title} ${book.description}`.toLowerCase().includes(q))
    .map((book) => ({
      ...book,
      noteCount: state.notes.filter((n) => n.notebookId === book.id && !n.archived).length,
      visibleNotes: notes.filter((n) => n.notebookId === book.id),
    }));
}

export const filterLabels: Record<NotesFilter, string> = {
  all: 'All notes',
  favorites: 'Favorites',
  recent: 'Recently edited',
  shared: 'Shared with me',
  archived: 'Archive',
};
