'use client';

import { JSX, PropsWithChildren, RefObject, useRef } from 'react';
import type { FeedItem } from '@/src/shared/feed/feedEngine.types';
import { AlertCircle } from 'lucide-react';
import styles from './PlayerSurface.module.css';

export interface PlayerSurfaceProps extends PropsWithChildren {
  containerRef?: RefObject<HTMLDivElement | null>;
  activeItem?: FeedItem | null;
  ytApiError?: string | null;
  onTimeUpdate?: (seconds: number) => void;
  onCompleteChunk?: () => void;
}

export function PlayerSurface({
  children,
  containerRef,
  activeItem,
  ytApiError,
  onTimeUpdate,
  onCompleteChunk,
}: PlayerSurfaceProps): JSX.Element {
  const videoElementRef = useRef<HTMLVideoElement | null>(null);

  const isYouTube = Boolean(
    activeItem?.lessonVideoId && /^[A-Za-z0-9_-]{11}$/.test(activeItem.lessonVideoId),
  );

  const rawUrl =
    activeItem?.sourceUrl ||
    activeItem?.lessonVideoUrl ||
    (activeItem?.lessonVideoId && !isYouTube ? activeItem.lessonVideoId : undefined);

  const isDirectVideo = Boolean(
    rawUrl &&
      (rawUrl.endsWith('.mp4') ||
        rawUrl.includes('.m3u8') ||
        rawUrl.endsWith('.webm') ||
        rawUrl.includes('.mp4?')),
  );

  // 1. Direct HTML5 / HLS Video Branch
  if (!isYouTube && isDirectVideo && rawUrl) {
    return (
      <div className={styles.surface}>
        <video
          ref={videoElementRef}
          src={rawUrl}
          controls
          playsInline
          className={styles.nativeVideo}
          onTimeUpdate={(e) => onTimeUpdate?.(e.currentTarget.currentTime)}
          onEnded={() => onCompleteChunk?.()}
        />
        <div className={styles.contentWrapper}>{children}</div>
      </div>
    );
  }

  // 2. YouTube IFrame API Script Load Failure Notice
  if (isYouTube && ytApiError) {
    return (
      <div className={styles.surface}>
        <div className={styles.blockedNotice}>
          <AlertCircle size={36} className={styles.blockedIcon} />
          <h3 className={styles.blockedTitle}>Video Player Blocked</h3>
          <p className={styles.blockedDesc}>
            {ytApiError ||
              'The YouTube player could not load. An adblocker or privacy extension may be blocking youtube.com.'}
          </p>
          {activeItem?.lessonVideoId && (
            <a
              href={`https://www.youtube.com/watch?v=${activeItem.lessonVideoId}`}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.externalLink}
            >
              Watch on YouTube &rarr;
            </a>
          )}
        </div>
        <div className={styles.contentWrapper}>{children}</div>
      </div>
    );
  }

  // 3. Default YouTube IFrame Surface Container
  return (
    <div className={styles.surface}>
      <div className={styles.videoWrapper} ref={containerRef} />
      <div className={styles.surfaceOverlay} />
      <div className={styles.contentWrapper}>{children}</div>
    </div>
  );
}
