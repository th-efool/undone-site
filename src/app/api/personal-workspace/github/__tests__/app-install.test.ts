import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import crypto from 'node:crypto';
import * as configMod from '../app/config';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';
import { decryptToken } from '@/src/server/infrastructure/github/personal-workspace';
import {
  getGitHubAppCredentials,
  generateAppJWT,
} from '../app/config';
import { GET as getAppInstall } from '../app/install/route';
import { GET as callbackRoute } from '../app/callback/route';

describe('GitHub App & Zero-File Fallback Authentication', () => {
  // Generate a mock RSA 2048 keypair for testing
  const { privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  const base64Key = Buffer.from(privateKey).toString('base64');

  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(prisma.personalWorkspaceGitHubConnection, 'findUnique').mockResolvedValue(null);
    vi.spyOn(prisma.personalWorkspaceGitHubConnection, 'upsert').mockResolvedValue({} as never);
    process.env = { ...originalEnv };
    delete process.env.GITHUB_APP_PRIVATE_KEY_PATH;
    delete process.env.GITHUB_APP_PRIVATE_KEY;
    delete process.env.GITHUB_APP_PRIVATE_KEY_BASE64;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('loads GitHub App credentials from GITHUB_APP_PRIVATE_KEY_BASE64 with zero .pem file on disk', () => {
    process.env.GITHUB_APP_ID = '12345';
    process.env.GITHUB_APP_CLIENT_ID = 'IvTest123';
    process.env.GITHUB_APP_PRIVATE_KEY_BASE64 = base64Key;

    const creds = getGitHubAppCredentials();
    expect(creds).not.toBeNull();
    expect(creds?.appId).toBe('12345');
    expect(creds?.clientId).toBe('IvTest123');
    expect(creds?.privateKeyPem).toContain('BEGIN');

    // Verify JWT generation with base64 key works
    const jwt = generateAppJWT(creds!);
    expect(jwt).toBeDefined();
    expect(jwt.split('.')).toHaveLength(3);
  });

  it('loads GitHub App credentials from raw GITHUB_APP_PRIVATE_KEY string with zero .pem file on disk', () => {
    process.env.GITHUB_APP_ID = '12345';
    process.env.GITHUB_APP_CLIENT_ID = 'IvTest123';
    process.env.GITHUB_APP_PRIVATE_KEY = privateKey.replace(/\n/g, '\\n');

    const creds = getGitHubAppCredentials();
    expect(creds).not.toBeNull();
    expect(creds?.privateKeyPem).toContain('BEGIN');

    const jwt = generateAppJWT(creds!);
    expect(jwt).toBeDefined();
  });

  it('returns null safely when no private key is configured', () => {
    process.env.GITHUB_APP_ID = '12345';
    process.env.GITHUB_APP_CLIENT_ID = 'IvTest123';

    const creds = getGitHubAppCredentials();
    expect(creds).toBeNull();
  });

  it('seamlessly falls back to OAuth (/oauth/authorize) when App private key is missing but OAuth is configured', async () => {
    // No GitHub App private key
    delete process.env.GITHUB_APP_ID;
    delete process.env.GITHUB_APP_PRIVATE_KEY;
    delete process.env.GITHUB_APP_PRIVATE_KEY_BASE64;

    // Standard OAuth configured
    process.env.AUTH_GITHUB_ID = 'client_123';
    process.env.AUTH_GITHUB_SECRET = 'secret_456';

    const req = new NextRequest('http://localhost:3000/api/personal-workspace/github/app/install?repo=my-notes', {
      headers: { 'x-test-user-id': 'user-test-01' },
    });

    const res = await getAppInstall(req);
    expect(res.status).toBe(307); // NextResponse.redirect
    const location = res.headers.get('location') || '';
    expect(location).toContain('/api/personal-workspace/github/oauth/authorize');
    expect(location).toContain('repo=my-notes');
  });

  it('returns 500 with descriptive error only when neither App nor OAuth credentials exist', async () => {
    delete process.env.GITHUB_APP_ID;
    delete process.env.GITHUB_APP_CLIENT_ID;
    delete process.env.GITHUB_APP_PRIVATE_KEY_BASE64;
    delete process.env.GITHUB_APP_PRIVATE_KEY;
    delete process.env.GITHUB_CLIENT_ID;
    delete process.env.GITHUB_CLIENT_SECRET;
    delete process.env.AUTH_GITHUB_ID;
    delete process.env.AUTH_GITHUB_SECRET;

    const req = new NextRequest('http://localhost:3000/api/personal-workspace/github/app/install', {
      headers: { 'x-test-user-id': 'user-test-01' },
    });

    const res = await getAppInstall(req);
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toContain('GitHub credentials not configured');
  });

  it('starts GitHub App user authorization before the installation flow', async () => {
    process.env.GITHUB_APP_ID = '12345';
    process.env.GITHUB_APP_CLIENT_ID = 'IvTest123';
    process.env.GITHUB_APP_CLIENT_SECRET = 'app-secret';
    process.env.GITHUB_APP_PRIVATE_KEY_BASE64 = base64Key;
    process.env.GITHUB_APP_OAUTH_REDIRECT_URI = 'https://undone.example/api/personal-workspace/github/app/oauth/callback';

    const req = new NextRequest('https://undone.example/api/personal-workspace/github/app/install?format=json', {
      headers: { 'x-test-user-id': 'user-test-01' },
    });

    const res = await getAppInstall(req);
    expect(res.status).toBe(200);
    const data = await res.json() as { authorizeUrl: string; state: string };
    const authorizeUrl = new URL(data.authorizeUrl);
    expect(authorizeUrl.origin).toBe('https://github.com');
    expect(authorizeUrl.pathname).toBe('/login/oauth/authorize');
    expect(authorizeUrl.searchParams.get('client_id')).toBe('IvTest123');
    expect(authorizeUrl.searchParams.get('redirect_uri')).toBe(process.env.GITHUB_APP_OAUTH_REDIRECT_URI);
    expect(authorizeUrl.searchParams.get('state')).toBe(data.state);
    expect(res.cookies.get('undone_gh_app_state')?.httpOnly).toBe(true);
  });

  it('discovers existing installations via App JWT without throwing HTTP 500 when clientSecret is missing (Gap 2 Fix)', async () => {
    process.env.GITHUB_APP_ID = '12345';
    process.env.GITHUB_APP_CLIENT_ID = 'IvTest123';
    delete process.env.GITHUB_APP_CLIENT_SECRET;
    process.env.GITHUB_APP_PRIVATE_KEY_BASE64 = base64Key;

    const listSpy = vi.spyOn(configMod, 'listAppInstallations').mockResolvedValue([
      { id: '175771206', appId: '12345', accountId: '99', accountLogin: 'octocat', accountType: 'User' },
    ]);
    const reposSpy = vi.spyOn(configMod, 'getInstallationRepos').mockResolvedValue([
      { fullName: 'octocat/undone-notes', isPrivate: true, defaultBranch: 'main' },
    ]);
    const tokenSpy = vi.spyOn(configMod, 'getInstallationToken').mockResolvedValue({
      token: 'ghs_installed',
      expiresAt: '2026-10-27T22:00:00Z',
    });
    const upsertSpy = vi.spyOn(prisma.personalWorkspaceGitHubConnection, 'upsert').mockResolvedValue({} as never);

    const req = new NextRequest('https://undone.example/api/personal-workspace/github/app/install?format=json', {
      headers: { 'x-test-user-id': 'user-test-01' },
    });

    const res = await getAppInstall(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toMatchObject({
      connected: true,
      repoFullName: 'octocat/undone-notes',
    });

    listSpy.mockRestore();
    reposSpy.mockRestore();
    tokenSpy.mockRestore();
    upsertSpy.mockRestore();
  });

  it('renders in-popup resolver and preserves resumeInstallationId in cookie when repos is 0 in App-JWT mode', async () => {
    process.env.GITHUB_APP_ID = '12345';
    process.env.GITHUB_APP_CLIENT_ID = 'IvTest123';
    delete process.env.GITHUB_APP_CLIENT_SECRET;
    process.env.GITHUB_APP_PRIVATE_KEY_BASE64 = base64Key;

    const listSpy = vi.spyOn(configMod, 'listAppInstallations').mockResolvedValue([
      { id: '175771206', appId: '12345', accountId: '99', accountLogin: 'octocat', accountType: 'User' },
    ]);
    const reposSpy = vi.spyOn(configMod, 'getInstallationRepos').mockResolvedValue([]);

    const req = new NextRequest('https://undone.example/api/personal-workspace/github/app/install', {
      headers: { 'x-test-user-id': 'user-test-01' },
    });

    const res = await getAppInstall(req);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('Existing Installation Detected');
    expect(html).toContain('@octocat');

    // Cookie must contain resumeInstallationId and githubUser
    const cookie = res.cookies.get('undone_gh_app_state')?.value;
    expect(cookie).toBeDefined();
    const decrypted = JSON.parse(await decryptToken(cookie!, 'user-test-01'));
    expect(decrypted.resumeInstallationId).toBe('175771206');
    expect(decrypted.githubUser).toEqual({ id: '99', login: 'octocat' });

    listSpy.mockRestore();
    reposSpy.mockRestore();
  });

  it('prioritizes user existing DB connection when multiple installations exist in App-JWT mode', async () => {
    process.env.GITHUB_APP_ID = '12345';
    process.env.GITHUB_APP_CLIENT_ID = 'IvTest123';
    delete process.env.GITHUB_APP_CLIENT_SECRET;
    process.env.GITHUB_APP_PRIVATE_KEY_BASE64 = base64Key;

    const listSpy = vi.spyOn(configMod, 'listAppInstallations').mockResolvedValue([
      { id: 'inst-1', appId: '12345', accountId: '101', accountLogin: 'other-org', accountType: 'Organization' },
      { id: 'inst-2', appId: '12345', accountId: '102', accountLogin: 'user-bound', accountType: 'User' },
    ]);
    const dbSpy = vi.spyOn(prisma.personalWorkspaceGitHubConnection, 'findUnique').mockResolvedValue({
      installationId: 'inst-2',
    } as never);
    const reposSpy = vi.spyOn(configMod, 'getInstallationRepos').mockImplementation(async (id) => {
      if (id === 'inst-2') return [{ fullName: 'user-bound/undone-notes', isPrivate: true, defaultBranch: 'main' }];
      return [];
    });
    const tokenSpy = vi.spyOn(configMod, 'getInstallationToken').mockResolvedValue({
      token: 'ghs_bound',
      expiresAt: '2026-10-27T22:00:00Z',
    });
    const upsertSpy = vi.spyOn(prisma.personalWorkspaceGitHubConnection, 'upsert').mockResolvedValue({} as never);

    const req = new NextRequest('https://undone.example/api/personal-workspace/github/app/install?format=json', {
      headers: { 'x-test-user-id': 'user-test-01' },
    });

    const res = await getAppInstall(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.repoFullName).toBe('user-bound/undone-notes');

    listSpy.mockRestore();
    dbSpy.mockRestore();
    reposSpy.mockRestore();
    tokenSpy.mockRestore();
    upsertSpy.mockRestore();
  });

  it('successfully completes resume in App-JWT mode without 401 session_expired', async () => {
    process.env.GITHUB_APP_ID = '12345';
    process.env.GITHUB_APP_CLIENT_ID = 'IvTest123';
    delete process.env.GITHUB_APP_CLIENT_SECRET;
    process.env.GITHUB_APP_PRIVATE_KEY_BASE64 = base64Key;

    const state = {
      stateNonce: 'nonce-jwt',
      userId: 'user-test-01',
      createdAt: Date.now(),
      resumeInstallationId: '175771206',
      githubUser: { id: '99', login: 'octocat' },
    };
    const { encryptToken } = await import('@/src/server/infrastructure/github/personal-workspace');
    const stateCookie = await encryptToken(JSON.stringify(state), state.userId);

    const listSpy = vi.spyOn(configMod, 'listAppInstallations').mockResolvedValue([
      { id: '175771206', appId: '12345', accountId: '99', accountLogin: 'octocat', accountType: 'User' },
    ]);
    const reposSpy = vi.spyOn(configMod, 'getInstallationRepos').mockResolvedValue([
      { fullName: 'octocat/undone-notes', isPrivate: true, defaultBranch: 'main' },
    ]);
    const tokenSpy = vi.spyOn(configMod, 'getInstallationToken').mockResolvedValue({
      token: 'ghs_resumed',
      expiresAt: '2026-10-27T22:00:00Z',
    });
    const upsertSpy = vi.spyOn(prisma.personalWorkspaceGitHubConnection, 'upsert').mockResolvedValue({} as never);

    const req = new NextRequest(
      'https://undone.example/api/personal-workspace/github/app/callback?resume_installation_id=175771206&state=nonce-jwt&format=json',
      {
        headers: {
          'x-test-user-id': 'user-test-01',
          cookie: `undone_gh_app_state=${encodeURIComponent(stateCookie)}`,
        },
      },
    );

    const res = await callbackRoute(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toMatchObject({
      success: true,
      repoFullName: 'octocat/undone-notes',
    });

    listSpy.mockRestore();
    reposSpy.mockRestore();
    tokenSpy.mockRestore();
    upsertSpy.mockRestore();
  });
});
