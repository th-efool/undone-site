import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import {
  GET,
  CACHE_HEADERS,
  MAX_CACHE_ENTRIES,
  YOUTUBE_METADATA_TTL_MS,
  clearYouTubeMetadataCacheForTests,
  getYouTubeMetadataCacheSize,
  setYouTubeMetadataCacheEntryForTests,
  pruneYouTubeMetadataCache,
} from '../route';

describe('GET /api/import/youtube/metadata', () => {
  const originalEnv = process.env;
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    process.env = { ...originalEnv, YOUTUBE_API_KEY: 'test-youtube-api-key' };
    clearYouTubeMetadataCacheForTests();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.unstubAllGlobals();
    clearYouTubeMetadataCacheForTests();
  });

  describe('parameter and environment validation', () => {
    it('returns 400 when url parameter is missing', async () => {
      const request = new NextRequest('http://localhost/api/import/youtube/metadata');
      const response = await GET(request);

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json).toEqual({ error: 'Missing url' });
    });

    it('returns 400 when url parameter is empty or whitespace', async () => {
      const requestEmpty = new NextRequest('http://localhost/api/import/youtube/metadata?url=');
      const responseEmpty = await GET(requestEmpty);
      expect(responseEmpty.status).toBe(400);
      expect(await responseEmpty.json()).toEqual({ error: 'Missing url' });

      const requestWhitespace = new NextRequest('http://localhost/api/import/youtube/metadata?url=%20%20%20');
      const responseWhitespace = await GET(requestWhitespace);
      expect(responseWhitespace.status).toBe(400);
      expect(await responseWhitespace.json()).toEqual({ error: 'Missing url' });
    });

    it('returns 500 when YOUTUBE_API_KEY is missing', async () => {
      delete process.env.YOUTUBE_API_KEY;
      const request = new NextRequest(
        'http://localhost/api/import/youtube/metadata?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ'
      );
      const response = await GET(request);

      expect(response.status).toBe(500);
      const json = await response.json();
      expect(json).toEqual({ error: 'Missing API key' });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('returns 400 on invalid video URL', async () => {
      const request = new NextRequest('http://localhost/api/import/youtube/metadata?url=https://example.com/not-yt');
      const response = await GET(request);

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'Invalid video URL' });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('returns 400 on invalid playlist URL', async () => {
      const request = new NextRequest('http://localhost/api/import/youtube/metadata?url=https://www.youtube.com/playlist?list=');
      const response = await GET(request);

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'Invalid playlist URL' });
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('video metadata caching and headers', () => {
    const videoUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    const mockVideoSnippetResponse = {
      items: [
        {
          snippet: {
            title: 'Rick Astley - Never Gonna Give You Up',
            thumbnails: {
              high: { url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg' },
            },
          },
        },
      ],
    };

    it('calls Google API on cache miss, caches result, and subsequent call returns cached payload with 0 network calls', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockVideoSnippetResponse,
      });

      expect(getYouTubeMetadataCacheSize()).toBe(0);

      // Initial request - Cache miss
      const req1 = new NextRequest(`http://localhost/api/import/youtube/metadata?url=${encodeURIComponent(videoUrl)}`);
      const res1 = await GET(req1);

      expect(res1.status).toBe(200);
      expect(res1.headers.get('Cache-Control')).toBe('public, s-maxage=86400, stale-while-revalidate=604800');
      const body1 = await res1.json();
      expect(body1).toEqual({
        title: 'Rick Astley - Never Gonna Give You Up',
        thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
      });
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/videos?part=snippet&id=dQw4w9WgXcQ&key=test-youtube-api-key')
      );
      expect(getYouTubeMetadataCacheSize()).toBe(1);

      // Second request - Cache hit (0 additional network calls)
      const req2 = new NextRequest(`http://localhost/api/import/youtube/metadata?url=${encodeURIComponent(videoUrl)}`);
      const res2 = await GET(req2);

      expect(res2.status).toBe(200);
      expect(res2.headers.get('Cache-Control')).toBe('public, s-maxage=86400, stale-while-revalidate=604800');
      const body2 = await res2.json();
      expect(body2).toEqual(body1);
      expect(mockFetch).toHaveBeenCalledTimes(1); // Still 1! 0 additional network calls
      expect(getYouTubeMetadataCacheSize()).toBe(1);

      // Third request with alternative URL format (youtu.be) pointing to same video ID
      const shortUrl = 'https://youtu.be/dQw4w9WgXcQ';
      const req3 = new NextRequest(`http://localhost/api/import/youtube/metadata?url=${encodeURIComponent(shortUrl)}`);
      const res3 = await GET(req3);

      expect(res3.status).toBe(200);
      const body3 = await res3.json();
      expect(body3).toEqual(body1);
      expect(mockFetch).toHaveBeenCalledTimes(1); // Normalized video ID hits same cache entry!
    });
  });

  describe('playlist metadata caching and headers', () => {
    const playlistId = 'PLlaN88a7VSEnQz6v_bHw8c0sT_8oG43Wq';
    const playlistUrl = `https://www.youtube.com/playlist?list=${playlistId}`;

    const mockPlaylistResponse = {
      items: [
        {
          snippet: {
            title: 'TypeScript Full Course',
            thumbnails: {
              high: { url: 'https://i.ytimg.com/vi/playlist-high.jpg' },
            },
          },
        },
      ],
    };

    const mockPlaylistItemsResponse = {
      items: [
        {
          snippet: {
            title: 'Lesson 1: Introduction',
            resourceId: { videoId: 'vid-101' },
          },
        },
        {
          snippet: {
            title: 'Private video',
            resourceId: { videoId: 'vid-priv' },
          },
        },
        {
          snippet: {
            title: 'Deleted video',
            resourceId: { videoId: 'vid-del' },
          },
        },
        {
          snippet: {
            title: 'Lesson 2: Advanced Types',
            resourceId: { videoId: 'vid-102' },
          },
        },
      ],
    };

    it('caches playlist metadata and playlist items, returning cached payload on subsequent calls', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockPlaylistResponse,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockPlaylistItemsResponse,
        });

      // 1st request - Miss: fetches playlist and playlist items
      const req1 = new NextRequest(`http://localhost/api/import/youtube/metadata?url=${encodeURIComponent(playlistUrl)}`);
      const res1 = await GET(req1);

      expect(res1.status).toBe(200);
      expect(res1.headers.get('Cache-Control')).toBe('public, s-maxage=86400, stale-while-revalidate=604800');
      const body1 = await res1.json();
      expect(body1).toEqual({
        title: 'TypeScript Full Course',
        thumbnailUrl: 'https://i.ytimg.com/vi/playlist-high.jpg',
        isPlaylist: true,
        playlistId,
        videos: [
          { videoId: 'vid-101', title: 'Lesson 1: Introduction' },
          { videoId: 'vid-102', title: 'Lesson 2: Advanced Types' },
        ],
      });
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(getYouTubeMetadataCacheSize()).toBe(1);

      // 2nd request - Hit: returns cached payload without any network calls
      const req2 = new NextRequest(`http://localhost/api/import/youtube/metadata?url=${encodeURIComponent(playlistUrl)}`);
      const res2 = await GET(req2);

      expect(res2.status).toBe(200);
      expect(res2.headers.get('Cache-Control')).toBe('public, s-maxage=86400, stale-while-revalidate=604800');
      const body2 = await res2.json();
      expect(body2).toEqual(body1);
      expect(mockFetch).toHaveBeenCalledTimes(2); // Still 2 calls! 0 additional network calls
    });
  });

  describe('Cache-Control headers verification', () => {
    it('sets public, s-maxage=86400, stale-while-revalidate=604800 on all successful responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            {
              snippet: {
                title: 'Header Test Video',
                thumbnails: { default: { url: 'https://i.ytimg.com/default.jpg' } },
              },
            },
          ],
        }),
      });

      const req = new NextRequest('http://localhost/api/import/youtube/metadata?url=https://www.youtube.com/watch?v=vid12345678');
      const res = await GET(req);

      expect(res.status).toBe(200);
      expect(res.headers.get('Cache-Control')).toBe('public, s-maxage=86400, stale-while-revalidate=604800');
      expect(res.headers.get('Cache-Control')).toBe(CACHE_HEADERS['Cache-Control']);
    });
  });

  describe('cache pruning and lifecycle tests', () => {
    it('clearYouTubeMetadataCacheForTests clears all entries', () => {
      setYouTubeMetadataCacheEntryForTests('video:v1', { title: 'V1' });
      setYouTubeMetadataCacheEntryForTests('video:v2', { title: 'V2' });
      expect(getYouTubeMetadataCacheSize()).toBe(2);

      clearYouTubeMetadataCacheForTests();
      expect(getYouTubeMetadataCacheSize()).toBe(0);
    });

    it('refetches when cached item has expired beyond TTL', async () => {
      const expiredAt = Date.now() - (YOUTUBE_METADATA_TTL_MS + 1000);
      setYouTubeMetadataCacheEntryForTests('video:expiredvid1', { title: 'Stale Title' }, expiredAt);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            {
              snippet: {
                title: 'Fresh Title',
                thumbnails: { high: { url: 'https://i.ytimg.com/fresh.jpg' } },
              },
            },
          ],
        }),
      });

      const req = new NextRequest('http://localhost/api/import/youtube/metadata?url=https://www.youtube.com/watch?v=expiredvid1');
      const res = await GET(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.title).toBe('Fresh Title');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('prunes expired entries when pruneYouTubeMetadataCache is invoked', () => {
      const now = Date.now();
      setYouTubeMetadataCacheEntryForTests('video:expired', { title: 'Old' }, now - (YOUTUBE_METADATA_TTL_MS + 5000));
      setYouTubeMetadataCacheEntryForTests('video:fresh', { title: 'New' }, now);

      expect(getYouTubeMetadataCacheSize()).toBe(2);
      pruneYouTubeMetadataCache(now);
      expect(getYouTubeMetadataCacheSize()).toBe(1);
    });

    it('prunes oldest entries when cache reaches MAX_CACHE_ENTRIES', async () => {
      const now = Date.now();
      // Populate cache up to MAX_CACHE_ENTRIES (2000)
      for (let i = 0; i < MAX_CACHE_ENTRIES; i++) {
        setYouTubeMetadataCacheEntryForTests(`video:seed_${i}`, { title: `Video ${i}` }, now);
      }
      expect(getYouTubeMetadataCacheSize()).toBe(MAX_CACHE_ENTRIES);

      // Setup fetch for new video
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            {
              snippet: {
                title: 'New Video After Cap',
                thumbnails: { high: { url: 'https://i.ytimg.com/new.jpg' } },
              },
            },
          ],
        }),
      });

      const req = new NextRequest('http://localhost/api/import/youtube/metadata?url=https://www.youtube.com/watch?v=capreached1');
      const res = await GET(req);

      expect(res.status).toBe(200);
      expect(getYouTubeMetadataCacheSize()).toBe(MAX_CACHE_ENTRIES);

      // Verify oldest entry was evicted (video:seed_0)
      const oldestReq = new NextRequest('http://localhost/api/import/youtube/metadata?url=https://www.youtube.com/watch?v=seed_0');
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [{ snippet: { title: 'Re-fetched video 0' } }],
        }),
      });
      await GET(oldestReq);
      // If it was pruned, it had to fetch again!
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });
});
