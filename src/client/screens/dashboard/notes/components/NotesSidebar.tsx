import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Search, Plus, LayoutGrid, Menu, Pin, Star, Share, Trash2, PanelLeft, PanelLeftOpen, CheckSquare, Calendar as CalendarIcon, MoreHorizontal, Lock, Unlock } from 'lucide-react';

import { SpaceHeader } from './RightColumn/SpaceHeader';
import { TasksSection } from './RightColumn/TasksSection';
import type { Task } from './RightColumn/TasksSection';
import { WorkspaceSection } from './RightColumn/WorkspaceSection';
import { RecentlyClosedSection } from './RightColumn/RecentlyClosedSection';
import { Calendar } from '@/src/client/components/ui/Calendar';
import type { CalendarEvent } from '@/src/client/components/ui/Calendar';
import { SearchBar } from '@/src/client/components/global/SearchBar';
import styles from './NotesSidebar.module.css';
import rightColStyles from './RightColumn/RightColumn.module.css';

import type { useNotes } from '../hooks/useNotes';
import { useRecentlyClosedNotes } from '../hooks/useRecentlyClosedNotes';
import type { NotebookEntity, NotebookListItem } from '../models/notes.models';
import { useUnifiedTasks } from '@/src/client/hooks/useUnifiedTasks';

type NotesContextType = ReturnType<typeof useNotes>;

const COLORS = ['#4f46e5', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'];

export interface NotebookRowProps {
  notebook: NotebookListItem | NotebookEntity;
  index: number;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onRename: (id: string, updates: { title: string; icon?: string; color?: string }) => void;
  onDelete: (id: string) => void;
  onToggleFavorite: (id: string, currentFavorite: boolean) => void;
}

export const NotebookRow = React.memo(function NotebookRow({
  notebook,
  index,
  isSelected,
  onSelect,
  onRename,
  onDelete,
  onToggleFavorite,
}: NotebookRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editingTitle, setEditingTitle] = useState(notebook.title);
  const [editingIcon, setEditingIcon] = useState(notebook.icon || '');
  const [editingColor, setEditingColor] = useState<string | null>(notebook.color || null);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
    }
  }, [isEditing]);

  useEffect(() => {
    if (!isPopoverOpen) return;
    const handleClickOutside = () => setIsPopoverOpen(false);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, [isPopoverOpen]);

  const handleStartEdit = () => {
    setEditingTitle(notebook.title);
    setEditingIcon(notebook.icon || '');
    setEditingColor(notebook.color || null);
    setIsPopoverOpen(false);
    setIsEditing(true);
  };

  const handleSave = () => {
    onRename(notebook.id, {
      title: editingTitle,
      icon: editingIcon,
      color: editingColor || undefined,
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  return (
    <div 
      className={`${styles.channelItem} ${isSelected ? styles.selected : ''} ${isEditing ? styles.editingItem : ''}`}
      onClick={() => onSelect(notebook.id)}
    >
      {isEditing ? (
        <div className={styles.inlineEditor} onClick={(e) => e.stopPropagation()}>
          <div className={styles.editorRow}>
            <input 
              className={styles.iconInput}
              value={editingIcon}
              onChange={(e) => setEditingIcon(e.target.value)}
              placeholder="😀"
              maxLength={2}
            />
            <input
              className={styles.titleInput}
              ref={inputRef}
              value={editingTitle}
              onChange={(e) => setEditingTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSave();
                }
                if (e.key === 'Escape') {
                  handleCancel();
                }
              }}
              placeholder="Notebook title..."
            />
          </div>
          <div className={styles.colorPickerRow}>
            {COLORS.map((c) => (
              <div 
                key={c} 
                className={`${styles.colorCircle} ${editingColor === c ? styles.selectedColor : ''}`}
                style={{ backgroundColor: c }}
                onClick={() => setEditingColor(c)}
              />
            ))}
          </div>
          <div className={styles.editorActions}>
            <button className={styles.editorCancel} onClick={handleCancel}>Cancel</button>
            <button className={styles.editorSave} onClick={handleSave}>Save</button>
          </div>
        </div>
      ) : (
        <>
          <div className={styles.avatar} style={{ backgroundColor: notebook.color || `hsl(${index * 30}, 60%, 50%)` }}>
            {notebook.icon || notebook.title.charAt(0).toUpperCase()}
          </div>
          <span className={styles.channelName}>{notebook.title}</span>
          <div className={styles.pinIcon} style={{ display: 'flex', gap: '4px' }}>
            <Star 
              size={15}
              fill={notebook.favorite ? '#fbbf24' : 'none'}
              color={notebook.favorite ? '#fbbf24' : '#71717a'}
              style={{ cursor: 'pointer' }}
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                if ('favorite' in notebook) {
                  onToggleFavorite(notebook.id, Boolean(notebook.favorite));
                }
              }}
            />
            <div style={{ position: 'relative' }} className="popover-container">
              <MoreHorizontal 
                size={16} 
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation();
                  setIsPopoverOpen((prev) => !prev);
                }}
              />
              {isPopoverOpen && (
                <div 
                  className={styles.popoverMenu}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button className={styles.popoverItem} onClick={(e) => { 
                    e.stopPropagation(); 
                    handleStartEdit();
                  }}>Edit Notebook</button>
                  <button className={styles.popoverItem} onClick={(e) => {
                    e.stopPropagation();
                    onDelete(notebook.id);
                    setIsPopoverOpen(false);
                  }}>Delete</button>
                  <button className={styles.popoverItem} onClick={(e) => {
                    e.stopPropagation();
                    alert('Copied');
                    setIsPopoverOpen(false);
                  }}>Copy</button>
                  <button className={styles.popoverItem} onClick={(e) => {
                    e.stopPropagation();
                    alert('Cut');
                    setIsPopoverOpen(false);
                  }}>Cut</button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.index === nextProps.index &&
    prevProps.notebook.id === nextProps.notebook.id &&
    prevProps.notebook.title === nextProps.notebook.title &&
    prevProps.notebook.icon === nextProps.notebook.icon &&
    prevProps.notebook.color === nextProps.notebook.color &&
    (prevProps.notebook as any).favorite === (nextProps.notebook as any).favorite &&
    prevProps.onSelect === nextProps.onSelect &&
    prevProps.onRename === nextProps.onRename &&
    prevProps.onDelete === nextProps.onDelete &&
    prevProps.onToggleFavorite === nextProps.onToggleFavorite
  );
});

