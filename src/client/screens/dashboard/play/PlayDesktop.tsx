'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from '@/src/client/hooks/useToast';
import Image from 'next/image';
import { Play as PlayIcon, Layers } from 'lucide-react';
import {
  LessonCard,
  LearningTimeline,
  PlaybackControls,
  PlayerSurface,
  PlayerToolbar,
  CinematicStage,
} from './components';

import type { UsePlaybackResult } from './hooks/usePlayback';
import { triggerHaptic } from '@/src/client/utils/haptics';
import styles from './Play.module.css';

interface PlayDesktopProps {
  playback: UsePlaybackResult;
}

export function PlayDesktop({ playback }: PlayDesktopProps) {
  const toast = useToast();
  const [isIdle, setIsIdle] = useState(false);
  const playContainerRef = useRef<HTMLDivElement | null>(null);
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      playContainerRef.current?.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  const resetIdle = useCallback(() => {
    setIsIdle(false);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => setIsIdle(true), 2000);
  }, []);

  useEffect(() => {
    resetIdle();
    const evts = ['mousemove', 'mousedown', 'touchstart', 'keydown', 'wheel'];
    evts.forEach((e) => window.addEventListener(e, resetIdle));
    return () => {
      evts.forEach((e) => window.removeEventListener(e, resetIdle));
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [resetIdle]);

  const handleSpeedCycle = useCallback(() => {
    const speeds = [1, 1.25, 1.5, 2];
    const currIdx = speeds.indexOf(playback.playbackSpeed);
    const nextSpeed = speeds[(currIdx + 1) % speeds.length];
    playback.setPlaybackSpeed(nextSpeed);
  }, [playback]);

  const handleIndexChange = useCallback((newIndex: number) => {
    if (newIndex > playback.currentIndex) {
      playback.nextChunk();
      toast.success('Lesson completed! Keep going.');
    } else if (newIndex < playback.currentIndex) {
      playback.previousChunk();
    }
  }, [playback, toast]);

  const desktopOverlays = (
    <>
      {!playback.isPlaying && (
        <button
          type="button"
          aria-label="Play video"
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: 80,
            height: 80,
            borderRadius: '50%',
            background: 'rgba(0,0,0,0.65)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            border: '1px solid rgba(255,255,255,0.15)',
            zIndex: 10,
            cursor: 'pointer',
          }}
          onClick={(e) => {
            e.stopPropagation();
            playback.togglePlayback();
          }}
        >
          <PlayIcon size={36} fill="currentColor" style={{ marginLeft: 6 }} />
        </button>
      )}

      <div className={styles.lessonCardDesktop} style={{ opacity: isIdle ? 0 : 1, transition: 'opacity 0.6s ease' }}>
        <LessonCard lesson={playback.lesson} />
      </div>

      <div className={styles.toolbarDesktop} style={{ opacity: isIdle ? 0 : 1, transition: 'opacity 0.6s ease' }}>
        <PlayerToolbar
          playbackSpeed={playback.playbackSpeed}
          bookmarked={playback.bookmarked}
          onBookmark={playback.toggleBookmark}
          onSpeed={handleSpeedCycle}
          onComplete={() => { triggerHaptic('success'); playback.completeActiveChunk(); playback.nextChunk(); }}
        />
      </div>

      <div className={styles.timelineDesktop} style={{ opacity: isIdle ? 0 : 1, transition: 'opacity 0.6s ease' }}>
        <LearningTimeline
          progress={playback.timelineProgress}
          markers={playback.timelineMarkers}
          onSeek={playback.seekToPercent}
        />
      </div>

      <div
        className={styles.controlsDesktop}
        style={{ opacity: isIdle ? 0 : 1, transition: 'opacity 0.6s ease', pointerEvents: isIdle ? 'none' : 'auto' }}
      >
        <PlaybackControls
          currentTime={playback.lesson.currentTime}
          totalDuration={playback.lesson.totalDuration}
          volume={playback.volume}
          isPlaying={playback.isPlaying}
          onPlayPause={playback.togglePlayback}
          onSkipBack={() => playback.skipSeconds(-10)}
          onSkipForward={() => playback.skipSeconds(10)}
          onVolumeChange={playback.setVolume}
          onFullscreen={handleFullscreen}
          onCompleteChunk={() => { triggerHaptic('success'); playback.completeActiveChunk(); playback.nextChunk(); }}
          onNextChunk={playback.nextChunk}
          onPreviousChunk={playback.previousChunk}
          hasNext={playback.hasNext}
          hasPrevious={playback.hasPrevious}
        />
      </div>
    </>
  );

  const renderScene = useCallback(
    (index: number, isActive: boolean) => {
      const item = playback.feedItems[index];

      if (isActive) {
        return (
          <div className={styles.surfaceContainer}>
            <PlayerSurface containerRef={playback.playerContainerRef}>
              {desktopOverlays}
            </PlayerSurface>
          </div>
        );
      }

      const poster = item?.chunk?.lessonThumbnail || item?.chunk?.cohortCoverImage;
      const title = item?.chunk?.chunkTitle || item?.chunk?.lessonTitle || 'Upcoming Lesson';

      return (
        <div className={styles.inactiveSceneCard}>
          {poster ? (
            <div style={{ position: "relative", width: "100%", height: "100%" }}>
              <Image
                src={poster}
                alt={title}
                fill
                className={styles.scenePoster}
              />
            </div>
          ) : (
            <div className={styles.scenePosterFallback}>
              <Layers size={48} opacity={0.4} />
            </div>
          )}

          <div className={styles.sceneCardOverlay}>
            <div className={styles.sceneCardBadge}>
              <PlayIcon size={14} fill="currentColor" />
              <span>Next Lesson</span>
            </div>
            <h3 className={styles.sceneCardTitle}>{title}</h3>
          </div>
        </div>
      );
    },
    [playback.feedItems, playback.playerContainerRef, desktopOverlays]
  );

  return (
    <div ref={playContainerRef} className={styles.play}>
      <CinematicStage
        currentIndex={playback.currentIndex}
        totalItems={playback.feedItems.length || 1}
        isPlaying={playback.isPlaying}
        itemStatuses={playback.feedItems.map((item) => item.progress.status)}
        onIndexChange={handleIndexChange}
        onSeek={playback.skipSeconds}
        onSpeedChange={playback.setPlaybackSpeed}
        onTogglePlay={playback.togglePlayback}
        onToggleFullscreen={handleFullscreen}
        renderScene={renderScene}
      />
    </div>
  );
}
