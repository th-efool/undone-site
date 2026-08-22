import { createYoutubeImportError, type YoutubeImportError } from './youtube-errors';

export function extractPlaylistId(input?: string | null): string {
  const trimmed = input?.trim() || '';
  if (!trimmed) {
    throw createYoutubeImportError('invalid_url');
  }

  if (/^[A-Za-z0-9_-]{10,}$/.test(trimmed) && !trimmed.includes('://')) {
    return trimmed;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw createYoutubeImportError('invalid_url');
  }

  const playlistId = parsed.searchParams.get('list');
  if (playlistId) {
    return playlistId;
  }

  throw createYoutubeImportError('invalid_url');
}

export function extractVideoId(input?: string | null): string | null {
  const trimmed = input?.trim() || '';
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    const vParam = parsed.searchParams.get('v');
    if (vParam) return vParam;
    if (parsed.hostname?.includes('youtu.be')) {
      const pathname = parsed.pathname?.slice(1);
      if (pathname) return pathname.split('?')[0];
    }
  } catch {
    const match = trimmed.match(/(?:v=|youtu\.be\/|shorts\/)([a-zA-Z0-9_-]{11})/);
    if (match) return match[1];
  }
  return null;
}
