import Image from 'next/image';
import { Link2, Target, TrendingUp } from 'lucide-react';
import styles from './FeatureSection.module.css';

export function FeatureSection() {
  return (
    <div className={styles.featureSection}>
      <div className={styles.videoPanel}>
        <Image
          src="/images/landing/screen.webp"
          alt="SideQuestHQ AI learning interface"
          width={1280}
          height={720}
          priority
          draggable={false}
          className={styles.videoImage}
        />
      </div>

      <div className={styles.featureCopy}>
        <h2 className={styles.featureTitle}>
          We turn Interstitial
          <br />
          moments into meaningful
          <br />
          learning experience.
        </h2>

        <ul className={styles.featureList}>
          <li className={styles.featureItem}>
            
            <span>Automatically picks the right next piece</span>
          </li>
          <li className={styles.featureItem}>
            <Link2
              className={styles.featureIcon}
              strokeWidth={2.25}
            />
            <span>Remembers everything for you</span>
          </li>
          <li className={styles.featureItem}>
            <Target
              className={styles.featureIcon}
              strokeWidth={2.25}
            />
            <span>Adapts to your time, energy, and goals</span>
          </li>
          <li className={styles.featureItem}>
            <TrendingUp
              className={styles.featureIcon}
              strokeWidth={2.25}
            />
            <span>Tracks progress across all your interests</span>
          </li>
        </ul>
      </div>

      <aside className={styles.feedPanel}>
        <h3 className={styles.feedTitle}>Stochastic Adaptive Feed</h3>
        <p className={styles.feedDescription}>
          A personalized feed that reshuffles throughout the day using spaced repetition, priority,
          and your real-time availability.
        </p>

        <div className={styles.phoneIllustration}>
          <Image
            src="/images/landing/phone.webp"
            alt="SideQuestHQ adaptive feed"
            width={170}
            height={320}
            draggable={false}
            className={styles.phone}
          />
          <Image
            src="/images/landing/hand.webp"
            alt=""
            aria-hidden="true"
            width={110}
            height={130}
            draggable={false}
            className={styles.hand}
          />
        </div>

        <p className={styles.feedCaption}>
          Just scroll—like Instagram.
          <br />
          We handle the rest.
        </p>
        <div className={styles.feedBadge}>Digestible. Focused. Always relevant.</div>
      </aside>
    </div>
  );
}
