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

  const [visualIndex, setVisualIndex] = useState(currentIndex);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const visualChangeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setVisualIndex(currentIndex);
  }, [currentIndex]);

  const handleNext = useCallback(() => {
    if (visualIndex < totalItems - 1) {
      const nextIdx = visualIndex + 1;
      setVisualIndex(nextIdx);
      if (isScopedIn) {
        setIsScopedIn(false);
        setTimeout(() => setIsScopedIn(true), 350);
      }
    }
  }, [visualIndex, totalItems, isScopedIn]);

  const handlePrev = useCallback(() => {
    if (visualIndex > 0) {
      const prevIdx = visualIndex - 1;
      setVisualIndex(prevIdx);
      if (isScopedIn) {
        setIsScopedIn(false);
        setTimeout(() => setIsScopedIn(true), 350);
      }
    }
  }, [visualIndex, isScopedIn]);

  useEffect(() => {
    if (visualIndex !== currentIndex) {
      if ('onscrollend' in window) {
        // If the browser supports scrollend natively, we can use it.
        // Wait, if we use a native scroll container, the event fires there.
        // If we simulate it without native scrolling, we can't fire the native event easily.
      }
      
      // Fallback or main logic if no native scrolling:
      if (visualChangeTimeoutRef.current) clearTimeout(visualChangeTimeoutRef.current);
      visualChangeTimeoutRef.current = setTimeout(() => {
        onIndexChange(visualIndex);
      }, 400); // Wait for gesture/animation to finish
    }
    return () => {
      if (visualChangeTimeoutRef.current) clearTimeout(visualChangeTimeoutRef.current);
    };
  }, [visualIndex, currentIndex, onIndexChange]);

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

  // Native Scroll implementation for CinematicStage
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const width = target.clientWidth;
    const scrollX = target.scrollLeft;
    
    const newVisual = Math.round(scrollX / width);
    if (newVisual !== visualIndex && newVisual >= 0 && newVisual < totalItems) {
      setVisualIndex(newVisual);
      // Scope animation trigger
      if (isScopedIn) {
        setIsScopedIn(false);
        setTimeout(() => setIsScopedIn(true), 350);
      }
    }

    // Fallback for browsers that don't support onScrollEnd
    if (!('onscrollend' in window)) {
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = setTimeout(() => {
        if (newVisual !== currentIndex) {
          onIndexChange(newVisual);
        }
      }, 150);
    }
  }, [visualIndex, currentIndex, isScopedIn, totalItems, onIndexChange]);

  const handleScrollEnd = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const width = target.clientWidth;
    const scrollX = target.scrollLeft;
    const newVisual = Math.round(scrollX / width);
    
    if (newVisual !== currentIndex && newVisual >= 0 && newVisual < totalItems) {
      onIndexChange(newVisual);
    }
  }, [currentIndex, totalItems, onIndexChange]);

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
  if (visualIndex > 0) visibleIndices.push(visualIndex - 1);
  visibleIndices.push(visualIndex);
  if (visualIndex < totalItems - 1) visibleIndices.push(visualIndex + 1);

  // Calculate max 12 visible progress dots centered around visualIndex
  const maxDots = 12;
  const halfWindow = Math.floor(maxDots / 2);
  let startDot = Math.max(0, visualIndex - halfWindow);
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
      style={{ overflowX: 'auto', scrollSnapType: 'x mandatory', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      onScroll={handleScroll}
      onScrollEnd={handleScrollEnd}
    >
      {/* Spacer for native scrolling */}
      <div style={{ display: 'flex', width: `${totalItems * 100}%`, height: '1px', pointerEvents: 'none' }}>
        {Array.from({ length: totalItems }).map((_, i) => (
          <div key={i} style={{ flex: '0 0 100%', scrollSnapAlign: 'center' }} />
        ))}
      </div>

      {/* Sticky container for the 3D scene */}
      <div style={{ position: 'sticky', left: 0, top: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
        {/* Minimal Feed Progress Dots */}
        <div
          className={`${styles.dotsContainer} ${isScopedIn ? styles.dotsContainerScoped : ''}`}
          aria-label="Feed Progress Indicators"
          style={{ pointerEvents: 'auto' }}
        >
          {visibleDotIndices.map((k) => {
            const isActive = k === visualIndex;
            const status = itemStatuses?.[k] || (k < visualIndex ? 'completed' : 'not-started');

            let dotClass = styles.dot;
            if (isActive) {
              dotClass = `${styles.dot} ${styles.dotActive}`;
            } else if (status === 'completed' || k < visualIndex) {
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
                  setVisualIndex(k);
                  if (containerRef.current) {
                    containerRef.current.scrollTo({ left: k * containerRef.current.clientWidth, behavior: 'smooth' });
                  }
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
        <div className={styles.track} style={{ pointerEvents: 'auto' }}>
          {visibleIndices.map((idx) => {
            const offset = idx - visualIndex; // -1, 0, or +1
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
    </div>
  );
}
