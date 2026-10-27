import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { decryptToken, encryptToken } from '@/src/server/infrastructure/github/personal-workspace';

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
  createRepo: vi.fn(),
  handleResume: vi.fn(),
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
  getManageInstallationUrl: (id: string) => `https://github.com/settings/installations/${id}`,
  tryCreateUserRepo: mocks.createRepo,
  GITHUB_APP_INSTALLATION_COOKIE_NAME: 'undone_gh_app_state',
  GITHUB_APP_INSTALLATION_COOKIE_OPTIONS: { httpOnly: true, path: '/api/personal-workspace/github/app', maxAge: 600 },
  renderAppErrorHtml: (error: string, description: string) => `${error}:${description}`,
  renderAppExistingInstallationAccessHtml: (data: { installationId: string; manageUrl: string }) =>
    `<html>Existing Installation Detected:${data.installationId}:${data.manageUrl}</html>`,
}));
vi.mock('../app/flow', () => ({
  clearAppFlowCookie: mocks.clear,
  finishGitHubAppConnection: mocks.finish,
  handleResumeInstallation: mocks.handleResume,
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
    mocks.installUrl.mockReturnValue('https://github.com/apps/undone-notes/installations/new?state=nonce');
    mocks.createRepo.mockResolvedValue(false);
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

  it('renders existing installation resolver instead of redirecting to /installations/new when 0 repos are accessible (Gap 1 Fix)', async () => {
    mocks.repos.mockResolvedValue([]); // 0 accessible repos
    mocks.createRepo.mockResolvedValue(false);

    const state = { stateNonce: 'nonce', userId: 'user-test-01', createdAt: Date.now() };
    const stateCookie = await encryptToken(JSON.stringify(state), state.userId);
    const req = new NextRequest(
      'https://undone.example/api/personal-workspace/github/app/oauth/callback?code=oauth-code&state=nonce',
      { headers: { 'x-test-user-id': state.userId, cookie: `undone_gh_app_state=${encodeURIComponent(stateCookie)}` } },
    );

    const response = await oauthCallback(req);

    // Must NOT redirect to /installations/new (#61238 / #163512)
    expect(mocks.installUrl).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain('Existing Installation Detected');
    expect(body).toContain('installation-12');

    // Cookie must store resumeInstallationId so user can resume connection
    const updatedCookie = response.cookies.get('undone_gh_app_state')?.value;
    expect(updatedCookie).toBeDefined();
    const decryptedState = JSON.parse(await decryptToken(updatedCookie!, 'user-test-01'));
    expect(decryptedState.resumeInstallationId).toBe('installation-12');
    expect(decryptedState.githubAccessToken).toBe('short-lived-user-token');
  });

  it('delegates to handleResumeInstallation when resume_installation_id is provided', async () => {
    mocks.handleResume.mockResolvedValue(NextResponse.json({ resumed: true }));

    const state = {
      stateNonce: 'nonce',
      userId: 'user-test-01',
      createdAt: Date.now(),
      githubAccessToken: 'user-token',
      githubUser: { id: 'gh-user-7', login: 'learner' },
    };
    const stateCookie = await encryptToken(JSON.stringify(state), state.userId);
    const req = new NextRequest(
      'https://undone.example/api/personal-workspace/github/app/oauth/callback?resume_installation_id=installation-12&state=nonce',
      { headers: { 'x-test-user-id': state.userId, cookie: `undone_gh_app_state=${encodeURIComponent(stateCookie)}` } },
    );

    const response = await oauthCallback(req);

    expect(mocks.handleResume).toHaveBeenCalledWith(expect.objectContaining({
      installationId: 'installation-12',
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ resumed: true });
  });

  it('redirects to /installations/new only for brand new users with 0 installations', async () => {
    mocks.installations.mockResolvedValue([]); // No installations exist

    const state = { stateNonce: 'nonce', userId: 'user-test-01', createdAt: Date.now() };
    const stateCookie = await encryptToken(JSON.stringify(state), state.userId);
    const req = new NextRequest(
      'https://undone.example/api/personal-workspace/github/app/oauth/callback?code=oauth-code&state=nonce',
      { headers: { 'x-test-user-id': state.userId, cookie: `undone_gh_app_state=${encodeURIComponent(stateCookie)}` } },
    );

    const response = await oauthCallback(req);

    expect(mocks.installUrl).toHaveBeenCalledWith('nonce');
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://github.com/apps/undone-notes/installations/new?state=nonce');
  });

  it('preserves and passes state.redirectUri into exchangeGitHubAppUserCode (RFC 6749 §4.1.3 Compliance)', async () => {
    const customRedirectUri = 'https://custom.undone.site/api/personal-workspace/github/app/callback';
    const state = {
      stateNonce: 'nonce',
      userId: 'user-test-01',
      createdAt: Date.now(),
      redirectUri: customRedirectUri,
    };
    const stateCookie = await encryptToken(JSON.stringify(state), state.userId);
    const req = new NextRequest(
      'https://custom.undone.site/api/personal-workspace/github/app/oauth/callback?code=oauth-code&state=nonce',
      { headers: { 'x-test-user-id': state.userId, cookie: `undone_gh_app_state=${encodeURIComponent(stateCookie)}` } },
    );

    const response = await oauthCallback(req);

    expect(response.status).toBe(200);
    expect(mocks.exchange).toHaveBeenCalledWith(
      'oauth-code',
      customRedirectUri,
      expect.anything(),
    );
  });
});
