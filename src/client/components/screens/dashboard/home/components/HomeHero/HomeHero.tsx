import Link from 'next/link';
import { Plus, Sparkles } from 'lucide-react';

import type { HomeHeroContent } from '../../models';

import styles from './HomeHero.module.css';

export interface HomeHeroProps {
  content: HomeHeroContent;
}

export function HomeHero({ content }: HomeHeroProps) {
  return (
    <header className={styles.hero}>
      <div className={styles.greeting}>
        <h1 className={styles.title}>
          {content.title}
          <Sparkles
            size={24}
            strokeWidth={2.5}
            className={styles.sparkle}
          />
        </h1>

        <p className={styles.subtitle}>{content.subtitle}</p>
      </div>

      <Link
        href="/create-cohort"
        className={styles.newButton}
      >
        <Plus
          size={20}
          strokeWidth={2.4}
        />
        {content.actionLabel}
      </Link>
    </header>
  );
}
