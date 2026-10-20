import { NextRequest } from 'next/server';
import { extractPlaylistId, extractVideoId } from '@/src/server/imports/youtube/youtube-url';
import { devLogger } from '@/src/shared/lib/dev-logger';

const YT_BASE = 'https://www.googleapis.com/youtube/v3';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface CachedMetadata {
  payload: any;
  cachedAt: number;
}

const youtubeMetadataCache = new Map<string, CachedMetadata>();
export const YOUTUBE_METADATA_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
export const MAX_CACHE_ENTRIES = 2000;

export const CACHE_HEADERS = {
  'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
};

export function clearYouTubeMetadataCacheForTests(): void {
  youtubeMetadataCache.clear();
}

export function getYouTubeMetadataCacheSize(): number {
  return youtubeMetadataCache.size;
}

export function setYouTubeMetadataCacheEntryForTests(key: string, payload: any, cachedAt = Date.now()): void {
  youtubeMetadataCache.set(key, { payload, cachedAt });
}

export function pruneYouTubeMetadataCache(now = Date.now()): void {
  for (const [key, entry] of youtubeMetadataCache.entries()) {
    if (now - entry.cachedAt >= YOUTUBE_METADATA_TTL_MS) {
      youtubeMetadataCache.delete(key);
    }
  }

  while (youtubeMetadataCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = youtubeMetadataCache.keys().next().value;
    if (oldestKey !== undefined) {
      youtubeMetadataCache.delete(oldestKey);
    } else {
      break;
    }
  }
}

function setInCache(key: string, payload: any, now = Date.now()): void {
  if (youtubeMetadataCache.has(key)) {
    youtubeMetadataCache.delete(key);
  } else if (youtubeMetadataCache.size >= MAX_CACHE_ENTRIES) {
    pruneYouTubeMetadataCache(now);
  }
  youtubeMetadataCache.set(key, { payload, cachedAt: now });
}

export async function GET(request: NextRequest) {
  const logger = devLogger.scoped('YouTubeMetadataRoute');
  const rawUrl = request.nextUrl.searchParams.get('url');

  if (!rawUrl || !rawUrl.trim()) {
    logger.warn('Missing url parameter in request');
    return Response.json({ error: 'Missing url' }, { status: 400 });
  }

  const url = rawUrl.trim();
  logger.info(`Fetching metadata for URL: "${url}"`);

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    logger.error('Missing YOUTUBE_API_KEY environment variable');
    devLogger.recordIssue({
      severity: 'ERROR',
      component: 'YouTubeMetadataRoute',
      title: 'Missing YOUTUBE_API_KEY',
      details: 'Cannot resolve YouTube metadata without API key',
    });
    return Response.json({ error: 'Missing API key' }, { status: 500 });
  }

  try {
    const isPlaylist = url.includes('list=PL') || url.includes('/playlist?list=') || url.includes('list=');

    if (isPlaylist) {
      let playlistId: string | null = null;
      try {
        playlistId = extractPlaylistId(url);
      } catch {
        return Response.json({ error: 'Invalid playlist URL' }, { status: 400 });
      }
      if (!playlistId) return Response.json({ error: 'Invalid playlist URL' }, { status: 400 });

      const cacheKey = `playlist:${playlistId}`;
      const cached = youtubeMetadataCache.get(cacheKey);
      if (cached) {
        if (Date.now() - cached.cachedAt < YOUTUBE_METADATA_TTL_MS) {
          logger.info(`Cache hit for playlist "${playlistId}"`);
          return Response.json(cached.payload, { headers: CACHE_HEADERS });
        }
        youtubeMetadataCache.delete(cacheKey);
      }

      const res = await fetch(`${YT_BASE}/playlists?part=snippet&id=${playlistId}&key=${apiKey}`);
      if (res.ok) {
        const data = await res.json().catch(() => null);
        const snippet = data?.items?.[0]?.snippet;
        if (snippet) {
          let videos: Array<{ videoId: string; title: string }> = [];
          try {
            const itemsRes = await fetch(`${YT_BASE}/playlistItems?part=snippet&maxResults=10&playlistId=${playlistId}&key=${apiKey}`);
            if (itemsRes.ok) {
              const itemsData = await itemsRes.json().catch(() => null);
              videos = (itemsData?.items ?? [])
                .map((it: any) => ({
                  videoId: it?.snippet?.resourceId?.videoId,
                  title: it?.snippet?.title || 'YouTube Video',
                }))
                .filter((v: any) => v.videoId && !v.title.includes('Private video') && !v.title.includes('Deleted video'));
            }
          } catch {
            // Proceed without items list
          }
          const payload = {
            title: snippet.title ?? url,
            thumbnailUrl: snippet.thumbnails?.maxres?.url ?? snippet.thumbnails?.high?.url ?? snippet.thumbnails?.medium?.url ?? snippet.thumbnails?.default?.url,
            isPlaylist: true,
            playlistId,
            videos,
          };
          setInCache(cacheKey, payload);
          return Response.json(payload, { headers: CACHE_HEADERS });
        }
      }
    } else {
      const videoId = extractVideoId(url);
      if (!videoId) return Response.json({ error: 'Invalid video URL' }, { status: 400 });

      const cacheKey = `video:${videoId}`;
      const cached = youtubeMetadataCache.get(cacheKey);
      if (cached) {
        if (Date.now() - cached.cachedAt < YOUTUBE_METADATA_TTL_MS) {
          logger.info(`Cache hit for video "${videoId}"`);
          return Response.json(cached.payload, { headers: CACHE_HEADERS });
        }
        youtubeMetadataCache.delete(cacheKey);
      }

      const res = await fetch(`${YT_BASE}/videos?part=snippet&id=${videoId}&key=${apiKey}`);
      if (res.ok) {
        const data = await res.json().catch(() => null);
        const snippet = data?.items?.[0]?.snippet;
        if (snippet) {
          const payload = {
            title: snippet.title ?? url,
            thumbnailUrl: snippet.thumbnails?.maxres?.url ?? snippet.thumbnails?.high?.url ?? snippet.thumbnails?.medium?.url ?? snippet.thumbnails?.default?.url,
          };
          setInCache(cacheKey, payload);
          return Response.json(payload, { headers: CACHE_HEADERS });
        }
      }
    }

    return Response.json({ title: url, thumbnailUrl: undefined });
  } catch {
    return Response.json({ error: 'Failed to fetch metadata' }, { status: 500 });
  }
}
