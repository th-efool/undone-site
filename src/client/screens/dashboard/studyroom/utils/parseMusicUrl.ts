import type { MusicSource } from '../types';

export type MusicParseErrorReason =
  | 'empty'
  | 'not-a-url'
  | 'unsupported-host'
  | 'unsupported-spotify-type'
  | 'youtube-no-media';

export const MUSIC_ERROR_MESSAGES: Record<MusicParseErrorReason, string> = {
  empty: 'Paste a YouTube or Spotify link.',
  'not-a-url': "That doesn't look like a link.",
  'unsupported-host': 'Only YouTube and Spotify links are supported.',
  'unsupported-spotify-type': 'Spotify links must be a track or a playlist.',
  'youtube-no-media': "That YouTube link doesn't point to a video or a playlist.",
};

const YOUTUBE_VIDEO_ID_REGEX = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_PLAYLIST_ID_REGEX = /^[A-Za-z0-9_-]{12,64}$/;
const SPOTIFY_ID_REGEX = /^[A-Za-z0-9]{22}$/;

const SUPPORTED_YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
]);

export type ParseMusicUrlResult =
  | { ok: true; source: MusicSource }
  | { ok: false; reason: MusicParseErrorReason };

/**
 * Validates and extracts a canonical YouTube or Spotify media source.
 * Enforces strict host allow-list and validates IDs with strict regexes.
 */
export function parseMusicUrl(input: string): ParseMusicUrlResult {
  if (!input || typeof input !== 'string') {
    return { ok: false, reason: 'empty' };
  }

  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return { ok: false, reason: 'empty' };
  }

  // 1. Spotify URI support (spotify:track:ID or spotify:playlist:ID)
  if (trimmed.startsWith('spotify:')) {
    const parts = trimmed.split(':');
    if (parts.length === 3) {
      const type = parts[1];
      const id = parts[2];
      if (type === 'track' || type === 'playlist') {
        if (SPOTIFY_ID_REGEX.test(id)) {
          return {
            ok: true,
            source: {
              provider: 'spotify',
              kind: type,
              id,
              embedUrl: `https://open.spotify.com/embed/${type}/${id}?utm_source=generator`,
              originalUrl: `https://open.spotify.com/${type}/${id}`,
            },
          };
        }
        return { ok: false, reason: 'not-a-url' };
      }
      return { ok: false, reason: 'unsupported-spotify-type' };
    }
    return { ok: false, reason: 'unsupported-spotify-type' };
  }

  // 2. Reject unsupported schemes explicitly before URL normalization
  if (
    trimmed.startsWith('javascript:') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('mailto:') ||
    trimmed.startsWith('file:') ||
    trimmed.startsWith('ftp:')
  ) {
    return { ok: false, reason: 'not-a-url' };
  }

  // 3. Scheme normalization
  let urlString = trimmed;
  if (/^http:\/\//i.test(urlString)) {
    urlString = 'https://' + urlString.slice(7);
  } else if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(urlString)) {
    urlString = 'https://' + urlString;
  }

  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    return { ok: false, reason: 'not-a-url' };
  }

  if (url.protocol !== 'https:') {
    return { ok: false, reason: 'not-a-url' };
  }

  const hostname = url.hostname.toLowerCase();

  // 4. Spotify parsing
  if (hostname === 'open.spotify.com') {
    // Strip internationalization prefix like /intl-fr or /intl-es
    const strippedPath = url.pathname.replace(/^\/intl-[a-zA-Z-]+/, '');
    const segments = strippedPath.split('/').filter(Boolean);

    if (segments.length >= 2) {
      const type = segments[0].toLowerCase();
      const id = segments[1];

      if (type === 'track' || type === 'playlist') {
        if (SPOTIFY_ID_REGEX.test(id)) {
          return {
            ok: true,
            source: {
              provider: 'spotify',
              kind: type,
              id,
              embedUrl: `https://open.spotify.com/embed/${type}/${id}?utm_source=generator`,
              originalUrl: `https://open.spotify.com/${type}/${id}`,
            },
          };
        }
        return { ok: false, reason: 'not-a-url' };
      }
      return { ok: false, reason: 'unsupported-spotify-type' };
    }
    return { ok: false, reason: 'unsupported-spotify-type' };
  }

  // 5. YouTube parsing
  if (SUPPORTED_YOUTUBE_HOSTS.has(hostname)) {
    let videoId: string | undefined;
    let playlistId: string | undefined;

    if (hostname === 'youtu.be') {
      const pathId = url.pathname.slice(1).split('/')[0];
      if (pathId && YOUTUBE_VIDEO_ID_REGEX.test(pathId)) {
        videoId = pathId;
      }
      const listParam = url.searchParams.get('list');
      if (listParam && YOUTUBE_PLAYLIST_ID_REGEX.test(listParam)) {
        playlistId = listParam;
      }
    } else {
      // Standard YouTube hosts
      const vParam = url.searchParams.get('v');
      if (vParam && YOUTUBE_VIDEO_ID_REGEX.test(vParam)) {
        videoId = vParam;
      }

      if (!videoId) {
        const segments = url.pathname.split('/').filter(Boolean);
        if (segments[0] === 'embed' || segments[0] === 'shorts') {
          const candidate = segments[1];
          if (candidate && YOUTUBE_VIDEO_ID_REGEX.test(candidate)) {
            videoId = candidate;
          }
        }
      }

      const listParam = url.searchParams.get('list');
      if (listParam && YOUTUBE_PLAYLIST_ID_REGEX.test(listParam)) {
        playlistId = listParam;
      }
    }

    // Resolving source according to Section 4.4.1 table:
    // Video within a playlist -> treat as playlist starting at videoId
    if (videoId && playlistId) {
      return {
        ok: true,
        source: {
          provider: 'youtube',
          kind: 'playlist',
          id: playlistId,
          startVideoId: videoId,
          embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}?list=${playlistId}&rel=0&playsinline=1`,
          originalUrl: `https://www.youtube.com/watch?v=${videoId}&list=${playlistId}`,
        },
      };
    }

    if (playlistId) {
      return {
        ok: true,
        source: {
          provider: 'youtube',
          kind: 'playlist',
          id: playlistId,
          embedUrl: `https://www.youtube-nocookie.com/embed/videoseries?list=${playlistId}&rel=0&playsinline=1`,
          originalUrl: `https://www.youtube.com/playlist?list=${playlistId}`,
        },
      };
    }

    if (videoId) {
      return {
        ok: true,
        source: {
          provider: 'youtube',
          kind: 'video',
          id: videoId,
          embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&playsinline=1`,
          originalUrl: `https://www.youtube.com/watch?v=${videoId}`,
        },
      };
    }

    return { ok: false, reason: 'youtube-no-media' };
  }

  // Host not in allow-list
  return { ok: false, reason: 'unsupported-host' };
}
