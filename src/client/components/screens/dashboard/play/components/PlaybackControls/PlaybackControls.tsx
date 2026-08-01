'use client';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Maximize2,
  CheckCircle2,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';

import { VolumeControl } from './VolumeControl';
import styles from './PlaybackControls.module.css';

export interface PlaybackControlsProps {
  currentTime: string;
  totalDuration: string;
  volume: number;
  isPlaying: boolean;
  onPlayPause?: () => void;
  onSkipBack?: () => void;
  onSkipForward?: () => void;
  onVolumeChange?: (volume: number) => void;
  onFullscreen?: () => void;
  onCompleteChunk?: () => void;
  onNextChunk?: () => void;
  onPreviousChunk?: () => void;
  hasNext?: boolean;
  hasPrevious?: boolean;
}

export function PlaybackControls({
  currentTime = '00:00',
  totalDuration = '00:00',
  volume = 90,
  isPlaying = true,
  onPlayPause = () => {},
  onSkipBack = () => {},
  onSkipForward = () => {},
  onVolumeChange = () => {},
  onFullscreen = () => {},
  onCompleteChunk = () => {},
  onNextChunk = () => {},
  onPreviousChunk = () => {},
  hasNext = true,
  hasPrevious = false,
}: PlaybackControlsProps) {
  return (
    <div className={styles.controls}>
      <div className={styles.left}>
        <button
          className={styles.button}
          onClick={onPlayPause}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <Pause size={18} fill="currentColor" />
          ) : (
            <Play size={18} fill="currentColor" />
          )}
        </button>

        <button
          className={styles.button}
          onClick={onSkipBack}
          aria-label="Rewind 10 seconds"
          title="Rewind 10s"
        >
          <RotateCcw size={16} />
        </button>

        <button
          className={styles.button}
          onClick={onSkipForward}
          aria-label="Forward 10 seconds"
          title="Forward 10s"
        >
          <RotateCw size={16} />
        </button>

        <span className={styles.time}>
          {currentTime} / {totalDuration}
        </span>
      </div>

      <div className={styles.center}>
        <button
          className={styles.doneBtn}
          onClick={onCompleteChunk}
          title="Mark chunk completed and advance"
        >
          <CheckCircle2 size={15} />
          Mark Done
        </button>

        <button
          className={styles.navBtn}
          onClick={onPreviousChunk}
          disabled={!hasPrevious}
          title="Previous chunk in feed"
        >
          <ChevronUp size={14} />
          Prev
        </button>

        <button
          className={styles.navBtn}
          onClick={onNextChunk}
          disabled={!hasNext}
          title="Next chunk in feed"
        >
          <ChevronDown size={14} />
          Next
        </button>
      </div>

      <div className={styles.right}>
        <VolumeControl
          volume={volume}
          onChange={onVolumeChange}
        />

        <button
          className={styles.button}
          onClick={onFullscreen}
          aria-label="Fullscreen"
          title="Toggle Fullscreen"
        >
          <Maximize2 size={18} />
        </button>
      </div>
    </div>
  );
}
