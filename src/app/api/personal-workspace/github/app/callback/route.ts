import { NextRequest, NextResponse } from 'next/server';
import { decryptToken } from '@/src/server/infrastructure/github/personal-workspace';
import { resolveAuthUser } from '../../vault';
import {
  getGitHubAppCredentials,
  getInstallationRepos,
  getInstallationToken,
  getManageInstallationUrl,
  getUserAppInstallations,
  listAppInstallations,
  GITHUB_APP_INSTALLATION_COOKIE_NAME,
  renderAppErrorHtml,
  renderAppExistingInstallationAccessHtml,
} from '../config';
import type { GitHubAppInstallation, GitHubUserIdentity } from '../config';
import {
  clearAppFlowCookie,
  finishGitHubAppConnection,
  handleResumeInstallation,
  isFreshAppFlowState,
} from '../flow';
import type { AppFlowState } from '../flow';
import { GET as oauthCallback } from '../oauth/callback/route';

function errorResponse(error: string, description: string): NextResponse {
  const response = new NextResponse(renderAppErrorHtml(error, description), {
    status: 400,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
  clearAppFlowCookie(response);
  return response;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const params = req.nextUrl.searchParams;
  const githubError = params.get('error');
  if (githubError) {
    return errorResponse(githubError, params.get('error_description') || 'GitHub App installation was cancelled.');
  }

  // Unified callback support: if OAuth code is returned without installation_id, delegate to OAuth callback
  if (params.has('code') && !params.has('installation_id')) {
    return await oauthCallback(req);
  }

  const user = await resolveAuthUser(req);
  const stateNonce = params.get('state');
  const resumeInstallationId = params.get('resume_installation_id');
  const installationId = params.get('installation_id') || resumeInstallationId;
  const setupAction = params.get('setup_action');
  const stateCookie = req.cookies.get(GITHUB_APP_INSTALLATION_COOKIE_NAME)?.value;

  if (!user || !stateNonce || !stateCookie || !installationId || !/^\d+$/.test(installationId)) {
    return errorResponse('invalid_callback', 'GitHub installation could not be verified. Start Connect GitHub again.');
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
  if (!appCredentials) {
    return errorResponse('server_misconfigured', 'GitHub App credentials are not configured on the server.');
  }

  // If this is an in-popup resume verification call, route to handleResumeInstallation
  if (resumeInstallationId) {
    return await handleResumeInstallation({
      req,
      user,
      state,
      installationId: resumeInstallationId,
      appCredentials,
    });
  }

  if (setupAction !== 'install' && setupAction !== 'update') {
    return errorResponse('invalid_action', 'Unsupported GitHub installation action.');
  }

  let installation: GitHubAppInstallation | undefined;
  let identity: GitHubUserIdentity;

  if (state.githubAccessToken && state.githubUser) {
    // OAuth mode: verify via authorized user installations
    const installations = await getUserAppInstallations(state.githubAccessToken, appCredentials.appId);
    if (!installations) {
      return errorResponse('installations_lookup_failed', 'GitHub could not verify this account’s Undone App installations. Try again.');
    }
    installation = installations.find((item) => item.id === installationId);
    identity = state.githubUser;
  } else if (!appCredentials.clientSecret) {
    // App-JWT mode: verify installation exists for this app
    const installations = await listAppInstallations(appCredentials);
    installation = installations.find((item) => item.id === installationId);
    if (installation) {
      identity = state.githubUser || { id: installation.accountId, login: installation.accountLogin };
    } else {
      return errorResponse('installation_not_authorized', 'The selected GitHub account does not have access to this Undone App installation.');
    }
  } else {
    return errorResponse('invalid_state', 'GitHub connection expired or could not be verified. Start Connect GitHub again.');
  }

  if (!installation) {
    return errorResponse('installation_not_authorized', 'The selected GitHub account does not have access to this Undone App installation.');
  }

  const repos = await getInstallationRepos(installation.id, appCredentials);
  if (!repos.length) {
    const manageUrl = getManageInstallationUrl(
      installation.id,
      installation.accountLogin,
      installation.accountType,
    );
    return new NextResponse(
      renderAppExistingInstallationAccessHtml({
        installationId: installation.id,
        accountLogin: installation.accountLogin,
        accountType: installation.accountType,
        manageUrl,
        stateNonce,
        notice: 'No repositories are available to Undone in this installation yet. Please select a repository on GitHub and save.',
      }),
      { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    );
  }

  const repo = repos.find((item) => item.fullName.endsWith('/undone-notes')) ||
    repos.find((item) => item.fullName.toLowerCase().includes('undone')) || repos[0];
  const tokenResult = await getInstallationToken(installation.id, appCredentials);
  if (!tokenResult) {
    return errorResponse('token_exchange_failed', 'Could not create a GitHub installation token. Check the App installation and reconnect.');
  }

  try {
    return await finishGitHubAppConnection(user.id, identity, installation, repo, tokenResult);
  } catch {
    return errorResponse('connection_storage_failed', 'GitHub authorized the connection, but Undone could not save it. Try again.');
  }
}
