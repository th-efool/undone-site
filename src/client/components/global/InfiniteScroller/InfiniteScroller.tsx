'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import React, {
  PropsWithChildren,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';

import styles from './InfiniteScroller.module.css';

export interface InfiniteScrollerProps extends PropsWithChildren {
  className?: string;
  scrollAmount?: number;
  loop?: boolean;
  panable?: boolean;
  showArrows?: boolean;
}

export interface InfiniteScrollerHandle {
  scrollLeft: () => void;
  scrollRight: () => void;
  getViewport: () => HTMLDivElement | null;
}

export const InfiniteScroller = React.forwardRef<
  InfiniteScrollerHandle,
  InfiniteScrollerProps
>(function InfiniteScroller(
  {
    children,
    className,
    scrollAmount = 320,
    loop = false,
    panable = true,
    showArrows = true,
  }: InfiniteScrollerProps,
  ref,
) {
  const viewportRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    scrollLeft: () => scroll(-scrollAmount),
    scrollRight: () => scroll(scrollAmount),
    getViewport: () => viewportRef.current,
  }));

  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const startX = useRef(0);
  const scrollLeftRef = useRef(0);
  const isLoopingRef = useRef(false);
  const velocityWalkFactor = 1.2;

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
      requestAnimationFrame(() => {
        isLoopingRef.current = false;
      });
    } else if (viewport.scrollLeft <= 10) {
      isLoopingRef.current = true;
      viewport.scrollLeft = viewport.scrollLeft + singleSetWidth;
      requestAnimationFrame(() => {
        isLoopingRef.current = false;
      });
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
        const originalBehavior = viewport.style.scrollBehavior;
        viewport.style.scrollBehavior = 'auto';
        viewport.scrollLeft = singleSetWidth;
        requestAnimationFrame(() => {
          viewport.style.scrollBehavior = originalBehavior;
        });
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
    if (!panable) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    setIsDragging(true);
    startX.current = e.clientX;
    scrollLeftRef.current = viewportRef.current?.scrollLeft || 0;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!panable) return;
    setIsDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    handlePointerUp(e);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!panable || !isDragging || !viewportRef.current) return;
    const walk = (e.clientX - startX.current) * velocityWalkFactor;
    viewportRef.current.scrollLeft = scrollLeftRef.current - walk;
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
          onDragStart={(e) => e.preventDefault()}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          onPointerMove={handlePointerMove}
        >
          <div className={styles.track}>
            {loop ? (
              <>
                {React.Children.map(children, (child, i) =>
                  React.isValidElement(child)
                    ? React.cloneElement(child, { key: `set1-${child.key || i}` } as any)
                    : child,
                )}
                {React.Children.map(children, (child, i) =>
                  React.isValidElement(child)
                    ? React.cloneElement(child, { key: `set2-${child.key || i}` } as any)
                    : child,
                )}
                {React.Children.map(children, (child, i) =>
                  React.isValidElement(child)
                    ? React.cloneElement(child, { key: `set3-${child.key || i}` } as any)
                    : child,
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
