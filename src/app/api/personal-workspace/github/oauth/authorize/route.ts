import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { encryptToken } from '@/src/server/infrastructure/github/personal-workspace';
import { resolveAuthUser } from '../../vault';
import {
  getOAuthClientCredentials,
  getOAuthRedirectUri,
  OAUTH_STATE_COOKIE_NAME,
  OAUTH_STATE_COOKIE_OPTIONS,
} from '../config';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const user = await resolveAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const credentials = getOAuthClientCredentials();
  if (!credentials) {
    return NextResponse.json(
      {
        error:
          'GitHub OAuth credentials are not configured on the server (AUTH_GITHUB_ID / AUTH_GITHUB_SECRET missing)',
      },
      { status: 500 }
    );
  }

  const searchParams = req.nextUrl.searchParams;
  const targetRepo = searchParams.get('repo')?.trim() || undefined;
  const format = searchParams.get('format')?.toLowerCase();

  const stateNonce = crypto.randomBytes(32).toString('base64url');
  const redirectUri = getOAuthRedirectUri(req);

  const statePayload = JSON.stringify({
    stateNonce,
    userId: user.id,
    targetRepo,
    createdAt: Date.now(),
  });

  const encryptedState = await encryptToken(statePayload, user.id);

  const authorizeUrl = new URL('https://github.com/login/oauth/authorize');
  authorizeUrl.searchParams.set('client_id', credentials.clientId);
  authorizeUrl.searchParams.set('redirect_uri', redirectUri);
  authorizeUrl.searchParams.set('scope', 'repo');
  authorizeUrl.searchParams.set('state', stateNonce);
  authorizeUrl.searchParams.set('allow_signup', 'true');

  if (format === 'json') {
    const res = NextResponse.json({
      authorizeUrl: authorizeUrl.toString(),
      state: stateNonce,
      redirectUri,
    });
    res.cookies.set(OAUTH_STATE_COOKIE_NAME, encryptedState, OAUTH_STATE_COOKIE_OPTIONS);
    return res;
  }

  const res = NextResponse.redirect(authorizeUrl.toString());
  res.cookies.set(OAUTH_STATE_COOKIE_NAME, encryptedState, OAUTH_STATE_COOKIE_OPTIONS);
  return res;
}
