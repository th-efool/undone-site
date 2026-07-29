import styles from './authShowcase.module.css';
import AuthCommunityGrid from './authCommunityGrid';
import AuthFeaturedContent from './authFeaturedContent';
import { AuthPhone } from './authPhone';
import { ArrowRight } from 'lucide-react';
import AuthHighlights from './authHighlights';

export default function AuthShowcase() {
  return (
    <section className={styles.showcase}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.heading}>
            Join a Community of <span className={styles.highlight}>Curious Minds</span>
          </h1>

          <p className={styles.description}>
            Your next favorite people probably aren&#39;t on your social feed.
          </p>
        </div>
      </header>

      <section className={styles.communitySection}>
        <div className={styles.communityStage}>
          <div className={styles.communityGrid}>
            <AuthCommunityGrid />
          </div>

          <AuthPhone />
        </div>
      </section>

      <section className={styles.featuredSection}>
        <AuthFeaturedContent />
      </section>

      <section className={styles.highlights}>
        <AuthHighlights />
      </section>
    </section>
  );
}
