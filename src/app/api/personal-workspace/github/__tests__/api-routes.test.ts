import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  GitHubGitDataClient,
  GitHubApiError,
  encryptToken,
} from '@/src/server/infrastructure/github/personal-workspace';
import {
  NotebookRecord,
  NoteRecord,
  AssetRecord,
  WorkspaceManifest,
} from '@/src/shared/personal-workspace/contracts';
import { canonicalJsonStringify, computeSha256 } from '@/src/shared/personal-workspace/serialization';
import { VAULT_COOKIE_NAME, VaultCookiePayload } from '../vault';
import { GET as getStatus } from '../status/route';
import { POST as postConnect } from '../connect/route';
import { POST as postDisconnect } from '../disconnect/route';
import { POST as postPublish } from '../publish/route';
import { GET as getPull, POST as postPull } from '../pull/route';

describe('Personal Workspace GitHub API Routes', () => {
  const testUserId = 'user-test-01';
  const testToken = 'ghp_secretPersonalWorkspaceToken123456';
  const testRepo = 'octocat/my-notes-repo';

  let originalEnvToken: string | undefined;
  let originalEnvRepo: string | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    originalEnvToken = process.env.GITHUB_TEST_TOKEN;
    originalEnvRepo = process.env.GITHUB_TEST_REPO;
    delete process.env.GITHUB_TEST_TOKEN;
    delete process.env.GITHUB_TEST_REPO;
  });

  afterEach(() => {
    if (originalEnvToken !== undefined) {
      process.env.GITHUB_TEST_TOKEN = originalEnvToken;
    } else {
      delete process.env.GITHUB_TEST_TOKEN;
    }
    if (originalEnvRepo !== undefined) {
      process.env.GITHUB_TEST_REPO = originalEnvRepo;
    } else {
      delete process.env.GITHUB_TEST_REPO;
    }
    vi.restoreAllMocks();
  });

  async function createCookieHeader(
    token: string = testToken,
    userId: string = testUserId,
    repoFullName: string = testRepo,
    isPrivate = true
  ): Promise<string> {
    const encryptedToken = await encryptToken(token, userId);
    const payload: VaultCookiePayload = {
      encryptedToken,
      repoFullName,
      defaultBranch: 'main',
      isPrivate,
    };
    return `${VAULT_COOKIE_NAME}=${encodeURIComponent(JSON.stringify(payload))}`;
  }

  // ==========================================================================
  // 1. Authentication & Security Enforcement
  // ==========================================================================
  describe('Authentication & Security', () => {
    it('returns 401 Unauthorized for unauthenticated requests on all routes', async () => {
      const headers = { 'x-test-unauthorized': 'true' };

      const resStatus = await getStatus(
        new NextRequest('http://localhost:3000/api/personal-workspace/github/status', { headers })
      );
      expect(resStatus.status).toBe(401);
      const jsonStatus = (await resStatus.json()) as { error: string };
      expect(jsonStatus.error).toBe('Unauthorized');

      const resConnect = await postConnect(
        new NextRequest('http://localhost:3000/api/personal-workspace/github/connect', {
          method: 'POST',
          headers,
          body: JSON.stringify({ repoFullName: testRepo }),
        })
      );
      expect(resConnect.status).toBe(401);

      const resDisconnect = await postDisconnect(
        new NextRequest('http://localhost:3000/api/personal-workspace/github/disconnect', {
          method: 'POST',
          headers,
        })
      );
      expect(resDisconnect.status).toBe(401);

      const resPublish = await postPublish(
        new NextRequest('http://localhost:3000/api/personal-workspace/github/publish', {
          method: 'POST',
          headers,
          body: JSON.stringify({ state: { notebooks: [], notes: [], assets: [] } }),
        })
      );
      expect(resPublish.status).toBe(401);

      const resPull = await getPull(
        new NextRequest('http://localhost:3000/api/personal-workspace/github/pull', { headers })
      );
      expect(resPull.status).toBe(401);
    });
  });

  // ==========================================================================
  // 2. GET /status Route
  // ==========================================================================
  describe('GET /api/personal-workspace/github/status', () => {
    it('returns connected: false when no credentials exist', async () => {
      const req = new NextRequest('http://localhost:3000/api/personal-workspace/github/status');
      const res = await getStatus(req);
      expect(res.status).toBe(200);
      const data = (await res.json()) as { connected: boolean };
      expect(data).toEqual({ connected: false });
    });

    it('returns connected: true and repository info when vault cookie exists', async () => {
      vi.spyOn(GitHubGitDataClient.prototype, 'verifyRepository').mockResolvedValueOnce({
        fullName: testRepo,
        defaultBranch: 'main',
        isPrivate: true,
      });

      const cookie = await createCookieHeader();
      const req = new NextRequest('http://localhost:3000/api/personal-workspace/github/status', {
        headers: { cookie },
      });

      const res = await getStatus(req);
      expect(res.status).toBe(200);
      const data = (await res.json()) as Record<string, unknown>;

      expect(data).toEqual({
        connected: true,
        authType: 'pat',
        repoFullName: testRepo,
        defaultBranch: 'main',
        isPrivate: true,
      });

      // Strict security invariant: zero tokens exposed in status response
      expect(data.token).toBeUndefined();
      expect(data.encryptedToken).toBeUndefined();
    });

    it('resolves credentials from test environment fallback when cookie is absent', async () => {
      process.env.GITHUB_TEST_TOKEN = 'ghp_envTokenTest999';
      process.env.GITHUB_TEST_REPO = 'env-org/env-repo';

      vi.spyOn(GitHubGitDataClient.prototype, 'verifyRepository').mockResolvedValueOnce({
        fullName: 'env-org/env-repo',
        defaultBranch: 'main',
        isPrivate: true,
      });

      const req = new NextRequest('http://localhost:3000/api/personal-workspace/github/status');
      const res = await getStatus(req);
      expect(res.status).toBe(200);
      const data = (await res.json()) as { connected: boolean; repoFullName?: string };

      expect(data.connected).toBe(true);
      expect(data.repoFullName).toBe('env-org/env-repo');
    });

    it('returns connected: false if verifyRepository throws 401 or 404', async () => {
      vi.spyOn(GitHubGitDataClient.prototype, 'verifyRepository').mockRejectedValueOnce(
        new GitHubApiError('Bad credentials', 401)
      );

      const cookie = await createCookieHeader();
      const req = new NextRequest('http://localhost:3000/api/personal-workspace/github/status', {
        headers: { cookie },
      });

      const res = await getStatus(req);
      expect(res.status).toBe(200);
      const data = (await res.json()) as { connected: boolean; error?: string };
      expect(data.connected).toBe(false);
      expect(data.error).toBe('Bad credentials');
    });

    it('returns cached repository details if verifyRepository encounters a transient network error', async () => {
      vi.spyOn(GitHubGitDataClient.prototype, 'verifyRepository').mockRejectedValueOnce(
        new Error('ETIMEDOUT')
      );

      const cookie = await createCookieHeader();
      const req = new NextRequest('http://localhost:3000/api/personal-workspace/github/status', {
        headers: { cookie },
      });

      const res = await getStatus(req);
      expect(res.status).toBe(200);
      const data = (await res.json()) as { connected: boolean; repoFullName?: string };
      expect(data.connected).toBe(true);
      expect(data.repoFullName).toBe(testRepo);
    });
  });

  // ==========================================================================
  // 3. POST /connect Route
  // ==========================================================================
  describe('POST /api/personal-workspace/github/connect', () => {
    it('returns 400 when body is invalid JSON', async () => {
      const req = new NextRequest('http://localhost:3000/api/personal-workspace/github/connect', {
        method: 'POST',
        body: 'invalid-json',
      });
      const res = await postConnect(req);
      expect(res.status).toBe(400);
      const data = (await res.json()) as { error: string };
      expect(data.error).toContain('JSON');
    });

    it('returns 400 when repoFullName is missing or format is invalid', async () => {
      const req1 = new NextRequest('http://localhost:3000/api/personal-workspace/github/connect', {
        method: 'POST',
        body: JSON.stringify({ token: testToken }),
      });
      const res1 = await postConnect(req1);
      expect(res1.status).toBe(400);

      const req2 = new NextRequest('http://localhost:3000/api/personal-workspace/github/connect', {
        method: 'POST',
        body: JSON.stringify({ token: testToken, repoFullName: 'invalid-no-slash' }),
      });
      const res2 = await postConnect(req2);
      expect(res2.status).toBe(400);
    });

    it('returns 400 when token is missing and no test env token exists', async () => {
      const req = new NextRequest('http://localhost:3000/api/personal-workspace/github/connect', {
        method: 'POST',
        body: JSON.stringify({ repoFullName: testRepo }),
      });
      const res = await postConnect(req);
      expect(res.status).toBe(400);
      const data = (await res.json()) as { error: string };
      expect(data.error).toContain('token');
    });

    it('rejects public repository with 400 PUBLIC_REPO_VIOLATION when allowPublic is not set', async () => {
      vi.spyOn(GitHubGitDataClient.prototype, 'verifyRepository').mockResolvedValueOnce({
        fullName: testRepo,
        defaultBranch: 'main',
        isPrivate: false,
      });

      const req = new NextRequest('http://localhost:3000/api/personal-workspace/github/connect', {
        method: 'POST',
        body: JSON.stringify({
          token: testToken,
          repoFullName: testRepo,
          allowPublic: false,
        }),
      });

      const res = await postConnect(req);
      expect(res.status).toBe(400);
      const data = (await res.json()) as { error: string; code: string };
      expect(data.code).toBe('PUBLIC_REPO_VIOLATION');
      expect(data.error).toContain('Public repositories not allowed');
    });

    it('allows public repository when allowPublic is true', async () => {
      vi.spyOn(GitHubGitDataClient.prototype, 'verifyRepository').mockResolvedValueOnce({
        fullName: testRepo,
        defaultBranch: 'main',
        isPrivate: false,
      });

      const req = new NextRequest('http://localhost:3000/api/personal-workspace/github/connect', {
        method: 'POST',
        body: JSON.stringify({
          token: testToken,
          repoFullName: testRepo,
          allowPublic: true,
        }),
      });

      const res = await postConnect(req);
      expect(res.status).toBe(200);
      const data = (await res.json()) as { connected: boolean; isPrivate: boolean };
      expect(data.connected).toBe(true);
      expect(data.isPrivate).toBe(false);
    });

    it('successfully connects a private repository and sets HTTP-only vault cookie', async () => {
      vi.spyOn(GitHubGitDataClient.prototype, 'verifyRepository').mockResolvedValueOnce({
        fullName: testRepo,
        defaultBranch: 'main',
        isPrivate: true,
      });

      const req = new NextRequest('http://localhost:3000/api/personal-workspace/github/connect', {
        method: 'POST',
        body: JSON.stringify({
          token: testToken,
          repoFullName: testRepo,
        }),
      });

      const res = await postConnect(req);
      expect(res.status).toBe(200);
      const data = (await res.json()) as { connected: boolean; repoFullName: string };
      expect(data.connected).toBe(true);
      expect(data.repoFullName).toBe(testRepo);

      const cookie = res.cookies.get(VAULT_COOKIE_NAME);
      expect(cookie).toBeDefined();
      expect(cookie?.httpOnly).toBe(true);
      expect(cookie?.path).toBe('/api/personal-workspace/github');

      const parsedPayload = JSON.parse(cookie!.value) as VaultCookiePayload;
      expect(parsedPayload.repoFullName).toBe(testRepo);
      expect(parsedPayload.encryptedToken).toMatch(/^v1:[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/);
    });

    it('returns error with appropriate status when verifyRepository fails', async () => {
      vi.spyOn(GitHubGitDataClient.prototype, 'verifyRepository').mockRejectedValueOnce(
        new GitHubApiError('Repository not found', 404)
      );

      const req = new NextRequest('http://localhost:3000/api/personal-workspace/github/connect', {
        method: 'POST',
        body: JSON.stringify({
          token: testToken,
          repoFullName: testRepo,
        }),
      });

      const res = await postConnect(req);
      expect(res.status).toBe(404);
      const data = (await res.json()) as { error: string };
      expect(data.error).toBe('Repository not found');
    });
  });

  // ==========================================================================
  // 4. POST /disconnect Route
  // ==========================================================================
  describe('POST /api/personal-workspace/github/disconnect', () => {
    it('clears vault cookie and returns connected: false', async () => {
      const cookie = await createCookieHeader();
      const req = new NextRequest('http://localhost:3000/api/personal-workspace/github/disconnect', {
        method: 'POST',
        headers: { cookie },
      });

      const res = await postDisconnect(req);
      expect(res.status).toBe(200);
      const data = (await res.json()) as { connected: boolean };
      expect(data).toEqual({ connected: false });

      const clearedCookie = res.cookies.get(VAULT_COOKIE_NAME);
      expect(clearedCookie).toBeDefined();
      expect(clearedCookie?.maxAge).toBe(0);
    });
  });

  // ==========================================================================
  // 5. POST /publish Route
  // ==========================================================================
  describe('POST /api/personal-workspace/github/publish', () => {
    const sampleNotebook: NotebookRecord = {
      id: 'nb-synthetic-01',
      title: 'Work Notes',
      color: '#3b82f6',
      favorite: true,
      archived: false,
      order: 0,
    };

    const sampleNote: NoteRecord = {
      id: 'note-markdown-01',
      notebookId: 'nb-synthetic-01',
      title: 'Meeting Notes',
      contentType: 'markdown',
      markdownData: {
        markdown: '# Meeting Notes\nDiscussion of local-first sync.',
      },
      order: 0,
      createdAt: '2026-10-27T10:00:00.000Z',
      updatedAt: '2026-10-27T10:30:00.000Z',
    };

    const sampleAsset: AssetRecord = {
      id: 'asset-img-01',
      hash: computeSha256(Buffer.from('iVBORw==', 'base64')),
      mimeType: 'image/png',
      byteLength: 4,
      base64Data: 'iVBORw==',
    };

    it('returns 400 if workspace is not connected to GitHub', async () => {
      const req = new NextRequest('http://localhost:3000/api/personal-workspace/github/publish', {
        method: 'POST',
        body: JSON.stringify({ state: { notebooks: [], notes: [], assets: [] } }),
      });
      const res = await postPublish(req);
      expect(res.status).toBe(400);
      const data = (await res.json()) as { error: string };
      expect(data.error).toContain('Not connected');
    });

    it('returns 400 if publish request body is missing state', async () => {
      const cookie = await createCookieHeader();
      const req = new NextRequest('http://localhost:3000/api/personal-workspace/github/publish', {
        method: 'POST',
        headers: { cookie },
        body: JSON.stringify({}),
      });
      const res = await postPublish(req);
      expect(res.status).toBe(400);
      const data = (await res.json()) as { error: string };
      expect(data.error).toContain('missing state');
    });

    it('requires an explicit expected remote head', async () => {
      const cookie = await createCookieHeader();
      const req = new NextRequest('http://localhost:3000/api/personal-workspace/github/publish', {
        method: 'POST', headers: { cookie },
        body: JSON.stringify({ state: { notebooks: [], notes: [], assets: [] } }),
      });

      const res = await postPublish(req);

      expect(res.status).toBe(400);
      expect((await res.json()).error).toContain('expectedRemoteCommitSha is required');
    });

    it('rejects a stale expected head before creating Git objects', async () => {
      const cookie = await createCookieHeader();
      const createBlob = vi.spyOn(GitHubGitDataClient.prototype, 'createBlob');
      vi.spyOn(GitHubGitDataClient.prototype, 'getRef').mockResolvedValue('newer-head');
      const req = new NextRequest('http://localhost:3000/api/personal-workspace/github/publish', {
        method: 'POST', headers: { cookie },
        body: JSON.stringify({
          expectedRemoteCommitSha: 'stale-head',
          state: { notebooks: [], notes: [], assets: [] },
        }),
      });

      const res = await postPublish(req);

      expect(res.status).toBe(422);
      expect((await res.json()).currentRemoteCommitSha).toBe('newer-head');
      expect(createBlob).not.toHaveBeenCalled();
    });

    it('successfully publishes batch mutations, creates tree, creates commit, and updates ref', async () => {
      const cookie = await createCookieHeader();

      vi.spyOn(GitHubGitDataClient.prototype, 'getCommit').mockResolvedValue({
        sha: 'parent-sha-000000',
        treeSha: 'base-tree-sha-000000',
        parentShas: [],
        message: 'parent commit',
        committedAt: '2026-10-27T10:00:00.000Z',
      });

      const blobSpy = vi
        .spyOn(GitHubGitDataClient.prototype, 'createBlob')
        .mockResolvedValue('blob-sha-synthetic-123456');

      const treeSpy = vi
        .spyOn(GitHubGitDataClient.prototype, 'createTree')
        .mockResolvedValue('tree-sha-synthetic-789012');

      const commitSpy = vi
        .spyOn(GitHubGitDataClient.prototype, 'createCommit')
        .mockResolvedValue('commit-sha-synthetic-345678');

      const refSpy = vi
        .spyOn(GitHubGitDataClient.prototype, 'updateRef')
        .mockResolvedValue({ ok: true, status: 200 });
      vi.spyOn(GitHubGitDataClient.prototype, 'getRef').mockResolvedValue('parent-sha-000000');

      const req = new NextRequest('http://localhost:3000/api/personal-workspace/github/publish', {
        method: 'POST',
        headers: { cookie },
        body: JSON.stringify({
          expectedRemoteCommitSha: 'parent-sha-000000',
          state: {
            notebooks: [sampleNotebook],
            notes: [sampleNote],
            assets: [sampleAsset],
          },
        }),
      });

      const res = await postPublish(req);
      expect(res.status).toBe(200);
      const data = (await res.json()) as { ok: boolean; newCommitSha: string; treeSha: string };

      expect(data.ok).toBe(true);
      expect(data.newCommitSha).toBe('commit-sha-synthetic-345678');
      expect(data.treeSha).toBe('tree-sha-synthetic-789012');

      // Created blobs for: 1 asset, 1 notebook, 1 note, 1 manifest = 4 blobs
      expect(blobSpy).toHaveBeenCalledTimes(4);
      expect(treeSpy).toHaveBeenCalledTimes(1);
      expect(commitSpy).toHaveBeenCalledWith(
        'undone(sync): batch publish',
        'tree-sha-synthetic-789012',
        ['parent-sha-000000']
      );
      expect(refSpy).toHaveBeenCalledWith('refs/heads/main', 'commit-sha-synthetic-345678', {
        expectedSha: 'parent-sha-000000',
      });
    });

    it('publishes state with descriptive commit message when mutations are provided', async () => {
      const cookie = await createCookieHeader();
      vi.spyOn(GitHubGitDataClient.prototype, 'getRef').mockResolvedValue('parent-sha-000000');
      vi.spyOn(GitHubGitDataClient.prototype, 'getCommit').mockResolvedValue({
        sha: 'parent-sha-000000',
        treeSha: 'base-tree-sha',
        parentShas: [],
        message: 'initial',
        committedAt: '2026-10-27T10:00:00.000Z',
      });
      vi.spyOn(GitHubGitDataClient.prototype, 'createBlob').mockResolvedValue('blob-sha');
      vi.spyOn(GitHubGitDataClient.prototype, 'createTree').mockResolvedValue('tree-sha-new');
      const commitSpy = vi.spyOn(GitHubGitDataClient.prototype, 'createCommit').mockResolvedValue('new-commit-sha');
      vi.spyOn(GitHubGitDataClient.prototype, 'updateRef').mockResolvedValue({ ok: true });

      const req = new NextRequest('http://localhost:3000/api/personal-workspace/github/publish', {
        method: 'POST',
        headers: { cookie },
        body: JSON.stringify({
          expectedRemoteCommitSha: 'parent-sha-000000',
          state: {
            notebooks: [sampleNotebook],
            notes: [sampleNote],
            assets: [],
          },
          mutations: [
            {
              id: 'mut-1',
              entityType: 'note',
              entityId: sampleNote.id,
              mutationType: 'update',
              timestamp: '2026-10-27T10:00:00.000Z',
              payload: { title: sampleNote.title, notebookId: sampleNote.notebookId, contentType: 'markdown' },
            },
          ],
        }),
      });

      const res = await postPublish(req);
      expect(res.status).toBe(200);
      expect(commitSpy).toHaveBeenCalledWith(
        expect.stringContaining(`undone(sync): update markdown "${sampleNote.title}" in "${sampleNotebook.title}"`),
        'tree-sha-new',
        ['parent-sha-000000']
      );
    });

    it('returns noOp: true without creating a commit if resulting treeSha matches baseTreeSha', async () => {
      const cookie = await createCookieHeader();
      vi.spyOn(GitHubGitDataClient.prototype, 'getRef').mockResolvedValue('parent-sha-000000');
      vi.spyOn(GitHubGitDataClient.prototype, 'getCommit').mockResolvedValue({
        sha: 'parent-sha-000000',
        treeSha: 'identical-tree-sha',
        parentShas: [],
        message: 'initial',
        committedAt: '2026-10-27T10:00:00.000Z',
      });
      vi.spyOn(GitHubGitDataClient.prototype, 'createBlob').mockResolvedValue('blob-sha');
      vi.spyOn(GitHubGitDataClient.prototype, 'createTree').mockResolvedValue('identical-tree-sha');
      const commitSpy = vi.spyOn(GitHubGitDataClient.prototype, 'createCommit');

      const req = new NextRequest('http://localhost:3000/api/personal-workspace/github/publish', {
        method: 'POST',
        headers: { cookie },
        body: JSON.stringify({
          expectedRemoteCommitSha: 'parent-sha-000000',
          state: {
            notebooks: [sampleNotebook],
            notes: [sampleNote],
            assets: [],
          },
        }),
      });

      const res = await postPublish(req);
      expect(res.status).toBe(200);
      const data = (await res.json()) as { ok: boolean; noOp: boolean; treeSha: string };
      expect(data.ok).toBe(true);
      expect(data.noOp).toBe(true);
      expect(data.treeSha).toBe('identical-tree-sha');
      expect(commitSpy).not.toHaveBeenCalled();
    });

    it('rejects a canvas with a missing asset before creating Git objects', async () => {
      const cookie = await createCookieHeader();
      const createBlob = vi.spyOn(GitHubGitDataClient.prototype, 'createBlob');
      const missingHash = 'a'.repeat(64);
      const req = new NextRequest('http://localhost:3000/api/personal-workspace/github/publish', {
        method: 'POST', headers: { cookie },
        body: JSON.stringify({
          expectedRemoteCommitSha: null,
          state: {
            notebooks: [sampleNotebook],
            notes: [{ ...sampleNote, contentType: 'canvas', canvasData: {
              elements: [{ assetHash: missingHash }], appState: {}, assetFileIds: [missingHash],
              assetHashes: { [missingHash]: missingHash },
            } }],
            assets: [],
          },
        }),
      });

      const response = await postPublish(req);

      expect(response.status).toBe(400);
      expect((await response.json()).error).toContain(missingHash);
      expect(createBlob).not.toHaveBeenCalled();
    });

    it('handles CAS conflict (HTTP 422) by fetching current remote ref head and returning 422', async () => {
      const cookie = await createCookieHeader();

      vi.spyOn(GitHubGitDataClient.prototype, 'getCommit').mockResolvedValue({
        sha: 'expected-old-sha',
        treeSha: 'base-tree-sha',
        parentShas: [],
        message: 'old commit',
        committedAt: '2026-10-27T10:00:00.000Z',
      });

      vi.spyOn(GitHubGitDataClient.prototype, 'createBlob').mockResolvedValue('blob-sha');
      vi.spyOn(GitHubGitDataClient.prototype, 'createTree').mockResolvedValue('tree-sha');
      vi.spyOn(GitHubGitDataClient.prototype, 'createCommit').mockResolvedValue('candidate-commit-sha');

      vi.spyOn(GitHubGitDataClient.prototype, 'updateRef').mockResolvedValue({
        ok: false,
        status: 422,
        error: 'Update is not a fast forward',
      });

      vi.spyOn(GitHubGitDataClient.prototype, 'getRef')
        .mockResolvedValueOnce('expected-old-sha')
        .mockResolvedValue('remote-diverged-head-sha-999999');

      const req = new NextRequest('http://localhost:3000/api/personal-workspace/github/publish', {
        method: 'POST',
        headers: { cookie },
        body: JSON.stringify({
          expectedRemoteCommitSha: 'expected-old-sha',
          state: {
            notebooks: [sampleNotebook],
            notes: [sampleNote],
            assets: [],
          },
        }),
      });

      const res = await postPublish(req);
      expect(res.status).toBe(422);
      const data = (await res.json()) as {
        ok: boolean;
        conflict: boolean;
        currentRemoteCommitSha: string;
        error: string;
      };

      expect(data.ok).toBe(false);
      expect(data.conflict).toBe(true);
      expect(data.currentRemoteCommitSha).toBe('remote-diverged-head-sha-999999');
      expect(data.error).toBe('Remote ref has moved');
    });

    it('returns error when ref update fails with non-422 status', async () => {
      const cookie = await createCookieHeader();

      vi.spyOn(GitHubGitDataClient.prototype, 'getCommit').mockResolvedValue({
        sha: 'base-sha', treeSha: 'base-tree', parentShas: [], message: 'base', committedAt: new Date().toISOString(),
      });
      vi.spyOn(GitHubGitDataClient.prototype, 'createBlob').mockResolvedValue('blob-sha');
      vi.spyOn(GitHubGitDataClient.prototype, 'createTree').mockResolvedValue('tree-sha');
      vi.spyOn(GitHubGitDataClient.prototype, 'createCommit').mockResolvedValue('commit-sha');
      vi.spyOn(GitHubGitDataClient.prototype, 'getRef').mockResolvedValue('base-sha');

      vi.spyOn(GitHubGitDataClient.prototype, 'updateRef').mockResolvedValue({
        ok: false,
        status: 500,
        error: 'GitHub server error',
      });

      const req = new NextRequest('http://localhost:3000/api/personal-workspace/github/publish', {
        method: 'POST',
        headers: { cookie },
        body: JSON.stringify({
          expectedRemoteCommitSha: 'base-sha',
          state: { notebooks: [], notes: [], assets: [] },
        }),
      });

      const res = await postPublish(req);
      expect(res.status).toBe(500);
      const data = (await res.json()) as { ok: boolean; error: string };
      expect(data.ok).toBe(false);
      expect(data.error).toBe('GitHub server error');
    });
  });

  // ==========================================================================
  // 6. GET & POST /pull Route
  // ==========================================================================
  describe('GET & POST /api/personal-workspace/github/pull', () => {
    it('returns 400 when workspace is not connected', async () => {
      const req = new NextRequest('http://localhost:3000/api/personal-workspace/github/pull');
      const res = await getPull(req);
      expect(res.status).toBe(400);
      const data = (await res.json()) as { error: string };
      expect(data.error).toContain('Not connected');
    });

    it('returns empty collections when remote branch ref does not exist', async () => {
      const cookie = await createCookieHeader();

      vi.spyOn(GitHubGitDataClient.prototype, 'getRef').mockResolvedValue(null);

      const req = new NextRequest('http://localhost:3000/api/personal-workspace/github/pull', {
        headers: { cookie },
      });

      const res = await getPull(req);
      expect(res.status).toBe(200);
      const data = (await res.json()) as {
        ok: boolean;
        commitSha: string | null;
        notebooks: unknown[];
      };

      expect(data.ok).toBe(true);
      expect(data.commitSha).toBeNull();
      expect(data.notebooks).toEqual([]);
    });

    it('successfully pulls and reconstructs manifest, notebooks, notes, and assets', async () => {
      const cookie = await createCookieHeader();

      const sampleNotebook: NotebookRecord = {
        id: 'nb-remote-01',
        title: 'Remote Notebook',
        color: '#10b981',
        favorite: false,
        archived: false,
        order: 1,
      };

      const sampleNote: NoteRecord = {
        id: 'note-remote-01',
        notebookId: 'nb-remote-01',
        title: 'Remote Note',
        contentType: 'markdown',
        markdownData: { markdown: 'Hello from remote' },
        order: 0,
        createdAt: '2026-10-27T10:00:00.000Z',
        updatedAt: '2026-10-27T10:00:00.000Z',
      };

      const sampleManifest: WorkspaceManifest = {
        manifestVersion: 1,
        workspaceId: testUserId,
        notebooks: [
          {
            id: 'nb-remote-01',
            path: 'undone/notebooks/nb-remote-01.json',
            hash: computeSha256(canonicalJsonStringify(sampleNotebook)),
          },
        ],
        notes: [
          {
            id: 'note-remote-01',
            path: 'undone/notes/note-remote-01.json',
            hash: computeSha256(canonicalJsonStringify(sampleNote)),
            contentType: 'markdown',
          },
        ],
        assets: [
          {
            id: 'asset-remote-01',
            path: 'undone/assets/hash-asset-1.png',
            sha256: computeSha256(Buffer.from('iVBORw==', 'base64')),
            gitSha: 'a'.repeat(40),
            mimeType: 'image/png',
          },
        ],
      };

      vi.spyOn(GitHubGitDataClient.prototype, 'getRef').mockResolvedValue('head-commit-sha-123456');

      vi.spyOn(GitHubGitDataClient.prototype, 'getCommit').mockResolvedValue({
        sha: 'head-commit-sha-123456',
        treeSha: 'root-tree-sha-789012',
        parentShas: [],
        message: 'undone(sync): update',
        committedAt: '2026-10-27T10:00:00.000Z',
      });

      vi.spyOn(GitHubGitDataClient.prototype, 'getTree').mockResolvedValue([
        {
          path: 'undone/manifest.json',
          mode: '100644',
          type: 'blob',
          sha: 'sha-manifest-blob',
        },
        {
          path: 'undone/notebooks/nb-remote-01.json',
          mode: '100644',
          type: 'blob',
          sha: 'sha-nb-blob',
        },
        {
          path: 'undone/notes/note-remote-01.json',
          mode: '100644',
          type: 'blob',
          sha: 'sha-note-blob',
        },
        {
          path: 'undone/assets/hash-asset-1.png',
          mode: '100644',
          type: 'blob',
          sha: 'a'.repeat(40),
          size: 4,
        },
      ]);

      vi.spyOn(GitHubGitDataClient.prototype, 'getBlob').mockImplementation(async (sha) => {
        if (sha === 'sha-manifest-blob') {
          return {
            sha,
            byteLength: 100,
            contentBase64: Buffer.from(canonicalJsonStringify(sampleManifest)).toString('base64'),
          };
        }
        if (sha === 'sha-nb-blob') {
          return {
            sha,
            byteLength: 50,
            contentBase64: Buffer.from(canonicalJsonStringify(sampleNotebook)).toString('base64'),
          };
        }
        if (sha === 'sha-note-blob') {
          return {
            sha,
            byteLength: 60,
            contentBase64: Buffer.from(canonicalJsonStringify(sampleNote)).toString('base64'),
          };
        }
        if (sha === 'a'.repeat(40)) {
          return {
            sha,
            byteLength: 4,
            contentBase64: 'iVBORw==',
          };
        }
        return null;
      });

      // Test with GET
      const reqGet = new NextRequest('http://localhost:3000/api/personal-workspace/github/pull', {
        headers: { cookie },
      });
      const resGet = await getPull(reqGet);
      expect(resGet.status, await resGet.clone().text()).toBe(200);

      const data = (await resGet.json()) as {
        ok: boolean;
        commitSha: string;
        manifest: WorkspaceManifest;
        notebooks: NotebookRecord[];
        notes: NoteRecord[];
        assets: AssetRecord[];
      };

      expect(data.ok).toBe(true);
      expect(data.commitSha).toBe('head-commit-sha-123456');
      expect(data.manifest.workspaceId).toBe(testUserId);
      expect(data.notebooks).toHaveLength(1);
      expect(data.notebooks[0].id).toBe('nb-remote-01');
      expect(data.notes).toHaveLength(1);
      expect(data.notes[0].id).toBe('note-remote-01');
      expect(data.assets).toHaveLength(1);
      expect(data.assets[0].id).toBe('asset-remote-01');
      expect(data.assets[0].mimeType).toBe('image/png');
      expect(data.assets[0].base64Data).toBe('iVBORw==');

      // Test with POST
      const reqPost = new NextRequest('http://localhost:3000/api/personal-workspace/github/pull', {
        method: 'POST',
        headers: { cookie },
      });
      const resPost = await postPull(reqPost);
      expect(resPost.status).toBe(200);
      const dataPost = (await resPost.json()) as { ok: boolean };
      expect(dataPost.ok).toBe(true);

      vi.mocked(GitHubGitDataClient.prototype.getTree).mockResolvedValue([
        { path: 'undone/manifest.json', mode: '100644', type: 'blob', sha: 'sha-manifest-blob' },
        { path: 'undone/notebooks/nb-remote-01.json', mode: '100644', type: 'blob', sha: 'sha-nb-blob' },
        { path: 'undone/notes/note-remote-01.json', mode: '100644', type: 'blob', sha: 'sha-note-blob' },
      ]);
      const missingAssetResponse = await getPull(reqGet);
      expect(missingAssetResponse.status).toBe(500);
      expect((await missingAssetResponse.json()).error).toContain('Manifest asset is missing or changed');
    });
  });
});
