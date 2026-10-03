'use client';

import React from 'react';
import Image from 'next/image';
import styles from '../ReconstructedHero.module.css';

export function CollageLeft() {
  return (
    <div className={styles.collageLeft} aria-hidden="true">
      {/* L1: Window Black & White Photo with Live Typography & Dual Tape */}
      <div className={styles.windowPhotoCard}>
        <Image
          src="/images/hero-collage/real-window-person.jpg"
          alt=""
          fill
          className={styles.windowPhotoImage}
          sizes="260px"
          priority
        />
        {/* Live text annotation overlay */}
        <p className={styles.windowPhotoAnnotation}>
          Same questions.
          <br />
          A brighter you.
        </p>

        {/* Top-left masking tape */}
        <div
          className={styles.tapeStrip}
          style={{
            width: 46,
            height: 18,
            top: 14,
            left: 50,
            transform: 'rotate(-38deg)',
          }}
        />
        {/* Top-edge horizontal masking tape */}
        <div
          className={styles.tapeStrip}
          style={{
            width: 50,
            height: 17,
            top: 4,
            left: 140,
            transform: 'rotate(-2deg)',
          }}
        />
      </div>

      {/* L7: Live HTML Torn Cobalt Blue Scrap */}
      <div className={styles.blueTornScrap} />

      {/* L2: Live HTML Kraft Paper List Scrap */}
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

      {/* L3: Pressed Dried Herbarium Botanical Specimen (Vector Craft) */}
      <div
        style={{
          position: 'absolute',
          top: 270,
          left: 10,
          width: 74,
          height: 105,
          transform: 'rotate(8deg)',
          zIndex: 40,
        }}
      >
        <Image
          src="/images/hero-collage/real-botanical.svg"
          alt=""
          width={74}
          height={105}
        />
      </div>

      {/* L4: Mountain Peaks Photo (Real Alpine Ridge) */}
      <div className={styles.mountainsCard}>
        <Image
          src="/images/hero-collage/real-mountains.jpg"
          alt=""
          fill
          className={styles.mountainsImage}
          sizes="160px"
        />
      </div>

      {/* L6: Real Lunar Crater Sphere */}
      <div className={styles.moonSphere}>
        <Image
          src="/images/hero-collage/real-moon.jpg"
          alt=""
          fill
          className={styles.moonImage}
          sizes="80px"
        />
      </div>

      {/* L5: Live HTML Curiosity Lives Scrap */}
      <div className={styles.curiosityNoteScrap}>
        <p className={styles.curiosityNoteText}>
          Curiosity
          <br />
          lives a
          <br />
          longer life.
        </p>
      </div>

      {/* 8-point blue celestial star doodle beside the moon */}
      <div className={styles.leftStarDoodle}>
        <Image
          src="/images/hero-collage/star-doodle.svg"
          alt=""
          width={22}
          height={22}
        />
      </div>

      {/* Subtle organic pencil flourish arc linking kraft paper to star */}
      <svg
        className={styles.leftFlourishArc}
        viewBox="0 0 100 160"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M 20 10 C 65 60 45 110 75 150"
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
