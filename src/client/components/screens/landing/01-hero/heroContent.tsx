import styles from './heroContent.module.css';
import Link from 'next/link';

export function HeroContent() {
  return (
    <section className={styles.content}>
      <div className={styles.eyebrow}>
        Bookmarks · Watch later · Half-finished courses · Dropped hobbies
      </div>

      <h1 className={styles.title}>
        Curiosity shouldn&#39;t feel like <span className={styles.titleAccent}>a burden.</span>
      </h1>

      <p className={styles.description}>
        Somewhere along the way, your curiosity became another item on your to-do list, constantly
        pushed aside by responsibilities.
      </p>

      <div className={styles.actions}>
        <Link
          href="/auth"
          className={styles.ctaButton}
        >
          <span>Start Your Next SideQuest</span>
          <span className={styles.ctaIcon}>→</span>
        </Link>
      </div>

      <div className={styles.note}>
        It only takes 2 minutes.
        <br />
        It&#39;ll keep the momentum.
      </div>
    </section>
  );
}
