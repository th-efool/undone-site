'use client';

import React from 'react';
import type { FeedItem } from '@/src/shared/feed/feedEngine.types';
import type { UsePlaybackResult } from '../../hooks/usePlayback';
import { Tv, Sparkles, Video, BookOpen } from 'lucide-react';
import { resolveMediaSource } from '../../utils/mediaSource';
import styles from './PlayHeader.module.css';

interface PlayHeaderProps {
  playback: UsePlaybackResult;
  onOpenChannelSelector?: () => void;
}

export function PlayHeader({ playback, onOpenChannelSelector }: PlayHeaderProps) {
  const { currentIndex, feedItems, lesson, activeItem, goToIndex } = playback;

  // Resolve media source accurately - never label all sources YouTube
  const mediaSource = resolveMediaSource(activeItem);
  const cohortProvider = (activeItem as any)?.cohortProvider as string | undefined;

  let provider = cohortProvider;
  if (!provider) {
    if (mediaSource.isYouTube) provider = 'YouTube';
    else if (mediaSource.isDirectVideo) provider = 'Video';
    else if (mediaSource.isReading) provider = 'Reading';
    else provider = 'Course Media';
  }
  const isYouTube = mediaSource.isYouTube;

  // Calculate circular course progress percentage from actually completed chunks
  // Feed position is NOT course completion; distinguish playback/cursor progress from true completion
  const totalItemsCount = feedItems.length;
  const completedCount = feedItems.filter((item) =>
    playback.isChunkCompleted ? playback.isChunkCompleted(item.chunkId) : false
  ).length;
  const courseProgressPercent = totalItemsCount > 0
    ? Math.min(100, Math.round((completedCount / totalItemsCount) * 100))
    : 0;

  // Circular ring SVG constants (r = 18, circumference = 2 * π * 18 ≈ 113.1)
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (courseProgressPercent / 100) * circumference;

  // Time range string: chunk-relative "00:00 - 04:00"
  const timeRange = `${lesson.startTime || '00:00'} - ${lesson.endTime || '03:00'}`;
  const chunkInfo = `Chunk ${lesson.currentChunk || 1} of ${lesson.totalChunks || 1}`;

  // Season and Episode labels (honest metadata - omit unsupported counts rather than inventing them)
  const currentVideo = lesson.currentVideo;
  const totalVideos = lesson.totalVideos;
  const seasonNum = lesson.seasonOrder || 1;
  const hasEpisode = Boolean(currentVideo && totalVideos && totalVideos > 0);
  const episodeCode = hasEpisode ? `S${seasonNum}:E${currentVideo}` : `S${seasonNum}`;
  const episodeLabel = hasEpisode
    ? `Episode ${currentVideo} of ${totalVideos}`
    : (activeItem?.cohortTitle || lesson.topic || 'Lesson Unit');

  // Top capsule window
  const totalCapsules = Math.max(feedItems.length, 1);
  const capsuleIndices = Array.from({ length: totalCapsules }, (_, i) => i);

  return (
    <header className={styles.headerContainer} aria-label="Playback Header">
      {/* 1. Feed Position Capsules near the top */}
      <nav className={styles.capsulesRow} aria-label="Feed item positions">
        {capsuleIndices.map((idx) => {
          const isActive = idx === currentIndex;
          const isCompleted = playback.isChunkCompleted ? playback.isChunkCompleted(feedItems[idx]?.chunkId) : false;

          return (
            <button
              key={idx}
              type="button"
              className={`${styles.capsule} ${isActive ? styles.capsuleActive : isCompleted ? styles.capsuleCompleted : ''}`}
              onClick={() => goToIndex(idx)}
              aria-label={`Jump to lesson ${idx + 1}`}
              aria-current={isActive ? 'step' : undefined}
            />
          );
        })}
      </nav>

      {/* 2. Metadata Section & Episode Block */}
      <div className={styles.headerContent}>
        {/* Left Section: Lesson Title, Provider, Chunk order & relative duration */}
        <div className={styles.metadataSection}>
          <h1 className={styles.lessonTitle} title={lesson.title}>
            {lesson.title || 'Untitled Lesson'}
          </h1>
          <div className={styles.subtitleRow}>
            <span className={styles.providerBadge}>
              {isYouTube ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ color: '#EF4444' }}>
                  <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
                </svg>
              ) : mediaSource.isReading ? (
                <BookOpen size={13} aria-hidden="true" style={{ color: '#A78BFA' }} />
              ) : mediaSource.isDirectVideo ? (
                <Video size={13} aria-hidden="true" style={{ color: '#5430FF' }} />
              ) : (
                <Sparkles size={13} aria-hidden="true" style={{ color: '#5430FF' }} />
              )}
              <span>{provider}</span>
            </span>
            <span className={styles.dotSeparator}>•</span>
            <span>{chunkInfo}</span>
            <span className={styles.dotSeparator}>•</span>
            <span>{timeRange}</span>
          </div>
        </div>

        {/* Thin hairline divider */}
        <div className={styles.divider} aria-hidden="true" />

        {/* Right Section: Circular progress ring & Season/Episode values */}
        <div className={styles.episodeBlock} aria-label={`Course Progress: ${episodeCode}, ${episodeLabel}`}>
          <div className={styles.progressRingContainer}>
            <svg className={styles.progressRingSvg} viewBox="0 0 44 44">
              <circle
                className={styles.progressRingTrack}
                cx="22"
                cy="22"
                r={radius}
                strokeWidth="3"
              />
              <circle
                className={styles.progressRingIndicator}
                cx="22"
                cy="22"
                r={radius}
                strokeWidth="3.5"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
              />
            </svg>
            <div className={styles.ringCenterIcon}>
              <Tv size={16} />
            </div>
          </div>

          <div className={styles.episodeText}>
            <span className={styles.episodeCode}>{episodeCode}</span>
            <span className={styles.episodeLabel}>{episodeLabel}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
