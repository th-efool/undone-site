import Link from 'next/link';
import { Plus, Sparkles } from 'lucide-react';

import styles from './ExploreHero.module.css';

export function ExploreHero() {
  return (
    <header className={styles.hero}>
      <div className={styles.greeting}>
        <h1 className={styles.title}>
          Good evening, Shaqun
          <Sparkles
            size={20}
            strokeWidth={2.5}
            className={styles.sparkle}
          />
        </h1>

        <p className={styles.subtitle}>What are you curious about today?</p>
      </div>

      <Link
        href="/create-cohort"
        className={styles.newButton}
      >
        <Plus
          size={20}
          strokeWidth={2.4}
        />
        New Cohort
      </Link>
    </header>
  );
}
