import { NextRequest, NextResponse } from 'next/server';
import {
  decryptToken,
  GitHubGitDataClient,
} from '@/src/server/infrastructure/github/personal-workspace';
import { secureTimingSafeEqual } from '@/src/shared/personal-workspace/serialization';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';
import { resolveAuthUser, setVaultCookie } from '../../vault';
import {
  getOAuthClientCredentials,
  getOAuthRedirectUri,
  OAUTH_STATE_COOKIE_NAME,
  OAUTH_STATE_COOKIE_OPTIONS,
  renderOAuthSuccessHtml,
  renderOAuthErrorHtml,
} from '../config';

interface GitHubTokenResponse {
  access_token?: string;
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

interface GitHubUserResponse {
  login: string;
  id: number;
}

interface DecryptedOAuthState {
  stateNonce: string;
  userId: string;
  targetRepo?: string;
  createdAt?: number;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const searchParams = req.nextUrl.searchParams;
  const oauthError = searchParams.get('error');
  const oauthErrorDesc = searchParams.get('error_description');

  if (oauthError) {
    const html = renderOAuthErrorHtml(oauthError, oauthErrorDesc || undefined);
    return new NextResponse(html, {
      status: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  const user = await resolveAuthUser(req);
  if (!user) {
    const html = renderOAuthErrorHtml('unauthorized', 'User is not logged into Undone.');
    return new NextResponse(html, {
      status: 401,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  const code = searchParams.get('code');
  const state = searchParams.get('state');

  if (!code || !state) {
    const html = renderOAuthErrorHtml('invalid_request', 'Missing code or state parameters from GitHub.');
    return new NextResponse(html, {
      status: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  const stateCookie = req.cookies.get(OAUTH_STATE_COOKIE_NAME)?.value;
  if (!stateCookie) {
    const html = renderOAuthErrorHtml('state_expired', 'OAuth state cookie missing or expired. Please try connecting again.');
    return new NextResponse(html, {
      status: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  let decryptedState: DecryptedOAuthState;
  try {
    const decryptedJson = await decryptToken(stateCookie, user.id);
    decryptedState = JSON.parse(decryptedJson) as DecryptedOAuthState;
  } catch {
    const html = renderOAuthErrorHtml('invalid_state', 'Unable to decrypt OAuth state cookie. Tampering detected or session expired.');
    return new NextResponse(html, {
      status: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  if (
    decryptedState.userId !== user.id ||
    !secureTimingSafeEqual(state, decryptedState.stateNonce)
  ) {
    const html = renderOAuthErrorHtml('state_mismatch', 'OAuth state validation failed. Cross-site request forgery prevention triggered.');
    return new NextResponse(html, {
      status: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  const credentials = getOAuthClientCredentials();
  if (!credentials) {
    const html = renderOAuthErrorHtml('server_misconfigured', 'GitHub OAuth credentials not configured on server.');
    return new NextResponse(html, {
      status: 500,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  const redirectUri = getOAuthRedirectUri(req);

  // 1. Exchange code for access token
  let tokenData: GitHubTokenResponse;
  try {
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'undone-personal-workspace',
      },
      body: JSON.stringify({
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });

    tokenData = (await tokenRes.json()) as GitHubTokenResponse;
  } catch (err) {
    const html = renderOAuthErrorHtml(
      'token_exchange_failed',
      `Failed to exchange authorization code with GitHub: ${err instanceof Error ? err.message : String(err)}`
    );
    return new NextResponse(html, {
      status: 502,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  if (!tokenData.access_token) {
    const html = renderOAuthErrorHtml(
      tokenData.error || 'token_error',
      tokenData.error_description || 'GitHub did not return an access token.'
    );
    return new NextResponse(html, {
      status: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  const accessToken = tokenData.access_token;

  // 2. Fetch authenticated GitHub user identity
  let ghUser: GitHubUserResponse;
  try {
    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'undone-personal-workspace',
      },
    });

    if (!userRes.ok) {
      const errText = await userRes.text().catch(() => '');
      throw new Error(`GitHub /user returned status ${userRes.status}: ${errText}`);
    }

    ghUser = (await userRes.json()) as GitHubUserResponse;
  } catch (err) {
    const html = renderOAuthErrorHtml(
      'user_fetch_failed',
      `Failed to fetch GitHub user profile: ${err instanceof Error ? err.message : String(err)}`
    );
    return new NextResponse(html, {
      status: 502,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  // 3. Resolve target repository name
  let targetRepoFullName: string;
  if (decryptedState.targetRepo && decryptedState.targetRepo.includes('/')) {
    targetRepoFullName = decryptedState.targetRepo;
  } else {
    const repoName = decryptedState.targetRepo || 'undone-notes';
    targetRepoFullName = `${ghUser.login}/${repoName}`;
  }

  // 4. Ensure private repository exists, auto-create if missing
  let defaultBranch = 'main';
  try {
    const client = new GitHubGitDataClient({
      token: accessToken,
      repoFullName: targetRepoFullName,
    });

    try {
      const repoInfo = await client.verifyRepository();
      defaultBranch = repoInfo.defaultBranch;
    } catch (checkErr: unknown) {
      const is404 =
        (checkErr && typeof checkErr === 'object' && 'status' in checkErr && checkErr.status === 404) ||
        (checkErr instanceof Error && checkErr.message.includes('404'));

      if (is404) {
        // Automatically create the dedicated private repository
        const repoNameOnly = targetRepoFullName.split('/')[1] || 'undone-notes';
        const createRes = await fetch('https://api.github.com/user/repos', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github+json',
            'Content-Type': 'application/json',
            'User-Agent': 'undone-personal-workspace',
          },
          body: JSON.stringify({
            name: repoNameOnly,
            private: true,
            description: 'Undone Personal Workspace snapshot repository',
            auto_init: true,
          }),
        });

        if (!createRes.ok) {
          const createErrText = await createRes.text().catch(() => '');
          throw new Error(`Failed to auto-create private repository: ${createErrText}`);
        }

        const createdData = (await createRes.json()) as { default_branch?: string };
        defaultBranch = createdData.default_branch || 'main';
      } else {
        throw checkErr;
      }
    }
  } catch (repoErr) {
    const html = renderOAuthErrorHtml(
      'repo_verification_failed',
      `Could not verify or create repository '${targetRepoFullName}': ${repoErr instanceof Error ? repoErr.message : String(repoErr)}`
    );
    return new NextResponse(html, {
      status: 502,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  // 5. Persist credentials to PostgreSQL database if Prisma is available
  try {
    if (prisma?.account && user.id && process.env.NODE_ENV !== 'test' && !user.id.startsWith('user-')) {
      await prisma.account.upsert({
        where: {
          provider_providerAccountId: {
            provider: 'github',
            providerAccountId: String(ghUser.id),
          },
        },
        update: {
          access_token: accessToken,
          scope: tokenData.scope || 'repo',
          token_type: tokenData.token_type || 'bearer',
        },
        create: {
          userId: user.id,
          type: 'oauth',
          provider: 'github',
          providerAccountId: String(ghUser.id),
          access_token: accessToken,
          scope: tokenData.scope || 'repo',
          token_type: tokenData.token_type || 'bearer',
        },
      }).catch(() => {
        // Safe fallback if database table not yet initialized or in mock test mode
      });
    }
  } catch {
    // Ignore database errors, cookie fallback guarantees operation
  }

  // 6. Build success HTML response and set 1-year encrypted vault cookie
  const successHtml = renderOAuthSuccessHtml({
    repoFullName: targetRepoFullName,
    defaultBranch,
  });

  const response = new NextResponse(successHtml, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });

  // Clear state cookie
  response.cookies.set(OAUTH_STATE_COOKIE_NAME, '', {
    ...OAUTH_STATE_COOKIE_OPTIONS,
    maxAge: 0,
  });

  // Set persistent vault cookie
  await setVaultCookie(response, user.id, {
    token: accessToken,
    repoFullName: targetRepoFullName,
    defaultBranch,
    isPrivate: true,
  });

  return response;
}
