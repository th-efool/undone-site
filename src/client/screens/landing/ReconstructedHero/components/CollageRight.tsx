'use client';

import React from 'react';
import Image from 'next/image';
import styles from '../ReconstructedHero.module.css';

export function CollageRight() {
  return (
    <div className={styles.collageRight} aria-hidden="true">
      {/* TORN PAPER BASE: Top-Right Torn Paper Frame */}
      <div className={styles.topRightTornSheet}>
        <Image
          src="/images/hero-collage/torn-paper-top-right.svg"
          alt=""
          fill
          className={styles.tornPaperImage}
          priority
        />
      </div>

      {/* TORN PAPER WING (Red Circle 3): Mid-Right Curved Parchment Sheet */}
      <div className={styles.parchmentWingRight}>
        <Image
          src="/images/hero-collage/parchment-wing-right.svg"
          alt=""
          fill
          className={styles.tornPaperImage}
          priority
        />
      </div>

      {/* BLUE RIBBON LINE 3 (Red Circle 3): Right-Side Sweeping Blue Ribbon Line */}
      <div className={styles.blueRibbonLine3}>
        <Image
          src="/images/hero-collage/blue-ribbon-line-3.svg"
          alt=""
          fill
          className={styles.tornPaperImage}
          priority
        />
      </div>

      {/* TORN PAPER BASE: Bottom-Right Corner Torn Paper Continent */}
      <div className={styles.bottomRightTornSheet}>
        <Image
          src="/images/hero-collage/torn-paper-bottom-right.svg"
          alt=""
          fill
          className={styles.tornPaperImage}
          priority
        />
      </div>

      {/* R1: Cosmic Galaxy Photo Card (Real Space Imagery) */}
      <div className={styles.galaxyCard}>
        <div className={styles.galaxyInner}>
          <Image
            src="/images/hero-collage/real-galaxy.jpg"
            alt=""
            fill
            className={styles.galaxyImage}
            sizes="360px"
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
            width={18}
            height={18}
          />
        </div>
        {/* Top-left tape pinning the scrap */}
        <div
          className={styles.tapeStrip}
          style={{
            width: 48,
            height: 16,
            top: -4,
            left: 14,
            transform: 'rotate(-16deg)',
          }}
        />
      </div>

      {/* R3: Disciplines Strip with Clean Tracked Sans (Live HTML) */}
      <div className={styles.disciplinesStrip}>
        <div
          className={styles.tapeStrip}
          style={{
            width: 32,
            height: 12,
            top: -6,
            left: 45,
            transform: 'rotate(2deg)',
          }}
        />
        <pre className={styles.disciplinesText}>
          ART{'\n'}
          SCIENCE{'\n'}
          TECHNOLOGY{'\n'}
          HUMANITIES{'\n'}
          CREATIVITY{'\n'}
          AND BEYOND
        </pre>
        <div className={styles.disciplinesRule} />
      </div>

      {/* R4: Folded Royal Blue Origami Crane (Vector Craft with Ambient Drop Shadow) */}
      <div className={styles.origamiCrane}>
        <Image
          src="/images/hero-collage/real-origami-crane.svg"
          alt=""
          width={92}
          height={110}
          style={{ width: 'auto', height: 'auto' }}
        />
      </div>

      {/* R6: Ceramic Coffee Mug on Vintage Books with "Good Ideas Travel Far" */}
      <div className={styles.mugBooksCard}>
        <Image
          src="/images/hero-collage/real-mug-books.jpg"
          alt=""
          fill
          className={styles.mugBooksImage}
          sizes="280px"
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
            sizes="140px"
          />
        </div>
      </div>

      {/* R7: St. Peter's Basilica Dome Architectural Print with Crisp White Border */}
      <div className={styles.cathedralCard}>
        <div className={styles.cathedralInner}>
          <Image
            src="/images/hero-collage/real-cathedral.jpg"
            alt=""
            fill
            className={styles.cathedralImage}
            sizes="220px"
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
    </div>
  );
}
