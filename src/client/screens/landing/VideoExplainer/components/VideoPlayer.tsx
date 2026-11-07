'use client';

import React, { RefObject } from 'react';
import styles from '../VideoExplainer.module.css';

export interface VideoPlayerProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  hlsSupported: boolean;
  fallbackSrc?: string;
  poster?: string;
  onWaiting: () => void;
  onCanPlay: () => void;
  onPlaying: () => void;
  onPause: () => void;
  onEnded: () => void;
  onError?: () => void;
  togglePlay: () => void;
}

export function VideoPlayer({
  videoRef,
  hlsSupported,
  fallbackSrc = process.env.NEXT_PUBLIC_EXPLAINER_VIDEO_MP4_URL || '/videos/undone-investor-film.mp4',
  // poster prop is optional; if not provided, no poster attribute will be set
  poster,
  onWaiting,
  onCanPlay,
  onPlaying,
  onPause,
  onEnded,
  onError,
  togglePlay,
}: VideoPlayerProps) {
  return (
    <video
      ref={videoRef}
      src={!hlsSupported ? fallbackSrc : undefined}
      {...(poster ? { poster } : {})}
      preload="auto"
      playsInline
      className={styles.videoElement}
      loop
      onWaiting={onWaiting}
      onCanPlay={onCanPlay}
      onLoadedData={onCanPlay}
      onLoadedMetadata={onCanPlay}
      onSeeked={onCanPlay}
      onPlaying={onPlaying}
      onPause={onPause}
      onEnded={onEnded}
      onError={onError}
      onClick={togglePlay}
    />
  );
}
