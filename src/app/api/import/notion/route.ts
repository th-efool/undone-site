import { NextRequest } from 'next/server';
import { importNotionPage } from '@/src/server/imports/notion/notion-import.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface SourceImportRequest {
  sourceId?: string;
  title?: string;
  url?: string;
}

function serialize(value: unknown) {
  return `${JSON.stringify(value)}\n`;
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as SourceImportRequest | null;

  if (!body?.url || !body?.sourceId) {
    return Response.json({ code: 'invalid_url', message: 'Invalid URL or Source ID' }, { status: 400 });
  }

  const url = body.url.trim();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const publish = (event: unknown) => controller.enqueue(encoder.encode(serialize(event)));

      try {
        const source = await importNotionPage(
          {
            sourceId: body.sourceId ?? '',
            title: body.title ?? 'Imported Notion Page',
            url,
          },
          publish,
          request.signal,
        );

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
      } catch (error: any) {
        publish({
          type: 'error',
          error: {
            code: error?.code ?? 'request_failed',
            title: error?.title ?? 'Import failed',
            message: error?.message ?? 'The Notion page could not be imported.',
            retryable: true,
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
