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
            Video {lesson.currentVideo} of {lesson.totalVideos}
            <span className={styles.separator}>•</span>
            Chunk {lesson.currentChunk} of {lesson.totalChunks}
            <span className={styles.separator}>•</span>
            {lesson.currentTime} / {lesson.totalDuration}
          </p>
        </div>
      </div>
    </div>
  );
}
