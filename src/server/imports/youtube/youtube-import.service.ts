import { createYoutubeImportError, mapYoutubeApiError, type YoutubeImportError } from './youtube-errors';
import { extractPlaylistId } from './youtube-url';

interface PlaylistImportRequest {
  sourceId: string;
  title: string;
  url: string;
}

interface YoutubePlaylistItem {
  id: string;
  snippet?: {
    title?: string;
    description?: string;
    thumbnails?: Record<string, { url: string }>;
    publishedAt?: string;
    channelTitle?: string;
    position?: number;
  };
  contentDetails?: {
    videoId?: string;
  };
}

interface YoutubePlaylistResponse {
  items?: Array<{
    id: string;
    snippet?: {
      title?: string;
      description?: string;
      thumbnails?: Record<string, { url: string }>;
      channelTitle?: string;
    };
    contentDetails?: {
      itemCount?: number;
    };
  }>;
}

interface YoutubePlaylistItemsResponse {
  items?: YoutubePlaylistItem[];
  nextPageToken?: string;
  pageInfo?: {
    totalResults?: number;
  };
}

interface YoutubeVideosResponse {
  items?: Array<{
    id: string;
    snippet?: {
      title?: string;
      description?: string;
      thumbnails?: Record<string, { url: string }>;
      publishedAt?: string;
      channelTitle?: string;
    };
    contentDetails?: {
      duration?: string;
    };
  }>;
}

export interface ServerImportedLessonModel {
  id: string;
  title: string;
  thumbnail: string;
  description: string;
  duration: string;
  position: number;
  provider: string;
  videoId: string;
  publishedLabel: string;
}

export interface ServerImportedSourceModel {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  provider: string;
  creator: string;
  lessonCount: number;
  totalDuration: string;
  estimatedSeasonCount: number;
  status: 'completed';
  lessons: ServerImportedLessonModel[];
}

export interface ImportPublishEvent {
  type: 'stage' | 'feed' | 'snapshot' | 'complete' | 'error';
  [key: string]: unknown;
}

const YT_BASE = 'https://www.googleapis.com/youtube/v3';

function toIsoDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

function parseIsoDuration(duration: string) {
  const match = /P(?:([0-9]+)Y)?(?:([0-9]+)M)?(?:([0-9]+)W)?(?:([0-9]+)D)?T(?:([0-9]+)H)?(?:([0-9]+)M)?(?:([0-9]+)S)?/.exec(
    duration,
  );
  if (!match) return 0;
  const [, years, months, weeks, days, hours, minutes, seconds] = match;
  return (
    (Number(years ?? 0) * 31536000) +
    (Number(months ?? 0) * 2592000) +
    (Number(weeks ?? 0) * 604800) +
    (Number(days ?? 0) * 86400) +
    (Number(hours ?? 0) * 3600) +
    (Number(minutes ?? 0) * 60) +
    Number(seconds ?? 0)
  );
}

function formatDuration(seconds: number) {
  if (seconds <= 0) return '0m';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  }
  return `${minutes}m`;
}

function formatPublishedLabel(publishedAt?: string) {
  if (!publishedAt) return 'Published date unavailable';
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(publishedAt));
}

function pickThumbnail(thumbnails?: Record<string, { url: string }>) {
  return (
    thumbnails?.maxres?.url ??
    thumbnails?.standard?.url ??
    thumbnails?.high?.url ??
    thumbnails?.medium?.url ??
    thumbnails?.default?.url ??
    '/images/landing/screen.webp'
  );
}

