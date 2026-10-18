import { NextRequest } from 'next/server';
import { extractPlaylistId, extractVideoId } from '@/src/server/imports/youtube/youtube-url';
import { devLogger } from '@/src/shared/lib/dev-logger';

const YT_BASE = 'https://www.googleapis.com/youtube/v3';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
          return Response.json({
            title: snippet.title ?? url,
            thumbnailUrl: snippet.thumbnails?.maxres?.url ?? snippet.thumbnails?.high?.url ?? snippet.thumbnails?.medium?.url ?? snippet.thumbnails?.default?.url,
            isPlaylist: true,
            playlistId,
            videos,
          });
        }
      }
    } else {
      const videoId = extractVideoId(url);
      if (!videoId) return Response.json({ error: 'Invalid video URL' }, { status: 400 });

      const res = await fetch(`${YT_BASE}/videos?part=snippet&id=${videoId}&key=${apiKey}`);
      if (res.ok) {
        const data = await res.json().catch(() => null);
        const snippet = data?.items?.[0]?.snippet;
        if (snippet) {
          return Response.json({
            title: snippet.title ?? url,
            thumbnailUrl: snippet.thumbnails?.maxres?.url ?? snippet.thumbnails?.high?.url ?? snippet.thumbnails?.medium?.url ?? snippet.thumbnails?.default?.url,
          });
        }
      }
    }

    return Response.json({ title: url, thumbnailUrl: undefined });
  } catch {
    return Response.json({ error: 'Failed to fetch metadata' }, { status: 500 });
  }
}
