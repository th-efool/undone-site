import { NextRequest } from 'next/server';

export const OAUTH_STATE_COOKIE_NAME = 'undone_gh_oauth_state';

export const OAUTH_STATE_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/api/personal-workspace/github/oauth',
  maxAge: 60 * 10, // 10 minutes
};

export interface OAuthClientCredentials {
  clientId: string;
  clientSecret: string;
}

export function getOAuthClientCredentials(): OAuthClientCredentials | null {
  const clientId =
    process.env.GITHUB_CLIENT_ID ||
    process.env.AUTH_GITHUB_ID ||
    process.env.GITHUB_APP_CLIENT_ID;

  const clientSecret =
    process.env.GITHUB_CLIENT_SECRET ||
    process.env.AUTH_GITHUB_SECRET ||
    process.env.GITHUB_APP_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return null;
  }

  return {
    clientId: clientId.trim(),
    clientSecret: clientSecret.trim(),
  };
}

export function getOAuthRedirectUri(req: NextRequest): string {
  if (process.env.GITHUB_OAUTH_REDIRECT_URI) {
    return process.env.GITHUB_OAUTH_REDIRECT_URI.trim();
  }

  const proto =
    req.headers.get('x-forwarded-proto') ||
    (req.nextUrl.protocol ? req.nextUrl.protocol.replace(':', '') : 'http');
  const host =
    req.headers.get('x-forwarded-host') ||
    req.headers.get('host') ||
    req.nextUrl.host ||
    'localhost:3000';

  return `${proto}://${host}/api/personal-workspace/github/oauth/callback`;
}

export function renderOAuthSuccessHtml(data: {
  repoFullName: string;
  defaultBranch: string;
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
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100vh;
        margin: 0;
        background: #09090b;
        color: #f4f4f5;
      }
      .card {
        text-align: center;
        padding: 2.5rem 2rem;
        background: #18181b;
        border: 1px solid #27272a;
        border-radius: 1rem;
        max-width: 420px;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
      }
      .icon-box {
        width: 56px;
        height: 56px;
        margin: 0 auto 1.25rem;
        border-radius: 50%;
        background: rgba(16, 185, 129, 0.1);
        border: 1px solid rgba(16, 185, 129, 0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        color: #10b981;
      }
      h1 { font-size: 1.25rem; font-weight: 600; margin: 0 0 0.5rem; }
      p { font-size: 0.875rem; color: #a1a1aa; line-height: 1.5; margin: 0; }
      .repo-badge {
        display: inline-block;
        margin-top: 0.75rem;
        padding: 0.25rem 0.625rem;
        border-radius: 0.375rem;
        background: #27272a;
        color: #38bdf8;
        font-family: monospace;
        font-size: 0.8125rem;
      }
    </style>
  </head>
  <body>
    <div class="card" role="status">
      <div class="icon-box">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
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

export function renderOAuthErrorHtml(error: string, description?: string): string {
  const safeError = error.replace(/[<>"']/g, '');
  const safeDesc = (description || 'Authorization was cancelled or encountered an error.').replace(
    /[<>"']/g,
    ''
  );

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>GitHub Connection Failed - Undone</title>
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100vh;
        margin: 0;
        background: #09090b;
        color: #f4f4f5;
      }
      .card {
        text-align: center;
        padding: 2.5rem 2rem;
        background: #18181b;
        border: 1px solid #27272a;
        border-radius: 1rem;
        max-width: 420px;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
      }
      .icon-box {
        width: 56px;
        height: 56px;
        margin: 0 auto 1.25rem;
        border-radius: 50%;
        background: rgba(244, 63, 94, 0.1);
        border: 1px solid rgba(244, 63, 94, 0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        color: #f43f5e;
      }
      h1 { font-size: 1.25rem; font-weight: 600; margin: 0 0 0.5rem; }
      p { font-size: 0.875rem; color: #a1a1aa; line-height: 1.5; margin: 0; }
    </style>
  </head>
  <body>
    <div class="card" role="alert">
      <div class="icon-box">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="15" y1="9" x2="9" y2="15"></line>
          <line x1="9" y1="9" x2="15" y2="15"></line>
        </svg>
      </div>
      <h1>Connection Failed</h1>
      <p>${safeDesc}</p>
      <p style="margin-top: 1rem; font-size: 0.75rem; color: #71717a;">Error code: ${safeError}</p>
    </div>
    <script>
      (function() {
        var payload = {
          type: 'UNDONE_GITHUB_AUTH_ERROR',
          error: '${safeError}',
          description: '${safeDesc}'
        };
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage(payload, window.location.origin);
          setTimeout(function() { window.close(); }, 2000);
        }
      })();
    </script>
  </body>
</html>`;
}