interface NavigationColumnProps {
  isNavigationExpanded: boolean;
  onCollapseNav: () => void;
  isNavLocked?: boolean;
  onToggleNavLock?: () => void;
  isNavIconsOnly: boolean;
  navWidth: number;
  isDraggingNav: boolean;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  filteredNotebooks: (NotebookListItem | NotebookEntity)[];
  selectedNotebookId: string | null;
  onCreateNotebook: () => void;
  onSelectNotebook: (id: string) => void;
  onRenameNotebook: (id: string, updates: { title: string; icon?: string; color?: string }) => void;
  onDeleteNotebook: (id: string) => void;
  onToggleFavorite: (id: string, currentFavorite: boolean) => void;
  onStartNavDrag: (e: React.MouseEvent) => void;
  onNavResizeHandleClick: () => void;
  activeFilter: 'all' | 'favorites' | 'shared' | 'archived';
  favoritesCount: number;
  sharedCount: number;
  trashCount: number;
  onSelectFilter: (filter: 'favorites' | 'shared' | 'archived') => void;
}

export const NavigationColumn = React.memo(function NavigationColumn({
  isNavigationExpanded,
  onCollapseNav,
  isNavLocked = false,
  onToggleNavLock,
  isNavIconsOnly,
  navWidth,
  isDraggingNav,
  searchQuery,
  onSearchChange,
  filteredNotebooks,
  selectedNotebookId,
  onCreateNotebook,
  onSelectNotebook,
  onRenameNotebook,
  onDeleteNotebook,
  onToggleFavorite,
  onStartNavDrag,
  onNavResizeHandleClick,
  activeFilter,
  favoritesCount,
  sharedCount,
  trashCount,
  onSelectFilter,
}: NavigationColumnProps) {
  const navInlineStyle = isNavigationExpanded 
    ? { width: `${navWidth}px`, transition: isDraggingNav ? 'none' : undefined }
    : undefined;

  return (
    <div 
      className={`${styles.navigationColumn} ${!isNavigationExpanded ? styles.collapsed : ''} ${isNavIconsOnly ? styles.iconsOnly : ''}`}
      style={navInlineStyle}
    >
      <div className={styles.navigationInner} style={isNavigationExpanded ? { width: `${navWidth}px` } : undefined}>
        {/* 1. Top Section */}
        <div className={styles.topBar}>
          <div className={styles.topBarActions}>
            {!isNavIconsOnly && (
              <>
                <button className={styles.iconButton} onClick={onCreateNotebook}>
                  <Plus size={18} />
                </button>
                <button className={styles.iconButton}>
                  <LayoutGrid size={18} />
                </button>
                <div style={{ flex: 1 }} />
              </>
            )}
            {!isNavIconsOnly && onToggleNavLock && (
              <button 
                className={`${styles.iconButton} ${isNavLocked ? styles.activeLock : ''}`}
                onClick={onToggleNavLock}
                aria-label={isNavLocked ? "Unlock navigation column (auto-close enabled)" : "Lock navigation column open"}
                title={isNavLocked ? "Navigation locked open (auto-close disabled)" : "Lock navigation open"}
                aria-pressed={isNavLocked}
              >
                {isNavLocked ? <Lock size={16} /> : <Unlock size={16} />}
              </button>
            )}
            <button 
              className={styles.iconButton} 
              onClick={onCollapseNav}
              aria-label="Collapse navigation panel"
              title="Collapse navigation"
              aria-expanded="true"
            >
              <PanelLeft size={18} />
            </button>
          </div>
        </div>

        {/* 2. Search */}
        <div className={styles.searchContainer}>
          <SearchBar 
            value={searchQuery}
            onChange={onSearchChange}
            placeholder="Filter notebooks..." 
          />
        </div>

        {/* 3 & 4. Channel List */}
        <div className={styles.channelList}>
          {filteredNotebooks.map((nb, idx) => (
            <NotebookRow 
              key={nb.id}
              notebook={nb}
              index={idx}
              isSelected={selectedNotebookId === nb.id}
              onSelect={onSelectNotebook}
              onRename={onRenameNotebook}
              onDelete={onDeleteNotebook}
              onToggleFavorite={onToggleFavorite}
            />
          ))}
        </div>

        {/* 6. Bottom Pinned Items */}
        <div className={styles.bottomSection}>
          <div
            className={`${styles.bottomItem} ${activeFilter === 'favorites' ? styles.selected : ''}`}
            onClick={() => onSelectFilter('favorites')}
            role="button"
            tabIndex={0}
            aria-label="Favorites"
          >
            <Star
              className={styles.bottomIcon}
              fill={activeFilter === 'favorites' ? '#fbbf24' : 'none'}
              color="#fbbf24"
            />
            <span>Favorites</span>
            {favoritesCount > 0 && <span className={styles.bottomCount}>{favoritesCount}</span>}
          </div>
          <div
            className={`${styles.bottomItem} ${activeFilter === 'shared' ? styles.selected : ''}`}
            onClick={() => onSelectFilter('shared')}
            role="button"
            tabIndex={0}
            aria-label="Shared with me"
          >
            <Share className={styles.bottomIcon} />
            <span>Shared with me</span>
            {sharedCount > 0 && <span className={styles.bottomCount}>{sharedCount}</span>}
          </div>
          <div
            className={`${styles.bottomItem} ${activeFilter === 'archived' ? styles.selected : ''}`}
            onClick={() => onSelectFilter('archived')}
            role="button"
            tabIndex={0}
            aria-label="Trash"
          >
            <Trash2 className={styles.bottomIcon} />
            <span>Trash</span>
            {trashCount > 0 && <span className={styles.bottomCount}>{trashCount}</span>}
          </div>
        </div>
      </div>
      {isNavigationExpanded && (
        <div 
          className={styles.resizeHandle} 
          onMouseDown={onStartNavDrag} 
          onClick={onNavResizeHandleClick}
        />
      )}
    </div>
  );
});

