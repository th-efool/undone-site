'use client';

import { useEffect, RefObject } from 'react';

export interface UseVideoKeyboardControlsOptions {
  videoRef: RefObject<HTMLVideoElement | null>;
  togglePlay: () => void;
  toggleMute?: () => void;
  seekStepSeconds?: number;
}

export function useVideoKeyboardControls({
  videoRef,
  togglePlay,
  toggleMute,
  seekStepSeconds = 5,
}: UseVideoKeyboardControlsOptions): void {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept keypresses if user is typing in an input, textarea, or contentEditable
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      const video = videoRef.current;
      if (!video) return;

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        const duration = video.duration || 0;
        if (duration > 0) {
          // If seeking would reach or exceed the end of video, loop seamlessly back to start
          if (video.currentTime + seekStepSeconds >= duration - 0.4) {
            video.currentTime = 0;
            video.play().catch(() => {});
          } else {
            video.currentTime += seekStepSeconds;
          }
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        video.currentTime = Math.max(video.currentTime - seekStepSeconds, 0);
      } else if (e.key === ' ') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        if (toggleMute) {
          toggleMute();
        } else {
          video.muted = !video.muted;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [videoRef, togglePlay, toggleMute, seekStepSeconds]);
}
