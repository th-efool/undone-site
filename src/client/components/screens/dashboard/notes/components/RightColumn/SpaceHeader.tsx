import { ChevronDown, Search, Layout, SquarePen, FolderPlus } from 'lucide-react';
import styles from './RightColumn.module.css';

interface SpaceHeaderProps {
  notebook?: {
    title: string;
    id: string;
  };
  notes?: any;
  isSearchingWorkspace?: boolean;
  setIsSearchingWorkspace?: (val: boolean) => void;
  foldersByNotebook?: Record<string, { id: string, title: string, isOpen: boolean }[]>;
  setFoldersByNotebook?: React.Dispatch<React.SetStateAction<Record<string, { id: string, title: string, isOpen: boolean }[]>>>;
}

export function SpaceHeader({ notebook, notes, isSearchingWorkspace, setIsSearchingWorkspace, foldersByNotebook, setFoldersByNotebook }: SpaceHeaderProps) {
  const handleAddFolder = () => {
    if (!notebook?.id || !setFoldersByNotebook) return;
    setFoldersByNotebook(prev => {
      const currentFolders = prev[notebook.id] || [];
      const newFolder = {
        id: `folder-${Date.now()}`,
        title: 'New Folder',
        isOpen: true
      };
      return {
        ...prev,
        [notebook.id]: [...currentFolders, newFolder]
      };
    });
  };

  const title = notebook?.title || 'Any Possibilities';
  const initial = title.charAt(0).toUpperCase();
  
  // Create a consistent color based on the title (similar to what NotesSidebar does)
  const idx = notebook?.title ? notebook.title.charCodeAt(0) % 12 : 0;
  const bgColor = `hsl(${idx * 30}, 60%, 50%)`;

  return (
    <>
      <div className={styles.spaceHeader}>
        <div className={styles.spaceIconContainer}>
          <div 
            className={styles.spaceIcon} 
            style={notebook ? { backgroundColor: bgColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold' } : undefined}
          >
            {notebook ? initial : ''}
          </div>
        </div>
        <div className={styles.spaceInfo}>
          <h1 className={styles.spaceTitle}>
            {title}
            <ChevronDown size={18} className={styles.titleChevron} />
          </h1>
          <div className={styles.spaceActions}>
            <button className={styles.iconButton} aria-label="New note" onClick={() => notebook?.id && notes?.actions?.createNote(notebook.id)}>
              <SquarePen size={16} />
            </button>
            <button className={styles.iconButton} aria-label="New Kanban Board" onClick={() => notebook?.id && notes?.actions?.createNote(notebook.id, { title: 'New Board', contentType: 'kanban' })}>
              <Layout size={16} />
            </button>
            <button className={styles.iconButton} aria-label="New folder" onClick={handleAddFolder}>
              <FolderPlus size={16} />
            </button>
            <button className={styles.iconButton} aria-label="Search" onClick={() => setIsSearchingWorkspace?.(!isSearchingWorkspace)}>
              <Search size={16} />
            </button>

          </div>
        </div>
      </div>
    </>
  );
}
