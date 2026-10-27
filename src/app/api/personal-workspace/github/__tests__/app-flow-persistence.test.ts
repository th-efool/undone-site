import { afterEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';
import { decryptToken } from '@/src/server/infrastructure/github/personal-workspace';
import { VAULT_COOKIE_NAME, VAULT_COOKIE_OPTIONS } from '../vault';
import { finishGitHubAppConnection } from '../app/flow';

describe('GitHub App connection persistence', () => {
  afterEach(() => vi.restoreAllMocks());

  it('persists installation identity and stores only an encrypted short-lived token in the vault cookie', async () => {
    const upsert = vi.spyOn(prisma.personalWorkspaceGitHubConnection, 'upsert').mockResolvedValueOnce({} as never);
    const response = await finishGitHubAppConnection(
      'user-flow-test',
      { id: 'gh-user-31', login: 'learner' },
      { id: 'installation-501', appId: '42', accountId: 'gh-org-9', accountLogin: 'study-org', accountType: 'Organization' },
      { fullName: 'study-org/undone-notes', isPrivate: true, defaultBranch: 'trunk' },
      { token: 'ghs_ephemeral-test', expiresAt: '2026-10-27T19:00:00.000Z' },
    );

    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 'user-flow-test' },
      create: expect.objectContaining({
        installationId: 'installation-501',
        authorizedGitHubUserId: 'gh-user-31',
        githubAccountId: 'gh-org-9',
        repoFullName: 'study-org/undone-notes',
      }),
      update: expect.objectContaining({ disconnectedAt: null, installationId: 'installation-501' }),
    }));

    const cookie = response.cookies.get(VAULT_COOKIE_NAME);
    expect(cookie?.httpOnly).toBe(VAULT_COOKIE_OPTIONS.httpOnly);
    const payload = JSON.parse(cookie!.value) as {
      encryptedToken: string;
      installationId: string;
      expiresAt: string;
      githubAccountLogin: string;
    };
    expect(payload.encryptedToken).not.toContain('ghs_ephemeral-test');
    expect(await decryptToken(payload.encryptedToken, 'user-flow-test')).toBe('ghs_ephemeral-test');
    expect(payload).toMatchObject({
      installationId: 'installation-501',
      expiresAt: '2026-10-27T19:00:00.000Z',
      githubAccountLogin: 'study-org',
    });
    upsert.mockRestore();
  });
});

