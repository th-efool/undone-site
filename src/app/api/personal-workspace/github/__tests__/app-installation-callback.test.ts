import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { encryptToken } from '@/src/server/infrastructure/github/personal-workspace';

const mocks = vi.hoisted(() => ({
  getCredentials: vi.fn(),
  getRepos: vi.fn(),
  getToken: vi.fn(),
  getInstallations: vi.fn(),
  exchange: vi.fn(),
  identity: vi.fn(),
  getRedirectUri: vi.fn(),
  freshState: vi.fn(),
  finish: vi.fn(),
  clear: vi.fn(),
  handleResume: vi.fn(),
  oauthCallback: vi.fn(),
}));

vi.mock('../app/config', () => ({
  getGitHubAppCredentials: mocks.getCredentials,
  getInstallationRepos: mocks.getRepos,
  getInstallationToken: mocks.getToken,
  getUserAppInstallations: mocks.getInstallations,
  exchangeGitHubAppUserCode: mocks.exchange,
  getGitHubUserIdentity: mocks.identity,
  getAppOAuthRedirectUri: mocks.getRedirectUri,
  getManageInstallationUrl: (id: string) => `https://github.com/settings/installations/${id}`,
  GITHUB_APP_INSTALLATION_COOKIE_NAME: 'undone_gh_app_state',
  renderAppErrorHtml: (error: string, description: string) => `${error}:${description}`,
  renderAppExistingInstallationAccessHtml: (data: { installationId: string }) =>
    `<html>Existing Installation Detected:${data.installationId}</html>`,
}));
vi.mock('../app/flow', () => ({
  clearAppFlowCookie: mocks.clear,
  finishGitHubAppConnection: mocks.finish,
  handleResumeInstallation: mocks.handleResume,
  isFreshAppFlowState: mocks.freshState,
}));
vi.mock('../app/oauth/callback/route', () => ({
  GET: mocks.oauthCallback,
}));

import { GET as installationCallback } from '../app/callback/route';

