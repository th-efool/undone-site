'use client';

import React, { useRef } from 'react';
import { motion, useScroll, useTransform, useMotionValueEvent } from 'framer-motion';
import { useHlsVideo } from './hooks/useHlsVideo';
import { useVideoKeyboardControls } from './hooks/useVideoKeyboardControls';
import { VideoPlayer } from './components/VideoPlayer';
import { VideoControls } from './components/VideoControls';
import styles from './VideoExplainer.module.css';

export interface VideoExplainerProps {
  id?: string;
  hlsSrc?: string;
  fallbackSrc?: string;
}

export function VideoExplainer({
  id = 'video-explainer',
  hlsSrc = '/videos/hls/explainer.m3u8',
  fallbackSrc = '/videos/undone-investor-film.mp4',
}: VideoExplainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const userPausedManually = useRef(false);

  const {
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
    handleEnded,
    handleReplay,
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
      userPausedManually.current = false;
      handleReplay();
      return;
    }

    if (video.paused) {
      userPausedManually.current = false;
      // On user interaction, unmute audio so they can hear it
      if (video.muted) {
        unmute();
      }
      video.play().catch(() => {
        video.muted = true;
        setIsMuted(true);
        video.play().catch(() => setIsPlaying(false));
      });
    } else {
      userPausedManually.current = true;
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

  // Autoplay when video zooms in beyond threshold (0.15) and auto-pause when zooming out (< 0.15 or > 0.82)
  useMotionValueEvent(scrollYProgress, 'change', (progress) => {
    const video = videoRef.current;
    if (!video) return;

    // Zoom-in threshold: between 0.15 and 0.82 the video is zoomed in towards full screen
    const isZoomedIn = progress >= 0.15 && progress <= 0.82;

    if (isZoomedIn) {
      if (video.paused && !userPausedManually.current) {
        video.play().catch(() => {
          // If unmuted autoplay blocked by browser policy, fallback to muted autoplay
          video.muted = true;
          setIsMuted(true);
          video.play().catch(() => setIsPlaying(false));
        });
      }
    } else {
      // Zoomed out (scrolled back up to Hero or down to Ikigai): auto pause
      if (!video.paused) {
        video.pause();
      }
      // Reset manual pause preference once user leaves the section
      userPausedManually.current = false;
    }
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
        <motion.div
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
            onPause={() => setIsPlaying(false)}
            onEnded={handleEnded}
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
        </motion.div>
      </div>
    </section>
  );
}
