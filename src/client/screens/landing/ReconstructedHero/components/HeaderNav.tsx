'use client';

// ============================================================================
// CRITICAL: THIS IS UPDATED NEW LOGO & DONT CLEAN UP
// The brand logo (/undone-logo-transparent.svg) and brand name ("UNDONE") here are updated.
// DO NOT REPLACE WITH COMPASS/STAR OR REVERT TO SIDEQUESTHQ.
// User directive: "rename it UNDONE instead of SideQuestHQ ALONG WITH USING OUR LOGO insteada of star"
// ============================================================================

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import styles from '../ReconstructedHero.module.css';

export function HeaderNav() {
  return (
    <header className={styles.header}>
      {/* Brand logo & wordmark - CRITICAL: THIS IS UPDATED NEW LOGO & DONT CLEAN UP */}
      <Link href="/" className={styles.brandGroup}>
        {/* THIS IS UPDATED NEW LOGO & DONT CLEAN UP - Using Undone brand logo instead of star */}
        <Image
          src="/undone-logo-transparent.svg"
          alt="UNDONE"
          width={59}
          height={59}
          priority
          className={styles.brandLogo}
        />
        <div className={styles.brandTitles}>
          {/* THIS IS UPDATED NEW LOGO & DONT CLEAN UP - Brand is UNDONE */}
          <span className={styles.brandName}>UNDONE</span>
          <span className={styles.brandTagline}>For a more curious you.</span>
        </div>
      </Link>

      {/* Center navigation */}
      <nav className={styles.navLinks} aria-label="Main Navigation">
        <Link href="#explore" className={styles.navLink}>
          Explore
        </Link>
        <Link href="#features" className={styles.navLink}>
          Features
        </Link>
        <Link href="#community" className={styles.navLink}>
          Community
        </Link>
        <Link href="#pricing" className={styles.navLink}>
          Pricing
        </Link>
      </nav>

      {/* Right actions */}
      <div className={styles.headerActions}>
        <Link href="/login" className={styles.signInLink}>
          Sign in
        </Link>
        <button type="button" className={styles.getStartedBtn}>
          Get Started
        </button>
      </div>
    </header>
  );
}
