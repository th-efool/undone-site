import Image from 'next/image';
import { ArrowRight, Clock, Pause, Sparkles } from 'lucide-react';
import { Tooltip } from '@/src/client/components/ui/Tooltip';

import type { CompletedCourse, PausedCohort } from '../../models';

import styles from './HomeSummaryBar.module.css';

export interface HomeSummaryBarProps {
  pausedItems: PausedCohort[];
  completedItems: CompletedCourse[];
  onTogglePaused?: () => void;
  onToggleCompleted?: () => void;
  isPausedOpen?: boolean;
  isCompletedOpen?: boolean;
}

export function HomeSummaryBar({
  pausedItems = [],
  completedItems = [],
  onTogglePaused,
  onToggleCompleted,
  isPausedOpen = false,
  isCompletedOpen = false,
}: HomeSummaryBarProps) {
  const pausedCount = pausedItems.length;
  const completedCount = completedItems.length;

  const pausedAvatars = pausedItems.slice(0, 3);
  const pausedRemaining = Math.max(0, pausedCount - 3);

  const completedAvatars = completedItems.slice(0, 3);
  const completedRemaining = Math.max(0, completedCount - 3);

  return (
    <section className={styles.cardContainer}>
      <div className={styles.summaryGroup}>
        {/* Paused Section */}
        <div className={styles.summarySection}>
          <div className={styles.badgeGroup}>
            <div className={styles.iconCircle}>
              <Pause size={16} className={styles.iconPurple} fill="currentColor" />
            </div>

            <span className={styles.sectionLabel}>Paused</span>
            <span className={styles.sectionCount}>{pausedCount}</span>

            <div className={styles.avatarStack}>
              {pausedAvatars.map((item, idx) => (
                <div key={item.id || idx} className={styles.avatarWrapper} style={{ zIndex: 10 - idx }}>
                  <Image
                    src={item.thumbnail || '/mock/thumbnails/javascript.jpeg'}
                    alt={item.title}
                    className={styles.avatarImg}
                   width={400} height={300}/>
                </div>
              ))}
              {pausedRemaining > 0 && (
                <div className={styles.avatarMore}>+{pausedRemaining}</div>
              )}
            </div>
          </div>

          <Tooltip content="Toggle list visibility" placement="top">
            <button
              type="button"
              className={`${styles.arrowButton} ${isPausedOpen ? styles.arrowActive : ''}`}
              onClick={onTogglePaused}
              aria-label="Toggle paused cohorts"
            >
              <ArrowRight size={16} />
            </button>
          </Tooltip>
        </div>

        {/* Divider */}
        <div className={styles.divider} />

        {/* Recently Finished Section */}
        <div className={styles.summarySection}>
          <div className={styles.badgeGroup}>
            <div className={styles.iconCircle}>
              <Clock size={16} className={styles.iconPurple} />
            </div>

            <span className={styles.sectionLabel}>Recently finished</span>
            <span className={styles.sectionCount}>{completedCount}</span>

            <div className={styles.avatarStack}>
              {completedAvatars.map((item, idx) => (
                <div key={item.id || idx} className={styles.avatarWrapper} style={{ zIndex: 10 - idx }}>
                  <Image
                    src={item.thumbnail || '/images/landing/coffee-break.webp'}
                    alt={item.title}
                    className={styles.avatarImg}
                   width={400} height={300}/>
                </div>
              ))}
              {completedRemaining > 0 && (
                <div className={styles.avatarMore}>+{completedRemaining}</div>
              )}
            </div>
          </div>

          <Tooltip content="Toggle list visibility" placement="top">
            <button
              type="button"
              className={`${styles.arrowButton} ${isCompletedOpen ? styles.arrowActive : ''}`}
              onClick={onToggleCompleted}
              aria-label="Toggle recently finished cohorts"
            >
              <ArrowRight size={16} />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Motivational Crow Section */}
      <div className={styles.motivationSection}>
        <div className={styles.mottoText}>
          <span className={styles.mottoMain}>Small steps in the right direction create</span>
          <span className={styles.mottoScript}>
            extraordinary journeys. <Sparkles size={18} className={styles.sparkle} />
          </span>

        </div>

        <div className={styles.crowWrapper}>
          <Image
            src="/images/home/crow.webp"
            alt="Crow illustration"
            className={styles.crowImage}
           width={400} height={300}/>
        </div>
      </div>
    </section>
  );
}

