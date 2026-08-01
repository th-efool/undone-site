'use client';

import { HorizontalScroller } from '@/src/client/components/global/HorizontalScroller';
import { ChevronRight, Pause, Play } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { LiveSession } from '../../../models';
import { EmptyState } from '../../shared/EmptyState/EmptyState';
import { LiveCard } from '../LiveCard/LiveCard';
import styles from './LiveNow.module.css';

interface Props {
  items: LiveSession[];
}

export function LiveNow({ items }: Props) {
  const [isPaused, setIsPaused] = useState(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const scrollerRef = useRef<HTMLDivElement>(null);

  // Auto-resume after 10s of user inactivity
  useEffect(() => {
    function resetIdleTimer() {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => setIsPaused(false), 10_000);
    }

    const el = scrollerRef.current;
    if (!el || isPaused) return;

    ['touchstart', 'scroll'].forEach((evt) =>
      el.addEventListener(evt, resetIdleTimer)
    );
    resetIdleTimer();

    return () => {
      el.removeEventListener('touchstart', resetIdleTimer);
      el.removeEventListener('scroll', resetIdleTimer);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [isPaused]);

  // No live sessions at all → B2 empty state
  if (!items.length) {
    return (
      <section className={styles.section}>
        <header>
          <h2>Live Now</h2>
          <button type="button">
            View all <ChevronRight size={18} />
          </button>
        </header>
        <EmptyState
          title="No active sessions"
          message="No live learning right now. Check back later!"
        />
      </section>
    );
  }

  return (
    <section className={styles.section}>
      <header>
        <h2>Live Now</h2>
        <button type="button">
          View all <ChevronRight size={18} />
        </button>
      </header>
      <div className={styles.scrollerWrapper} ref={scrollerRef}>
        <HorizontalScroller
          className={styles.scroller}
          scrollAmount={460}
        >
          {items.map((item) => (
            <LiveCard
              key={item.id}
              session={item}
            />
          ))}
        </HorizontalScroller>
        {/* B7: fade indicator on right edge */}
        <div className={styles.fadeOverlay} aria-hidden="true" />
      </div>
      {/* B5: pause/resume control */}
      {!isPaused ? (
        <button
          type="button"
          className={`${styles.pauseBtn} ${styles.paused}`}  
          onClick={() => setIsPaused(true)}
          aria-label="Pause auto-scroll"
        >
          <Pause size={14} strokeWidth={2.5} />
          <span>Paused</span>
        </button>
      ) : (
        <button
          type="button"
          className={`${styles.pauseBtn} ${styles.playing}`}
          onClick={() => setIsPaused(false)}
          aria-label="Resume auto-scroll"
        >
          <Play size={14} strokeWidth={2.5} />
          <span>Resuming…</span>
        </button>
      )}
    </section>
  );
}