async function fetchYoutubeJson<T>(
  path: string,
  params: Record<string, string | number | undefined>,
  signal: AbortSignal,
): Promise<T> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw createYoutubeImportError('missing_api_key');
  }

  const url = new URL(`${YT_BASE}/${path}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });
  url.searchParams.set('key', apiKey);

  const response = await fetch(url, { signal, cache: 'no-store' });
  const body = await response.json().catch(() => ({} as any));

  if (!response.ok) {
    const error = body?.error;
    const reason = error?.errors?.[0]?.reason as string | undefined;
    throw mapYoutubeApiError(response.status, reason, error?.message);
  }

  return body as T;
}

async function fetchPlaylistMetadata(playlistId: string, signal: AbortSignal) {
  const response = await fetchYoutubeJson<YoutubePlaylistResponse>(
    'playlists',
    {
      part: 'snippet,contentDetails',
      id: playlistId,
      maxResults: 1,
    },
    signal,
  );

  const playlist = response.items?.[0];
  if (!playlist) {
    throw createYoutubeImportError('playlist_not_found');
  }

  return playlist;
}

async function fetchPlaylistItems(playlistId: string, signal: AbortSignal, publish: (event: ImportPublishEvent) => void) {
  const items: YoutubePlaylistItem[] = [];
  let pageToken: string | undefined;
  let page = 0;
  let totalPages = 1;

  while (true) {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    page += 1;
    const response = await fetchYoutubeJson<YoutubePlaylistItemsResponse>(
      'playlistItems',
      {
        part: 'snippet,contentDetails',
        playlistId,
        maxResults: 50,
        pageToken,
      },
      signal,
    );

    const pageItems = response.items ?? [];
    items.push(...pageItems);
    const totalResults = response.pageInfo?.totalResults ?? items.length;
    totalPages = Math.max(1, Math.ceil(totalResults / 50));

    publish({
      type: 'feed',
      feed: {
        title: `Finished page ${page} of ${totalPages}`,
        detail: `${items.length} playlist items discovered so far.`,
        tone: 'brand',
      },
    });

    publish({
      type: 'stage',
      stage: {
        id: 'playlist-videos',
        title: 'Fetching Playlist Videos',
        description: 'Reading every playlist page and collecting video ids.',
        status: pageToken ? 'running' : 'running',
        progress: Math.min(100, Math.round((items.length / Math.max(totalResults, 1)) * 100)),
      },
    });

    pageToken = response.nextPageToken;
    if (!pageToken) break;
  }

  return { items, totalPages };
}

async function fetchVideoDetails(
  videoIds: string[],
  signal: AbortSignal,
): Promise<YoutubeVideosResponse> {
  return fetchYoutubeJson<YoutubeVideosResponse>(
    'videos',
    {
      part: 'snippet,contentDetails',
      id: videoIds.join(','),
      maxResults: 50,
    },
    signal,
  );
}

export async function importYouTubePlaylist(
  request: PlaylistImportRequest,
  publish: (event: ImportPublishEvent) => void,
  signal: AbortSignal,
): Promise<ServerImportedSourceModel> {
  const playlistId = extractPlaylistId(request.url);

  publish({
    type: 'stage',
    stage: {
      id: 'validating-url',
      title: 'Validating URL',
      description: 'Checking that the playlist URL can be imported.',
      status: 'completed',
      progress: 100,
    },
  });

  publish({
    type: 'feed',
    feed: {
      title: 'Connected to YouTube',
      detail: 'Validated playlist URL and resolved playlist id.',
      tone: 'success',
    },
  });

  publish({
    type: 'stage',
    stage: {
      id: 'connecting',
      title: 'Connecting to YouTube',
      description: 'Requesting playlist metadata from the YouTube Data API.',
      status: 'running',
      progress: 25,
    },
  });

  publish({
    type: 'stage',
    stage: {
      id: 'playlist-metadata',
      title: 'Reading Playlist Metadata',
      description: 'Fetching playlist title, description, creator, and artwork.',
      status: 'completed',
      progress: 100,
    },
  });

  const playlist = await fetchPlaylistMetadata(playlistId, signal);
  const totalItems = playlist.contentDetails?.itemCount ?? 0;

  publish({
    type: 'stage',
    stage: {
      id: 'connecting',
      title: 'Connecting to YouTube',
      description: 'Requesting playlist metadata from the YouTube Data API.',
      status: 'completed',
      progress: 100,
    },
  });

  publish({
    type: 'feed',
    feed: {
      title: 'Found playlist',
      detail: `${playlist.snippet?.title ?? request.title} - ${totalItems} videos`,
      tone: 'brand',
    },
  });

  const playlistTitle = playlist.snippet?.title ?? request.title;
  const playlistDescription = playlist.snippet?.description ?? '';
  const playlistCreator = playlist.snippet?.channelTitle ?? 'Unknown creator';
  const playlistThumbnail = pickThumbnail(playlist.snippet?.thumbnails);

  publish({
    type: 'snapshot',
    snapshot: {
      source: {
        id: request.sourceId,
        title: playlistTitle,
        description: playlistDescription,
        thumbnail: playlistThumbnail,
        provider: 'YouTube Playlist',
        creator: playlistCreator,
        lessonCount: totalItems,
        totalDuration: '0m',
        estimatedSeasonCount: Math.max(1, Math.ceil(Math.max(totalItems, 1) / 8)),
        status: 'completed',
        lessons: [],
      },
      overallProgress: 15,
      currentOperation: 'Reading playlist metadata',
      currentSourceLabel: playlistTitle,
      estimatedRemaining: totalItems > 0 ? `~${Math.max(1, Math.ceil(totalItems / 50))}m` : '0m',
      liveStatus: 'Reading metadata',
    },
  });

  publish({
    type: 'stage',
    stage: {
      id: 'playlist-videos',
      title: 'Fetching Playlist Videos',
      description: 'Paging through every playlist item until the list is complete.',
      status: 'running',
      progress: 10,
    },
  });

  const { items: playlistItems, totalPages } = await fetchPlaylistItems(playlistId, signal, publish);

  publish({
    type: 'stage',
    stage: {
      id: 'playlist-videos',
      title: 'Fetching Playlist Videos',
      description: 'Paging through every playlist item until the list is complete.',
      status: 'completed',
      progress: 100,
    },
  });

  publish({
    type: 'stage',
    stage: {
      id: 'video-details',
      title: 'Fetching Video Details',
      description: 'Downloading titles, thumbnails, and durations in batches.',
      status: 'running',
      progress: 50,
    },
  });

  const lessons: ServerImportedSourceModel['lessons'] = [];
  let totalSeconds = 0;
  let processed = 0;

  for (let index = 0; index < playlistItems.length; index += 50) {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    const batch = playlistItems.slice(index, index + 50);
    const videoIds = batch
      .map((item) => item.contentDetails?.videoId)
      .filter((videoId): videoId is string => Boolean(videoId));

    publish({
      type: 'feed',
      feed: {
        title: 'Downloading metadata',
        detail: `Batch ${Math.floor(index / 50) + 1} of ${Math.max(1, Math.ceil(playlistItems.length / 50))}`,
        tone: 'brand',
      },
    });

    const videos = videoIds.length ? await fetchVideoDetails(videoIds, signal) : { items: [] };
    const videosById = new Map(
      (videos.items ?? []).map((video) => [
        video.id,
        video,
      ]),
    );

    for (const item of batch) {
      const videoId = item.contentDetails?.videoId;
      if (!videoId) continue;

      const video = videosById.get(videoId);
      const rawTitle = (video?.snippet?.title ?? item.snippet?.title ?? '').trim();
      const lowerTitle = rawTitle.toLowerCase();

      // Skip private or deleted videos completely
      if (
        !rawTitle ||
        lowerTitle.includes('private video') ||
        lowerTitle.includes('deleted video') ||
        lowerTitle.includes('this video is private') ||
        lowerTitle.includes('this video is deleted') ||
        rawTitle === '[private video]' ||
        rawTitle === '[deleted video]'
      ) {
        continue;
      }

      const videoDuration = parseIsoDuration(video?.contentDetails?.duration ?? 'PT0S');
      totalSeconds += videoDuration;
      const lesson = {
        id: `${request.sourceId}-${videoId}`,
        title: rawTitle || `Video ${item.snippet?.position ?? lessons.length + 1}`,
        thumbnail: pickThumbnail(video?.snippet?.thumbnails ?? item.snippet?.thumbnails),
        description: video?.snippet?.description ?? item.snippet?.description ?? '',
        duration: toIsoDuration(videoDuration),
        position: lessons.length + 1,
        provider: 'YouTube',
        videoId,
        publishedLabel: formatPublishedLabel(video?.snippet?.publishedAt ?? item.snippet?.publishedAt),
      };
      lessons.push(lesson);
      processed += 1;

      publish({
        type: 'feed',
        feed: {
          title: `Fetched video ${lesson.position}`,
          detail: lesson.title,
          tone: 'neutral',
        },
      });

      publish({
        type: 'snapshot',
        snapshot: {
          source: {
            id: request.sourceId,
            title: playlistTitle,
            description: playlistDescription,
            thumbnail: playlistThumbnail,
            provider: 'YouTube Playlist',
            creator: playlistCreator,
            lessonCount: totalItems,
            totalDuration: formatDuration(totalSeconds),
            estimatedSeasonCount: Math.max(1, Math.ceil(Math.max(totalItems, 1) / 8)),
            status: 'completed',
            lessons: [...lessons],
          },
          overallProgress: Math.min(
            95,
            20 + Math.round((processed / Math.max(totalItems, 1)) * 70),
          ),
          currentOperation: 'Fetching video details',
          currentSourceLabel: playlistTitle,
          estimatedRemaining:
            processed < totalItems
              ? `~${Math.max(1, Math.ceil((totalItems - processed) / 50))}m`
              : '0m',
          liveStatus: `Fetched ${processed} of ${totalItems || lessons.length} videos`,
        },
      });
    }

    publish({
      type: 'stage',
      stage: {
        id: 'video-details',
        title: 'Fetching Video Details',
        description: 'Downloading titles, thumbnails, and durations in batches.',
        status: 'completed',
        progress: 100,
      },
    });

    publish({
      type: 'stage',
      stage: {
        id: 'durations',
        title: 'Calculating Durations',
        description: 'Converting ISO8601 durations into renderable labels.',
        status: 'completed',
        progress: 100,
      },
    });

    publish({
      type: 'feed',
      feed: {
        title: `Finished batch ${Math.floor(index / 50) + 1} of ${Math.max(1, Math.ceil(playlistItems.length / 50))}`,
        detail: `${lessons.length} lessons prepared.`,
        tone: 'success',
      },
    });
  }

  const importedSource: ServerImportedSourceModel = {
    id: request.sourceId,
    title: playlistTitle,
    description: playlistDescription,
    thumbnail: playlistThumbnail,
    provider: 'YouTube Playlist',
    creator: playlistCreator,
    lessonCount: lessons.length,
    totalDuration: formatDuration(totalSeconds),
    estimatedSeasonCount: Math.max(1, Math.ceil(Math.max(lessons.length, 1) / 8)),
    status: 'completed',
    lessons,
  };

  publish({
    type: 'stage',
    stage: {
      id: 'curriculum',
      title: 'Preparing Curriculum',
      description: 'Packaging the imported playlist for the next wizard step.',
      status: 'running',
      progress: 80,
    },
  });

  publish({
    type: 'stage',
    stage: {
      id: 'curriculum',
      title: 'Preparing Curriculum',
      description: 'Packaging the imported playlist for the next wizard step.',
      status: 'completed',
      progress: 100,
    },
  });

  publish({
    type: 'stage',
    stage: {
      id: 'completed',
      title: 'Completed',
      description: 'The source is ready for the curriculum step.',
      status: 'completed',
      progress: 100,
    },
  });

  publish({
    type: 'feed',
    feed: {
      title: 'Finished playlist',
      detail: `${importedSource.lessonCount} lessons imported successfully.`,
      tone: 'success',
    },
  });

  return importedSource;
}
