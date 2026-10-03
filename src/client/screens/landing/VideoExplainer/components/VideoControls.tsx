'use client';

import React from 'react';
import { motion, MotionValue } from 'framer-motion';
import { Play, Loader2, X } from 'lucide-react';
import styles from '../VideoExplainer.module.css';

export interface VideoControlsProps {
  isPlaying: boolean;
  isLoading: boolean;
  togglePlay: () => void;
  onExit: () => void;
  closeOpacity: MotionValue<number>;
}

export function VideoControls({
  isPlaying,
  isLoading,
  togglePlay,
  onExit,
  closeOpacity,
}: VideoControlsProps) {
  const showPlayButton = !isPlaying && !isLoading;

  return (
    <>
      {/* Big Play Button Overlay */}
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

      {/* Loading Indicator Overlay */}
      <div
        className={`${styles.overlayCenter} ${
          isLoading ? styles.overlayVisible : styles.overlayHidden
        }`}
      >
        <Loader2 className={styles.loaderIcon} />
      </div>

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
