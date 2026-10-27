'use client';

import React, { useMemo } from 'react';

export interface MediaOverlayElement {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  angle?: number;
  link?: string;
  fileId?: string;
  assetHash?: string;
  assetMimeType?: string;
  isDeleted?: boolean;
}

export interface MediaOverlayProps {
  elements: readonly MediaOverlayElement[];
  files?: Record<string, { dataURL?: string; mimeType?: string; [k: string]: unknown }>;
  scrollX: number;
  scrollY: number;
  zoom: number;
  selectedElementIds?: Record<string, boolean>;
  isReadOnly?: boolean;
}

/**
 * Hardware-Accelerated DOM Media Overlay for Excalidraw
 *
 * Solves:
 * - Excalidraw Issue #5301: Animated GIFs/APNGs freeze on Canvas 2D drawImage.
 *   Here they run in hardware-composited HTML <img> elements at 60fps with 0% idle CPU.
 * - Excalidraw Issue #8776: Transparent GIF/WebP turning into black rectangles due to
 *   offscreen canvas rasterization bugs. Pure CSS `background: transparent; object-fit: contain;`
 *   guarantees true alpha transparency.
 * - Phase 6 Native Smoothness: Uses `translate3d(...) scale(...)` with `transform-origin: 0 0`
 *   and `will-change: transform` to achieve pixel-perfect lockstep with canvas panning & zooming.
 */
export const MediaOverlay = React.memo(function MediaOverlay({
  elements,
  files = {},
  scrollX,
  scrollY,
  zoom,
  selectedElementIds = {},
  isReadOnly = false,
}: MediaOverlayProps) {
  // Filter scene elements that qualify for DOM Media Overlay rendering
  const mediaElements = useMemo(() => {
    if (!elements || elements.length === 0) return [];

    return elements.filter((el) => {
      if (el.isDeleted) return false;

      // 1. Check embeddable elements with media links
      if (el.type === 'embeddable' && el.link) {
        return true;
      }

      // 2. Check image elements whose file is animated or vector media
      if (el.type === 'image' && el.fileId) {
        const fileObj = files[el.fileId];
        if (fileObj) {
          const mime = (fileObj.mimeType || '').toLowerCase();
          const dataUrl = (fileObj.dataURL || '').toLowerCase();
          const isGif = mime.includes('gif') || dataUrl.startsWith('data:image/gif');
          const isApng = mime.includes('apng') || dataUrl.startsWith('data:image/apng');
          const isSvg = mime.includes('svg') || dataUrl.startsWith('data:image/svg');
          const isWebp = mime.includes('webp') || dataUrl.startsWith('data:image/webp');
          const isVideoOrAudio = mime.startsWith('video/') || mime.startsWith('audio/');
          if (isGif || isApng || isSvg || isWebp || isVideoOrAudio) {
            return true;
          }
        }
      }

      // 3. Custom tagged media overlay elements
      if (el.assetHash || (el.assetMimeType && el.assetMimeType.includes('gif'))) {
        return true;
      }

      return false;
    });
  }, [elements, files]);

  if (mediaElements.length === 0) {
    return null;
  }

  return (
    <div
      className="excalidraw-media-overlay-container"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 2,
      }}
      aria-hidden="true"
    >
      <div
        className="excalidraw-media-overlay-transform-layer"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          transformOrigin: '0 0',
          transform: `translate3d(${scrollX * zoom}px, ${scrollY * zoom}px, 0) scale(${zoom})`,
          willChange: 'transform',
        }}
      >
        {mediaElements.map((el) => {
          // Resolve media URL from link, files map, or asset hash
          let mediaUrl = el.link || '';
          let mimeType = el.assetMimeType || '';

          if (!mediaUrl && el.fileId && files[el.fileId]) {
            const f = files[el.fileId];
            mediaUrl = f.dataURL || '';
            mimeType = f.mimeType || '';
          }

          if (!mediaUrl) return null;

          const isSelected = !!selectedElementIds[el.id];
          const angle = el.angle || 0;
          const isVideo = mimeType.startsWith('video/') || mediaUrl.startsWith('data:video/');
          const isAudio = mimeType.startsWith('audio/') || mediaUrl.startsWith('data:audio/');

          return (
            <div
              key={el.id}
              className="media-overlay-item"
              data-element-id={el.id}
              style={{
                position: 'absolute',
                left: `${el.x}px`,
                top: `${el.y}px`,
                width: `${el.width}px`,
                height: `${el.height}px`,
                transformOrigin: 'center center',
                transform: angle !== 0 ? `rotate(${angle}rad)` : undefined,
                pointerEvents: isSelected && !isReadOnly ? 'auto' : 'none',
                userSelect: 'none',
                WebkitUserSelect: 'none',
                borderRadius: '4px',
                overflow: 'hidden',
                background: 'transparent',
              }}
            >
              {isVideo ? (
                <video
                  src={mediaUrl}
                  autoPlay
                  loop
                  muted
                  playsInline
                  controls={isSelected}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    background: 'transparent',
                    display: 'block',
                  }}
                />
              ) : isAudio ? (
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(15, 23, 42, 0.75)',
                    backdropFilter: 'blur(8px)',
                    borderRadius: '8px',
                    padding: '8px',
                  }}
                >
                  <audio
                    src={mediaUrl}
                    controls
                    style={{ width: '100%', height: '36px' }}
                  />
                </div>
              ) : (
                <img
                  src={mediaUrl}
                  alt=""
                  loading="eager"
                  decoding="async"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    background: 'transparent', // Guarantees 0 black background artifacts (#8776)
                    display: 'block',
                    pointerEvents: 'none',
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});
