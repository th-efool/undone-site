'use client';

import React from 'react';
import { m, MotionValue } from 'framer-motion';
import { Play, Loader2, X, Volume2, VolumeX, RotateCcw } from 'lucide-react';
import styles from '../VideoExplainer.module.css';

export interface VideoControlsProps {
  isPlaying: boolean;
  isLoading: boolean;
  isMuted: boolean;
  isEnded: boolean;
  togglePlay: () => void;
  toggleMute: () => void;
  onReplay: () => void;
  onExit: () => void;
  closeOpacity: MotionValue<number>;
}

export function VideoControls({
  isPlaying,
  isLoading,
  isMuted,
  isEnded,
  togglePlay,
  toggleMute,
  onReplay,
  onExit,
  closeOpacity,
}: VideoControlsProps) {
  const showReplayButton = isEnded;
  const showPlayButton = !isPlaying && !isEnded;
  const showCornerLoader = isLoading;

  return (
    <>
      {/* Big Replay Button Overlay (Visible when video ended or reached end) */}
      <div
        className={`${styles.overlayCenter} ${
          showReplayButton ? styles.overlayVisible : styles.overlayHidden
        }`}
        onClick={onReplay}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onReplay();
          }}
          className={styles.playButton}
          aria-label="Replay video"
          title="Replay video"
        >
          <RotateCcw className={styles.playIcon} strokeWidth={2.4} />
        </button>
      </div>

      {/* Big Play Button Overlay (Visible whenever paused and not ended) */}
      <div
        className={`${styles.overlayCenter} ${
          showPlayButton ? styles.overlayVisible : styles.overlayHidden
        }`}
        onClick={togglePlay}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            togglePlay();
          }}
          className={styles.playButton}
          aria-label="Play video"
          title="Play video"
        >
          <Play className={styles.playIcon} fill="currentColor" />
        </button>
      </div>

      {/* Unobtrusive Corner Spinner while loading/buffering (Never blocks the video with a dark screen overlay) */}
      {showCornerLoader && (
        <div className={styles.cornerLoader} aria-label="Buffering">
          <Loader2 className={styles.cornerLoaderIcon} />
        </div>
      )}

      {/* Tap For Sound Floating Banner (Appears when video is playing muted due to browser policy) */}
      {isPlaying && isMuted && (
        <button
          type="button"
          onClick={toggleMute}
          className={styles.soundPill}
          aria-label="Unmute audio"
        >
          <VolumeX size={17} />
          <span>Tap for sound</span>
        </button>
      )}

      {/* Audio Mute/Unmute Toggle Button */}
      <m.button
        style={{ opacity: closeOpacity }}
        type="button"
        onClick={toggleMute}
        className={styles.soundButton}
        aria-label={isMuted ? 'Unmute video' : 'Mute video'}
        title={isMuted ? 'Unmute video (or press M)' : 'Mute video (or press M)'}
      >
        {isMuted ? (
          <VolumeX className={styles.soundIcon} />
        ) : (
          <Volume2 className={styles.soundIcon} />
        )}
      </m.button>

      {/* Exit Section Button */}
      <m.button
        style={{ opacity: closeOpacity }}
        onClick={onExit}
        className={styles.exitButton}
        aria-label="Exit video section"
        type="button"
      >
        <X className={styles.exitIcon} />
      </m.button>
    </>
  );
}
