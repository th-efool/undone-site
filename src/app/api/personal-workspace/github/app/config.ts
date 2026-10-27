import fs from 'fs';
import crypto from 'node:crypto';
import https from 'node:https';
import { NextRequest } from 'next/server';

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

export interface GitHubUserIdentity {
  id: string;
  login: string;
}

export interface GitHubAppInstallation {
  id: string;
  appId: string;
  accountId: string;
  accountLogin: string;
  accountType: string;
}

const installationTokenCache = new Map<string, { token: string; expiresAt: number }>();

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

export function getAppOAuthRedirectUri(req: NextRequest, preferredPath?: string): string {
  if (process.env.GITHUB_APP_OAUTH_REDIRECT_URI) {
    return process.env.GITHUB_APP_OAUTH_REDIRECT_URI.trim();
  }
  const rawProto = req.headers.get('x-forwarded-proto');
  let proto = rawProto ? rawProto.split(',')[0].trim() : req.nextUrl.protocol.replace(':', '');
  const rawHost = req.headers.get('x-forwarded-host') || req.headers.get('host') || req.nextUrl.host;
  const host = rawHost ? rawHost.split(',')[0].trim() : 'localhost:3000';

  const isLocal = host.startsWith('localhost') || host.startsWith('127.0.0.1');
  if (process.env.NODE_ENV === 'production' && !isLocal) {
    proto = 'https';
  }

  const path = preferredPath || '/api/personal-workspace/github/app/oauth/callback';
  return `${proto}://${host}${path}`;
}

export function getAppOAuthAuthorizeUrl(state: string, redirectUri: string, clientId: string): string {
  const url = new URL('https://github.com/login/oauth/authorize');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', state);
  return url.toString();
}

export function getInstallationUrl(state: string): string {
  return `https://github.com/apps/undone-notes/installations/new?state=${encodeURIComponent(state)}`;
}

export function getManageInstallationUrl(
  installationId: string,
  accountLogin?: string,
  accountType?: string,
): string {
  if (accountType?.toLowerCase() === 'organization' && accountLogin) {
    return `https://github.com/organizations/${encodeURIComponent(accountLogin)}/settings/installations/${encodeURIComponent(installationId)}`;
  }
  return `https://github.com/settings/installations/${encodeURIComponent(installationId)}`;
}

export async function tryCreateUserRepo(
  userToken: string,
  name: string = 'undone-notes',
  description: string = 'Personal workspace notes and canvas data',
): Promise<boolean> {
  try {
    const res = await fetch('https://api.github.com/user/repos', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${userToken}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'undone-notes-app',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        description,
        private: true,
        auto_init: true,
      }),
    });
    return res.status === 201 || res.status === 422;
  } catch {
    return false;
  }
}

export async function exchangeGitHubAppUserCode(
  code: string,
  redirectUri: string | undefined,
  credentials: GitHubAppCredentials,
): Promise<string | null> {
  if (!credentials.clientSecret) return null;

  async function requestToken(uri?: string): Promise<{ token?: string; error?: string }> {
    const payload: Record<string, string> = {
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      code,
    };
    if (uri) {
      payload.redirect_uri = uri;
    }
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) return { error: `http_${response.status}` };
    const data = (await response.json()) as { access_token?: string; error?: string };
    return { token: data.access_token, error: data.error };
  }

  try {
    const primary = await requestToken(redirectUri);
    if (primary.token) return primary.token;

    // Self-annealing: If redirect_uri was passed but GitHub returned redirect_uri_mismatch,
    // retry without redirect_uri (useful when user installed directly via GitHub App screen)
    if (primary.error === 'redirect_uri_mismatch' && redirectUri) {
      const fallback = await requestToken(undefined);
      if (fallback.token) return fallback.token;
    }

    return null;
  } catch {
    return null;
  }
}

