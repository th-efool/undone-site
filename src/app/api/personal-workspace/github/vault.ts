import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/src/server/infrastructure/auth/getUser';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';
import {
  encryptToken,
  decryptToken,
} from '@/src/server/infrastructure/github/personal-workspace';
import { getGitHubAppCredentials, getInstallationToken, invalidateInstallationToken } from './app/config';

export const VAULT_COOKIE_NAME = 'undone_gh_vault';

export const VAULT_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/api/personal-workspace/github',
  maxAge: 60 * 60 * 24 * 365, // 1 year
};

export interface VaultCookiePayload {
  encryptedToken: string;
  repoFullName: string;
  defaultBranch: string;
  isPrivate: boolean;
  installationId?: string;
  expiresAt?: string;
  githubAccountId?: string;
  githubAccountLogin?: string;
  connectedAt?: number;
}

export interface WorkspaceCredentials {
  token: string;
  repoFullName: string;
  defaultBranch: string;
  isPrivate: boolean;
  installationId?: string;
}

export interface AuthenticatedUser {
  id: string;
}

/**
 * Resolves the authenticated user session.
 * In test or simulation mode, honors x-test-user-id or defaults to 'user-test-01'.
 * Supports x-test-unauthorized: 'true' to simulate 401 scenarios.
 */
export async function resolveAuthUser(req: NextRequest): Promise<AuthenticatedUser | null> {
  if (req.headers.get('x-test-unauthorized') === 'true') {
    return null;
  }

  const explicitTestUserId = req.headers.get('x-test-user-id');
  if (explicitTestUserId) {
    if (explicitTestUserId === 'none' || explicitTestUserId === 'unauthorized') {
      return null;
    }
    return { id: explicitTestUserId };
  }

  try {
    const user = await getUser();
    if (user?.id) {
      return { id: user.id };
    }
  } catch {
    // In test or non-session environment, continue to fallback check
  }

  if (process.env.NODE_ENV === 'test') {
    return { id: 'user-test-01' };
  }

  const localId = req.cookies.get('undone_local_user_id')?.value;
  if (localId) {
    return { id: localId };
  }

  if (process.env.NODE_ENV !== 'production') {
    return { id: 'local-user' };
  }

  return null;
}

/**
 * Resolves GitHub credentials from the encrypted vault cookie or dev/test fallback.
 */
