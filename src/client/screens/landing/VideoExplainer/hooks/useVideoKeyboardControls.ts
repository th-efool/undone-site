'use client';

import { useEffect, RefObject } from 'react';

export interface UseVideoKeyboardControlsOptions {
  videoRef: RefObject<HTMLVideoElement | null>;
  togglePlay: () => void;
  seekStepSeconds?: number;
}

export function useVideoKeyboardControls({
  videoRef,
  togglePlay,
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
        video.currentTime = Math.min(video.currentTime + seekStepSeconds, video.duration || 0);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        video.currentTime = Math.max(video.currentTime - seekStepSeconds, 0);
      } else if (e.key === ' ') {
        e.preventDefault();
        togglePlay();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [videoRef, togglePlay, seekStepSeconds]);
}
