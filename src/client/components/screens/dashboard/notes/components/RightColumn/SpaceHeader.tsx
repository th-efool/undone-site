import { ChevronDown, Search, ExternalLink, MoreHorizontal, SquarePen, FolderPlus } from 'lucide-react';
import styles from './RightColumn.module.css';

export function SpaceHeader() {
  return (
    <>
      <div className={styles.spaceHeader}>
        <div className={styles.spaceIconContainer}>
          <div className={styles.spaceIcon} />
        </div>
        <div className={styles.spaceInfo}>
          <h1 className={styles.spaceTitle}>
            Any Possibilities
            <ChevronDown size={18} className={styles.titleChevron} />
          </h1>
          <div className={styles.spaceActions}>
            <button className={styles.iconButton} aria-label="New note">
              <SquarePen size={16} />
            </button>
            <button className={styles.iconButton} aria-label="New folder">
              <FolderPlus size={16} />
            </button>
            <button className={styles.iconButton} aria-label="Search">
              <Search size={16} />
            </button>
            <button className={styles.iconButton} aria-label="Open externally">
              <ExternalLink size={16} />
            </button>
            <button className={styles.iconButton} aria-label="More options">
              <MoreHorizontal size={16} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
