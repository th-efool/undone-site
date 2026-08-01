'use client';

import { useRef, useState, PointerEvent as ReactPointerEvent } from 'react';
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
  const [isDragging, setIsDragging] = useState(false);
  const [dragProgress, setDragProgress] = useState(0);

  const calculatePercent = (clientX: number) => {
    if (!trackRef.current) return 0;
    const rect = trackRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    return Math.min(100, Math.max(0, (x / rect.width) * 100));
  };

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!onSeek) return;
    setIsDragging(true);
    setDragProgress(calculatePercent(e.clientX));
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setDragProgress(calculatePercent(e.clientX));
  };

  const handlePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!isDragging || !onSeek) return;
    setIsDragging(false);
    const finalPercent = calculatePercent(e.clientX);
    onSeek(finalPercent);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  const currentProgress = isDragging ? dragProgress : progress;

  return (
    <div
      className={`${styles.timeline} ${className ?? ''}`}
      ref={trackRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{ cursor: onSeek ? 'pointer' : 'default', touchAction: 'none' }}
      title="Drag to seek"
    >
      <div className={styles.track}>
        <div
          className={styles.progress}
          style={{
            width: `${Math.min(100, Math.max(0, currentProgress))}%`,
          }}
        />
        <div
          className={styles.thumb}
          style={{
            left: `${Math.min(100, Math.max(0, currentProgress))}%`,
          }}
        />
      </div>
    </div>
  );
}
