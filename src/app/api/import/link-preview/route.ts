import { NextRequest } from 'next/server';
import { openWebSource, webSourceUrl } from '@/src/server/domain/cohort-creation/materials/web-fetch';
import { devLogger } from '@/src/shared/lib/dev-logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_PREVIEW_BYTES = 512 * 1024; // 512 KB

export async function GET(request: NextRequest) {
  const logger = devLogger.scoped('LinkPreviewRoute');
  const rawUrl = request.nextUrl.searchParams.get('url');

  if (!rawUrl || !rawUrl.trim()) {
    return Response.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  const url = rawUrl.trim();

  let targetUrl: URL;
  try {
    targetUrl = webSourceUrl(url);
  } catch (err: any) {
    return Response.json({ error: err.message || 'Invalid or restricted URL' }, { status: 400 });
  }

  const host = targetUrl.hostname.toLowerCase();
  const isNotion = host.includes('notion.so') || host.includes('notion.site');
  const kind = isNotion ? 'notion' : 'web';

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    const webRes = await openWebSource(url, controller.signal);
    try {
      const chunks: Buffer[] = [];
      let totalBytes = 0;

      for await (const chunk of webRes.bytes) {
        chunks.push(Buffer.from(chunk));
        totalBytes += chunk.byteLength;
        if (totalBytes >= MAX_PREVIEW_BYTES) break;
      }

      // Strip heavy non-content blocks server-side so the client downloads (and parses) far less.
      const rawHtml = Buffer.concat(chunks).toString('utf8').replace(/<(script|style|noscript|svg)\b[\s\S]*?<\/\1>/gi, '');

      // Extract title from HTML tag if present
      let title = targetUrl.hostname;
      const titleMatch = rawHtml.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleMatch?.[1]) {
        title = titleMatch[1].replace(/[\r\n\t]+/g, ' ').trim();
      }

      const mediaType = webRes.mediaType || 'text/html';

      return Response.json(
        {
          url: targetUrl.href,
          title,
          host: targetUrl.hostname,
          kind,
          mediaType,
          content: rawHtml,
        },
        {
          headers: {
            'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
          },
        }
      );
    } finally {
      webRes.close();
    }
  } catch (err: any) {
    logger.warn(`Failed to preview link "${url}": ${err.message}`);
    return Response.json(
      { error: err.message || 'Failed to fetch link preview' },
      { status: 502 }
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

