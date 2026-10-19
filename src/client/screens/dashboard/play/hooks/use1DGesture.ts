'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { triggerHaptic } from '@/src/client/utils/haptics';

export interface GestureOptions {
  onNext: () => void;
  onPrev: () => void;
  onTap?: (e: { x: number; y: number; width: number }) => void;
  onDoubleTap?: () => void;
  onDoubleTapLeft?: () => void;
  onDoubleTapRight?: () => void;
  onLongPressStart?: () => void;
  onLongPressEnd?: () => void;
  onTogglePlay?: () => void;
  onToggleFullscreen?: () => void;
  onToggleMute?: () => void;
  onToggleShortcutsHelp?: () => void;
  onToggleChannelSelector?: () => void;
  disabled?: boolean;
}

export function use1DGesture({
  onNext,
  onPrev,
  onTap,
  onDoubleTap,
  onDoubleTapLeft,
  onDoubleTapRight,
  onLongPressStart,
  onLongPressEnd,
  onTogglePlay,
  onToggleFullscreen,
  onToggleMute,
  onToggleShortcutsHelp,
  onToggleChannelSelector,
  disabled = false,
}: GestureOptions) {
  const [dragDeltaX, setDragDeltaX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isLongPressing, setIsLongPressing] = useState(false);

  const startXRef = useRef<number | null>(null);
  const startYRef = useRef<number | null>(null);
  const lastXRef = useRef<number>(0);
  const lastDeltaXRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const velocityXRef = useRef<number>(0);
  const isHorizontalGestureRef = useRef<boolean | null>(null);

  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const singleTapTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastTapRef = useRef<{ time: number; x: number }>({ time: 0, x: 0 });

  // Clear long press timer
  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (isLongPressing) {
      setIsLongPressing(false);
      onLongPressEnd?.();
    }
  }, [isLongPressing, onLongPressEnd]);

