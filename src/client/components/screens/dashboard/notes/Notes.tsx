'use client';

import { useEffect, useState } from 'react';
import { useIsMobile } from '@/src/client/hooks/useIsMobile';
import { useNotes } from './hooks/useNotes';
import { useNotesNavigation } from './hooks/useNotesNavigation';
import { useNotesKeyboardShortcuts } from './hooks/useNotesKeyboardShortcuts';
import { ShareModal } from './components/NotesComponents';
import { NotesSidebar } from './components/NotesSidebar';
import { NotesOverview } from './components/NotesOverview';
import { NotesWorkspace } from './components/NotesWorkspace';
import { useCanvasScene } from './hooks/useCanvasScene';
import { useCanvasPersistence } from './hooks/useCanvasPersistence';
import styles from './Notes.module.css';

export function Notes() {
  const notes = useNotes();
  const isMobile = useIsMobile();
  const navigation = useNotesNavigation(notes, isMobile);
  
  const [menu, setMenu] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [canvasSwitcherOpen, setCanvasSwitcherOpen] = useState(false);

  const selected = notes.data?.selectedNote ?? null;

  useNotesKeyboardShortcuts({
    notes,
    selected,
    setIsPanelOpen: navigation.setIsPanelOpen,
    setSidebarTab: navigation.setSidebarTab,
    setShareOpen,
  });

  const {
    initialScene,
    loading: canvasLoading,
    canvasState,
    setCanvasState,
    handleSceneChange,
    sceneRef,
    isDirtyRef,
    saveTrigger,
  } = useCanvasScene(selected?.id ?? null);

  useCanvasPersistence(
    selected?.id ?? null,
    sceneRef,
    isDirtyRef,
    setCanvasState,
    saveTrigger,
    () => {
      if (selected) notes.actions.patchNote(selected.id, {});
    }
  );

  useEffect(() => {
    // Reset any state bound to the old note when note changes
  }, [selected?.id]);

  if (!notes.state || !notes.data) return <main className={styles.loading}>Loading notes…</main>;

  return (
    <main
      className={`${styles.notes} ${!navigation.isPanelOpen ? styles.notesPanelClosed : ''}`}
      onClick={() => {
        setMenu(null);
        setCanvasSwitcherOpen(false);
      }}
    >
      <NotesSidebar />
      
      <NotesWorkspace
        notes={notes}
        navigation={navigation}
        isMobile={isMobile}
        selected={selected}
        menu={menu}
        setMenu={setMenu}
        shareOpen={shareOpen}
        setShareOpen={setShareOpen}
        canvasSwitcherOpen={canvasSwitcherOpen}
        setCanvasSwitcherOpen={setCanvasSwitcherOpen}
        canvasLoading={canvasLoading}
        canvasState={canvasState}
        initialScene={initialScene}
        handleSceneChange={handleSceneChange}
      />

      {shareOpen && selected && (
        <ShareModal
          note={selected}
          onClose={() => setShareOpen(false)}
          onSave={(patch) => notes.actions.patchNote(selected.id, patch)}
        />
      )}
      {notes.toast && (
        <div className={styles.toast}>
          {notes.toast}
          <button onClick={notes.undo}>Undo</button>
        </div>
      )}
    </main>
  );
}
