import { NextRequest, NextResponse } from 'next/server';
import { messagingMetricsService } from '@/src/server/domain/messaging/metrics.service';
import { verifyProxyStaticKey, CENTRIFUGO_PROXY_KEY_HEADER } from '@/src/server/domain/messaging/proxy-auth.service';

export const dynamic = 'force-dynamic';

function isAuthorizedInternal(req: NextRequest): boolean {
  const customSecret = req.headers.get('x-internal-secret');
  const expectedSecret = process.env.INTERNAL_API_KEY || process.env.CENTRIFUGO_HTTP_API_KEY;

  if (expectedSecret && customSecret === expectedSecret) {
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
    const summary = await messagingMetricsService.getMetricsSummary();
    const httpStatus = summary.status === 'critical' ? 503 : 200;

    return NextResponse.json(summary, {
      status: httpStatus,
      headers: {
        'Cache-Control': 'no-store, private',
      },
    });
  } catch (error) {
    console.error('Health check failed:', error);
    return NextResponse.json(
      { status: 'critical', error: 'Internal health check failure' },
      { status: 503 }
    );
  }
}