const isInteractiveElement = (target: HTMLElement | null): boolean => {
  if (!target || typeof target.closest !== 'function') return false;
  return Boolean(
    target.closest(
      'button, a, input, textarea, select, [role="button"], [role="slider"], [role="toolbar"], [role="menu"], [role="dialog"], [class*="toolbar"], [class*="controls"], [class*="timeline"], [class*="dock"], [class*="rail"], [class*="header"], [class*="dot"], [class*="capsule"], [class*="mobileControls"]'
    )
  );
};

  // Pointer Down
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (disabled) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (isInteractiveElement(e.target as HTMLElement)) return;

      try {
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      } catch {}

      startXRef.current = e.clientX;
      startYRef.current = e.clientY;
      lastXRef.current = e.clientX;
      lastDeltaXRef.current = 0;
      lastTimeRef.current = performance.now();
      velocityXRef.current = 0;
      isHorizontalGestureRef.current = null;

      // Setup long press check
      longPressTimerRef.current = setTimeout(() => {
        if (startXRef.current !== null && isHorizontalGestureRef.current !== false) {
          setIsLongPressing(true);
          triggerHaptic('medium');
          onLongPressStart?.();
        }
      }, 450);
    },
    [disabled, onLongPressStart]
  );

  // Pointer Move
  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (startXRef.current === null || startYRef.current === null) return;

      const deltaX = e.clientX - startXRef.current;
      const deltaY = e.clientY - startYRef.current;

      // Lock direction on initial movement threshold (> 6px)
      if (isHorizontalGestureRef.current === null) {
        const absX = Math.abs(deltaX);
        const absY = Math.abs(deltaY);
        if (absX > 6 || absY > 6) {
          if (absX > absY) {
            isHorizontalGestureRef.current = true;
            setIsDragging(true);
          } else {
            isHorizontalGestureRef.current = false;
            clearLongPress();
            return;
          }
        }
      }

      if (isHorizontalGestureRef.current) {
        // Cancel long press if moving significantly
        if (Math.abs(deltaX) > 15) {
          clearLongPress();
        }

        // Calculate instant velocity
        const now = performance.now();
        const dt = now - lastTimeRef.current;
        if (dt > 0) {
          velocityXRef.current = (e.clientX - lastXRef.current) / dt;
          lastXRef.current = e.clientX;
          lastTimeRef.current = now;
        }

        lastDeltaXRef.current = deltaX;
        setDragDeltaX(deltaX);
      }
    },
    [clearLongPress]
  );

  // Pointer Up / Cancel
  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      clearLongPress();
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
      } catch {}

      if (startXRef.current === null) return;
      const containerWidth = e.currentTarget.clientWidth || window.innerWidth;
      const finalDeltaX = lastDeltaXRef.current !== 0 ? lastDeltaXRef.current : dragDeltaX;
      const velocity = velocityXRef.current;

      const wasHorizontal = isHorizontalGestureRef.current;
      startXRef.current = null;
      startYRef.current = null;
      lastDeltaXRef.current = 0;
      isHorizontalGestureRef.current = null;
      setIsDragging(false);
      setDragDeltaX(0);

      // Handle horizontal swipe completion or snap back
      if (wasHorizontal) {
        // Responsive threshold: 60px or 12% width (min 40px) or fling velocity (0.30 px/ms)
        const distanceThreshold = Math.max(40, Math.min(70, containerWidth * 0.12));
        const velocityThreshold = 0.30; // px/ms

        if (finalDeltaX < -distanceThreshold || velocity < -velocityThreshold) {
          // Swipe left -> advance to next
          triggerHaptic('medium');
          onNext();
        } else if (finalDeltaX > distanceThreshold || velocity > velocityThreshold) {
          // Swipe right -> return to prev
          triggerHaptic('medium');
          onPrev();
        }
        return;
      }

      // Guard tap if released over an interactive control
      if (isInteractiveElement(e.target as HTMLElement)) {
        return;
      }

      // Handle Tap / Double Tap if it wasn't a swipe
      if (Math.abs(finalDeltaX) < 10) {
        const now = Date.now();
        const tapX = e.clientX;
        const tapY = e.clientY;
        const timeDiff = now - lastTapRef.current.time;
        const distDiff = Math.abs(tapX - lastTapRef.current.x);

        if (timeDiff < 250 && distDiff < 50) {
          // Double Tap -> Cancel Single Tap timer & trigger Immersion Mode (Scope-In <-> Scope-Out)
          if (singleTapTimerRef.current) {
            clearTimeout(singleTapTimerRef.current);
            singleTapTimerRef.current = null;
          }
          lastTapRef.current = { time: 0, x: 0 };
          triggerHaptic('light');
          onDoubleTap?.();
        } else {
          // Single Tap -> Set debouncing timer (220ms) to ensure it's not a double tap, then trigger Play/Pause
          lastTapRef.current = { time: now, x: tapX };
          if (singleTapTimerRef.current) {
            clearTimeout(singleTapTimerRef.current);
          }
          singleTapTimerRef.current = setTimeout(() => {
            onTap?.({ x: tapX, y: tapY, width: containerWidth });
            onTogglePlay?.();
            lastTapRef.current = { time: 0, x: 0 };
          }, 220);
        }
      }
    },
    [
      clearLongPress,
      dragDeltaX,
      onDoubleTap,
      onDoubleTapLeft,
      onDoubleTapRight,
      onNext,
      onPrev,
      onTap,
      onTogglePlay,
    ]
  );

  // Wheel Handler disabled for feed navigation - feed is DRAG SCROLLABLE ONLY per specification
  const handleWheel = useCallback((_e: React.WheelEvent<HTMLDivElement>) => {
    // Explicitly no-op: scrolling mouse wheel does NOT navigate feed chunks
  }, []);

  // Keyboard Shortcuts Listener
  useEffect(() => {
    if (disabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Never intercept modifier key combinations (e.g. Cmd+K, Ctrl+R, Alt+Tab)
      if (e.metaKey || e.ctrlKey || e.altKey) {
        return;
      }

      // Ignore if user is typing or interacting with form elements
      const target = e.target instanceof Element ? (e.target as HTMLElement) : null;
      if (target) {
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
          return;
        }

        // Ignore if focus is in an interactive button, link, slider, select, menu, or dialog
        const isButton = target.tagName === 'BUTTON' || (typeof target.closest === 'function' && target.closest('button') !== null);
        const isLink = target.tagName === 'A' || (typeof target.closest === 'function' && target.closest('a') !== null);
        const isSlider = target.getAttribute?.('role') === 'slider' || (typeof target.closest === 'function' && target.closest('[role="slider"]') !== null);
        const isSelect = target.tagName === 'SELECT' || (typeof target.closest === 'function' && target.closest('select') !== null);
        const isInDialog = typeof target.closest === 'function' && target.closest('[role="dialog"]') !== null;
        const isInMenu = typeof target.closest === 'function' && (target.closest('[role="menu"]') !== null || target.closest('[role="listbox"]') !== null);

        if (isInDialog || isInMenu || isSelect) {
          return;
        }

        // If focused on a button or link, spacebar or enter activates it natively; don't hijack it
        if ((isButton || isLink) && (e.key === ' ' || e.key === 'Enter')) {
          return;
        }

        // If focused on a slider (e.g. volume or seek), arrow keys adjust the slider; don't hijack them
        if (isSlider && (e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
          return;
        }
      }

      switch (e.key) {
        case 'ArrowRight':
        case 'l':
        case 'L':
          e.preventDefault();
          onNext();
          break;
        case 'ArrowLeft':
        case 'j':
        case 'J':
          e.preventDefault();
          onPrev();
          break;
        case ' ':
        case 'k':
        case 'K':
          e.preventDefault();
          onTogglePlay?.();
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          onToggleFullscreen?.();
          break;
        case 'm':
        case 'M':
          e.preventDefault();
          onToggleMute?.();
          break;
        case '?':
          e.preventDefault();
          onToggleShortcutsHelp?.();
          break;
        case 'c':
        case 'C':
          e.preventDefault();
          onToggleChannelSelector?.();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [disabled, onNext, onPrev, onToggleFullscreen, onToggleMute, onTogglePlay, onToggleShortcutsHelp, onToggleChannelSelector]);

  return {
    isDragging,
    dragDeltaX,
    isLongPressing,
    gestureProps: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerUp,
      onWheel: handleWheel,
    },
  };
}
