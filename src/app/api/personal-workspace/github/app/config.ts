import fs from 'fs';
import crypto from 'node:crypto';
import https from 'node:https';

export const GITHUB_APP_INSTALLATION_COOKIE_NAME = 'undone_gh_app_state';
export const GITHUB_APP_INSTALLATION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/api/personal-workspace/github/app',
  maxAge: 60 * 10, // 10 minutes
};

export interface GitHubAppCredentials {
  appId: string;
  clientId: string;
  clientSecret: string;
  privateKeyPem: string;
}

/**
 * Loads GitHub App credentials from env vars. Returns null if not configured.
 */
export function getGitHubAppCredentials(): GitHubAppCredentials | null {
  const appId = process.env.GITHUB_APP_ID;
  const clientId = process.env.GITHUB_APP_CLIENT_ID;
  const clientSecret = process.env.GITHUB_APP_CLIENT_SECRET;
  const keyPath = process.env.GITHUB_APP_PRIVATE_KEY_PATH;

  if (!appId || !clientId) return null;

  let privateKeyPem = '';

  // 1. Direct Base64 env var (gold standard for Vercel, Docker, CI - zero .pem file dependency)
  if (process.env.GITHUB_APP_PRIVATE_KEY_BASE64) {
    try {
      privateKeyPem = Buffer.from(
        process.env.GITHUB_APP_PRIVATE_KEY_BASE64.trim(),
        'base64',
      ).toString('utf8');
    } catch {
      // ignore decode error
    }
  }

  // 2. Direct PEM string env var with escaped or raw newlines
  if (!privateKeyPem && process.env.GITHUB_APP_PRIVATE_KEY) {
    privateKeyPem = process.env.GITHUB_APP_PRIVATE_KEY.replace(/\\n/g, '\n').trim();
  }

  // 3. Optional local file path fallback if explicitly configured and exists on disk
  if (!privateKeyPem && keyPath) {
    try {
      if (fs.existsSync(keyPath)) {
        privateKeyPem = fs.readFileSync(keyPath, 'utf8');
      }
    } catch {
      // ignore file error
    }
  }

  if (!privateKeyPem || !privateKeyPem.includes('BEGIN')) return null;

  return {
    appId,
    clientId,
    clientSecret: clientSecret || '',
    privateKeyPem,
  };
}

/**
 * Generates a signed RS256 JWT for authenticating as the GitHub App.
 * Valid for 10 minutes.
 */
export function generateAppJWT(credentials: GitHubAppCredentials): string {
  const now = Math.floor(Date.now() / 1000);

  const headerB64 = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
    .toString('base64url');
  const payloadB64 = Buffer.from(
    JSON.stringify({ iat: now - 60, exp: now + 10 * 60, iss: credentials.appId }),
  ).toString('base64url');

  const signing = `${headerB64}.${payloadB64}`;
  const signature = crypto
    .createSign('RSA-SHA256')
    .update(signing)
    .sign(credentials.privateKeyPem, 'base64url');

  return `${signing}.${signature}`;
}

function httpsRequest<T>(
  options: https.RequestOptions,
  postData?: string,
  retries = 3
): Promise<{ status: number; data: T | null }> {
  return new Promise((resolve, reject) => {
    function attempt(remaining: number) {
      const mergedOptions: https.RequestOptions = {
        family: 4,
        timeout: 8000,
        ...options,
      };

      const req = https.request(mergedOptions, (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(body) as T;
            resolve({ status: res.statusCode || 200, data: parsed });
          } catch {
            resolve({ status: res.statusCode || 200, data: null });
          }
        });
      });

      req.on('timeout', () => {
        req.destroy(new Error('GitHub API request timed out'));
      });

      req.on('error', (err) => {
        if (remaining > 1) {
          setTimeout(() => attempt(remaining - 1), 600);
        } else {
          reject(err);
        }
      });

      if (postData) {
        req.write(postData);
      }
      req.end();
    }

    attempt(retries);
  });
}

/**
 * Exchanges a GitHub App installation ID for an Installation Access Token.
 * This token has fine-grained access only to the repositories the user selected.
 */
export async function getInstallationToken(
  installationId: string,
  credentials: GitHubAppCredentials,
): Promise<{ token: string; expiresAt: string } | null> {
  const jwt = generateAppJWT(credentials);

  try {
    const { status, data } = await httpsRequest<{ token?: string; expires_at?: string }>({
      hostname: 'api.github.com',
      path: `/app/installations/${installationId}/access_tokens`,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'undone-notes-app',
      },
    });

    if (status >= 200 && status < 300 && data?.token && data?.expires_at) {
      return { token: data.token, expiresAt: data.expires_at };
    }
  } catch (err) {
    console.warn('[GitHubApp] Failed to get installation token:', err);
  }

  return null;
}

