'use client';

import React from 'react';
import Image from 'next/image';
import styles from '../Hero.module.css';

export function CollageLeft() {
  return (
    <div className={styles.collageLeft} data-editable-id="collageLeft">
      {/* TORN PAPER BASE: Top-Left Torn Paper Continent */}
      <div className={styles.topLeftTornSheet} data-editable-id="topLeftTornSheet">
        <Image
          src="/images/hero-collage/torn-paper-top-left.svg"
          alt=""
          fill
          className={styles.tornPaperImage} data-editable-id="tornPaperImage"
          priority
        />
      </div>

      {/* TORN PAPER WING (Red Circle 1): Upper-Left Curved Parchment Scrap */}
      <div className={styles.parchmentWingLeft} data-editable-id="parchmentWingLeft">
        <Image
          src="/images/hero-collage/parchment-wing-left.svg"
          alt=""
          fill
          className={styles.tornPaperImage} data-editable-id="tornPaperImage"
          priority
        />
      </div>

      {/* BLUE RIBBON LINE 1 (Red Circle 1): Upper-Left Smooth Blue Arc */}
      <div className={styles.blueRibbonLine1} data-editable-id="blueRibbonLine1">
        <Image
          src="/images/hero-collage/blue-ribbon-line-1.svg"
          alt=""
          fill
          className={styles.tornPaperImage} data-editable-id="tornPaperImage"
          priority
        />
      </div>

      {/* TORN PAPER DIAGONAL (Red Circle 2): Lower-Left Diagonal Parchment Runner */}
      <div className={styles.parchmentDiagonalLeft} data-editable-id="parchmentDiagonalLeft">
        <Image
          src="/images/hero-collage/parchment-diagonal-left.svg"
          alt=""
          fill
          className={styles.tornPaperImage} data-editable-id="tornPaperImage"
          priority
        />
      </div>

      {/* BLUE RIBBON LINE 2 (Red Circle 2): Bottom-Left Long Diagonal Blue Ribbon Line */}
      <div className={styles.blueRibbonLine2} data-editable-id="blueRibbonLine2">
        <Image
          src="/images/hero-collage/blue-ribbon-line-2.svg"
          alt=""
          fill
          className={styles.tornPaperImage} data-editable-id="tornPaperImage"
          priority
        />
      </div>

      {/* TORN PAPER BASE: Bottom-Left Corner Torn Paper Continent */}
      <div className={styles.bottomLeftTornSheet} data-editable-id="bottomLeftTornSheet">
        <Image
          src="/images/hero-collage/torn-paper-bottom-left.svg"
          alt=""
          fill
          className={styles.tornPaperImage} data-editable-id="tornPaperImage"
          priority
        />
      </div>



      {/* L0: Top-Left Torn Blue Paper Scrap with Tape */}
      <div className={styles.topLeftBlueScrap} data-editable-id="topLeftBlueScrap">
        <div
          className={styles.tapeStrip} data-editable-id="tapeStrip"
          style={{
            width: 36,
            height: 15,
            top: 24,
            left: -4,
            transform: 'rotate(18deg)',
          }}
        />
      </div>

      {/* L1: Window Black & White Photo with White Script & Dual Tape */}
      <div className={styles.windowPhotoCard} data-editable-id="windowPhotoCard">
        <Image
          src="/images/hero-collage/real-window-person.jpg"
          alt=""
          fill
          className={styles.windowPhotoImage} data-editable-id="windowPhotoImage"
          sizes="320px"
          priority
        />
        {/* White handwritten cursive annotation placed on the left side */}
        <p className={styles.windowPhotoAnnotation} data-editable-id="windowPhotoAnnotation">
          Same questions.
          <br />
          A brighter you.
        </p>

        {/* Top-left masking tape */}
        <div
          className={styles.tapeStrip} data-editable-id="tapeStrip"
          style={{
            width: 52,
            height: 18,
            top: 10,
            left: 36,
            transform: 'rotate(-36deg)',
          }}
        />
        {/* Top-edge horizontal masking tape */}
        <div
          className={styles.tapeStrip} data-editable-id="tapeStrip"
          style={{
            width: 56,
            height: 17,
            top: 4,
            left: 145,
            transform: 'rotate(-2deg)',
          }}
        />
      </div>

      {/* L7: Live HTML Torn Cobalt Blue Scrap behind kraft note */}
      <div className={styles.blueTornScrap} data-editable-id="blueTornScrap" />

      {/* L2: Live HTML Kraft Paper List Scrap with Architectural Typography */}
      <div className={styles.kraftListScrap} data-editable-id="kraftListScrap">
        <pre className={styles.kraftListText} data-editable-id="kraftListText">
          IDEAS{'\n'}
          PEOPLE{'\n'}
          PLACES{'\n'}
          KNOWLEDGE{'\n'}
          SKILLS{'\n'}
          A KINDER YOU
        </pre>
      </div>

      {/* L3: Pressed Dried Herbarium Meadow Flower Specimen (Vector Craft) */}
      <div className={styles.botanicalSpecimen} data-editable-id="botanicalSpecimen">
        <Image
          src="/images/hero-collage/real-botanical.svg"
          alt=""
          width={90}
          height={130}
          style={{ width: 'auto', height: 'auto' }}
        />
      </div>

      {/* L4: Alpine Mountain Peaks Photo Card with Crisp White Print Border */}
      <div className={styles.mountainsCard} data-editable-id="mountainsCard">
        <div className={styles.mountainsInner} data-editable-id="mountainsInner">
          <Image
            src="/images/hero-collage/real-mountains.jpg"
            alt=""
            fill
            className={styles.mountainsImage} data-editable-id="mountainsImage"
            sizes="240px"
          />
        </div>
      </div>

      {/* L6: Deep Monochrome Lunar Crater Sphere with Dark Ring */}
      <div className={styles.moonSphere} data-editable-id="moonSphere">
        <Image
          src="/images/hero-collage/real-moon.jpg"
          alt=""
          fill
          className={styles.moonImage} data-editable-id="moonImage"
          sizes="110px"
        />
      </div>

      {/* L5: Live HTML Curiosity Lives Torn Scrap */}
      <div className={styles.curiosityNoteScrap} data-editable-id="curiosityNoteScrap">
        <p className={styles.curiosityNoteText} data-editable-id="curiosityNoteText">
          Curiosity
          <br />
          lives a
          <br />
          longer life.
        </p>
      </div>

      {/* 8-point royal blue celestial star doodle beside the moon circle */}
      <div className={styles.leftStarDoodle} data-editable-id="leftStarDoodle">
        <Image
          src="/images/hero-collage/star-doodle.svg"
          alt=""
          width={24}
          height={24}
        />
      </div>
    </div>
  );
}
