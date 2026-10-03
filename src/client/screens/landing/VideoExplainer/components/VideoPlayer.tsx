'use client';

import React, { RefObject } from 'react';
import styles from '../VideoExplainer.module.css';

export interface VideoPlayerProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  hlsSupported: boolean;
  fallbackSrc?: string;
  onWaiting: () => void;
  onCanPlay: () => void;
  onPlaying: () => void;
  onPause: () => void;
  onEnded: () => void;
  togglePlay: () => void;
}

export function VideoPlayer({
  videoRef,
  hlsSupported,
  fallbackSrc = '/videos/undone-investor-film.mp4',
  onWaiting,
  onCanPlay,
  onPlaying,
  onPause,
  onEnded,
  togglePlay,
}: VideoPlayerProps) {
  return (
    <video
      ref={videoRef}
      src={!hlsSupported ? fallbackSrc : undefined}
      className={styles.videoElement}
      loop
      playsInline
      onWaiting={onWaiting}
      onCanPlay={onCanPlay}
      onLoadedData={onCanPlay}
      onSeeked={onCanPlay}
      onPlaying={onPlaying}
      onPause={onPause}
      onEnded={onEnded}
      onClick={togglePlay}
    />
  );
}
