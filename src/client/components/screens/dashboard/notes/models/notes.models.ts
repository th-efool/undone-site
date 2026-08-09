export type NotesSort =
  'manual' | 'alphabetical' | 'recentlyEdited' | 'recentlyCreated' | 'oldestFirst' | 'newestFirst';
export type NotesFilter = 'all' | 'favorites' | 'recent' | 'shared' | 'archived';
export type Permission = 'viewer' | 'editor' | 'owner';

export type NoteDocument = {
  id: string;
  notebookId: string;
  title: string;
  ownerId: string | null;
  permission: Permission;
  sharedWith: string[];
  publicLink: boolean;
  tags: string[];
  favorite: boolean;
  shared: boolean;
  archived: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
  contentType: 'canvas' | 'kanban';
  linkedConceptIds: string[];
  linkedResourceIds: string[];
  learningPathId: string | null;
  revision: number | null;
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
  notes: NoteDocument[];
  selectedNotebookId: string | null;
  selectedNoteId: string | null;
  notebookSort: NotesSort;
  noteSort: NotesSort;
  filter: NotesFilter;
};

export type NotebookListItem = NotebookEntity & {
  noteCount: number;
  visibleNotes: NoteDocument[];
};
