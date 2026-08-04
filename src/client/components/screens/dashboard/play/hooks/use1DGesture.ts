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
  disabled = false,
}: GestureOptions) {
  const [dragDeltaX, setDragDeltaX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isLongPressing, setIsLongPressing] = useState(false);

  const startXRef = useRef<number | null>(null);
  const startYRef = useRef<number | null>(null);
  const lastXRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const velocityXRef = useRef<number>(0);
  const isHorizontalGestureRef = useRef<boolean | null>(null);

  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const singleTapTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastTapRef = useRef<{ time: number; x: number }>({ time: 0, x: 0 });
  const wheelAccumulatorRef = useRef<number>(0);
  const wheelCooldownRef = useRef<boolean>(false);

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
  if (!target) return false;
  return Boolean(
    target.closest(
      'button, a, input, textarea, select, [role="button"], [class*="toolbar"], [class*="controls"], [class*="timeline"], [class*="dot"], [class*="mobileControls"]'
    )
  );
};

  // Pointer Down
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (disabled) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (isInteractiveElement(e.target as HTMLElement)) return;

      startXRef.current = e.clientX;
      startYRef.current = e.clientY;
      lastXRef.current = e.clientX;
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

        setDragDeltaX(deltaX);
      }
    },
    [clearLongPress]
  );

  // Pointer Up / Cancel
  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      clearLongPress();

      if (isInteractiveElement(e.target as HTMLElement)) {
        startXRef.current = null;
        startYRef.current = null;
        isHorizontalGestureRef.current = null;
        setIsDragging(false);
        setDragDeltaX(0);
        return;
      }

      if (startXRef.current === null) return;
      const containerWidth = e.currentTarget.clientWidth || window.innerWidth;
      const finalDeltaX = dragDeltaX;
      const velocity = velocityXRef.current;

      const wasHorizontal = isHorizontalGestureRef.current;
      startXRef.current = null;
      startYRef.current = null;
      isHorizontalGestureRef.current = null;
      setIsDragging(false);
      setDragDeltaX(0);

      // Handle horizontal swipe completion or snap back
      if (wasHorizontal) {
        const distanceThreshold = containerWidth * 0.30;
        const velocityThreshold = 0.45; // px/ms

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
      onDoubleTapLeft,
      onDoubleTapRight,
      onNext,
      onPrev,
      onTap,
      onTogglePlay,
    ]
  );

  // Wheel Handler for Touchpad horizontal swipe
  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      if (disabled || wheelCooldownRef.current) return;

      // Track horizontal trackpad delta
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && Math.abs(e.deltaX) > 15) {
        wheelAccumulatorRef.current += e.deltaX;

        if (Math.abs(wheelAccumulatorRef.current) > 60) {
          wheelCooldownRef.current = true;
          if (wheelAccumulatorRef.current > 0) {
            triggerHaptic('light');
            onNext();
          } else {
            triggerHaptic('light');
            onPrev();
          }
          wheelAccumulatorRef.current = 0;
          setTimeout(() => {
            wheelCooldownRef.current = false;
          }, 400);
        }
      }
    },
    [disabled, onNext, onPrev]
  );

  // Keyboard Shortcuts Listener
  useEffect(() => {
    if (disabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
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
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [disabled, onNext, onPrev, onToggleFullscreen, onTogglePlay]);

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
