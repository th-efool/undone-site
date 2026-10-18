'use client';

import React from 'react';
import Image from 'next/image';
import { Check } from 'lucide-react';
import styles from './HomeStreakWidget.module.css';

export interface HomeStreakWidgetProps {
  todayMinutes?: number;
  dailyGoalMinutes?: number;
  streakDays?: number;
  weekActivity?: boolean[];
  weekBarHeights?: number[];
  className?: string;
}

const DEFAULT_DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const DEFAULT_HEIGHTS = [0.45, 0.65, 0.88, 0.72, 0.95, 0.25, 0.18];
const DEFAULT_ACTIVITY = [true, true, true, true, true, false, false];

export function HomeStreakWidget({
  todayMinutes = 18,
  dailyGoalMinutes = 30,
  streakDays = 12,
  weekActivity = DEFAULT_ACTIVITY,
  weekBarHeights = DEFAULT_HEIGHTS,
  className,
}: HomeStreakWidgetProps) {
  return (
    <div className={`${styles.card} ${className || ''}`.trim()}>
      <div className={styles.leftContent}>
        <h3 className={styles.title}>You&apos;re doing great!</h3>
        <span className={styles.progressLabel}>
          {todayMinutes} / {dailyGoalMinutes} min &bull; {streakDays} day streak
        </span>

        <div className={styles.chartContainer}>
          {DEFAULT_DAYS.map((day, idx) => {
            const isCompleted = weekActivity[idx];
            const heightPct = Math.round((weekBarHeights[idx] || 0.3) * 100);

            return (
              <div key={idx} className={styles.dayColumn}>
                <div className={styles.barTrack}>
                  <div
                    className={`${styles.barFill} ${isCompleted ? styles.barFillCompleted : ''}`}
                    style={{ height: `${heightPct}%` }}
                  />
                </div>
                <span className={styles.dayInitial}>{day}</span>
                {isCompleted ? (
                  <div className={styles.checkIndicator}>
                    <Check size={9} strokeWidth={3.5} />
                  </div>
                ) : (
                  <div className={styles.checkPlaceholder} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className={styles.rightContent}>
        <div className={styles.calloutWrapper}>
          <span className={styles.calloutText}>Keep exploring!</span>
          <svg
            width="18"
            height="16"
            viewBox="0 0 20 18"
            fill="none"
            className={styles.curvedArrow}
            aria-hidden="true"
          >
            <path
              d="M2 1 C 8 3, 14 7, 14 14 M10 11 L14 14 L16 9"
              stroke="#2535a5"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <div className={styles.mascotWrapper}>
          <span className={styles.sparkle1} aria-hidden="true">✦</span>
          <span className={styles.sparkle2} aria-hidden="true">✦</span>
          <Image
            src="/images/home/streak-mascot.png"
            alt="Study mascot"
            width={96}
            height={96}
            className={styles.mascotImage}
            priority
          />
        </div>
      </div>
    </div>
  );
}