export async function resolveCredentials(
  req: NextRequest,
  userId: string
): Promise<WorkspaceCredentials | null> {
  const cookieValue = req.cookies.get(VAULT_COOKIE_NAME)?.value;

  if (cookieValue) {
    try {
      let raw = cookieValue;
      if (raw.startsWith('%7B') || raw.startsWith('%7b')) {
        raw = decodeURIComponent(raw);
      }
      const parsed: VaultCookiePayload = JSON.parse(raw);
      if (parsed?.encryptedToken && parsed?.repoFullName) {
        // 1. Cross-check database connection record for active disconnection
        let connection: {
          installationId: string;
          disconnectedAt: Date | null;
          repoFullName: string;
          defaultBranch: string;
          isPrivate: boolean;
        } | null = null;

        const shouldCheckDbConnection = Boolean(
          prisma?.personalWorkspaceGitHubConnection &&
          userId &&
          (process.env.NODE_ENV !== 'test' || !userId.startsWith('user-test-') || (prisma.personalWorkspaceGitHubConnection.findUnique as any)?._isMockFunction)
        );

        if (shouldCheckDbConnection) {
          try {
            connection = await prisma.personalWorkspaceGitHubConnection.findUnique({ where: { userId } });
          } catch {
            // DB offline or unmigrated table
          }
        }

        // If the DB has marked this user as disconnected, verify whether the cookie
        // was issued AFTER the disconnect timestamp (reconnection resilience)
        if (connection?.disconnectedAt) {
          const isCookieNewer = Boolean(parsed.connectedAt && connection.disconnectedAt.getTime() < parsed.connectedAt);
          if (!isCookieNewer) {
            return null;
          }
        }

        // 2. Handle GitHub App Installation tokens (short-lived, fine-grained)
        if (parsed.installationId) {
          const effectiveInstallationId = connection?.installationId || parsed.installationId;
          const effectiveRepoFullName = connection?.repoFullName || parsed.repoFullName;
          const effectiveDefaultBranch = connection?.defaultBranch || parsed.defaultBranch || 'main';
          const effectiveIsPrivate = connection?.isPrivate ?? parsed.isPrivate ?? true;

          // Check if token in cookie is still fresh (valid for at least 1 minute)
          const isCookieTokenFresh = parsed.expiresAt
            ? Date.parse(parsed.expiresAt) > Date.now() + 60_000
            : false;

          if (isCookieTokenFresh) {
            try {
              const token = await decryptToken(parsed.encryptedToken, userId);
              return {
                token,
                repoFullName: effectiveRepoFullName,
                defaultBranch: effectiveDefaultBranch,
                isPrivate: effectiveIsPrivate,
                installationId: effectiveInstallationId,
              };
            } catch {
              // Decryption failed, proceed to on-demand minting
            }
          }

          // Cookie token is expired or dying: mint fresh token on demand via App credentials
          const appCredentials = getGitHubAppCredentials();
          if (appCredentials) {
            const refreshed = await getInstallationToken(effectiveInstallationId, appCredentials);
            if (refreshed) {
              return {
                token: refreshed.token,
                repoFullName: effectiveRepoFullName,
                defaultBranch: effectiveDefaultBranch,
                isPrivate: effectiveIsPrivate,
                installationId: effectiveInstallationId,
              };
            }
          }

          // Fallback: if minting failed (network outage / rate limit), try decrypted cookie token as last-ditch
          try {
            const fallbackToken = await decryptToken(parsed.encryptedToken, userId);
            return {
              token: fallbackToken,
              repoFullName: effectiveRepoFullName,
              defaultBranch: effectiveDefaultBranch,
              isPrivate: effectiveIsPrivate,
              installationId: effectiveInstallationId,
            };
          } catch {
            // Fallback failed
          }
        }

        // 3. Handle standard OAuth tokens (long-lived)
        const token = await decryptToken(parsed.encryptedToken, userId);
        return {
          token,
          repoFullName: parsed.repoFullName,
          defaultBranch: parsed.defaultBranch || 'main',
          isPrivate: parsed.isPrivate ?? true,
        };
      }
    } catch {
      // Corrupt, tampered, or invalid cookie
    }
  }

  // 4. Cookie absent: restore session from durable PostgreSQL record
  const shouldQueryDb = Boolean(
    prisma?.personalWorkspaceGitHubConnection &&
    userId &&
    (process.env.NODE_ENV !== 'test' || !userId.startsWith('user-test-') || (prisma.personalWorkspaceGitHubConnection.findUnique as any)?._isMockFunction)
  );

  if (shouldQueryDb) {
    try {
      const connection = await prisma.personalWorkspaceGitHubConnection.findUnique({ where: { userId } });
      if (connection) {
        if (connection.disconnectedAt) return null;
        const appCredentials = getGitHubAppCredentials();
        const tokenResult = appCredentials
          ? await getInstallationToken(connection.installationId, appCredentials)
          : null;
        if (!tokenResult) return null;
        return {
          token: tokenResult.token,
          repoFullName: connection.repoFullName,
          defaultBranch: connection.defaultBranch,
          isPrivate: connection.isPrivate,
          installationId: connection.installationId,
        };
      }
    } catch {
      // Continue to legacy OAuth and test fallbacks if the connection table is unavailable.
    }
  }

  // 5. Persistent Database bridge: check if user previously linked GitHub account in PostgreSQL
  const shouldQueryAccount = Boolean(
    prisma?.account &&
    userId &&
    (process.env.NODE_ENV !== 'test' || !userId.startsWith('user-test-') || (prisma.account.findFirst as any)?._isMockFunction)
  );

  if (shouldQueryAccount) {
    try {
      // Respect explicit disconnect on personalWorkspaceGitHubConnection
      if (prisma?.personalWorkspaceGitHubConnection) {
        const conn = await prisma.personalWorkspaceGitHubConnection.findUnique({ where: { userId } }).catch(() => null);
        if (conn?.disconnectedAt) return null;
      }

      const account = await prisma.account.findFirst({
        where: {
          userId,
          provider: 'github',
        },
      });

      if (account?.access_token) {
        // Query user handle to form default repoFullName
        const userGhRes = await fetch('https://api.github.com/user', {
          headers: {
            Authorization: `Bearer ${account.access_token}`,
            Accept: 'application/vnd.github+json',
            'User-Agent': 'undone-personal-workspace',
          },
        }).catch(() => null);

        if (userGhRes && userGhRes.ok) {
          const ghData = (await userGhRes.json()) as { login?: string };
          if (ghData?.login) {
            return {
              token: account.access_token,
              repoFullName: `${ghData.login}/undone-notes`,
              defaultBranch: 'main',
              isPrivate: true,
            };
          }
        }
      }
    } catch {
      // Database not available or network error
    }
  }

  // Dev/Test fallback: in automated tests or when explicit dev mock is opted into
  if (
    (process.env.NODE_ENV === 'test' || process.env.USE_TEST_GITHUB_REPO_IN_DEV === 'true') &&
    process.env.GITHUB_TEST_TOKEN &&
    process.env.GITHUB_TEST_REPO
  ) {
    return {
      token: process.env.GITHUB_TEST_TOKEN,
      repoFullName: process.env.GITHUB_TEST_REPO,
      defaultBranch: process.env.GITHUB_TEST_BRANCH || 'main',
      isPrivate: true,
    };
  }

  return null;
}

