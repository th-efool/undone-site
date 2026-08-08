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
import { Tooltip } from '@/src/client/components/ui/Tooltip';

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
        <Tooltip content={isPlaying ? 'Pause (Space)' : 'Play (Space)'} placement="top">
          <button
            className={styles.button}
            onClick={onPlayPause}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause size={18} fill="currentColor" />
            ) : (
              <Play size={18} fill="currentColor" />
            )}
          </button>
        </Tooltip>

        <Tooltip content="Rewind 10 seconds" placement="top">
          <button
            className={styles.button}
            onClick={onSkipBack}
            aria-label="Rewind 10 seconds"
          >
            <RotateCcw size={16} />
          </button>
        </Tooltip>

        <Tooltip content="Forward 10 seconds" placement="top">
          <button
            className={styles.button}
            onClick={onSkipForward}
            aria-label="Forward 10 seconds"
          >
            <RotateCw size={16} />
          </button>
        </Tooltip>

        <span className={styles.time}>
          {currentTime} / {totalDuration}
        </span>
      </div>

      <div className={styles.center}>
      </div>

      <div className={styles.right}>
        <VolumeControl
          volume={volume}
          onChange={onVolumeChange}
        />

        <Tooltip content="Fullscreen" placement="top">
          <button
            className={styles.button}
            onClick={onFullscreen}
            aria-label="Fullscreen"
          >
            <Maximize2 size={18} />
          </button>
        </Tooltip>
      </div>
    </div>
  );
}