describe('GitHub App installation callback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.freshState.mockReturnValue(true);
    mocks.getCredentials.mockReturnValue({ appId: '42', clientId: 'client', clientSecret: 'secret', privateKeyPem: 'key' });
    mocks.getInstallations.mockResolvedValue([
      { id: '123', appId: '42', accountId: '5', accountLogin: 'allowed-owner', accountType: 'User' },
    ]);
  });

  it('rejects a forged installation_id that the authorized GitHub user cannot access', async () => {
    const state = {
      stateNonce: 'state-nonce',
      userId: 'user-test-01',
      createdAt: Date.now(),
      githubAccessToken: 'short-lived-user-token',
      githubUser: { id: '5', login: 'allowed-owner' },
    };
    const stateCookie = await encryptToken(JSON.stringify(state), state.userId);
    const req = new NextRequest(
      'http://localhost:3000/api/personal-workspace/github/app/callback?installation_id=456&setup_action=update&state=state-nonce',
      {
        headers: {
          'x-test-user-id': state.userId,
          cookie: `undone_gh_app_state=${encodeURIComponent(stateCookie)}`,
        },
      },
    );

    const response = await installationCallback(req);

    expect(response.status).toBe(400);
    expect(await response.text()).toContain('installation_not_authorized');
    expect(mocks.getRepos).not.toHaveBeenCalled();
    expect(mocks.getToken).not.toHaveBeenCalled();
    expect(mocks.finish).not.toHaveBeenCalled();
  });

  it('renders existing installation resolver when authorized installation has 0 repos', async () => {
    mocks.getRepos.mockResolvedValue([]);
    const state = {
      stateNonce: 'state-nonce',
      userId: 'user-test-01',
      createdAt: Date.now(),
      githubAccessToken: 'short-lived-user-token',
      githubUser: { id: '5', login: 'allowed-owner' },
    };
    const stateCookie = await encryptToken(JSON.stringify(state), state.userId);
    const req = new NextRequest(
      'http://localhost:3000/api/personal-workspace/github/app/callback?installation_id=123&setup_action=update&state=state-nonce',
      {
        headers: {
          'x-test-user-id': state.userId,
          cookie: `undone_gh_app_state=${encodeURIComponent(stateCookie)}`,
        },
      },
    );

    const response = await installationCallback(req);

    expect(response.status).toBe(200);
    expect(await response.text()).toContain('Existing Installation Detected:123');
  });

  it('delegates to oauthCallback when OAuth code arrives without installation_id (Gap 3 Unified Callback)', async () => {
    mocks.oauthCallback.mockResolvedValue(NextResponse.json({ oauthDelegated: true }));
    const req = new NextRequest(
      'http://localhost:3000/api/personal-workspace/github/app/callback?code=oauth-code&state=state-nonce',
    );

    const response = await installationCallback(req);

    expect(mocks.oauthCallback).toHaveBeenCalledWith(req);
    expect(await response.json()).toEqual({ oauthDelegated: true });
  });

  it('handles dual code + installation_id by exchanging code on-the-fly and completing connection (Gap 3 Fix)', async () => {
    mocks.exchange.mockResolvedValue('exchanged-user-token');
    mocks.identity.mockResolvedValue({ id: 'gh-user-99', login: 'dual-installer' });
    mocks.getInstallations.mockResolvedValue([
      { id: '789', appId: '42', accountId: 'gh-user-99', accountLogin: 'dual-installer', accountType: 'User' },
    ]);
    mocks.getRepos.mockResolvedValue([
      { fullName: 'dual-installer/undone-notes', isPrivate: true, defaultBranch: 'main' },
    ]);
    mocks.getToken.mockResolvedValue({ token: 'ghs-installation-token', expiresAt: '2026-10-27T22:00:00Z' });
    mocks.finish.mockResolvedValue(NextResponse.json({ connected: true }));

    const state = {
      stateNonce: 'state-nonce',
      userId: 'user-dual-01',
      createdAt: Date.now(),
      // Note: githubAccessToken is absent because user went directly to GitHub install
      redirectUri: 'https://undone.example/api/personal-workspace/github/app/oauth/callback',
    };
    const stateCookie = await encryptToken(JSON.stringify(state), state.userId);
    const req = new NextRequest(
      'http://localhost:3000/api/personal-workspace/github/app/callback?installation_id=789&code=dual-flow-code&setup_action=install&state=state-nonce',
      {
        headers: {
          'x-test-user-id': state.userId,
          cookie: `undone_gh_app_state=${encodeURIComponent(stateCookie)}`,
        },
      },
    );

    const response = await installationCallback(req);

    expect(mocks.exchange).toHaveBeenCalledWith(
      'dual-flow-code',
      'https://undone.example/api/personal-workspace/github/app/oauth/callback',
      expect.anything(),
    );
    expect(mocks.identity).toHaveBeenCalledWith('exchanged-user-token');
    expect(mocks.getInstallations).toHaveBeenCalledWith('exchanged-user-token', '42');
    expect(mocks.finish).toHaveBeenCalledWith(
      state.userId,
      { id: 'gh-user-99', login: 'dual-installer' },
      { id: '789', appId: '42', accountId: 'gh-user-99', accountLogin: 'dual-installer', accountType: 'User' },
      { fullName: 'dual-installer/undone-notes', isPrivate: true, defaultBranch: 'main' },
      { token: 'ghs-installation-token', expiresAt: '2026-10-27T22:00:00Z' },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ connected: true });
  });

  it('accepts valid installation_id even if setup_action is omitted (Gap 3 Compatibility)', async () => {
    mocks.getRepos.mockResolvedValue([
      { fullName: 'allowed-owner/undone-notes', isPrivate: true, defaultBranch: 'main' },
    ]);
    mocks.getToken.mockResolvedValue({ token: 'ghs-token', expiresAt: '2026-10-27T22:00:00Z' });
    mocks.finish.mockResolvedValue(NextResponse.json({ connected: true }));

    const state = {
      stateNonce: 'state-nonce',
      userId: 'user-test-01',
      createdAt: Date.now(),
      githubAccessToken: 'short-lived-user-token',
      githubUser: { id: '5', login: 'allowed-owner' },
    };
    const stateCookie = await encryptToken(JSON.stringify(state), state.userId);
    // Notice: no setup_action in query
    const req = new NextRequest(
      'http://localhost:3000/api/personal-workspace/github/app/callback?installation_id=123&state=state-nonce',
      {
        headers: {
          'x-test-user-id': state.userId,
          cookie: `undone_gh_app_state=${encodeURIComponent(stateCookie)}`,
        },
      },
    );

    const response = await installationCallback(req);

    expect(response.status).toBe(200);
    expect(mocks.finish).toHaveBeenCalled();
  });

  it('rejects unsupported setup_action', async () => {
    const state = {
      stateNonce: 'state-nonce',
      userId: 'user-test-01',
      createdAt: Date.now(),
      githubAccessToken: 'short-lived-user-token',
      githubUser: { id: '5', login: 'allowed-owner' },
    };
    const stateCookie = await encryptToken(JSON.stringify(state), state.userId);
    const req = new NextRequest(
      'http://localhost:3000/api/personal-workspace/github/app/callback?installation_id=123&setup_action=delete&state=state-nonce',
      {
        headers: {
          'x-test-user-id': state.userId,
          cookie: `undone_gh_app_state=${encodeURIComponent(stateCookie)}`,
        },
      },
    );

    const response = await installationCallback(req);

    expect(response.status).toBe(400);
    expect(await response.text()).toContain('invalid_action');
  });
});
