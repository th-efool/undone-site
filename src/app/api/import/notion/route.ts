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

  const url = typeof body?.url === 'string' ? body.url.trim() : '';
  const sourceId = typeof body?.sourceId === 'string' ? body.sourceId.trim() : '';

  if (!url || !sourceId) {
    return Response.json({ code: 'invalid_url', message: 'Invalid URL or Source ID' }, { status: 400 });
  }

  const title = typeof body?.title === 'string' && body.title.trim() ? body.title.trim() : 'Imported Notion Page';

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const publish = (event: unknown) => {
        try {
          controller.enqueue(encoder.encode(serialize(event)));
        } catch {
          // Stream may be closed or cancelled
        }
      };

      try {
        const source = await importNotionPage(
          {
            sourceId,
            title,
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
            currentSourceLabel: source?.title ?? title,
            estimatedRemaining: '0m',
            liveStatus: 'Import complete',
          },
        });

        try {
          controller.close();
        } catch {
          // Stream may already be closed
        }
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
        try {
          controller.close();
        } catch {
          // Stream may already be closed
        }
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
