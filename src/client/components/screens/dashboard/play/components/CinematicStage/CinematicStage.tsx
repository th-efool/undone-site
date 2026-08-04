'use client';

import React, { useRef, useState, useCallback, useEffect, JSX, ReactNode } from 'react';
import { use1DGesture } from '../../hooks/use1DGesture';
import { FastForward, Rewind, Zap, Maximize2, Minimize2 } from 'lucide-react';
import styles from './CinematicStage.module.css';

export interface CinematicStageProps {
  currentIndex: number;
  totalItems: number;
  isPlaying: boolean;
  itemStatuses?: ('completed' | 'skipped' | 'not-started' | 'in-progress')[];
  onIndexChange: (newIndex: number) => void;
  onSeek: (secondsDelta: number) => void;
  onSpeedChange: (speed: number) => void;
  onTogglePlay: () => void;
  onToggleFullscreen: () => void;
  renderScene: (index: number, isActive: boolean, isScopedIn: boolean) => ReactNode;
}

export function CinematicStage({
  currentIndex,
  totalItems,
  isPlaying,
  itemStatuses,
  onIndexChange,
  onSeek,
  onSpeedChange,
  onTogglePlay,
  onToggleFullscreen,
  renderScene,
}: CinematicStageProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [doubleTapBadge, setDoubleTapBadge] = useState<'left' | 'right' | null>(null);
  const [badgeTimer, setBadgeTimer] = useState<NodeJS.Timeout | null>(null);
  
  // Scope-In Mode state: false = Feed Browse Mode (vid Vid vid), true = Immersive Focus Mode
  // Default is FALSE (Scope Out Mode)
  const [isScopedIn, setIsScopedIn] = useState<boolean>(false);

  // Sync feedScoped state on html document element for CSS transitions
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.feedScoped = isScopedIn ? 'true' : 'false';
    }
    return () => {
      if (typeof document !== 'undefined') {
        delete document.documentElement.dataset.feedScoped;
      }
    };
  }, [isScopedIn]);

  const handleDoubleTapLeft = useCallback(() => {
    onSeek(-10);
    setDoubleTapBadge('left');
    if (badgeTimer) clearTimeout(badgeTimer);
    const timer = setTimeout(() => setDoubleTapBadge(null), 700);
    setBadgeTimer(timer);
  }, [onSeek, badgeTimer]);

  const handleDoubleTapRight = useCallback(() => {
    onSeek(10);
    setDoubleTapBadge('right');
    if (badgeTimer) clearTimeout(badgeTimer);
    const timer = setTimeout(() => setDoubleTapBadge(null), 700);
    setBadgeTimer(timer);
  }, [onSeek, badgeTimer]);

  const handleLongPressStart = useCallback(() => {
    onSpeedChange(2.0);
  }, [onSpeedChange]);

  const handleLongPressEnd = useCallback(() => {
    onSpeedChange(1.0);
  }, [onSpeedChange]);

  // When swiping next:
  // - If isScopedIn was TRUE: scope out, change index, scope back in!
  // - If isScopedIn was FALSE: STAY in Scope Out mode!
  const handleNext = useCallback(() => {
    if (currentIndex < totalItems - 1) {
      if (isScopedIn) {
        setIsScopedIn(false);
        setTimeout(() => {
          onIndexChange(currentIndex + 1);
          setTimeout(() => setIsScopedIn(true), 200);
        }, 150);
      } else {
        onIndexChange(currentIndex + 1);
      }
    }
  }, [currentIndex, totalItems, isScopedIn, onIndexChange]);

  // When swiping prev:
  // - If isScopedIn was TRUE: scope out, change index, scope back in!
  // - If isScopedIn was FALSE: STAY in Scope Out mode!
  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      if (isScopedIn) {
        setIsScopedIn(false);
        setTimeout(() => {
          onIndexChange(currentIndex - 1);
          setTimeout(() => setIsScopedIn(true), 200);
        }, 150);
      } else {
        onIndexChange(currentIndex - 1);
      }
    }
  }, [currentIndex, isScopedIn, onIndexChange]);

  const preFullscreenScopedRef = useRef<boolean>(false);

  // TASK 2: Fullscreen toggle memory restoration
  const handleToggleFullscreenWithMemory = useCallback(() => {
    const isCurrentlyFullscreen = Boolean(document.fullscreenElement);
    if (!isCurrentlyFullscreen) {
      // Expanding to Fullscreen -> remember current isScopedIn, push into immersive mode
      preFullscreenScopedRef.current = isScopedIn;
      setIsScopedIn(true);
      onToggleFullscreen();
    } else {
      // Shrinking from Fullscreen -> restore pre-fullscreen isScopedIn state
      setIsScopedIn(preFullscreenScopedRef.current);
      onToggleFullscreen();
    }
  }, [isScopedIn, onToggleFullscreen]);

  // Sync state when exiting fullscreen via Esc key or system gesture
  useEffect(() => {
    const handleFsChange = () => {
      if (!document.fullscreenElement) {
        setIsScopedIn(preFullscreenScopedRef.current);
      }
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
    };
  }, []);

  // TASK 1: Double tap toggles Immersion Mode (Scope-In <-> Scope-Out)
  const handleToggleImmersion = useCallback(() => {
    setIsScopedIn((prev) => !prev);
  }, []);

  const { isDragging, dragDeltaX, isLongPressing, gestureProps } = use1DGesture({
    onNext: handleNext,
    onPrev: handlePrev,
    onDoubleTap: handleToggleImmersion,
    onDoubleTapLeft: handleDoubleTapLeft,
    onDoubleTapRight: handleDoubleTapRight,
    onLongPressStart: handleLongPressStart,
    onLongPressEnd: handleLongPressEnd,
    onTogglePlay: onTogglePlay,
    onToggleFullscreen: handleToggleFullscreenWithMemory,
  });

  // 3-Node Virtual Window [i-1, i, i+1]
  const visibleIndices: number[] = [];
  if (currentIndex > 0) visibleIndices.push(currentIndex - 1);
  visibleIndices.push(currentIndex);
  if (currentIndex < totalItems - 1) visibleIndices.push(currentIndex + 1);

  // Calculate max 12 visible progress dots centered around currentIndex
  const maxDots = 12;
  const halfWindow = Math.floor(maxDots / 2);
  let startDot = Math.max(0, currentIndex - halfWindow);
  let endDot = Math.min(totalItems, startDot + maxDots);
  if (endDot - startDot < maxDots && startDot > 0) {
    startDot = Math.max(0, endDot - maxDots);
  }

  const visibleDotIndices: number[] = [];
  for (let k = startDot; k < endDot; k++) {
    visibleDotIndices.push(k);
  }

  const stageWidth = containerRef.current?.clientWidth || (typeof window !== 'undefined' ? window.innerWidth : 1000);
  const normProgress = Math.max(-1, Math.min(1, dragDeltaX / stageWidth));

  return (
    <div
      ref={containerRef}
      className={`${styles.stage} ${isDragging ? styles.dragging : ''}`}
      {...gestureProps}
    >
      {/* Minimal Feed Progress Dots */}
      <div
        className={`${styles.dotsContainer} ${isScopedIn ? styles.dotsContainerScoped : ''}`}
        aria-label="Feed Progress Indicators"
      >
        {visibleDotIndices.map((k) => {
          const isActive = k === currentIndex;
          const status = itemStatuses?.[k] || (k < currentIndex ? 'completed' : 'not-started');

          let dotClass = styles.dot;
          if (isActive) {
            dotClass = `${styles.dot} ${styles.dotActive}`;
          } else if (status === 'completed' || k < currentIndex) {
            dotClass = `${styles.dot} ${styles.dotCompleted}`;
          } else if (status === 'skipped') {
            dotClass = `${styles.dot} ${styles.dotSkipped}`;
          }

          return (
            <button
              key={k}
              type="button"
              className={dotClass}
              onClick={(e) => {
                e.stopPropagation();
                onIndexChange(k);
              }}
              title={`Jump to video ${k + 1}`}
            />
          );
        })}
      </div>

      {/* 2.0x Long Press Speed Badge */}
      {isLongPressing && (
        <div className={styles.speedBadge}>
          <Zap size={14} fill="currentColor" />
          2.0X SPEED
        </div>
      )}

      {/* Double Tap Seek Badges */}
      {doubleTapBadge === 'left' && (
        <div className={`${styles.badgeOverlay} ${styles.badgeLeft}`}>
          <Rewind size={18} fill="currentColor" />
          -10s
        </div>
      )}

      {doubleTapBadge === 'right' && (
        <div className={`${styles.badgeOverlay} ${styles.badgeRight}`}>
          <FastForward size={18} fill="currentColor" />
          +10s
        </div>
      )}

      {/* 3D Track Container */}
      <div className={styles.track}>
        {visibleIndices.map((idx) => {
          const offset = idx - currentIndex; // -1, 0, or +1
          const isActive = offset === 0;

          let translateX = 0;
          let translateZ = 0;
          let scale = 1.0;
          let opacity = 1.0;
          let blur = 0;

          if (isScopedIn) {
            // IMMERSIVE SCOPED MODE: Active card takes 100% full screen, adjacent cards hidden
            translateX = offset * stageWidth + dragDeltaX;
            if (offset === 0) {
              const absP = Math.abs(normProgress);
              translateZ = -120 * absP;
              scale = 1.0 - 0.08 * absP;
              opacity = 1.0 - 0.3 * absP;
              blur = 6 * absP;
            } else {
              opacity = 0;
            }
          } else {
            // FEED BROWSE MODE: vid Vid vid layout with 10% peeks on left and right!
            const stepX = stageWidth * 0.82;
            translateX = offset * stepX + dragDeltaX;

            if (offset === 0) {
              // Active center card
              const absP = Math.abs(normProgress);
              scale = 1.0 - 0.06 * absP;
              translateZ = -60 * absP;
              opacity = 1.0 - 0.2 * absP;
              blur = 4 * absP;
            } else if (offset === 1) {
              // Right peeking card
              const progress = Math.max(0, -normProgress);
              scale = 0.92 + 0.08 * progress;
              translateZ = -60 * (1 - progress);
              opacity = 0.65 + 0.35 * progress;
              blur = 4 * (1 - progress);
            } else if (offset === -1) {
              // Left peeking card
              const progress = Math.max(0, normProgress);
              scale = 0.92 + 0.08 * progress;
              translateZ = -60 * (1 - progress);
              opacity = 0.65 + 0.35 * progress;
              blur = 4 * (1 - progress);
            }
          }

          const style: React.CSSProperties = {
            transform: `translate3d(${translateX}px, 0px, ${translateZ}px) scale(${scale})`,
            opacity: opacity,
            filter: blur > 0.5 ? `blur(${blur.toFixed(1)}px)` : 'none',
            zIndex: isActive ? 10 : 5,
          };

          return (
            <div
              key={idx}
              className={`${styles.sceneNode} ${isScopedIn ? styles.scopedMode : styles.feedMode}`}
              style={style}
            >
              {renderScene(idx, isActive, isScopedIn)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
