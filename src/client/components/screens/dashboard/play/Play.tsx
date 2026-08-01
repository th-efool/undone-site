'use client';

import { useCallback, useEffect, useRef, useState, WheelEvent, TouchEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Play as PlayIcon, ArrowLeft } from 'lucide-react';
import {
  LessonCard,
  LearningTimeline,
  PlaybackControls,
  PlayerSurface,
  PlayerToolbar,
} from './components';

import { usePlayback } from './hooks/usePlayback';
import styles from './Play.module.css';

export function Play() {
  const router = useRouter();
  const playback = usePlayback();
  const [isIdle, setIsIdle] = useState(false);

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

  const handleTouchStart = useCallback((e: TouchEvent<HTMLDivElement>) => {
    touchStartY.current = e.touches[0].clientY;
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback(
    (e: TouchEvent<HTMLDivElement>) => {
      if (touchStartY.current === null) return;
      const deltaY = touchStartY.current - e.changedTouches[0].clientY;
      const deltaX = touchStartX.current !== null ? touchStartX.current - e.changedTouches[0].clientX : 0;
      touchStartY.current = null;
      touchStartX.current = null;

      // Horizontal swipe → skip (portrait mobile)
      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
        if (deltaX > 0) playback.skipSeconds(10);
        else playback.skipSeconds(-10);
        return;
      }

      // Vertical swipe → next/prev chunk (existing behavior)
      if (Math.abs(deltaY) < 50) return;
      if (deltaY > 0) {
        playback.nextChunk();
      } else {
        playback.previousChunk();
      }
    },
    [playback],
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
        playback.nextChunk();
      } else {
        playback.previousChunk();
      }

      setTimeout(() => {
        scrollCooldownRef.current = false;
      }, 600);
    },
    [playback],
  );

  // Handle keydown navigation (ArrowUp = prev, ArrowDown = next, Space = toggle play)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['textarea', 'input'].includes((e.target as HTMLElement)?.tagName?.toLowerCase())) {
        return;
      }

      if (e.key === 'ArrowDown' || e.key === 'PageDown') {
        e.preventDefault();
        playback.nextChunk();
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        playback.previousChunk();
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
          onCompleteChunk={playback.completeActiveChunk}
          onNextChunk={playback.nextChunk}
          onPreviousChunk={playback.previousChunk}
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
          onClick={playback.completeActiveChunk}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          Mark Done
        </button>

        <div className={styles.navRow}>
          <button
            className={styles.navBtnMobile}
            onClick={playback.previousChunk}
            disabled={!playback.hasPrevious}
          >
            ← Previous
          </button>
          <button
            className={styles.navBtnMobile}
            onClick={playback.nextChunk}
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
      className={styles.play}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Dedicated top-right back button to exit play & fullscreen */}
      <button
        type="button"
        className={styles.topRightBackButton}
        onClick={handleExitPlay}
        aria-label="Back to Home"
      >
        <ArrowLeft size={18} />
        <span>Back</span>
      </button>

      {/* PlayerSurface — always rendered for YouTube iframe mounting */}
      <PlayerSurface containerRef={playback.playerContainerRef}>{desktopOverlays}</PlayerSurface>

      {/* Mobile portrait layout — shown only on ≤768px, overlays video in normal flow */}
      <div className={styles.mobileControlsOverlay}>
        {mobileControls}
      </div>
    </div>
  );
}