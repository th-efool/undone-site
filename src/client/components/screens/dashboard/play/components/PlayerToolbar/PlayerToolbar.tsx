import { CheckCircle2 } from 'lucide-react';
import { Tooltip } from '@/src/client/components/ui/Tooltip';
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
      <Tooltip content="Mark lesson completed" placement="left">
        <button className={styles.button} onClick={onComplete} aria-label="Mark lesson completed">
          <CheckCircle2 size={18} />
        </button>
      </Tooltip>

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

