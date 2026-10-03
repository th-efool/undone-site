'use client';

import React, { useEffect, RefObject } from 'react';
import styles from '../VideoExplainer.module.css';

export interface VideoPlayerProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  hlsSupported: boolean;
  fallbackSrc?: string;
  onWaiting: () => void;
  onCanPlay: () => void;
  onPlaying: () => void;
  onPause: () => void;
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
  togglePlay,
}: VideoPlayerProps) {
  // Intersection Observer for scroll-into-view autoplay/pause
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            video.play().catch((err) => {
              // Browser may restrict autoplay with audio unless muted or user interacted
              console.log('Autoplay deferred or prevented by browser policy:', err);
              onPause();
            });
          } else {
            video.pause();
          }
        });
      },
      { threshold: 0.5 }
    );

    observer.observe(video);
    return () => observer.unobserve(video);
  }, [videoRef, onPause]);

  return (
    <video
      ref={videoRef}
      src={!hlsSupported ? fallbackSrc : undefined}
      className={styles.videoElement}
      loop
      playsInline
      onWaiting={onWaiting}
      onCanPlay={onCanPlay}
      onPlaying={onPlaying}
      onPause={onPause}
      onClick={togglePlay}
    />
  );
}
