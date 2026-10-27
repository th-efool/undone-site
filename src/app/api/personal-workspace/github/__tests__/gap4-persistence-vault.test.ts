import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';
import { encryptToken } from '@/src/server/infrastructure/github/personal-workspace';
import { finishGitHubAppConnection } from '../app/flow';
import { resolveCredentials, VAULT_COOKIE_NAME, clearGitHubAppConnection } from '../vault';
import { POST as postDisconnect } from '../disconnect/route';
import { GET as getStatus } from '../status/route';
import * as configMod from '../app/config';

const clientMocks = vi.hoisted(() => ({
  verifyRepository: vi.fn(),
}));

vi.mock('@/src/server/infrastructure/github/personal-workspace', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/src/server/infrastructure/github/personal-workspace')>();
  return {
    ...actual,
    GitHubGitDataClient: class {
      verifyRepository = clientMocks.verifyRepository;
    },
  };
});

describe('Gap 4: Database Persistence, Foreign-Key Resilience, Vault Tokens & Disconnect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Foreign Key (P2003) Resilience in flow.ts', () => {
    it('gracefully tolerates P2003 Foreign Key error and sets functional vault cookie', async () => {
      const p2003Error = new Error('Foreign key constraint failed on the field: userId');
      (p2003Error as any).code = 'P2003';
      vi.spyOn(prisma.personalWorkspaceGitHubConnection, 'upsert').mockRejectedValueOnce(p2003Error);

      const response = await finishGitHubAppConnection(
        'nonexistent-guest-user',
        { id: 'gh-123', login: 'octocat' },
        { id: 'inst-999', appId: '1', accountId: 'gh-123', accountLogin: 'octocat', accountType: 'User' },
        { fullName: 'octocat/notes', isPrivate: true, defaultBranch: 'main' },
        { token: 'ghs_shortlived', expiresAt: new Date(Date.now() + 3600_000).toISOString() },
      );

      expect(response.status).toBe(200);
      const cookie = response.cookies.get(VAULT_COOKIE_NAME);
      expect(cookie).toBeDefined();
      const payload = JSON.parse(cookie!.value);
      expect(payload.installationId).toBe('inst-999');
      expect(typeof payload.connectedAt).toBe('number');
    });
  });

  describe('2. Disconnect Resilience in disconnect/route.ts', () => {
    it('clears vault cookie and returns 200 even when database throws an error', async () => {
      vi.spyOn(prisma.personalWorkspaceGitHubConnection, 'updateMany').mockRejectedValueOnce(
        new Error('Database connection timeout')
      );

      const req = new NextRequest('http://localhost:3000/api/personal-workspace/github/disconnect', {
        method: 'POST',
        headers: { 'x-test-user-id': 'user-disconnect-test' },
      });

      const res = await postDisconnect(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.connected).toBe(false);

      const clearedCookie = res.cookies.get(VAULT_COOKIE_NAME);
      expect(clearedCookie).toBeDefined();
      expect(clearedCookie?.maxAge).toBe(0);
    });

    it('clears OAuth access token in prisma.account on disconnect', async () => {
      const updateConn = vi.spyOn(prisma.personalWorkspaceGitHubConnection, 'updateMany').mockResolvedValueOnce({ count: 1 } as never);
      const updateAccount = vi.spyOn(prisma.account, 'updateMany').mockResolvedValueOnce({ count: 1 } as never);

      await clearGitHubAppConnection('oauth-user-123');

      expect(updateConn).toHaveBeenCalledWith(expect.objectContaining({
        where: { userId: 'oauth-user-123' },
        data: expect.objectContaining({ disconnectedAt: expect.any(Date) }),
      }));
      expect(updateAccount).toHaveBeenCalledWith(expect.objectContaining({
        where: { userId: 'oauth-user-123', provider: 'github' },
        data: { access_token: null, refresh_token: null },
      }));
    });
  });

  describe('3. On-Demand Installation Token Minting & Cache Handling', () => {
    it('refreshes expired installation token from cookie using getInstallationToken', async () => {
      const expiredDate = new Date(Date.now() - 1000).toISOString();
      const encryptedToken = await encryptToken('ghs_expired_token', 'user-refresh-test');
      const payload = {
        encryptedToken,
        repoFullName: 'octocat/notes',
        defaultBranch: 'main',
        isPrivate: true,
        installationId: 'inst-refresh',
        expiresAt: expiredDate,
      };

      vi.spyOn(configMod, 'getGitHubAppCredentials').mockReturnValue({
        appId: '1', clientId: 'c1', clientSecret: 's1', privateKeyPem: 'pem',
      });
      const mintSpy = vi.spyOn(configMod, 'getInstallationToken').mockResolvedValue({
        token: 'ghs_fresh_minted_token',
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      });
      vi.spyOn(prisma.personalWorkspaceGitHubConnection, 'findUnique').mockResolvedValueOnce(null);

      const req = new NextRequest('http://localhost:3000/api/personal-workspace/github/status', {
        headers: { cookie: `${VAULT_COOKIE_NAME}=${encodeURIComponent(JSON.stringify(payload))}` },
      });

      const creds = await resolveCredentials(req, 'user-refresh-test');
      expect(creds?.token).toBe('ghs_fresh_minted_token');
      expect(mintSpy).toHaveBeenCalledWith('inst-refresh', expect.anything());
    });
  });

  describe('4. Cookie / DB Recovery & DisconnectedAt Enforcement', () => {
    it('restores workspace session from PostgreSQL when cookie is absent', async () => {
      vi.spyOn(prisma.personalWorkspaceGitHubConnection, 'findUnique').mockResolvedValueOnce({
        installationId: 'inst-db-restore',
        repoFullName: 'octocat/restored-notes',
        defaultBranch: 'main',
        isPrivate: true,
        disconnectedAt: null,
      } as never);
      vi.spyOn(configMod, 'getGitHubAppCredentials').mockReturnValue({
        appId: '1', clientId: 'c1', clientSecret: 's1', privateKeyPem: 'pem',
      });
      vi.spyOn(configMod, 'getInstallationToken').mockResolvedValueOnce({
        token: 'ghs_db_minted',
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      });

      const req = new NextRequest('http://localhost:3000/api/personal-workspace/github/status');
      const creds = await resolveCredentials(req, 'user-restore-test');

      expect(creds).not.toBeNull();
      expect(creds?.token).toBe('ghs_db_minted');
      expect(creds?.repoFullName).toBe('octocat/restored-notes');
    });

    it('returns null when database row is marked with disconnectedAt and cookie is older', async () => {
      vi.spyOn(prisma.personalWorkspaceGitHubConnection, 'findUnique').mockResolvedValueOnce({
        installationId: 'inst-disconnected',
        repoFullName: 'octocat/notes',
        defaultBranch: 'main',
        isPrivate: true,
        disconnectedAt: new Date(Date.now() - 5000),
      } as never);

      const encryptedToken = await encryptToken('ghs_active', 'user-disconnected-test');
      const payload = {
        encryptedToken,
        repoFullName: 'octocat/notes',
        defaultBranch: 'main',
        isPrivate: true,
        installationId: 'inst-disconnected',
        connectedAt: Date.now() - 10000, // issued BEFORE disconnect
      };

      const req = new NextRequest('http://localhost:3000/api/personal-workspace/github/status', {
        headers: { cookie: `${VAULT_COOKIE_NAME}=${encodeURIComponent(JSON.stringify(payload))}` },
      });

      const creds = await resolveCredentials(req, 'user-disconnected-test');
      expect(creds).toBeNull();
    });

    it('honors cookie if reconnected AFTER disconnectedAt timestamp', async () => {
      vi.spyOn(prisma.personalWorkspaceGitHubConnection, 'findUnique').mockResolvedValueOnce({
        installationId: 'inst-old',
        repoFullName: 'octocat/notes',
        defaultBranch: 'main',
        isPrivate: true,
        disconnectedAt: new Date(Date.now() - 10000), // disconnected 10s ago
      } as never);

      const encryptedToken = await encryptToken('ghs_reconnected', 'user-reconnected-test');
      const payload = {
        encryptedToken,
        repoFullName: 'octocat/notes',
        defaultBranch: 'main',
        isPrivate: true,
        installationId: 'inst-new',
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
        connectedAt: Date.now(), // connected NOW (after disconnect)
      };

      const req = new NextRequest('http://localhost:3000/api/personal-workspace/github/status', {
        headers: { cookie: `${VAULT_COOKIE_NAME}=${encodeURIComponent(JSON.stringify(payload))}` },
      });

      const creds = await resolveCredentials(req, 'user-reconnected-test');
      expect(creds).not.toBeNull();
      expect(creds?.token).toBe('ghs_reconnected');
    });

    it('re-seeds the vault cookie in /status when credentials are restored from DB', async () => {
      vi.spyOn(prisma.personalWorkspaceGitHubConnection, 'findUnique').mockResolvedValueOnce({
        installationId: 'inst-reseed',
        repoFullName: 'octocat/reseed-notes',
        defaultBranch: 'main',
        isPrivate: true,
        disconnectedAt: null,
      } as never);
      vi.spyOn(configMod, 'getGitHubAppCredentials').mockReturnValue({
        appId: '1', clientId: 'c1', clientSecret: 's1', privateKeyPem: 'pem',
      });
      vi.spyOn(configMod, 'getInstallationToken').mockResolvedValueOnce({
        token: 'ghs_reseed_token',
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      });

      clientMocks.verifyRepository.mockResolvedValueOnce({
        fullName: 'octocat/reseed-notes',
        defaultBranch: 'main',
        isPrivate: true,
      });

      const req = new NextRequest('http://localhost:3000/api/personal-workspace/github/status', {
        headers: { 'x-test-user-id': 'user-reseed-test' },
      });

      const res = await getStatus(req);
      expect(res.status).toBe(200);
      const reseededCookie = res.cookies.get(VAULT_COOKIE_NAME);
      expect(reseededCookie).toBeDefined();
      const payload = JSON.parse(reseededCookie!.value);
      expect(payload.repoFullName).toBe('octocat/reseed-notes');
    });
  });
});
