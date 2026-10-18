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
const DEFAULT_HEIGHTS = [0.45, 0.65, 0.85, 0.72, 0.95, 0.28, 0.18];
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
            const isCurrentDay = idx === 3; // Thursday

            return (
              <div key={idx} className={styles.dayColumn}>
                <div className={styles.barTrack}>
                  <div
                    className={`${styles.barFill} ${isCurrentDay ? styles.barFillActive : ''}`}
                    style={{ height: `${heightPct}%` }}
                  />
                </div>
                <span className={styles.dayInitial}>{day}</span>
                {isCompleted ? (
                  <div className={styles.checkIndicator}>
                    <Check size={8} strokeWidth={3.2} />
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
            width="22"
            height="18"
            viewBox="0 0 24 20"
            fill="none"
            className={styles.curvedArrow}
            aria-hidden="true"
          >
            <path
              d="M3 2 C 10 3, 17 7, 18 15 M13 12 L18 15 L20 10"
              stroke="#4338ca"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <div className={styles.mascotWrapper}>
          <span className={styles.sparkle1} aria-hidden="true">✦</span>
          <span className={styles.sparkle2} aria-hidden="true">✦</span>
          <Image
            src="/images/home/crow.webp"
            alt="Study mascot"
            width={88}
            height={88}
            className={styles.mascotImage}
            priority
          />
        </div>
      </div>
    </div>
  );
}
