'use client';

import React from 'react';
import Image from 'next/image';
import styles from '../ReconstructedHero.module.css';

export function CollageLeft() {
  return (
    <div className={styles.collageLeft} aria-hidden="true">
      {/* L1: Window Black & White Photo */}
      <div
        className={styles.scrapItem}
        style={{
          width: 236,
          left: -18,
          top: 0,
          transform: 'rotate(1deg)',
          zIndex: 10,
          filter: 'drop-shadow(0 4px 14px rgba(15, 20, 35, 0.12))',
        }}
      >
        <Image
          src="/images/hero-collage/l1-window-photo.png"
          alt=""
          width={240}
          height={290}
          priority
        />
        {/* Top-left masking tape */}
        <div
          className={styles.tapeStrip}
          style={{
            width: 44,
            height: 18,
            top: 14,
            left: 54,
            transform: 'rotate(-38deg)',
          }}
        />
        {/* Top-edge horizontal masking tape */}
        <div
          className={styles.tapeStrip}
          style={{
            width: 48,
            height: 17,
            top: 4,
            left: 142,
            transform: 'rotate(-2deg)',
          }}
        />
      </div>

      {/* L7: Torn Cobalt Blue Scrap (tucked behind L2 and L6) */}
      <div
        className={styles.scrapItem}
        style={{
          width: 74,
          left: 136,
          top: 265,
          transform: 'rotate(-6deg)',
          zIndex: 18,
          filter: 'drop-shadow(0 3px 8px rgba(15, 25, 80, 0.2))',
        }}
      >
        <Image
          src="/images/hero-collage/l7-blue-scrap.png"
          alt=""
          width={75}
          height={100}
        />
      </div>

      {/* L2: Kraft List Scrap */}
      <div
        className={styles.scrapItem}
        style={{
          width: 122,
          left: 78,
          top: 234,
          transform: 'rotate(-1.5deg)',
          zIndex: 25,
          filter: 'drop-shadow(0 3px 12px rgba(25, 20, 15, 0.14))',
        }}
      >
        <Image
          src="/images/hero-collage/l2-ideas-paper.png"
          alt=""
          width={125}
          height={135}
        />
      </div>

      {/* L3: Dried Pressed Botanical Plant */}
      <div
        className={styles.scrapItem}
        style={{
          width: 72,
          left: 12,
          top: 270,
          transform: 'rotate(8deg)',
          zIndex: 40,
          filter: 'drop-shadow(0 2px 6px rgba(0, 0, 0, 0.18))',
        }}
      >
        <Image
          src="/images/hero-collage/l3-botanical.png"
          alt=""
          width={75}
          height={105}
        />
      </div>

      {/* L4: Mountain Peaks Photo */}
      <div
        className={styles.scrapItem}
        style={{
          width: 146,
          left: -18,
          bottom: 0,
          transform: 'rotate(-3deg)',
          zIndex: 15,
          filter: 'drop-shadow(0 4px 18px rgba(10, 15, 30, 0.16))',
        }}
      >
        <Image
          src="/images/hero-collage/l4-mountains.png"
          alt=""
          width={145}
          height={175}
        />
      </div>

      {/* L6: Moon Circle */}
      <div
        className={styles.scrapItem}
        style={{
          width: 78,
          height: 78,
          left: 114,
          bottom: 35,
          borderRadius: '50%',
          overflow: 'hidden',
          zIndex: 35,
          boxShadow: '0 3px 12px rgba(10, 15, 30, 0.18)',
        }}
      >
        <Image
          src="/images/hero-collage/l6-moon-circle.png"
          alt=""
          width={82}
          height={85}
        />
      </div>

      {/* L5: Curiosity Lives Scrap */}
      <div
        className={styles.scrapItem}
        style={{
          width: 102,
          left: 32,
          bottom: 12,
          transform: 'rotate(2.5deg)',
          zIndex: 30,
          filter: 'drop-shadow(0 3px 10px rgba(25, 20, 15, 0.12))',
        }}
      >
        <Image
          src="/images/hero-collage/l5-curiosity-note.png"
          alt=""
          width={105}
          height={85}
        />
      </div>
    </div>
  );
}
