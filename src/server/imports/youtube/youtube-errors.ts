export type YoutubeImportErrorCode =
  | 'missing_api_key'
  | 'invalid_url'
  | 'playlist_not_found'
  | 'private_playlist'
  | 'deleted_playlist'
  | 'quota_exceeded'
  | 'network_timeout'
  | 'video_not_found'
  | 'request_failed';

export interface YoutubeImportError {
  code: YoutubeImportErrorCode;
  title: string;
  message: string;
  retryable: boolean;
}

export function createYoutubeImportError(
  code: YoutubeImportErrorCode,
  message?: string,
): YoutubeImportError {
  switch (code) {
    case 'missing_api_key':
      return {
        code,
        title: 'Missing YouTube API key',
        message:
          message ??
          'Set `YOUTUBE_API_KEY` in your environment before trying to import playlists.',
        retryable: true,
      };
    case 'invalid_url':
      return {
        code,
        title: 'Invalid playlist URL',
        message: message ?? 'Paste a valid YouTube playlist URL and try again.',
        retryable: true,
      };
    case 'playlist_not_found':
      return {
        code,
        title: 'Playlist not found',
        message: message ?? 'YouTube could not find that playlist.',
        retryable: true,
      };
    case 'private_playlist':
      return {
        code,
        title: 'Private playlist',
        message: message ?? 'That playlist is private or inaccessible.',
        retryable: true,
      };
    case 'deleted_playlist':
      return {
        code,
        title: 'Playlist unavailable',
        message: message ?? 'That playlist appears to be deleted or unavailable.',
        retryable: true,
      };
    case 'quota_exceeded':
      return {
        code,
        title: 'YouTube quota exceeded',
        message: message ?? 'YouTube quota is exhausted for now. Try again later.',
        retryable: true,
      };
    case 'network_timeout':
      return {
        code,
        title: 'Request timed out',
        message: message ?? 'The import took too long to respond. Try again.',
        retryable: true,
      };
    case 'video_not_found':
      return {
        code,
        title: 'Video unavailable',
        message: message ?? 'One or more videos in the playlist are unavailable.',
        retryable: true,
      };
    default:
      return {
        code: 'request_failed',
        title: 'Import failed',
        message: message ?? 'The playlist could not be imported.',
        retryable: true,
      };
  }
}

export function mapYoutubeApiError(status: number, reason?: string, fallbackMessage?: string) {
  if (status === 401 || status === 403) {
    if (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded') {
      return createYoutubeImportError('quota_exceeded', fallbackMessage);
    }
    if (reason === 'playlistForbidden') {
      return createYoutubeImportError('private_playlist', fallbackMessage);
    }
    return createYoutubeImportError('private_playlist', fallbackMessage);
  }

  if (status === 404) {
    if (reason === 'playlistNotFound') {
      return createYoutubeImportError('playlist_not_found', fallbackMessage);
    }
    if (reason === 'videoNotFound') {
      return createYoutubeImportError('video_not_found', fallbackMessage);
    }
    return createYoutubeImportError('deleted_playlist', fallbackMessage);
  }

  if (reason === 'quotaExceeded') {
    return createYoutubeImportError('quota_exceeded', fallbackMessage);
  }

  return createYoutubeImportError('request_failed', fallbackMessage);
}

