'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ExternalLink, Play, Layers, Clock, ChevronDown, ChevronUp, Lock } from 'lucide-react';

import { LessonStatus, LessonType, type Lesson } from '../../../../models';

import { LessonTypeBadge } from '../LessonTypeBadge/LessonTypeBadge';
import { QuestlineIcon } from '../QuestlineIcon/QuestlineIcon';

import styles from './LessonRow.module.css';

interface LessonRowProps {
  lesson: Lesson;
  index: number;
  cohortId?: string;
  onToggleStatus(lessonId: string): void;
}

export function LessonRow({ lesson, index, cohortId: propCohortId, onToggleStatus }: LessonRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isLocked = lesson.status === LessonStatus.Locked;

  let routeCohortId: string | undefined;
  try {
    const params = useParams();
    if (typeof params?.cohortId === 'string') routeCohortId = params.cohortId;
  } catch {}
  const cohortId = propCohortId || routeCohortId;

  const playHref = cohortId ? `/play?cohort=${cohortId}&lessonId=${lesson.id}` : undefined;
  const displayOrder = lesson.order ?? (index + 1);

  const videoUrl =
    lesson.videoUrl ||
    (lesson.videoId ? `https://www.youtube.com/watch?v=${lesson.videoId}` : undefined);

  const cleanSourceUrl = (lesson.sourceUrl && !lesson.sourceUrl.startsWith('/cohort/')) ? lesson.sourceUrl : undefined;
  const linkUrl = videoUrl || cleanSourceUrl;
  const isVideo = Boolean(videoUrl || lesson.type === LessonType.Video || lesson.videoId);
  const linkTooltip = isVideo ? "Watch video on YouTube" : "Open source link";

  const thumbnailSrc = (!lesson.thumbnail || lesson.thumbnail === '/mock/thumbnails/docker.avif')
    ? (lesson.videoId ? `https://i.ytimg.com/vi/${lesson.videoId}/hqdefault.jpg` : 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?q=80&w=1200&auto=format&fit=crop')
    : lesson.thumbnail;

  const chunks = lesson.chunks ?? [];

  return (
    <div className={styles.wrapper}>
      <article className={`${styles.row} ${isLocked ? styles.locked : ''}`}>
        {playHref && !isLocked ? (
          <Link href={playHref} tabIndex={-1} aria-hidden="true">
            <Image
              src={thumbnailSrc}
              alt=""
              width={96}
              height={56}
              className={styles.thumbnail}
            />
          </Link>
        ) : (
          <Image
            src={thumbnailSrc}
            alt=""
            width={96}
            height={56}
            className={styles.thumbnail}
          />
        )}

        <div className={styles.content}>
          <h3 className={styles.title}>
            {playHref && !isLocked ? (
              <Link
                href={playHref}
                className={styles.titleLink}
                title="Play lesson in Undone player"
              >
                <span>{displayOrder}. {lesson.title}</span>
                <Play size={12} className={styles.titleExtIcon} />
              </Link>
            ) : linkUrl ? (
              <a
                href={linkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.titleLink}
                title={linkTooltip}
              >
                <span>{displayOrder}. {lesson.title}</span>
                <ExternalLink size={13} className={styles.titleExtIcon} />
              </a>
            ) : (
              <span>{displayOrder}. {lesson.title}</span>
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
            {playHref && !isLocked ? (
              <Link
                href={playHref}
                className={styles.fullVideoLink}
              >
                <Play size={12} /> Play in Undone
              </Link>
            ) : linkUrl && (
              <a
                href={linkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.fullVideoLink}
              >
                {isVideo ? <Play size={12} /> : <ExternalLink size={12} />} {isVideo ? "Watch Full Video" : "Open Source"}
              </a>
            )}
          </div>

          <div className={styles.chunkList}>
            {chunks.length > 0 ? (
              chunks.map((chunk) => {
                const cleanLinkUrl = (linkUrl && !linkUrl.startsWith('/cohort/')) ? linkUrl : undefined;
                const timestampUrl =
                  (chunk.timestampUrl && !chunk.timestampUrl.startsWith('/cohort/'))
                    ? chunk.timestampUrl
                    : (lesson.videoId
                      ? `https://www.youtube.com/watch?v=${lesson.videoId}&t=${chunk.startSeconds || 0}s`
                      : cleanLinkUrl);

                return (
                  <div key={chunk.id} className={styles.chunkRow}>
                    <div className={styles.chunkLeft}>
                      <span className={styles.chunkPartBadge}>Part {chunk.order + 1}</span>
                      <span className={styles.chunkTitle}>{chunk.title}</span>
                    </div>

                    <div className={styles.chunkRight}>
                      <span className={styles.chunkTimeBadge}>
                        <Clock size={11} style={{ display: 'inline', marginRight: 3 }} />
                        {chunk.timeRangeLabel || chunk.duration}
                      </span>
                      <span className={styles.chunkDuration}>{chunk.duration}</span>

                      {cohortId && !isLocked ? (
                        <Link
                          href={`/play?cohort=${cohortId}&lessonId=${lesson.id}&chunk=${chunk.id}`}
                          className={styles.chunkJumpBtn}
                          title="Jump to chunk in Undone player"
                        >
                          <Play size={11} fill="currentColor" />
                          <span>
                            {`Play ${chunk.timeRangeLabel?.split('–')[0]?.split('-')[0]?.trim() || 'chunk'}`}
                          </span>
                        </Link>
                      ) : timestampUrl && (
                        <a
                          href={timestampUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.chunkJumpBtn}
                          title={isVideo ? "Jump to timestamp on YouTube" : "Open resource"}
                        >
                          {isVideo ? <Play size={11} fill="currentColor" /> : <ExternalLink size={11} />}
                          <span>
                            {isVideo ? `Jump to ${chunk.timeRangeLabel?.split('–')[0]?.split('-')[0]?.trim() || 'timestamp'}` : 'Open resource'}
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
