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
const DEFAULT_HEIGHTS = [0.45, 0.65, 0.85, 0.7, 0.95, 0.3, 0.2];
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
            const isToday = idx === 3; // Thursday

            return (
              <div key={idx} className={styles.dayColumn}>
                <div className={styles.barTrack}>
                  <div
                    className={`${styles.barFill} ${isToday ? styles.barFillActive : ''}`}
                    style={{ height: `${heightPct}%` }}
                  />
                </div>
                <span className={styles.dayInitial}>{day}</span>
                {isCompleted ? (
                  <div className={styles.checkIndicator}>
                    <Check size={8} strokeWidth={3} />
                  </div>
                ) : (
                  <div className={styles.checkDot} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className={styles.rightContent}>
        <span className={styles.calloutText}>Keep exploring! ✨</span>
        <div className={styles.mascotWrapper}>
          <Image
            src="/images/home/crow.webp"
            alt="Study mascot"
            width={82}
            height={82}
            className={styles.mascotImage}
            priority
          />
        </div>
      </div>
    </div>
  );
}
