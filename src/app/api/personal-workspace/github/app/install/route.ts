import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { encryptToken } from '@/src/server/infrastructure/github/personal-workspace';
import { resolveAuthUser } from '../../vault';
import {
  getGitHubAppCredentials,
  getInstallationUrl,
  GITHUB_APP_INSTALLATION_COOKIE_NAME,
  GITHUB_APP_INSTALLATION_COOKIE_OPTIONS,
} from '../config';

/**
 * GET /api/personal-workspace/github/app/install
 *
 * Redirects the user to GitHub's native App installation UI.
 * GitHub renders:
 *   1. Account selector
 *   2. "Repository access: [x] Only select repositories" with repo dropdown
 *   3. Permissions breakdown (Contents: Read & Write)
 *   4. Green "Install & Authorize" button
 *
 * After the user clicks "Install & Authorize", GitHub redirects to /app/callback.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const user = await resolveAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const credentials = getGitHubAppCredentials();
  if (!credentials) {
    return NextResponse.json(
      { error: 'GitHub App credentials not configured (GITHUB_APP_ID / GITHUB_APP_PRIVATE_KEY_PATH missing)' },
      { status: 500 },
    );
  }

  // CSRF state nonce
  const stateNonce = crypto.randomBytes(32).toString('base64url');
  const statePayload = JSON.stringify({
    stateNonce,
    userId: user.id,
    createdAt: Date.now(),
  });

  const encryptedState = await encryptToken(statePayload, user.id);

  const format = req.nextUrl.searchParams.get('format')?.toLowerCase();
  const installUrl = getInstallationUrl(stateNonce);

  if (format === 'json') {
    const res = NextResponse.json({ installUrl, state: stateNonce });
    res.cookies.set(
      GITHUB_APP_INSTALLATION_COOKIE_NAME,
      encryptedState,
      GITHUB_APP_INSTALLATION_COOKIE_OPTIONS,
    );
    return res;
  }

  const res = NextResponse.redirect(installUrl);
  res.cookies.set(
    GITHUB_APP_INSTALLATION_COOKIE_NAME,
    encryptedState,
    GITHUB_APP_INSTALLATION_COOKIE_OPTIONS,
  );
  return res;
}
