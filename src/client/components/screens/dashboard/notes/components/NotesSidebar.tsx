/* eslint-disable @typescript-eslint/no-explicit-any */
import { Archive, Search, Share, Star } from 'lucide-react';
import { Empty, Notebook, Section, SidebarNavHeader } from './NotesComponents';
import styles from '../Notes.module.css';
import type { useNotes } from '../hooks/useNotes';
import type { useNotesNavigation } from '../hooks/useNotesNavigation';

type NotesContextType = ReturnType<typeof useNotes>;
type NavigationType = ReturnType<typeof useNotesNavigation>;

interface NotesSidebarProps {
  notes: NotesContextType;
  navigation: NavigationType;
  isMobile: boolean;
  selectedNoteId: string | null;
  menu: string | null;
  setMenu: (m: string | null) => void;
  editingNotebookId: string | null;
  setEditingNotebookId: (id: string | null) => void;
  editingNoteId: string | null;
  setEditingNoteId: (id: string | null) => void;
}

export function NotesSidebar({
  notes,
  navigation,
  isMobile,
  selectedNoteId,
  menu,
  setMenu,
  editingNotebookId,
  setEditingNotebookId,
  editingNoteId,
  setEditingNoteId,
}: NotesSidebarProps) {
  const {
    mobileView,
    sidebarTab,
    setSidebarTab,
    allCollapsed,
    isPanelOpen,
    setIsPanelOpen,
    searchInputRef,
    toggleExpandCollapseAll,
    displayedNotebooks,
    counts,
  } = navigation;

  return (
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
            displayedNotebooks.map((book: any) => (
              <Notebook
                key={book.id}
                book={book}
                active={selectedNoteId ?? undefined}
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
  );
}