export async function getGitHubUserIdentity(userToken: string): Promise<GitHubUserIdentity | null> {
  try {
    const { status, data } = await httpsRequest<{ id?: number; login?: string }>({
      hostname: 'api.github.com',
      path: '/user',
      method: 'GET',
      headers: {
        Authorization: `Bearer ${userToken}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'undone-personal-workspace',
      },
    });
    return status === 200 && data?.id && data.login
      ? { id: String(data.id), login: data.login }
      : null;
  } catch {
    return null;
  }
}

export async function getUserAppInstallations(
  userToken: string,
  appId: string,
): Promise<GitHubAppInstallation[] | null> {
  const installations: GitHubAppInstallation[] = [];
  for (let page = 1; page <= 10; page++) {
    try {
      const { status, data } = await httpsRequest<{
        installations?: Array<{
          id: number;
          app_id: number;
          account?: { id?: number; login?: string; type?: string };
        }>;
      }>({
        hostname: 'api.github.com',
        path: `/user/installations?per_page=100&page=${page}`,
        method: 'GET',
        headers: {
          Authorization: `Bearer ${userToken}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'undone-personal-workspace',
        },
      });
      if (status !== 200 || !Array.isArray(data?.installations)) return null;
      for (const installation of data.installations) {
        if (
          String(installation.app_id) === appId &&
          installation.account?.id && installation.account.login && installation.account.type
        ) {
          installations.push({
            id: String(installation.id),
            appId: String(installation.app_id),
            accountId: String(installation.account.id),
            accountLogin: installation.account.login,
            accountType: installation.account.type,
          });
        }
      }
      if (data.installations.length < 100) break;
    } catch {
      return null;
    }
  }
  return installations;
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
  forceRefresh = false,
): Promise<{ token: string; expiresAt: string } | null> {
  const cached = installationTokenCache.get(installationId);
  if (!forceRefresh && cached && cached.expiresAt > Date.now() + 5 * 60 * 1000) {
    return { token: cached.token, expiresAt: new Date(cached.expiresAt).toISOString() };
  }
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
      installationTokenCache.set(installationId, {
        token: data.token,
        expiresAt: Date.parse(data.expires_at),
      });
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
  let tokenResult = await getInstallationToken(installationId, credentials);
  if (!tokenResult) return [];

  for (let attempt = 0; attempt < 2; attempt++) {
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

      if (status === 401 && attempt === 0) {
        tokenResult = await getInstallationToken(installationId, credentials, true);
        if (tokenResult) continue;
      }
      if (status >= 200 && status < 300 && Array.isArray(data?.repositories)) {
        return data.repositories.map((r) => ({
          fullName: r.full_name,
          isPrivate: r.private,
          defaultBranch: r.default_branch,
        }));
      }
      break;
    } catch (err) {
      console.warn('[GitHubApp] Failed to fetch installation repos:', err);
      break;
    }
  }

  return [];
}

/**
 * Lists installations of the GitHub App using the App JWT.
 * Useful for installation discovery when GITHUB_APP_CLIENT_SECRET is not configured.
 */
