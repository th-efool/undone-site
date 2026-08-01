'use client';

import { useRef, MouseEvent } from 'react';
import type { TimelineMarker } from '../../types/play';
import styles from './LearningTimeline.module.css';

export interface LearningTimelineProps {
  progress: number;
  markers: TimelineMarker[];
  className?: string;
  onSeek?: (percent: number) => void;
}

export function LearningTimeline({ progress, markers, className, onSeek }: LearningTimelineProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);

  const handleClick = (e: MouseEvent<HTMLDivElement>) => {
    if (!trackRef.current || !onSeek) return;
    const rect = trackRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percent = Math.min(100, Math.max(0, (clickX / rect.width) * 100));
    onSeek(percent);
  };

  return (
    <div
      className={`${styles.timeline} ${className ?? ''}`}
      ref={trackRef}
      onClick={handleClick}
      style={{ cursor: onSeek ? 'pointer' : 'default' }}
      title="Click timeline to seek"
    >
      <div className={styles.track}>
        <div
          className={styles.progress}
          style={{
            width: `${Math.min(100, Math.max(0, progress))}%`,
          }}
        />
        <div
          className={styles.thumb}
          style={{
            left: `${Math.min(100, Math.max(0, progress))}%`,
          }}
        />
      </div>
    </div>
  );
}
