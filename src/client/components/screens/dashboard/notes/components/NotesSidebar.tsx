import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, LayoutGrid, Menu, Pin, Star, Share, Trash2, PanelLeft, PanelLeftOpen } from 'lucide-react';
import { TopBar } from './RightColumn/TopBar';
import { SpaceHeader } from './RightColumn/SpaceHeader';
import { TasksSection } from './RightColumn/TasksSection';
import { WorkspaceSection } from './RightColumn/WorkspaceSection';
import { Calendar } from '@/src/client/components/ui/Calendar';
import styles from './NotesSidebar.module.css';
import rightColStyles from './RightColumn/RightColumn.module.css';

const CHANNELS = [
  'Machine Learning',
  'Anytype Community',
  'System Design',
  'Expat Community',
  'Zuri',
  'Deja',
  'Mochi',
  'Andy',
  'Any Documentation',
  'azk',
  'AnyCreator',
  'Anytype Demo',
];

export function NotesSidebar({
  isNavigationExpanded,
  setIsNavigationExpanded,
  isWorkspaceExpanded,
  setIsWorkspaceExpanded,
}: {
  isNavigationExpanded: boolean;
  setIsNavigationExpanded: (v: boolean) => void;
  isWorkspaceExpanded: boolean;
  setIsWorkspaceExpanded: (v: boolean) => void;
}) {
  const [selectedChannel, setSelectedChannel] = useState('Machine Learning');
  
  const [navWidth, setNavWidth] = useState(290);
  const [workspaceWidth, setWorkspaceWidth] = useState(310);
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
                  <button className={styles.iconButton}>
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
            <div className={styles.searchInputWrapper}>
              <Search className={styles.searchIcon} />
              <input 
                type="text" 
                placeholder="Filter channels..." 
                className={styles.searchInput}
              />
            </div>
          </div>

          {/* 3 & 4. Channel List */}
          <div className={styles.channelList}>
            {CHANNELS.map((channel, idx) => (
              <div 
                key={channel} 
                className={`${styles.channelItem} ${selectedChannel === channel ? styles.selected : ''}`}
                onClick={() => setSelectedChannel(channel)}
              >
                <div className={styles.avatar} style={{ backgroundColor: `hsl(${idx * 30}, 60%, 50%)` }}>
                  {channel.charAt(0)}
                </div>
                <span className={styles.channelName}>{channel}</span>
                <Pin className={styles.pinIcon} />
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
          <SpaceHeader />
          <TasksSection />
          <WorkspaceSection />
          <div className={rightColStyles.sectionContainer}>
            <Calendar 
              events={[
                { day: 5, tone: 'purple' },
                { day: 8, tone: 'orange' },
                { day: 12, tone: 'blue' },
                { day: 18, tone: 'green' },
                { day: 24, tone: 'red' },
              ]}
            />
          </div>
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
