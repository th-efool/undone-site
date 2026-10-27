import { NextRequest, NextResponse } from 'next/server';
import { encryptToken } from '@/src/server/infrastructure/github/personal-workspace';
import { resolveAuthUser } from '../../vault';
import {
  getAppOAuthAuthorizeUrl,
  getAppOAuthRedirectUri,
  getGitHubAppCredentials,
  GITHUB_APP_INSTALLATION_COOKIE_NAME,
  GITHUB_APP_INSTALLATION_COOKIE_OPTIONS,
} from '../config';
import { getOAuthClientCredentials } from '../../oauth/config';
import { createFlowStateNonce, createAppFlowState } from '../flow';

/**
 * GET /api/personal-workspace/github/app/install
 *
 * Connect entry point:
 *   - If GitHub App is configured: authorizes the user's GitHub identity first, then
 *     reuses an accessible installation or opens GitHub's install/update screen.
 *   - If GitHub App is not configured, automatically falls back to standard
 *     OAuth (/api/personal-workspace/github/oauth/authorize) with ZERO .pem file dependency!
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const user = await resolveAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const credentials = getGitHubAppCredentials();
  if (!credentials) {
    // Zero-config fallback: check if standard OAuth is available
    const oauthCreds = getOAuthClientCredentials();
    if (oauthCreds) {
      const redirectUrl = new URL('/api/personal-workspace/github/oauth/authorize', req.url);
      const search = req.nextUrl.searchParams;
      if (search.get('repo')) redirectUrl.searchParams.set('repo', search.get('repo')!);
      if (search.get('format')) redirectUrl.searchParams.set('format', search.get('format')!);
      return NextResponse.redirect(redirectUrl);
    }

    return NextResponse.json(
      {
        error:
          'GitHub credentials not configured. Please set GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET or GITHUB_APP_PRIVATE_KEY_BASE64 in your environment variables.',
      },
      { status: 500 },
    );
  }

  // CSRF state nonce
  const stateNonce = createFlowStateNonce();
  const statePayload = JSON.stringify(createAppFlowState(user.id, stateNonce));

  const encryptedState = await encryptToken(statePayload, user.id);

  if (!credentials.clientSecret) {
    return NextResponse.json(
      { error: 'GitHub App user authorization requires GITHUB_APP_CLIENT_SECRET.' },
      { status: 500 },
    );
  }

  const format = req.nextUrl.searchParams.get('format')?.toLowerCase();
  const redirectUri = getAppOAuthRedirectUri(req);
  const authorizeUrl = getAppOAuthAuthorizeUrl(stateNonce, redirectUri, credentials.clientId);

  if (format === 'json') {
    const res = NextResponse.json({ authorizeUrl, state: stateNonce });
    res.cookies.set(
      GITHUB_APP_INSTALLATION_COOKIE_NAME,
      encryptedState,
      GITHUB_APP_INSTALLATION_COOKIE_OPTIONS,
    );
    return res;
  }

  const res = NextResponse.redirect(authorizeUrl);
  res.cookies.set(
    GITHUB_APP_INSTALLATION_COOKIE_NAME,
    encryptedState,
    GITHUB_APP_INSTALLATION_COOKIE_OPTIONS,
  );
  return res;
}
