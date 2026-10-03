'use client';

import React from 'react';
import Image from 'next/image';
import styles from '../ReconstructedHero.module.css';

export function CollageRight() {
  return (
    <div className={styles.collageRight} aria-hidden="true">
      {/* R1: Cosmic Galaxy Photo (Real Space Imagery) */}
      <div className={styles.galaxyCard}>
        <Image
          src="/images/hero-collage/real-galaxy.jpg"
          alt=""
          fill
          className={styles.galaxyImage}
          sizes="240px"
          priority
        />
      </div>

      {/* R2: "A more curious tomorrow" Note (Live HTML & Live Typography) */}
      <div className={styles.curiousTomorrowScrap}>
        <p className={styles.curiousTomorrowText}>
          A
          <br />
          more
          <br />
          curious
          <br />
          tomorrow.
        </p>
        {/* Handcrafted 8-point celestial star doodle */}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 4 }}>
          <Image
            src="/images/hero-collage/star-doodle.svg"
            alt=""
            width={16}
            height={16}
          />
        </div>
        {/* Top-left tape pinning the scrap */}
        <div
          className={styles.tapeStrip}
          style={{
            width: 44,
            height: 16,
            top: -4,
            left: 16,
            transform: 'rotate(-18deg)',
          }}
        />
      </div>

      {/* R3: Disciplines Strip (Live HTML) */}
      <div className={styles.disciplinesStrip}>
        <pre className={styles.disciplinesText}>
          ART{'\n'}
          SCIENCE{'\n'}
          TECHNOLOGY{'\n'}
          HUMANITIES{'\n'}
          CREATIVITY{'\n'}
          AND BEYOND
        </pre>
      </div>

      {/* R6: Coffee Mug on Vintage Books Photo */}
      <div className={styles.mugBooksCard}>
        <Image
          src="/images/hero-collage/real-mug-books.jpg"
          alt=""
          fill
          className={styles.mugBooksImage}
          sizes="200px"
        />
      </div>

      {/* R5: Antique Cartographic Map Photo */}
      <div className={styles.mapCard}>
        <Image
          src="/images/hero-collage/real-map.jpg"
          alt=""
          fill
          className={styles.mapImage}
          sizes="100px"
        />
      </div>

      {/* R4: Folded Royal Blue Origami Crane (Vector Craft) */}
      <div
        style={{
          position: 'absolute',
          top: 240,
          right: 172,
          width: 76,
          height: 90,
          transform: 'rotate(2deg)',
          zIndex: 45,
        }}
      >
        <Image
          src="/images/hero-collage/real-origami-crane.svg"
          alt=""
          width={76}
          height={90}
        />
      </div>

      {/* R7: Classical Cathedral Dome Photo */}
      <div className={styles.cathedralCard}>
        <Image
          src="/images/hero-collage/real-cathedral.jpg"
          alt=""
          fill
          className={styles.cathedralImage}
          sizes="145px"
        />
      </div>

      {/* R8: Collect / Learn / Repeat Scrap (Live HTML) */}
      <div className={styles.collectRepeatScrap}>
        <p className={styles.collectRepeatText}>
          Collect
          <br />
          Learn
          <br />
          Create
          <br />
          Repeat
        </p>
      </div>

      {/* R9: "Different Paths Same Sky" Cobalt Banner (Live HTML) */}
      <div className={styles.blueBannerRibbon}>
        <p className={styles.blueBannerText}>
          Different
          <br />
          Paths
          <br />
          Same Sky
        </p>
      </div>

      {/* Subtle organic pencil flourish arc looping below origami crane */}
      <svg
        className={styles.rightFlourishArc}
        viewBox="0 0 120 180"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M 80 15 C 20 60 40 120 15 165"
          stroke="#1F299D"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeDasharray="2 3"
          opacity="0.45"
        />
      </svg>
    </div>
  );
}
