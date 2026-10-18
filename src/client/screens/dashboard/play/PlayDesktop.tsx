'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  PlayHeader,
  PlayStage,
  PlayDock,
  PlayToolsRail,
  PlaySkeleton,
  ChannelSelector,
  ShortcutsDialog,
} from './components';
import type { UsePlaybackResult } from './hooks/usePlayback';
import { use1DGesture } from './hooks/use1DGesture';
import { resolveMediaSource } from './utils/mediaSource';
import { AlertCircle } from 'lucide-react';
import styles from './Play.module.css';

interface PlayDesktopProps {
  playback: UsePlaybackResult;
}

export function PlayDesktop({ playback }: PlayDesktopProps) {
  const playContainerRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenFeedback, setFullscreenFeedback] = useState<string | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [channelSelectorOpen, setChannelSelectorOpen] = useState(false);
  const preLongPressSpeedRef = useRef<number>(playback.playbackSpeed);

  useEffect(() => {
    preLongPressSpeedRef.current = playback.playbackSpeed;
  }, [playback.playbackSpeed]);

  const handleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      playContainerRef.current?.requestFullscreen().catch(() => {
        setFullscreenFeedback('Fullscreen mode was blocked by your browser settings.');
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

  const handleLongPressStart = useCallback(() => {
    preLongPressSpeedRef.current = playback.playbackSpeed;
    playback.setPlaybackSpeed(2.0);
  }, [playback]);

  const handleLongPressEnd = useCallback(() => {
    playback.setPlaybackSpeed(preLongPressSpeedRef.current || 1.0);
  }, [playback]);

  const { gestureProps } = use1DGesture({
    onNext: playback.nextChunk,
    onPrev: playback.previousChunk,
    onTogglePlay: playback.togglePlayback,
    onToggleFullscreen: handleFullscreen,
    onToggleMute: playback.toggleMute,
    onToggleShortcutsHelp: () => setShortcutsOpen((prev) => !prev),
    onToggleChannelSelector: () => setChannelSelectorOpen((prev) => !prev),
    onLongPressStart: handleLongPressStart,
    onLongPressEnd: handleLongPressEnd,
  });

  // Loading, error, or empty feed states
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
        isEmpty
        errorTitle="All Caught Up"
        errorMessage="You're caught up with this selection. Choose another channel or return home."
        onRetry={() => void playback.fetchChannelFeed(playback.activeChannel, 0)}
        retryLabel="Refresh Channel"
      />
    );
  }

  const mediaSource = resolveMediaSource(playback.activeItem);
  const speedSupported = mediaSource.isYouTube || mediaSource.isDirectVideo;
  const isChunkCompleted = playback.isChunkCompleted
    ? playback.isChunkCompleted(playback.activeItem.chunkId)
    : false;

  return (
    <div
      ref={playContainerRef}
      className={styles.play}
      {...gestureProps}
      tabIndex={-1}
    >
      {/* Compact Secondary Surface: Channel, Search & Shortcuts Help */}
      <div className={styles.channelFloatingAnchor}>
        <ChannelSelector
          activeChannel={playback.activeChannel}
          onChannelSelect={(ch) => {
            playback.setActiveChannel(ch);
            setChannelSelectorOpen(false);
          }}
          searchQuery={playback.searchQuery}
          onSearchQueryChange={playback.setSearchQuery}
          onPrefsUpdated={() => void playback.fetchChannelFeed(playback.activeChannel, 0)}
          isOpen={channelSelectorOpen}
          onOpenChange={setChannelSelectorOpen}
        />
        <button
          type="button"
          className={styles.shortcutsTriggerBtn}
          onClick={() => setShortcutsOpen(true)}
          aria-label="Keyboard shortcuts (?)"
          title="Keyboard shortcuts (?)"
        >
          ?
        </button>
      </div>

      {/* 1. Header: Position Capsules, Lesson Title, Provider Badge, Chunk & Episode Info */}
      <PlayHeader playback={playback} />

      {/* 2. Central Stage: Edge previews, 16:9 Video surface with timeline scrubber */}
      <PlayStage playback={playback} />

      {/* Feedback toast for fullscreen rejection or completion error */}
      {(fullscreenFeedback || playback.completionError) && (
        <div className={styles.feedbackToast} role="alert">
          <AlertCircle size={16} />
          <span>{fullscreenFeedback || playback.completionError}</span>
          {playback.completionError && (
            <button
              type="button"
              onClick={() => void playback.completeActiveChunk()}
              style={{
                background: 'rgba(255, 255, 255, 0.25)',
                border: 'none',
                borderRadius: 9999,
                color: '#fff',
                padding: '2px 8px',
                fontSize: 12,
                cursor: 'pointer',
                fontWeight: 600,
                marginLeft: 4,
              }}
            >
              Retry
            </button>
          )}
        </div>
      )}

      {/* 3. Bottom Dock: Fullscreen, Volume slider, Complete, Next, Speed menu, Captions, Report */}
      <PlayDock
        volume={playback.volume}
        muted={playback.muted}
        playbackSpeed={playback.playbackSpeed}
        hasNext={playback.hasNext}
        completionPending={playback.completionPending}
        completionError={playback.completionError}
        isCompleted={isChunkCompleted}
        speedSupported={speedSupported}
        isFullscreen={isFullscreen}
        onVolumeChange={playback.setVolume}
        onToggleMute={playback.toggleMute}
        onSpeedChange={playback.setPlaybackSpeed}
        onCompleteChunk={() => void playback.completeActiveChunk()}
        onNextChunk={playback.nextChunk}
        onToggleFullscreen={handleFullscreen}
      />

      {/* 4. Floating Right Rail: Learning tools (Capture, Annotate, Mic placeholders, Bookmark toggle) */}
      <PlayToolsRail
        bookmarked={playback.bookmarked}
        onToggleBookmark={playback.toggleBookmark}
      />

      {/* 5. Shortcuts Help Modal */}
      <ShortcutsDialog
        isOpen={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />
    </div>
  );
}
