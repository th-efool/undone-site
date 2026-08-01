'use client';

import { useEffect, useRef, useState } from 'react';
import { triggerHaptic } from '../utils/haptics';

export function usePullToRefresh(onRefresh: () => void | Promise<void>) {
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const startY = useRef<number | null>(null);
  const threshold = 70;

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleTouchStart = (e: TouchEvent) => {
      if (window.scrollY === 0) {
        startY.current = e.touches[0].clientY;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (startY.current === null || window.scrollY > 0) return;
      const currentY = e.touches[0].clientY;
      const deltaY = currentY - startY.current;

      if (deltaY > 0) {
        setIsPulling(true);
        const distance = Math.min(100, deltaY * 0.45);
        setPullDistance(distance);
      }
    };

    const handleTouchEnd = async () => {
      if (startY.current === null) return;

      if (pullDistance >= threshold && !isRefreshing) {
        setIsRefreshing(true);
        triggerHaptic('medium');
        try {
          await onRefresh();
        } finally {
          setIsRefreshing(false);
        }
      }

      startY.current = null;
      setIsPulling(false);
      setPullDistance(0);
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [pullDistance, isRefreshing, onRefresh]);

  return {
    isPulling,
    pullDistance,
    isRefreshing,
    threshold,
  };
}
