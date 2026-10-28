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
  const [mobileView, setMobileView] = useState<'notebooks' | 'workspace' | 'canvas'>('notebooks');
  const [sidebarTab, setSidebarTab] = useState<'explorer' | 'search' | 'bookmarks'>('explorer');
  const [allCollapsed, setAllCollapsed] = useState(false);
  const [isNavigationExpanded, setIsNavigationExpanded] = useState(true);
  const [isWorkspaceExpanded, setIsWorkspaceExpanded] = useState(true);
  const [isNavLocked, setIsNavLocked] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      try {
        return localStorage.getItem('undone_notes_nav_locked') === 'true';
      } catch {
        return false;
      }
    }
    return false;
  });

  const toggleNavLocked = () => {
    setIsNavLocked((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('undone_notes_nav_locked', String(next));
        } catch {
          // ignore
        }
      }
      return next;
    });
  };
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isMobile && notes.data?.selectedNote) {
      setMobileView('canvas');
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
    const notebooks = notes.state.notebooks || [];
    const stateNotes = notes.state.notes || [];
    return {
      favorites:
        notebooks.filter((n) => n.favorite && !n.archived).length +
        stateNotes.filter((n) => n.favorite && !n.archived).length,
      shared:
        notebooks.filter((n) => n.shared && !n.archived).length +
        stateNotes.filter((n) => n.shared && !n.archived).length,
      archive:
        notebooks.filter((n) => n.archived).length +
        stateNotes.filter((n) => n.archived).length,
    };
  }, [notes.state?.notebooks, notes.state?.notes]);

  return {
    mobileView,
    setMobileView,
    sidebarTab,
    setSidebarTab,
    allCollapsed,
    isNavigationExpanded,
    setIsNavigationExpanded,
    isWorkspaceExpanded,
    setIsWorkspaceExpanded,
    isNavLocked,
    setIsNavLocked,
    toggleNavLocked,
    searchInputRef,
    toggleExpandCollapseAll,
    displayedNotebooks,
    counts,
  };
}
