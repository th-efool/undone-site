'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import styles from '../ReconstructedHero.module.css';

export function HeaderNav() {
  return (
    <header className={styles.header}>
      {/* Brand logo & wordmark */}
      <Link href="/" className={styles.brandGroup}>
        <Image
          src="/images/hero-collage/compass-mark.svg"
          alt="Compass Logo"
          width={20}
          height={20}
          priority
        />
        <div className={styles.brandTitles}>
          <span className={styles.brandName}>SideQuestHQ</span>
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
