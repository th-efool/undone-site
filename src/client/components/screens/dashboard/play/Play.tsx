'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/src/client/hooks/useToast';
import { Play as PlayIcon, ArrowLeft, Layers } from 'lucide-react';
import {
  LessonCard,
  LearningTimeline,
  PlaybackControls,
  PlayerSurface,
  PlayerToolbar,
  CinematicStage,
} from './components';

import { usePlayback } from './hooks/usePlayback';
import { triggerHaptic } from '@/src/client/utils/haptics';
import styles from './Play.module.css';

export function Play() {
  const router = useRouter();
  const toast = useToast();
  const playback = usePlayback();
  const [isIdle, setIsIdle] = useState(false);
  const [inFullscreen, setInFullscreen] = useState(false);
  const playContainerRef = useRef<HTMLDivElement | null>(null);
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      playContainerRef.current?.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  // Track fullscreen changes for exit button visibility
  useEffect(() => {
    const onFsChange = () => setInFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // Show hint once when entering fullscreen for first time
  useEffect(() => {
    if (inFullscreen) {
      const timer = setTimeout(() => {
        setIsIdle(false); // briefly show UI to reveal exit button
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [inFullscreen]);

  const handleExitPlay = useCallback(() => {
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
    router.push('/home');
  }, [router]);

  // Idle timer for UI fading
  const resetIdle = useCallback(() => {
    setIsIdle(false);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => setIsIdle(true), 4000);
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

  // Cycle speed helper: 1x -> 1.25x -> 1.5x -> 2x -> 1x
  const handleSpeedCycle = useCallback(() => {
    const speeds = [1, 1.25, 1.5, 2];
    const currIdx = speeds.indexOf(playback.playbackSpeed);
    const nextSpeed = speeds[(currIdx + 1) % speeds.length];
    playback.setPlaybackSpeed(nextSpeed);
  }, [playback]);

  // Handle KeepAwake for native app
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const capKeepAwake = await import('@capacitor-community/keep-awake');
        const KeepAwake = capKeepAwake.KeepAwake;
        if (!cancelled && KeepAwake) {
          if (playback.isPlaying) {
            await KeepAwake.keepAwake().catch(() => {});
          } else {
            await KeepAwake.allowSleep().catch(() => {});
          }
        }
      } catch {
        // Ignore if plugin fails or not native
      }
    })();

    return () => {
      cancelled = true;
      import('@capacitor-community/keep-awake')
        .then(({ KeepAwake }) => KeepAwake?.allowSleep().catch(() => {}))
        .catch(() => {});
    };
  }, [playback.isPlaying]);

  // Index navigation handlers
  const handleIndexChange = useCallback((newIndex: number) => {
    if (newIndex > playback.currentIndex) {
      playback.nextChunk();
      toast.success('Lesson completed! Keep going.');
    } else if (newIndex < playback.currentIndex) {
      playback.previousChunk();
    }
  }, [playback, toast]);

  // Desktop Overlay UI Controls
  const desktopOverlays = (
    <>
      {/* Center Play/Pause Button */}
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

      {/* Top-left lesson card */}
      <div className={styles.lessonCardDesktop} style={{ opacity: isIdle ? 0 : 1, transition: 'opacity 0.6s ease' }}>
        <LessonCard lesson={playback.lesson} />
      </div>

      {/* Right floating toolbar */}
      <div className={styles.toolbarDesktop} style={{ opacity: isIdle ? 0 : 1, transition: 'opacity 0.6s ease' }}>
        <PlayerToolbar
          playbackSpeed={playback.playbackSpeed}
          bookmarked={playback.bookmarked}
          onBookmark={playback.toggleBookmark}
          onSpeed={handleSpeedCycle}
          onComplete={() => { triggerHaptic('success'); playback.completeActiveChunk(); playback.nextChunk(); }}
        />
      </div>

      {/* Timeline Scrubber */}
      <div className={styles.timelineDesktop} style={{ opacity: isIdle ? 0 : 1, transition: 'opacity 0.6s ease' }}>
        <LearningTimeline
          progress={playback.timelineProgress}
          markers={playback.timelineMarkers}
          onSeek={playback.seekToPercent}
        />
      </div>

      {/* Bottom Playback Controls & Navigation */}
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

  // Mobile portrait controls
  const mobileControls = (
    <>
      <div className={styles.mobileHeader}>
        <LessonCard lesson={playback.lesson} compact />
        <div className={styles.toolbarActions}>
          <button
            className={`${styles.toolbarBtn} ${playback.bookmarked ? styles.toolbarBtnActive : ''}`}
            onClick={playback.toggleBookmark}
            aria-label="Toggle bookmark"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill={playback.bookmarked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
          </button>
          <button className={styles.toolbarBtn} onClick={handleSpeedCycle} aria-label="Toggle speed">
            <span className={styles.speedLabel}>{playback.playbackSpeed}x</span>
          </button>
        </div>
      </div>

      <div className={styles.mobileBottomControls}>
        <div className={styles.mobileTimeline}>
          <LearningTimeline
            progress={playback.timelineProgress}
            markers={playback.timelineMarkers}
            onSeek={playback.seekToPercent}
          />
        </div>

        <div className={styles.mobileControls}>
          <div className={styles.controlRowMain}>
            <button
              className={`${styles.skipBtn} ${styles.skipBack}`}
              onClick={() => playback.skipSeconds(-10)}
              aria-label="Rewind 10s"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="19 20 9 12 19 4 19 20"/><line x1="5" y1="19" x2="5" y2="5"/></svg>
              <span className={styles.skipLabel}>10</span>
            </button>

            <button
              className={styles.playBtn}
              onClick={playback.togglePlayback}
              aria-label={playback.isPlaying ? 'Pause' : 'Play'}
            >
              {playback.isPlaying ? (
                <svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
              ) : (
                <PlayIcon size={36} fill="currentColor" style={{ marginLeft: 2 }} />
              )}
            </button>

            <button
              className={`${styles.skipBtn} ${styles.skipForward}`}
              onClick={() => playback.skipSeconds(10)}
              aria-label="Forward 10s"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></svg>
              <span className={styles.skipLabel}>10</span>
            </button>
          </div>

          <div className={styles.timeDisplay}>{playback.lesson.currentTime} / {playback.lesson.totalDuration}</div>
        </div>
      </div>
    </>
  );

  // Render Scene callback for CinematicStage virtual windowing
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

      // Inactive / Preloading Scene Node Preview Card
      const poster = item?.chunk?.lessonThumbnail || item?.chunk?.cohortCoverImage;
      const title = item?.chunk?.chunkTitle || item?.chunk?.lessonTitle || 'Upcoming Lesson';

      return (
        <div className={styles.inactiveSceneCard}>
          {poster ? (
            <img
              src={poster}
              alt={title}
              className={styles.scenePoster}
            />
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
      {/* 3D Cinematic Stage Engine */}
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

      {/* Mobile portrait layout overlay */}
      <div className={styles.mobileControlsOverlay}>
        {mobileControls}
      </div>
    </div>
  );
}