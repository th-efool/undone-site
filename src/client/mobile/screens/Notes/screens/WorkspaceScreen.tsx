'use client';

import { useState } from 'react';
import { ArrowLeft, Plus, LayoutGrid, CheckSquare, FileText } from 'lucide-react';
import type { UseNotesResult } from '@/src/client/screens/dashboard/notes/hooks/useNotes';
import styles from '../NotesMobile.module.css';

interface WorkspaceScreenProps {
  notes: UseNotesResult;
  onBack: () => void;
  onSelectNote: (noteId: string) => void;
}

export function WorkspaceScreen({ notes, onBack, onSelectNote }: WorkspaceScreenProps) {
  const [sheetOpen, setSheetOpen] = useState(false);

  const selectedNotebook = notes.data?.selectedNotebook ?? null;
  const notesInNotebook = (notes.state?.notes ?? []).filter(
    (n) => n.notebookId === selectedNotebook?.id && !n.archived,
  );

  const handleSelectNote = (noteId: string) => {
    notes.actions.selectNote(noteId);
    onSelectNote(noteId);
  };

  const handleCreateNote = (contentType: 'canvas' | 'kanban') => {
    setSheetOpen(false);
    notes.actions.createNote(selectedNotebook?.id, { contentType });
    // auto-advances to canvas via useNotesNavigation effect after selectedNote is set
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <div className={styles.screen}>
      {/* Top bar */}
      <header className={styles.screenHeader}>
        <button className={styles.backBtn} onClick={onBack} aria-label="Back to notebooks">
          <ArrowLeft size={18} />
          <span>Notes</span>
        </button>
        <h1 className={styles.screenTitle} style={{ flex: 1, textAlign: 'center' }}>
          {selectedNotebook?.title ?? 'Notebook'}
        </h1>
        <button
          className={styles.headerAction}
          onClick={() => setSheetOpen(true)}
          aria-label="New note"
        >
          <Plus size={20} />
        </button>
      </header>

      {/* Notes list */}
      <div className={styles.listScroll}>
        {notesInNotebook.length === 0 ? (
          <div className={styles.emptyState}>
            <FileText size={40} className={styles.emptyIcon} />
            <p className={styles.emptyTitle}>No notes yet</p>
            <p className={styles.emptySubtitle}>Tap + to add a canvas or kanban note</p>
          </div>
        ) : (
          notesInNotebook.map((note) => (
            <button
              key={note.id}
              className={styles.noteItem}
              onClick={() => handleSelectNote(note.id)}
            >
              <div className={styles.noteTypeIcon}>
                {note.contentType === 'kanban' ? (
                  <CheckSquare size={18} color="#8b5cf6" />
                ) : (
                  <LayoutGrid size={18} color="#0ea5e9" />
                )}
              </div>
              <div className={styles.noteItemInfo}>
                <span className={styles.noteItemTitle}>{note.title || 'Untitled Note'}</span>
                <span className={styles.noteItemMeta}>
                  {note.contentType === 'kanban' ? 'Kanban' : 'Canvas'} •{' '}
                  {formatDate(note.updatedAt)}
                </span>
              </div>
              <ArrowLeft size={16} className={styles.chevron} style={{ transform: 'rotate(180deg)' }} />
            </button>
          ))
        )}
      </div>

      {/* New note bottom sheet */}
      {sheetOpen && (
        <>
          <div className={styles.sheetOverlay} onClick={() => setSheetOpen(false)} />
          <div className={styles.bottomSheet}>
            <div className={styles.sheetHandle} />
            <p className={styles.sheetTitle}>New note type</p>
            <button
              className={styles.sheetOption}
              onClick={() => handleCreateNote('canvas')}
            >
              <LayoutGrid size={20} color="#0ea5e9" />
              <div>
                <span className={styles.sheetOptionTitle}>Canvas note</span>
                <span className={styles.sheetOptionSub}>Excalidraw freeform canvas</span>
              </div>
            </button>
            <button
              className={styles.sheetOption}
              onClick={() => handleCreateNote('kanban')}
            >
              <CheckSquare size={20} color="#8b5cf6" />
              <div>
                <span className={styles.sheetOptionTitle}>Kanban board</span>
                <span className={styles.sheetOptionSub}>Task columns with cards</span>
              </div>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
