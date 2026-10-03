'use client';

import React from 'react';
import { useTheme } from '@/src/client/hooks/useTheme';
import styles from './Hero.module.css';
import { HeaderNav } from './components/HeaderNav';
import { CentralInterface } from './components/CentralInterface';
import { CollageLeft } from './components/CollageLeft';
import { CollageRight } from './components/CollageRight';

export function Hero() {
  const { theme } = useTheme();

  return (
    <div className={styles.heroWrapper} data-theme={theme}>
      {/* Real Paper Texture Background Grain (Subtle in light, hidden in pure black dark) */}
      <div className={styles.paperTextureOverlay} aria-hidden="true" />

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
