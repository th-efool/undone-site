import {
  Bookmark,
  BookOpen,
  Check,
  ChevronDown,
  ChevronsUpDown,
  Folder,
  FolderPlus,
  PanelLeftClose,
  Search,
  SortAsc,
  SquarePen,
  Star,
} from 'lucide-react';
import { MouseEvent, ReactNode, useState } from 'react';

import { useNotes } from '../hooks/useNotes';
import type { NoteDocument, NotebookListItem, Permission } from '../models/notes.models';
import { Tooltip } from '@/src/client/components/ui/Tooltip';

import styles from '../Notes.module.css';

export interface CanvasSwitcherProps {
  open: boolean;
  onToggle: (event: MouseEvent) => void;
  onClose: () => void;
  notes: NoteDocument[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  title?: string;
  onTitleChange?: (title: string) => void;
  notebookTitle?: string;
  disabled?: boolean;
}

export function CanvasSwitcher({
  open,
  onToggle,
  onClose,
  notes,
  selectedId,
  onSelect,
  title,
  onTitleChange,
  disabled = false,
}: CanvasSwitcherProps) {
  const selectedIndex = Math.max(
    0,
    notes.findIndex((note) => note.id === selectedId),
  );
  const [focusIndex, setFocusIndex] = useState(selectedIndex);
  const selectedNote = notes.find((note) => note.id === selectedId);
  const displayTitle = title ?? selectedNote?.title ?? 'Select note';

  return (
    <div className={styles.canvasSwitcher}>
      <div className={styles.canvasSwitchControl}>
        {selectedId && onTitleChange ? (
          <input
            type="text"
            className={styles.titleInputTop}
            value={displayTitle}
            onChange={(e) => onTitleChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'Escape') {
                (e.target as HTMLInputElement).blur();
              }
            }}
            placeholder="Note title"
            onClick={(e) => e.stopPropagation()}
            aria-label="Edit note title"
          />
        ) : (
          <span className={styles.canvasSwitchTitle}>{displayTitle}</span>
        )}
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label="Switch note dropdown"
          disabled={disabled}
          className={styles.canvasSwitchButton}
          onClick={(event) => {
            event.stopPropagation();
            onToggle(event);
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setFocusIndex((index) => Math.min(notes.length - 1, index + 1));
            }
            if (event.key === 'ArrowUp') {
              event.preventDefault();
              setFocusIndex((index) => Math.max(0, index - 1));
            }
            if (event.key === 'Enter' && open && notes[focusIndex]) {
              event.preventDefault();
              onSelect(notes[focusIndex].id);
            }
            if (event.key === 'Escape') {
              event.preventDefault();
              onClose();
            }
          }}
        >
          <ChevronDown size={14} className={open ? styles.chevronOpen : styles.chevron} />
        </button>
      </div>

      {open && (
        <div
          className={styles.canvasMenu}
          role="listbox"
          tabIndex={-1}
          onClick={(event) => event.stopPropagation()}
        >
          {notes.length === 0 ? (
            <div className={styles.emptyCanvasItem}>No notes in notebook</div>
          ) : (
            notes.map((note, index) => {
              const isSelected = note.id === selectedId;
              const isFocused = index === focusIndex;
              return (
                <button
                  key={note.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={`${styles.canvasMenuItem} ${isSelected ? styles.selectedCanvas : ''} ${
                    isFocused ? styles.focusedCanvas : ''
                  }`}
                  onMouseEnter={() => setFocusIndex(index)}
                  onClick={() => onSelect(note.id)}
                >
                  <span className={styles.canvasMenuItemTitle}>
                    {note.title || 'Untitled Note'}
                  </span>
                  {isSelected && <Check size={14} className={styles.checkIcon} />}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

export interface SidebarNavHeaderProps {
  activeTab?: 'explorer' | 'search' | 'bookmarks';
  onTabChange?: (tab: 'explorer' | 'search' | 'bookmarks') => void;
  onToggleSidebar?: () => void;
  onNewNote?: () => void;
  onNewNotebook?: () => void;
  onToggleSort?: () => void;
  onToggleExpandAll?: () => void;
  allCollapsed?: boolean;
  onToggleExpandCollapseAll?: () => void;
  onCreateNotebook?: () => void;
  onCreateNote?: () => void;
}

export function SidebarNavHeader({
  activeTab = 'explorer',
  onTabChange,
  onToggleSidebar,
  onNewNote,
  onNewNotebook,
  onToggleSort,
  onToggleExpandAll,
  allCollapsed,
  onToggleExpandCollapseAll,
  onCreateNotebook,
  onCreateNote,
}: SidebarNavHeaderProps) {
  const handleToggleExpand = onToggleExpandCollapseAll || onToggleExpandAll;
  const handleCreateNote = onCreateNote || onNewNote;
  const handleCreateNotebook = onCreateNotebook || onNewNotebook;

  return (
    <div className={styles.sidebarNavHeader}>
      {/* Row 1: Mini-Tabs */}
      <div className={styles.navHeaderRow}>
        <div className={styles.miniTabsGroup} role="tablist" aria-label="Sidebar Navigation">
          <Tooltip content={<>Explorer <kbd className={styles.kbd}>â‡§E</kbd></>} placement="top">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'explorer'}
              aria-label="Explorer"
              className={`${styles.miniTabBtn} ${activeTab === 'explorer' ? styles.miniTabBtnActive : ''}`}
              onClick={() => onTabChange?.('explorer')}
            >
              <Folder size={16} />
            </button>
          </Tooltip>

          <Tooltip content={<>Search <kbd className={styles.kbd}>S</kbd></>} placement="top">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'search'}
              aria-label="Search"
              className={`${styles.miniTabBtn} ${activeTab === 'search' ? styles.miniTabBtnActive : ''}`}
              onClick={() => onTabChange?.('search')}
            >
              <Search size={16} />
            </button>
          </Tooltip>

          <Tooltip content={<>Bookmarks <kbd className={styles.kbd}>â‡§B</kbd></>} placement="top">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'bookmarks'}
              aria-label="Bookmarks"
              className={`${styles.miniTabBtn} ${activeTab === 'bookmarks' ? styles.miniTabBtnActive : ''}`}
              onClick={() => onTabChange?.('bookmarks')}
            >
              <Bookmark size={16} />
            </button>
          </Tooltip>
        </div>

        <Tooltip content={<>Collapse sidebar <kbd className={styles.kbd}>[</kbd></>} placement="top">
          <button
            type="button"
            aria-label="Collapse sidebar"
            className={styles.headerActionBtn}
            onClick={onToggleSidebar}
          >
            <PanelLeftClose size={16} />
          </button>
        </Tooltip>
      </div>

      {/* Row 2: Actions */}
      <div className={styles.headerActionsRow}>
        <Tooltip content={<>New note <kbd className={styles.kbd}>N</kbd></>} placement="top">
          <button
            type="button"
            aria-label="New note"
            onClick={handleCreateNote}
          >
            <SquarePen size={16} />
          </button>
        </Tooltip>

        <Tooltip content={<>New notebook <kbd className={styles.kbd}>â‡§N</kbd></>} placement="top">
          <button
            type="button"
            aria-label="New notebook"
            onClick={handleCreateNotebook}
          >
            <FolderPlus size={16} />
          </button>
        </Tooltip>

        <Tooltip content="Sort menu" placement="top">
          <button
            type="button"
            aria-label="Sort menu toggle"
            onClick={onToggleSort}
          >
            <SortAsc size={16} />
          </button>
        </Tooltip>

        <Tooltip content={allCollapsed ? "Expand all" : "Collapse all"} placement="top">
          <button
            type="button"
            aria-label="Expand or collapse all"
            onClick={handleToggleExpand}
          >
            <ChevronsUpDown size={16} />
          </button>
        </Tooltip>
      </div>
    </div>
  );
}

export function Menu({ children }: { children: ReactNode }) {
  return (
    <div
      className={styles.menu}
      onClick={(event) => event.stopPropagation()}
    >
      {children}
    </div>
  );
}

export function ShareModal({
  note,
  onClose,
  onSave,
}: {
  note: NoteDocument;
  onClose: () => void;
  onSave: (patch: Partial<NoteDocument>) => void;
}) {
  const [email, setEmail] = useState('');

  return (
    <div className={styles.scrim}>
      <div className={styles.modal}>
        <h2>Share â€œ{note.title}â€</h2>
        <label>
          <input
            type="checkbox"
            checked={note.publicLink}
            onChange={(event) => onSave({ publicLink: event.target.checked })}
          />
          Public link
        </label>
        <div className={styles.shareLine}>
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="teammate@example.com"
          />
          <select
            value={note.permission}
            onChange={(event) => onSave({ permission: event.target.value as Permission })}
          >
            <option>viewer</option>
            <option>editor</option>
            <option>owner</option>
          </select>
        </div>
        <button
          onClick={() => {
            if (email) onSave({ shared: true, sharedWith: [...note.sharedWith, email] });
            setEmail('');
          }}
        >
          Share with user
        </button>
        <button
          onClick={() => navigator.clipboard?.writeText(`${location.origin}/notes/${note.id}`)}
        >
          Copy Link
        </button>
        <button onClick={onClose}>Done</button>
      </div>
    </div>
  );
}
