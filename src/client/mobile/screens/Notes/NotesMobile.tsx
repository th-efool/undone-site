'use client';

import type { UseNotesResult } from '@/src/client/screens/dashboard/notes/hooks/useNotes';
import styles from './NotesMobile.module.css';

interface NotesMobileProps {
  model: UseNotesResult;
}

export function NotesMobile({ model: notes }: NotesMobileProps) {
  if (!notes.state || !notes.data) {
    return <div className={styles.loading}>Loading notes…</div>;
  }

  const selectedId = notes.data.selectedNote?.id;

  return (
    <main className={styles.mobileNotes}>
      <header className={styles.mobileHeader}>
        <h1 className={styles.title}>Notes</h1>
        <button
          className={styles.actionBtn}
          onClick={() => notes.actions.createNote()}
        >
          + New Note
        </button>
      </header>

      <div className={styles.notesList}>
        {notes.data.notes.map((note) => (
          <div
            key={note.id}
            className={`${styles.noteItem} ${note.id === selectedId ? styles.noteItemActive : ''}`}
            onClick={() => notes.actions.selectNote(note.id)}
          >
            <span className={styles.noteTitle}>{note.title || 'Untitled Note'}</span>
            <span className={styles.notePreview}>{note.contentType} • Updated {new Date(note.updatedAt).toLocaleDateString()}</span>
          </div>
        ))}
      </div>
    </main>
  );
}
