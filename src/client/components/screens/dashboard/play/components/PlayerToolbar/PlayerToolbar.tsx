import {
  BookmarkButton,
  CaptureButton,
  PlaybackSpeed,
  ScribeButton,
  ToolbarMenu,
} from './components';

import type { PlayerTool } from '../../types/play';

import styles from './PlayerToolbar.module.css';

export interface PlayerToolbarProps {
  activeTool?: PlayerTool;

  playbackSpeed: number;

  bookmarked: boolean;

  onScribe?: () => void;

  onCapture?: () => void;

  onBookmark?: () => void;

  onSpeed?: () => void;

  onMenu?: () => void;
}

export function PlayerToolbar({
  activeTool = 'scribe',

  playbackSpeed,

  bookmarked,

  onScribe = () => {},

  onCapture = () => {},

  onBookmark = () => {},

  onSpeed = () => {},

  onMenu = () => {},
}: PlayerToolbarProps) {
  return (
    <aside className={styles.toolbar}>
      <ScribeButton
        active={activeTool === 'scribe'}
        onClick={onScribe}
      />

      <CaptureButton
        active={activeTool === 'capture'}
        onClick={onCapture}
      />

      <BookmarkButton
        active={bookmarked}
        onClick={onBookmark}
      />

      <PlaybackSpeed
        value={playbackSpeed}
        onClick={onSpeed}
      />

      <ToolbarMenu onClick={onMenu} />
    </aside>
  );
}
