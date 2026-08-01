import { NextRequest } from 'next/server';

import {
  importYouTubePlaylist,
  importYouTubeVideo,
  importWebArticle,
} from '@/src/server/imports/youtube/youtube-import.service';
import { createYoutubeImportError } from '@/src/server/imports/youtube/youtube-errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface SourceImportRequest {
  sourceId?: string;
  title?: string;
  url?: string;
  sourceType?: string;
}

function serialize(value: unknown) {
  return `${JSON.stringify(value)}\n`;
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as SourceImportRequest | null;

  if (!body?.url || !body?.sourceId) {
    return Response.json(createYoutubeImportError('invalid_url'), { status: 400 });
  }

  const url = body.url.trim();
  const sourceType = body.sourceType;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const publish = (event: unknown) => controller.enqueue(encoder.encode(serialize(event)));

      try {
        let source;
        const isPlaylist =
          sourceType === 'YouTube Playlist' ||
          url.includes('list=PL') ||
          url.includes('/playlist?list=');
        const isSingleVideo =
          sourceType === 'YouTube Video' ||
          url.includes('youtu.be/') ||
          (url.includes('watch?v=') && !url.includes('list=PL'));

        if (isPlaylist) {
          source = await importYouTubePlaylist(
            {
              sourceId: body.sourceId ?? '',
              title: body.title ?? 'Imported playlist',
              url,
            },
            publish,
            request.signal,
          );
        } else if (isSingleVideo) {
          source = await importYouTubeVideo(
            {
              sourceId: body.sourceId ?? '',
              title: body.title ?? 'Imported video',
              url,
            },
            publish,
            request.signal,
          );
        } else {
          source = await importWebArticle(
            {
              sourceId: body.sourceId ?? '',
              title: body.title ?? 'Web reference',
              url,
            },
            publish,
            request.signal,
          );
        }

        publish({
          type: 'complete',
          complete: {
            source,
            overallProgress: 100,
            currentOperation: 'Completed',
            currentSourceLabel: source.title,
            estimatedRemaining: '0m',
            liveStatus: 'Import complete',
          },
        });

        controller.close();
      } catch (error) {
        const mapped = error as { code?: string; title?: string; message?: string; retryable?: boolean };
        publish({
          type: 'error',
          error: {
            code: mapped.code ?? 'request_failed',
            title: mapped.title ?? 'Import failed',
            message: mapped.message ?? 'The source could not be imported.',
            retryable: mapped.retryable ?? true,
          },
        });
        controller.close();
      }
    },
    cancel() {
      // request.signal handles abort propagation.
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store, no-transform',
    },
  });
}
