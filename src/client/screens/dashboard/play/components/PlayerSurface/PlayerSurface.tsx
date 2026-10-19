'use client';

import { JSX, PropsWithChildren, Ref, useEffect, useRef } from 'react';
import type { FeedItem } from '@/src/shared/feed/feedEngine.types';
import { AlertCircle, RefreshCw } from 'lucide-react';
import Hls from 'hls.js';
import { resolveMediaSource } from '../../utils/mediaSource';
import styles from './PlayerSurface.module.css';

export interface PlayerSurfaceProps extends PropsWithChildren {
  containerRef?: Ref<HTMLDivElement>;
  activeItem?: FeedItem | null;
  ytApiError?: string | null;
  mediaError?: string | null;
  onTimeUpdate?: (seconds: number) => void;
  onCompleteChunk?: () => void;
  onVideoMount?: (el: HTMLVideoElement | null) => void;
  onRetry?: () => void;
}

export function PlayerSurface({
  children,
  containerRef,
  activeItem,
  ytApiError,
  mediaError,
  onTimeUpdate,
  onCompleteChunk,
  onVideoMount,
  onRetry,
}: PlayerSurfaceProps): JSX.Element {
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const mediaSource = resolveMediaSource(activeItem);

  // Setup HLS when required on browsers without native HLS support
  useEffect(() => {
    if (!mediaSource.isDirectVideo || !mediaSource.isHls || !mediaSource.videoUrl) return;
    const video = videoElementRef.current;
    if (!video) return;

    // Native HLS (Safari, iOS WebKit)
    if (typeof video.canPlayType === 'function' && video.canPlayType('application/vnd.apple.mpegurl')) {
      return;
    }

    if (typeof window !== 'undefined' && Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true });
      hls.loadSource(mediaSource.videoUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              hls.destroy();
              break;
          }
        }
      });
      return () => {
        hls.destroy();
      };
    }
  }, [mediaSource.isDirectVideo, mediaSource.isHls, mediaSource.videoUrl]);

  // Handle HTML5 video mount ref callback
  const handleVideoRef = (node: HTMLVideoElement | null) => {
    videoElementRef.current = node;
    onVideoMount?.(node);
  };

  // 1. Direct HTML5 / HLS Video Branch
  if (mediaSource.isDirectVideo && mediaSource.videoUrl) {
    if (mediaError) {
      return (
        <div className={styles.surface}>
          <div className={styles.blockedNotice} role="alert">
            <AlertCircle size={36} className={styles.blockedIcon} />
            <h3 className={styles.blockedTitle}>Playback Error</h3>
            <p className={styles.blockedDesc}>{mediaError}</p>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 16px',
                  borderRadius: 9999,
                  background: '#6366f1',
                  color: '#fff',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 600,
                  marginTop: 12,
                }}
              >
                <RefreshCw size={16} />
                Retry playback
              </button>
            )}
          </div>
          <div className={styles.contentWrapper}>{children}</div>
        </div>
      );
    }

    return (
      <div className={styles.surface}>
        <video
          ref={handleVideoRef}
          src={mediaSource.videoUrl}
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
  if (mediaSource.isYouTube && ytApiError) {
    return (
      <div className={styles.surface}>
        <div className={styles.blockedNotice} role="alert">
          <AlertCircle size={36} className={styles.blockedIcon} />
          <h3 className={styles.blockedTitle}>Video Player Blocked</h3>
          <p className={styles.blockedDesc}>
            {ytApiError ||
              'The YouTube player could not load. An adblocker or privacy extension may be blocking youtube.com.'}
          </p>
          {mediaSource.videoId && (
            <a
              href={`https://www.youtube.com/watch?v=${mediaSource.videoId}`}
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

  // 3. Default YouTube IFrame Surface Container (or backwards compatibility fallback)
  return (
    <div className={styles.surface}>
      <div className={styles.videoWrapper} ref={containerRef} />
      <div className={styles.surfaceOverlay} />
      <div className={styles.contentWrapper}>{children}</div>
    </div>
  );
}
