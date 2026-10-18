'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { ChannelSelector } from '@/src/client/screens/dashboard/play/components/ChannelSelector';
import { PlayerSurface } from '@/src/client/screens/dashboard/play/components/PlayerSurface/PlayerSurface';
import { ReadingSurface } from '@/src/client/screens/dashboard/play/components/ReadingSurface';
import { PlaySkeleton } from '@/src/client/screens/dashboard/play/components/PlaySkeleton/PlaySkeleton';
import { resolveMediaSource } from '@/src/client/screens/dashboard/play/utils/mediaSource';
import { triggerHaptic } from '@/src/client/utils/haptics';
import styles from './PlayMobile.module.css';

interface PlayMobileProps {
  playback: UsePlaybackResult;
}

const PLAYBACK_SPEEDS = [0.75, 1, 1.25, 1.5, 2];

export function PlayMobile({ playback }: PlayMobileProps) {
  const mobileContainerRef = useRef<HTMLDivElement | null>(null);
  const scrubberRef = useRef<HTMLDivElement | null>(null);

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

  // Scrubber click handler
  const handleScrubberClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!scrubberRef.current) return;
      const rect = scrubberRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const percent = Math.min(100, Math.max(0, (clickX / rect.width) * 100));
      triggerHaptic('light');
      playback.seekToPercent(percent);
    },
    [playback]
  );

  // 1. Loading, error, or empty feed states
  if (playback.feedLoading) {
    return <PlaySkeleton />;
  }

  if (playback.feedError) {
    return (
      <PlaySkeleton
        isError
        errorMessage="Lessons could not be loaded. Please check your connection and try reloading."
        onRetry={() => void playback.fetchChannelFeed(playback.activeChannel, 0)}
      />
    );
  }

  if (!playback.activeItem) {
    return (
      <PlaySkeleton
        isError
        errorMessage="You're caught up with this selection. Choose another channel or return home."
        onRetry={() => void playback.fetchChannelFeed(playback.activeChannel, 0)}
      />
    );
  }

  const mediaSource = resolveMediaSource(playback.activeItem);
  const isVideo =
    playback.activeItem.lessonType === 'video' &&
    (mediaSource.isYouTube || mediaSource.isDirectVideo);
  const isChunkCompleted = playback.isChunkCompleted
    ? playback.isChunkCompleted(playback.activeItem.chunkId)
    : false;
  const speedSupported = mediaSource.isYouTube || mediaSource.isDirectVideo;

  let providerName = (playback.activeItem as any)?.cohortProvider as string | undefined;
  if (!providerName) {
    if (mediaSource.isYouTube) providerName = 'YouTube';
    else if (mediaSource.isDirectVideo) providerName = 'Video';
    else if (mediaSource.isReading) providerName = 'Reading';
    else providerName = 'Course Media';
  }

  const renderProviderIcon = () => {
    if (mediaSource.isYouTube) return <Tv size={12} color="#EF4444" />;
    if (mediaSource.isDirectVideo) return <Video size={12} color="#818CF8" />;
    if (mediaSource.isReading) return <BookOpen size={12} color="#34D399" />;
    return <Layers size={12} color="#94A3B8" />;
  };

  // 2. Reading Lesson Layout
  if (!isVideo && playback.activeItem.content) {
    return (
      <main ref={mobileContainerRef} className={styles.mobilePlay}>
        <div className={styles.readingContainer}>
          <header className={styles.header}>
            <div className={styles.topBarRow}>
              <div className={styles.capsulesRow} role="tablist" aria-label="Lesson progression">
                {playback.feedItems.map((item, idx) => {
                  const isSelected = idx === playback.currentIndex;
                  const isCompleted = playback.itemStatuses[idx] === 'completed';
                  return (
                    <button
                      key={item.chunkId || idx}
                      type="button"
                      className={`${styles.capsule} ${isSelected ? styles.capsuleActive : ''} ${
                        isCompleted ? styles.capsuleCompleted : ''
                      }`}
                      onClick={() => {
                        triggerHaptic('light');
                        playback.goToIndex(idx);
                      }}
                      aria-label={`Go to lesson chunk ${idx + 1}: ${item.chunkTitle || item.lessonTitle || ''}`}
                      aria-current={isSelected ? 'true' : undefined}
                    />
                  );
                })}
              </div>
              <ChannelSelector
                activeChannel={playback.activeChannel}
                onChannelSelect={playback.setActiveChannel}
                searchQuery={playback.searchQuery}
                onSearchQueryChange={playback.setSearchQuery}
                onPrefsUpdated={() => void playback.fetchChannelFeed(playback.activeChannel, 0)}
                isInline
              />
            </div>
            <div className={styles.metadataBlock}>
              <h1 className={styles.lessonTitle}>{playback.lesson.title}</h1>
              <div className={styles.subtitleRow}>
                <span className={styles.providerBadge}>
                  {renderProviderIcon()}
                  <span>{providerName}</span>
                </span>
                <span className={styles.dotSeparator}>•</span>
                <span>
                  Chunk {playback.lesson.currentChunk}/{playback.lesson.totalChunks}
                </span>
              </div>
            </div>
          </header>

          <div className={styles.readingScrollArea}>
            <ReadingSurface
              item={playback.activeItem}
              pending={playback.completionPending}
              error={playback.completionError}
              onComplete={() => void playback.completeActiveChunk()}
            />
          </div>

          <div className={styles.readingDock}>
            <button
              type="button"
              className={styles.iconButton}
              onClick={playback.previousChunk}
              disabled={!playback.hasPrevious}
              aria-label="Previous chunk"
            >
              <ChevronLeft size={22} />
            </button>
            <button
              type="button"
              className={styles.utilityButton}
              onClick={() => setToolsOpen(true)}
              aria-label="Playback tools and options"
            >
              <SlidersHorizontal size={18} />
            </button>
            <button
              type="button"
              className={styles.iconButton}
              onClick={playback.nextChunk}
              disabled={!playback.hasNext}
              aria-label="Next chunk"
            >
              <ChevronRight size={22} />
            </button>
          </div>
        </div>

        {/* Secondary Tools Drawer */}
        {renderToolsSheet()}
      </main>
    );
  }

  // 3. Video Playback Layout
  return (
    <main ref={mobileContainerRef} className={styles.mobilePlay}>
      {/* ── Top Header ──────────────────────────────────────────────────────── */}
      <header className={styles.header}>
        <div className={styles.topBarRow}>
          <div className={styles.capsulesRow} role="tablist" aria-label="Lesson progression">
            {playback.feedItems.map((item, idx) => {
              const isSelected = idx === playback.currentIndex;
              const isCompleted = playback.itemStatuses[idx] === 'completed';
              return (
                <button
                  key={item.chunkId || idx}
                  type="button"
                  className={`${styles.capsule} ${isSelected ? styles.capsuleActive : ''} ${
                    isCompleted ? styles.capsuleCompleted : ''
                  }`}
                  onClick={() => {
                    triggerHaptic('light');
                    playback.goToIndex(idx);
                  }}
                  aria-label={`Go to lesson chunk ${idx + 1}: ${item.chunkTitle || item.lessonTitle || ''}`}
                  aria-current={isSelected ? 'true' : undefined}
                />
              );
            })}
          </div>
          <ChannelSelector
            activeChannel={playback.activeChannel}
            onChannelSelect={playback.setActiveChannel}
            searchQuery={playback.searchQuery}
            onSearchQueryChange={playback.setSearchQuery}
            onPrefsUpdated={() => void playback.fetchChannelFeed(playback.activeChannel, 0)}
            isInline
          />
        </div>

        <div className={styles.metadataBlock}>
          <h1 className={styles.lessonTitle}>{playback.lesson.title}</h1>
          <div className={styles.subtitleRow}>
            <span className={styles.providerBadge}>
              {renderProviderIcon()}
              <span>{providerName}</span>
            </span>
            <span className={styles.dotSeparator}>•</span>
            <span>
              Chunk {playback.lesson.currentChunk}/{playback.lesson.totalChunks}
            </span>
          </div>
        </div>
      </header>

      {/* ── Central Stage (16:9 Media surface) ──────────────────────────────── */}
      <section className={styles.stageContainer} aria-label="Video playback area">
        <div className={styles.surfaceWrapper}>
          <div className={styles.videoMountArea}>
            <PlayerSurface
              containerRef={playback.playerContainerRef}
              activeItem={playback.activeItem}
              ytApiError={playback.ytApiError}
              mediaError={playback.mediaError}
              onVideoMount={playback.registerVideoElement}
              onRetry={playback.togglePlayback}
              onCompleteChunk={() => void playback.completeActiveChunk()}
            />

            {!playback.isPlaying && (
              <button
                type="button"
                className={styles.playOverlayButton}
                onClick={playback.togglePlayback}
                aria-label="Play video"
              >
                <PlayIcon size={28} fill="currentColor" style={{ marginLeft: 3 }} />
              </button>
            )}
          </div>

          {/* Integrated timeline scrubber */}
          <div
            ref={scrubberRef}
            className={styles.timelineScrubber}
            onClick={handleScrubberClick}
            role="slider"
            aria-label="Timeline seek scrubber"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(playback.timelineProgress)}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') {
                e.preventDefault();
                playback.skipSeconds(10);
              } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                playback.skipSeconds(-10);
              }
            }}
          >
            <div
              className={styles.timelineProgress}
              style={{ width: `${playback.timelineProgress}%` }}
            >
              <div className={styles.timelineThumb} />
            </div>
          </div>
        </div>

        <div className={styles.timeBar}>
          <span>{playback.lesson.currentTime}</span>
          <span>{playback.lesson.totalDuration}</span>
        </div>
      </section>

      {/* ── Primary Dock Controls ───────────────────────────────────────────── */}
      <footer className={styles.dock}>
        <div className={styles.primaryControlRow}>
          <div className={styles.controlCapsule}>
            <button
              type="button"
              className={styles.iconButton}
              onClick={() => {
                triggerHaptic('light');
                playback.skipSeconds(-10);
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
                playback.previousChunk();
              }}
              disabled={!playback.hasPrevious}
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
              playback.togglePlayback();
            }}
            aria-label={playback.isPlaying ? 'Pause' : 'Play'}
          >
            {playback.isPlaying ? (
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
                playback.nextChunk();
              }}
              disabled={!playback.hasNext}
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
                playback.skipSeconds(10);
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
            } ${playback.completionError ? styles.completeButtonError : ''}`}
            onClick={() => {
              triggerHaptic('light');
              void playback.completeActiveChunk();
            }}
            disabled={playback.completionPending}
            aria-label={
              isChunkCompleted
                ? 'Chunk completed'
                : playback.completionPending
                ? 'Saving completion'
                : playback.completionError
                ? 'Retry completion'
                : 'Complete chunk'
            }
          >
            {playback.completionPending ? (
              <Loader2 size={16} className={styles.spinner} />
            ) : playback.completionError ? (
              <RotateCcw size={16} />
            ) : (
              <Check size={16} />
            )}
            <span>
              {isChunkCompleted
                ? 'Completed'
                : playback.completionPending
                ? 'Saving…'
                : playback.completionError
                ? 'Retry'
                : 'Complete'}
            </span>
          </button>

          <button
            type="button"
            className={styles.utilityButton}
            onClick={() => {
              triggerHaptic('light');
              playback.toggleMute();
            }}
            aria-label={playback.muted ? 'Unmute volume' : 'Mute volume'}
            title={playback.muted ? 'Unmute' : 'Mute'}
          >
            {playback.muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>

          <button
            type="button"
            className={styles.utilityButton}
            onClick={() => {
              triggerHaptic('light');
              handleToggleFullscreen();
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
              setToolsOpen(true);
            }}
            aria-label="Playback tools and options"
            title="Tools & Settings"
          >
            <SlidersHorizontal size={18} />
          </button>
        </div>
      </footer>

      {/* Toast feedback */}
      {(fullscreenFeedback || playback.completionError) && (
        <div className={styles.feedbackToast} role="alert">
          <AlertCircle size={15} />
          <span>{fullscreenFeedback || playback.completionError}</span>
        </div>
      )}

      {/* Secondary Tools Drawer */}
      {renderToolsSheet()}
    </main>
  );

  function renderToolsSheet() {
    if (!toolsOpen) return null;

    return (
      <div
        className={styles.sheetOverlay}
        onClick={() => setToolsOpen(false)}
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
              onClick={() => setToolsOpen(false)}
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
                    playback.playbackSpeed === s ? styles.speedBtnActive : ''
                  }`}
                  disabled={!speedSupported}
                  onClick={() => {
                    triggerHaptic('light');
                    playback.setPlaybackSpeed(s);
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
                  playback.toggleBookmark();
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    playback.toggleBookmark();
                  }
                }}
                aria-label={playback.bookmarked ? 'Remove bookmark' : 'Bookmark this chunk'}
              >
                <div className={styles.toolLeft}>
                  <Bookmark
                    size={18}
                    fill={playback.bookmarked ? '#5430FF' : 'none'}
                    color={playback.bookmarked ? '#5430FF' : 'currentColor'}
                  />
                  <span>{playback.bookmarked ? 'Bookmarked' : 'Add to bookmarks'}</span>
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
  }
}
