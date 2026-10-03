'use client';

import React from 'react';
import { motion, MotionValue } from 'framer-motion';
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
  const showPlayButton = !isPlaying && !isLoading && !isEnded;
  const showCenterLoader = !isPlaying && isLoading && !isEnded;
  const showCornerLoader = isPlaying && isLoading;

  return (
    <>
      {/* Big Replay Button Overlay (Visible when video ended or reached end) */}
      <div
        className={`${styles.overlayCenter} ${
          showReplayButton ? styles.overlayVisible : styles.overlayHidden
        }`}
      >
        <button
          type="button"
          onClick={onReplay}
          className={styles.playButton}
          aria-label="Replay video"
          title="Replay video"
        >
          <RotateCcw className={styles.playIcon} strokeWidth={2.4} />
        </button>
      </div>

      {/* Big Play Button Overlay (Visible only when paused and not loading and not ended) */}
      <div
        className={`${styles.overlayCenter} ${
          showPlayButton ? styles.overlayVisible : styles.overlayHidden
        }`}
      >
        <button
          type="button"
          onClick={togglePlay}
          className={styles.playButton}
          aria-label="Play video"
        >
          <Play className={styles.playIcon} fill="currentColor" />
        </button>
      </div>

      {/* Initial Cold Load Center Spinner (Only before video starts playing) */}
      <div
        className={`${styles.overlayCenter} ${
          showCenterLoader ? styles.overlayVisible : styles.overlayHidden
        }`}
      >
        <Loader2 className={styles.loaderIcon} />
      </div>

      {/* Unobtrusive Corner Spinner while playing (NEVER blocks the video with a dark screen overlay) */}
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
      <motion.button
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
      </motion.button>

      {/* Exit Section Button */}
      <motion.button
        style={{ opacity: closeOpacity }}
        onClick={onExit}
        className={styles.exitButton}
        aria-label="Exit video section"
        type="button"
      >
        <X className={styles.exitIcon} />
      </motion.button>
    </>
  );
}
