import type { NotebookListItem, NotesFilter, NotesSort, NotesStateEntity } from "../models/notes.models";

const byDate = <T extends { createdAt: string; updatedAt: string }>(field: "createdAt" | "updatedAt", dir: 1 | -1) => (a: T, b: T) =>
  (new Date(a[field]).getTime() - new Date(b[field]).getTime()) * dir;

export function sortItems<T extends { title: string; order: number; createdAt: string; updatedAt: string }>(items: T[], sort: NotesSort): T[] {
  const copy = [...items];
  if (sort === "alphabetical") return copy.sort((a, b) => a.title.localeCompare(b.title));
  if (sort === "recentlyEdited" || sort === "newestFirst") return copy.sort(byDate("updatedAt", -1));
  if (sort === "recentlyCreated") return copy.sort(byDate("createdAt", -1));
  if (sort === "oldestFirst") return copy.sort(byDate("createdAt", 1));
  return copy.sort((a, b) => a.order - b.order);
}

export function filterNotes(state: NotesStateEntity, query: string) {
  const q = query.trim().toLowerCase();
  return sortItems(state.notes, state.noteSort).filter((note) => {
    const matchesFilter = state.filter === "all" ||
      (state.filter === "favorites" && note.favorite) ||
      (state.filter === "recent" && Date.now() - new Date(note.updatedAt).getTime() < 14 * 86400000) ||
      (state.filter === "shared" && note.shared) ||
      (state.filter === "archived" && note.archived);
    const matchesQuery = !q || `${note.title} ${note.tags.join(" ")} ${note.body.replace(/<[^>]*>/g, " ")}`.toLowerCase().includes(q);
    return matchesFilter && matchesQuery;
  });
}

export function toNotebookItems(state: NotesStateEntity, notebookQuery: string, noteQuery = ""): NotebookListItem[] {
  const q = notebookQuery.trim().toLowerCase();
  const notes = filterNotes(state, noteQuery);
  return sortItems(state.notebooks, state.notebookSort)
    .filter((book) => !q || `${book.title} ${book.description}`.toLowerCase().includes(q))
    .map((book) => ({ ...book, noteCount: state.notes.filter((n) => n.notebookId === book.id && !n.archived).length, visibleNotes: notes.filter((n) => n.notebookId === book.id) }));
}

export const filterLabels: Record<NotesFilter, string> = { all: "All notes", favorites: "Favorites", recent: "Recently edited", shared: "Shared with me", archived: "Archive" };
