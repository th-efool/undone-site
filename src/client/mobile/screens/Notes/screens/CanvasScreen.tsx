'use client';

import { useCallback, useState } from 'react';
import { ArrowLeft, MoreHorizontal } from 'lucide-react';
import type { UseNotesResult } from '@/src/client/screens/dashboard/notes/hooks/useNotes';
import { useCanvasScene } from '@/src/client/screens/dashboard/notes/hooks/useCanvasScene';
import { useCanvasPersistence } from '@/src/client/screens/dashboard/notes/hooks/useCanvasPersistence';
import { NotesCanvas } from '@/src/client/screens/dashboard/notes/components/NotesCanvas/NotesCanvas';
import { NotesKanban } from '@/src/client/screens/dashboard/notes/components/NotesKanban/NotesKanban';
import { NotesSaveStatus } from '@/src/client/screens/dashboard/notes/components/NotesSaveStatus/NotesSaveStatus';
import type { NoteDocument } from '@/src/client/screens/dashboard/notes/models/notes.models';
import styles from '../NotesMobile.module.css';

interface CanvasScreenProps {
  notes: UseNotesResult;
  selected: NoteDocument;
  onBack: () => void;
}

export function CanvasScreen({ notes, selected, onBack }: CanvasScreenProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(selected.title);

  const {
    initialScene,
    loading: canvasLoading,
    canvasState,
    setCanvasState,
    handleSceneChange,
    sceneRef,
    isDirtyRef,
    saveTrigger,
  } = useCanvasScene(selected.contentType === 'canvas' ? selected.id : null);

  const handleSaveNote = useCallback(() => {
    notes.actions.patchNote(selected.id, {});
  }, [selected.id, notes.actions]);

  useCanvasPersistence(
    selected.contentType === 'canvas' ? selected.id : null,
    sceneRef,
    isDirtyRef,
    setCanvasState,
    saveTrigger,
    handleSaveNote,
  );

  const handleTitleBlur = () => {
    setEditingTitle(false);
    if (titleValue.trim() && titleValue !== selected.title) {
      notes.actions.patchNote(selected.id, { title: titleValue.trim() });
    }
  };

  const handleMoreAction = (action: 'duplicate' | 'archive' | 'delete') => {
    setMoreOpen(false);
    if (action === 'duplicate') notes.actions.duplicateNote(selected.id);
    if (action === 'archive') notes.actions.archiveNote(selected.id);
    if (action === 'delete') {
      notes.actions.deleteNote(selected.id);
      onBack();
    }
  };

  return (
    <div className={styles.screen}>
      {/* Top bar */}
      <header className={styles.canvasHeader}>
        <button className={styles.backBtn} onClick={onBack} aria-label="Back to workspace">
          <ArrowLeft size={18} />
        </button>

        <div className={styles.canvasTitleWrap} onClick={() => setEditingTitle(true)}>
          {editingTitle ? (
            <input
              autoFocus
              className={styles.canvasTitleInput}
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
              onBlur={handleTitleBlur}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur();
                if (e.key === 'Escape') {
                  setTitleValue(selected.title);
                  setEditingTitle(false);
                }
              }}
            />
          ) : (
            <span className={styles.canvasTitle}>{selected.title || 'Untitled Note'}</span>
          )}
          {selected.contentType === 'canvas' && (
            <NotesSaveStatus state={canvasState} />
          )}
        </div>

        <button
          className={styles.moreBtn}
          onClick={() => setMoreOpen((o) => !o)}
          aria-label="More options"
        >
          <MoreHorizontal size={20} />
        </button>
      </header>

      {/* Canvas / Kanban area */}
      <div className={styles.canvasArea}>
        {selected.contentType === 'kanban' ? (
          <NotesKanban key={selected.id} noteId={selected.id} notes={notes} />
        ) : canvasLoading ? (
          <div className={styles.canvasLoading}>Loading canvas…</div>
        ) : (
          <NotesCanvas
            key={selected.id}
            noteId={selected.id}
            initialScene={initialScene}
            onSceneChange={handleSceneChange}
          />
        )}
      </div>

      {/* More menu bottom sheet */}
      {moreOpen && (
        <>
          <div className={styles.sheetOverlay} onClick={() => setMoreOpen(false)} />
          <div className={styles.bottomSheet}>
            <div className={styles.sheetHandle} />
            <button className={styles.sheetOption} onClick={() => handleMoreAction('duplicate')}>
              <span className={styles.sheetOptionTitle}>Duplicate note</span>
            </button>
            <button className={styles.sheetOption} onClick={() => handleMoreAction('archive')}>
              <span className={styles.sheetOptionTitle}>
                {selected.archived ? 'Restore note' : 'Archive note'}
              </span>
            </button>
            <button
              className={`${styles.sheetOption} ${styles.sheetOptionDanger}`}
              onClick={() => handleMoreAction('delete')}
            >
              <span className={styles.sheetOptionTitle}>Delete note</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
