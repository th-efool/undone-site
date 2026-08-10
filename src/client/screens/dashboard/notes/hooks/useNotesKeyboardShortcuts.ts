import { useEffect, useRef } from 'react';
import type { useNotes } from './useNotes';
import type { NoteDocument } from '../models/notes.models';

type NotesContextType = ReturnType<typeof useNotes>;

export function useNotesKeyboardShortcuts({
  notes,
  selected,
  setIsNavigationExpanded,
  setSidebarTab,
  setShareOpen,
}: {
  notes: NotesContextType;
  selected: NoteDocument | null;
  setIsNavigationExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  setSidebarTab: React.Dispatch<React.SetStateAction<'explorer' | 'search' | 'bookmarks'>>;
  setShareOpen: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const latestRef = useRef({ notes, selected, setIsNavigationExpanded, setSidebarTab, setShareOpen });
  useEffect(() => {
    latestRef.current = { notes, selected, setIsNavigationExpanded, setSidebarTab, setShareOpen };
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input, textarea, or contenteditable
      if (
        e.target instanceof HTMLInputElement || 
        e.target instanceof HTMLTextAreaElement || 
        e.target instanceof HTMLSelectElement ||
        (e.target as HTMLElement).isContentEditable
      ) {
        return;
      }
      
      const current = latestRef.current;
      
      if (e.key === 'n' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        current.notes.actions.createNote();
      } else if (e.key === 'N' && e.shiftKey && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        current.notes.actions.createNotebook();
      } else if (e.key === '[' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        current.setIsNavigationExpanded(prev => !prev);
      } else if (e.key === 'E' && e.shiftKey && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        current.setSidebarTab('explorer');
      } else if (e.key === 's' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        current.setSidebarTab('search');
      } else if (e.key === 'B' && e.shiftKey && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        current.setSidebarTab('bookmarks');
      } else if (e.key === 'o' && !e.metaKey && !e.ctrlKey && current.selected) {
        e.preventDefault();
        current.setShareOpen(true);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}
