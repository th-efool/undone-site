'use client';

import styles from './ExploreHero.module.css';

export function ExploreHero() {
  return (
    <header className={styles.hero}>
      <h1 className={styles.headline}>
        <span className={styles.line}>SINK DOWN THE RABBIT HOLE.</span>
        <span className={styles.line}>SEE HOW FAR</span>
        <span className={styles.line}>YOUR CURIOSITY TAKES YOU.</span>
      </h1>
    </header>
  );
}

