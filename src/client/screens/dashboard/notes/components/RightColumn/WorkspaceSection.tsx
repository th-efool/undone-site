import { ChevronRight, FileText, LayoutGrid, ChevronDown, Plus, MoreHorizontal } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { SearchBar } from '@/src/client/components/global/SearchBar';
import styles from './RightColumn.module.css';
import type { useNotes } from '../../hooks/useNotes';

type NotesContextType = ReturnType<typeof useNotes>;

interface WorkspaceSectionProps {
  notes: NotesContextType;
  workspaceSearch?: string;
  setWorkspaceSearch?: (val: string) => void;
  isSearchingWorkspace?: boolean;
  foldersByNotebook?: Record<string, { id: string, title: string, isOpen: boolean }[]>;
  setFoldersByNotebook?: React.Dispatch<React.SetStateAction<Record<string, { id: string, title: string, isOpen: boolean }[]>>>;
  noteFolderMap?: Record<string, string>;
  setNoteFolderMap?: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}

export function WorkspaceSection(props: WorkspaceSectionProps) {
  const { notes: notesContext, workspaceSearch, setWorkspaceSearch, isSearchingWorkspace, foldersByNotebook, setFoldersByNotebook, noteFolderMap, setNoteFolderMap } = props;
  const { data, state, actions } = notesContext;
  
  const [isSectionExpanded, setIsSectionExpanded] = useState(true);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderTitle, setEditingFolderTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = () => setActiveMenuId(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const selectedNotebookId = state?.selectedNotebookId;
  const currentFolders = (selectedNotebookId && foldersByNotebook?.[selectedNotebookId]) || [];
  
  let notes = data?.notes.filter((n: any) => n.notebookId === selectedNotebookId) || [];
  
  if (workspaceSearch && workspaceSearch.trim() !== '') {
    notes = notes.filter((n: any) => n.title.toLowerCase().includes(workspaceSearch.toLowerCase()));
  }

  const folderNotes: Record<string, any[]> = {};
  currentFolders.forEach((f: any) => {
    folderNotes[f.id] = [];
  });
  const rootNotes: any[] = [];

  notes.forEach((note: any) => {
    const folderId = noteFolderMap?.[note.id];
    if (folderId && folderNotes[folderId]) {
      folderNotes[folderId].push(note);
    } else {
      rootNotes.push(note);
    }
  });

  const renderNote = (note: any, depth: number = 0) => (
    <div key={note.id} className={styles.treeItemWrapper}
         draggable
         onDragStart={(e) => {
           e.dataTransfer.setData('text/plain', note.id);
           e.dataTransfer.effectAllowed = 'move';
         }}
    >
      <div 
        className={`${styles.treeItem} ${state?.selectedNoteId === note.id ? styles.selected : ''}`}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={() => actions.selectNote(note.id)}
        onDoubleClick={(e) => handleDoubleClick(note, e)}
      >
        <span className={styles.chevronSpacer} />
        <span className={styles.treeIcon}><FileText size={14} /></span>
        {editingNoteId === note.id ? (
          <input
            ref={inputRef}
            value={editingTitle}
            onChange={(e) => setEditingTitle(e.target.value)}
            onBlur={() => handleSaveRename(note.id)}
            onKeyDown={(e) => handleKeyDown(e, note.id)}
            className={`${styles.nodeLabel} ${styles.renameInput}`}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className={styles.nodeLabel}>{note.title}</span>
        )}

        <div className={styles.popoverContainer}>
          <div className={styles.moreIcon} onClick={(e) => { e.stopPropagation(); setActiveMenuId(`note-${note.id}`); }}>
            <MoreHorizontal size={14} />
          </div>
          {activeMenuId === `note-${note.id}` && (
            <div className={styles.popoverMenu} onClick={(e) => e.stopPropagation()}>
              <button className={styles.popoverItem} onClick={() => { setEditingNoteId(note.id); setEditingTitle(note.title); setActiveMenuId(null); }}>
                Rename
              </button>
              <button className={styles.popoverItem} onClick={() => { alert('Copy Note'); setActiveMenuId(null); }}>Copy</button>
              <button className={styles.popoverItem} onClick={() => { alert('Cut Note'); setActiveMenuId(null); }}>Cut</button>
              <button className={`${styles.popoverItem} ${styles.danger}`} onClick={() => { actions.deleteNote(note.id); setActiveMenuId(null); }}>
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const handleDoubleClick = (note: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingNoteId(note.id);
    setEditingTitle(note.title);
  };

  const handleSaveRename = (noteId: string) => {
    if (editingTitle.trim()) {
      actions.patchNote(noteId, { title: editingTitle.trim() });
    }
    setEditingNoteId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent, noteId: string) => {
    if (e.key === 'Enter') {
      handleSaveRename(noteId);
    } else if (e.key === 'Escape') {
      setEditingNoteId(null);
    }
  };

  useEffect(() => {
    if (editingNoteId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingNoteId]);

  return (
    <div className={styles.sectionContainer}>
      <header className={styles.sectionHeader} onClick={() => setIsSectionExpanded(!isSectionExpanded)}>
        <span className={styles.sectionChevron}>
          {isSectionExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </span>
        <span className={styles.sectionTitle}>Workspace</span>
        <button 
          className={styles.addNoteButton} 
          onClick={(e) => {
            e.stopPropagation();
            if (state?.selectedNotebookId) {
              actions.createNote(state.selectedNotebookId);
            }
          }}
          title="New Note"
        >
          <Plus size={14} />
        </button>
      </header>
      
      {isSectionExpanded && (
        <div className={styles.sectionListContainer}>
          <div className={styles.workspaceTree}
               onDragOver={(e) => e.preventDefault()}
               onDrop={(e) => {
                 e.preventDefault();
                 const noteId = e.dataTransfer.getData('text/plain');
                 if (noteId && setNoteFolderMap) {
                   setNoteFolderMap(prev => {
                     const next = { ...prev };
                     delete next[noteId];
                     return next;
                   });
                 }
               }}
          >
            {isSearchingWorkspace && (
              <div style={{ padding: '8px' }}>
                <SearchBar 
                  value={workspaceSearch || ''} 
                  onChange={(val) => setWorkspaceSearch?.(val)} 
                  placeholder="Search workspace..." 
                />
              </div>
            )}
            
            {currentFolders.map((folder: any) => (
              <div key={folder.id} className={styles.folderWrapper}
                   onDragOver={(e) => e.preventDefault()}
                   onDrop={(e) => {
                     e.preventDefault();
                     e.stopPropagation();
                     const noteId = e.dataTransfer.getData('text/plain');
                     if (noteId && setNoteFolderMap) {
                       setNoteFolderMap(prev => ({...prev, [noteId]: folder.id}));
                     }
                   }}
              >
                <div 
                  className={styles.treeItem} 
                  style={{ paddingLeft: '8px', cursor: 'pointer' }}
                  onClick={() => {
                    if (setFoldersByNotebook && selectedNotebookId) {
                      setFoldersByNotebook(prev => {
                        const folders = prev[selectedNotebookId] || [];
                        return {
                          ...prev,
                          [selectedNotebookId]: folders.map(f => f.id === folder.id ? { ...f, isOpen: !f.isOpen } : f)
                        };
                      });
                    }
                  }}
                >
                  <span className={styles.sectionChevron} style={{ width: '16px', display: 'flex', alignItems: 'center' }}>
                    {folder.isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </span>
                  
                  {editingFolderId === folder.id ? (
                    <input
                      value={editingFolderTitle}
                      onChange={(e) => setEditingFolderTitle(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      onBlur={() => {
                        if (setFoldersByNotebook && selectedNotebookId) {
                          setFoldersByNotebook(prev => ({
                            ...prev,
                            [selectedNotebookId]: prev[selectedNotebookId].map(f => f.id === folder.id ? { ...f, title: editingFolderTitle } : f)
                          }));
                        }
                        setEditingFolderId(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                        if (e.key === 'Escape') setEditingFolderId(null);
                      }}
                      className={`${styles.nodeLabel} ${styles.renameInput}`}
                      autoFocus
                    />
                  ) : (
                    <span className={styles.nodeLabel}>{folder.title}</span>
                  )}

                  <div className={styles.popoverContainer}>
                    <div className={styles.moreIcon} onClick={(e) => { e.stopPropagation(); setActiveMenuId(`folder-${folder.id}`); }}>
                      <MoreHorizontal size={14} />
                    </div>
                    {activeMenuId === `folder-${folder.id}` && (
                      <div className={styles.popoverMenu} onClick={(e) => e.stopPropagation()}>
                        <button className={styles.popoverItem} onClick={() => { setEditingFolderId(folder.id); setEditingFolderTitle(folder.title); setActiveMenuId(null); }}>
                          Rename
                        </button>
                        <button className={`${styles.popoverItem} ${styles.danger}`} onClick={() => {
                          if (setFoldersByNotebook && selectedNotebookId) {
                            setFoldersByNotebook(prev => ({
                              ...prev,
                              [selectedNotebookId]: prev[selectedNotebookId].filter(f => f.id !== folder.id)
                            }));
                          }
                          setActiveMenuId(null);
                        }}>
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                {folder.isOpen && (
                  <div className={styles.folderContent}>
                    {folderNotes[folder.id]?.map(note => renderNote(note, 1))}
                  </div>
                )}
              </div>
            ))}
            
            {rootNotes.map(note => renderNote(note, 0))}

            {notes.length === 0 && (
              <div className={styles.emptyState}>No notes in this notebook</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
