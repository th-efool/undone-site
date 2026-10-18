import { devLogger, type UndoneLogLevel } from '@/src/shared/lib/dev-logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const isDev = process.env.NODE_ENV !== 'production';
  const forceEnable = process.env.NEXT_PUBLIC_ENABLE_LOGS === '1' || process.env.NEXT_PUBLIC_ENABLE_LOGS === 'true';

  if (!isDev && !forceEnable && url.searchParams.get('token') !== process.env.DEV_LOGS_TOKEN) {
    return Response.json({ error: 'Dev logs not enabled in this environment' }, { status: 403 });
  }

  if (url.searchParams.get('clear') === '1') {
    devLogger.clear();
    return Response.json({ success: true, message: 'Logs and issues cleared' });
  }

  const format = url.searchParams.get('format');
  if (format === 'markdown' || format === 'md') {
    return new Response(devLogger.exportReport(), {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  }

  const tag = url.searchParams.get('tag') ?? undefined;
  const level = (url.searchParams.get('level')?.toUpperCase() as UndoneLogLevel) ?? undefined;
  const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : 100;

  return Response.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    issues: devLogger.getIssues(level),
    logs: devLogger.getRecentLogs({ tag, level, limit }),
  }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
