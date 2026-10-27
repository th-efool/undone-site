import { NextRequest, NextResponse } from 'next/server';
import { decryptToken } from '@/src/server/infrastructure/github/personal-workspace';
import { resolveAuthUser } from '../../vault';
import {
  getGitHubAppCredentials,
  getInstallationRepos,
  getInstallationToken,
  getUserAppInstallations,
  GITHUB_APP_INSTALLATION_COOKIE_NAME,
  renderAppErrorHtml,
} from '../config';
import {
  clearAppFlowCookie,
  finishGitHubAppConnection,
  isFreshAppFlowState,
} from '../flow';

interface AppFlowState {
  stateNonce: string;
  userId: string;
  createdAt: number;
  githubAccessToken?: string;
  githubUser?: { id: string; login: string };
}

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

  const user = await resolveAuthUser(req);
  const stateNonce = params.get('state');
  const installationId = params.get('installation_id');
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
  if (
    !isFreshAppFlowState(state, stateNonce, user.id) ||
    !state.githubAccessToken || !state.githubUser ||
    (setupAction !== 'install' && setupAction !== 'update')
  ) {
    return errorResponse('invalid_state', 'GitHub connection expired or could not be verified. Start Connect GitHub again.');
  }

  const appCredentials = getGitHubAppCredentials();
  if (!appCredentials) {
    return errorResponse('server_misconfigured', 'GitHub App credentials are not configured on the server.');
  }

  // GitHub warns that installation_id is forgeable; accept only IDs visible to this authorized user.
  const installations = await getUserAppInstallations(state.githubAccessToken, appCredentials.appId);
  if (!installations) {
    return errorResponse('installations_lookup_failed', 'GitHub could not verify this account’s Undone App installations. Try again.');
  }
  const installation = installations.find((item) => item.id === installationId);
  if (!installation) {
    return errorResponse('installation_not_authorized', 'The selected GitHub account does not have access to this Undone App installation.');
  }

  const repos = await getInstallationRepos(installation.id, appCredentials);
  if (!repos.length) {
    return errorResponse('no_repositories', 'No repositories are available to Undone in this installation. Update repository access and try again.');
  }
  const repo = repos.find((item) => item.fullName.endsWith('/undone-notes')) ||
    repos.find((item) => item.fullName.toLowerCase().includes('undone')) || repos[0];
  const tokenResult = await getInstallationToken(installation.id, appCredentials);
  if (!tokenResult) {
    return errorResponse('token_exchange_failed', 'Could not create a GitHub installation token. Check the App installation and reconnect.');
  }

  try {
    return await finishGitHubAppConnection(user.id, state.githubUser, installation, repo, tokenResult);
  } catch {
    return errorResponse('connection_storage_failed', 'GitHub authorized the connection, but Undone could not save it. Try again.');
  }
}