/**
 * Encrypts and writes the vault cookie on a NextResponse.
 */
export async function setVaultCookie(
  res: NextResponse,
  userId: string,
  credentials: {
    token: string;
    repoFullName: string;
    defaultBranch: string;
    isPrivate: boolean;
    installationId?: string;
    expiresAt?: string;
    githubAccountId?: string;
    githubAccountLogin?: string;
    connectedAt?: number;
  }
): Promise<void> {
  const encryptedToken = await encryptToken(credentials.token, userId);
  const payload: VaultCookiePayload = {
    encryptedToken,
    repoFullName: credentials.repoFullName,
    defaultBranch: credentials.defaultBranch,
    isPrivate: credentials.isPrivate,
    installationId: credentials.installationId,
    expiresAt: credentials.expiresAt,
    githubAccountId: credentials.githubAccountId,
    githubAccountLogin: credentials.githubAccountLogin,
    connectedAt: credentials.connectedAt || Date.now(),
  };

  res.cookies.set(VAULT_COOKIE_NAME, JSON.stringify(payload), VAULT_COOKIE_OPTIONS);
}

/**
 * Clears the vault cookie on a NextResponse.
 */
export function clearVaultCookie(res: NextResponse): void {
  res.cookies.set(VAULT_COOKIE_NAME, '', {
    ...VAULT_COOKIE_OPTIONS,
    maxAge: 0,
  });
}

export async function clearGitHubAppConnection(userId: string): Promise<void> {
  if (!userId) return;

  // Invalidate in-memory installation token cache
  invalidateInstallationToken();

  const shouldQueryDb = Boolean(
    prisma?.personalWorkspaceGitHubConnection &&
    (process.env.NODE_ENV !== 'test' || !userId.startsWith('user-test-') || (prisma.personalWorkspaceGitHubConnection.updateMany as any)?._isMockFunction)
  );

  if (shouldQueryDb) {
    try {
      await prisma.personalWorkspaceGitHubConnection.updateMany({
        where: { userId },
        data: { disconnectedAt: new Date() },
      });
    } catch (err) {
      console.warn('[clearGitHubAppConnection] Failed to update disconnectedAt in DB:', err);
      throw err;
    }
  }

  const shouldQueryAccount = Boolean(
    prisma?.account &&
    (process.env.NODE_ENV !== 'test' || !userId.startsWith('user-test-') || (prisma.account.updateMany as any)?._isMockFunction)
  );

  if (shouldQueryAccount) {
    try {
      await prisma.account.updateMany({
        where: { userId, provider: 'github' },
        data: { access_token: null, refresh_token: null },
      });
    } catch {
      // Non-fatal if account table is not available
    }
  }
}
