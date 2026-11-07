'use client';

import React, { useRef } from 'react';
import { m, useScroll, useTransform } from 'framer-motion';
import { useHlsVideo } from './hooks/useHlsVideo';
import { useVideoKeyboardControls } from './hooks/useVideoKeyboardControls';
import { VideoPlayer } from './components/VideoPlayer';
import { VideoControls } from './components/VideoControls';
import styles from './VideoExplainer.module.css';

const DEFAULT_HLS_SRC = process.env.NEXT_PUBLIC_EXPLAINER_VIDEO_HLS_URL || '/videos/hls/explainer.m3u8';
const DEFAULT_FALLBACK_SRC = process.env.NEXT_PUBLIC_EXPLAINER_VIDEO_MP4_URL || '/videos/undone-investor-film.mp4';

export interface VideoExplainerProps {
  id?: string;
  hlsSrc?: string;
  fallbackSrc?: string;
}

export function VideoExplainer({
  id = 'video-explainer',
  hlsSrc = DEFAULT_HLS_SRC,
  fallbackSrc = DEFAULT_FALLBACK_SRC,
}: VideoExplainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const {
    isPlaying,
    setIsPlaying,
    isLoading,
    setIsLoading,
    isMuted,
    isEnded,
    setIsEnded,
    toggleMute,
    unmute,
    hlsSupported,
    handleEnded,
    handleReplay,
    handleError,
  } = useHlsVideo({
    videoRef,
    hlsSrc,
    fallbackSrc,
    defaultPlaybackRate: 1.2,
  });

  const handleTogglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isEnded) {
      handleReplay();
      return;
    }

    if (video.paused) {
      // A user gesture permits audible HTML media playback.
      if (video.muted) {
        unmute();
      }
      video.play().catch(() => setIsPlaying(false));
    } else {
      video.pause();
    }
  };

  useVideoKeyboardControls({
    videoRef,
    togglePlay: handleTogglePlay,
    toggleMute,
    onSeekPastEnd: () => {
      setIsEnded(true);
      setIsPlaying(false);
      setIsLoading(false);
    },
    onSeekBackward: () => {
      setIsEnded(false);
    },
  });

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  const clipPath = useTransform(
    scrollYProgress,
    [0, 0.2, 0.8, 1],
    [
      'inset(15vh 10vw 15vh 10vw round 24px)',
      'inset(0vh 0vw 0vh 0vw round 0px)',
      'inset(0vh 0vw 0vh 0vw round 0px)',
      'inset(15vh 10vw 15vh 10vw round 24px)',
    ]
  );

  const opacity = useTransform(scrollYProgress, [0, 0.1, 0.9, 1], [0.3, 1, 1, 0.3]);
  const closeOpacity = useTransform(scrollYProgress, [0.15, 0.2, 0.8, 0.85], [0, 1, 1, 0]);

  const handleExit = () => {
    if (containerRef.current) {
      const y = containerRef.current.offsetTop + containerRef.current.offsetHeight;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  return (
    <section id={id} ref={containerRef} className={styles.sectionContainer}>
      <div className={styles.stickyViewport}>
        <m.div
          style={{ clipPath, opacity }}
          className={styles.motionContainer}
        >
          <VideoPlayer
            videoRef={videoRef}
            hlsSupported={hlsSupported}
            fallbackSrc={fallbackSrc}
            onWaiting={() => setIsLoading(true)}
            onCanPlay={() => setIsLoading(false)}
            onPlaying={() => {
              setIsPlaying(true);
              setIsLoading(false);
            }}
            onPause={() => {
              setIsPlaying(false);
              setIsLoading(false);
            }}
            onEnded={handleEnded}
            onError={handleError}
            togglePlay={handleTogglePlay}
          />

          <VideoControls
            isPlaying={isPlaying}
            isLoading={isLoading}
            isMuted={isMuted}
            isEnded={isEnded}
            togglePlay={handleTogglePlay}
            toggleMute={toggleMute}
            onReplay={handleReplay}
            onExit={handleExit}
            closeOpacity={closeOpacity}
          />
        </m.div>
      </div>
    </section>
  );
}
