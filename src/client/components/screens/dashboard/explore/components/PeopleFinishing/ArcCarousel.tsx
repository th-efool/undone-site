'use client';

import React, { useEffect, useRef } from 'react';
import {
  InfiniteScroller,
  type InfiniteScrollerHandle,
  type InfiniteScrollerProps,
} from '@/src/client/components/global/InfiniteScroller';

import styles from './ArcCarousel.module.css';

// ─── Arc tuning constants ────────────────────────────────────────────────────
const ARC_DEPTH = 300; // px — max vertical height for center cards
const ARC_TILT = 10; // deg — rotation at ±1 normalised position
const SCALE_REDUCE = 0.12; // fraction — center card is larger than edge
// Extra padding ABOVE cards so they have room to arc upwards without clipping
const VIEWPORT_EXTRA_HEIGHT = ARC_DEPTH + 24;

// ─── Helpers ────────────────────────────────────────────────────────────────
function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

// ────────────────────────────────────────────────────────────────────────────

export type ArcCarouselProps = InfiniteScrollerProps;

/**
 * ArcCarousel — wraps InfiniteScroller with a live parabolic arc effect.
 *
 * It arches UPWARDS: center cards translate up by ARC_DEPTH, edge cards are at 0.
 * This naturally creates a hollow space underneath the center cards for content
 * to nestle into, without requiring hardcoded negative margins.
 *
 * To avoid scroll jitter, it uses card.offsetLeft (un-transformed) instead of
 * getBoundingClientRect() to determine position relative to the scroll container.
 */
export const ArcCarousel = React.forwardRef<
  InfiniteScrollerHandle,
  ArcCarouselProps
>(function ArcCarousel(props, ref) {
  const innerRef = useRef<InfiniteScrollerHandle>(null);
  const rafId = useRef<number>(0);

  React.useImperativeHandle(ref, () => ({
    scrollLeft: () => innerRef.current?.scrollLeft(),
    scrollRight: () => innerRef.current?.scrollRight(),
    getViewport: () => innerRef.current?.getViewport() ?? null,
  }));

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mq.matches) return;

    const viewport = innerRef.current?.getViewport();
    if (!viewport) return;

    viewport.style.overflowY = 'hidden';
    viewport.style.overscrollBehaviorY = 'auto';
    viewport.style.touchAction = 'pan-x pan-y';
    viewport.style.paddingTop = `${VIEWPORT_EXTRA_HEIGHT}px`;
    viewport.style.paddingBottom = '24px';
    viewport.style.paddingLeft = '48px';
    viewport.style.paddingRight = '48px';
    viewport.scrollTop = 0;
    // ─────────────────────────────────────────────────────────────────────────

    function applyArc() {
      if (!viewport) return;

      const viewportWidth = viewport.clientWidth;
      const viewportScrollLeft = viewport.scrollLeft;
      const viewportCenterOffset = viewportWidth / 2;

      const isMobile = viewportWidth < 768;
      const currentDepth = isMobile ? Math.max(100, viewportWidth * 0.25) : ARC_DEPTH;
      const currentTilt = isMobile ? 5 : ARC_TILT;

      const track = viewport.firstElementChild as HTMLElement | null;
      if (!track) return;
      
      // Pull the next section in the page UP into the hollow space
      // created by pushing the center cards UP. This perfectly matches the arc!
      viewport.style.marginBottom = `-${currentDepth}px`;
      
      // Ensure track acts as offsetParent for accurate card.offsetLeft readings
      track.style.position = 'relative';
      track.style.alignItems = 'flex-start';

      const cards = track.children;
      for (let i = 0; i < cards.length; i++) {
        const card = cards[i] as HTMLElement;
        
        // Use offsetLeft to get raw position IGNORING CSS transforms.
        // This eliminates the jitter/feedback loop completely.
        const cardCenterRelative = card.offsetLeft + card.offsetWidth / 2;
        
        // Distance from this card's center to the current visual center of the viewport
        const distanceToCenter = cardCenterRelative - (viewportScrollLeft + viewportCenterOffset);

        // Normalize distance: 0 = center, ±1 = edge of viewport
        const norm = clamp(distanceToCenter / viewportCenterOffset, -1.5, 1.5);

        // The arch goes UP. Center is at -currentDepth (highest), edges at 0.
        // Formula: -depth * (1 - norm^2)
        const ty = -currentDepth * (1 - norm * norm);
        const rz = currentTilt * norm;
        const sc = (1 - SCALE_REDUCE * Math.abs(norm)) * 1.25;

        card.style.transform = `translateY(${ty}px) rotate(${rz}deg) scale(${sc})`;
        card.style.willChange = 'transform';
        card.style.transformOrigin = 'center center';
        // Completely override the card's CSS transition to disable the 180ms transform lag,
        // which was causing the cards to "dip" behind the Javascript curve math.
        card.style.transition = 'box-shadow 180ms ease';
      }
    }

    let lastScrollLeft = -1;
    let lastWidth = -1;

    function renderLoop() {
      if (!viewport) return;
      
      const currentScroll = viewport.scrollLeft;
      const currentWidth = viewport.clientWidth;

      if (currentScroll !== lastScrollLeft || currentWidth !== lastWidth) {
        applyArc();
        lastScrollLeft = currentScroll;
        lastWidth = currentWidth;
        
        window.dispatchEvent(
          new CustomEvent('arc-scroll', { detail: { scrollLeft: currentScroll } })
        );
      }
      
      rafId.current = requestAnimationFrame(renderLoop);
    }

    // Start the continuous loop to guarantee 0-frame lag during native scroll/momentum
    rafId.current = requestAnimationFrame(renderLoop);

    // Re-run after fonts / images settle (handled by width check in loop, but we can trigger a forced update just in case)
    const t = setTimeout(() => {
      lastWidth = -1; // Force update
    }, 300);

    return () => {
      cancelAnimationFrame(rafId.current);
      clearTimeout(t);
      // Restore overridden styles on unmount
      viewport.style.overflowY = '';
      viewport.style.paddingTop = '';
      viewport.style.paddingBottom = '';
      viewport.style.paddingLeft = '';
      viewport.style.paddingRight = '';
      viewport.style.marginBottom = '';
      if (viewport.firstElementChild) {
        (viewport.firstElementChild as HTMLElement).style.position = '';
      }
    };
  }, []);

  return (
    <div className={styles.arcWrapper}>
      <InfiniteScroller ref={innerRef} {...props} />
    </div>
  );
});
