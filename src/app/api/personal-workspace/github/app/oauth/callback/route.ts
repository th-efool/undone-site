import { NextRequest, NextResponse } from 'next/server';
import { decryptToken, encryptToken } from '@/src/server/infrastructure/github/personal-workspace';
import { resolveAuthUser } from '../../../vault';
import {
  exchangeGitHubAppUserCode,
  getAppOAuthRedirectUri,
  getGitHubAppCredentials,
  getGitHubUserIdentity,
  getInstallationToken,
  getInstallationRepos,
  getUserAppInstallations,
  GITHUB_APP_INSTALLATION_COOKIE_NAME,
  GITHUB_APP_INSTALLATION_COOKIE_OPTIONS,
  getInstallationUrl,
  getManageInstallationUrl,
  renderAppErrorHtml,
  renderAppExistingInstallationAccessHtml,
  tryCreateUserRepo,
} from '../../config';
import {
  clearAppFlowCookie,
  finishGitHubAppConnection,
  handleResumeInstallation,
  isFreshAppFlowState,
} from '../../flow';
import type { AppFlowState } from '../../flow';

function errorResponse(error: string, description: string, clearCookie = true): NextResponse {
  const response = new NextResponse(renderAppErrorHtml(error, description), {
    status: 400,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
  if (clearCookie) clearAppFlowCookie(response);
  return response;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const params = req.nextUrl.searchParams;
  if (params.has('error')) {
    return errorResponse(
      params.get('error') || 'github_authorization_failed',
      params.get('error_description') || 'GitHub authorization was cancelled.',
    );
  }

  const user = await resolveAuthUser(req);
  const stateNonce = params.get('state');
  const code = params.get('code');
  const resumeInstallationId = params.get('resume_installation_id');
  const stateCookie = req.cookies.get(GITHUB_APP_INSTALLATION_COOKIE_NAME)?.value;
  if (!user || !stateNonce || !stateCookie) {
    return errorResponse('invalid_state', 'GitHub connection expired. Start Connect GitHub again.');
  }

  let state: AppFlowState;
  try {
    state = JSON.parse(await decryptToken(stateCookie, user.id)) as AppFlowState;
  } catch {
    return errorResponse('invalid_state', 'GitHub connection could not be verified. Start Connect GitHub again.');
  }
  if (!isFreshAppFlowState(state, stateNonce, user.id)) {
    return errorResponse('invalid_state', 'GitHub connection expired or could not be verified. Start Connect GitHub again.');
  }

  const appCredentials = getGitHubAppCredentials();
  if (!appCredentials?.clientSecret) {
    return errorResponse('server_misconfigured', 'GitHub App OAuth is not configured on the server.');
  }

  // Handle in-popup resume check after user updates access on GitHub
  if (resumeInstallationId) {
    return await handleResumeInstallation({
      req,
      user,
      state,
      installationId: resumeInstallationId,
      appCredentials,
    });
  }

  if (!code) {
    return errorResponse('invalid_state', 'GitHub connection code was missing. Start Connect GitHub again.');
  }

  const userToken = await exchangeGitHubAppUserCode(
    code,
    getAppOAuthRedirectUri(req),
    appCredentials,
  );
  if (!userToken) {
    return errorResponse('oauth_exchange_failed', 'GitHub did not authorize the account. Start Connect GitHub again.');
  }
  const identity = await getGitHubUserIdentity(userToken);
  if (!identity) {
    return errorResponse('github_identity_failed', 'Could not verify the GitHub account. Start Connect GitHub again.');
  }

  const installations = await getUserAppInstallations(userToken, appCredentials.appId);
  if (!installations) {
    return errorResponse('installations_lookup_failed', 'GitHub could not verify this account’s Undone App installations. Try again.');
  }

  for (const installation of installations) {
    let repos = await getInstallationRepos(installation.id, appCredentials);
    if (!repos.length) {
      // Attempt auto-creating the undone-notes repo if permitted
      const created = await tryCreateUserRepo(userToken, 'undone-notes');
      if (created) {
        repos = await getInstallationRepos(installation.id, appCredentials);
      }
    }
    if (!repos.length) continue;

    const repo = repos.find((item) => item.fullName.endsWith('/undone-notes')) ||
      repos.find((item) => item.fullName.toLowerCase().includes('undone')) || repos[0];
    const tokenResult = await getInstallationToken(installation.id, appCredentials);
    if (!tokenResult) continue;
    try {
      return await finishGitHubAppConnection(user.id, identity, installation, repo, tokenResult);
    } catch {
      return errorResponse('connection_storage_failed', 'GitHub is connected, but Undone could not save this connection. Try again.');
    }
  }

  // Gap 1 Fix: When the user already installed the app on GitHub (installations.length > 0),
  // NEVER redirect to getInstallationUrl() (/installations/new), which traps the user
  // on GitHub settings without redirecting back (#61238 / #163512).
  if (installations.length > 0) {
    const primaryInstallation = installations[0];
    const manageUrl = getManageInstallationUrl(
      primaryInstallation.id,
      primaryInstallation.accountLogin,
      primaryInstallation.accountType,
    );

    const nextState: AppFlowState = {
      ...state,
      githubAccessToken: userToken,
      githubUser: identity,
      resumeInstallationId: primaryInstallation.id,
    };

    const html = renderAppExistingInstallationAccessHtml({
      installationId: primaryInstallation.id,
      accountLogin: primaryInstallation.accountLogin,
      accountType: primaryInstallation.accountType,
      manageUrl,
      stateNonce,
    });

    const response = new NextResponse(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });

    response.cookies.set(
      GITHUB_APP_INSTALLATION_COOKIE_NAME,
      await encryptToken(JSON.stringify(nextState), user.id),
      GITHUB_APP_INSTALLATION_COOKIE_OPTIONS,
    );
    return response;
  }

  // First-time user with no existing installations: send to GitHub App install flow
  const nextState: AppFlowState = {
    ...state,
    githubAccessToken: userToken,
    githubUser: identity,
  };
  const response = NextResponse.redirect(getInstallationUrl(stateNonce));
  response.cookies.set(
    GITHUB_APP_INSTALLATION_COOKIE_NAME,
    await encryptToken(JSON.stringify(nextState), user.id),
    GITHUB_APP_INSTALLATION_COOKIE_OPTIONS,
  );
  return response;
}
