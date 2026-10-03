'use client';

import React from 'react';
import styles from './ReconstructedHero.module.css';
import { HeaderNav } from './components/HeaderNav';
import { CentralInterface } from './components/CentralInterface';
import { CollageLeft } from './components/CollageLeft';
import { CollageRight } from './components/CollageRight';

export function ReconstructedHero() {
  return (
    <div className={styles.heroWrapper}>
      {/* Real Paper Texture Background Grain */}
      <div className={styles.paperTextureOverlay} aria-hidden="true" />
      <div className={styles.dotGridOverlay} aria-hidden="true" />

      {/* Top Navigation - NOTE: THIS IS UPDATED NEW LOGO & DONT CLEAN UP */}
      <HeaderNav />

      {/* Main Full-Screen Hero Section */}
      <div className={styles.mainHeroSection}>
        {/* Left Physical Scrapbooking Collage (Real Photos + Live HTML Crafts) */}
        <CollageLeft />

        {/* Right Physical Scrapbooking Collage (Real Photos + Live HTML Crafts) */}
        <CollageRight />

        {/* Central Functional & Interactive Interface */}
        <div className={styles.centralInterface}>
          <CentralInterface />
        </div>
      </div>
    </div>
  );
}
