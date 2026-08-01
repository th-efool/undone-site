'use client';

import { useCallback, useEffect, useRef, useState, WheelEvent, TouchEvent } from 'react';
import { X, Sparkles, ListVideo, Play as PlayIcon } from 'lucide-react';
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
  const playback = usePlayback();
  const [isIdle, setIsIdle] = useState(false);
  const scrollCooldownRef = useRef(false);
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartY = useRef<number | null>(null);
  const [orientationLocked, setOrientationLocked] = useState(false);

  // Orientation lock for mobile — enforce landscape in app mode
  useEffect(() => {
    const isMobile = window.innerWidth <= 768;
    const isInApp = document.documentElement.getAttribute('data-platform') === 'app';
    
    if (!isMobile) return;

    const lockOrientation = async () => {
      try {
        // Try web API first
        await (screen.orientation as any).lock('landscape');
        setOrientationLocked(true);
      } catch {
        setOrientationLocked(false);
      }
    };
    
    // In app mode, also try Capacitor screen-orientation plugin
    const lockCapacitorOrientation = async () => {
      if (isInApp) {
        try {
          const ScreenOrientation = await import('@capacitor/screen-orientation');
          if ((ScreenOrientation as any).ScreenOrientation) {
            await (ScreenOrientation as any).ScreenOrientation.lock({ orientation: 'landscape' });
            setOrientationLocked(true);
          }
        } catch {
          // Plugin not installed, continue with web API fallback
        }
      }
    };

    lockOrientation();
    lockCapacitorOrientation();
    document.body.style.overflow = 'hidden';

    // Monitor orientation changes and force landscape in app mode
    const checkAndForceLandscape = () => {
      if (!isMobile) return;
      
      const isPortrait = window.innerHeight > window.innerWidth;
      if (isInApp && isPortrait && !orientationLocked) {
        // Show rotation prompt or attempt to force landscape
        document.documentElement.classList.add('portrait-mode');
        lockOrientation();
        lockCapacitorOrientation();
      } else {
        document.documentElement.classList.remove('portrait-mode');
      }
    };

    checkAndForceLandscape();
    window.addEventListener('resize', checkAndForceLandscape);
    window.addEventListener('orientationchange', checkAndForceLandscape);

    return () => {
      try { (screen.orientation as any).unlock?.(); } catch {}
      document.body.style.overflow = '';
      document.documentElement.classList.remove('portrait-mode');
      window.removeEventListener('resize', checkAndForceLandscape);
      window.removeEventListener('orientationchange', checkAndForceLandscape);
    };
  }, [orientationLocked]);

  const handleTouchStart = useCallback((e: TouchEvent<HTMLDivElement>) => {
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback((e: TouchEvent<HTMLDivElement>) => {
    if (touchStartY.current === null) return;
    const deltaY = touchStartY.current - e.changedTouches[0].clientY;
    touchStartY.current = null;
    if (Math.abs(deltaY) < 50) return;
    if (deltaY > 0) {
      playback.nextChunk();
    } else {
      playback.previousChunk();
    }
  }, [playback]);

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

  return (
    <div className={styles.play} onWheel={handleWheel} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <PlayerSurface containerRef={playback.playerContainerRef}>
        {/* Invisible Click Overlay for Play/Pause */}
        <div 
          style={{ position: 'absolute', inset: 0, zIndex: 2, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={playback.togglePlayback}
        >
          {/* Custom Pause Overlay Icon */}
          {!playback.isPlaying && (
            <div style={{
              width: 80, height: 80, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)',
              animation: 'pulse 2s infinite ease-in-out'
            }}>
              <PlayIcon size={36} fill="currentColor" style={{ marginLeft: 6 }} />
            </div>
          )}
        </div>

        {/* Top-left lesson card */}
        <div className={styles.lessonCard} style={{ opacity: isIdle ? 0 : 1, transition: 'opacity 0.6s ease' }}>
          <LessonCard lesson={playback.lesson} />
        </div>

        {/* Right floating toolbar */}
        <div className={styles.toolbar} style={{ opacity: isIdle ? 0 : 1, transition: 'opacity 0.6s ease' }}>
          <PlayerToolbar
            playbackSpeed={playback.playbackSpeed}
            bookmarked={playback.bookmarked}
            onBookmark={playback.toggleBookmark}
            onSpeed={handleSpeedCycle}
          />
        </div>

        {/* Timeline Scrubber */}
        <div className={styles.timeline} style={{ opacity: isIdle ? 0 : 1, transition: 'opacity 0.6s ease' }}>
          <LearningTimeline
            progress={playback.timelineProgress}
            markers={playback.timelineMarkers}
            onSeek={playback.seekToPercent}
          />
        </div>

        {/* Bottom Playback Controls & Navigation */}
        <div className={styles.controls} style={{ opacity: isIdle ? 0 : 1, transition: 'opacity 0.6s ease', pointerEvents: isIdle ? 'none' : 'auto' }}>
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
            hasNext={playback.currentIndex < playback.feedItems.length - 1}
            hasPrevious={playback.currentIndex > 0}
          />
        </div>

        {/* Rotation prompt overlay — shown only in app mode when stuck in portrait */}
        <div className={styles.rotationPrompt} data-rotation-prompt="true">
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>📱</div>
          <h2 style={{ margin: 0, fontSize: '1.5rem' }}>Rotate Your Device</h2>
          <p style={{ opacity: 0.8, margin: 0, fontSize: '0.95rem' }}>This lesson is best viewed in landscape mode for the full experience.</p>
        </div>
      </PlayerSurface>
    </div>
  );
}
