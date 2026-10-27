import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';
import { setVaultCookie } from '../vault';
import { GITHUB_APP_INSTALLATION_COOKIE_NAME, GITHUB_APP_INSTALLATION_COOKIE_OPTIONS, renderAppSuccessHtml } from './config';
import type { GitHubAppInstallation, GitHubUserIdentity } from './config';

export async function finishGitHubAppConnection(
  userId: string,
  identity: GitHubUserIdentity,
  installation: GitHubAppInstallation,
  repo: { fullName: string; isPrivate: boolean; defaultBranch: string },
  tokenResult: { token: string; expiresAt: string },
): Promise<NextResponse> {
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

export function createAppFlowState(userId: string, stateNonce: string) {
  return { stateNonce, userId, createdAt: Date.now() };
}

export function isFreshAppFlowState(
  value: { stateNonce?: string; userId?: string; createdAt?: number } | null,
  stateNonce: string | null,
  userId: string,
): value is { stateNonce: string; userId: string; createdAt: number } {
  const now = Date.now();
  return Boolean(
    value && stateNonce && value.stateNonce === stateNonce && value.userId === userId &&
    typeof value.createdAt === 'number' && value.createdAt <= now + 30_000 && now - value.createdAt <= 10 * 60 * 1000,
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
