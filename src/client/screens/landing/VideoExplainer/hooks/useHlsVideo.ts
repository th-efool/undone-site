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
  handleError: () => void;
}

export function useHlsVideo({
  videoRef,
  hlsSrc = process.env.NEXT_PUBLIC_EXPLAINER_VIDEO_HLS_URL || '/videos/hls/explainer.m3u8',
  fallbackSrc = process.env.NEXT_PUBLIC_EXPLAINER_VIDEO_MP4_URL || '/videos/undone-investor-film.mp4',
  defaultPlaybackRate = 1.2,
}: UseHlsVideoOptions): UseHlsVideoReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoadingState] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isEnded, setIsEnded] = useState(false);
  const [hlsSupported, setHlsSupported] = useState(true);
  const loadingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hlsInstanceRef = useRef<Hls | null>(null);

  // Debounced loading state: prevents micro-buffering (< 300ms) from flashing loading spinner
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
        }, 300);
      }
    }
  }, []);

  const switchToFallback = useCallback(() => {
    const video = videoRef.current;
    if (hlsInstanceRef.current) {
      try {
        hlsInstanceRef.current.destroy();
      } catch {
        // Ignored
      }
      hlsInstanceRef.current = null;
    }
    setHlsSupported(false);
    if (loadingTimerRef.current) {
      clearTimeout(loadingTimerRef.current);
      loadingTimerRef.current = null;
    }
    setIsLoadingState(false);

    if (video) {
      if (video.src !== fallbackSrc && !video.src.endsWith(fallbackSrc)) {
        video.src = fallbackSrc;
        video.load();
      }
    }
  }, [videoRef, fallbackSrc]);

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
    video.muted = true;
    setIsMuted(true);

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
            maxBufferLength: 30,
            maxMaxBufferLength: 60,
            maxBufferSize: 60 * 1000 * 1000,
            enableWorker: true,
            lowLatencyMode: false,
          });
          hlsInstanceRef.current = hls;

          hls.loadSource(hlsSrc);
          hls.attachMedia(currentVideo);

          hls.on(HlsModule.Events.MANIFEST_PARSED, () => {
            if (!isCancelled) {
              setHlsSupported(true);
              setIsLoading(false);
            }
          });

          hls.on(HlsModule.Events.ERROR, (_event, data) => {
            if (data.fatal) {
              console.warn('HLS fatal error encountered, switching to direct MP4 fallback:', data);
              switchToFallback();
            }
          });
        } else if (currentVideo.canPlayType('application/vnd.apple.mpegurl')) {
          // Native Apple HLS (Safari / iOS)
          currentVideo.src = hlsSrc;
          if (!isCancelled) {
            setHlsSupported(true);
            setIsLoading(false);
          }

          const onNativeError = () => {
            console.warn('Native Apple HLS playback error, falling back to MP4');
            switchToFallback();
          };
          currentVideo.addEventListener('error', onNativeError, { once: true });
        } else {
          // Fallback for browsers without HLS
          switchToFallback();
        }
      } catch (err) {
        console.warn('Failed to load Hls library, falling back to MP4:', err);
        switchToFallback();
      }
    };

    initHls();

    return () => {
      isCancelled = true;
      if (loadingTimerRef.current) {
        clearTimeout(loadingTimerRef.current);
        loadingTimerRef.current = null;
      }
      if (hlsInstanceRef.current) {
        try {
          hlsInstanceRef.current.destroy();
        } catch {
          // Ignored
        }
        hlsInstanceRef.current = null;
      }
    };
  }, [videoRef, hlsSrc, fallbackSrc, defaultPlaybackRate, setIsLoading, switchToFallback]);

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
      if (video.muted) {
        unmute();
      }
      video.play().catch(() => {
        video.muted = true;
        setIsMuted(true);
        video.play().catch(() => setIsPlaying(false));
      });
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
    handleError: switchToFallback,
  };
}
