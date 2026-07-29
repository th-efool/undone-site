'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PropsWithChildren, useEffect, useRef, useState } from 'react';

import styles from './HorizontalScroller.module.css';

export interface HorizontalScrollerProps extends PropsWithChildren {
  className?: string;

  scrollAmount?: number;
}

export function HorizontalScroller({
  children,
  className,
  scrollAmount = 320,
}: HorizontalScrollerProps) {
  const viewportRef = useRef<HTMLDivElement>(null);

  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(false);

  function updateButtons() {
    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    setShowLeft(viewport.scrollLeft > 1);

    setShowRight(viewport.scrollLeft + viewport.clientWidth < viewport.scrollWidth - 1);
  }

  function scroll(offset: number) {
    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    viewport.scrollBy({
      left: offset,
      behavior: 'smooth',
    });

    requestAnimationFrame(updateButtons);

    setTimeout(updateButtons, 100);

    setTimeout(updateButtons, 250);
  }

  useEffect(() => {
    updateButtons();

    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    viewport.addEventListener('scroll', updateButtons);

    window.addEventListener('resize', updateButtons);

    return () => {
      viewport.removeEventListener('scroll', updateButtons);

      window.removeEventListener('resize', updateButtons);
    };
  }, []);

  return (
    <div className={`${styles.wrapper} ${className ?? ''}`}>
      <div className={styles.viewportWrapper}>
        {showLeft && (
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
          className={styles.viewport}
        >
          <div className={styles.track}>{children}</div>
        </div>

        {showRight && (
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
}
