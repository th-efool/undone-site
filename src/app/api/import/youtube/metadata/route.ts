import { NextRequest } from 'next/server';
import { extractPlaylistId, extractVideoId } from '@/src/server/imports/youtube/youtube-url';

const YT_BASE = 'https://www.googleapis.com/youtube/v3';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');
  
  if (!url) {
    return Response.json({ error: 'Missing url' }, { status: 400 });
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return Response.json({ error: 'Missing API key' }, { status: 500 });
  }

  try {
    const isPlaylist = url.includes('list=PL') || url.includes('/playlist?list=') || url.includes('list=');
    
    if (isPlaylist) {
      const playlistId = extractPlaylistId(url);
      if (!playlistId) return Response.json({ error: 'Invalid playlist URL' }, { status: 400 });

      const res = await fetch(`${YT_BASE}/playlists?part=snippet&id=${playlistId}&key=${apiKey}`);
      const data = await res.json();
      
      const snippet = data.items?.[0]?.snippet;
      if (snippet) {
        return Response.json({
          title: snippet.title,
          thumbnailUrl: snippet.thumbnails?.maxres?.url ?? snippet.thumbnails?.high?.url ?? snippet.thumbnails?.medium?.url ?? snippet.thumbnails?.default?.url,
        });
      }
    } else {
      const videoId = extractVideoId(url);
      if (!videoId) return Response.json({ error: 'Invalid video URL' }, { status: 400 });

      const res = await fetch(`${YT_BASE}/videos?part=snippet&id=${videoId}&key=${apiKey}`);
      const data = await res.json();
      
      const snippet = data.items?.[0]?.snippet;
      if (snippet) {
        return Response.json({
          title: snippet.title,
          thumbnailUrl: snippet.thumbnails?.maxres?.url ?? snippet.thumbnails?.high?.url ?? snippet.thumbnails?.medium?.url ?? snippet.thumbnails?.default?.url,
        });
      }
    }

    return Response.json({ title: url, thumbnailUrl: undefined });
  } catch (err) {
    return Response.json({ error: 'Failed to fetch metadata' }, { status: 500 });
  }
}
