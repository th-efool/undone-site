import { useState, useEffect, useRef } from 'react';

export interface RecentlyClosedNote {
  id: string;
  title: string;
  closedAt: number;
  notebookId: string | null;
}

export function useRecentlyClosedNotes(currentNoteId: string | null, currentNoteTitle?: string, currentNotebookId?: string | null, maxItems: number = 3) {
  const [closedNotes, setClosedNotes] = useState<RecentlyClosedNote[]>([]);
  const prevNoteRef = useRef<{ id: string; title: string, notebookId: string | null } | null>(null);
  const isInitialMount = useRef(true);

  // Load from local storage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('recentlyClosedNotes');
      if (stored) {
        setClosedNotes(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to parse recentlyClosedNotes', e);
    }
  }, []);

  // Save to local storage when changed (skip initial mount to avoid overwriting with empty before load)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    localStorage.setItem('recentlyClosedNotes', JSON.stringify(closedNotes));
  }, [closedNotes]);

  // Track closures
  useEffect(() => {
    if (currentNoteId) {
      // If the current note ID is different from the previous, we navigated away from the previous
      if (prevNoteRef.current && prevNoteRef.current.id !== currentNoteId) {
        const closedNote = prevNoteRef.current;
        setClosedNotes(prev => {
          const filtered = prev.filter(n => n.id !== closedNote.id);
          const updated = [{ ...closedNote, closedAt: Date.now() }, ...filtered];
          return updated.slice(0, maxItems);
        });
      }
      // Update ref to current note
      prevNoteRef.current = { id: currentNoteId, title: currentNoteTitle || 'Untitled Note', notebookId: currentNotebookId || null };
    } else {
      // Navigated to "no note selected"
      if (prevNoteRef.current) {
        const closedNote = prevNoteRef.current;
        setClosedNotes(prev => {
          const filtered = prev.filter(n => n.id !== closedNote.id);
          const updated = [{ ...closedNote, closedAt: Date.now() }, ...filtered];
          return updated.slice(0, maxItems);
        });
      }
      prevNoteRef.current = null;
    }
  }, [currentNoteId, currentNotebookId, maxItems]); 
  
  // Update the title in the ref when it changes, so we capture the latest title before closing
  useEffect(() => {
    if (currentNoteId && currentNoteTitle && prevNoteRef.current?.id === currentNoteId) {
      prevNoteRef.current.title = currentNoteTitle;
    }
  }, [currentNoteTitle, currentNoteId]);

  const removeClosedNote = (id: string) => {
    setClosedNotes(prev => prev.filter(n => n.id !== id));
  };

  const updateMaxItems = (newMax: number) => {
    setClosedNotes(prev => prev.slice(0, newMax));
  };

  return {
    closedNotes,
    removeClosedNote,
    updateMaxItems,
  };
}
