'use client';

import { useState, useMemo } from 'react';
import { ArrowLeft, Plus, LayoutGrid, CheckSquare, FileText, Search, Layout, SquarePen, FolderPlus, ChevronDown, ChevronRight, X, Calendar as CalendarIcon, MoreHorizontal, Circle, CheckCircle2 } from 'lucide-react';
import type { UseNotesResult } from '@/src/client/screens/dashboard/notes/hooks/useNotes';
import { useRecentlyClosedNotes } from '@/src/client/screens/dashboard/notes/hooks/useRecentlyClosedNotes';
import { Calendar } from '@/src/client/components/ui/Calendar';
import styles from '../NotesMobile.module.css';

interface WorkspaceScreenProps {
  notes: UseNotesResult;
  onBack: () => void;
  onSelectNote: (noteId: string) => void;
}

interface Task {
  id: number;
  title: string;
  date: string;
  status: 'completed' | 'pending';
  noteId?: string;
}

export function WorkspaceScreen({ notes, onBack, onSelectNote }: WorkspaceScreenProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'tasks' | 'calendar'>('tasks');
  const [workspaceSearch, setWorkspaceSearch] = useState('');
  const [isSearchingWorkspace, setIsSearchingWorkspace] = useState(false);
  const [foldersByNotebook, setFoldersByNotebook] = useState<Record<string, { id: string, title: string, isOpen: boolean }[]>>({});
  const [noteFolderMap, setNoteFolderMap] = useState<Record<string, string>>({});

  const selectedNotebook = notes.data?.selectedNotebook ?? null;
  const selectedNotebookId = selectedNotebook?.id;
  
  // State for recently closed
  const selectedNoteId = notes.data?.selectedNote?.id ?? null;
  const selectedNoteTitle = notes.data?.selectedNote?.title;
  const { closedNotes, removeClosedNote } = useRecentlyClosedNotes(selectedNoteId, selectedNoteTitle);

  const notesInNotebook = (notes.state?.notes ?? []).filter(
    (n) => n.notebookId === selectedNotebookId && !n.archived,
  );

  let filteredNotes = notesInNotebook;
  if (workspaceSearch.trim()) {
    filteredNotes = filteredNotes.filter((n) => n.title?.toLowerCase().includes(workspaceSearch.toLowerCase()));
  }

  // Derive tasks
  const currentTasks = useMemo(() => {
    if (!selectedNotebookId) return [];
    
    const notebookNotes = notes.state?.notes?.filter(n => n.notebookId === selectedNotebookId && !n.archived && n.contentType === 'kanban') || [];
    
    const now = new Date();
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
            if (!isNaN(date.getTime()) && date >= weekStart && date <= weekEnd) {
              const formattedDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
        });
      }
    });
    return aggregated.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [selectedNotebookId, notes.state?.notes]);

  const calendarEvents = useMemo(() => {
    return currentTasks.map(t => {
      const match = t.date.match(/\d+/);
      return {
        day: match ? parseInt(match[0], 10) : 1,
        tone: (t.status === 'completed' ? 'green' : 'orange') as 'green' | 'orange'
      };
    });
  }, [currentTasks]);

  const handleSelectNote = (noteId: string) => {
    notes.actions.selectNote(noteId);
    onSelectNote(noteId);
  };

  const handleCreateNote = (contentType: 'canvas' | 'kanban', title?: string) => {
    setSheetOpen(false);
    notes.actions.createNote(selectedNotebook?.id, { contentType, title });
  };

  const handleAddFolder = () => {
    if (!selectedNotebookId) return;
    setFoldersByNotebook(prev => {
      const current = prev[selectedNotebookId] || [];
      return {
        ...prev,
        [selectedNotebookId]: [...current, { id: `folder-${Date.now()}`, title: 'New Folder', isOpen: true }]
      };
    });
  };

  const toggleTaskStatus = (id: number) => {
     // Local state mutation for visual feedback (since desktop TasksSection skips Kanban syncing)
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  // Group notes into folders
  const currentFolders = (selectedNotebookId && foldersByNotebook[selectedNotebookId]) || [];
  const folderNotes: Record<string, any[]> = {};
  currentFolders.forEach(f => folderNotes[f.id] = []);
  const rootNotes: any[] = [];

  filteredNotes.forEach(note => {
    const folderId = noteFolderMap[note.id];
    if (folderId && folderNotes[folderId]) {
      folderNotes[folderId].push(note);
    } else {
      rootNotes.push(note);
    }
  });

  const idx = selectedNotebook?.title ? selectedNotebook.title.charCodeAt(0) % 12 : 0;
  const bgColor = `hsl(${idx * 30}, 60%, 50%)`;
  const initial = selectedNotebook?.title ? selectedNotebook.title.charAt(0).toUpperCase() : '';

  return (
    <div className={styles.screen}>
      <header className={styles.screenHeader}>
        <button className={styles.backBtn} onClick={onBack} aria-label="Back to notebooks">
          <ArrowLeft size={18} />
          <span>Notebooks</span>
        </button>
        <div style={{ flex: 1 }} />
      </header>

      <div className={styles.listScroll}>
        {/* Space Header (Hero) */}
        <div className={styles.spaceHeader}>
          <div className={styles.spaceHeaderIcon} style={{ backgroundColor: bgColor }}>
            {initial}
          </div>
          <h1 className={styles.spaceHeaderTitle}>{selectedNotebook?.title ?? 'Notebook'}</h1>
          <div className={styles.spaceHeaderActions}>
             <button className={styles.spaceActionBtn} onClick={() => setIsSearchingWorkspace(!isSearchingWorkspace)}>
                <div className={styles.spaceActionIcon}><Search size={20} /></div>
                <span className={styles.spaceActionLabel}>Search</span>
             </button>
             <button className={styles.spaceActionBtn} onClick={handleAddFolder}>
                <div className={styles.spaceActionIcon}><FolderPlus size={20} /></div>
                <span className={styles.spaceActionLabel}>Folder</span>
             </button>
             <button className={styles.spaceActionBtn} onClick={() => handleCreateNote('canvas', 'New Note')}>
                <div className={styles.spaceActionIcon}><SquarePen size={20} /></div>
                <span className={styles.spaceActionLabel}>Note</span>
             </button>
             <button className={styles.spaceActionBtn} onClick={() => handleCreateNote('kanban', 'New Board')}>
                <div className={styles.spaceActionIcon}><Layout size={20} /></div>
                <span className={styles.spaceActionLabel}>Kanban</span>
             </button>
          </div>
        </div>

        {isSearchingWorkspace && (
          <div className={styles.searchRow}>
            <div className={styles.searchWrap}>
              <Search size={16} className={styles.searchIcon} />
              <input
                className={styles.searchInput}
                placeholder="Search notes..."
                value={workspaceSearch}
                onChange={(e) => setWorkspaceSearch(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Recently Closed */}
        {closedNotes.length > 0 && (
          <div style={{ margin: '8px 0' }}>
            <div style={{ padding: '0 16px', fontSize: '13px', fontWeight: 600, color: '#71717a', textTransform: 'uppercase' }}>
              Recently Closed
            </div>
            <div className={styles.recentlyClosedList}>
              {closedNotes.map(note => (
                <div key={note.id} className={styles.recentPill} onClick={() => handleSelectNote(note.id)}>
                  <FileText size={14} />
                  <span>{note.title}</span>
                  <div 
                    className={styles.recentPillClose}
                    onClick={(e) => { e.stopPropagation(); removeClosedNote(note.id); }}
                  >
                    <X size={14} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Workspace Notes & Folders */}
        <div className={styles.accordionSection}>
           <div className={styles.accordionHeader}>
             Workspace
             <button onClick={() => setSheetOpen(true)} style={{ background: 'none', border: 'none', color: '#f4f4f5', padding: 0 }}>
               <Plus size={18} />
             </button>
           </div>
           <div className={styles.accordionContent}>
             {currentFolders.map(folder => (
               <div key={folder.id}>
                 <div 
                   className={styles.folderItem}
                   onClick={() => setFoldersByNotebook(prev => ({
                     ...prev,
                     [selectedNotebookId!]: prev[selectedNotebookId!].map(f => f.id === folder.id ? { ...f, isOpen: !f.isOpen } : f)
                   }))}
                 >
                   {folder.isOpen ? <ChevronDown size={18} color="#a1a1aa" /> : <ChevronRight size={18} color="#a1a1aa" />}
                   <span style={{ fontSize: '15px', color: '#f4f4f5', flex: 1 }}>{folder.title}</span>
                   <MoreHorizontal size={18} color="#a1a1aa" />
                 </div>
                 {folder.isOpen && folderNotes[folder.id]?.map(note => (
                   <button
                     key={note.id}
                     className={styles.noteItem}
                     style={{ paddingLeft: '44px', borderBottom: '1px solid rgba(255, 255, 255, 0.03)' }}
                     onClick={() => handleSelectNote(note.id)}
                   >
                     <div className={styles.noteTypeIcon} style={{ width: 28, height: 28 }}>
                       {note.contentType === 'kanban' ? (
                         <CheckSquare size={14} color="#8b5cf6" />
                       ) : (
                         <LayoutGrid size={14} color="#0ea5e9" />
                       )}
                     </div>
                     <div className={styles.noteItemInfo}>
                       <span className={styles.noteItemTitle}>{note.title || 'Untitled Note'}</span>
                     </div>
                   </button>
                 ))}
               </div>
             ))}

             {rootNotes.map((note) => (
               <button
                 key={note.id}
                 className={styles.noteItem}
                 onClick={() => handleSelectNote(note.id)}
                 style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.03)' }}
               >
                 <div className={styles.noteTypeIcon}>
                   {note.contentType === 'kanban' ? (
                     <CheckSquare size={18} color="#8b5cf6" />
                   ) : (
                     <LayoutGrid size={18} color="#0ea5e9" />
                   )}
                 </div>
                 <div className={styles.noteItemInfo}>
                   <span className={styles.noteItemTitle}>{note.title || 'Untitled Note'}</span>
                   <span className={styles.noteItemMeta}>
                     {note.contentType === 'kanban' ? 'Kanban' : 'Canvas'} •{' '}
                     {formatDate(note.updatedAt)}
                   </span>
                 </div>
               </button>
             ))}

             {notesInNotebook.length === 0 && (
               <div className={styles.emptyState} style={{ padding: '40px 20px' }}>
                 <p className={styles.emptyTitle}>No notes yet</p>
                 <p className={styles.emptySubtitle}>Tap + to add a canvas or kanban note</p>
               </div>
             )}
           </div>
        </div>

        {/* Segmented Control for Tasks/Calendar */}
        <div className={styles.segmentControl}>
          <button 
            className={`${styles.segmentBtn} ${activeTab === 'tasks' ? styles.active : ''}`}
            onClick={() => setActiveTab('tasks')}
          >
            <CheckSquare size={16} /> Tasks
          </button>
          <button 
            className={`${styles.segmentBtn} ${activeTab === 'calendar' ? styles.active : ''}`}
            onClick={() => setActiveTab('calendar')}
          >
            <CalendarIcon size={16} /> Calendar
          </button>
        </div>

        {activeTab === 'tasks' ? (
          <div className={styles.accordionSection}>
             <div className={styles.accordionContent}>
               {currentTasks.length === 0 ? (
                 <div style={{ padding: '20px', textAlign: 'center', color: '#71717a', fontSize: '13px' }}>
                   No tasks for this week
                 </div>
               ) : (
                 currentTasks.map(task => (
                   <div key={task.id} className={styles.nativeTaskItem} onClick={() => task.noteId && handleSelectNote(task.noteId)}>
                     <div 
                        className={`${styles.taskCheckbox} ${task.status === 'completed' ? styles.completed : ''}`}
                        onClick={(e) => { e.stopPropagation(); toggleTaskStatus(task.id); }}
                      >
                       {task.status === 'completed' ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                     </div>
                     <div className={styles.taskContent}>
                       <span className={`${styles.taskTitle} ${task.status === 'completed' ? styles.completed : ''}`}>{task.title}</span>
                       <span className={styles.taskDate}>{task.date}</span>
                     </div>
                   </div>
                 ))
               )}
             </div>
          </div>
        ) : (
          <div className={styles.accordionSection} style={{ padding: '16px' }}>
             <Calendar events={calendarEvents} />
          </div>
        )}
      </div>

      {/* New note bottom sheet */}
      {sheetOpen && (
        <>
          <div className={styles.sheetOverlay} onClick={() => setSheetOpen(false)} />
          <div className={styles.bottomSheet}>
            <div className={styles.sheetHandle} />
            <p className={styles.sheetTitle}>New note type</p>
            <button
              className={styles.sheetOption}
              onClick={() => handleCreateNote('canvas')}
            >
              <LayoutGrid size={20} color="#0ea5e9" />
              <div>
                <span className={styles.sheetOptionTitle}>Canvas note</span>
                <span className={styles.sheetOptionSub}>Excalidraw freeform canvas</span>
              </div>
            </button>
            <button
              className={styles.sheetOption}
              onClick={() => handleCreateNote('kanban')}
            >
              <CheckSquare size={20} color="#8b5cf6" />
              <div>
                <span className={styles.sheetOptionTitle}>Kanban board</span>
                <span className={styles.sheetOptionSub}>Task columns with cards</span>
              </div>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
