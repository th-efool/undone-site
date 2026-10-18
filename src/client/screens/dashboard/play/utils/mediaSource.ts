import type { FeedItem } from '@/src/shared/feed/feedEngine.types';

export type MediaKind = 'youtube' | 'direct_video' | 'reading' | 'unsupported';

export interface NormalizedMediaSource {
  kind: MediaKind;
  isYouTube: boolean;
  isDirectVideo: boolean;
  isReading: boolean;
  isHls: boolean;
  videoId?: string;
  videoUrl?: string;
}

/**
 * Extracts an 11-character YouTube video ID from a URL or raw ID string.
 */
export function extractYouTubeId(urlOrId?: string | null): string | null {
  if (!urlOrId || typeof urlOrId !== 'string') return null;
  const trimmed = urlOrId.trim();

  // Pure 11-char ID
  if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  // URL parsing
  try {
    const url = new URL(trimmed);
    const v = url.searchParams.get('v');
    if (v && /^[A-Za-z0-9_-]{11}$/.test(v)) return v;

    if (url.hostname.includes('youtu.be')) {
      const id = url.pathname.slice(1).split('?')[0];
      if (/^[A-Za-z0-9_-]{11}$/.test(id)) return id;
    }

    if (url.pathname.includes('/embed/')) {
      const id = url.pathname.split('/embed/')[1]?.split('?')[0];
      if (id && /^[A-Za-z0-9_-]{11}$/.test(id)) return id;
    }

    if (url.pathname.includes('/shorts/')) {
      const id = url.pathname.split('/shorts/')[1]?.split('?')[0];
      if (id && /^[A-Za-z0-9_-]{11}$/.test(id)) return id;
    }
  } catch {
    const match = trimmed.match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([a-zA-Z0-9_-]{11})/);
    if (match) return match[1];
  }

  return null;
}

/**
 * Checks if a string looks like a direct MP4, WebM, or HLS (m3u8) video URL.
 */
export function isDirectVideoUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const clean = url.trim().toLowerCase();
  return (
    clean.endsWith('.mp4') ||
    clean.includes('.mp4?') ||
    clean.endsWith('.webm') ||
    clean.includes('.webm?') ||
    clean.includes('.m3u8')
  );
}

/**
 * Single authoritative normalizer for media-source detection across the playback pipeline.
 */
export function resolveMediaSource(item?: FeedItem | null): NormalizedMediaSource {
  if (!item) {
    return {
      kind: 'unsupported',
      isYouTube: false,
      isDirectVideo: false,
      isReading: false,
      isHls: false,
    };
  }

  // 1. Explicit reading or text-only content without video identifiers
  const hasNoVideoCandidates = !item.lessonVideoId && !item.lessonVideoUrl && !item.sourceUrl;
  if (item.lessonType === 'reading' || (Boolean(item.content?.text) && hasNoVideoCandidates)) {
    return {
      kind: 'reading',
      isYouTube: false,
      isDirectVideo: false,
      isReading: true,
      isHls: false,
    };
  }

  // 2. YouTube detection across all candidate fields
  const ytId =
    extractYouTubeId(item.lessonVideoId) ||
    extractYouTubeId(item.lessonVideoUrl) ||
    extractYouTubeId(item.sourceUrl);

  if (ytId) {
    return {
      kind: 'youtube',
      isYouTube: true,
      isDirectVideo: false,
      isReading: false,
      isHls: false,
      videoId: ytId,
      videoUrl: item.lessonVideoUrl || `https://www.youtube.com/watch?v=${ytId}`,
    };
  }

  // 3. Direct HTML5 / HLS video detection
  const candidateUrl =
    (isDirectVideoUrl(item.sourceUrl) ? item.sourceUrl : null) ||
    (isDirectVideoUrl(item.lessonVideoUrl) ? item.lessonVideoUrl : null) ||
    (isDirectVideoUrl(item.lessonVideoId) ? item.lessonVideoId : null);

  if (candidateUrl) {
    const isHls = candidateUrl.includes('.m3u8');
    return {
      kind: 'direct_video',
      isYouTube: false,
      isDirectVideo: true,
      isReading: false,
      isHls,
      videoUrl: candidateUrl,
    };
  }

  // 4. Fallback: text content if present
  if (item.content?.text) {
    return {
      kind: 'reading',
      isYouTube: false,
      isDirectVideo: false,
      isReading: true,
      isHls: false,
    };
  }

  // 5. Unsupported media
  return {
    kind: 'unsupported',
    isYouTube: false,
    isDirectVideo: false,
    isReading: false,
    isHls: false,
  };
}
