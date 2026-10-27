import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';
import { setVaultCookie } from '../vault';
import {
  GITHUB_APP_INSTALLATION_COOKIE_NAME,
  GITHUB_APP_INSTALLATION_COOKIE_OPTIONS,
  renderAppSuccessHtml,
  renderAppErrorHtml,
  renderAppExistingInstallationAccessHtml,
  getManageInstallationUrl,
  getInstallationRepos,
  getInstallationToken,
  getUserAppInstallations,
  listAppInstallations,
} from './config';
import type { GitHubAppCredentials, GitHubAppInstallation, GitHubUserIdentity } from './config';

export interface AppFlowState {
  stateNonce: string;
  userId: string;
  createdAt: number;
  redirectUri?: string;
  githubAccessToken?: string;
  githubUser?: { id: string; login: string };
  resumeInstallationId?: string;
}

export async function finishGitHubAppConnection(
  userId: string,
  identity: GitHubUserIdentity,
  installation: GitHubAppInstallation,
  repo: { fullName: string; isPrivate: boolean; defaultBranch: string },
  tokenResult: { token: string; expiresAt: string },
): Promise<NextResponse> {
  try {
    await prisma.personalWorkspaceGitHubConnection.upsert({
      where: { userId },
      create: {
        userId,
        installationId: installation.id,
        authorizedGitHubUserId: identity.id,
        authorizedGitHubUserLogin: identity.login,
        githubAccountId: installation.accountId,
        githubAccountLogin: installation.accountLogin,
        repoFullName: repo.fullName,
        defaultBranch: repo.defaultBranch,
        isPrivate: repo.isPrivate,
      },
      update: {
        disconnectedAt: null,
        installationId: installation.id,
        authorizedGitHubUserId: identity.id,
        authorizedGitHubUserLogin: identity.login,
        githubAccountId: installation.accountId,
        githubAccountLogin: installation.accountLogin,
        repoFullName: repo.fullName,
        defaultBranch: repo.defaultBranch,
        isPrivate: repo.isPrivate,
      },
    });
  } catch (dbErr) {
    console.warn('[GitHubApp] Failed to persist connection in DB (continuing with vault cookie):', dbErr);
  }

  const response = new NextResponse(
    renderAppSuccessHtml({
      repoFullName: repo.fullName,
      defaultBranch: repo.defaultBranch,
      installationId: installation.id,
      isPrivate: repo.isPrivate,
    }),
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
  response.cookies.set(GITHUB_APP_INSTALLATION_COOKIE_NAME, '', {
    ...GITHUB_APP_INSTALLATION_COOKIE_OPTIONS,
    maxAge: 0,
  });
  await setVaultCookie(response, userId, {
    token: tokenResult.token,
    repoFullName: repo.fullName,
    defaultBranch: repo.defaultBranch,
    isPrivate: repo.isPrivate,
    installationId: installation.id,
    expiresAt: tokenResult.expiresAt,
    githubAccountId: installation.accountId,
    githubAccountLogin: installation.accountLogin,
  });
  return response;
}

export async function handleResumeInstallation({
  req,
  user,
  state,
  installationId,
  appCredentials,
}: {
  req: NextRequest;
  user: { id: string };
  state: AppFlowState;
  installationId: string;
  appCredentials: GitHubAppCredentials;
}): Promise<NextResponse> {
  const isJson = req.nextUrl.searchParams.get('format') === 'json' ||
    req.headers.get('accept')?.includes('application/json');

  let targetInstallation: GitHubAppInstallation | undefined;
  let identity: GitHubUserIdentity;

  if (state.githubAccessToken && state.githubUser) {
    // OAuth mode: user token present
    const installations = await getUserAppInstallations(state.githubAccessToken, appCredentials.appId);
    targetInstallation = installations?.find((i) => i.id === installationId);
    identity = state.githubUser;
  } else if (!appCredentials.clientSecret) {
    // App-JWT mode: no clientSecret configured
    const installations = await listAppInstallations(appCredentials);
    targetInstallation = installations?.find((i) => i.id === installationId);

    // If a resumeInstallationId was bound in the cookie, verify it matches
    if (state.resumeInstallationId && state.resumeInstallationId !== installationId) {
      targetInstallation = undefined;
    }

    if (targetInstallation) {
      identity = state.githubUser || {
        id: targetInstallation.accountId,
        login: targetInstallation.accountLogin,
      };
    } else {
      identity = { id: '', login: '' };
    }
  } else {
    // Neither valid OAuth session nor App-JWT mode
    if (isJson) {
      return NextResponse.json(
        { success: false, error: 'session_expired', message: 'GitHub session expired. Please connect again.' },
        { status: 401 },
      );
    }
    const response = new NextResponse(renderAppErrorHtml('session_expired', 'GitHub session expired. Please connect again.'), {
      status: 401,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
    clearAppFlowCookie(response);
    return response;
  }

  if (!targetInstallation) {
    if (isJson) {
      return NextResponse.json(
        { success: false, error: 'installation_not_found', message: 'Installation not found or not accessible.' },
        { status: 404 },
      );
    }
    const response = new NextResponse(renderAppErrorHtml('installation_not_found', 'Installation not found or not accessible.'), {
      status: 404,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
    clearAppFlowCookie(response);
    return response;
  }

  // Check repositories accessible to this installation
  const repos = await getInstallationRepos(installationId, appCredentials);
  if (!repos.length) {
    if (isJson) {
      return NextResponse.json({
        success: false,
        error: 'no_repositories',
        message: 'No repositories accessible yet. Please select a repository on GitHub and click Save.',
      });
    }
    const manageUrl = getManageInstallationUrl(
      installationId,
      targetInstallation.accountLogin,
      targetInstallation.accountType,
    );
    return new NextResponse(
      renderAppExistingInstallationAccessHtml({
        installationId,
        accountLogin: targetInstallation.accountLogin,
        accountType: targetInstallation.accountType,
        manageUrl,
        stateNonce: state.stateNonce,
        notice: 'No repositories accessible yet. Please select a repository on GitHub and click Save.',
      }),
      { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    );
  }

  const repo = repos.find((item) => item.fullName.endsWith('/undone-notes')) ||
    repos.find((item) => item.fullName.toLowerCase().includes('undone')) || repos[0];
  const tokenResult = await getInstallationToken(installationId, appCredentials);
  if (!tokenResult) {
    if (isJson) {
      return NextResponse.json(
        { success: false, error: 'token_exchange_failed', message: 'Could not create GitHub installation token.' },
        { status: 500 },
      );
    }
    const response = new NextResponse(renderAppErrorHtml('token_exchange_failed', 'Could not create GitHub installation token.'), {
      status: 500,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
    clearAppFlowCookie(response);
    return response;
  }

  const htmlRes = await finishGitHubAppConnection(user.id, identity, targetInstallation, repo, tokenResult);
  if (isJson) {
    const jsonRes = NextResponse.json({
      success: true,
      repoFullName: repo.fullName,
      defaultBranch: repo.defaultBranch,
      isPrivate: repo.isPrivate,
    });
    for (const cookie of htmlRes.cookies.getAll()) {
      jsonRes.cookies.set(cookie.name, cookie.value, cookie);
    }
    return jsonRes;
  }

  return htmlRes;
}

export function createAppFlowState(userId: string, stateNonce: string, redirectUri?: string): AppFlowState {
  return {
    stateNonce,
    userId,
    createdAt: Date.now(),
    ...(redirectUri ? { redirectUri } : {}),
  };
}

function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function isFreshAppFlowState(
  value: { stateNonce?: string; userId?: string; createdAt?: number } | null,
  stateNonce: string | null,
  userId: string,
): value is AppFlowState {
  const now = Date.now();
  return Boolean(
    value &&
      stateNonce &&
      value.stateNonce &&
      timingSafeStringEqual(value.stateNonce, stateNonce) &&
      value.userId === userId &&
      typeof value.createdAt === 'number' &&
      value.createdAt <= now + 30_000 &&
      now - value.createdAt <= 10 * 60 * 1000,
  );
}

export function clearAppFlowCookie(response: NextResponse): void {
  response.cookies.set(GITHUB_APP_INSTALLATION_COOKIE_NAME, '', {
    ...GITHUB_APP_INSTALLATION_COOKIE_OPTIONS,
    maxAge: 0,
  });
}

export function createFlowStateNonce(): string {
  return crypto.randomBytes(32).toString('base64url');
}
