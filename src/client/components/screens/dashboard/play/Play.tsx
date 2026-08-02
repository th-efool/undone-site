'use client';

import { useCallback, useEffect, useRef, useState, WheelEvent, PointerEvent as ReactPointerEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/src/client/hooks/useToast';
import { Play as PlayIcon, ArrowLeft } from 'lucide-react';
import {
  LessonCard,
  LearningTimeline,
  PlaybackControls,
  PlayerSurface,
  PlayerToolbar,
} from './components';

import { usePlayback } from './hooks/usePlayback';
import { triggerHaptic } from '@/src/client/utils/haptics';
import styles from './Play.module.css';

export function Play() {
  const router = useRouter();
  const toast = useToast();
  const playback = usePlayback();
  const [isIdle, setIsIdle] = useState(false);
  const [animationClass, setAnimationClass] = useState('');
  const [doubleTapBadge, setDoubleTapBadge] = useState<'left' | 'right' | null>(null);
  const [inFullscreen, setInFullscreen] = useState(false);
  const playContainerRef = useRef<HTMLDivElement | null>(null);
  const lastTapRef = useRef<{ time: number; x: number }>({ time: 0, x: 0 });

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
  const scrollCooldownRef = useRef(false);
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartY = useRef<number | null>(null);
  const touchStartX = useRef<number | null>(null);

  const handlePointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    touchStartY.current = e.clientY;
    touchStartX.current = e.clientX;
  }, []);

  const handleNextChunk = useCallback(() => {
    if (!playback.hasNext) return;
    triggerHaptic('medium');
    setAnimationClass(styles.animateSlideUp);
    setTimeout(() => setAnimationClass(''), 350);
    playback.nextChunk();
    toast.success('Lesson completed! Keep going.');
  }, [playback, toast]);

  const handlePreviousChunk = useCallback(() => {
    if (!playback.hasPrevious) return;
    triggerHaptic('medium');
    setAnimationClass(styles.animateSlideDown);
    setTimeout(() => setAnimationClass(''), 350);
    playback.previousChunk();
  }, [playback]);

  const handlePointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (touchStartY.current === null) return;
      const deltaY = touchStartY.current - e.clientY;
      const deltaX = touchStartX.current !== null ? touchStartX.current - e.clientX : 0;
      touchStartY.current = null;
      touchStartX.current = null;

      // Horizontal swipe → skip (portrait mobile)
      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
        if (deltaX > 0) playback.skipSeconds(10);
        else playback.skipSeconds(-10);
        return;
      }

      // Vertical swipe → next/prev chunk
      if (Math.abs(deltaY) < 50) {
        // Double-tap detection for left/right halves
        const now = Date.now();
        const tapX = e.clientX;
        const width = window.innerWidth;

        if (now - lastTapRef.current.time < 300 && Math.abs(tapX - lastTapRef.current.x) < 80) {
          if (tapX < width * 0.4) {
            playback.skipSeconds(-10);
            triggerHaptic('light');
            setDoubleTapBadge('left');
            setTimeout(() => setDoubleTapBadge(null), 450);
          } else if (tapX > width * 0.6) {
            playback.skipSeconds(10);
            triggerHaptic('light');
            setDoubleTapBadge('right');
            setTimeout(() => setDoubleTapBadge(null), 450);
          }
        }
        lastTapRef.current = { time: now, x: tapX };
        return;
      }
      if (deltaY > 0) {
        handleNextChunk();
      } else {
        handlePreviousChunk();
      }
    },
    [playback, handleNextChunk, handlePreviousChunk],
  );

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

  // Handle wheel / mouse scroll for vertical feed card transitions
  const handleWheel = useCallback(
    (e: WheelEvent<HTMLDivElement>) => {
      if (scrollCooldownRef.current) return;
      if (Math.abs(e.deltaY) < 30) return;

      scrollCooldownRef.current = true;
      if (e.deltaY > 0) {
        handleNextChunk();
      } else {
        handlePreviousChunk();
      }

      setTimeout(() => {
        scrollCooldownRef.current = false;
      }, 600);
    },
    [handleNextChunk, handlePreviousChunk],
  );

  // Handle keydown navigation (ArrowUp = prev, ArrowDown = next, Space = toggle play)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['textarea', 'input'].includes((e.target as HTMLElement)?.tagName?.toLowerCase())) {
        return;
      }

      if (e.key === 'ArrowDown' || e.key === 'PageDown') {
        e.preventDefault();
        handleNextChunk();
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        handlePreviousChunk();
      } else if (e.key === ' ') {
        e.preventDefault();
        playback.togglePlayback();
      } else if (e.key === 'm' || e.key === 'M') {
        playback.toggleMute();
      } else if (e.key === 'b' || e.key === 'B') {
        playback.toggleBookmark();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
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
      // Ensure we always allow sleep on unmount
      import('@capacitor-community/keep-awake')
        .then(({ KeepAwake }) => KeepAwake?.allowSleep().catch(() => {}))
        .catch(() => {});
    };
  }, [playback.isPlaying]);

  // ── Desktop overlay elements (rendered inside PlayerSurface on desktop) ─
  const desktopOverlays = (
    <>
      {/* Invisible Click Overlay for Play/Pause */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 2,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        onClick={playback.togglePlayback}
      >
        {!playback.isPlaying && (
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              background: 'rgba(0,0,0,0.6)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <PlayIcon size={36} fill="currentColor" style={{ marginLeft: 6 }} />
          </div>
        )}
      </div>

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
          onCompleteChunk={() => { triggerHaptic('success'); playback.completeActiveChunk(); handleNextChunk(); }}
          onNextChunk={handleNextChunk}
          onPreviousChunk={handlePreviousChunk}
          hasNext={playback.hasNext}
          hasPrevious={playback.hasPrevious}
        />
      </div>
    </>
  );

  // ── Mobile portrait controls (shown below video in portrait) ────────
  const mobileControls = (
    <>
      {/* Lesson info header + merged toolbar actions */}
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

      {/* Timeline Scrubber */}
      <div className={styles.mobileTimeline}>
        <LearningTimeline
          progress={playback.timelineProgress}
          markers={playback.timelineMarkers}
          onSeek={playback.seekToPercent}
        />
      </div>

      {/* Playback Controls — touch-friendly grid */}
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

        <button
          className={styles.doneBtnFull}
          onClick={() => { triggerHaptic('success'); playback.completeActiveChunk(); handleNextChunk(); }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          Mark Done
        </button>

        <div className={styles.navRow}>
          <button
            className={styles.navBtnMobile}
            onClick={handlePreviousChunk}
            disabled={!playback.hasPrevious}
          >
            ← Previous
          </button>
          <button
            className={styles.navBtnMobile}
            onClick={handleNextChunk}
            disabled={!playback.hasNext}
          >
            Next →
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div
      ref={playContainerRef}
      className={styles.play}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* Exit fullscreen button — always visible when in fullscreen mode */}
      {inFullscreen && (
        <button
          type="button"
          className={`${styles.topRightBackButton} ${styles.exitFsBtn}`}
          onClick={() => document.exitFullscreen?.()}
          aria-label="Exit Fullscreen"
          style={{
            top: '16px',
            right: `${isIdle ? 72 : 140}px`,
          }}
        >
          <span>⛶</span>
          <span className={styles.exitFsLabel}>Exit Fullscreen</span>
        </button>
      )}

      {/* Dedicated top-right back button to exit play & fullscreen */}
      <button
        type="button"
        className={styles.topRightBackButton}
        onClick={handleExitPlay}
        aria-label="Back to Home"
        style={{
          opacity: isIdle ? 0 : 1,
          pointerEvents: isIdle ? 'none' : 'auto',
          transition: 'opacity 0.6s ease',
        }}
      >
        <ArrowLeft size={18} />
        <span>Back</span>
      </button>

      {/* Floating double-tap rewind/fast-forward badges */}
      {doubleTapBadge === 'left' && (
        <div className={styles.doubleTapBadgeLeft}>
          <span>⏪ 10s</span>
        </div>
      )}
      {doubleTapBadge === 'right' && (
        <div className={styles.doubleTapBadgeRight}>
          <span>10s ⏩</span>
        </div>
      )}

      {/* PlayerSurface — always rendered for YouTube iframe mounting */}
      <div className={`${styles.surfaceContainer} ${animationClass}`}>
        <PlayerSurface containerRef={playback.playerContainerRef}>{desktopOverlays}</PlayerSurface>
      </div>

      {/* Mobile portrait layout — shown only on ≤768px, overlays video in normal flow */}
      <div className={styles.mobileControlsOverlay}>
        {mobileControls}
      </div>
    </div>
  );
}