export function NotesSidebar({
  notes,
  isNavigationExpanded,
  setIsNavigationExpanded,
  isWorkspaceExpanded,
  setIsWorkspaceExpanded,
  isNavLocked = false,
  onToggleNavLock,
}: {
  notes: NotesContextType;
  isNavigationExpanded: boolean;
  setIsNavigationExpanded: (v: boolean) => void;
  isWorkspaceExpanded: boolean;
  setIsWorkspaceExpanded: (v: boolean) => void;
  isNavLocked?: boolean;
  onToggleNavLock?: () => void;
}) {
  const selectedNoteId = notes.data?.selectedNote?.id ?? null;
  const selectedNoteTitle = notes.data?.selectedNote?.title;
  const selectedNotebookId = notes.state?.selectedNotebookId || null;
  
  const { closedNotes: allClosedNotes, removeClosedNote } = useRecentlyClosedNotes(selectedNoteId, selectedNoteTitle, selectedNotebookId);
  
  // Only show recently closed notes that belong to the current notebook
  const closedNotes = useMemo(() => {
    return allClosedNotes.filter((note) => note.notebookId === selectedNotebookId);
  }, [allClosedNotes, selectedNotebookId]);

  const [searchQuery, setSearchQuery] = useState('');
  const [workspaceSearch, setWorkspaceSearch] = useState('');
  const [isSearchingWorkspace, setIsSearchingWorkspace] = useState(false);
  const [foldersByNotebook, setFoldersByNotebook] = useState<Record<string, { id: string, title: string, isOpen: boolean }[]>>({});
  const [noteFolderMap, setNoteFolderMap] = useState<Record<string, string>>({});

  const notebooks = notes.data?.notebooks || [];
  const prevNotebooksRef = useRef(notebooks);
  const stableNotebooks = useMemo(() => {
    const prev = prevNotebooksRef.current;
    if (
      prev.length === notebooks.length &&
      prev.every((nb, i) => {
        const next = notebooks[i];
        return (
          nb.id === next.id &&
          nb.title === next.title &&
          nb.color === next.color &&
          nb.icon === next.icon &&
          (nb as any).favorite === (next as any).favorite
        );
      })
    ) {
      return prev;
    }
    prevNotebooksRef.current = notebooks;
    return notebooks;
  }, [notebooks]);

  const filteredNotebooks = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return stableNotebooks.filter((nb) => 
      nb.title.toLowerCase().includes(q)
    );
  }, [stableNotebooks, searchQuery]);

  const activeFilter = (notes.state?.filter as 'all' | 'favorites' | 'shared' | 'archived') || 'all';
  const shouldCollapseWorkspace = !isWorkspaceExpanded || (!selectedNotebookId && activeFilter === 'all');
  
  const [navWidth, setNavWidth] = useState(290);
  const navWidthRef = useRef(navWidth);
  useEffect(() => { navWidthRef.current = navWidth; }, [navWidth]);

  const [workspaceWidth, setWorkspaceWidth] = useState(310);
  
  const isNavigationExpandedRef = useRef(isNavigationExpanded);
  useEffect(() => { isNavigationExpandedRef.current = isNavigationExpanded; }, [isNavigationExpanded]);
  const [activeTab, setActiveTab] = useState<'tasks' | 'calendar'>('tasks');

  const {
    tasks: unifiedTasks,
    addTask: addUnifiedTask,
    updateTask: updateUnifiedTask,
    toggleTask: toggleUnifiedTask,
    removeTask: removeUnifiedTask,
  } = useUnifiedTasks();

  const [tasksByNotebook, setTasksByNotebook] = useState<Record<string, Task[]>>({});

  const currentTasks: Task[] = React.useMemo(() => {
    return unifiedTasks.map((t) => ({
      id: t.id,
      title: t.title,
      date: t.dateStr || `${t.month + 1}/${t.day}`,
      status: t.status,
      noteId: t.noteId,
      category: t.category,
      color: t.color,
    }));
  }, [unifiedTasks]);

  const setCurrentTasks = useCallback((newTasks: Task[]) => {
    if (selectedNotebookId) {
      setTasksByNotebook((prev) => ({ ...prev, [selectedNotebookId]: newTasks }));
    }
  }, [selectedNotebookId]);

  const calendarEvents: CalendarEvent[] = React.useMemo(() => {
    return unifiedTasks.map((t) => ({
      day: t.day,
      tone: t.status === 'completed' ? 'green' : (t.tone as any) || 'orange',
      title: t.title,
    }));
  }, [unifiedTasks]);

  const [isDraggingNav, setIsDraggingNav] = useState(false);
  const [isDraggingWorkspace, setIsDraggingWorkspace] = useState(false);
  
  const navDragFlag = useRef(false);
  const workspaceDragFlag = useRef(false);

  useEffect(() => {
    if (!isDraggingNav) return;
    const handleMouseMove = (e: MouseEvent) => {
      navDragFlag.current = true;
      let newWidth = e.clientX; 
      if (newWidth < 150 && newWidth > 40) {
        newWidth = 64;
      } else if (newWidth <= 40) {
        setIsNavigationExpanded(false);
        setIsDraggingNav(false);
        setNavWidth(290);
        return;
      }
      setNavWidth(newWidth);
    };
    const handleMouseUp = () => setIsDraggingNav(false);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingNav, setIsNavigationExpanded]);

  useEffect(() => {
    if (!isDraggingWorkspace) return;
    const handleMouseMove = (e: MouseEvent) => {
      workspaceDragFlag.current = true;
      const navOffset = isNavigationExpandedRef.current ? navWidthRef.current : 0;
      const newWidth = e.clientX - navOffset;
      
      if (newWidth < 250) {
        setIsWorkspaceExpanded(false);
        setIsDraggingWorkspace(false);
        setWorkspaceWidth(310);
        return;
      }
      setWorkspaceWidth(newWidth);
    };
    const handleMouseUp = () => setIsDraggingWorkspace(false);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingWorkspace, setIsWorkspaceExpanded]);

  const isNavIconsOnly = isNavigationExpanded && navWidth === 64;

  const handleCreateNotebook = useCallback(() => {
    notes.actions.createNotebook();
  }, [notes.actions]);

  const handleSelectNotebook = useCallback((id: string) => {
    if (notes.state?.filter && notes.state.filter !== 'all') {
      notes.actions.setFilter('all');
    }
    if (!isWorkspaceExpanded) {
      notes.actions.selectNotebook(id);
      setIsWorkspaceExpanded(true);
    } else {
      if (id !== selectedNotebookId) {
        notes.actions.selectNotebook(id);
      } else {
        setIsWorkspaceExpanded(false);
      }
    }
  }, [notes.actions, notes.state?.filter, isWorkspaceExpanded, selectedNotebookId, setIsWorkspaceExpanded]);

  const handleRenameNotebook = useCallback((id: string, updates: { title: string; icon?: string; color?: string }) => {
    notes.actions.patchNotebook(id, updates);
  }, [notes.actions]);

  const handleDeleteNotebook = useCallback((id: string) => {
    notes.actions.deleteNotebook(id);
  }, [notes.actions]);

  const handleToggleFavorite = useCallback((id: string, currentFavorite: boolean) => {
    notes.actions.patchNotebook(id, { favorite: !currentFavorite });
  }, [notes.actions]);

  const handleCollapseNav = useCallback(() => {
    setIsNavigationExpanded(false);
  }, [setIsNavigationExpanded]);

  const handleStartNavDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingNav(true);
    navDragFlag.current = false;
  }, []);

  const handleNavResizeHandleClick = useCallback(() => {
    if (!navDragFlag.current) {
      setIsNavigationExpanded(false);
    }
  }, [setIsNavigationExpanded]);

  const handleSelectNote = useCallback((id: string) => {
    notes.actions.selectNote(id);
    if (!isNavLocked) {
      setIsNavigationExpanded(false);
    }
  }, [notes.actions, isNavLocked, setIsNavigationExpanded]);

  const handleCreateNote = useCallback((notebookId: string, options?: any) => {
    notes.actions.createNote(notebookId, options);
    if (!isNavLocked) {
      setIsNavigationExpanded(false);
    }
  }, [notes.actions, isNavLocked, setIsNavigationExpanded]);

  const handleTaskClick = useCallback((task: Task) => {
    if (task.noteId) {
      handleSelectNote(task.noteId);
    }
  }, [handleSelectNote]);

  const selectedNotebook = useMemo(() => {
    return notes.data?.notebooks?.find((n) => n.id === selectedNotebookId);
  }, [notes.data?.notebooks, selectedNotebookId]);

  const workspaceInlineStyle = isWorkspaceExpanded
    ? { width: `${workspaceWidth}px`, transition: isDraggingWorkspace ? 'none' : undefined }
    : undefined;

  const allNotebooks = notes.state?.notebooks || [];
  const allNotes = notes.state?.notes || [];

  const favoritesCount = useMemo(() => {
    const nbFav = allNotebooks.filter((n: any) => n.favorite && !n.archived).length;
    const noteFav = allNotes.filter((n: any) => n.favorite && !n.archived).length;
    return nbFav + noteFav;
  }, [allNotebooks, allNotes]);

  const sharedCount = useMemo(() => {
    const nbShared = allNotebooks.filter((n: any) => n.shared && !n.archived).length;
    const noteShared = allNotes.filter((n: any) => (n.shared || n.publicLink || (n.sharedWith?.length ?? 0) > 0) && !n.archived).length;
    return nbShared + noteShared;
  }, [allNotebooks, allNotes]);

  const trashCount = useMemo(() => {
    const nbArchived = allNotebooks.filter((n: any) => n.archived).length;
    const noteArchived = allNotes.filter((n: any) => n.archived).length;
    return nbArchived + noteArchived;
  }, [allNotebooks, allNotes]);

  const handleSelectFilter = useCallback((filter: 'favorites' | 'shared' | 'archived') => {
    if (activeFilter === filter) {
      notes.actions.setFilter('all');
    } else {
      notes.actions.setFilter(filter);
      setIsWorkspaceExpanded(true);
    }
  }, [activeFilter, notes.actions, setIsWorkspaceExpanded]);

  return (
    <aside className={styles.sidebar}>
      {!isNavigationExpanded && (
        <div 
          className={styles.reopenHandle}
          onClick={() => setIsNavigationExpanded(true)}
        />
      )}

      <NavigationColumn
        isNavigationExpanded={isNavigationExpanded}
        onCollapseNav={handleCollapseNav}
        isNavLocked={isNavLocked}
        onToggleNavLock={onToggleNavLock}
        isNavIconsOnly={isNavIconsOnly}
        navWidth={navWidth}
        isDraggingNav={isDraggingNav}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        filteredNotebooks={filteredNotebooks}
        selectedNotebookId={selectedNotebookId}
        onCreateNotebook={handleCreateNotebook}
        onSelectNotebook={handleSelectNotebook}
        onRenameNotebook={handleRenameNotebook}
        onDeleteNotebook={handleDeleteNotebook}
        onToggleFavorite={handleToggleFavorite}
        onStartNavDrag={handleStartNavDrag}
        onNavResizeHandleClick={handleNavResizeHandleClick}
        activeFilter={activeFilter}
        favoritesCount={favoritesCount}
        sharedCount={sharedCount}
        trashCount={trashCount}
        onSelectFilter={handleSelectFilter}
      />
      
      <div 
        className={`${styles.workspaceColumn} ${shouldCollapseWorkspace ? styles.collapsed : ''}`}
        style={shouldCollapseWorkspace ? { width: '0px', borderRight: 'none', pointerEvents: 'none' } : workspaceInlineStyle}
      >
        <div className={styles.workspaceInner} style={isWorkspaceExpanded ? { width: `${workspaceWidth}px` } : undefined}>
          <div className={styles.topBar}>
            <div className={styles.topBarActions}>
              {!isNavigationExpanded && (
                <button 
                  className={styles.iconButton} 
                  onClick={() => setIsNavigationExpanded(true)}
                  aria-label="Open navigation panel"
                  title="Open navigation"
                  aria-expanded="false"
                >
                  <PanelLeftOpen size={18} />
                </button>
              )}
              <button 
                className={styles.iconButton} 
                onClick={() => setIsWorkspaceExpanded(false)}
                aria-label="Collapse workspace panel"
                title="Collapse workspace"
                aria-expanded="true"
              >
                <Menu size={18} />
              </button>
            </div>
          </div>

          <SpaceHeader 
            notebook={selectedNotebook} 
            notes={notes}
            isSearchingWorkspace={isSearchingWorkspace}
            setIsSearchingWorkspace={setIsSearchingWorkspace}
            foldersByNotebook={foldersByNotebook}
            setFoldersByNotebook={setFoldersByNotebook}
            onCreateNote={handleCreateNote}
          />
          <RecentlyClosedSection 
            notes={notes} 
            closedNotes={closedNotes} 
            onRemove={removeClosedNote}
            onSelectNote={handleSelectNote}
          />
          <WorkspaceSection 
            notes={notes}
            workspaceSearch={workspaceSearch}
            setWorkspaceSearch={setWorkspaceSearch}
            isSearchingWorkspace={isSearchingWorkspace}
            foldersByNotebook={foldersByNotebook}
            setFoldersByNotebook={setFoldersByNotebook}
            noteFolderMap={noteFolderMap}
            setNoteFolderMap={setNoteFolderMap}
            onSelectNote={handleSelectNote}
            onCreateNote={handleCreateNote}
          />

          <div className={rightColStyles.tabSwitcher}>
            <button 
              className={`${rightColStyles.tabButton} ${activeTab === 'tasks' ? rightColStyles.activeTabButton : ''}`}
              onClick={() => setActiveTab('tasks')}
              aria-label="Tasks"
            >
              <CheckSquare size={16} />
            </button>
            <button 
              className={`${rightColStyles.tabButton} ${activeTab === 'calendar' ? rightColStyles.activeTabButton : ''}`}
              onClick={() => setActiveTab('calendar')}
              aria-label="Calendar"
            >
              <CalendarIcon size={16} />
            </button>
          </div>

          {activeTab === 'tasks' ? (
            <TasksSection 
              tasks={currentTasks} 
              setTasks={setCurrentTasks} 
              onToggleStatus={(id) => toggleUnifiedTask(String(id))}
              onDeleteTask={(id) => removeUnifiedTask(String(id))}
              onEditTask={(id, newTitle) => updateUnifiedTask(String(id), { title: newTitle })}
              onAddTask={(title) => {
                const now = new Date();
                addUnifiedTask({
                  title,
                  year: now.getFullYear(),
                  month: now.getMonth(),
                  day: now.getDate(),
                  category: 'Notes',
                  status: 'pending',
                  color: '#3b82f6',
                  tone: 'blue',
                });
              }}
              onTaskClick={handleTaskClick}
            />
          ) : (
            <div className={rightColStyles.sectionContainer}>
              <Calendar 
                events={calendarEvents}
              />
            </div>
          )}
        </div>
        {isWorkspaceExpanded && (selectedNotebookId || activeFilter !== 'all') && (
          <div 
            className={styles.resizeHandle} 
            onMouseDown={(e) => { e.preventDefault(); setIsDraggingWorkspace(true); workspaceDragFlag.current = false; }} 
            onClick={() => { if (!workspaceDragFlag.current) setIsWorkspaceExpanded(false); }}
          />
        )}
      </div>
    </aside>
  );
}
