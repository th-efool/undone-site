'use client';

import React, { useRef, useCallback } from 'react';
import Image from 'next/image';
import { Play as PlayIcon, Layers } from 'lucide-react';
import type { UsePlaybackResult } from '../../hooks/usePlayback';
import { PlayerSurface } from '../PlayerSurface/PlayerSurface';
import { ReadingSurface } from '../ReadingSurface';
import { triggerHaptic } from '@/src/client/utils/haptics';
import styles from './PlayStage.module.css';

interface PlayStageProps {
  playback: UsePlaybackResult;
}

export function PlayStage({ playback }: PlayStageProps) {
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

  const isVideo =
    activeItem?.lessonType === 'video' &&
    Boolean(activeItem?.lessonVideoId || activeItem?.lessonVideoUrl || activeItem?.sourceUrl);

  return (
    <main className={styles.stageContainer} aria-label="Media Playback Area">
      {/* 1. Left Edge Preview (Previous Lesson Thumbnail) */}
      {prevItem && (
        <aside
          className={`${styles.edgePreview} ${styles.leftEdge}`}
          onClick={previousChunk}
          aria-label={`Previous lesson: ${prevItem.chunkTitle || prevItem.lessonTitle || 'Previous'}`}
          title={`Previous: ${prevItem.chunkTitle || prevItem.lessonTitle || 'Previous'}`}
        >
          {prevItem.lessonThumbnail ? (
            <Image
              src={prevItem.lessonThumbnail}
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
      <section className={styles.centralSurface} aria-label="Current video stage">
        <div className={styles.videoWrapper}>
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
        >
          {nextItem.lessonThumbnail ? (
            <Image
              src={nextItem.lessonThumbnail}
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
