import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { encryptToken } from '@/src/server/infrastructure/github/personal-workspace';

const mocks = vi.hoisted(() => ({
  exchange: vi.fn(),
  identity: vi.fn(),
  installations: vi.fn(),
  repos: vi.fn(),
  token: vi.fn(),
  installUrl: vi.fn(),
  finish: vi.fn(),
  fresh: vi.fn(),
  clear: vi.fn(),
}));

vi.mock('../app/config', () => ({
  exchangeGitHubAppUserCode: mocks.exchange,
  getAppOAuthRedirectUri: () => 'https://undone.example/api/personal-workspace/github/app/oauth/callback',
  getGitHubAppCredentials: () => ({ appId: '42', clientId: 'client', clientSecret: 'secret', privateKeyPem: 'key' }),
  getGitHubUserIdentity: mocks.identity,
  getUserAppInstallations: mocks.installations,
  getInstallationRepos: mocks.repos,
  getInstallationToken: mocks.token,
  getInstallationUrl: mocks.installUrl,
  GITHUB_APP_INSTALLATION_COOKIE_NAME: 'undone_gh_app_state',
  GITHUB_APP_INSTALLATION_COOKIE_OPTIONS: { httpOnly: true, path: '/api/personal-workspace/github/app', maxAge: 600 },
  renderAppErrorHtml: (error: string, description: string) => `${error}:${description}`,
}));
vi.mock('../app/flow', () => ({
  clearAppFlowCookie: mocks.clear,
  finishGitHubAppConnection: mocks.finish,
  isFreshAppFlowState: mocks.fresh,
}));

import { GET as oauthCallback } from '../app/oauth/callback/route';

describe('GitHub App OAuth callback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fresh.mockReturnValue(true);
    mocks.exchange.mockResolvedValue('short-lived-user-token');
    mocks.identity.mockResolvedValue({ id: 'gh-user-7', login: 'learner' });
    mocks.installations.mockResolvedValue([
      { id: 'installation-12', appId: '42', accountId: 'gh-user-7', accountLogin: 'learner', accountType: 'User' },
    ]);
    mocks.repos.mockResolvedValue([
      { fullName: 'learner/undone-notes', isPrivate: true, defaultBranch: 'main' },
    ]);
    mocks.token.mockResolvedValue({ token: 'ghs-token', expiresAt: '2026-10-27T19:00:00Z' });
    mocks.finish.mockResolvedValue(NextResponse.json({ connected: true }));
  });

  it('reuses an installation already accessible to the selected GitHub account', async () => {
    const state = { stateNonce: 'nonce', userId: 'user-test-01', createdAt: Date.now() };
    const stateCookie = await encryptToken(JSON.stringify(state), state.userId);
    const req = new NextRequest(
      'https://undone.example/api/personal-workspace/github/app/oauth/callback?code=oauth-code&state=nonce',
      { headers: { 'x-test-user-id': state.userId, cookie: `undone_gh_app_state=${encodeURIComponent(stateCookie)}` } },
    );

    const response = await oauthCallback(req);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ connected: true });
    expect(mocks.installUrl).not.toHaveBeenCalled();
    expect(mocks.finish).toHaveBeenCalledWith(
      state.userId,
      { id: 'gh-user-7', login: 'learner' },
      { id: 'installation-12', appId: '42', accountId: 'gh-user-7', accountLogin: 'learner', accountType: 'User' },
      { fullName: 'learner/undone-notes', isPrivate: true, defaultBranch: 'main' },
      { token: 'ghs-token', expiresAt: '2026-10-27T19:00:00Z' },
    );
  });
});
