import { ChevronDown, Search, ExternalLink, MoreHorizontal, SquarePen, FolderPlus } from 'lucide-react';
import styles from './RightColumn.module.css';

interface SpaceHeaderProps {
  notebook?: {
    title: string;
    id: string;
  };
  notes?: any;
}

export function SpaceHeader({ notebook, notes }: SpaceHeaderProps) {
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
            <button className={styles.iconButton} aria-label="New folder" onClick={() => alert('Folder creation not supported in this view.')}>
              <FolderPlus size={16} />
            </button>
            <button className={styles.iconButton} aria-label="Search" onClick={() => alert('Global Search triggered.')}>
              <Search size={16} />
            </button>
            <button className={styles.iconButton} aria-label="Open externally" onClick={() => alert('Share settings opened.')}>
              <ExternalLink size={16} />
            </button>
            <button className={styles.iconButton} aria-label="More options" onClick={() => alert('More Options opened.')}>
              <MoreHorizontal size={16} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
