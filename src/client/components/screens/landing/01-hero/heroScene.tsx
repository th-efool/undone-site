'use client';

import { useEffect, useRef } from 'react';
import styles from './Hero.module.css';

export function HeroScene() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.playbackRate = 0.4;
  }, []);

  return (
    <div
      className={styles.background}
      aria-hidden="true"
    >
      <video
        ref={videoRef}
        className={styles.video}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        poster="/images/hero-poster.webp"
      >
        <source
          src="/videos/hero.webm"
          type="video/webm"
        />
      </video>

      {/* Global image treatment */}
      <div className={styles.colorGrade} />

      {/* Large environmental lighting */}
      <div className={styles.leftVignette} />
      <div className={styles.sunCorner} />

      {/* Sun entering room */}
      <div className={styles.windowGlow} />

      {/* Reading area boost */}
      <div className={styles.readingWash} />

      {/* Framing */}
      <div className={styles.topFade} />
      <div className={styles.bottomFade} />
      <div className={styles.globalVignette} />
    </div>
  );
}
