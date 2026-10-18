import React from 'react';
import styles from './Skeleton.module.css';

export function NotesSkeleton() {
  return (
    <div className={styles.notesSkeletonShell} aria-busy="true" aria-label="Loading notes workspace">
      {/* Column 1: Notebooks sidebar */}
      <div className={styles.notesSidebarSkeleton} data-testid="notes-sidebar-skeleton">
        <div className={styles.skeletonLine} style={{ width: '60%', height: '24px', marginBottom: '16px' }} />
        <div className={styles.skeletonBlock} style={{ height: '40px', marginBottom: '8px' }} />
        <div className={styles.skeletonBlock} style={{ height: '40px', marginBottom: '8px' }} />
        <div className={styles.skeletonBlock} style={{ height: '40px', marginBottom: '8px' }} />
        <div className={styles.skeletonBlock} style={{ height: '40px' }} />
      </div>

      {/* Column 2: Notes list */}
      <div className={styles.notesListSkeleton} data-testid="notes-list-skeleton">
        <div className={styles.skeletonLine} style={{ width: '50%', height: '20px', marginBottom: '16px' }} />
        <div className={styles.skeletonBlock} style={{ height: '64px', marginBottom: '8px' }} />
        <div className={styles.skeletonBlock} style={{ height: '64px', marginBottom: '8px' }} />
        <div className={styles.skeletonBlock} style={{ height: '64px', marginBottom: '8px' }} />
        <div className={styles.skeletonBlock} style={{ height: '64px' }} />
      </div>

      {/* Column 3: Canvas / Editor workspace */}
      <div className={styles.notesCanvasSkeleton} data-testid="notes-canvas-skeleton">
        <div className={styles.skeletonLine} style={{ width: '40%', height: '32px', marginBottom: '24px' }} />
        <div className={styles.skeletonBlock} style={{ height: '100%', minHeight: '300px' }} />
      </div>
    </div>
  );
}
