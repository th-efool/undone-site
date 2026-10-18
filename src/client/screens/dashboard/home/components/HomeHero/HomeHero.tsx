'use client';

import React, { useMemo } from 'react';
import styles from './HomeHero.module.css';

export interface HomeHeroProps {
  userName?: string;
  // Optional backward compatibility props for existing models/callers:
  content?: any;
  summaries?: any[];
  searchValue?: string;
  searchPlaceholder?: string;
  onSearchChange?: (value: string) => void;
  weeklyMinutes?: number;
  activeDays?: number;
  pace?: number;
  onPaceClick?: () => void;
}

export function HomeHero({ userName }: HomeHeroProps) {
  const { greeting, emoji } = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) {
      return { greeting: 'Good morning', emoji: '☀️' };
    }
    if (hour < 17) {
      return { greeting: 'Good afternoon', emoji: '☀️' };
    }
    return { greeting: 'Good evening', emoji: '🌙' };
  }, []);

  const firstName = useMemo(() => {
    if (!userName || !userName.trim()) return '';
    return userName.trim().split(/\s+/)[0];
  }, [userName]);

  return (
    <header className={styles.hero} aria-label="Dashboard Hero">
      <div className={styles.greetingRow}>
        <span className={styles.greetingText} suppressHydrationWarning>
          {greeting}{firstName ? `, ${firstName}` : ''} {emoji}
        </span>
      </div>

      <h1 className={styles.headline}>
        A little <span className={styles.headlineItalic}>curiosity</span> goes a long way.
      </h1>

      <p className={styles.subtitle}>
        Turn anything you&apos;re curious about into a personalized learning journey.
      </p>
    </header>
  );
}
