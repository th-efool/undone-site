'use client';

import { useEffect, useRef, useState, VideoHTMLAttributes } from 'react';

interface ProtectedVideoProps extends VideoHTMLAttributes<HTMLVideoElement> {
  src: string;
  playbackRate?: number;
}

export function ProtectedVideo({
  src,
  playbackRate,
  className,
  style,
  autoPlay = true,
  muted = true,
  loop = true,
  playsInline = true,
  preload = 'auto',
  poster,
  ...props
}: ProtectedVideoProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let isSubscribed = true;
    let createdUrl: string | null = null;

    fetch(src)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to fetch video: ${res.statusText}`);
        return res.blob();
      })
      .then((blob) => {
        if (isSubscribed) {
          createdUrl = URL.createObjectURL(blob);
          setBlobUrl(createdUrl);
        }
      })
      .catch((err) => {
        console.error('Error creating protected video blob:', err);
      });

    return () => {
      isSubscribed = false;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [src]);

  useEffect(() => {
    if (videoRef.current && playbackRate !== undefined) {
      videoRef.current.playbackRate = playbackRate;
    }
  }, [blobUrl, playbackRate]);

  return (
    <video
      ref={videoRef}
      className={className}
      src={blobUrl || undefined}
      poster={poster}
      autoPlay={autoPlay}
      muted={muted}
      loop={loop}
      playsInline={playsInline}
      preload={preload}
      onContextMenu={(e) => e.preventDefault()}
      style={{ pointerEvents: 'none', ...style }}
      {...props}
    />
  );
}

export default ProtectedVideo;
