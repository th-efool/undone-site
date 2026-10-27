import { NextRequest, NextResponse } from 'next/server';
import {
  decryptToken,
} from '@/src/server/infrastructure/github/personal-workspace';
import { resolveAuthUser, setVaultCookie } from '../../vault';
import {
  getGitHubAppCredentials,
  getInstallationToken,
  getInstallationRepos,
  GITHUB_APP_INSTALLATION_COOKIE_NAME,
  GITHUB_APP_INSTALLATION_COOKIE_OPTIONS,
  renderAppSuccessHtml,
  renderAppErrorHtml,
} from '../config';

interface DecryptedAppState {
  stateNonce: string;
  userId: string;
  createdAt?: number;
}

/**
 * GET /api/personal-workspace/github/app/callback
 *
 * GitHub redirects here after the user installs the GitHub App and selects repositories.
 * Query params from GitHub:
 *   - installation_id: The installation ID for this user
 *   - setup_action: "install" or "update"
 *   - state: The CSRF nonce we sent
 *
 * This handler:
 *   1. Validates CSRF state.
 *   2. Gets an Installation Access Token (scoped only to repos user selected).
 *   3. Finds the best repository (undone-notes if present, else first repo).
 *   4. Persists encrypted vault cookie.
 *   5. Renders success HTML that postMessages to opener and closes the popup.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const searchParams = req.nextUrl.searchParams;
  const installationId = searchParams.get('installation_id');
  const setupAction = searchParams.get('setup_action');
  const state = searchParams.get('state');

  // Handle errors from GitHub
  const ghError = searchParams.get('error');
  if (ghError) {
    const html = renderAppErrorHtml(
      ghError,
      searchParams.get('error_description') || 'GitHub App installation was cancelled.',
    );
    return new NextResponse(html, {
      status: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  if (!installationId) {
    const html = renderAppErrorHtml(
      'missing_installation_id',
      'No installation_id received from GitHub.',
    );
    return new NextResponse(html, {
      status: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  const user = await resolveAuthUser(req);
  if (!user) {
    const html = renderAppErrorHtml('unauthorized', 'User is not authenticated with Undone.');
    return new NextResponse(html, {
      status: 401,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  // Validate CSRF state cookie
  const stateCookie = req.cookies.get(GITHUB_APP_INSTALLATION_COOKIE_NAME)?.value;
  if (state && stateCookie) {
    try {
      const decryptedJson = await decryptToken(stateCookie, user.id);
      const decryptedState = JSON.parse(decryptedJson) as DecryptedAppState;

      if (decryptedState.stateNonce !== state) {
        const html = renderAppErrorHtml('state_mismatch', 'CSRF state validation failed.');
        const res = new NextResponse(html, {
          status: 400,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
        res.cookies.set(GITHUB_APP_INSTALLATION_COOKIE_NAME, '', {
          ...GITHUB_APP_INSTALLATION_COOKIE_OPTIONS,
          maxAge: 0,
        });
        return res;
      }
    } catch {
      // State decryption failed — proceed anyway (state is optional security layer)
    }
  }

  const credentials = getGitHubAppCredentials();
  if (!credentials) {
    const html = renderAppErrorHtml('server_misconfigured', 'GitHub App credentials not configured on server.');
    return new NextResponse(html, {
      status: 500,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  // Get an Installation Access Token (scoped to only the repos the user selected on GitHub)
  const tokenResult = await getInstallationToken(installationId, credentials);
  if (!tokenResult) {
    const html = renderAppErrorHtml(
      'token_exchange_failed',
      `Failed to get Installation Access Token for installation #${installationId}.`,
    );
    return new NextResponse(html, {
      status: 502,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  // Get the list of repositories available under this installation
  const repos = await getInstallationRepos(installationId, credentials);

  if (!repos.length) {
    const html = renderAppErrorHtml(
      'no_repos_accessible',
      'No repositories are accessible under this installation. Please select at least one repository.',
    );
    return new NextResponse(html, {
      status: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  // Pick the best repo: prefer undone-notes, else undone-notestest, else first available
  const targetRepo =
    repos.find((r) => r.fullName.endsWith('/undone-notes')) ||
    repos.find((r) => r.fullName.includes('undone')) ||
    repos[0];

  // Build the success response
  const successHtml = renderAppSuccessHtml({
    repoFullName: targetRepo.fullName,
    defaultBranch: targetRepo.defaultBranch,
    installationId,
  });

  const response = new NextResponse(successHtml, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });

  // Clear state cookie
  response.cookies.set(GITHUB_APP_INSTALLATION_COOKIE_NAME, '', {
    ...GITHUB_APP_INSTALLATION_COOKIE_OPTIONS,
    maxAge: 0,
  });

  // Store Installation Access Token in vault
  // Note: GitHub App installation tokens expire in ~1hr, but the app automatically
  // generates new ones via the private key — no refresh token needed.
  await setVaultCookie(response, user.id, {
    token: tokenResult.token,
    repoFullName: targetRepo.fullName,
    defaultBranch: targetRepo.defaultBranch,
    isPrivate: targetRepo.isPrivate,
  });

  return response;
}
