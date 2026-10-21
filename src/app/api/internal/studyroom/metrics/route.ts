import { NextRequest, NextResponse } from 'next/server';
import { studyRoomMetricsService } from '@/src/server/domain/studyroom/studyroom-metrics.service';
import { verifyProxyStaticKey, CENTRIFUGO_PROXY_KEY_HEADER } from '@/src/server/domain/messaging/proxy-auth.service';

export const dynamic = 'force-dynamic';

function isAuthorizedInternal(req: NextRequest): boolean {
  const customSecret = req.headers.get('x-internal-secret');
  const authHeader = req.headers.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const expectedSecret = process.env.INTERNAL_API_SECRET || process.env.INTERNAL_API_KEY || process.env.CENTRIFUGO_HTTP_API_KEY;

  if (expectedSecret && (customSecret === expectedSecret || bearerToken === expectedSecret)) {
    return true;
  }

  const proxyKey = req.headers.get(CENTRIFUGO_PROXY_KEY_HEADER);
  if (verifyProxyStaticKey(proxyKey)) {
    return true;
  }

  return false;
}

export async function GET(req: NextRequest) {
  if (!isAuthorizedInternal(req)) {
    return NextResponse.json({ error: 'Forbidden: internal endpoint' }, { status: 403 });
  }

  try {
    const summary = await studyRoomMetricsService.getMetricsSummary();
    return NextResponse.json(summary, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, private',
      },
    });
  } catch (error) {
    console.error('Study room metrics scrape failed:', error);
    return NextResponse.json({ error: 'Metrics scrape failed' }, { status: 500 });
  }
}
