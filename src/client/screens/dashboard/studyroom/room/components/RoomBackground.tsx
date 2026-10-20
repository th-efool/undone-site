'use client';

import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import type { BackgroundId } from '../../types';
import { getBackground } from '../../data/backgroundCatalog';
import styles from './RoomBackground.module.css';

export interface RoomBackgroundProps {
  backgroundId: BackgroundId;
  onImageError?: (id: BackgroundId) => void;
}

export function RoomBackground({ backgroundId, onImageError }: RoomBackgroundProps) {
  const [previousId, setPreviousId] = useState<BackgroundId | null>(null);
  const [failedIds, setFailedIds] = useState<Set<BackgroundId>>(() => new Set());
  // Stored in state to avoid reading mutable ref during render
  const [initialId] = useState<BackgroundId>(() => backgroundId);
  const currentIdRef = useRef<BackgroundId>(backgroundId);
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (backgroundId === currentIdRef.current) return;

    const oldId = currentIdRef.current;
    currentIdRef.current = backgroundId;
    setPreviousId(oldId);

    if (transitionTimerRef.current) {
      clearTimeout(transitionTimerRef.current);
    }

    transitionTimerRef.current = setTimeout(() => {
      setPreviousId(null);
      transitionTimerRef.current = null;
    }, 500);

    return () => {
      if (transitionTimerRef.current) {
        clearTimeout(transitionTimerRef.current);
      }
    };
  }, [backgroundId]);

  const handleImageError = (id: BackgroundId) => {
    setFailedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    onImageError?.(id);
  };

  const renderLayer = (id: BackgroundId, isFadingOut: boolean) => {
    const bg = getBackground(id);
    const hasImage = Boolean(bg.image);
    const isFailed = failedIds.has(id);
    const isInitial = id === initialId;

    return (
      <div
        key={id}
        className={`${styles.layer} ${isFadingOut ? styles.layerFadingOut : styles.layerActive}`}
      >
        <div
          className={styles.gradientBase}
          style={{ background: bg.gradient }}
        />
        {hasImage && (
          <div className={`${styles.image} ${isFailed ? styles.imageHidden : ''}`}>
            <Image
              src={bg.image!}
              alt=""
              fill
              priority={isInitial}
              sizes="100vw"
              style={{
                objectFit: 'cover',
                objectPosition: bg.focal || 'center',
              }}
              onError={() => handleImageError(id)}
            />
          </div>
        )}
      </div>
    );
  };

  const currentBg = getBackground(backgroundId);

  return (
    <div className={styles.backgroundContainer} aria-hidden="true">
      {previousId && renderLayer(previousId, true)}
      {renderLayer(backgroundId, false)}

      <div className={styles.baseScrim} />
      {currentBg.extraScrim > 0 && (
        <div
          className={styles.extraScrim}
          style={{ backgroundColor: `rgba(0, 0, 0, ${currentBg.extraScrim})` }}
        />
      )}
    </div>
  );
}

export default React.memo(RoomBackground);
