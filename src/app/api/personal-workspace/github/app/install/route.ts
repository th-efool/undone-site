import { NextRequest, NextResponse } from 'next/server';
import { encryptToken } from '@/src/server/infrastructure/github/personal-workspace';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';
import { resolveAuthUser } from '../../vault';
import {
  getAppOAuthAuthorizeUrl,
  getAppOAuthRedirectUri,
  getGitHubAppCredentials,
  getInstallationRepos,
  getInstallationToken,
  getInstallationUrl,
  getManageInstallationUrl,
  listAppInstallations,
  renderAppExistingInstallationAccessHtml,
  GITHUB_APP_INSTALLATION_COOKIE_NAME,
  GITHUB_APP_INSTALLATION_COOKIE_OPTIONS,
} from '../config';
import type { GitHubAppInstallation } from '../config';
import { getOAuthClientCredentials } from '../../oauth/config';
import { createFlowStateNonce, createAppFlowState, finishGitHubAppConnection } from '../flow';
import type { AppFlowState } from '../flow';

/**
 * GET /api/personal-workspace/github/app/install
 *
 * Connect entry point:
 *   - If GitHub App is configured with clientSecret: authorizes user's GitHub identity first via OAuth,
 *     then reuses an accessible installation or opens GitHub's install/update screen.
 *   - If GitHub App is configured without clientSecret (App-JWT mode): discovers existing installations
 *     via App JWT directly, avoiding the HTTP 500 failure.
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
  const format = req.nextUrl.searchParams.get('format')?.toLowerCase();

  // Gap 2 Fix: If GITHUB_APP_CLIENT_SECRET is missing, discover existing installations via App JWT
  if (!credentials.clientSecret) {
    const installations = await listAppInstallations(credentials);
    if (installations.length > 0) {
      // 1. Check if user already has an existing connection record in PostgreSQL
      let primaryInstallation: GitHubAppInstallation | undefined;
      if (prisma?.personalWorkspaceGitHubConnection && user.id) {
        try {
          const existingConn = await prisma.personalWorkspaceGitHubConnection.findUnique({
            where: { userId: user.id },
          });
          if (existingConn?.installationId) {
            primaryInstallation = installations.find((i) => i.id === existingConn.installationId);
          }
        } catch {
          // DB lookup failed or offline
        }
      }

      // 2. If no DB record matched, check installations for an accessible 'undone-notes' repository
      if (!primaryInstallation) {
        for (const inst of installations) {
          const candidateRepos = await getInstallationRepos(inst.id, credentials);
          if (candidateRepos.some((r) => r.fullName.endsWith('/undone-notes') || r.fullName.toLowerCase().includes('undone'))) {
            primaryInstallation = inst;
            break;
          }
        }
      }

      // 3. Fallback: single installation or first installation
      if (!primaryInstallation) {
        primaryInstallation = installations[0];
      }

      const repos = await getInstallationRepos(primaryInstallation.id, credentials);
      if (repos.length > 0) {
        const repo = repos.find((item) => item.fullName.endsWith('/undone-notes')) ||
          repos.find((item) => item.fullName.toLowerCase().includes('undone')) || repos[0];
        const tokenResult = await getInstallationToken(primaryInstallation.id, credentials);
        if (tokenResult) {
          if (format === 'json') {
            const htmlRes = await finishGitHubAppConnection(
              user.id,
              { id: primaryInstallation.accountId, login: primaryInstallation.accountLogin },
              primaryInstallation,
              repo,
              tokenResult,
            );
            const jsonRes = NextResponse.json({
              connected: true,
              repoFullName: repo.fullName,
              defaultBranch: repo.defaultBranch,
            });
            for (const cookie of htmlRes.cookies.getAll()) {
              jsonRes.cookies.set(cookie.name, cookie.value, cookie);
            }
            return jsonRes;
          }

          return await finishGitHubAppConnection(
            user.id,
            { id: primaryInstallation.accountId, login: primaryInstallation.accountLogin },
            primaryInstallation,
            repo,
            tokenResult,
          );
        }
      }

      // Existing installation with 0 repos: show in-popup access resolver
      const manageUrl = getManageInstallationUrl(
        primaryInstallation.id,
        primaryInstallation.accountLogin,
        primaryInstallation.accountType,
      );
      const html = renderAppExistingInstallationAccessHtml({
        installationId: primaryInstallation.id,
        accountLogin: primaryInstallation.accountLogin,
        accountType: primaryInstallation.accountType,
        manageUrl,
        stateNonce,
        notice: 'Existing installation found. Please grant repository access on GitHub and click Resume.',
      });
      const res = new NextResponse(html, {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
      const resolverState: AppFlowState = {
        ...createAppFlowState(user.id, stateNonce),
        resumeInstallationId: primaryInstallation.id,
        githubUser: {
          id: primaryInstallation.accountId,
          login: primaryInstallation.accountLogin,
        },
      };
      const encryptedResolverState = await encryptToken(JSON.stringify(resolverState), user.id);
      res.cookies.set(
        GITHUB_APP_INSTALLATION_COOKIE_NAME,
        encryptedResolverState,
        GITHUB_APP_INSTALLATION_COOKIE_OPTIONS,
      );
      return res;
    }

    // No installations exist yet: direct to GitHub install screen
    const installUrl = getInstallationUrl(stateNonce);
    const initialInstallState = JSON.stringify(createAppFlowState(user.id, stateNonce));
    const encryptedInitialState = await encryptToken(initialInstallState, user.id);

    if (format === 'json') {
      const res = NextResponse.json({ authorizeUrl: installUrl, state: stateNonce });
      res.cookies.set(
        GITHUB_APP_INSTALLATION_COOKIE_NAME,
        encryptedInitialState,
        GITHUB_APP_INSTALLATION_COOKIE_OPTIONS,
      );
      return res;
    }

    const res = NextResponse.redirect(installUrl);
    res.cookies.set(
      GITHUB_APP_INSTALLATION_COOKIE_NAME,
      encryptedInitialState,
      GITHUB_APP_INSTALLATION_COOKIE_OPTIONS,
    );
    return res;
  }

  const statePayload = JSON.stringify(createAppFlowState(user.id, stateNonce));
  const encryptedState = await encryptToken(statePayload, user.id);
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
