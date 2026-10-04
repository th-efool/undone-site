'use client';

import { useEffect, useState, useCallback, useRef, RefObject } from 'react';
import type Hls from 'hls.js';

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
  isMuted: boolean;
  setIsMuted: (muted: boolean) => void;
  isEnded: boolean;
  setIsEnded: (ended: boolean) => void;
  toggleMute: () => void;
  unmute: () => void;
  hlsSupported: boolean;
  togglePlay: () => void;
  handleEnded: () => void;
  handleReplay: () => void;
}

export function useHlsVideo({
  videoRef,
  hlsSrc = '/videos/hls/explainer.m3u8',
  defaultPlaybackRate = 1.2,
}: UseHlsVideoOptions): UseHlsVideoReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoadingState] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isEnded, setIsEnded] = useState(false);
  const [hlsSupported, setHlsSupported] = useState(true);
  const loadingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced loading state: prevents micro-buffering (< 400ms) from flashing loading spinner
  const setIsLoading = useCallback((loading: boolean) => {
    if (!loading) {
      if (loadingTimerRef.current) {
        clearTimeout(loadingTimerRef.current);
        loadingTimerRef.current = null;
      }
      setIsLoadingState(false);
    } else {
      if (!loadingTimerRef.current) {
        loadingTimerRef.current = setTimeout(() => {
          setIsLoadingState(true);
          loadingTimerRef.current = null;
        }, 400);
      }
    }
  }, []);

  // Listen to timeupdate to detect when playback reaches the end
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => {
      if (video.duration > 0 && video.currentTime >= video.duration - 0.25) {
        setIsEnded(true);
        setIsPlaying(false);
        setIsLoading(false);
      }
    };

    video.addEventListener('timeupdate', onTimeUpdate);
    return () => video.removeEventListener('timeupdate', onTimeUpdate);
  }, [videoRef, setIsLoading]);

  // Setup HLS.js or native Safari HLS and default playback rate
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.playbackRate = defaultPlaybackRate;
    video.defaultPlaybackRate = defaultPlaybackRate;
    setIsMuted(video.muted);

    let hlsInstance: Hls | null = null;
    let isCancelled = false;

    const initHls = async () => {
      try {
        const HlsModule = (await import('hls.js')).default;
        if (isCancelled || !videoRef.current) return;
        const currentVideo = videoRef.current;

        if (HlsModule.isSupported()) {
          const hls = new HlsModule({
            autoStartLoad: true,
            startPosition: -1,
            capLevelToPlayerSize: true,
            // Aggressive pre-buffering to eliminate mid-playback loading pauses
            maxBufferLength: 30, // Buffer 30 seconds ahead
            maxMaxBufferLength: 60, // Allow up to 60s buffer
            maxBufferSize: 60 * 1000 * 1000,
            enableWorker: true,
            lowLatencyMode: false,
          });
          hlsInstance = hls;

          hls.loadSource(hlsSrc);
          hls.attachMedia(currentVideo);

          hls.on(HlsModule.Events.MANIFEST_PARSED, () => {
            if (!isCancelled) setHlsSupported(true);
          });

          hls.on(HlsModule.Events.ERROR, (_event, data) => {
            if (data.fatal) {
              console.error('HLS fatal error:', data);
              if (!isCancelled) {
                setHlsSupported(false);
                setIsLoading(false);
              }
            }
          });
        } else if (currentVideo.canPlayType('application/vnd.apple.mpegurl')) {
          // Native Apple HLS (Safari / iOS)
          currentVideo.src = hlsSrc;
          if (!isCancelled) setHlsSupported(true);
        } else {
          // Fallback for browsers without HLS
          if (!isCancelled) setHlsSupported(false);
        }
      } catch (err) {
        console.error('Failed to load Hls:', err);
        if (!isCancelled && videoRef.current?.canPlayType('application/vnd.apple.mpegurl')) {
          videoRef.current.src = hlsSrc;
          setHlsSupported(true);
        }
      }
    };

    initHls();

    return () => {
      isCancelled = true;
      if (loadingTimerRef.current) {
        clearTimeout(loadingTimerRef.current);
      }
      if (hlsInstance) {
        hlsInstance.destroy();
      }
    };
  }, [videoRef, hlsSrc, defaultPlaybackRate, setIsLoading]);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    const nextMuted = !video.muted;
    video.muted = nextMuted;
    if (!nextMuted) {
      video.volume = 1.0;
    }
    setIsMuted(nextMuted);
  }, [videoRef]);

  const unmute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = false;
    video.volume = 1.0;
    setIsMuted(false);
  }, [videoRef]);

  const handleReplay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    video.currentTime = 0;
    setIsEnded(false);
    setIsLoading(false);
    setIsPlaying(true);
    if (video.muted) {
      unmute();
    }
    video.play().catch(() => {
      video.muted = true;
      setIsMuted(true);
      video.play().catch(() => setIsPlaying(false));
    });
  }, [videoRef, unmute, setIsLoading]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isEnded) {
      handleReplay();
      return;
    }

    if (video.paused) {
      // Unmute on explicit user play interaction if currently muted
      if (video.muted) {
        unmute();
      }
      video.play().catch(() => setIsPlaying(false));
    } else {
      video.pause();
    }
  }, [videoRef, isEnded, handleReplay, unmute]);

  // Video finish callback
  const handleEnded = useCallback(() => {
    setIsEnded(true);
    setIsPlaying(false);
    setIsLoading(false);
  }, [setIsLoading]);

  return {
    isPlaying,
    setIsPlaying,
    isLoading,
    setIsLoading,
    isMuted,
    setIsMuted,
    isEnded,
    setIsEnded,
    toggleMute,
    unmute,
    hlsSupported,
    togglePlay,
    handleEnded,
    handleReplay,
  };
}
