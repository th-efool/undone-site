import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { encryptToken } from '@/src/server/infrastructure/github/personal-workspace';

const mocks = vi.hoisted(() => ({
  getCredentials: vi.fn(),
  getRepos: vi.fn(),
  getToken: vi.fn(),
  getInstallations: vi.fn(),
  freshState: vi.fn(),
  finish: vi.fn(),
  clear: vi.fn(),
}));

vi.mock('../app/config', () => ({
  getGitHubAppCredentials: mocks.getCredentials,
  getInstallationRepos: mocks.getRepos,
  getInstallationToken: mocks.getToken,
  getUserAppInstallations: mocks.getInstallations,
  GITHUB_APP_INSTALLATION_COOKIE_NAME: 'undone_gh_app_state',
  renderAppErrorHtml: (error: string, description: string) => `${error}:${description}`,
}));
vi.mock('../app/flow', () => ({
  clearAppFlowCookie: mocks.clear,
  finishGitHubAppConnection: mocks.finish,
  isFreshAppFlowState: mocks.freshState,
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
});
