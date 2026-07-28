export type NotesSort = "manual" | "alphabetical" | "recentlyEdited" | "recentlyCreated" | "oldestFirst" | "newestFirst";
export type NotesFilter = "all" | "favorites" | "recent" | "shared" | "archived";
export type Permission = "viewer" | "editor" | "owner";

export type NoteEntity = {
  id: string;
  notebookId: string;
  title: string;
  body: string;
  tags: string[];
  favorite: boolean;
  shared: boolean;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  order: number;
  publicLink: boolean;
  permission: Permission;
  sharedWith: string[];
};

export type NotebookEntity = {
  id: string;
  title: string;
  description: string;
  color: string;
  favorite: boolean;
  shared: boolean;
  archived: boolean;
  collapsed: boolean;
  createdAt: string;
  updatedAt: string;
  order: number;
};

export type NotesStateEntity = {
  notebooks: NotebookEntity[];
  notes: NoteEntity[];
  selectedNotebookId: string | null;
  selectedNoteId: string | null;
  notebookSort: NotesSort;
  noteSort: NotesSort;
  filter: NotesFilter;
};

export type NotebookListItem = NotebookEntity & { noteCount: number; visibleNotes: NoteEntity[] };
