'use client';

import React from 'react';
import Image from 'next/image';
import styles from '../Hero.module.css';

export function CollageRight() {
  return (
    <div className={styles.collageRight} data-editable-id="collageRight">
      {/* TORN PAPER BASE: Top-Right Torn Paper Frame */}
      <div className={styles.topRightTornSheet} data-editable-id="topRightTornSheet">
        <Image
          src="/images/hero-collage/torn-paper-top-right.svg"
          alt=""
          fill
          className={styles.tornPaperImage} data-editable-id="tornPaperImage"
          priority
        />
      </div>

      {/* TORN PAPER WING (Red Circle 3): Mid-Right Curved Parchment Sheet */}
      <div className={styles.parchmentWingRight} data-editable-id="parchmentWingRight">
        <Image
          src="/images/hero-collage/parchment-wing-right.svg"
          alt=""
          fill
          className={styles.tornPaperImage} data-editable-id="tornPaperImage"
          priority
        />
      </div>

      {/* BLUE RIBBON LINE 3 (Red Circle 3): Right-Side Sweeping Blue Ribbon Line */}
      <div className={styles.blueRibbonLine3} data-editable-id="blueRibbonLine3">
        <Image
          src="/images/hero-collage/blue-ribbon-line-3.svg"
          alt=""
          fill
          className={styles.tornPaperImage} data-editable-id="tornPaperImage"
          priority
        />
      </div>

      {/* TORN PAPER BASE: Bottom-Right Corner Torn Paper Continent */}
      <div className={styles.bottomRightTornSheet} data-editable-id="bottomRightTornSheet">
        <Image
          src="/images/hero-collage/torn-paper-bottom-right.svg"
          alt=""
          fill
          className={styles.tornPaperImage} data-editable-id="tornPaperImage"
          priority
        />
      </div>

      {/* MID FILL PARCHMENT (Right): Bridges mid collage downward */}
      <div className={styles.midFillParchmentRight} data-editable-id="midFillParchmentRight">
        <Image
          src="/images/hero-collage/parchment-mid-fill-right.svg"
          alt=""
          fill
          className={styles.tornPaperImage} data-editable-id="tornPaperImage"
          priority
        />
      </div>



      {/* R1: Cosmic Galaxy Photo Card (Real Space Imagery) */}
      <div className={styles.galaxyCard} data-editable-id="galaxyCard">
        <div className={styles.galaxyInner} data-editable-id="galaxyInner">
          <Image
            src="/images/hero-collage/real-galaxy.jpg"
            alt=""
            fill
            className={styles.galaxyImage} data-editable-id="galaxyImage"
            sizes="360px"
            priority
          />
        </div>
      </div>

      {/* R2: "A more curious tomorrow" Note (Live HTML & Live Typography) */}
      <div className={styles.curiousTomorrowScrap} data-editable-id="curiousTomorrowScrap">
        <p className={styles.curiousTomorrowText} data-editable-id="curiousTomorrowText">
          A
          <br />
          more
          <br />
          curious
          <br />
          tomorrow.
        </p>
        {/* Handcrafted 8-point celestial star doodle */}
        <div className={styles.tomorrowStarDoodle} data-editable-id="tomorrowStarDoodle">
          <Image
            src="/images/hero-collage/star-doodle.svg"
            alt=""
            width={18}
            height={18}
          />
        </div>
        {/* Top-left tape pinning the scrap */}
        <div
          className={styles.tapeStrip} data-editable-id="tapeStrip"
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
      <div className={styles.disciplinesStrip} data-editable-id="disciplinesStrip">
        <div
          className={styles.tapeStrip} data-editable-id="tapeStrip"
          style={{
            width: 32,
            height: 12,
            top: -6,
            left: 45,
            transform: 'rotate(2deg)',
          }}
        />
        <pre className={styles.disciplinesText} data-editable-id="disciplinesText">
          ART{'\n'}
          SCIENCE{'\n'}
          TECHNOLOGY{'\n'}
          HUMANITIES{'\n'}
          CREATIVITY{'\n'}
          AND BEYOND
        </pre>
        <div className={styles.disciplinesRule} data-editable-id="disciplinesRule" />
      </div>

      {/* R4: Folded Royal Blue Origami Crane (Vector Craft with Ambient Drop Shadow) */}
      <div className={styles.origamiCrane} data-editable-id="origamiCrane">
        <Image
          src="/images/hero-collage/real-origami-crane.svg"
          alt=""
          width={92}
          height={110}
          style={{ width: 'auto', height: 'auto' }}
        />
      </div>

      {/* R6: Ceramic Coffee Mug on Vintage Books with "Good Ideas Travel Far" */}
      <div className={styles.mugBooksCard} data-editable-id="mugBooksCard">
        <Image
          src="/images/hero-collage/real-mug-books.jpg"
          alt=""
          fill
          className={styles.mugBooksImage} data-editable-id="mugBooksImage"
          sizes="280px"
        />
      </div>

      {/* R5: Antique Celestial Star Chart Map Photo */}
      <div className={styles.mapCard} data-editable-id="mapCard">
        <div className={styles.mapInner} data-editable-id="mapInner">
          <Image
            src="/images/hero-collage/real-map.jpg"
            alt=""
            fill
            className={styles.mapImage} data-editable-id="mapImage"
            sizes="140px"
          />
        </div>
      </div>

      {/* R7: St. Peter's Basilica Dome Architectural Print with Crisp White Border */}
      <div className={styles.cathedralCard} data-editable-id="cathedralCard">
        <div className={styles.cathedralInner} data-editable-id="cathedralInner">
          <Image
            src="/images/hero-collage/real-cathedral.jpg"
            alt=""
            fill
            className={styles.cathedralImage} data-editable-id="cathedralImage"
            sizes="220px"
          />
        </div>
      </div>

      {/* R9: Substantial "Different Paths Same Sky" Cobalt Paper Sheet (Live HTML) */}
      <div className={styles.blueBannerRibbon} data-editable-id="blueBannerRibbon">
        <div className={styles.blueBannerInner} data-editable-id="blueBannerInner">
          <p className={styles.blueBannerText} data-editable-id="blueBannerText">
            Different
            <br />
            Paths
            <br />
            Same Sky
          </p>
          {/* Subtle star sparkle doodle on banner */}
          <span className={styles.blueBannerSparkle} data-editable-id="blueBannerSparkle">✦</span>
        </div>
      </div>

      {/* R8: Collect / Learn / Create / Repeat Scrap (Live HTML) */}
      <div className={styles.collectRepeatScrap} data-editable-id="collectRepeatScrap">
        <p className={styles.collectRepeatText} data-editable-id="collectRepeatText">
          Collect
          <br />
          Learn
          <br />
          Create
          <br />
          Repeat
        </p>
        <div className={styles.collectRepeatRule} data-editable-id="collectRepeatRule" />
      </div>
    </div>
  );
}
