import React from 'react';
import styles from './loading.module.css';

export default function Loading() {
  return (
    <div className={styles.container} aria-live="polite" aria-busy="true">
      <div className={styles.textureOverlay} aria-hidden="true" />
      <div className={styles.aura} aria-hidden="true" />

      <div className={styles.contentWrapper}>
        <div className={styles.spinnerWrapper}>
          <div className={styles.spinnerTrack} />
          <div className={styles.spinnerOuter} />
          <div className={styles.spinnerInner} />
          <div className={styles.spinnerCenterDot} />
        </div>

        <div className={styles.brandInfo}>
          <span className={styles.brandTitle}>UNDONE</span>
          <span className={styles.brandTagline}>For a more curious you.</span>
        </div>
      </div>
    </div>
  );
}
