import { CheckCircle2 } from 'lucide-react';
import {
  BookmarkButton,
  PlaybackSpeed,
} from './components';

import styles from './PlayerToolbar.module.css';

export interface PlayerToolbarProps {
  playbackSpeed: number;
  bookmarked: boolean;
  onBookmark?: () => void;
  onSpeed?: () => void;
  onComplete?: () => void;
}

export function PlayerToolbar({
  playbackSpeed,
  bookmarked,
  onBookmark = () => {},
  onSpeed = () => {},
  onComplete = () => {},
}: PlayerToolbarProps) {
  return (
    <aside className={styles.toolbar}>
      <button className={styles.button} onClick={onComplete} title="Mark Done">
        <CheckCircle2 size={18} />
      </button>

      <BookmarkButton
        active={bookmarked}
        onClick={onBookmark}
      />

      <PlaybackSpeed
        value={playbackSpeed}
        onClick={onSpeed}
      />
    </aside>
  );
}
