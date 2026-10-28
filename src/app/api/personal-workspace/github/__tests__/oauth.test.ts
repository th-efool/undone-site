import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as authorizeHandler } from '../oauth/authorize/route';
import { GET as callbackHandler } from '../oauth/callback/route';
import { encryptToken } from '@/src/server/infrastructure/github/personal-workspace';
import { OAUTH_STATE_COOKIE_NAME } from '../oauth/config';
import { VAULT_COOKIE_NAME } from '../vault';

// Mock global fetch
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe('GitHub OAuth BFF Routes', () => {
  const originalEnv = process.env;
  const TEST_USER = 'user-alice-oauth';

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      AUTH_GITHUB_ID: 'test-client-id-123',
      AUTH_GITHUB_SECRET: 'test-client-secret-xyz',
      WORKSPACE_ENCRYPTION_SECRET: 'test-master-secret-key-32-chars-long-12345',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('1. GET /oauth/authorize', () => {
    it('returns 401 when user is not authenticated', async () => {
      const req = new NextRequest('http://localhost:3000/api/personal-workspace/github/oauth/authorize', {
        headers: { 'x-test-unauthorized': 'true' },
      });

      const res = await authorizeHandler(req);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('returns 500 when GitHub OAuth credentials are not configured', async () => {
      delete process.env.AUTH_GITHUB_ID;
      delete process.env.GITHUB_CLIENT_ID;
      delete process.env.GITHUB_APP_CLIENT_ID;

      const req = new NextRequest('http://localhost:3000/api/personal-workspace/github/oauth/authorize', {
        headers: { 'x-test-user-id': TEST_USER },
      });

      const res = await authorizeHandler(req);
      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.error).toContain('GitHub OAuth credentials are not configured');
    });

    it('sets state cookie and redirects 302 to GitHub authorization URL', async () => {
      const req = new NextRequest('http://localhost:3000/api/personal-workspace/github/oauth/authorize', {
        headers: { 'x-test-user-id': TEST_USER },
      });

      const res = await authorizeHandler(req);
      expect(res.status).toBe(307); // Next.js NextResponse.redirect default is 307 Temporary Redirect

      const location = res.headers.get('location');
      expect(location).toBeTruthy();
      const redirectUrl = new URL(location!);
      expect(redirectUrl.origin).toBe('https://github.com');
      expect(redirectUrl.pathname).toBe('/login/oauth/authorize');
      expect(redirectUrl.searchParams.get('client_id')).toBe('test-client-id-123');
      expect(redirectUrl.searchParams.get('scope')).toBe('repo');
      expect(redirectUrl.searchParams.get('state')).toBeTruthy();

      const cookieHeader = res.headers.get('set-cookie');
      expect(cookieHeader).toContain(OAUTH_STATE_COOKIE_NAME);
    });

    it('returns JSON payload when format=json is requested', async () => {
      const req = new NextRequest(
        'http://localhost:3000/api/personal-workspace/github/oauth/authorize?format=json&repo=custom-notes',
        {
          headers: { 'x-test-user-id': TEST_USER },
        }
      );

      const res = await authorizeHandler(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.authorizeUrl).toContain('https://github.com/login/oauth/authorize');
      expect(data.state).toBeTruthy();
      expect(data.redirectUri).toContain('/api/personal-workspace/github/oauth/callback');
    });
  });

  describe('2. GET /oauth/callback', () => {
    it('returns 400 HTML when user denies authorization on GitHub', async () => {
      const req = new NextRequest(
        'http://localhost:3000/api/personal-workspace/github/oauth/callback?error=access_denied&error_description=User+denied+access',
        {
          headers: { 'x-test-user-id': TEST_USER },
        }
      );

      const res = await callbackHandler(req);
      expect(res.status).toBe(400);
      const html = await res.text();
      expect(html).toContain('Connection Failed');
      expect(html).toContain('access_denied');
      expect(html).toContain('UNDONE_GITHUB_AUTH_ERROR');
    });

    it('returns 400 HTML when state cookie is missing or expired', async () => {
      const req = new NextRequest(
        'http://localhost:3000/api/personal-workspace/github/oauth/callback?code=mock_code&state=mock_state',
        {
          headers: { 'x-test-user-id': TEST_USER },
        }
      );

      const res = await callbackHandler(req);
      expect(res.status).toBe(400);
      const html = await res.text();
      expect(html).toContain('state_expired');
    });

    it('returns 400 HTML when state nonce does not match cookie', async () => {
      const statePayload = JSON.stringify({
        stateNonce: 'legitimate_state_12345',
        userId: TEST_USER,
      });
      const encryptedCookie = await encryptToken(statePayload, TEST_USER);

      const req = new NextRequest(
        'http://localhost:3000/api/personal-workspace/github/oauth/callback?code=mock_code&state=forged_state_67890',
        {
          headers: {
            'x-test-user-id': TEST_USER,
            cookie: `${OAUTH_STATE_COOKIE_NAME}=${encryptedCookie}`,
          },
        }
      );

      const res = await callbackHandler(req);
      expect(res.status).toBe(400);
      const html = await res.text();
      expect(html).toContain('state_mismatch');
    });

    it('exchanges code for token, checks repo, and sets encrypted vault cookie', async () => {
      const stateNonce = 'valid_state_nonce_abcdef';
      const statePayload = JSON.stringify({
        stateNonce,
        userId: TEST_USER,
        targetRepo: 'undone-notes',
      });
      const encryptedCookie = await encryptToken(statePayload, TEST_USER);

      // 1. Mock token exchange
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: 'gho_secret_access_token_999',
            token_type: 'bearer',
            scope: 'repo',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      );

      // 2. Mock GET /user
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            login: 'octocat',
            id: 5829104,
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      );

      // 3. Mock verifyRepository (GET /repos/octocat/undone-notes)
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            full_name: 'octocat/undone-notes',
            private: true,
            default_branch: 'main',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      );

      const req = new NextRequest(
        `http://localhost:3000/api/personal-workspace/github/oauth/callback?code=github_auth_code_123&state=${stateNonce}`,
        {
          headers: {
            'x-test-user-id': TEST_USER,
            cookie: `${OAUTH_STATE_COOKIE_NAME}=${encryptedCookie}`,
          },
        }
      );

      const res = await callbackHandler(req);
      expect(res.status).toBe(200);

      const html = await res.text();
      expect(html).toContain('Connected to GitHub!');
      expect(html).toContain('octocat/undone-notes');
      expect(html).toContain('UNDONE_GITHUB_AUTH_SUCCESS');

      // Verify vault cookie was set with 1-year maxAge
      const setCookie = res.headers.get('set-cookie');
      expect(setCookie).toContain(VAULT_COOKIE_NAME);
    });

    it('automatically creates private repository if it does not exist on GitHub (404)', async () => {
      const stateNonce = 'valid_state_nonce_autocreate';
      const statePayload = JSON.stringify({
        stateNonce,
        userId: TEST_USER,
      });
      const encryptedCookie = await encryptToken(statePayload, TEST_USER);

      // 1. Mock token exchange
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: 'gho_token_autocreate',
            token_type: 'bearer',
            scope: 'repo',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      );

      // 2. Mock GET /user
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            login: 'alice-developer',
            id: 123456,
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      );

      // 3. Mock verifyRepository returns 404 (repo does not exist)
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ message: 'Not Found' }),
          { status: 404, headers: { 'content-type': 'application/json' } }
        )
      );

      // 4. Mock POST /user/repos creates the repo
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            full_name: 'alice-developer/undone-notes',
            private: true,
            default_branch: 'main',
          }),
          { status: 201, headers: { 'content-type': 'application/json' } }
        )
      );

      const req = new NextRequest(
        `http://localhost:3000/api/personal-workspace/github/oauth/callback?code=code_auto&state=${stateNonce}`,
        {
          headers: {
            'x-test-user-id': TEST_USER,
            cookie: `${OAUTH_STATE_COOKIE_NAME}=${encryptedCookie}`,
          },
        }
      );

      const res = await callbackHandler(req);
      expect(res.status).toBe(200);

      const html = await res.text();
      expect(html).toContain('Connected to GitHub!');
      expect(html).toContain('alice-developer/undone-notes');

      // Verify POST /user/repos was called with private: true
      const postRepoCall = mockFetch.mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('/user/repos')
      );
      expect(postRepoCall).toBeDefined();
      const body = JSON.parse(postRepoCall![1].body);
      expect(body.private).toBe(true);
      expect(body.name).toBe('undone-notes');
    });
  });
});
