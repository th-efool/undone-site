import { useEffect } from 'react';
import type { useNotes } from './useNotes';
import type { NoteDocument } from '../models/notes.models';

type NotesContextType = ReturnType<typeof useNotes>;

export function useNotesKeyboardShortcuts({
  notes,
  selected,
  setIsPanelOpen,
  setSidebarTab,
  setShareOpen,
}: {
  notes: NotesContextType;
  selected: NoteDocument | null;
  setIsPanelOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setSidebarTab: React.Dispatch<React.SetStateAction<'explorer' | 'search' | 'bookmarks'>>;
  setShareOpen: React.Dispatch<React.SetStateAction<boolean>>;
}) {
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
      
      if (e.key === 'n' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        notes.actions.createNote();
      } else if (e.key === 'N' && e.shiftKey && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        notes.actions.createNotebook();
      } else if (e.key === '[' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setIsPanelOpen(prev => !prev);
      } else if (e.key === 'E' && e.shiftKey && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setSidebarTab('explorer');
      } else if (e.key === 's' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setSidebarTab('search');
      } else if (e.key === 'B' && e.shiftKey && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setSidebarTab('bookmarks');
      } else if (e.key === 'o' && !e.metaKey && !e.ctrlKey && selected) {
        e.preventDefault();
        setShareOpen(true);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [notes.actions, selected, setIsPanelOpen, setSidebarTab, setShareOpen]);
}
