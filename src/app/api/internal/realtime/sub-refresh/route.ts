import { NextRequest, NextResponse } from 'next/server';
import {
  CENTRIFUGO_PROXY_KEY_HEADER,
  verifyProxyStaticKey,
  proxyAuthService,
} from '@/src/server/domain/messaging/proxy-auth.service';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  // 1. Authenticate caller using dedicated static secret header before reading body
  const proxyKey = req.headers.get(CENTRIFUGO_PROXY_KEY_HEADER);
  if (!verifyProxyStaticKey(proxyKey)) {
    return NextResponse.json(
      { error: 'Forbidden: Invalid proxy credentials' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const { user, channel } = body || {};

    if (!user || !channel) {
      return NextResponse.json({
        error: {
          code: 103,
          message: 'Missing user or channel in sub-refresh payload',
        },
      });
    }

    // 2. Re-verify subscription against current authoritative database state
    const decision = await proxyAuthService.authorizeSubscription(user, channel);

    if (!decision.allowed) {
      return NextResponse.json({
        error: {
          code: decision.code || 103,
          message: decision.message || 'Subscription revoked',
        },
      });
    }

    return NextResponse.json({
      result: {
        expire_at: decision.expireAt,
      },
    });
  } catch (error) {
    console.error('Centrifugo sub-refresh proxy error:', error);
    return NextResponse.json({
      error: {
        code: 100,
        message: 'Internal authorization error',
      },
    });
  }
}
