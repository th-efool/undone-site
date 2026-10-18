'use client';

import React from 'react';
import { Camera, Edit3, Mic, Bookmark } from 'lucide-react';
import { triggerHaptic } from '@/src/client/utils/haptics';
import styles from './PlayToolsRail.module.css';

interface PlayToolsRailProps {
  bookmarked: boolean;
  onToggleBookmark: () => void;
}

export function PlayToolsRail({ bookmarked, onToggleBookmark }: PlayToolsRailProps) {
  const handleBookmarkClick = () => {
    triggerHaptic('medium');
    onToggleBookmark();
  };

  return (
    <aside className={styles.rail} aria-label="Learning Tools Rail">
      {/* 1. Camera / Capture - Deferred Placeholder */}
      <button
        type="button"
        className={`${styles.toolButton} ${styles.toolButtonDisabled}`}
        aria-label="Capture screen or visual snapshot (coming soon)"
        aria-disabled="true"
        title="Screen capture is coming soon"
        disabled
      >
        <Camera size={20} strokeWidth={1.8} />
      </button>

      {/* 2. Pen / Annotations - Deferred Placeholder */}
      <button
        type="button"
        className={`${styles.toolButton} ${styles.toolButtonDisabled}`}
        aria-label="Annotate lesson (coming soon)"
        aria-disabled="true"
        title="Annotation tools are coming soon"
        disabled
      >
        <Edit3 size={20} strokeWidth={1.8} />
      </button>

      {/* 3. Mic / Voice Notes - Deferred Placeholder */}
      <button
        type="button"
        className={`${styles.toolButton} ${styles.toolButtonDisabled}`}
        aria-label="Record voice note (coming soon)"
        aria-disabled="true"
        title="Microphone voice notes are coming soon"
        disabled
      >
        <Mic size={20} strokeWidth={1.8} />
      </button>

      {/* 4. Bookmark - Working Toggle */}
      <button
        type="button"
        className={`${styles.toolButton} ${bookmarked ? styles.toolButtonBookmarked : ''}`}
        aria-label={bookmarked ? 'Remove bookmark' : 'Bookmark this chunk'}
        title={bookmarked ? 'Remove bookmark' : 'Bookmark this chunk'}
        onClick={handleBookmarkClick}
      >
        <Bookmark
          size={20}
          strokeWidth={1.8}
          fill={bookmarked ? 'currentColor' : 'none'}
        />
      </button>
    </aside>
  );
}
