import { createYoutubeImportError, type YoutubeImportError } from './youtube-errors';

export function extractPlaylistId(input: string): string {
  const trimmed = input.trim();
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

