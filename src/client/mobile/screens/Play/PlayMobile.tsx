'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Play as PlayIcon,
  Pause,
  SkipBack,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Check,
  RotateCcw,
  Loader2,
  Bookmark,
  SlidersHorizontal,
  X,
  Camera,
  FileText,
  Mic,
  Flag,
  AlertCircle,
  Tv,
  Video,
  BookOpen,
  Layers,
} from 'lucide-react';
import type { UsePlaybackResult } from '@/src/client/screens/dashboard/play/hooks/usePlayback';
import type { FeedItem } from '@/src/shared/feed/feedEngine.types';
import type { ChannelId } from '@/src/shared/curriculum/pedagogicalVector.types';
import { ChannelSelector } from '@/src/client/screens/dashboard/play/components/ChannelSelector';
import { PlayerSurface } from '@/src/client/screens/dashboard/play/components/PlayerSurface/PlayerSurface';
import { ReadingSurface } from '@/src/client/screens/dashboard/play/components/ReadingSurface';
import { PlaySkeleton } from '@/src/client/screens/dashboard/play/components/PlaySkeleton/PlaySkeleton';
import { resolveMediaSource, type NormalizedMediaSource } from '@/src/client/screens/dashboard/play/utils/mediaSource';
import { extractFitScores, type FitScores } from '@/src/client/screens/dashboard/play/utils/fitScore';
import { triggerHaptic } from '@/src/client/utils/haptics';
import { use1DGesture } from '@/src/client/screens/dashboard/play/hooks/use1DGesture';
import styles from './PlayMobile.module.css';

const PLAYBACK_SPEEDS = [0.75, 1, 1.25, 1.5, 2];

