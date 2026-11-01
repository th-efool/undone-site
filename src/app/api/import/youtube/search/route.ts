import { NextRequest, NextResponse } from 'next/server';

export interface YouTubeSearchItem {
  id: string;
  kind: 'video' | 'playlist';
  title: string;
  channelTitle: string;
  description: string;
  thumbnailUrl?: string;
  url: string;
}

export interface YouTubeSearchResponse {
  items: YouTubeSearchItem[];
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const CACHE = new Map<string, { expiresAt: number; payload: YouTubeSearchResponse }>();

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

export async function GET(req: NextRequest) {
  try {
    const q = (req.nextUrl.searchParams.get('q') ?? '').trim();
    if (!q) {
      return NextResponse.json(
        { error: 'Missing search query parameter "q"' },
        { status: 400 }
      );
    }

    const normalizedQuery = q.toLowerCase().slice(0, 200);
    const cached = CACHE.get(normalizedQuery);
    if (cached && cached.expiresAt > Date.now()) {
      return NextResponse.json(cached.payload);
    }

    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'YouTube search is not configured on the server (missing YOUTUBE_API_KEY).' },
        { status: 503 }
      );
    }

    const endpoint = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video,playlist&maxResults=12&q=${encodeURIComponent(
      q.slice(0, 200)
    )}&key=${apiKey}`;

    const res = await fetch(endpoint);
    if (!res.ok) {
      return NextResponse.json(
        { error: `YouTube API returned status ${res.status}` },
        { status: 502 }
      );
    }

    const data = await res.json();
    const rawItems: any[] = Array.isArray(data?.items) ? data.items : [];
    const items: YouTubeSearchItem[] = [];
    const seenUrls = new Set<string>();

    for (const raw of rawItems) {
      const idObj = raw?.id;
      const snippet = raw?.snippet;
      const isPlaylist =
        idObj?.kind === 'youtube#playlist' || Boolean(idObj?.playlistId);
      const rawId: string | undefined = isPlaylist
        ? idObj?.playlistId
        : idObj?.videoId;

      if (!rawId || typeof rawId !== 'string') continue;

      const url = isPlaylist
        ? `https://www.youtube.com/playlist?list=${rawId}`
        : `https://www.youtube.com/watch?v=${rawId}`;

      if (seenUrls.has(url)) continue;
      seenUrls.add(url);

      const title = decodeHtmlEntities(
        String(snippet?.title || (isPlaylist ? 'YouTube Playlist' : 'YouTube Video'))
      );
      const channelTitle = decodeHtmlEntities(
        String(snippet?.channelTitle || 'YouTube')
      );
      const description = decodeHtmlEntities(
        String(snippet?.description || '')
      );
      const thumbnailUrl: string | undefined =
        snippet?.thumbnails?.medium?.url ??
        snippet?.thumbnails?.default?.url ??
        undefined;

      items.push({
        id: rawId,
        kind: isPlaylist ? 'playlist' : 'video',
        title,
        channelTitle,
        description,
        thumbnailUrl,
        url,
      });
    }

    const payload: YouTubeSearchResponse = { items };
    CACHE.set(normalizedQuery, {
      expiresAt: Date.now() + CACHE_TTL_MS,
      payload,
    });

    return NextResponse.json(payload);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Failed to search YouTube resources' },
      { status: 500 }
    );
  }
}
