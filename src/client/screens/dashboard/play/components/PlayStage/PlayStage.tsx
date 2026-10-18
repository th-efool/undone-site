'use client';

import React, { useRef, useCallback } from 'react';
import Image from 'next/image';
import { Play as PlayIcon, Layers } from 'lucide-react';
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

  const scrubberRef = useRef<HTMLDivElement>(null);

  // Scrubber click / drag seeking
  const handleScrubberClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!scrubberRef.current) return;
      const rect = scrubberRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const percent = Math.min(100, Math.max(0, (clickX / rect.width) * 100));
      triggerHaptic('light');
      seekToPercent(percent);
    },
    [seekToPercent]
  );

  const prevItem = hasPrevious ? feedItems[currentIndex - 1] : null;
  const nextItem = hasNext ? feedItems[currentIndex + 1] : null;

  // Resolve distinct thumbnails preventing duplicate images across left, center, right
  const activeThumbnail = activeItem?.lessonThumbnail;
  const prevThumbnail = prevItem ? resolveItemThumbnail(prevItem, currentIndex - 1, activeThumbnail) : undefined;
  const nextThumbnail = nextItem ? resolveItemThumbnail(nextItem, currentIndex + 1, activeThumbnail) : undefined;

  const prevMedia = prevItem ? resolveMediaSource(prevItem) : null;
  const nextMedia = nextItem ? resolveMediaSource(nextItem) : null;

  // Step distance between cards: 84vw
  const stepXPercent = 84;
  const deltaX = isDragging ? dragDeltaX : 0;

  // Center card moves 1:1 with drag
  const centerTransform = `translate3d(calc(-50% + ${deltaX}px), -50%, 0) scale(${1 - Math.min(0.06, Math.abs(deltaX) / 2000)})`;

  // Left card sits at -stepXPercent and moves 1:1 with drag
  const leftTransform = `translate3d(calc(-50% - ${stepXPercent}vw + ${deltaX}px), -50%, 0) scale(${0.94 + (deltaX > 0 ? Math.min(0.06, deltaX / 1000) : 0)})`;
  const leftOpacity = 0.65 + (deltaX > 0 ? Math.min(0.35, deltaX / 400) : 0);

  // Right card sits at +stepXPercent and moves 1:1 with drag
  const rightTransform = `translate3d(calc(-50% + ${stepXPercent}vw + ${deltaX}px), -50%, 0) scale(${0.94 + (deltaX < 0 ? Math.min(0.06, Math.abs(deltaX) / 1000) : 0)})`;
  const rightOpacity = 0.65 + (deltaX < 0 ? Math.min(0.35, Math.abs(deltaX) / 400) : 0);

  const isVideo =
    activeItem?.lessonType === 'video' &&
    Boolean(activeItem?.lessonVideoId || activeItem?.lessonVideoUrl || activeItem?.sourceUrl);

  return (
    <main className={`${styles.stageContainer} ${isDragging ? styles.isDragging : ''}`} aria-label="Media Playback Area">
      {/* 1. Left Preview Card (Previous Lesson Preloaded in DOM) */}
      {prevItem && (
        <aside
          className={`${styles.previewCard} ${styles.leftEdge}`}
          onClick={previousChunk}
          aria-label={`Previous lesson: ${prevItem.chunkTitle || prevItem.lessonTitle || 'Previous'}`}
          title={`Previous: ${prevItem.chunkTitle || prevItem.lessonTitle || 'Previous'}`}
          style={{
            transform: leftTransform,
            opacity: leftOpacity,
            transition: isDragging ? 'none' : undefined,
          }}
        >
          {prevMedia?.isDirectVideo && prevMedia.videoUrl ? (
            <video
              src={prevMedia.videoUrl}
              preload="metadata"
              muted
              playsInline
              poster={prevThumbnail}
              className={styles.preloadedVideo}
            />
          ) : prevThumbnail ? (
            <Image
              src={prevThumbnail}
              alt={prevItem.chunkTitle || 'Previous lesson'}
              fill
              sizes="80vw"
              style={{ objectFit: 'cover' }}
              priority={true}
            />
          ) : (
            <div className={styles.edgeFallback}>
              <Layers size={36} />
            </div>
          )}

          <div className={styles.cardOverlay}>
            <div className={styles.cardBadge}>
              <PlayIcon size={12} fill="currentColor" />
              <span>Previous</span>
            </div>
            <h3 className={styles.cardTitle}>
              {prevItem.chunkTitle || prevItem.lessonTitle || 'Previous Lesson'}
            </h3>
          </div>
        </aside>
      )}

      {/* 2. Central 16:9 Media Surface */}
      <section
        className={styles.centralSurface}
        aria-label="Current video stage"
        style={{
          transform: centerTransform,
          transition: isDragging ? 'none' : undefined,
        }}
      >
        <div
          className={styles.videoWrapper}
          style={{ pointerEvents: isDragging ? 'none' : 'auto' }}
        >
          {isVideo ? (
            <PlayerSurface
              containerRef={playerContainerRef}
              activeItem={activeItem}
              ytApiError={ytApiError}
              mediaError={mediaError}
              onVideoMount={registerVideoElement}
              onRetry={togglePlayback}
              onCompleteChunk={() => void completeActiveChunk()}
            />
          ) : activeItem?.content ? (
            <ReadingSurface
              item={activeItem}
              pending={completionPending}
              error={completionError}
              onComplete={() => void completeActiveChunk()}
            />
          ) : (
            <PlayerSurface
              containerRef={playerContainerRef}
              activeItem={activeItem}
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
                playback.seekToPercent(0);
              } else if (e.key === 'End') {
                e.preventDefault();
                playback.seekToPercent(100);
              }
            }}
          >
            <div
              className={styles.timelineProgress}
              style={{ width: `${timelineProgress}%` }}
            >
              <div className={styles.timelineThumb} />
            </div>
          </div>
        )}
      </section>

      {/* 3. Right Preview Card (Next Lesson Preloaded in DOM) */}
      {nextItem && (
        <aside
          className={`${styles.previewCard} ${styles.rightEdge}`}
          onClick={nextChunk}
          aria-label={`Next lesson: ${nextItem.chunkTitle || nextItem.lessonTitle || 'Next'}`}
          title={`Next: ${nextItem.chunkTitle || nextItem.lessonTitle || 'Next'}`}
          style={{
            transform: rightTransform,
            opacity: rightOpacity,
            transition: isDragging ? 'none' : undefined,
          }}
        >
          {nextMedia?.isDirectVideo && nextMedia.videoUrl ? (
            <video
              src={nextMedia.videoUrl}
              preload="metadata"
              muted
              playsInline
              poster={nextThumbnail}
              className={styles.preloadedVideo}
            />
          ) : nextThumbnail ? (
            <Image
              src={nextThumbnail}
              alt={nextItem.chunkTitle || 'Next lesson'}
              fill
              sizes="80vw"
              style={{ objectFit: 'cover' }}
              priority={true}
            />
          ) : (
            <div className={styles.edgeFallback}>
              <Layers size={36} />
            </div>
          )}

          <div className={styles.cardOverlay}>
            <div className={styles.cardBadge}>
              <PlayIcon size={12} fill="currentColor" />
              <span>Next</span>
            </div>
            <h3 className={styles.cardTitle}>
              {nextItem.chunkTitle || nextItem.lessonTitle || 'Next Lesson'}
            </h3>
          </div>
        </aside>
      )}
    </main>
  );
}
