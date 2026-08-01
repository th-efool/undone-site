import { Play } from 'lucide-react';

import type { Lesson } from '../../types/play';

import styles from './LessonCard.module.css';

export interface LessonCardProps {
  lesson: Lesson;
}

export function LessonCard({ lesson }: LessonCardProps) {
  return (
    <div className={styles.card}>
      <div className={styles.platform}>
        <div className={styles.platformIcon}>
          <Play
            size={14}
            fill="currentColor"
          />
        </div>

        <div className={styles.metadata}>
          <h3 className={styles.title}>{lesson.title}</h3>

          <p className={styles.subtitle}>
            S{lesson.seasonOrder} V{lesson.currentVideo}/{lesson.totalVideos}
            <span className={styles.separator}>•</span>
            Chunk {lesson.currentChunk}/{lesson.totalChunks}
            <span className={styles.separator}>•</span>
            {lesson.startTime} - {lesson.endTime}
          </p>
        </div>
      </div>
    </div>
  );
}
