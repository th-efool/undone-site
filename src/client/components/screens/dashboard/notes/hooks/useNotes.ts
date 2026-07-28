"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { filterNotes, toNotebookItems } from "../adapters/notes.adapter";
import type { NoteEntity, NotesFilter, NotesSort, NotesStateEntity, Permission } from "../models/notes.models";
import { notesRepository } from "../repositories/notes.repository";

const stamp = () => new Date().toISOString();
const id = (p: string) => `${p}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export function useNotes() {
  const [state, setState] = useState<NotesStateEntity | null>(null);
  const [notebookQuery, setNotebookQuery] = useState("");
  const [noteQuery, setNoteQuery] = useState("");
  const [toast, setToast] = useState("");
  const [lastDeleted, setLastDeleted] = useState<{ notes: NoteEntity[]; notebooks: NotesStateEntity["notebooks"] } | null>(null);
  useEffect(() => { notesRepository.load().then(setState); }, []);
  useEffect(() => { if (state) void notesRepository.save(state); }, [state]);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(""), 2800); return () => clearTimeout(t); } }, [toast]);

  const update = useCallback((fn: (s: NotesStateEntity) => NotesStateEntity) => setState((s) => s ? fn(s) : s), []);
  const data = useMemo(() => state ? {
    notebooks: toNotebookItems(state, notebookQuery, noteQuery),
    notes: filterNotes(state, noteQuery),
    selectedNotebook: state.notebooks.find((n) => n.id === state.selectedNotebookId) ?? null,
    selectedNote: state.notes.find((n) => n.id === state.selectedNoteId) ?? null,
  } : null, [state, notebookQuery, noteQuery]);

  const selectNotebook = (notebookId: string) => update((s) => ({ ...s, selectedNotebookId: notebookId, selectedNoteId: s.selectedNoteId && s.notes.some((n) => n.id === s.selectedNoteId && n.notebookId === notebookId && !n.archived) ? s.selectedNoteId : s.notes.find((n) => n.notebookId === notebookId && !n.archived)?.id ?? null }));
  const createNotebook = () => update((s) => { const book = { id: id("nb"), title: "Untitled Notebook", description: "New thinking space", color: "#4f46e5", favorite: false, shared: false, archived: false, collapsed: false, createdAt: stamp(), updatedAt: stamp(), order: s.notebooks.length }; return { ...s, notebooks: [...s.notebooks, book], selectedNotebookId: book.id, selectedNoteId: null }; });
  const patchNotebook = (notebookId: string, patch: Partial<NotesStateEntity["notebooks"][number]>) => update((s) => ({ ...s, notebooks: s.notebooks.map((n) => n.id === notebookId ? { ...n, ...patch, updatedAt: stamp() } : n) }));
  const duplicateNotebook = (notebookId: string) => update((s) => { const b = s.notebooks.find((n) => n.id === notebookId); if (!b) return s; const newId = id("nb"); const notes = s.notes.filter((n) => n.notebookId === notebookId).map((n, i) => ({ ...n, id: id("note"), notebookId: newId, title: `${n.title} copy`, order: i, createdAt: stamp(), updatedAt: stamp() })); return { ...s, notebooks: [...s.notebooks, { ...b, id: newId, title: `${b.title} copy`, order: s.notebooks.length, createdAt: stamp(), updatedAt: stamp() }], notes: [...s.notes, ...notes] }; });
  const deleteNotebook = (notebookId: string) => update((s) => { if (!confirm("Delete this notebook and its notes?")) return s; const deletedBooks = s.notebooks.filter((n) => n.id === notebookId); const deletedNotes = s.notes.filter((n) => n.notebookId === notebookId); setLastDeleted({ notebooks: deletedBooks, notes: deletedNotes }); setToast("Notebook deleted. Undo available."); const notebooks = s.notebooks.filter((n) => n.id !== notebookId); return { ...s, notebooks, notes: s.notes.filter((n) => n.notebookId !== notebookId), selectedNotebookId: notebooks[0]?.id ?? null, selectedNoteId: s.notes.find((n) => n.notebookId === notebooks[0]?.id)?.id ?? null }; });
  const createNote = (notebookId = state?.selectedNotebookId) => update((s) => { if (!notebookId) return s; const note = { id: id("note"), notebookId, title: "Untitled Note", body: "<h1>Untitled Note</h1><p>Start writing...</p>", tags: [], favorite: false, shared: false, archived: false, createdAt: stamp(), updatedAt: stamp(), order: s.notes.filter((n) => n.notebookId === notebookId).length, publicLink: false, permission: "editor" as Permission, sharedWith: [] }; return { ...s, notes: [...s.notes, note], selectedNotebookId: notebookId, selectedNoteId: note.id }; });
  const patchNote = (noteId: string, patch: Partial<NoteEntity>) => update((s) => ({ ...s, notes: s.notes.map((n) => n.id === noteId ? { ...n, ...patch, updatedAt: stamp() } : n) }));
  const duplicateNote = (noteId: string) => update((s) => { const n = s.notes.find((x) => x.id === noteId); return n ? { ...s, notes: [...s.notes, { ...n, id: id("note"), title: `${n.title} copy`, order: s.notes.length, createdAt: stamp(), updatedAt: stamp() }] } : s; });
  const deleteNote = (noteId: string) => update((s) => { if (!confirm("Delete this note?")) return s; const deleted = s.notes.filter((n) => n.id === noteId); setLastDeleted({ notebooks: [], notes: deleted }); setToast("Note deleted. Undo available."); const notes = s.notes.filter((n) => n.id !== noteId); return { ...s, notes, selectedNoteId: notes.find((n) => n.notebookId === s.selectedNotebookId)?.id ?? null }; });
  const moveNotebook = (from: string, to: string) => update((s) => reorder(s, "notebooks", from, to));
  const moveNote = (noteId: string, notebookId: string) => update((s) => ({ ...s, notes: s.notes.map((n) => n.id === noteId ? { ...n, notebookId, order: s.notes.filter((x) => x.notebookId === notebookId).length, updatedAt: stamp() } : n), selectedNotebookId: notebookId, selectedNoteId: noteId }));
  const undo = () => update((s) => lastDeleted ? (setToast("Restored."), setLastDeleted(null), { ...s, notebooks: [...s.notebooks, ...lastDeleted.notebooks], notes: [...s.notes, ...lastDeleted.notes] }) : s);

  const archiveNotebook = (notebookId: string) => update((s) => {
    const book = s.notebooks.find((n) => n.id === notebookId);
    if (!book) return s;
    if (!book.archived && !confirm(`Archive notebook "${book.title}" and hide it from normal lists?`)) return s;
    const archived = !book.archived;
    const notebooks = s.notebooks.map((n) => n.id === notebookId ? { ...n, archived, updatedAt: stamp() } : n);
    const notes = s.notes.map((n) => n.notebookId === notebookId ? { ...n, archived, updatedAt: stamp() } : n);
    const nextNotebookId = archived && s.selectedNotebookId === notebookId ? notebooks.find((n) => !n.archived)?.id ?? notebookId : s.selectedNotebookId;
    const nextNoteId = archived && s.selectedNotebookId === notebookId ? notes.find((n) => n.notebookId === nextNotebookId && !n.archived)?.id ?? null : s.selectedNoteId;
    setToast(archived ? "Notebook archived." : "Notebook restored.");
    return { ...s, notebooks, notes, selectedNotebookId: nextNotebookId, selectedNoteId: nextNoteId };
  });
  const archiveNote = (noteId: string) => update((s) => {
    const note = s.notes.find((n) => n.id === noteId);
    if (!note) return s;
    if (!note.archived && !confirm(`Archive note "${note.title}"?`)) return s;
    const archived = !note.archived;
    const notes = s.notes.map((n) => n.id === noteId ? { ...n, archived, updatedAt: stamp() } : n);
    setToast(archived ? "Note archived." : "Note restored.");
    return { ...s, notes, selectedNoteId: archived && s.selectedNoteId === noteId ? notes.find((n) => n.notebookId === s.selectedNotebookId && !n.archived)?.id ?? null : s.selectedNoteId };
  });

  return { state, data, notebookQuery, setNotebookQuery, noteQuery, setNoteQuery, toast, undo, actions: { selectNotebook, selectNote: (id: string) => update((s) => ({ ...s, selectedNoteId: id })), createNotebook, patchNotebook, duplicateNotebook, deleteNotebook, createNote, patchNote, duplicateNote, deleteNote, moveNotebook, moveNote, archiveNotebook, archiveNote, setNotebookSort: (sort: NotesSort) => update((s) => ({ ...s, notebookSort: sort })), setNoteSort: (sort: NotesSort) => update((s) => ({ ...s, noteSort: sort })), setFilter: (filter: NotesFilter) => update((s) => ({ ...s, filter })) } };
}
function reorder(s: NotesStateEntity, key: "notebooks", fromId: string, toId: string) { const arr = [...s[key]]; const from = arr.findIndex((x) => x.id === fromId); const to = arr.findIndex((x) => x.id === toId); if (from < 0 || to < 0) return s; const [item] = arr.splice(from, 1); arr.splice(to, 0, item); return { ...s, [key]: arr.map((x, order) => ({ ...x, order })) }; }
