'use client';

import React, { useRef, useCallback } from 'react';
import Image from 'next/image';
import { Play as PlayIcon, Layers } from 'lucide-react';
import type { FeedItem } from '@/src/shared/feed/feedEngine.types';
import type { UsePlaybackResult } from '../../hooks/usePlayback';
import { PlayerSurface } from '../PlayerSurface/PlayerSurface';
import { ReadingSurface } from '../ReadingSurface';
import { resolveItemThumbnail } from '../../utils/thumbnailResolver';
import { resolveMediaSource } from '../../utils/mediaSource';
import { triggerHaptic } from '@/src/client/utils/haptics';
import styles from './PlayStage.module.css';

interface PlayStageProps {
  playback: UsePlaybackResult;
  dragDeltaX?: number;
  isDragging?: boolean;
}

export function PlayStage({ playback, dragDeltaX = 0, isDragging = false }: PlayStageProps) {
  const {
    activeItem,
    currentIndex,
    feedItems,
    hasPrevious,
    hasNext,
    isPlaying,
    timelineProgress,
    playerContainerRef,
    ytApiError,
    mediaError,
    registerVideoElement,
    togglePlayback,
    previousChunk,
    nextChunk,
    seekToPercent,
    completeActiveChunk,
    completionPending,
    completionError,
  } = playback;

  const stageRef = useRef<HTMLElement>(null);
  const scrubberRef = useRef<HTMLDivElement>(null);

  // Scrubber click seeking
  const handleScrubberClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.stopPropagation();
      if (!scrubberRef.current) return;
      const rect = scrubberRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const percent = Math.min(100, Math.max(0, (clickX / rect.width) * 100));
      triggerHaptic('light');
      seekToPercent(percent);
    },
    [seekToPercent]
  );

  // Build 3-Node Virtual Window [currentIndex - 1, currentIndex, currentIndex + 1]
  // Keying by feed index `idx` guarantees that when currentIndex changes on swipe completion,
  // the incoming node smoothly glides into the center without snapping backwards.
  const nodes: Array<{ idx: number; offset: -1 | 0 | 1; item: FeedItem }> = [];
  if (hasPrevious && feedItems[currentIndex - 1]) {
    nodes.push({ idx: currentIndex - 1, offset: -1, item: feedItems[currentIndex - 1] });
  }
  const centerItem = activeItem || feedItems[currentIndex];
  if (centerItem) {
    nodes.push({ idx: currentIndex, offset: 0, item: centerItem });
  }
  if (hasNext && feedItems[currentIndex + 1]) {
    nodes.push({ idx: currentIndex + 1, offset: 1, item: feedItems[currentIndex + 1] });
  }

  const activeThumbnail = centerItem?.lessonThumbnail;
  const stageWidth =
    stageRef.current?.clientWidth || (typeof window !== 'undefined' ? window.innerWidth : 1000);
  const deltaX = isDragging ? dragDeltaX : 0;
  const normProgress = Math.max(-1, Math.min(1, deltaX / stageWidth));
  const stepX = stageWidth * 0.82;

  return (
    <main
      ref={stageRef}
      className={`${styles.stageContainer} ${isDragging ? styles.isDragging : ''}`}
      aria-label="Media Playback Area"
      onDragStart={(e) => e.preventDefault()}
    >
      <div className={styles.track}>
        {nodes.map(({ idx, offset, item }) => {
          const isActive = offset === 0;
          const translateX = offset * stepX + deltaX;

          let translateZ = 0;
          let scale = 1.0;
          let opacity = 1.0;
          let blur = 0;

          if (offset === 0) {
            const absP = Math.abs(normProgress);
            scale = 1.0 - 0.06 * absP;
            translateZ = -60 * absP;
            opacity = 1.0 - 0.2 * absP;
            blur = 4 * absP;
          } else if (offset === 1) {
            const progress = Math.max(0, -normProgress);
            scale = 0.92 + 0.08 * progress;
            translateZ = -60 * (1 - progress);
            opacity = 0.65 + 0.35 * progress;
            blur = 4 * (1 - progress);
          } else if (offset === -1) {
            const progress = Math.max(0, normProgress);
            scale = 0.92 + 0.08 * progress;
            translateZ = -60 * (1 - progress);
            opacity = 0.65 + 0.35 * progress;
            blur = 4 * (1 - progress);
          }

          const style: React.CSSProperties = {
            transform: `translate3d(${translateX}px, 0px, ${translateZ}px) scale(${scale})`,
            opacity,
            filter: blur > 0.5 ? `blur(${blur.toFixed(1)}px)` : 'none',
            zIndex: isActive ? 10 : 5,
            transition: isDragging ? 'none' : undefined,
          };

          if (isActive) {
            const isVideo =
              item.lessonType === 'video' &&
              Boolean(item.lessonVideoId || item.lessonVideoUrl || item.sourceUrl);

            return (
              <section
                key={idx}
                className={styles.sceneNode}
                aria-label="Current video stage"
                style={style}
              >
                <div className={styles.videoWrapper}>
                  {isVideo ? (
                    <PlayerSurface
                      containerRef={playerContainerRef}
                      activeItem={item}
                      ytApiError={ytApiError}
                      mediaError={mediaError}
                      onVideoMount={registerVideoElement}
                      onRetry={togglePlayback}
                      onCompleteChunk={() => void completeActiveChunk()}
                    />
                  ) : item.content ? (
                    <ReadingSurface
                      item={item}
                      pending={completionPending}
                      error={completionError}
                      onComplete={() => void completeActiveChunk()}
                    />
                  ) : (
                    <PlayerSurface
                      containerRef={playerContainerRef}
                      activeItem={item}
                      ytApiError={ytApiError}
                      mediaError={mediaError}
                      onVideoMount={registerVideoElement}
                      onRetry={togglePlayback}
                      onCompleteChunk={() => void completeActiveChunk()}
                    />
                  )}

                  {/* Centered Play overlay when paused */}
                  {!isPlaying && isVideo && (
                    <button
                      type="button"
                      className={styles.playOverlayButton}
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePlayback();
                      }}
                      aria-label="Play video"
                    >
                      <PlayIcon size={34} fill="currentColor" style={{ marginLeft: 4 }} />
                    </button>
                  )}
                </div>

                {/* Integrated Timeline Scrubber along the bottom of the video */}
                {isVideo && (
                  <div
                    ref={scrubberRef}
                    className={styles.timelineScrubber}
                    onClick={handleScrubberClick}
                    role="slider"
                    aria-label="Timeline seek scrubber"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(timelineProgress)}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowRight') {
                        e.preventDefault();
                        playback.skipSeconds(10);
                      } else if (e.key === 'ArrowLeft') {
                        e.preventDefault();
                        playback.skipSeconds(-10);
                      } else if (e.key === 'PageUp') {
                        e.preventDefault();
                        playback.skipSeconds(30);
                      } else if (e.key === 'PageDown') {
                        e.preventDefault();
                        playback.skipSeconds(-30);
                      } else if (e.key === 'Home') {
                        e.preventDefault();
                        seekToPercent(0);
                      } else if (e.key === 'End') {
                        e.preventDefault();
                        seekToPercent(100);
                      }
                    }}
                  >
                    <div
                      className={styles.timelineProgress}
                      style={{ width: `${Math.min(100, Math.max(0, timelineProgress))}%` }}
                    >
                      <div className={styles.timelineThumb} />
                    </div>
                  </div>
                )}
              </section>
            );
          }

          // Flanking Inactive Card (offset === -1 or offset === 1)
          const isPrev = offset < 0;
          const labelPrefix = isPrev ? 'Previous' : 'Next';
          const title = item.chunkTitle || item.lessonTitle || `${labelPrefix} Lesson`;
          const thumb = resolveItemThumbnail(item, idx, activeThumbnail);
          const media = resolveMediaSource(item);

          return (
            <aside
              key={idx}
              className={`${styles.sceneNode} ${styles.inactiveSceneCard}`}
              aria-label={`${labelPrefix} lesson: ${item.chunkTitle || item.lessonTitle || labelPrefix}`}
              title={`${labelPrefix}: ${item.chunkTitle || item.lessonTitle || labelPrefix}`}
              style={style}
              onClick={(e) => {
                if (isDragging || Math.abs(dragDeltaX) > 10) {
                  e.preventDefault();
                  e.stopPropagation();
                  return;
                }
                if (isPrev) previousChunk();
                else nextChunk();
              }}
            >
              {media.isDirectVideo && media.videoUrl ? (
                <video
                  src={media.videoUrl}
                  preload="metadata"
                  muted
                  playsInline
                  poster={thumb}
                  className={styles.preloadedVideo}
                />
              ) : thumb ? (
                <Image
                  src={thumb}
                  alt={item.chunkTitle || `${labelPrefix} lesson`}
                  fill
                  sizes="78vw"
                  style={{ objectFit: 'cover', pointerEvents: 'none' }}
                  priority={true}
                  draggable={false}
                />
              ) : (
                <div className={styles.edgeFallback}>
                  <Layers size={48} opacity={0.4} />
                </div>
              )}

              <div className={styles.cardOverlay}>
                <div className={styles.cardBadge}>
                  <PlayIcon size={12} fill="currentColor" />
                  <span>{labelPrefix} Lesson</span>
                </div>
                <h3 className={styles.cardTitle}>{title}</h3>
              </div>
            </aside>
          );
        })}
      </div>
    </main>
  );
}
