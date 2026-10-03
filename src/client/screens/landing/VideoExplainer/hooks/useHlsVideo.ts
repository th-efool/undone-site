'use client';

import { useEffect, useState, useCallback, RefObject } from 'react';
import Hls from 'hls.js';

export interface UseHlsVideoOptions {
  videoRef: RefObject<HTMLVideoElement | null>;
  hlsSrc?: string;
  fallbackSrc?: string;
  defaultPlaybackRate?: number;
}

export interface UseHlsVideoReturn {
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  hlsSupported: boolean;
  togglePlay: () => void;
}

export function useHlsVideo({
  videoRef,
  hlsSrc = '/videos/hls/explainer.m3u8',
  defaultPlaybackRate = 1.2,
}: UseHlsVideoOptions): UseHlsVideoReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hlsSupported, setHlsSupported] = useState(true);

  // Setup HLS.js or native Safari HLS and default playback rate
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.playbackRate = defaultPlaybackRate;
    video.defaultPlaybackRate = defaultPlaybackRate;

    let hls: Hls | null = null;

    if (Hls.isSupported()) {
      hls = new Hls({
        autoStartLoad: true,
        startPosition: -1,
        capLevelToPlayerSize: true,
      });

      hls.loadSource(hlsSrc);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setHlsSupported(true);
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          console.error('HLS fatal error:', data);
          setHlsSupported(false);
          setIsLoading(false);
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native Apple HLS (Safari / iOS)
      video.src = hlsSrc;
      setHlsSupported(true);
    } else {
      // Fallback for browsers without HLS
      setHlsSupported(false);
    }

    return () => {
      if (hls) {
        hls.destroy();
      }
    };
  }, [videoRef, hlsSrc, defaultPlaybackRate]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play().catch(() => setIsPlaying(false));
    } else {
      video.pause();
    }
  }, [videoRef]);

  return {
    isPlaying,
    setIsPlaying,
    isLoading,
    setIsLoading,
    hlsSupported,
    togglePlay,
  };
}