function renderProviderIcon(mediaSource: NormalizedMediaSource) {
  if (mediaSource.isYouTube) return <Tv size={12} color="#EF4444" />;
  if (mediaSource.isDirectVideo) return <Video size={12} color="#818CF8" />;
  if (mediaSource.isReading) return <BookOpen size={12} color="#34D399" />;
  return <Layers size={12} color="#94A3B8" />;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Memoized TimelineScrubber Component (4-10Hz isolation)
// ─────────────────────────────────────────────────────────────────────────────

export interface TimelineScrubberProps {
  progress: number;
  onSeek: (percent: number) => void;
  onSkip: (seconds: number) => void;
}

export const TimelineScrubber = React.memo(function TimelineScrubber({
  progress,
  onSeek,
  onSkip,
}: TimelineScrubberProps) {
  const scrubberRef = useRef<HTMLDivElement | null>(null);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!scrubberRef.current) return;
      const rect = scrubberRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const percent = Math.min(100, Math.max(0, (clickX / rect.width) * 100));
      triggerHaptic('light');
      onSeek(percent);
    },
    [onSeek]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        onSkip(10);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onSkip(-10);
      }
    },
    [onSkip]
  );

  const clamped = Math.min(100, Math.max(0, progress));

  return (
    <div
      ref={scrubberRef}
      className={styles.timelineScrubber}
      onClick={handleClick}
      role="slider"
      aria-label="Timeline seek scrubber"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <div
        className={styles.timelineProgress}
        style={{ width: `${clamped}%` }}
      >
        <div className={styles.timelineThumb} />
      </div>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Memoized Header Component (Isolated from Scrubber Ticks)
// ─────────────────────────────────────────────────────────────────────────────

export interface PlayMobileHeaderProps {
  feedItems: FeedItem[];
  currentIndex: number;
  itemStatuses: ('completed' | 'in-progress' | 'not-started')[];
  onGoToIndex: (index: number) => void;
  activeChannel: ChannelId;
  onChannelSelect: (channel: ChannelId) => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  onPrefsUpdated: () => void;
  title: string;
  providerName: string;
  mediaSource: NormalizedMediaSource;
  fitScores: FitScores;
  currentChunk: number;
  totalChunks: number;
  ariaLabel?: string;
}

export const PlayMobileHeader = React.memo(function PlayMobileHeader({
  feedItems,
  currentIndex,
  itemStatuses,
  onGoToIndex,
  activeChannel,
  onChannelSelect,
  searchQuery,
  onSearchQueryChange,
  onPrefsUpdated,
  title,
  providerName,
  mediaSource,
  fitScores,
  currentChunk,
  totalChunks,
  ariaLabel = 'Playback Header',
}: PlayMobileHeaderProps) {
  return (
    <header className={styles.header} aria-label={ariaLabel}>
      <div className={styles.topBarRow}>
        <div className={styles.capsulesRow} role="tablist" aria-label="Lesson progression">
          {feedItems.map((item, idx) => {
            const isSelected = idx === currentIndex;
            const isCompleted = itemStatuses[idx] === 'completed';
            return (
              <button
                key={item.chunkId || idx}
                type="button"
                className={`${styles.capsule} ${isSelected ? styles.capsuleActive : ''} ${
                  isCompleted ? styles.capsuleCompleted : ''
                }`}
                onClick={() => {
                  triggerHaptic('light');
                  onGoToIndex(idx);
                }}
                aria-label={`Go to lesson chunk ${idx + 1}: ${item.chunkTitle || item.lessonTitle || ''}`}
                aria-current={isSelected ? 'true' : undefined}
              />
            );
          })}
        </div>
        <ChannelSelector
          activeChannel={activeChannel}
          onChannelSelect={onChannelSelect}
          searchQuery={searchQuery}
          onSearchQueryChange={onSearchQueryChange}
          onPrefsUpdated={onPrefsUpdated}
          isInline
        />
      </div>

      <div className={styles.metadataBlock}>
        <h1 className={styles.lessonTitle}>{title}</h1>
        <div className={styles.subtitleRow}>
          <span className={styles.providerBadge}>
            {renderProviderIcon(mediaSource)}
            <span>{providerName}</span>
          </span>
          <span className={styles.dotSeparator}>•</span>
          <span
            className={styles.fitScoreBadge}
            title={`Recommendation Fit: ${fitScores.channelFit}% channel match, ${fitScores.overallFit}% overall curriculum match`}
          >
            <span className={styles.fitScoreChannel}>{fitScores.channelFit}%</span>
            <span className={styles.fitScoreSlash}>/</span>
            <span className={styles.fitScoreOverall}>{fitScores.overallFit}%</span>
          </span>
          <span className={styles.dotSeparator}>•</span>
          <span>
            Chunk {currentChunk}/{totalChunks}
          </span>
        </div>
      </div>
    </header>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Memoized Dock Component (Isolated from Scrubber Ticks)
// ─────────────────────────────────────────────────────────────────────────────

export interface PlayMobileDockProps {
  isPlaying: boolean;
  hasPrevious: boolean;
  hasNext: boolean;
  isChunkCompleted: boolean;
  completionPending: boolean;
  completionError: string | null;
  muted: boolean;
  isFullscreen: boolean;
  onTogglePlay: () => void;
  onPreviousChunk: () => void;
  onNextChunk: () => void;
  onSkipSeconds: (seconds: number) => void;
  onCompleteChunk: () => void;
  onToggleMute: () => void;
  onToggleFullscreen: () => void;
  onOpenTools: () => void;
}

export const PlayMobileDock = React.memo(function PlayMobileDock({
  isPlaying,
  hasPrevious,
  hasNext,
  isChunkCompleted,
  completionPending,
  completionError,
  muted,
  isFullscreen,
  onTogglePlay,
  onPreviousChunk,
  onNextChunk,
  onSkipSeconds,
  onCompleteChunk,
  onToggleMute,
  onToggleFullscreen,
  onOpenTools,
}: PlayMobileDockProps) {
  return (
    <footer className={styles.dock}>
      <div className={styles.primaryControlRow}>
        <div className={styles.controlCapsule}>
          <button
            type="button"
            className={styles.iconButton}
            onClick={() => {
              triggerHaptic('light');
              onSkipSeconds(-10);
            }}
            aria-label="Rewind 10 seconds"
            title="Rewind 10s"
          >
            <SkipBack size={18} />
          </button>
          <button
            type="button"
            className={styles.iconButton}
            onClick={() => {
              triggerHaptic('light');
              onPreviousChunk();
            }}
            disabled={!hasPrevious}
            aria-label="Previous chunk"
            title="Previous chunk"
          >
            <ChevronLeft size={20} />
          </button>
        </div>

        <button
          type="button"
          className={styles.playToggleBtn}
          onClick={() => {
            triggerHaptic('medium');
            onTogglePlay();
          }}
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <Pause size={24} />
          ) : (
            <PlayIcon size={24} fill="currentColor" style={{ marginLeft: 3 }} />
          )}
        </button>

        <div className={styles.controlCapsule}>
          <button
            type="button"
            className={styles.iconButton}
            onClick={() => {
              triggerHaptic('light');
              onNextChunk();
            }}
            disabled={!hasNext}
            aria-label="Next chunk"
            title="Next chunk"
          >
            <ChevronRight size={20} />
          </button>
          <button
            type="button"
            className={styles.iconButton}
            onClick={() => {
              triggerHaptic('light');
              onSkipSeconds(10);
            }}
            aria-label="Fast forward 10 seconds"
            title="Forward 10s"
          >
            <SkipForward size={18} />
          </button>
        </div>
      </div>

      {/* Secondary Row: Complete, Mute, Fullscreen, Tools Drawer */}
      <div className={styles.secondaryRow}>
        <button
          type="button"
          className={`${styles.completeButton} ${
            isChunkCompleted ? styles.completeButtonCompleted : ''
          } ${completionError ? styles.completeButtonError : ''}`}
          onClick={() => {
            triggerHaptic('light');
            onCompleteChunk();
          }}
          disabled={completionPending}
          aria-label={
            isChunkCompleted
              ? 'Chunk completed'
              : completionPending
              ? 'Saving completion'
              : completionError
              ? 'Retry completion'
              : 'Complete chunk'
          }
        >
          {completionPending ? (
            <Loader2 size={16} className={styles.spinner} />
          ) : completionError ? (
            <RotateCcw size={16} />
          ) : (
            <Check size={16} />
          )}
          <span>
            {isChunkCompleted
              ? 'Completed'
              : completionPending
              ? 'Saving…'
              : completionError
              ? 'Retry'
              : 'Complete'}
          </span>
        </button>

        <button
          type="button"
          className={styles.utilityButton}
          onClick={() => {
            triggerHaptic('light');
            onToggleMute();
          }}
          aria-label={muted ? 'Unmute volume' : 'Mute volume'}
          title={muted ? 'Unmute' : 'Mute'}
        >
          {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>

        <button
          type="button"
          className={styles.utilityButton}
          onClick={() => {
            triggerHaptic('light');
            onToggleFullscreen();
          }}
          aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
        >
          {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
        </button>

        <button
          type="button"
          className={styles.utilityButton}
          onClick={() => {
            triggerHaptic('light');
            onOpenTools();
          }}
          aria-label="Playback tools and options"
          title="Tools & Settings"
        >
          <SlidersHorizontal size={18} />
        </button>
      </div>
    </footer>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Memoized TimeBar Component
// ─────────────────────────────────────────────────────────────────────────────

export interface PlayMobileTimeBarProps {
  currentTime: string;
  totalDuration: string;
}

export const PlayMobileTimeBar = React.memo(function PlayMobileTimeBar({
  currentTime,
  totalDuration,
}: PlayMobileTimeBarProps) {
  return (
    <div className={styles.timeBar}>
      <span>{currentTime}</span>
      <span>{totalDuration}</span>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Memoized Tools Drawer Component
// ─────────────────────────────────────────────────────────────────────────────

export interface PlayMobileToolsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  playbackSpeed: number;
  speedSupported: boolean;
  onSetPlaybackSpeed: (speed: number) => void;
  bookmarked: boolean;
  onToggleBookmark: () => void;
}

export const PlayMobileToolsSheet = React.memo(function PlayMobileToolsSheet({
  isOpen,
  onClose,
  playbackSpeed,
  speedSupported,
  onSetPlaybackSpeed,
  bookmarked,
  onToggleBookmark,
}: PlayMobileToolsSheetProps) {
  if (!isOpen) return null;

  return (
    <div
      className={styles.sheetOverlay}
      onClick={onClose}
      role="presentation"
    >
      <div
        className={styles.sheetContent}
        role="dialog"
        aria-modal="true"
        aria-label="Playback tools and settings"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.sheetHeader}>
          <h2 className={styles.sheetTitle}>Playback Tools</h2>
          <button
            type="button"
            className={styles.sheetCloseBtn}
            onClick={onClose}
            aria-label="Close tools menu"
          >
            <X size={20} />
          </button>
        </div>

        {/* Speed Selection */}
        <div className={styles.sheetSection}>
          <span className={styles.sheetSectionTitle}>Playback Speed</span>
          <div className={styles.speedGroup} role="group" aria-label="Playback speed selection">
            {PLAYBACK_SPEEDS.map((s) => (
              <button
                key={s}
                type="button"
                className={`${styles.speedBtn} ${
                  playbackSpeed === s ? styles.speedBtnActive : ''
                }`}
                disabled={!speedSupported}
                onClick={() => {
                  triggerHaptic('light');
                  onSetPlaybackSpeed(s);
                }}
                aria-label={`${s} times speed`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>

        {/* Bookmark & Deferred Tools */}
        <div className={styles.sheetSection}>
          <span className={styles.sheetSectionTitle}>Learning Tools</span>
          <div className={styles.toolList}>
            {/* Working Bookmark Toggle */}
            <div
              className={`${styles.toolRow} ${styles.toolRowInteractive}`}
              onClick={() => {
                triggerHaptic('light');
                onToggleBookmark();
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onToggleBookmark();
                }
              }}
              aria-label={bookmarked ? 'Remove bookmark' : 'Bookmark this chunk'}
            >
              <div className={styles.toolLeft}>
                <Bookmark
                  size={18}
                  fill={bookmarked ? '#5430FF' : 'none'}
                  color={bookmarked ? '#5430FF' : 'currentColor'}
                />
                <span>{bookmarked ? 'Bookmarked' : 'Add to bookmarks'}</span>
              </div>
            </div>

            {/* Deferred Frame Capture */}
            <div
              className={`${styles.toolRow} ${styles.toolRowDisabled}`}
              title="Frame capture coming later"
              aria-disabled="true"
            >
              <div className={styles.toolLeft}>
                <Camera size={18} />
                <span>Frame Capture</span>
              </div>
              <span className={styles.deferredBadge}>Coming later</span>
            </div>

            {/* Deferred Notes */}
            <div
              className={`${styles.toolRow} ${styles.toolRowDisabled}`}
              title="Notes coming later"
              aria-disabled="true"
            >
              <div className={styles.toolLeft}>
                <FileText size={18} />
                <span>Lesson Notes</span>
              </div>
              <span className={styles.deferredBadge}>Coming later</span>
            </div>

            {/* Deferred Voice Capture */}
            <div
              className={`${styles.toolRow} ${styles.toolRowDisabled}`}
              title="Voice notes coming later"
              aria-disabled="true"
            >
              <div className={styles.toolLeft}>
                <Mic size={18} />
                <span>Voice Note</span>
              </div>
              <span className={styles.deferredBadge}>Coming later</span>
            </div>

            {/* Deferred Report Issue */}
            <div
              className={`${styles.toolRow} ${styles.toolRowDisabled}`}
              title="Reporting coming later"
              aria-disabled="true"
            >
              <div className={styles.toolLeft}>
                <Flag size={18} />
                <span>Report Lesson</span>
              </div>
              <span className={styles.deferredBadge}>Coming later</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Main PlayMobile Screen
// ─────────────────────────────────────────────────────────────────────────────

export interface PlayMobileProps {
  playback: UsePlaybackResult;
}

export function PlayMobile({ playback }: PlayMobileProps) {
  const mobileContainerRef = useRef<HTMLDivElement | null>(null);
  const playbackRef = useRef(playback);
  playbackRef.current = playback;

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenFeedback, setFullscreenFeedback] = useState<string | null>(null);
  const [toolsOpen, setToolsOpen] = useState(false);

  // Fullscreen support
  const handleToggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      mobileContainerRef.current?.requestFullscreen().catch(() => {
        setFullscreenFeedback('Fullscreen mode was blocked by browser.');
        setTimeout(() => setFullscreenFeedback(null), 3500);
      });
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Stable navigation & interaction callbacks to avoid re-rendering memoized components
  const handleGoToIndex = useCallback((idx: number) => {
    playbackRef.current.goToIndex(idx);
  }, []);

  const handleChannelSelect = useCallback((channel: ChannelId) => {
    playbackRef.current.setActiveChannel(channel);
  }, []);

  const handleSearchQueryChange = useCallback((query: string) => {
    playbackRef.current.setSearchQuery(query);
  }, []);

  const handlePrefsUpdated = useCallback(() => {
    void playbackRef.current.fetchChannelFeed(playbackRef.current.activeChannel, 0);
  }, []);

  const handleNextChunk = useCallback(() => {
    playbackRef.current.nextChunk();
  }, []);

  const handlePreviousChunk = useCallback(() => {
    playbackRef.current.previousChunk();
  }, []);

  const handleTogglePlayback = useCallback(() => {
    playbackRef.current.togglePlayback();
  }, []);

  const handleToggleMute = useCallback(() => {
    playbackRef.current.toggleMute();
  }, []);

  const handleSeek = useCallback((percent: number) => {
    playbackRef.current.seekToPercent(percent);
  }, []);

  const handleSkip = useCallback((seconds: number) => {
    playbackRef.current.skipSeconds(seconds);
  }, []);

  const handleCompleteChunk = useCallback(() => {
    void playbackRef.current.completeActiveChunk();
  }, []);

  const handleSetPlaybackSpeed = useCallback((speed: number) => {
    playbackRef.current.setPlaybackSpeed(speed);
  }, []);

  const handleToggleBookmark = useCallback(() => {
    playbackRef.current.toggleBookmark();
  }, []);

  const handleOpenTools = useCallback(() => {
    setToolsOpen(true);
  }, []);

  const handleCloseTools = useCallback(() => {
    setToolsOpen(false);
  }, []);

  // 1D Horizontal Gesture Integration
  const { gestureProps, dragDeltaX, isDragging } = use1DGesture({
    onNext: playback.nextChunk,
    onPrev: playback.previousChunk,
    onTogglePlay: playback.togglePlayback,
    onToggleFullscreen: handleToggleFullscreen,
    onToggleMute: playback.toggleMute,
  });

  const mediaSource = useMemo(
    () => resolveMediaSource(playback.activeItem),
    [playback.activeItem]
  );

  const isVideo =
    playback.activeItem?.lessonType === 'video' &&
    (mediaSource.isYouTube || mediaSource.isDirectVideo);

  const isChunkCompleted =
    playback.activeItem && playback.isChunkCompleted
      ? playback.isChunkCompleted(playback.activeItem.chunkId)
      : false;

  const speedSupported = !playback.activeItem || mediaSource.isYouTube || mediaSource.isDirectVideo;

  const providerName = useMemo(() => {
    let name = playback.activeItem?.cohortProvider;
    if (!name) {
      if (mediaSource.isYouTube) name = 'YouTube';
      else if (mediaSource.isDirectVideo) name = 'Video';
      else if (mediaSource.isReading) name = 'Reading';
      else name = 'Course Media';
    }
    return name;
  }, [playback.activeItem?.cohortProvider, mediaSource]);

  const fitScores = useMemo(
    () => extractFitScores(playback.activeItem),
    [playback.activeItem]
  );

  // Reading Lesson Layout (only when an active reading item is loaded)
  if (!playback.feedLoading && !playback.feedError && playback.activeItem && !isVideo && playback.activeItem.content) {
    return (
      <main ref={mobileContainerRef} className={styles.mobilePlay}>
        <div className={styles.readingContainer}>
          <PlayMobileHeader
            feedItems={playback.feedItems}
            currentIndex={playback.currentIndex}
            itemStatuses={playback.itemStatuses}
            onGoToIndex={handleGoToIndex}
            activeChannel={playback.activeChannel}
            onChannelSelect={handleChannelSelect}
            searchQuery={playback.searchQuery}
            onSearchQueryChange={handleSearchQueryChange}
            onPrefsUpdated={handlePrefsUpdated}
            title={playback.lesson.title}
            providerName={providerName}
            mediaSource={mediaSource}
            fitScores={fitScores}
            currentChunk={playback.lesson.currentChunk}
            totalChunks={playback.lesson.totalChunks}
            ariaLabel="Playback Header"
          />

          <div className={styles.readingScrollArea}>
            <ReadingSurface
              item={playback.activeItem}
              pending={playback.completionPending}
              error={playback.completionError}
              onComplete={handleCompleteChunk}
            />
          </div>

          <div className={styles.readingDock}>
            <button
              type="button"
              className={styles.utilityButton}
              onClick={handlePreviousChunk}
              disabled={!playback.hasPrevious}
              aria-label="Previous chunk"
            >
              <ChevronLeft size={22} />
            </button>
            <button
              type="button"
              className={styles.utilityButton}
              onClick={handleOpenTools}
              aria-label="Playback tools and options"
            >
              <SlidersHorizontal size={18} />
            </button>
            <button
              type="button"
              className={styles.utilityButton}
              onClick={handleNextChunk}
              disabled={!playback.hasNext}
              aria-label="Next chunk"
            >
              <ChevronRight size={22} />
            </button>
          </div>
        </div>

        {/* Secondary Tools Drawer */}
        <PlayMobileToolsSheet
          isOpen={toolsOpen}
          onClose={handleCloseTools}
          playbackSpeed={playback.playbackSpeed}
          speedSupported={speedSupported}
          onSetPlaybackSpeed={handleSetPlaybackSpeed}
          bookmarked={playback.bookmarked}
          onToggleBookmark={handleToggleBookmark}
        />
      </main>
    );
  }

  const displayTitle =
    playback.feedLoading && (!playback.lesson.title || playback.lesson.title === 'Loading...')
      ? 'Syncing channel feed…'
      : playback.lesson.title;

  // Video Playback Layout
  return (
    <main ref={mobileContainerRef} className={styles.mobilePlay}>
      {/* ── Top Header ──────────────────────────────────────────────────────── */}
      <PlayMobileHeader
        feedItems={playback.feedItems}
        currentIndex={playback.currentIndex}
        itemStatuses={playback.itemStatuses}
        onGoToIndex={handleGoToIndex}
        activeChannel={playback.activeChannel}
        onChannelSelect={handleChannelSelect}
        searchQuery={playback.searchQuery}
        onSearchQueryChange={handleSearchQueryChange}
        onPrefsUpdated={handlePrefsUpdated}
        title={displayTitle}
        providerName={providerName}
        mediaSource={mediaSource}
        fitScores={fitScores}
        currentChunk={playback.lesson.currentChunk}
        totalChunks={playback.lesson.totalChunks}
        ariaLabel="Playback Header"
      />

      {/* ── Central Stage (16:9 Media surface or non-blocking stage status) ── */}
      {playback.feedLoading ? (
        <PlaySkeleton stageOnly />
      ) : playback.feedError ? (
        <PlaySkeleton
          stageOnly
          isError
          errorMessage="Lessons could not be loaded. Please check your connection and try reloading."
          onRetry={handlePrefsUpdated}
        />
      ) : !playback.activeItem ? (
        <PlaySkeleton
          stageOnly
          isEmpty
          errorTitle="All Caught Up"
          errorMessage="You're caught up with this selection. Choose another channel or return home."
          onRetry={handlePrefsUpdated}
          retryLabel="Refresh Channel"
        />
      ) : (
        <section
          className={styles.stageContainer}
          aria-label="Video playback area"
          {...gestureProps}
        >
          <div
            className={styles.surfaceWrapper}
            style={{
              transform: isDragging ? `translateX(${dragDeltaX}px)` : undefined,
              transition: isDragging ? 'none' : 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            <div className={styles.videoMountArea}>
              <PlayerSurface
                containerRef={playback.playerContainerRef}
                activeItem={playback.activeItem}
                ytApiError={playback.ytApiError}
                mediaError={playback.mediaError}
                onVideoMount={playback.registerVideoElement}
                onRetry={handleTogglePlayback}
                onCompleteChunk={handleCompleteChunk}
                isLoading={!playback.isPlayerReady && !playback.ytApiError && !playback.mediaError}
              />

              {!playback.isPlaying && (
                <button
                  type="button"
                  className={styles.playOverlayButton}
                  onClick={handleTogglePlayback}
                  aria-label="Play video"
                >
                  <PlayIcon size={28} fill="currentColor" style={{ marginLeft: 3 }} />
                </button>
              )}
            </div>

            {/* Integrated timeline scrubber */}
            <TimelineScrubber
              progress={playback.timelineProgress}
              onSeek={handleSeek}
              onSkip={handleSkip}
            />
          </div>

          <PlayMobileTimeBar
            currentTime={playback.lesson.currentTime}
            totalDuration={playback.lesson.totalDuration}
          />
        </section>
      )}

      {/* ── Primary Dock Controls ───────────────────────────────────────────── */}
      <PlayMobileDock
        isPlaying={playback.isPlaying}
        hasPrevious={playback.hasPrevious}
        hasNext={playback.hasNext}
        isChunkCompleted={isChunkCompleted}
        completionPending={playback.completionPending}
        completionError={playback.completionError}
        muted={playback.muted}
        isFullscreen={isFullscreen}
        onTogglePlay={handleTogglePlayback}
        onPreviousChunk={handlePreviousChunk}
        onNextChunk={handleNextChunk}
        onSkipSeconds={handleSkip}
        onCompleteChunk={handleCompleteChunk}
        onToggleMute={handleToggleMute}
        onToggleFullscreen={handleToggleFullscreen}
        onOpenTools={handleOpenTools}
      />

      {/* Toast feedback */}
      {(fullscreenFeedback || playback.completionError) && (
        <div className={styles.feedbackToast} role="alert">
          <AlertCircle size={15} />
          <span>{fullscreenFeedback || playback.completionError}</span>
        </div>
      )}

      {/* Secondary Tools Drawer */}
      <PlayMobileToolsSheet
        isOpen={toolsOpen}
        onClose={handleCloseTools}
        playbackSpeed={playback.playbackSpeed}
        speedSupported={speedSupported}
        onSetPlaybackSpeed={handleSetPlaybackSpeed}
        bookmarked={playback.bookmarked}
        onToggleBookmark={handleToggleBookmark}
      />
    </main>
  );
}
