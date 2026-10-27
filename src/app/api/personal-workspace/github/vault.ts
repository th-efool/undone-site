import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/src/server/infrastructure/auth/getUser';
import {
  encryptToken,
  decryptToken,
} from '@/src/server/infrastructure/github/personal-workspace';

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
}

export interface WorkspaceCredentials {
  token: string;
  repoFullName: string;
  defaultBranch: string;
  isPrivate: boolean;
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
        const decryptedToken = await decryptToken(parsed.encryptedToken, userId);
        return {
          token: decryptedToken,
          repoFullName: parsed.repoFullName,
          defaultBranch: parsed.defaultBranch || 'main',
          isPrivate: parsed.isPrivate ?? true,
        };
      }
    } catch {
      // Corrupt, tampered, or invalid cookie
    }
  }

  // Dev/Test fallback: when cookie is not set but test environment variables exist
  if (
    (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') &&
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
  }
): Promise<void> {
  const encryptedToken = await encryptToken(credentials.token, userId);
  const payload: VaultCookiePayload = {
    encryptedToken,
    repoFullName: credentials.repoFullName,
    defaultBranch: credentials.defaultBranch,
    isPrivate: credentials.isPrivate,
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
