import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, LayoutGrid, Menu, Pin, Star, Share, Trash2, PanelLeft, PanelLeftOpen, CheckSquare, Calendar as CalendarIcon, MoreHorizontal } from 'lucide-react';

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

type NotesContextType = ReturnType<typeof useNotes>;

export function NotesSidebar({
  notes,
  isNavigationExpanded,
  setIsNavigationExpanded,
  isWorkspaceExpanded,
  setIsWorkspaceExpanded,
}: {
  notes: NotesContextType;
  isNavigationExpanded: boolean;
  setIsNavigationExpanded: (v: boolean) => void;
  isWorkspaceExpanded: boolean;
  setIsWorkspaceExpanded: (v: boolean) => void;
}) {
  const selectedNoteId = notes.data?.selectedNote?.id ?? null;
  const selectedNoteTitle = notes.data?.selectedNote?.title;
  const { closedNotes, removeClosedNote } = useRecentlyClosedNotes(selectedNoteId, selectedNoteTitle);

  const [searchQuery, setSearchQuery] = useState('');
  const [workspaceSearch, setWorkspaceSearch] = useState('');
  const [isSearchingWorkspace, setIsSearchingWorkspace] = useState(false);
  const [foldersByNotebook, setFoldersByNotebook] = useState<Record<string, { id: string, title: string, isOpen: boolean }[]>>({});
  const [noteFolderMap, setNoteFolderMap] = useState<Record<string, string>>({});
  const [activePopoverId, setActivePopoverId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const notebooks = notes.data?.notebooks || [];
  const filteredNotebooks = notebooks.filter(nb => 
    nb.title.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const selectedNotebookId = notes.data?.selectedNotebook?.id;
  
  const [navWidth, setNavWidth] = useState(290);
  const navWidthRef = useRef(navWidth);
  useEffect(() => { navWidthRef.current = navWidth; }, [navWidth]);

  const [workspaceWidth, setWorkspaceWidth] = useState(310);
  
  const isNavigationExpandedRef = useRef(isNavigationExpanded);
  useEffect(() => { isNavigationExpandedRef.current = isNavigationExpanded; }, [isNavigationExpanded]);
  const [activeTab, setActiveTab] = useState<'tasks' | 'calendar'>('tasks');

  const [tasksByNotebook, setTasksByNotebook] = useState<Record<string, Task[]>>({});

  const currentTasks = React.useMemo(() => {
    if (!selectedNotebookId) return [];
    
    // Aggregate from notes in this notebook
    const notebookNotes = notes.state?.notes?.filter(n => n.notebookId === selectedNotebookId && !n.archived && n.contentType === 'kanban') || [];
    
    const now = new Date();
    // Calculate start and end of the current week (assuming Sunday start)
    const currentDay = now.getDay();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - currentDay);
    weekStart.setHours(0, 0, 0, 0);
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const aggregated: Task[] = [];
    notebookNotes.forEach(note => {
      if (note.kanbanCards) {
        note.kanbanCards.forEach(card => {
          const dateStr = card.dueDate || card.deadline;
          if (dateStr) {
            const date = new Date(dateStr);
            if (!isNaN(date.getTime())) {
              // Check if date is within current week
              if (date >= weekStart && date <= weekEnd) {
                // Format date nicely like "Jun 5"
                const formattedDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                
                // Status could be derived from column (e.g. done -> completed)
                const isCompleted = card.column === 'done' || card.column?.toLowerCase().includes('done');
                
                aggregated.push({
                  id: card.id,
                  title: card.label || 'Untitled Card',
                  date: formattedDate,
                  status: isCompleted ? 'completed' : 'pending',
                  noteId: note.id,
                });
              }
            }
          }
        });
      }
    });

    return aggregated.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [selectedNotebookId, notes.state?.notes]);

  const setCurrentTasks = (newTasks: Task[]) => {
    if (selectedNotebookId) {
      setTasksByNotebook(prev => ({ ...prev, [selectedNotebookId]: newTasks }));
    }
  };

  const calendarEvents: CalendarEvent[] = React.useMemo(() => {
    return currentTasks.map(t => {
      const match = t.date.match(/\d+/);
      return {
        day: match ? parseInt(match[0], 10) : 1,
        tone: t.status === 'completed' ? 'green' : 'orange'
      };
    });
  }, [currentTasks]);

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

  const navInlineStyle = isNavigationExpanded 
    ? { width: `${navWidth}px`, transition: isDraggingNav ? 'none' : undefined }
    : undefined;

  const workspaceInlineStyle = isWorkspaceExpanded
    ? { width: `${workspaceWidth}px`, transition: isDraggingWorkspace ? 'none' : undefined }
    : undefined;

  const isNavIconsOnly = isNavigationExpanded && navWidth === 64;
  
  return (
    <aside className={styles.sidebar}>
      {!isNavigationExpanded && (
        <div 
          className={styles.reopenHandle}
          onClick={() => setIsNavigationExpanded(true)}
        />
      )}
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
                  <button className={styles.iconButton} onClick={() => notes.actions.createNotebook()}>
                    <Plus size={18} />
                  </button>
                  <button className={styles.iconButton}>
                    <LayoutGrid size={18} />
                  </button>
                  <div style={{ flex: 1 }} />
                </>
              )}
              <button 
                className={styles.iconButton} 
                onClick={() => setIsNavigationExpanded(false)}
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
              onChange={setSearchQuery}
              placeholder="Filter notebooks..." 
            />
          </div>

          {/* 3 & 4. Channel List */}
          <div className={styles.channelList}>
            {filteredNotebooks.map((nb, idx) => (
              <div 
                key={nb.id} 
                className={`${styles.channelItem} ${selectedNotebookId === nb.id ? styles.selected : ''}`}
                onClick={() => notes.actions.selectNotebook(nb.id)}
                onDoubleClick={() => {
                  setEditingId(nb.id);
                  setEditingTitle(nb.title);
                }}
              >
                <div className={styles.avatar} style={{ backgroundColor: `hsl(${idx * 30}, 60%, 50%)` }}>
                  {nb.title.charAt(0).toUpperCase()}
                </div>
                {editingId === nb.id ? (
                  <input
                    ref={inputRef}
                    value={editingTitle}
                    onChange={(e) => setEditingTitle(e.target.value)}
                    onBlur={() => {
                      notes.actions.patchNotebook(nb.id, { title: editingTitle });
                      setEditingId(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        notes.actions.patchNotebook(nb.id, { title: editingTitle });
                        setEditingId(null);
                      }
                      if (e.key === 'Escape') {
                        setEditingId(null);
                      }
                    }}
                    style={{ background: 'transparent', border: 'none', color: '#fff', outline: 'none', width: '100%', fontSize: 'inherit', fontWeight: 'inherit', padding: 0 }}
                  />
                ) : (
                  <span className={styles.channelName}>{nb.title}</span>
                )}
                <div className={styles.pinIcon} style={{ display: 'flex', gap: '4px' }}>
                  <Star 
                    size={16}
                    onClick={(e) => {
                      e.stopPropagation();
                      if ('favorite' in nb) {
                        notes.actions.patchNotebook(nb.id, { favorite: !nb.favorite });
                      }
                      console.log('Star toggled for', nb.title);
                    }}
                  />
                  <div style={{ position: 'relative' }} className="popover-container">
                    <MoreHorizontal 
                      size={16} 
                      onClick={(e) => {
                        e.stopPropagation();
                        setActivePopoverId(activePopoverId === nb.id ? null : nb.id);
                      }}
                    />
                    {activePopoverId === nb.id && (
                      <div 
                        className={styles.popoverMenu}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button className={styles.popoverItem} onClick={(e) => { e.stopPropagation(); setEditingId(nb.id); setEditingTitle(nb.title); setActivePopoverId(null); }}>Rename</button>
                        <button className={styles.popoverItem} onClick={(e) => { e.stopPropagation(); notes.actions.deleteNotebook(nb.id); setActivePopoverId(null); }}>Delete</button>
                        <button className={styles.popoverItem} onClick={(e) => { e.stopPropagation(); alert('Copied'); setActivePopoverId(null); }}>Copy</button>
                        <button className={styles.popoverItem} onClick={(e) => { e.stopPropagation(); alert('Cut'); setActivePopoverId(null); }}>Cut</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 6. Bottom Pinned Items */}
          <div className={styles.bottomSection}>
            <div className={styles.bottomItem}>
              <Star className={styles.bottomIcon} fill="#fbbf24" color="#fbbf24" />
              <span>Favorites</span>
              <span className={styles.bottomCount}>8</span>
            </div>
            <div className={styles.bottomItem}>
              <Share className={styles.bottomIcon} />
              <span>Shared with me</span>
              <span className={styles.bottomCount}>⇧ 7</span>
            </div>
            <div className={styles.bottomItem}>
              <Trash2 className={styles.bottomIcon} />
              <span>Trash</span>
            </div>
          </div>
        </div>
        {isNavigationExpanded && (
          <div 
            className={styles.resizeHandle} 
            onMouseDown={(e) => { e.preventDefault(); setIsDraggingNav(true); navDragFlag.current = false; }} 
            onClick={() => { if (!navDragFlag.current) setIsNavigationExpanded(false); }}
          />
        )}
      </div>
      
      <div 
        className={`${styles.workspaceColumn} ${!isWorkspaceExpanded ? styles.collapsed : ''}`}
        style={workspaceInlineStyle}
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
            notebook={notes.data?.notebooks?.find(n => n.id === selectedNotebookId)} 
            notes={notes}
            isSearchingWorkspace={isSearchingWorkspace}
            setIsSearchingWorkspace={setIsSearchingWorkspace}
            foldersByNotebook={foldersByNotebook}
            setFoldersByNotebook={setFoldersByNotebook}
          />
          <RecentlyClosedSection 
            notes={notes} 
            closedNotes={closedNotes} 
            onRemove={removeClosedNote} 
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
              onTaskClick={(task) => {
                if (task.noteId) {
                  notes.actions.selectNote(task.noteId);
                }
              }}
            />
          ) : (
            <div className={rightColStyles.sectionContainer}>
              <Calendar 
                events={calendarEvents}
              />
            </div>
          )}
        </div>
        {isWorkspaceExpanded && (
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
