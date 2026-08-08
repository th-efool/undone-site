'use client';

import Image from 'next/image';
import styles from './ExploreHero.module.css';

export function ExploreHero() {
  return (
    <header className={styles.hero}>
      <div className={styles.leftCloudsWrapper}>
        <Image
          src="/images/explore/clouds.webp"
          alt=""
          width={1000}
          height={400}
          className={styles.leftCloudsImage}
          priority
        />
      </div>
      <h1 className={styles.headline}>
        <span className={styles.line}>SINK DOWN THE RABBIT HOLE.</span>
        <span className={styles.line}>SEE HOW FAR</span>
        <span className={styles.line}>YOUR CURIOSITY TAKES YOU.</span>
      </h1>
      <div className={styles.imageWrapper}>
        <Image
          src="/images/explore/explore-hero.webp"
          alt="Explore Hero"
          width={1200}
          height={800}
          className={styles.heroImage}
          priority
        />
      </div>
    </header>
  );
}


