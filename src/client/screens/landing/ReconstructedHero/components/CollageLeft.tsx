'use client';

import React from 'react';
import Image from 'next/image';
import styles from '../ReconstructedHero.module.css';

export function CollageLeft() {
  return (
    <div className={styles.collageLeft} aria-hidden="true">
      {/* TORN PAPER BASE: Top-Left Torn Paper Continent */}
      <div className={styles.topLeftTornSheet}>
        <Image
          src="/images/hero-collage/torn-paper-top-left.svg"
          alt=""
          fill
          className={styles.tornPaperImage}
          priority
        />
      </div>

      {/* TORN PAPER BASE: Bottom-Left Corner Torn Paper Continent */}
      <div className={styles.bottomLeftTornSheet}>
        <Image
          src="/images/hero-collage/torn-paper-bottom-left.svg"
          alt=""
          fill
          className={styles.tornPaperImage}
          priority
        />
      </div>

      {/* L0: Top-Left Torn Blue Paper Scrap with Tape */}
      <div className={styles.topLeftBlueScrap}>
        <div
          className={styles.tapeStrip}
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
      <div className={styles.windowPhotoCard}>
        <Image
          src="/images/hero-collage/real-window-person.jpg"
          alt=""
          fill
          className={styles.windowPhotoImage}
          sizes="320px"
          priority
        />
        {/* White handwritten cursive annotation placed on the left side */}
        <p className={styles.windowPhotoAnnotation}>
          Same questions.
          <br />
          A brighter you.
        </p>

        {/* Top-left masking tape */}
        <div
          className={styles.tapeStrip}
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
          className={styles.tapeStrip}
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
      <div className={styles.blueTornScrap} />

      {/* L2: Live HTML Kraft Paper List Scrap with Architectural Typography */}
      <div className={styles.kraftListScrap}>
        <pre className={styles.kraftListText}>
          IDEAS{'\n'}
          PEOPLE{'\n'}
          PLACES{'\n'}
          KNOWLEDGE{'\n'}
          SKILLS{'\n'}
          A KINDER YOU
        </pre>
      </div>

      {/* L3: Pressed Dried Herbarium Meadow Flower Specimen (Vector Craft) */}
      <div className={styles.botanicalSpecimen}>
        <Image
          src="/images/hero-collage/real-botanical.svg"
          alt=""
          width={90}
          height={130}
          style={{ width: 'auto', height: 'auto' }}
        />
      </div>

      {/* L4: Alpine Mountain Peaks Photo Card with Crisp White Print Border */}
      <div className={styles.mountainsCard}>
        <div className={styles.mountainsInner}>
          <Image
            src="/images/hero-collage/real-mountains.jpg"
            alt=""
            fill
            className={styles.mountainsImage}
            sizes="240px"
          />
        </div>
      </div>

      {/* L6: Deep Monochrome Lunar Crater Sphere with Dark Ring */}
      <div className={styles.moonSphere}>
        <Image
          src="/images/hero-collage/real-moon.jpg"
          alt=""
          fill
          className={styles.moonImage}
          sizes="110px"
        />
      </div>

      {/* L5: Live HTML Curiosity Lives Torn Scrap */}
      <div className={styles.curiosityNoteScrap}>
        <p className={styles.curiosityNoteText}>
          Curiosity
          <br />
          lives a
          <br />
          longer life.
        </p>
      </div>

      {/* 8-point royal blue celestial star doodle beside the moon circle */}
      <div className={styles.leftStarDoodle}>
        <Image
          src="/images/hero-collage/star-doodle.svg"
          alt=""
          width={24}
          height={24}
        />
      </div>

      {/* Organic pencil flourish arc linking window photo area down to star doodle */}
      <svg
        className={styles.leftFlourishArc}
        viewBox="0 0 160 380"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M 40 20 C 120 110 110 260 55 365"
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
