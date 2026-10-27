import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  GitHubGitDataClient,
  GitHubApiError,
} from '../client';

describe('GitHubGitDataClient', () => {
  const originalFetch = globalThis.fetch;
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = mockFetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('Constructor & Validation', () => {
    it('initializes correctly with valid options', () => {
      const client = new GitHubGitDataClient({
        repoFullName: 'octocat/undone-workspace',
        token: 'ghp_secret_token_12345',
        userAgent: 'test-agent/1.0',
      });

      expect(client.owner).toBe('octocat');
      expect(client.repo).toBe('undone-workspace');
      expect(client.repoFullName).toBe('octocat/undone-workspace');
    });

    it('throws when token is missing or empty', () => {
      expect(() => {
        new GitHubGitDataClient({
          repoFullName: 'octocat/workspace',
          token: '',
        });
      }).toThrow(/requires a non-empty token string/);

      expect(() => {
        new GitHubGitDataClient({
          repoFullName: 'octocat/workspace',
          // @ts-expect-error runtime validation
          token: null,
        });
      }).toThrow(/requires a non-empty token string/);
    });

    it('throws when repoFullName is invalid', () => {
      expect(() => {
        new GitHubGitDataClient({
          repoFullName: 'invalid-no-slash',
          token: 'token',
        });
      }).toThrow(/Expected format is "owner\/repo"/);

      expect(() => {
        new GitHubGitDataClient({
          repoFullName: 'too/many/slashes',
          token: 'token',
        });
      }).toThrow(/Expected format is "owner\/repo"/);

      expect(() => {
        new GitHubGitDataClient({
          repoFullName: '/missing-owner',
          token: 'token',
        });
      }).toThrow(/Expected format is "owner\/repo"/);
    });
  });

  describe('HTTP Headers verification', () => {
    it('sends exact required headers: Authorization Bearer, Accept, X-GitHub-Api-Version, and User-Agent', async () => {
      const token = 'ghu_test_bearer_token';
      const client = new GitHubGitDataClient({
        repoFullName: 'octocat/test-repo',
        token,
        userAgent: 'custom-undone-client',
      });

      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            full_name: 'octocat/test-repo',
            private: true,
            default_branch: 'main',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      );

      await client.verifyRepository();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://api.github.com/repos/octocat/test-repo');

      const headers = init.headers as Record<string, string>;
      expect(headers['Authorization']).toBe(`Bearer ${token}`);
      expect(headers['Accept']).toBe('application/vnd.github+json');
      expect(headers['X-GitHub-Api-Version']).toBe('2022-11-28');
      expect(headers['User-Agent']).toBe('custom-undone-client');
    });

    it('sets Content-Type application/json on mutations with body', async () => {
      const client = new GitHubGitDataClient({
        repoFullName: 'octocat/test-repo',
        token: 'token',
      });

      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ sha: 'blob_sha_123' }),
          { status: 201, headers: { 'content-type': 'application/json' } }
        )
      );

      await client.createBlob('SGVsbG8=');

      const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      const headers = init.headers as Record<string, string>;
      expect(headers['Content-Type']).toBe('application/json');
    });
  });

  describe('verifyRepository', () => {
    it('returns repository info on 200 OK', async () => {
      const client = new GitHubGitDataClient({
        repoFullName: 'user/vault',
        token: 'token',
      });

      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            full_name: 'user/vault',
            private: true,
            default_branch: 'main',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      );

      const repo = await client.verifyRepository();
      expect(repo).toEqual({
        fullName: 'user/vault',
        isPrivate: true,
        defaultBranch: 'main',
      });
    });

    it('throws GitHubApiError with status 404 when repository does not exist', async () => {
      const client = new GitHubGitDataClient({
        repoFullName: 'user/missing-vault',
        token: 'token',
      });

      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ message: 'Not Found', documentation_url: 'https://docs.github.com' }),
          { status: 404, headers: { 'content-type': 'application/json' } }
        )
      );

      await expect(client.verifyRepository()).rejects.toThrow(GitHubApiError);
      await expect(async () => {
        mockFetch.mockResolvedValueOnce(
          new Response(
            JSON.stringify({ message: 'Not Found' }),
            { status: 404, headers: { 'content-type': 'application/json' } }
          )
        );
        await client.verifyRepository();
      }).rejects.toMatchObject({ status: 404 });
    });
  });

  describe('bootstrapEmptyRepo', () => {
    it('bootstraps empty repository (409 Conflict) by creating initial README via Contents API', async () => {
      const client = new GitHubGitDataClient({
        repoFullName: 'user/empty-vault',
        token: 'token',
      });

      // 1. GET /commits?per_page=1 returns 409
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ message: 'Git Repository is empty.' }),
          { status: 409, headers: { 'content-type': 'application/json' } }
        )
      );

      // 2. PUT /contents/README.md returns 201 Created
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            commit: { sha: 'initial_commit_sha_123' },
          }),
          { status: 201, headers: { 'content-type': 'application/json' } }
        )
      );

      const commitSha = await client.bootstrapEmptyRepo();
      expect(commitSha).toBe('initial_commit_sha_123');

      expect(mockFetch).toHaveBeenCalledTimes(2);
      const [urlPut, initPut] = mockFetch.mock.calls[1] as [string, RequestInit];
      expect(urlPut).toBe('https://api.github.com/repos/user/empty-vault/contents/README.md');
      expect(initPut.method).toBe('PUT');
      const body = JSON.parse(initPut.body as string) as { message: string; content: string };
      expect(body.message).toBe('Initial workspace commit');
      expect(Buffer.from(body.content, 'base64').toString('utf-8')).toContain('# empty-vault');
    });

    it('returns latest commit sha without calling Contents API if repo already has commits', async () => {
      const client = new GitHubGitDataClient({
        repoFullName: 'user/active-vault',
        token: 'token',
      });

      // GET /commits returns existing commit
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify([{ sha: 'existing_commit_sha_999' }]),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      );

      const commitSha = await client.bootstrapEmptyRepo();
      expect(commitSha).toBe('existing_commit_sha_999');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Blob operations (createBlob, getBlob)', () => {
    it('creates blob and returns SHA', async () => {
      const client = new GitHubGitDataClient({
        repoFullName: 'user/repo',
        token: 'token',
      });

      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ sha: 'blob_sha_abc123' }),
          { status: 201, headers: { 'content-type': 'application/json' } }
        )
      );

      const rawBase64 = Buffer.from('hello world').toString('base64');
      const sha = await client.createBlob(rawBase64);

      expect(sha).toBe('blob_sha_abc123');
      const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://api.github.com/repos/user/repo/git/blobs');
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body as string)).toEqual({
        content: rawBase64,
        encoding: 'base64',
      });
    });

    it('retrieves blob, sanitizing newlines and returning byteLength and content', async () => {
      const client = new GitHubGitDataClient({
        repoFullName: 'user/repo',
        token: 'token',
      });

      const rawContent = 'aGVsbG8gd29ybGQ=';
      // GitHub often formats base64 with newlines
      const githubFormattedContent = 'aGVsbG8\ngd29ybGQ=\n';

      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            sha: 'blob_sha_abc123',
            size: 11,
            content: githubFormattedContent,
            encoding: 'base64',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      );

      const blob = await client.getBlob('blob_sha_abc123');
      expect(blob).toEqual({
        sha: 'blob_sha_abc123',
        byteLength: 11,
        contentBase64: rawContent,
      });
    });

    it('returns null when blob is not found (404)', async () => {
      const client = new GitHubGitDataClient({
        repoFullName: 'user/repo',
        token: 'token',
      });

      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ message: 'Not Found' }),
          { status: 404, headers: { 'content-type': 'application/json' } }
        )
      );

      const blob = await client.getBlob('missing_sha');
      expect(blob).toBeNull();
    });
  });

  describe('Tree operations (createTree, getTree)', () => {
    it('creates root tree when baseTreeSha is null', async () => {
      const client = new GitHubGitDataClient({
        repoFullName: 'user/repo',
        token: 'token',
      });

      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ sha: 'tree_sha_root' }),
          { status: 201, headers: { 'content-type': 'application/json' } }
        )
      );

      const entries = [
        { path: 'manifest.json', mode: '100644' as const, type: 'blob' as const, sha: 'blob_sha_1' },
      ];

      const treeSha = await client.createTree(null, entries);
      expect(treeSha).toBe('tree_sha_root');

      const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      const parsedBody = JSON.parse(init.body as string) as { tree: unknown[]; base_tree?: string };
      expect(parsedBody.base_tree).toBeUndefined();
      expect(parsedBody.tree).toEqual(entries);
    });

    it('creates incremental tree with base_tree when baseTreeSha is provided', async () => {
      const client = new GitHubGitDataClient({
        repoFullName: 'user/repo',
        token: 'token',
      });

      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ sha: 'tree_sha_incremental' }),
          { status: 201, headers: { 'content-type': 'application/json' } }
        )
      );

      const entries = [
        { path: 'notes/note1.json', mode: '100644' as const, type: 'blob' as const, sha: 'blob_sha_note' },
      ];

      const treeSha = await client.createTree('base_sha_parent', entries);
      expect(treeSha).toBe('tree_sha_incremental');

      const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      const parsedBody = JSON.parse(init.body as string) as { base_tree?: string };
      expect(parsedBody.base_tree).toBe('base_sha_parent');
    });

    it('retrieves tree items with recursive query parameter', async () => {
      const client = new GitHubGitDataClient({
        repoFullName: 'user/repo',
        token: 'token',
      });

      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            sha: 'tree_sha_123',
            tree: [
              { path: 'note.json', mode: '100644', type: 'blob', sha: 'b1', size: 100 },
              { path: 'sub/canvas.json', mode: '100644', type: 'blob', sha: 'b2', size: 250 },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      );

      const items = await client.getTree('tree_sha_123', true);
      expect(items).toEqual([
        { path: 'note.json', mode: '100644', type: 'blob', sha: 'b1', size: 100 },
        { path: 'sub/canvas.json', mode: '100644', type: 'blob', sha: 'b2', size: 250 },
      ]);

      const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://api.github.com/repos/user/repo/git/trees/tree_sha_123?recursive=1');
    });

    it('returns null when tree is not found (404)', async () => {
      const client = new GitHubGitDataClient({
        repoFullName: 'user/repo',
        token: 'token',
      });

      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ message: 'Not Found' }),
          { status: 404, headers: { 'content-type': 'application/json' } }
        )
      );

      const result = await client.getTree('missing_tree');
      expect(result).toBeNull();
    });
  });

  describe('Commit operations (createCommit, getCommit)', () => {
    it('creates commit with tree and parents', async () => {
      const client = new GitHubGitDataClient({
        repoFullName: 'user/repo',
        token: 'token',
      });

      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ sha: 'commit_sha_created' }),
          { status: 201, headers: { 'content-type': 'application/json' } }
        )
      );

      const commitSha = await client.createCommit(
        'Sync personal notes',
        'tree_sha_abc',
        ['parent_sha_1', 'parent_sha_2']
      );

      expect(commitSha).toBe('commit_sha_created');
      const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(JSON.parse(init.body as string)).toEqual({
        message: 'Sync personal notes',
        tree: 'tree_sha_abc',
        parents: ['parent_sha_1', 'parent_sha_2'],
      });
    });

    it('retrieves commit details by SHA', async () => {
      const client = new GitHubGitDataClient({
        repoFullName: 'user/repo',
        token: 'token',
      });

      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            sha: 'commit_sha_123',
            message: 'Commit message',
            tree: { sha: 'tree_sha_xyz' },
            parents: [{ sha: 'parent_1' }],
            committer: { date: '2026-10-27T10:00:00Z' },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      );

      const commit = await client.getCommit('commit_sha_123');
      expect(commit).toEqual({
        sha: 'commit_sha_123',
        treeSha: 'tree_sha_xyz',
        parentShas: ['parent_1'],
        message: 'Commit message',
        committedAt: '2026-10-27T10:00:00Z',
      });
    });

    it('returns null when commit is not found (404)', async () => {
      const client = new GitHubGitDataClient({
        repoFullName: 'user/repo',
        token: 'token',
      });

      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ message: 'Not Found' }),
          { status: 404, headers: { 'content-type': 'application/json' } }
        )
      );

      const commit = await client.getCommit('missing_sha');
      expect(commit).toBeNull();
    });
  });

  describe('Ref operations (getRef, updateRef)', () => {
    it('normalizes ref names and retrieves commit SHA', async () => {
      const client = new GitHubGitDataClient({
        repoFullName: 'user/repo',
        token: 'token',
      });

      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ref: 'refs/heads/main',
            object: { sha: 'ref_commit_sha_123', type: 'commit' },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      );

      const sha = await client.getRef('refs/heads/main');
      expect(sha).toBe('ref_commit_sha_123');

      const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://api.github.com/repos/user/repo/git/ref/heads/main');
    });

    it('creates ref via POST /git/refs when ref does not exist yet', async () => {
      const client = new GitHubGitDataClient({
        repoFullName: 'user/repo',
        token: 'token',
      });

      // 1. getRef returns 404
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ message: 'Not Found' }),
          { status: 404, headers: { 'content-type': 'application/json' } }
        )
      );

      // 2. POST /git/refs returns 201 Created
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ ref: 'refs/heads/main', object: { sha: 'new_head_sha' } }),
          { status: 201, headers: { 'content-type': 'application/json' } }
        )
      );

      const result = await client.updateRef('heads/main', 'new_head_sha');

      expect(result).toEqual({ ok: true, status: 201 });
      expect(mockFetch).toHaveBeenCalledTimes(2);

      const [postUrl, postInit] = mockFetch.mock.calls[1] as [string, RequestInit];
      expect(postUrl).toBe('https://api.github.com/repos/user/repo/git/refs');
      expect(postInit.method).toBe('POST');
      expect(JSON.parse(postInit.body as string)).toEqual({
        ref: 'refs/heads/main',
        sha: 'new_head_sha',
      });
    });

    it('updates ref via PATCH /git/refs/{refName} when ref exists', async () => {
      const client = new GitHubGitDataClient({
        repoFullName: 'user/repo',
        token: 'token',
      });

      // 1. getRef returns existing sha
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ref: 'refs/heads/main',
            object: { sha: 'old_sha_123' },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      );

      // 2. PATCH /git/refs/heads/main returns 200 OK
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ref: 'refs/heads/main',
            object: { sha: 'new_sha_456' },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      );

      const result = await client.updateRef('heads/main', 'new_sha_456');

      expect(result).toEqual({ ok: true, status: 200 });
      expect(mockFetch).toHaveBeenCalledTimes(2);

      const [patchUrl, patchInit] = mockFetch.mock.calls[1] as [string, RequestInit];
      expect(patchUrl).toBe('https://api.github.com/repos/user/repo/git/refs/heads/main');
      expect(patchInit.method).toBe('PATCH');
      expect(JSON.parse(patchInit.body as string)).toEqual({
        sha: 'new_sha_456',
        force: false,
      });
    });

    it('refuses to update when the branch head differs from the expected SHA', async () => {
      const client = new GitHubGitDataClient({ repoFullName: 'user/repo', token: 'token' });
      mockFetch.mockResolvedValueOnce(new Response(
        JSON.stringify({ ref: 'refs/heads/main', object: { sha: 'newer_sha' } }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ));

      const result = await client.updateRef('heads/main', 'candidate_sha', { expectedSha: 'stale_sha' });

      expect(result).toMatchObject({ ok: false, status: 422 });
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('handles Compare-And-Swap (CAS) 422 conflict when fast-forward fails', async () => {
      const client = new GitHubGitDataClient({
        repoFullName: 'user/repo',
        token: 'token',
      });

      // 1. getRef returns existing sha
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ref: 'refs/heads/main',
            object: { sha: 'old_sha_123' },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      );

      // 2. PATCH returns 422 Unprocessable Entity
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            message: 'Update is not a fast forward',
            documentation_url: 'https://docs.github.com/rest/git/refs#update-a-reference',
          }),
          { status: 422, headers: { 'content-type': 'application/json' } }
        )
      );

      const result = await client.updateRef('heads/main', 'diverged_commit_sha');

      expect(result).toEqual({
        ok: false,
        status: 422,
        error: 'Update is not a fast forward',
      });
    });

    it('supports force: true option for reference updates', async () => {
      const client = new GitHubGitDataClient({
        repoFullName: 'user/repo',
        token: 'token',
      });

      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ref: 'refs/heads/main',
            object: { sha: 'old_sha' },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      );

      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ref: 'refs/heads/main',
            object: { sha: 'forced_sha' },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      );

      const result = await client.updateRef('heads/main', 'forced_sha', { force: true });

      expect(result.ok).toBe(true);
      const [, patchInit] = mockFetch.mock.calls[1] as [string, RequestInit];
      expect(JSON.parse(patchInit.body as string)).toEqual({
        sha: 'forced_sha',
        force: true,
      });
    });

    it('returns 500 error payload on unhandled network exception', async () => {
      const client = new GitHubGitDataClient({
        repoFullName: 'user/repo',
        token: 'token',
      });

      mockFetch.mockRejectedValueOnce(new Error('Connection reset by peer'));

      const result = await client.updateRef('heads/main', 'sha_123');
      expect(result).toEqual({
        ok: false,
        status: 500,
        error: 'Connection reset by peer',
      });
    });
  });
});
