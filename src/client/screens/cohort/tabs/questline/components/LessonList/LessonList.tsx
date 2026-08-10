'use client';

import { useState } from 'react';

import { LessonStatus, type Lesson } from '../../../../models';
import { LessonRow } from '../LessonRow/LessonRow';

import styles from './LessonList.module.css';

interface LessonListProps {
  lessons: Lesson[];
}

export function LessonList({ lessons }: LessonListProps) {
  const [items, setItems] = useState(lessons);

  function toggleStatus(lessonId: string) {
    setItems((current) =>
      current.map((lesson) => {
        if (lesson.id !== lessonId || lesson.status === LessonStatus.Locked) return lesson;
        const status =
          lesson.status === LessonStatus.Ready
            ? LessonStatus.InStream
            : lesson.status === LessonStatus.InStream
              ? LessonStatus.Completed
              : LessonStatus.Ready;
        return {
          ...lesson,
          status,
          completedChunks:
            status === LessonStatus.Completed
              ? lesson.totalChunks
              : status === LessonStatus.Ready
                ? 0
                : lesson.completedChunks,
        };
      }),
    );
  }

  return (
    <div className={styles.list}>
      {items.map((lesson, index) => (
        <LessonRow
          key={lesson.id}
          lesson={lesson}
          index={index}
          onToggleStatus={toggleStatus}
        />
      ))}
    </div>
  );
}
