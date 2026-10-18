'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  CheckCircle,
  SkipForward,
  Timer,
  ChevronDown,
  Keyboard,
  Flag,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { triggerHaptic } from '@/src/client/utils/haptics';
import styles from './PlayDock.module.css';

interface PlayDockProps {
  volume: number;
  muted: boolean;
  playbackSpeed: number;
  hasNext: boolean;
  completionPending: boolean;
  completionError?: string | null;
  isCompleted?: boolean;
  speedSupported?: boolean;
  isFullscreen: boolean;
  onVolumeChange: (vol: number) => void;
  onToggleMute: () => void;
  onSpeedChange: (speed: number) => void;
  onCompleteChunk: () => void;
  onNextChunk: () => void;
  onToggleFullscreen: () => void;
  onToggleShortcuts?: () => void;
}

const SPEED_OPTIONS = [0.75, 1.0, 1.25, 1.5, 2.0];

export function PlayDock({
  volume,
  muted,
  playbackSpeed,
  hasNext,
  completionPending,
  completionError,
  isCompleted,
  speedSupported = true,
  isFullscreen,
  onVolumeChange,
  onToggleMute,
  onSpeedChange,
  onCompleteChunk,
  onNextChunk,
  onToggleFullscreen,
  onToggleShortcuts,
}: PlayDockProps) {
  const [speedMenuOpen, setSpeedMenuOpen] = useState(false);
  const speedRef = useRef<HTMLDivElement>(null);

  // Close speed menu on outside click or Escape key
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (speedRef.current && !speedRef.current.contains(e.target as Node)) {
        setSpeedMenuOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setSpeedMenuOpen(false);
      }
    }
    if (speedMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [speedMenuOpen]);

  const effectiveVol = muted ? 0 : volume;

  const handleComplete = () => {
    if (completionPending) return;
    triggerHaptic('success');
    onCompleteChunk();
  };

  const handleNext = () => {
    if (!hasNext) return;
    triggerHaptic('light');
    onNextChunk();
  };

  return (
    <div className={styles.dockContainer} role="toolbar" aria-label="Playback controls dock">
      {/* Capsule 1: Fullscreen */}
      <div className={styles.capsule}>
        <button
          type="button"
          className={styles.dockButton}
          onClick={onToggleFullscreen}
          aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        >
          {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
        </button>
      </div>

      {/* Capsule 2: Volume & Audio Slider */}
      <div className={`${styles.capsule} ${styles.volumeCapsule}`}>
        <button
          type="button"
          className={styles.dockButton}
          onClick={onToggleMute}
          aria-label={muted || effectiveVol === 0 ? 'Unmute' : 'Mute'}
          title={muted || effectiveVol === 0 ? 'Unmute' : 'Mute'}
        >
          {muted || effectiveVol === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
        <input
          type="range"
          className={styles.volumeSlider}
          min={0}
          max={100}
          value={effectiveVol}
          onChange={(e) => onVolumeChange(Number(e.target.value))}
          style={{
            background: `linear-gradient(to right, #5430FF ${effectiveVol}%, rgba(255, 255, 255, 0.2) ${effectiveVol}%)`,
          }}
          aria-label="Volume level"
        />
      </div>

      {/* Capsule 3: Mark Chunk Complete */}
      <div className={styles.capsule}>
        <button
          type="button"
          className={`${styles.dockButton} ${completionError ? styles.dockButtonError : isCompleted ? styles.dockButtonCompleted : ''}`}
          onClick={handleComplete}
          disabled={completionPending}
          aria-label={completionError ? 'Retry chunk completion' : isCompleted ? 'Chunk completed' : 'Mark chunk as complete'}
          title={completionError ? 'Completion failed. Click to retry.' : isCompleted ? 'Completed (click to re-mark)' : 'Complete chunk'}
        >
          {completionPending ? (
            <Loader2 size={18} className={styles.spinner} />
          ) : completionError ? (
            <AlertCircle size={18} />
          ) : (
            <CheckCircle size={18} fill={isCompleted ? 'rgba(84, 48, 255, 0.3)' : 'none'} />
          )}
        </button>
      </div>

      {/* Capsule 4: Skip Forward / Next Chunk */}
      <div className={styles.capsule}>
        <button
          type="button"
          className={styles.dockButton}
          onClick={handleNext}
          disabled={!hasNext}
          aria-label="Next chunk"
          title="Next chunk"
        >
          <SkipForward size={18} />
        </button>
      </div>

      {/* Capsule 5: Playback Speed */}
      <div className={styles.speedWrapper} ref={speedRef}>
        <div className={styles.capsule}>
          <button
            type="button"
            className={`${styles.dockButton} ${!speedSupported ? styles.dockButtonDisabled : ''}`}
            onClick={() => speedSupported && setSpeedMenuOpen((prev) => !prev)}
            disabled={!speedSupported}
            aria-disabled={!speedSupported}
            aria-label={speedSupported ? `Playback speed: ${playbackSpeed}x` : 'Playback speed unavailable for this lesson'}
            aria-haspopup={speedSupported ? 'menu' : undefined}
            aria-expanded={speedSupported ? speedMenuOpen : undefined}
            title={speedSupported ? 'Change playback speed' : 'Playback speed unavailable for this lesson'}
          >
            <Timer size={16} />
            <span>{speedSupported ? `${playbackSpeed}x` : '1x'}</span>
            {speedSupported && <ChevronDown size={14} />}
          </button>
        </div>

        {speedSupported && speedMenuOpen && (
          <div className={styles.speedMenu} role="menu" aria-label="Playback speed options">
            {SPEED_OPTIONS.map((speed) => (
              <button
                key={speed}
                type="button"
                className={`${styles.speedOption} ${speed === playbackSpeed ? styles.speedOptionActive : ''}`}
                role="menuitem"
                onClick={() => {
                  onSpeedChange(speed);
                  setSpeedMenuOpen(false);
                }}
              >
                {speed}x
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Capsule 6: Keyboard Shortcuts */}
      <div className={styles.capsule}>
        <button
          type="button"
          className={styles.dockButton}
          onClick={onToggleShortcuts}
          aria-label="Keyboard shortcuts (?)"
          title="Keyboard shortcuts (?)"
        >
          <Keyboard size={18} />
        </button>
      </div>

      {/* Capsule 7: Report Issue (Visibly deferred placeholder without fake modal) */}
      <div className={styles.capsule}>
        <div
          tabIndex={0}
          className={styles.tooltipAnchor}
          data-tooltip="Reporting coming later"
          aria-label="Reporting coming later"
        >
          <button
            type="button"
            className={`${styles.dockButton} ${styles.dockButtonDisabled}`}
            disabled
            aria-disabled="true"
            aria-label="Report an issue with this chunk"
            title="Reporting coming later"
          >
            <Flag size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
