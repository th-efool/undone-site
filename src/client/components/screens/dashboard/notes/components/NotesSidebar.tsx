import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, LayoutGrid, Menu, Pin, Star, Share, Trash2, PanelLeft, PanelLeftOpen, CheckSquare, Calendar as CalendarIcon, MoreHorizontal } from 'lucide-react';
import { TopBar } from './RightColumn/TopBar';
import { SpaceHeader } from './RightColumn/SpaceHeader';
import { TasksSection } from './RightColumn/TasksSection';
import type { Task } from './RightColumn/TasksSection';
import { WorkspaceSection } from './RightColumn/WorkspaceSection';
import { Calendar } from '@/src/client/components/ui/Calendar';
import { SearchBar } from '@/src/client/components/global/SearchBar';
import styles from './NotesSidebar.module.css';
import rightColStyles from './RightColumn/RightColumn.module.css';

import type { useNotes } from '../hooks/useNotes';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  const notebooks = notes.data?.notebooks || [];
  const filteredNotebooks = notebooks.filter(nb => 
    nb.title.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const selectedNotebookId = notes.data?.selectedNotebook?.id;
  
  const [navWidth, setNavWidth] = useState(290);
  const [workspaceWidth, setWorkspaceWidth] = useState(310);
  const [activeTab, setActiveTab] = useState<'tasks' | 'calendar'>('tasks');

  const [tasksByNotebook, setTasksByNotebook] = useState<Record<string, Task[]>>({});

  const currentTasks = React.useMemo(() => {
    if (!selectedNotebookId) return [];
    if (!tasksByNotebook[selectedNotebookId]) {
      const title = notes.data?.notebooks?.find(n => n.id === selectedNotebookId)?.title || 'General';
      return [
        { id: Date.now() + 1, title: `Review ${title}`, date: 'Jun 5', status: 'pending' },
        { id: Date.now() + 2, title: `Update ${title} docs`, date: 'Jun 8', status: 'completed' },
      ] as Task[];
    }
    return tasksByNotebook[selectedNotebookId];
  }, [selectedNotebookId, tasksByNotebook, notes.data?.notebooks]);

  const setCurrentTasks = (newTasks: Task[]) => {
    if (selectedNotebookId) {
      setTasksByNotebook(prev => ({ ...prev, [selectedNotebookId]: newTasks }));
    }
  };

  const calendarEvents = React.useMemo(() => {
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
      const navOffset = isNavigationExpanded ? navWidth : 0;
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
  }, [isDraggingWorkspace, isNavigationExpanded, navWidth, setIsWorkspaceExpanded]);

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
                    autoFocus
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
                    style={{ background: 'transparent', border: 'none', color: 'inherit', outline: 'none', width: '100%', fontSize: 'inherit', fontWeight: 'inherit', padding: 0 }}
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
                        notes.actions.patchNotebook(nb.id, { favorite: !(nb as any).favorite });
                      }
                      console.log('Star toggled for', nb.title);
                    }}
                  />
                  <div style={{ position: 'relative' }} className="popover-container">
                    <MoreHorizontal 
                      size={16} 
                      onClick={(e) => {
                        e.stopPropagation();
                        alert('Popover Actions:\n- Rename\n- Delete\n- Copy\n- Cut');
                      }}
                    />
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
          <TopBar />
          <SpaceHeader notebook={notes.data?.notebooks?.find(n => n.id === selectedNotebookId)} notes={notes} />
          <WorkspaceSection notes={notes} />

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
            <TasksSection tasks={currentTasks} setTasks={setCurrentTasks} />
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
