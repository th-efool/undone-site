'use client';

import React, { useState } from 'react';
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
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const ENCOURAGEMENTS = [
  'Keep exploring!',
  'Leveling up! 🚀',
  'Brain on fire! ✨',
];

export const HomeStreakWidget = React.memo(function HomeStreakWidget({
  todayMinutes,
  dailyGoalMinutes,
  streakDays,
  weekActivity,
  weekBarHeights,
  className,
}: HomeStreakWidgetProps) {
  const [hoveredDayIdx, setHoveredDayIdx] = useState<number | null>(null);
  const [cheerIdx, setCheerIdx] = useState(0);
  const [mascotBouncing, setMascotBouncing] = useState(false);

  const hasActivityData = typeof todayMinutes === 'number' || typeof streakDays === 'number';

  const handleMascotClick = () => {
    setCheerIdx((prev) => (prev + 1) % ENCOURAGEMENTS.length);
    setMascotBouncing(true);
    setTimeout(() => setMascotBouncing(false), 500);
  };

  const safeTodayMinutes = todayMinutes ?? 0;
  const safeDailyGoal = dailyGoalMinutes ?? 30;
  const safeStreakDays = streakDays ?? 0;

  return (
    <div className={`${styles.card} ${className || ''}`.trim()}>
      <div className={styles.leftContent}>
        <h3 className={styles.title}>You&apos;re doing great!</h3>

        {hasActivityData ? (
          <>
            <span className={styles.progressLabel}>
              {safeTodayMinutes} / {safeDailyGoal} min &bull; {safeStreakDays} day streak
            </span>

            {Array.isArray(weekActivity) && Array.isArray(weekBarHeights) && (
              <div className={styles.chartContainer}>
                {DEFAULT_DAYS.map((day, idx) => {
                  const isCompleted = Boolean(weekActivity[idx]);
                  const heightPct = Math.round((weekBarHeights[idx] ?? 0.3) * 100);
                  const estMinutes = Math.round(safeDailyGoal * (weekBarHeights[idx] ?? 0.3));

                  return (
                    <div
                      key={idx}
                      className={styles.dayColumn}
                      onMouseEnter={() => setHoveredDayIdx(idx)}
                      onMouseLeave={() => setHoveredDayIdx(null)}
                      tabIndex={0}
                      role="button"
                      aria-label={`${DAY_NAMES[idx]}: ${estMinutes} minutes studied${isCompleted ? ', goal completed' : ''}`}
                    >
                      {hoveredDayIdx === idx && (
                        <div className={styles.barTooltip}>
                          <span>{DAY_NAMES[idx]}</span>
                          <strong>{estMinutes}m</strong>
                        </div>
                      )}

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
            )}
          </>
        ) : (
          <p className={styles.unavailableText}>Activity statistics are not available yet</p>
        )}
      </div>

      <div className={styles.rightContent}>
        <div className={styles.calloutWrapper}>
          <span className={styles.calloutText}>{ENCOURAGEMENTS[cheerIdx]}</span>
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

        <button
          type="button"
          className={`${styles.mascotWrapper} ${mascotBouncing ? styles.mascotBouncing : ''}`}
          onClick={handleMascotClick}
          title="Click your study buddy for a boost!"
          aria-label="Click study mascot for encouragement"
        >
          <span className={styles.sparkle1} aria-hidden="true">✦</span>
          <span className={styles.sparkle2} aria-hidden="true">✦</span>
          <Image
            src="/images/home/streak-mascot.png"
            alt="Study mascot"
            width={128}
            height={128}
            sizes="128px"
            className={styles.mascotImage}
            priority
          />
        </button>
      </div>
    </div>
  );
});
