'use client';

import React from 'react';
import Image from 'next/image';
import { useTheme } from '@/src/client/hooks/useTheme';
import styles from './Hero.module.css';
import { HeaderNav } from './components/HeaderNav';
import { CentralInterface } from './components/CentralInterface';
import { CollageLeft } from './components/CollageLeft';
import { CollageRight } from './components/CollageRight';

export function Hero() {
  const { theme } = useTheme();

  return (
    <div
      className={styles.heroWrapper}
      data-theme={theme}
    >
      {/* Real Paper Texture Background Grain (Subtle in light, hidden in pure black dark) */}
      <div
        className={styles.paperTextureOverlay}
        aria-hidden="true"
      />

      {/* Top Navigation - NOTE: THIS IS UPDATED NEW LOGO & DONT CLEAN UP */}
      <HeaderNav />

      {/* Main Full-Screen Hero Section */}
      <div className={styles.mainHeroSection}>
        {/* Left Physical Scrapbooking Collage (Real Photos + Live HTML Crafts) */}
        <CollageLeft />

        {/* Right Physical Scrapbooking Collage (Real Photos + Live HTML Crafts) */}
        <CollageRight />

        {/* Bottom Edge Parchment Sheets: Hug the bottom edge & left/right edges */}
        <div
          className={styles.bottomEdgeParchmentLeft}
          data-editable-id="bottomEdgeParchmentLeft"
        >
          <Image
            src="/images/hero-collage/parchment-edge-corner-left.svg"
            priority
            fetchPriority="high"
            alt=""
            fill
            className={styles.tornPaperImage}
            sizes="300px"
          />
        </div>

        <div
          className={styles.bottomEdgeParchmentRight}
          data-editable-id="bottomEdgeParchmentRight"
        >
          <Image
            src="/images/hero-collage/parchment-edge-corner-right.svg"
            priority
            fetchPriority="high"
            alt=""
            fill
            className={styles.tornPaperImage}
            sizes="300px"
          />
        </div>

        {/* Extra sheets for user to arrange */}
        <div
          className={styles.bottomEdgeParchmentLeft}
          data-editable-id="extraParchmentLeft1"
          style={{ zIndex: 3, transform: 'translate(-24px, -28px) scale(1.25)' }}
        >
          <Image
            src="/images/hero-collage/parchment-edge-corner-left.svg"
            priority
            fetchPriority="high"
            alt=""
            fill
            className={styles.tornPaperImage}
          />
        </div>
        <div
          className={styles.bottomEdgeParchmentLeft}
          data-editable-id="extraParchmentLeft2"
          style={{ zIndex: 3, left: 'auto', right: '-180px', transform: 'translate(24px, 48px) scaleX(-1) scale(1.22)' }}
        >
          <Image
            src="/images/hero-collage/parchment-mid-fill-right.svg"
            alt=""
            fill
            className={styles.tornPaperImage}
          />
        </div>

        {/* Central Functional & Interactive Interface */}
        <div className={styles.centralInterface}>
          <CentralInterface />
        </div>
      </div>
    </div>
  );
}
