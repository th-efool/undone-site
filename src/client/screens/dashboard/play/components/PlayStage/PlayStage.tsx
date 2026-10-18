'use client';

import React, { useRef, useCallback } from 'react';
import Image from 'next/image';
import { Play as PlayIcon, Layers } from 'lucide-react';
import type { UsePlaybackResult } from '../../hooks/usePlayback';
import { PlayerSurface } from '../PlayerSurface/PlayerSurface';
import { ReadingSurface } from '../ReadingSurface';
import { resolveItemThumbnail } from '../../utils/thumbnailResolver';
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

  // Real-time drag displacement
  const deltaX = isDragging ? dragDeltaX : 0;
  // Center card moves smoothly with drag
  const centerShiftX = deltaX * 0.75;
  // Left card shifts into view when dragging right (deltaX > 0)
  const leftShiftX = deltaX > 0 ? Math.min(deltaX * 0.9, 140) : 0;
  // Right card shifts into view when dragging left (deltaX < 0)
  const rightShiftX = deltaX < 0 ? Math.max(deltaX * 0.9, -140) : 0;

  const centerTransform = centerShiftX !== 0 ? `translate3d(${centerShiftX}px, 0, 0)` : undefined;
  const leftTransform = `translateY(-50%) translate3d(${leftShiftX}px, 0, 0) scale(${1 + (leftShiftX > 0 ? Math.min(0.08, leftShiftX / 800) : 0)})`;
  const rightTransform = `translateY(-50%) translate3d(${rightShiftX}px, 0, 0) scale(${1 + (rightShiftX < 0 ? Math.min(0.08, Math.abs(rightShiftX) / 800) : 0)})`;

  const isVideo =
    activeItem?.lessonType === 'video' &&
    Boolean(activeItem?.lessonVideoId || activeItem?.lessonVideoUrl || activeItem?.sourceUrl);

  return (
    <main className={`${styles.stageContainer} ${isDragging ? styles.isDragging : ''}`} aria-label="Media Playback Area">
      {/* 1. Left Edge Preview (Previous Lesson Thumbnail) */}
      {prevItem && (
        <aside
          className={`${styles.edgePreview} ${styles.leftEdge}`}
          onClick={previousChunk}
          aria-label={`Previous lesson: ${prevItem.chunkTitle || prevItem.lessonTitle || 'Previous'}`}
          title={`Previous: ${prevItem.chunkTitle || prevItem.lessonTitle || 'Previous'}`}
          style={{
            transform: leftTransform,
            opacity: leftShiftX > 0 ? Math.min(0.9, 0.42 + (leftShiftX / 200)) : undefined,
            transition: isDragging ? 'none' : undefined,
          }}
        >
          {prevThumbnail ? (
            <Image
              src={prevThumbnail}
              alt={prevItem.chunkTitle || 'Previous lesson'}
              fill
              sizes="120px"
              style={{ objectFit: 'cover' }}
            />
          ) : (
            <div className={styles.edgeFallback}>
              <Layers size={28} />
            </div>
          )}
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

      {/* 3. Right Edge Preview (Next Lesson Thumbnail) */}
      {nextItem && (
        <aside
          className={`${styles.edgePreview} ${styles.rightEdge}`}
          onClick={nextChunk}
          aria-label={`Next lesson: ${nextItem.chunkTitle || nextItem.lessonTitle || 'Next'}`}
          title={`Next: ${nextItem.chunkTitle || nextItem.lessonTitle || 'Next'}`}
          style={{
            transform: rightTransform,
            opacity: rightShiftX < 0 ? Math.min(0.9, 0.42 + (Math.abs(rightShiftX) / 200)) : undefined,
            transition: isDragging ? 'none' : undefined,
          }}
        >
          {nextThumbnail ? (
            <Image
              src={nextThumbnail}
              alt={nextItem.chunkTitle || 'Next lesson'}
              fill
              sizes="120px"
              style={{ objectFit: 'cover' }}
            />
          ) : (
            <div className={styles.edgeFallback}>
              <Layers size={28} />
            </div>
          )}
        </aside>
      )}
    </main>
  );
}
