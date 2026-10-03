'use client';

import React from 'react';
import Image from 'next/image';
import styles from '../ReconstructedHero.module.css';

export function CollageRight() {
  return (
    <div className={styles.collageRight} aria-hidden="true">
      {/* R1: Cosmic Galaxy Photo Card (Real Space Imagery) */}
      <div className={styles.galaxyCard}>
        <div className={styles.galaxyInner}>
          <Image
            src="/images/hero-collage/real-galaxy.jpg"
            alt=""
            fill
            className={styles.galaxyImage}
            sizes="300px"
            priority
          />
        </div>
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
        <div className={styles.tomorrowStarDoodle}>
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
            left: 14,
            transform: 'rotate(-16deg)',
          }}
        />
      </div>

      {/* R3: Disciplines Strip with Clean Tracked Sans (Live HTML) */}
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

      {/* R4: Folded Royal Blue Origami Crane (Vector Craft with Ambient Drop Shadow) */}
      <div className={styles.origamiCrane}>
        <Image
          src="/images/hero-collage/real-origami-crane.svg"
          alt=""
          width={88}
          height={104}
        />
      </div>

      {/* R6: Ceramic Coffee Mug on Vintage Books with "Good Ideas Travel Far" */}
      <div className={styles.mugBooksCard}>
        <Image
          src="/images/hero-collage/real-mug-books.jpg"
          alt=""
          fill
          className={styles.mugBooksImage}
          sizes="240px"
        />
      </div>

      {/* R5: Antique Celestial Star Chart Map Photo */}
      <div className={styles.mapCard}>
        <div className={styles.mapInner}>
          <Image
            src="/images/hero-collage/real-map.jpg"
            alt=""
            fill
            className={styles.mapImage}
            sizes="120px"
          />
        </div>
      </div>

      {/* R7: St. Peter's Basilica Dome Architectural Print with White Border */}
      <div className={styles.cathedralCard}>
        <div className={styles.cathedralInner}>
          <Image
            src="/images/hero-collage/real-cathedral.jpg"
            alt=""
            fill
            className={styles.cathedralImage}
            sizes="170px"
          />
        </div>
      </div>

      {/* R9: Substantial "Different Paths Same Sky" Cobalt Paper Sheet (Live HTML) */}
      <div className={styles.blueBannerRibbon}>
        <div className={styles.blueBannerInner}>
          <p className={styles.blueBannerText}>
            Different
            <br />
            Paths
            <br />
            Same Sky
          </p>
          {/* Subtle star sparkle doodle on banner */}
          <span className={styles.blueBannerSparkle}>✦</span>
        </div>
      </div>

      {/* R8: Collect / Learn / Create / Repeat Scrap (Live HTML) */}
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
        <div className={styles.collectRepeatRule} />
      </div>

      {/* Subtle organic pencil flourish arc looping around origami crane */}
      <svg
        className={styles.rightFlourishArc}
        viewBox="0 0 140 260"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M 110 15 C 30 70 50 160 20 245"
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
