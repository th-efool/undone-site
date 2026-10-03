'use client';

import React from 'react';
import Image from 'next/image';
import styles from '../ReconstructedHero.module.css';

export function CollageRight() {
  return (
    <div className={styles.collageRight} aria-hidden="true">
      {/* R1: Cosmic Galaxy Photo */}
      <div
        className={styles.scrapItem}
        style={{
          width: 214,
          right: 0,
          top: 0,
          zIndex: 10,
          filter: 'drop-shadow(0 4px 14px rgba(10, 15, 30, 0.15))',
        }}
      >
        <Image
          src="/images/hero-collage/r1-galaxy.png"
          alt=""
          width={214}
          height={140}
          priority
        />
      </div>

      {/* R2: "A more curious tomorrow" Note */}
      <div
        className={styles.scrapItem}
        style={{
          width: 136,
          right: 138,
          top: 55,
          transform: 'rotate(-4.5deg)',
          zIndex: 25,
          filter: 'drop-shadow(0 4px 14px rgba(25, 20, 15, 0.14))',
        }}
      >
        <Image
          src="/images/hero-collage/r2-curious-tomorrow.png"
          alt=""
          width={140}
          height={180}
        />
        {/* Top-right tape */}
        <div
          className={styles.tapeStrip}
          style={{
            width: 42,
            height: 16,
            top: 2,
            right: 16,
            transform: 'rotate(24deg)',
          }}
        />
      </div>

      {/* R3: Disciplines Strip */}
      <div
        className={styles.scrapItem}
        style={{
          width: 96,
          right: 28,
          top: 135,
          zIndex: 20,
          filter: 'drop-shadow(0 3px 10px rgba(25, 20, 15, 0.12))',
        }}
      >
        <Image
          src="/images/hero-collage/r3-disciplines.png"
          alt=""
          width={100}
          height={100}
        />
      </div>

      {/* R6: Coffee Mug on Books ("Good Ideas") */}
      <div
        className={styles.scrapItem}
        style={{
          width: 188,
          right: 0,
          top: 205,
          transform: 'rotate(1.5deg)',
          zIndex: 22,
          filter: 'drop-shadow(0 4px 16px rgba(15, 20, 35, 0.15))',
        }}
      >
        <Image
          src="/images/hero-collage/r6-mug-books.png"
          alt=""
          width={189}
          height={195}
        />
      </div>

      {/* R5: Vintage Cartographic Map */}
      <div
        className={styles.scrapItem}
        style={{
          width: 92,
          right: 195,
          top: 315,
          transform: 'rotate(5deg)',
          zIndex: 20,
          filter: 'drop-shadow(0 3px 10px rgba(25, 20, 15, 0.12))',
        }}
      >
        <Image
          src="/images/hero-collage/r5-map-scrap.png"
          alt=""
          width={95}
          height={120}
        />
      </div>

      {/* R4: Folded Royal Blue Origami Crane */}
      <div
        className={styles.scrapItem}
        style={{
          width: 72,
          right: 172,
          top: 238,
          transform: 'rotate(2deg)',
          zIndex: 45,
          filter: 'drop-shadow(0 4px 8px rgba(10, 20, 70, 0.28))',
        }}
      >
        <Image
          src="/images/hero-collage/r4-origami-crane.png"
          alt=""
          width={75}
          height={90}
        />
      </div>

      {/* R7: Classical Cathedral Dome */}
      <div
        className={styles.scrapItem}
        style={{
          width: 136,
          right: 78,
          bottom: 0,
          transform: 'rotate(-1.5deg)',
          zIndex: 24,
          filter: 'drop-shadow(0 4px 16px rgba(15, 20, 35, 0.13))',
        }}
      >
        <Image
          src="/images/hero-collage/r7-cathedral.png"
          alt=""
          width={140}
          height={155}
        />
      </div>

      {/* R8: Collect / Learn / Repeat Scrap */}
      <div
        className={styles.scrapItem}
        style={{
          width: 106,
          right: 0,
          bottom: 35,
          transform: 'rotate(2deg)',
          zIndex: 30,
          filter: 'drop-shadow(0 3px 10px rgba(25, 20, 15, 0.14))',
        }}
      >
        <Image
          src="/images/hero-collage/r8-collect-repeat.png"
          alt=""
          width={109}
          height={125}
        />
      </div>

      {/* R9: "Different Paths Same Sky" Blue Banner Ribbon */}
      <div
        className={styles.scrapItem}
        style={{
          width: 122,
          right: 224,
          bottom: 8,
          transform: 'rotate(-8deg)',
          zIndex: 28,
          filter: 'drop-shadow(0 3px 8px rgba(15, 25, 80, 0.24))',
        }}
      >
        <Image
          src="/images/hero-collage/r9-blue-banner.png"
          alt=""
          width={125}
          height={110}
        />
      </div>
    </div>
  );
}
