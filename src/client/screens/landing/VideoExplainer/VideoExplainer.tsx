'use client';

import React, { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
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

  const {
    isPlaying,
    setIsPlaying,
    isLoading,
    setIsLoading,
    hlsSupported,
    togglePlay,
  } = useHlsVideo({
    videoRef,
    hlsSrc,
    fallbackSrc,
    defaultPlaybackRate: 1.2,
  });

  useVideoKeyboardControls({
    videoRef,
    togglePlay,
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
            togglePlay={togglePlay}
          />

          <VideoControls
            isPlaying={isPlaying}
            isLoading={isLoading}
            togglePlay={togglePlay}
            onExit={handleExit}
            closeOpacity={closeOpacity}
          />
        </motion.div>
      </div>
    </section>
  );
}
