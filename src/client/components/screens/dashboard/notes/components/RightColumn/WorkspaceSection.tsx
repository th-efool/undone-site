import { FileText, ChevronRight, ChevronDown, Plus } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import styles from './RightColumn.module.css';
import { useNotes } from '../../hooks/useNotes';

import type { useNotes } from '../../hooks/useNotes';

type NotesContextType = ReturnType<typeof useNotes>;

export function WorkspaceSection({ notes: { data, state, actions } }: { notes: NotesContextType }) {
  const [isSectionExpanded, setIsSectionExpanded] = useState(true);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // 1. Fetch notes associated with the currently selected notebook
  const notes = data?.notes.filter(n => n.notebookId === state?.selectedNotebookId) || [];

  // 4. Double-Click to Rename handler
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
        {/* 3. '+' button in SpaceHeader/WorkspaceSection */}
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
          <div className={styles.workspaceTree}>
            {/* 2. Dynamically rendered list of notes (flat list) */}
            {notes.map(note => (
              <div key={note.id} className={styles.treeItemWrapper}>
                <div 
                  className={`${styles.treeItem} ${state?.selectedNoteId === note.id ? styles.selected : ''}`}
                  style={{ paddingLeft: '8px' }}
                  onClick={() => actions.selectNote(note.id)} // 5. Note selection
                  onDoubleClick={(e) => handleDoubleClick(note, e)}
                >
                  <span className={styles.chevronSpacer} />
                  
                  <span className={styles.treeIcon}>
                    <FileText size={14} />
                  </span>
                  
                  {editingNoteId === note.id ? (
                    <input
                      ref={inputRef}
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onBlur={() => handleSaveRename(note.id)}
                      onKeyDown={(e) => handleKeyDown(e, note.id)}
                      className={styles.renameInput}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span className={styles.treeName}>{note.title}</span>
                  )}
                </div>
              </div>
            ))}
            {notes.length === 0 && (
              <div className={styles.emptyState}>No notes in this notebook</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
