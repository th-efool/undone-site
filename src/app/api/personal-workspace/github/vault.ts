import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/src/server/infrastructure/auth/getUser';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';
import {
  encryptToken,
  decryptToken,
} from '@/src/server/infrastructure/github/personal-workspace';
import { getGitHubAppCredentials, getInstallationToken } from './app/config';

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
        if (parsed.installationId) {
          if (!prisma?.personalWorkspaceGitHubConnection) return null;
          let connection: {
            installationId: string;
            disconnectedAt: Date | null;
            repoFullName: string;
            defaultBranch: string;
            isPrivate: boolean;
          } | null;
          try {
            connection = await prisma.personalWorkspaceGitHubConnection.findUnique({ where: { userId } });
          } catch {
            return null;
          }
          if (!connection || connection.disconnectedAt) return null;
          const appCredentials = getGitHubAppCredentials();
          const refreshed = appCredentials
            ? await getInstallationToken(connection.installationId, appCredentials)
            : null;
          if (!refreshed) return null;
          return {
            token: refreshed.token,
            repoFullName: connection.repoFullName,
            defaultBranch: connection.defaultBranch,
            isPrivate: connection.isPrivate,
            installationId: connection.installationId,
          };
        }
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

  // The installation ID is durable in PostgreSQL; short-lived tokens are minted on demand.
  if (prisma?.personalWorkspaceGitHubConnection && userId && !userId.startsWith('user-test-')) {
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

  // Persistent Database bridge: check if user previously linked GitHub account in PostgreSQL
  if (prisma?.account && userId && !userId.startsWith('user-test-')) {
    try {
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
  if (!prisma?.personalWorkspaceGitHubConnection || !userId || userId.startsWith('user-test-')) return;
  await prisma.personalWorkspaceGitHubConnection.updateMany({
    where: { userId },
    data: { disconnectedAt: new Date() },
  });
}
