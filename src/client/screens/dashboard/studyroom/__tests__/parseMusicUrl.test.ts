/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { parseMusicUrl } from '../utils/parseMusicUrl';

describe('parseMusicUrl utility', () => {
  const validInputs = [
    // YouTube video standard
    {
      input: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      provider: 'youtube',
      kind: 'video',
      id: 'dQw4w9WgXcQ',
      expectedHost: 'www.youtube-nocookie.com',
    },
    // YouTube mobile host
    {
      input: 'https://m.youtube.com/watch?v=dQw4w9WgXcQ',
      provider: 'youtube',
      kind: 'video',
      id: 'dQw4w9WgXcQ',
      expectedHost: 'www.youtube-nocookie.com',
    },
    // YouTube Music host
    {
      input: 'https://music.youtube.com/watch?v=dQw4w9WgXcQ',
      provider: 'youtube',
      kind: 'video',
      id: 'dQw4w9WgXcQ',
      expectedHost: 'www.youtube-nocookie.com',
    },
    // youtu.be shortlink
    {
      input: 'https://youtu.be/dQw4w9WgXcQ',
      provider: 'youtube',
      kind: 'video',
      id: 'dQw4w9WgXcQ',
      expectedHost: 'www.youtube-nocookie.com',
    },
    // YouTube shorts
    {
      input: 'https://www.youtube.com/shorts/dQw4w9WgXcQ',
      provider: 'youtube',
      kind: 'video',
      id: 'dQw4w9WgXcQ',
      expectedHost: 'www.youtube-nocookie.com',
    },
    // YouTube embed URL input
    {
      input: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
      provider: 'youtube',
      kind: 'video',
      id: 'dQw4w9WgXcQ',
      expectedHost: 'www.youtube-nocookie.com',
    },
    // YouTube playlist
    {
      input: 'https://www.youtube.com/playlist?list=PLlaN88a7xKIv89A6P8P9vP0_V-5vj_n6r',
      provider: 'youtube',
      kind: 'playlist',
      id: 'PLlaN88a7xKIv89A6P8P9vP0_V-5vj_n6r',
      expectedHost: 'www.youtube-nocookie.com',
    },
    // YouTube video within playlist
    {
      input: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLlaN88a7xKIv89A6P8P9vP0_V-5vj_n6r',
      provider: 'youtube',
      kind: 'playlist',
      id: 'PLlaN88a7xKIv89A6P8P9vP0_V-5vj_n6r',
      startVideoId: 'dQw4w9WgXcQ',
      expectedHost: 'www.youtube-nocookie.com',
    },
    // youtu.be with playlist
    {
      input: 'https://youtu.be/dQw4w9WgXcQ?list=PLlaN88a7xKIv89A6P8P9vP0_V-5vj_n6r',
      provider: 'youtube',
      kind: 'playlist',
      id: 'PLlaN88a7xKIv89A6P8P9vP0_V-5vj_n6r',
      startVideoId: 'dQw4w9WgXcQ',
      expectedHost: 'www.youtube-nocookie.com',
    },
    // Spotify track
    {
      input: 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT',
      provider: 'spotify',
      kind: 'track',
      id: '4cOdK2wGLETKBW3PvgPWqT',
      expectedHost: 'open.spotify.com',
    },
    // Spotify track with /intl-fr/ prefix
    {
      input: 'https://open.spotify.com/intl-fr/track/4cOdK2wGLETKBW3PvgPWqT',
      provider: 'spotify',
      kind: 'track',
      id: '4cOdK2wGLETKBW3PvgPWqT',
      expectedHost: 'open.spotify.com',
    },
    // Spotify playlist
    {
      input: 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M',
      provider: 'spotify',
      kind: 'playlist',
      id: '37i9dQZF1DXcBWIGoYBM5M',
      expectedHost: 'open.spotify.com',
    },
    // Spotify URI (track)
    {
      input: 'spotify:track:4cOdK2wGLETKBW3PvgPWqT',
      provider: 'spotify',
      kind: 'track',
      id: '4cOdK2wGLETKBW3PvgPWqT',
      expectedHost: 'open.spotify.com',
    },
    // Spotify URI (playlist)
    {
      input: 'spotify:playlist:37i9dQZF1DXcBWIGoYBM5M',
      provider: 'spotify',
      kind: 'playlist',
      id: '37i9dQZF1DXcBWIGoYBM5M',
      expectedHost: 'open.spotify.com',
    },
    // Scheme-less YouTube
    {
      input: 'youtube.com/watch?v=dQw4w9WgXcQ',
      provider: 'youtube',
      kind: 'video',
      id: 'dQw4w9WgXcQ',
      expectedHost: 'www.youtube-nocookie.com',
    },
    // Scheme-less Spotify
    {
      input: 'open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT',
      provider: 'spotify',
      kind: 'track',
      id: '4cOdK2wGLETKBW3PvgPWqT',
      expectedHost: 'open.spotify.com',
    },
    // http:// upgrade
    {
      input: 'http://www.youtube.com/watch?v=dQw4w9WgXcQ',
      provider: 'youtube',
      kind: 'video',
      id: 'dQw4w9WgXcQ',
      expectedHost: 'www.youtube-nocookie.com',
    },
  ];

  it.each(validInputs)(
    'accepts $input as $provider $kind ($id)',
    ({ input, provider, kind, id, startVideoId, expectedHost }) => {
      const res = parseMusicUrl(input);
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      expect(res.source.provider).toBe(provider);
      expect(res.source.kind).toBe(kind);
      expect(res.source.id).toBe(id);
      if (startVideoId && res.source.provider === 'youtube') {
        expect(res.source.startVideoId).toBe(startVideoId);
      }

      const parsedEmbed = new URL(res.source.embedUrl);
      expect(parsedEmbed.hostname).toBe(expectedHost);
      expect(['www.youtube-nocookie.com', 'open.spotify.com']).toContain(
        parsedEmbed.hostname
      );
    }
  );

  const rejectionCases = [
    { input: '', expectedReason: 'empty' },
    { input: '   ', expectedReason: 'empty' },
    { input: 'not a url', expectedReason: 'not-a-url' },
    { input: 'javascript:alert(1)', expectedReason: 'not-a-url' },
    { input: 'data:text/html,test', expectedReason: 'not-a-url' },
    { input: 'file:///etc/passwd', expectedReason: 'not-a-url' },
    { input: 'ftp://example.com/music.mp3', expectedReason: 'not-a-url' },
    { input: 'https://evil.com/watch?v=dQw4w9WgXcQ', expectedReason: 'unsupported-host' },
    {
      input: 'https://youtube.com.evil.io/watch?v=dQw4w9WgXcQ',
      expectedReason: 'unsupported-host',
    },
    {
      input: 'https://vimeo.com/123456789',
      expectedReason: 'unsupported-host',
    },
    {
      input: 'https://open.spotify.com/album/4cOdK2wGLETKBW3PvgPWqT',
      expectedReason: 'unsupported-spotify-type',
    },
    {
      input: 'spotify:album:4cOdK2wGLETKBW3PvgPWqT',
      expectedReason: 'unsupported-spotify-type',
    },
    {
      input: 'https://open.spotify.com/artist/4cOdK2wGLETKBW3PvgPWqT',
      expectedReason: 'unsupported-spotify-type',
    },
    {
      input: 'https://www.youtube.com/@channel',
      expectedReason: 'youtube-no-media',
    },
    {
      input: 'https://www.youtube.com/feed/trending',
      expectedReason: 'youtube-no-media',
    },
  ];

  it.each(rejectionCases)(
    'rejects "$input" with reason "$expectedReason"',
    ({ input, expectedReason }) => {
      const res = parseMusicUrl(input);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.reason).toBe(expectedReason);
      }
    }
  );
});
