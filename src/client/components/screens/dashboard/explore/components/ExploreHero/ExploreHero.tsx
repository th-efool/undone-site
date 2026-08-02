'use client';

import Link from 'next/link';
import { Plus, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';

import styles from './ExploreHero.module.css';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function ExploreHero() {
  const [greeting, setGreeting] = useState(getGreeting);

  useEffect(() => {
    // Re-evaluate on mount to ensure correct greeting for the current time
    setGreeting(getGreeting());
  }, []);

  return (
    <header className={styles.hero}>
      <div className={styles.greeting}>
        <h1 className={styles.title}>
          {greeting}
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
