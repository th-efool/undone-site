/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable react-hooks/preserve-manual-memoization */
/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useRef, useEffect, useMemo } from 'react';
import { useNotes } from './useNotes';

type NotesContextType = ReturnType<typeof useNotes>;

export function useNotesNavigation(
  notes: NotesContextType,
  isMobile: boolean
) {
  const [mobileView, setMobileView] = useState<'panel' | 'workspace'>('panel');
  const [sidebarTab, setSidebarTab] = useState<'explorer' | 'search' | 'bookmarks'>('explorer');
  const [allCollapsed, setAllCollapsed] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isMobile && notes.data?.selectedNote) {
      setMobileView('workspace');
    }
  }, [isMobile, notes.data?.selectedNote]);

  useEffect(() => {
    if (sidebarTab === 'search') {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [sidebarTab]);

  const toggleExpandCollapseAll = () => {
    const nextCollapsed = !allCollapsed;
    setAllCollapsed(nextCollapsed);
    if (notes.state?.notebooks) {
      notes.state.notebooks.forEach((book) => {
        notes.actions.patchNotebook(book.id, { collapsed: nextCollapsed });
      });
    }
  };

  const displayedNotebooks = useMemo(() => {
    if (!notes.data?.notebooks) return [];
    if (sidebarTab === 'bookmarks') {
      return notes.data.notebooks
        .filter((book) => book.favorite || book.visibleNotes.some((n) => n.favorite))
        .map((book) => ({
          ...book,
          visibleNotes: book.visibleNotes.filter((n) => n.favorite),
        }));
    }
    return notes.data.notebooks;
  }, [notes.data?.notebooks, sidebarTab]);

  const counts = useMemo(() => {
    if (!notes.state) return { favorites: 0, shared: 0, archive: 0 };
    return {
      favorites:
        notes.state.notebooks.filter((n) => n.favorite && !n.archived).length +
        notes.state.notes.filter((n) => n.favorite && !n.archived).length,
      shared:
        notes.state.notebooks.filter((n) => n.shared && !n.archived).length +
        notes.state.notes.filter((n) => n.shared && !n.archived).length,
      archive:
        notes.state.notebooks.filter((n) => n.archived).length +
        notes.state.notes.filter((n) => n.archived).length,
    };
  }, [notes.state?.notebooks, notes.state?.notes]);

  return {
    mobileView,
    setMobileView,
    sidebarTab,
    setSidebarTab,
    allCollapsed,
    isPanelOpen,
    setIsPanelOpen,
    searchInputRef,
    toggleExpandCollapseAll,
    displayedNotebooks,
    counts,
  };
}
