// @vitest-environment jsdom
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import NotesLoading from '../loading';
import { NotesDesktop } from '@/src/client/screens/dashboard/notes/NotesDesktop';
import { NotesMobile } from '@/src/client/mobile/screens/Notes/NotesMobile';
import type { UseNotesResult } from '@/src/client/screens/dashboard/notes/hooks/useNotes';

// Mock next-auth safely
vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: { user: { id: 'test-user', name: 'Tester' } },
    status: 'authenticated',
  }),
}));

// Mock dynamic notes-board components
vi.mock('@undone/notes-board', () => ({
  NotesCanvas: () => <div data-testid="mock-notes-canvas">Canvas Board</div>,
  NotesKanban: () => <div data-testid="mock-notes-kanban">Kanban Board</div>,
}));

vi.mock('@/src/client/components/global/CommandPalette/CommandTrigger', () => ({
  useCommandContext: () => ({
    openCommand: vi.fn(),
    closeCommand: vi.fn(),
    toggleCommand: vi.fn(),
    isOpen: false,
  }),
}));

function createMockNotesModel(overrides?: Partial<UseNotesResult>): UseNotesResult {
  const notebook = {
    id: 'nb-1',
    title: 'General',
    description: '',
    color: '#4f46e5',
    icon: 'book',
    collapsed: false,
    favorite: false,
    shared: false,
    archived: false,
    order: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return {
    state: {
      notebooks: [notebook],
      notes: [],
      selectedNotebookId: 'nb-1',
      selectedNoteId: null,
      notebookSort: 'manual',
      noteSort: 'manual',
      filter: 'all',
    },
    data: {
      notebooks: [
        {
          ...notebook,
          visibleNotes: [],
          noteCount: 0,
        },
      ],
      notes: [],
      selectedNotebook: notebook,
      selectedNote: null,
    },
    notebookQuery: '',
    setNotebookQuery: vi.fn(),
    noteQuery: '',
    setNoteQuery: vi.fn(),
    toast: '',
    undo: vi.fn(),
    syncStatus: 'saved' as const,
    actions: {
      selectNotebook: vi.fn(),
      createNotebook: vi.fn(),
      patchNotebook: vi.fn(),
      duplicateNotebook: vi.fn(),
      deleteNotebook: vi.fn(),
      createNote: vi.fn(),
      patchNote: vi.fn(),
      duplicateNote: vi.fn(),
      deleteNote: vi.fn(),
      moveNotebook: vi.fn(),
      moveNote: vi.fn(),
      archiveNotebook: vi.fn(),
      archiveNote: vi.fn(),
      selectNote: vi.fn(),
      setNotebookSort: vi.fn(),
      setNoteSort: vi.fn(),
      setFilter: vi.fn(),
    },
    ...overrides,
  };
}

describe('Notes Route Loading Boundary (Issue 4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the real Notes page composition during loading instead of an obsolete skeleton layout', () => {
    const { container } = render(<NotesLoading />);

    // Must render the actual notes workspace main shell
    expect(container.querySelector('main')).toBeTruthy();

    // Must NOT contain any obsolete NotesSkeleton elements
    expect(container.querySelector('[class*="notesSkeletonShell"]')).toBeNull();
    expect(container.querySelector('[class*="notesSidebarSkeleton"]')).toBeNull();
    expect(container.querySelector('[class*="notesListSkeleton"]')).toBeNull();
    expect(container.querySelector('[class*="notesCanvasSkeleton"]')).toBeNull();

    // Must NOT contain any shimmer animations
    expect(container.querySelectorAll('[class*="shimmer"]').length).toBe(0);
  });

  it('renders real desktop Notes workspace without skeleton unmounting when model is mounted', () => {
    const mockModel = createMockNotesModel();
    const { container } = render(<NotesDesktop model={mockModel} />);

    // Desktop workspace and sidebar must be present
    expect(container.querySelector('main')).toBeTruthy();
    expect(screen.getAllByText('General').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Select a note to view canvas')).toBeDefined();

    // Zero skeleton containers or shimmer elements
    expect(container.querySelectorAll('[class*="skeleton"]').length).toBe(0);
    expect(container.querySelectorAll('[class*="shimmer"]').length).toBe(0);
  });

  it('renders real mobile Notes shell without skeleton unmounting', () => {
    const mockModel = createMockNotesModel();
    const { container } = render(<NotesMobile model={mockModel} />);

    // Mobile screen must be present
    expect(screen.getByRole('heading', { name: 'Notes' })).toBeDefined();
    expect(screen.getByPlaceholderText('Filter notebooks…')).toBeDefined();

    // Zero skeleton containers or shimmer elements
    expect(container.querySelectorAll('[class*="skeleton"]').length).toBe(0);
    expect(container.querySelectorAll('[class*="shimmer"]').length).toBe(0);
  });
});
