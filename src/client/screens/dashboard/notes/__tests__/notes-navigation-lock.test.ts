// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNotesNavigation } from '../hooks/useNotesNavigation';

describe('useNotesNavigation lock & auto-collapse', () => {
  const fakeNotes: any = {
    data: {
      notebooks: [],
      selectedNotebook: { id: 'nb-1', title: 'Default' },
    },
    state: {
      notebooks: [],
      notes: [],
      selectedNotebookId: 'nb-1',
    },
    actions: {
      selectNotebook: vi.fn(),
    },
  };

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('initializes isNavLocked as false by default when localStorage is empty', () => {
    const { result } = renderHook(() => useNotesNavigation(fakeNotes, false));
    expect(result.current.isNavLocked).toBe(false);
    expect(result.current.isNavigationExpanded).toBe(true);
  });

  it('initializes isNavLocked as true when localStorage has true', () => {
    localStorage.setItem('undone_notes_nav_locked', 'true');
    const { result } = renderHook(() => useNotesNavigation(fakeNotes, false));
    expect(result.current.isNavLocked).toBe(true);
  });

  it('toggles isNavLocked and updates localStorage correctly', () => {
    const { result } = renderHook(() => useNotesNavigation(fakeNotes, false));
    expect(result.current.isNavLocked).toBe(false);

    act(() => {
      result.current.toggleNavLocked();
    });

    expect(result.current.isNavLocked).toBe(true);
    expect(localStorage.getItem('undone_notes_nav_locked')).toBe('true');

    act(() => {
      result.current.toggleNavLocked();
    });

    expect(result.current.isNavLocked).toBe(false);
    expect(localStorage.getItem('undone_notes_nav_locked')).toBe('false');
  });

  it('simulates note selection auto-collapsing navigation only when unlocked', () => {
    const { result } = renderHook(() => useNotesNavigation(fakeNotes, false));
    
    // Handler pattern used in NotesSidebar
    const handleSelectNote = (id: string) => {
      fakeNotes.actions.selectNotebook(id);
      if (!result.current.isNavLocked) {
        result.current.setIsNavigationExpanded(false);
      }
    };

    // When unlocked:
    expect(result.current.isNavLocked).toBe(false);
    expect(result.current.isNavigationExpanded).toBe(true);

    act(() => {
      handleSelectNote('note-123');
    });

    expect(result.current.isNavigationExpanded).toBe(false);

    // Reopen navigation and lock it
    act(() => {
      result.current.setIsNavigationExpanded(true);
      result.current.toggleNavLocked();
    });

    expect(result.current.isNavLocked).toBe(true);
    expect(result.current.isNavigationExpanded).toBe(true);

    // When locked:
    act(() => {
      handleSelectNote('note-456');
    });

    // Navigation must remain expanded!
    expect(result.current.isNavigationExpanded).toBe(true);
  });
});
