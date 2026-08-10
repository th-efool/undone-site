import styles from './ExploreHero.module.css';
import Image from 'next/image';

export function ExploreHero() {
  return (
    <section className={styles.hero}>
      <div className={styles.bannerContainer}>
        <Image
          src="/mobile/explore/explore-hero-banner-mobile.webp"
          alt="Explore Banner"
          width={1000}
          height={1000}
          className={styles.bannerImage}
          priority
        />
      </div>
      
      <div className={styles.content}>
        <h1 className={styles.headline}>
          <span className={styles.line1}>SINK DOWN</span>
          <span className={styles.line2}>THE RABBIT HOLE.</span>
        </h1>
        <p className={styles.subheadline}>
          <span className={styles.subline1}>SEE HOW FAR YOUR</span>
          <span className={styles.subline2}>CURIOSITY TAKES YOU.</span>
        </p>
      </div>
    </section>
  );
}
