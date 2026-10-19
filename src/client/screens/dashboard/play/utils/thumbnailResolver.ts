import type { FeedItem } from '@/src/shared/feed/feedEngine.types';

// Curated high-resolution fallback posters matching the cinematic aesthetic from the reference design
// (mountain landscapes, aerial views, sunset city skylines, architecture)
export const CURATED_POSTERS: string[] = [
  'https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=1200&auto=format&fit=crop', // Yosemite misty lake
  'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=1200&auto=format&fit=crop', // Blue alpine peaks
  'https://images.unsplash.com/photo-1519681393784-d120267933ba?q=80&w=1200&auto=format&fit=crop', // Starry snowy mountain
  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=1200&auto=format&fit=crop', // Golden coast skyline
  'https://images.unsplash.com/photo-1477959858617-67f30bc75b82?q=80&w=1200&auto=format&fit=crop', // Twilight city lights
  'https://images.unsplash.com/photo-1518791841217-8f162f1e1131?q=80&w=1200&auto=format&fit=crop', // Architectural warm dusk
];

/**
 * Resolves a unique, visually engaging thumbnail URL for a feed chunk item.
 *
 * Prevents adjacent cards from sharing the exact same graphic:
 * 1. Honors explicit chunk thumbnail if unique.
 * 2. If YouTube video with multiple chunks, derives distinct frame captures (1.jpg, 2.jpg, 3.jpg)
 *    based on chunk order/index so chunks of the same video have distinct visual previews.
 * 3. If the resulting thumbnail duplicates `avoidUrl` (e.g. the active playing chunk),
 *    falls back to a distinct curated landscape poster deterministically chosen by chunk index.
 */
export function resolveItemThumbnail(
  item: FeedItem | null | undefined,
  index = 0,
  avoidUrl?: string | null
): string {
  if (!item) {
    const fallbackIdx = Math.abs(index) % CURATED_POSTERS.length;
    return CURATED_POSTERS[fallbackIdx];
  }

  // Check explicit chunk-level thumbnail
  const explicitThumb = (item as any)?.chunkThumbnail || (item as any)?.thumbnail;
  let candidate = explicitThumb || item.lessonThumbnail;

  const videoId = item.lessonVideoId;
  const chunkOrder = item.chunkOrder ?? (index + 1);
  const totalChunks = item.totalChunksInLesson ?? 1;

  // For YouTube items that belong to a multi-chunk lesson
  if (videoId && totalChunks > 1) {
    // If chunkOrder is 1, use hqdefault or frame 1.
    // For subsequent chunks, use YouTube's auto-generated timestamp frames 1.jpg, 2.jpg, 3.jpg
    const frameIndex = ((Math.max(1, chunkOrder) - 1) % 3) + 1;
    candidate = `https://img.youtube.com/vi/${videoId}/${frameIndex}.jpg`;
  }

  // If candidate is empty or duplicates the active video thumbnail, pick a distinct curated visual
  if (!candidate || (avoidUrl && candidate === avoidUrl)) {
    const seed = Math.abs(index + (chunkOrder || 0));
    const fallbackIdx = seed % CURATED_POSTERS.length;
    return CURATED_POSTERS[fallbackIdx];
  }

  return candidate;
}
