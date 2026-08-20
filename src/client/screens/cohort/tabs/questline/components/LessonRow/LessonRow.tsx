'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ExternalLink, Play, Layers, Clock, ChevronDown, ChevronUp, Lock } from 'lucide-react';

import { LessonStatus, type Lesson } from '../../../../models';

import { LessonTypeBadge } from '../LessonTypeBadge/LessonTypeBadge';
import { QuestlineIcon } from '../QuestlineIcon/QuestlineIcon';

import styles from './LessonRow.module.css';

interface LessonRowProps {
  lesson: Lesson;
  index: number;
  onToggleStatus(lessonId: string): void;
}

export function LessonRow({ lesson, index, onToggleStatus }: LessonRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isLocked = lesson.status === LessonStatus.Locked;

  const videoUrl =
    lesson.videoUrl ||
    (lesson.videoId ? `https://www.youtube.com/watch?v=${lesson.videoId}` : undefined);

  const chunks = lesson.chunks ?? [];

  return (
    <div className={styles.wrapper}>
      <article className={`${styles.row} ${isLocked ? styles.locked : ''}`}>
        <Image
          src={lesson.thumbnail || 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?q=80&w=1200&auto=format&fit=crop'}
          alt=""
          width={96}
          height={56}
          className={styles.thumbnail}
        />

        <div className={styles.content}>
          <h3 className={styles.title}>
            {videoUrl ? (
              <a
                href={videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.titleLink}
                title="Watch video on YouTube"
              >
                <span>{index + 1}. {lesson.title}</span>
                <ExternalLink size={13} className={styles.titleExtIcon} />
              </a>
            ) : (
              <span>{index + 1}. {lesson.title}</span>
            )}
          </h3>
          <div className={styles.meta}>
            <LessonTypeBadge type={lesson.type} />
            <span>{lesson.duration}</span>
            <span className={styles.chunkProgress}>
              {lesson.completedChunks}/{lesson.totalChunks} Chunks
            </span>
          </div>
        </div>



        <button
          className={`${styles.expandButton} ${isExpanded ? styles.expandActive : ''}`}
          type="button"
          aria-label="Expand lesson chunks"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isLocked ? (
            <Lock size={16} />
          ) : isExpanded ? (
            <ChevronUp size={16} />
          ) : (
            <ChevronDown size={16} />
          )}
        </button>
      </article>

      {/* Expandable Chunks Dropdown */}
      {isExpanded && (
        <div className={styles.chunksDropdown}>
          <div className={styles.chunksHeader}>
            <div className={styles.chunksHeaderTitle}>
              <Layers size={14} color="#a5b4fc" />
              <span>Lesson Chunks & Timestamps</span>
              <span className={styles.chunksBadge}>{chunks.length} parts</span>
            </div>
            {videoUrl && (
              <a
                href={videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.fullVideoLink}
              >
                <Play size={12} /> Watch Full Video
              </a>
            )}
          </div>

          <div className={styles.chunkList}>
            {chunks.length > 0 ? (
              chunks.map((chunk) => {
                const timestampUrl =
                  chunk.timestampUrl ||
                  (lesson.videoId
                    ? `https://www.youtube.com/watch?v=${lesson.videoId}&t=${chunk.startSeconds || 0}s`
                    : videoUrl);

                return (
                  <div key={chunk.id} className={styles.chunkRow}>
                    <div className={styles.chunkLeft}>
                      <span className={styles.chunkPartBadge}>Part {chunk.order}</span>
                      <span className={styles.chunkTitle}>{chunk.title}</span>
                    </div>

                    <div className={styles.chunkRight}>
                      <span className={styles.chunkTimeBadge}>
                        <Clock size={11} style={{ display: 'inline', marginRight: 3 }} />
                        {chunk.timeRangeLabel || chunk.duration}
                      </span>
                      <span className={styles.chunkDuration}>{chunk.duration}</span>

                      {timestampUrl && (
                        <a
                          href={timestampUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.chunkJumpBtn}
                          title="Jump to timestamp on YouTube"
                        >
                          <Play size={11} fill="currentColor" />
                          <span>
                            Jump to {chunk.timeRangeLabel?.split('–')[0]?.trim() || 'timestamp'}
                          </span>
                          <ExternalLink size={11} />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic' }}>
                No specific timestamp chunks generated for this item.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
