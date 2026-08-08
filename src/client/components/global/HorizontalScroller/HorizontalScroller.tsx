'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import React, { PropsWithChildren, useEffect, useRef, useState } from 'react';

import styles from './HorizontalScroller.module.css';

export interface HorizontalScrollerProps extends PropsWithChildren {
  className?: string;
  scrollAmount?: number;
  loop?: boolean;
  showArrows?: boolean;
}

export interface HorizontalScrollerHandle {
  scrollLeft: () => void;
  scrollRight: () => void;
}

export const HorizontalScroller = React.forwardRef<
  HorizontalScrollerHandle,
  HorizontalScrollerProps
>(function HorizontalScroller(
  {
    children,
    className,
    scrollAmount = 320,
    loop = false,
    showArrows = true,
  }: HorizontalScrollerProps,
  ref,
) {
  const viewportRef = useRef<HTMLDivElement>(null);

  React.useImperativeHandle(ref, () => ({
    scrollLeft: () => scroll(-scrollAmount),
    scrollRight: () => scroll(scrollAmount),
  }));

  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const startX = useRef(0);
  const scrollLeft = useRef(0);
  const isLoopingRef = useRef(false);

  function updateButtons() {
    const viewport = viewportRef.current;
    if (!viewport || !showArrows) {
      setShowLeft(false);
      setShowRight(false);
      return;
    }

    if (loop) {
      const singleSetWidth = viewport.scrollWidth / 3;
      const hasOverflow = singleSetWidth > viewport.clientWidth;
      setShowLeft(hasOverflow);
      setShowRight(hasOverflow);
      return;
    }

    setShowLeft(viewport.scrollLeft > 1);
    setShowRight(viewport.scrollLeft + viewport.clientWidth < viewport.scrollWidth - 1);
  }

  function handleScroll() {
    updateButtons();
    if (!loop) return;
    const viewport = viewportRef.current;
    if (!viewport || isLoopingRef.current) return;

    const singleSetWidth = viewport.scrollWidth / 3;
    if (singleSetWidth <= 0) return;

    if (viewport.scrollLeft >= singleSetWidth * 2 - 10) {
      isLoopingRef.current = true;
      viewport.scrollLeft = viewport.scrollLeft - singleSetWidth;
      requestAnimationFrame(() => { isLoopingRef.current = false; });
    } else if (viewport.scrollLeft <= 10) {
      isLoopingRef.current = true;
      viewport.scrollLeft = viewport.scrollLeft + singleSetWidth;
      requestAnimationFrame(() => { isLoopingRef.current = false; });
    }
  }

  function scroll(offset: number) {
    const viewport = viewportRef.current;
    if (!viewport) return;

    viewport.scrollBy({
      left: offset,
      behavior: 'smooth',
    });

    requestAnimationFrame(updateButtons);
    setTimeout(updateButtons, 100);
    setTimeout(updateButtons, 250);
  }

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const initPosition = () => {
      if (loop) {
        const singleSetWidth = viewport.scrollWidth / 3;
        viewport.scrollLeft = singleSetWidth;
      }
      updateButtons();
    };

    requestAnimationFrame(initPosition);
    setTimeout(initPosition, 100);

    viewport.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', updateButtons);

    return () => {
      viewport.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', updateButtons);
    };
  }, [loop, showArrows]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    setIsDragging(true);
    startX.current = e.clientX;
    scrollLeft.current = viewportRef.current?.scrollLeft || 0;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || !viewportRef.current) return;
    const walk = (e.clientX - startX.current) * 1.2;
    viewportRef.current.scrollLeft = scrollLeft.current - walk;
  };

  return (
    <div className={`${styles.wrapper} ${className ?? ''}`}>
      <div className={styles.viewportWrapper}>
        {showArrows && showLeft && (
          <button
            type="button"
            className={`${styles.arrow} ${styles.left}`}
            onClick={() => scroll(-scrollAmount)}
            aria-label="Scroll left"
          >
            <ChevronLeft size={20} />
          </button>
        )}

        <div
          ref={viewportRef}
          className={`${styles.viewport} ${isDragging ? styles.dragging : ''}`}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onPointerMove={handlePointerMove}
        >
          <div className={styles.track}>
            {loop ? (
              <>
                {React.Children.map(children, (child, i) =>
                  React.isValidElement(child) ? React.cloneElement(child, { key: `set1-${i}` } as any) : child,
                )}
                {React.Children.map(children, (child, i) =>
                  React.isValidElement(child) ? React.cloneElement(child, { key: `set2-${i}` } as any) : child,
                )}
                {React.Children.map(children, (child, i) =>
                  React.isValidElement(child) ? React.cloneElement(child, { key: `set3-${i}` } as any) : child,
                )}
              </>
            ) : (
              children
            )}
          </div>
        </div>

        {showArrows && showRight && (
          <button
            type="button"
            className={`${styles.arrow} ${styles.right}`}
            onClick={() => scroll(scrollAmount)}
            aria-label="Scroll right"
          >
            <ChevronRight size={20} />
          </button>
        )}
      </div>
    </div>
  );
});
