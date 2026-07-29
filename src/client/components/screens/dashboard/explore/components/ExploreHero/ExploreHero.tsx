import { Sparkles } from 'lucide-react';

import styles from './ExploreHero.module.css';

export function ExploreHero() {
  return (
    <header className={styles.hero}>
      <h1 className={styles.title}>
        Good evening, Shaqun
        <Sparkles
          size={20}
          strokeWidth={2.5}
          className={styles.sparkle}
        />
      </h1>

      <p className={styles.subtitle}>What are you curious about today?</p>
    </header>
  );
}