/**
 * Fetches the list of repositories the installation has access to.
 */
export async function getInstallationRepos(
  installationId: string,
  credentials: GitHubAppCredentials,
): Promise<Array<{ fullName: string; isPrivate: boolean; defaultBranch: string }>> {
  const tokenResult = await getInstallationToken(installationId, credentials);
  if (!tokenResult) return [];

  try {
    const { status, data } = await httpsRequest<{
      repositories?: Array<{ full_name: string; private: boolean; default_branch: string }>;
    }>({
      hostname: 'api.github.com',
      path: '/installation/repositories?per_page=100',
      method: 'GET',
      headers: {
        Authorization: `Bearer ${tokenResult.token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'undone-notes-app',
      },
    });

    if (status >= 200 && status < 300 && Array.isArray(data?.repositories)) {
      return data.repositories.map((r) => ({
        fullName: r.full_name,
        isPrivate: r.private,
        defaultBranch: r.default_branch,
      }));
    }
  } catch (err) {
    console.warn('[GitHubApp] Failed to fetch installation repos:', err);
  }

  return [];
}

/**
 * Returns the GitHub App installation URL for the user to authorize & select repositories.
 */
export function getInstallationUrl(state: string): string {
  return `https://github.com/apps/undone-notes/installations/new?state=${encodeURIComponent(state)}`;
}

export function renderAppSuccessHtml(data: {
  repoFullName: string;
  defaultBranch: string;
  installationId: string;
}): string {
  const safeRepo = data.repoFullName.replace(/[<>"']/g, '');
  const safeBranch = data.defaultBranch.replace(/[<>"']/g, '');

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>GitHub Connected - Undone</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #09090b; color: #f4f4f5; }
      .card { text-align: center; padding: 2.5rem 2rem; background: #18181b; border: 1px solid #27272a; border-radius: 1rem; max-width: 420px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); }
      .icon-box { width: 56px; height: 56px; margin: 0 auto 1.25rem; border-radius: 50%; background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.3); display: flex; align-items: center; justify-content: center; color: #10b981; }
      h1 { font-size: 1.25rem; font-weight: 600; margin: 0 0 0.5rem; }
      p { font-size: 0.875rem; color: #a1a1aa; line-height: 1.5; margin: 0; }
      .repo-badge { display: inline-block; margin-top: 0.75rem; padding: 0.25rem 0.625rem; border-radius: 0.375rem; background: #27272a; color: #38bdf8; font-family: monospace; font-size: 0.8125rem; }
    </style>
  </head>
  <body>
    <div class="card" role="status">
      <div class="icon-box">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
      </div>
      <h1>Connected to GitHub!</h1>
      <p>Your personal workspace is now connected and synchronizing.</p>
      <div><span class="repo-badge">${safeRepo}</span></div>
      <p style="margin-top: 1rem; font-size: 0.75rem; color: #71717a;">This window will close automatically...</p>
    </div>
    <script>
      (function() {
        var payload = {
          type: 'UNDONE_GITHUB_AUTH_SUCCESS',
          repoFullName: '${safeRepo}',
          defaultBranch: '${safeBranch}',
          isPrivate: true
        };
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage(payload, window.location.origin);
          setTimeout(function() { window.close(); }, 800);
        } else {
          setTimeout(function() { window.location.href = '/notes?github_connected=true'; }, 1200);
        }
      })();
    </script>
  </body>
</html>`;
}

export function renderAppErrorHtml(error: string, description?: string): string {
  const safeError = error.replace(/[<>"']/g, '');
  const safeDesc = (description || 'GitHub App installation failed.').replace(/[<>"']/g, '');

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>GitHub Connection Failed - Undone</title>
    <style>
      body { font-family: -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #09090b; color: #f4f4f5; }
      .card { text-align: center; padding: 2.5rem 2rem; background: #18181b; border: 1px solid #27272a; border-radius: 1rem; max-width: 420px; }
      h1 { font-size: 1.25rem; font-weight: 600; margin: 0 0 0.5rem; }
      p { font-size: 0.875rem; color: #a1a1aa; line-height: 1.5; margin: 0; }
    </style>
  </head>
  <body>
    <div class="card" role="alert">
      <h1>Connection Failed</h1>
      <p>${safeDesc}</p>
      <p style="margin-top:1rem;font-size:0.75rem;color:#71717a">Error: ${safeError}</p>
    </div>
    <script>
      (function() {
        var payload = { type: 'UNDONE_GITHUB_AUTH_ERROR', error: '${safeError}', description: '${safeDesc}' };
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage(payload, window.location.origin);
          setTimeout(function() { window.close(); }, 2000);
        }
      })();
    </script>
  </body>
</html>`;
}
