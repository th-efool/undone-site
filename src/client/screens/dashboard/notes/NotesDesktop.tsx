'use client';

import { useCallback, useState, useEffect } from 'react';
import { canvasRepository } from './repositories/canvas.repository';
import type { UseNotesResult } from './hooks/useNotes';
import { useNotesNavigation } from './hooks/useNotesNavigation';
import { useNotesKeyboardShortcuts } from './hooks/useNotesKeyboardShortcuts';
import { ShareModal } from './components/NotesComponents';
import { NotesSidebar } from './components/NotesSidebar';
import { NotesWorkspace } from './components/NotesWorkspace';
import { useCanvasScene } from './hooks/useCanvasScene';
import { useCanvasPersistence } from './hooks/useCanvasPersistence';

import styles from './Notes.module.css';

interface NotesDesktopProps {
  model: UseNotesResult;
}

export function NotesDesktop({ model: notes }: NotesDesktopProps) {
  const navigation = useNotesNavigation(notes, false);

  useEffect(() => {
    const activeId = notes.userId || 'local-user';
    canvasRepository.setActiveUserId(activeId);
    if (typeof window !== 'undefined') {
      (window as any).__UNDONE_ACTIVE_USER_ID__ = activeId;
    }
  }, [notes.userId]);
  const [menu, setMenu] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [canvasSwitcherOpen, setCanvasSwitcherOpen] = useState(false);

  const selected = notes.data?.selectedNote ?? null;

  useNotesKeyboardShortcuts({
    notes,
    selected,
    setIsNavigationExpanded: navigation.setIsNavigationExpanded,
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

  const handleSaveNote = useCallback(() => {
    if (selected) notes.actions.patchNote(selected.id, {});
  }, [selected, notes.actions]);

  useCanvasPersistence(
    selected?.id ?? null,
    sceneRef,
    isDirtyRef,
    setCanvasState,
    saveTrigger,
    handleSaveNote
  );

  return (
    <main
      className={styles.notes}
      onClick={() => {
        setMenu(null);
        setCanvasSwitcherOpen(false);
      }}
    >
      <NotesSidebar 
        notes={notes}
        isNavigationExpanded={navigation.isNavigationExpanded}
        setIsNavigationExpanded={navigation.setIsNavigationExpanded}
        isWorkspaceExpanded={navigation.isWorkspaceExpanded}
        setIsWorkspaceExpanded={navigation.setIsWorkspaceExpanded}
      />
      
      <NotesWorkspace
        notes={notes}
        navigation={navigation}
        isMobile={false}
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
