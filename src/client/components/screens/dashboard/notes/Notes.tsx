'use client';

import {
  ArrowLeft,
  Archive,
  Filter,
  Folder,
  MoreHorizontal,
  Plus,
  Search,
  Share,
  SortAsc,
  Star,
  PanelLeftClose,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from '@/src/client/hooks/useToast';
import { useIsMobile } from '@/src/client/hooks/useIsMobile';
import { useNotes } from './hooks/useNotes';
import type { NotesFilter, NotesSort } from './models/notes.models';
import { Tooltip } from '@/src/client/components/ui/Tooltip';
import {
  CanvasSwitcher,
  Empty,
  IconButton,
  Menu,
  Notebook,
  Section,
  ShareModal,
  SidebarNavHeader,
} from './components/NotesComponents';
import { NotesCanvas } from './components/NotesCanvas/NotesCanvas';
import { NotesSaveStatus } from './components/NotesSaveStatus/NotesSaveStatus';
import { useCanvasScene } from './hooks/useCanvasScene';
import { useCanvasPersistence } from './hooks/useCanvasPersistence';
import { canvasAdapter, CANVAS_SCHEMA_VERSION } from './adapters/canvas.adapter';
import { canvasRepository } from './repositories/canvas.repository';
import styles from './Notes.module.css';

const sorts: [NotesSort, string][] = [
  ['manual', 'Manual order'],
  ['alphabetical', 'Alphabetical'],
  ['recentlyEdited', 'Recently edited'],
  ['recentlyCreated', 'Recently created'],
  ['oldestFirst', 'Oldest first'],
  ['newestFirst', 'Newest first'],
];
const filters: [NotesFilter, string][] = [
  ['all', 'All notes'],
  ['favorites', 'Favorites'],
  ['recent', 'Recently edited'],
  ['shared', 'Shared'],
  ['archived', 'Archived'],
];

export function Notes() {
  const notes = useNotes();
  const isMobile = useIsMobile();
  const [mobileView, setMobileView] = useState<'panel' | 'workspace'>('panel');
  const [menu, setMenu] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [canvasSwitcherOpen, setCanvasSwitcherOpen] = useState(false);
  const [editingNotebookId, setEditingNotebookId] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [sidebarTab, setSidebarTab] = useState<'explorer' | 'search' | 'bookmarks'>('explorer');
  const [allCollapsed, setAllCollapsed] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const toggleExpandCollapseAll = () => {
    const nextCollapsed = !allCollapsed;
    setAllCollapsed(nextCollapsed);
    if (notes.state?.notebooks) {
      notes.state.notebooks.forEach((book) => {
        notes.actions.patchNotebook(book.id, { collapsed: nextCollapsed });
      });
    }
  };

  const selected = notes.data?.selectedNote ?? null;

  const {
    initialScene,
    setInitialScene,
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

  const toast = useToast();

  if (!notes.state || !notes.data) return <main className={styles.loading}>Loading notes…</main>;

  const counts = {
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

  return (
    <main
      className={`${styles.notes} ${!isPanelOpen ? styles.notesPanelClosed : ''}`}
      onClick={() => {
        setMenu(null);
        setCanvasSwitcherOpen(false);
      }}
    >
      <aside className={`${styles.panel} ${isMobile && mobileView !== 'panel' ? styles.panelHidden : ''}`}>
        <SidebarNavHeader
          activeTab={sidebarTab}
          onTabChange={setSidebarTab}
          allCollapsed={allCollapsed}
          onToggleExpandCollapseAll={toggleExpandCollapseAll}
          onCreateNotebook={notes.actions.createNotebook}
          onCreateNote={() => notes.actions.createNote()}
          onToggleSidebar={() => setIsPanelOpen(!isPanelOpen)}
        />
        <label
          className={`${styles.search} ${
            sidebarTab !== 'search' && !notes.notebookQuery ? styles.searchHidden : ''
          }`}
        >
          <Search size={18} />
          <input
            ref={searchInputRef}
            value={notes.notebookQuery}
            onChange={(e) => notes.setNotebookQuery(e.target.value)}
            placeholder="Search notebooks..."
          />
          <span>⌘K</span>
        </label>
        <Section title={sidebarTab === 'bookmarks' ? 'Bookmarks' : 'Notebooks'}>
          <div className={styles.bookList}>
            {displayedNotebooks.length ? (
              displayedNotebooks.map((book) => (
                <Notebook
                  key={book.id}
                  book={book}
                  active={selected?.id}
                  selectedBookId={notes.state!.selectedNotebookId}
                  actions={notes.actions}
                  setMenu={setMenu}
                  menu={menu}
                  editingNotebookId={editingNotebookId}
                  setEditingNotebookId={setEditingNotebookId}
                  editingNoteId={editingNoteId}
                  setEditingNoteId={setEditingNoteId}
                />
              ))
            ) : (
              <Empty
                label={sidebarTab === 'bookmarks' ? 'No bookmarks found' : 'No matching notes'}
                action={sidebarTab === 'bookmarks' ? 'View Explorer' : 'Clear filter'}
                onClick={() => {
                  if (sidebarTab === 'bookmarks') {
                    setSidebarTab('explorer');
                  } else {
                    notes.actions.setFilter('all');
                  }
                }}
              />
            )}
          </div>
        </Section>
        <nav className={styles.nav}>
          <button onClick={() => notes.actions.setFilter('favorites')}>
            <Star size={16} fill="#fbbf24" />
            Favorites<span>{counts.favorites}</span>
          </button>
          <button onClick={() => notes.actions.setFilter('shared')}>
            <Share size={16} />
            Shared with me<span>{counts.shared}</span>
          </button>
          <button onClick={() => notes.actions.setFilter('archived')}>
            <Archive size={16} />
            Archive<span>{counts.archive}</span>
          </button>
        </nav>
      </aside>
      <section className={`${styles.workspace} ${isMobile && mobileView !== 'workspace' ? styles.workspaceHidden : ''}`}>
        <header className={styles.topbar}>
          {isMobile && (
            <button
              className={styles.mobileBackBtn}
              onClick={() => setMobileView('panel')}
            >
              <ArrowLeft size={16} /> Back
            </button>
          )}
          {!isMobile && !isPanelOpen && (
            <button
              className={styles.mobileBackBtn}
              onClick={() => setIsPanelOpen(true)}
              aria-label="Open sidebar"
              title="Open sidebar"
              style={{ padding: '6px', marginRight: '4px' }}
            >
              <PanelLeftClose size={16} style={{ transform: 'scaleX(-1)' }} />
            </button>
          )}
          <div className={styles.crumb}>
            <strong>{notes.data.selectedNotebook?.title ?? 'Notebook'}</strong>
            <span className={styles.crumbSeparator}>/</span>
            <CanvasSwitcher
              open={canvasSwitcherOpen}
              onToggle={(event) => {
                event.stopPropagation();
                setCanvasSwitcherOpen((open) => !open);
              }}
              onClose={() => setCanvasSwitcherOpen(false)}
              notes={
                notes.data.selectedNotebook
                  ? notes.state.notes.filter(
                      (note) =>
                        note.notebookId === notes.data!.selectedNotebook!.id && !note.archived,
                    )
                  : []
              }
              selectedId={selected?.id ?? null}
              onSelect={(id) => {
                notes.actions.selectNote(id);
                setCanvasSwitcherOpen(false);
              }}
              title={selected?.title}
              onTitleChange={(newTitle) => {
                if (selected) {
                  notes.actions.patchNote(selected.id, { title: newTitle });
                }
              }}
            />
            {selected && <NotesSaveStatus state={canvasState} />}
          </div>
          <div className={styles.actions}>
            <button className={styles.topbarBtn} onClick={() => setShareOpen(true)}>
              <Share size={15} />
              <span>Share</span>
            </button>
            <Tooltip content="More options">
              <button
                className={styles.moreBtn}
                aria-label="More options"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenu('more');
                }}
              >
                <MoreHorizontal size={17} />
              </button>
            </Tooltip>
            {menu === 'more' && (
              <Menu>
                <button onClick={() => selected && notes.actions.duplicateNote(selected.id)}>
                  Duplicate note
                </button>
                <button onClick={() => selected && notes.actions.archiveNote(selected.id)}>
                  {selected?.archived ? 'Restore note' : 'Archive note'}
                </button>
                <button onClick={() => selected && notes.actions.deleteNote(selected.id)}>
                  Delete note
                </button>
              </Menu>
            )}
          </div>
        </header>
        
        <article className={styles.canvas}>
          {!selected ? (
            <Empty
              label={notes.data.selectedNotebook ? 'No notes in this notebook' : 'No notebook selected'}
              action="New note"
              onClick={() => notes.actions.createNote()}
            />
          ) : canvasLoading ? (
            <div className={styles.loadingScene}>Loading canvas...</div>
          ) : (
            <NotesCanvas
              key={selected.id}
              noteId={selected.id}
              initialScene={initialScene}
              onSceneChange={handleSceneChange}
            />
          )}
        </article>
      </section>
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