export async function listAppInstallations(
  credentials: GitHubAppCredentials,
): Promise<GitHubAppInstallation[]> {
  const jwt = generateAppJWT(credentials);
  const installations: GitHubAppInstallation[] = [];

  for (let page = 1; page <= 5; page++) {
    try {
      const { status, data } = await httpsRequest<
        Array<{
          id: number;
          app_id: number;
          account?: { id?: number; login?: string; type?: string };
          repository_selection?: string;
        }>
      >({
        hostname: 'api.github.com',
        path: `/app/installations?per_page=100&page=${page}`,
        method: 'GET',
        headers: {
          Authorization: `Bearer ${jwt}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'undone-notes-app',
        },
      });

      if (status >= 200 && status < 300 && Array.isArray(data)) {
        for (const item of data) {
          installations.push({
            id: String(item.id),
            appId: String(item.app_id || credentials.appId),
            accountId: String(item.account?.id || ''),
            accountLogin: item.account?.login || '',
            accountType: item.account?.type || 'User',
          });
        }
        if (data.length < 100) break;
      } else {
        break;
      }
    } catch (err) {
      console.warn('[GitHubApp] Failed to list app installations via JWT:', err);
      break;
    }
  }

  return installations;
}

export function renderAppSuccessHtml(data: {
  repoFullName: string;
  defaultBranch: string;
  installationId: string;
  isPrivate?: boolean;
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
          isPrivate: ${data.isPrivate ?? true}
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

export function renderAppExistingInstallationAccessHtml(data: {
  installationId: string;
  accountLogin: string;
  accountType?: string;
  manageUrl: string;
  stateNonce: string;
  notice?: string;
}): string {
  const safeLogin = data.accountLogin.replace(/[<>"']/g, '');
  const safeId = data.installationId.replace(/[<>"']/g, '');
  const safeNonce = data.stateNonce.replace(/[<>"']/g, '');
  const safeManageUrl = data.manageUrl.replace(/[<>"']/g, '');
  const safeNotice = (data.notice || '').replace(/[<>"']/g, '');

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Grant Repository Access - Undone</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #09090b; color: #f4f4f5; }
      .card { text-align: center; padding: 2.25rem 2rem; background: #18181b; border: 1px solid #27272a; border-radius: 1rem; max-width: 440px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); }
      .icon-box { width: 56px; height: 56px; margin: 0 auto 1.25rem; border-radius: 50%; background: rgba(59,130,246,0.1); border: 1px solid rgba(59,130,246,0.3); display: flex; align-items: center; justify-content: center; color: #60a5fa; }
      h1 { font-size: 1.25rem; font-weight: 600; margin: 0 0 0.5rem; }
      p { font-size: 0.875rem; color: #a1a1aa; line-height: 1.5; margin: 0 0 1rem; }
      .account-badge { display: inline-block; padding: 0.2rem 0.6rem; border-radius: 0.375rem; background: #27272a; color: #38bdf8; font-family: monospace; font-size: 0.8125rem; margin-bottom: 1rem; }
      .steps { text-align: left; background: #121214; border: 1px solid #27272a; border-radius: 0.5rem; padding: 0.875rem 1rem; margin-bottom: 1.5rem; font-size: 0.8125rem; color: #d4d4d8; line-height: 1.6; }
      .steps ol { margin: 0; padding-left: 1.25rem; }
      .btn-container { display: flex; flex-direction: column; gap: 0.75rem; }
      .btn { display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem; padding: 0.625rem 1.25rem; border-radius: 0.5rem; font-size: 0.875rem; font-weight: 500; cursor: pointer; text-decoration: none; transition: background 0.15s, border-color 0.15s; }
      .btn-github { background: #27272a; color: #f4f4f5; border: 1px solid #3f3f46; }
      .btn-github:hover { background: #3f3f46; }
      .btn-primary { background: #2563eb; color: #ffffff; border: 1px solid #1d4ed8; }
      .btn-primary:hover { background: #1d4ed8; }
      .status-msg { margin-top: 1rem; font-size: 0.8125rem; min-height: 1.25rem; }
    </style>
  </head>
  <body>
    <div class="card" role="region">
      <div class="icon-box">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
      </div>
      <h1>Existing Installation Detected</h1>
      <div><span class="account-badge">@${safeLogin}</span></div>
      <p>The Undone App is already installed, but doesn't have permission to access any repositories yet.</p>
      
      <div class="steps">
        <ol>
          <li>Open GitHub settings and select your <code>undone-notes</code> repository (or <i>All repositories</i>).</li>
          <li>Click <b>Save</b> on GitHub, then return here.</li>
        </ol>
      </div>

      <div class="btn-container">
        <a href="${safeManageUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-github">
          Configure Repository Access on GitHub &rarr;
        </a>
        <button id="resume-btn" onclick="checkAccess()" class="btn btn-primary">
          I've Updated Access — Resume Connection
        </button>
      </div>

      <div id="status-msg" class="status-msg">${safeNotice ? safeNotice : ''}</div>
    </div>

    <script>
      var isChecking = false;
      function checkAccess() {
        if (isChecking) return;
        isChecking = true;
        var btn = document.getElementById('resume-btn');
        var statusMsg = document.getElementById('status-msg');
        if (btn) btn.innerText = 'Checking repository access...';
        if (statusMsg) {
          statusMsg.style.color = '#a1a1aa';
          statusMsg.innerText = 'Checking permissions...';
        }

        fetch('/api/personal-workspace/github/app/callback?resume_installation_id=${safeId}&state=${safeNonce}&format=json', {
          headers: { Accept: 'application/json' }
        })
        .then(function(res) { return res.json(); })
        .then(function(data) {
          isChecking = false;
          if (data && data.success) {
            if (statusMsg) {
              statusMsg.style.color = '#10b981';
              statusMsg.innerText = 'Connected! Closing window...';
            }
            var payload = {
              type: 'UNDONE_GITHUB_AUTH_SUCCESS',
              repoFullName: data.repoFullName,
              defaultBranch: data.defaultBranch || 'main',
              isPrivate: data.isPrivate ?? true
            };
            if (window.opener && !window.opener.closed) {
              window.opener.postMessage(payload, window.location.origin);
              setTimeout(function() { window.close(); }, 800);
            } else {
              window.location.href = '/notes?github_connected=true';
            }
          } else {
            if (btn) btn.innerText = "I've Updated Access — Resume Connection";
            if (statusMsg) {
              statusMsg.style.color = '#f59e0b';
              statusMsg.innerText = (data && data.message) || 'No repositories found yet. Make sure you selected a repository and saved on GitHub.';
            }
          }
        })
        .catch(function() {
          isChecking = false;
          if (btn) btn.innerText = "I've Updated Access — Resume Connection";
          if (statusMsg) {
            statusMsg.style.color = '#ef4444';
            statusMsg.innerText = 'Connection check failed. Please try again.';
          }
        });
      }

      window.addEventListener('focus', function() {
        setTimeout(checkAccess, 1000);
      });
    </script>
  </body>
</html>`;
}
