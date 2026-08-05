'use client';

import ProtectedVideo from '@/src/client/components/global/ProtectedVideo/ProtectedVideo';
import styles from './Hero.module.css';

export function HeroScene() {
  return (
    <div
      className={styles.background}
      aria-hidden="true"
    >
      <ProtectedVideo
        src="/videos/hero.webm"
        className={styles.video}
        playbackRate={0.4}
        poster="/images/hero-poster.webp"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
      />

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
