'use client';

import React from 'react';
import styles from './ReconstructedHero.module.css';
import { HeaderNav } from './components/HeaderNav';
import { CentralInterface } from './components/CentralInterface';
import { CollageLeft } from './components/CollageLeft';
import { CollageRight } from './components/CollageRight';
import { Flourishes } from './components/Flourishes';

export function ReconstructedHero() {
  return (
    <div className={styles.heroWrapper}>
      <div className={styles.heroCanvas}>
        {/* Left physical scrapbooking collage */}
        <CollageLeft />

        {/* Right physical scrapbooking collage */}
        <CollageRight />

        {/* Celestial star doodles & accents */}
        <Flourishes />

        {/* Central interactive and navigational layer */}
        <div className={styles.centralContainer}>
          <HeaderNav />
          <CentralInterface />
        </div>
      </div>
    </div>
  );
}
