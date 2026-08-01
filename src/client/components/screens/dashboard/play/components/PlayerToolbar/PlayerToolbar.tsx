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
}

export function PlayerToolbar({
  playbackSpeed,
  bookmarked,
  onBookmark = () => {},
  onSpeed = () => {},
}: PlayerToolbarProps) {
  return (
    <aside className={styles.toolbar}>
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
