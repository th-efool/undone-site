import { describe, it, expect, vi } from 'vitest';
import { LiveGithubSourceProvider } from '../github-source-live';

describe('LiveGithubSourceProvider', () => {
  const sampleSha = '7fd1a60b01f91b314f59955a4e4d4e80d8edf11d';

  describe('resolveRef', () => {
    it('returns 40-character commit SHA directly without network request', async () => {
      const fetchFn = vi.fn();
      const provider = new LiveGithubSourceProvider({ fetchFn });
      const result = await provider.resolveRef({ owner: 'octocat', repo: 'Hello-World' }, sampleSha, new AbortController().signal);
      expect(result).toEqual({ commitSha: sampleSha });
      expect(fetchFn).not.toHaveBeenCalled();
    });

    it('resolves branch ref via GitHub commits endpoint', async () => {
      const fetchFn = vi.fn(async () => ({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({ sha: sampleSha }),
      } as unknown as Response));

      const provider = new LiveGithubSourceProvider({ fetchFn });
      const result = await provider.resolveRef({ owner: 'octocat', repo: 'Hello-World' }, 'master', new AbortController().signal);
      expect(result).toEqual({ commitSha: sampleSha });
      expect(fetchFn).toHaveBeenCalledWith(
        'https://api.github.com/repos/octocat/Hello-World/commits/master',
        expect.objectContaining({
          headers: expect.objectContaining({
            Accept: 'application/vnd.github+json',
            'User-Agent': 'SideQuestHQ-CohortBuilder/1.0',
          }),
        })
      );
    });

    it('throws FOREIGN_GITHUB_REF when ref is 404', async () => {
      const fetchFn = vi.fn(async () => ({
        ok: false,
        status: 404,
        headers: new Headers(),
        json: async () => ({ message: 'Not Found' }),
      } as unknown as Response));

      const provider = new LiveGithubSourceProvider({ fetchFn });
      await expect(
        provider.resolveRef({ owner: 'octocat', repo: 'Hello-World' }, 'nonexistent-branch', new AbortController().signal)
      ).rejects.toThrow('FOREIGN_GITHUB_REF');
    });

    it('throws GITHUB_PROVIDER_FAILURE on rate limits or server errors', async () => {
      const fetchFn = vi.fn(async () => ({
        ok: false,
        status: 403,
        headers: new Headers({ 'x-ratelimit-remaining': '0' }),
        json: async () => ({ message: 'API rate limit exceeded' }),
      } as unknown as Response));

      const provider = new LiveGithubSourceProvider({ fetchFn });
      await expect(
        provider.resolveRef({ owner: 'octocat', repo: 'Hello-World' }, 'master', new AbortController().signal)
      ).rejects.toThrow('GITHUB_PROVIDER_FAILURE');
    });

    it('throws GITHUB_CANCELED when caller signal is aborted', async () => {
      const controller = new AbortController();
      controller.abort();
      const provider = new LiveGithubSourceProvider();
      await expect(
        provider.resolveRef({ owner: 'octocat', repo: 'Hello-World' }, 'master', controller.signal)
      ).rejects.toThrow('GITHUB_CANCELED');
    });
  });

  describe('fetchFiles', () => {
    it('fetches and decodes base64-encoded files', async () => {
      const contentStr = 'Hello World!\nWelcome to SideQuest.';
      const base64Content = Buffer.from(contentStr, 'utf-8').toString('base64');

      const fetchFn = vi.fn(async () => ({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({
          type: 'file',
          encoding: 'base64',
          content: base64Content,
          size: Buffer.byteLength(contentStr),
        }),
      } as unknown as Response));

      const provider = new LiveGithubSourceProvider({ fetchFn });
      const files = await provider.fetchFiles(
        { owner: 'octocat', repo: 'Hello-World' },
        sampleSha,
        ['README.md'],
        new AbortController().signal
      );

      expect(files).toHaveLength(1);
      expect(files[0].path).toBe('README.md');
      expect(new TextDecoder().decode(files[0].content)).toBe(contentStr);
    });

    it('rejects directory/non-file entries with BINARY_FILE_REJECTED', async () => {
      const fetchFn = vi.fn(async () => ({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({
          type: 'dir',
          content: null,
        }),
      } as unknown as Response));

      const provider = new LiveGithubSourceProvider({ fetchFn });
      await expect(
        provider.fetchFiles({ owner: 'octocat', repo: 'Hello-World' }, sampleSha, ['src'], new AbortController().signal)
      ).rejects.toThrow('BINARY_FILE_REJECTED');
    });

    it('rejects missing file (404) with FILE_NOT_FOUND_IN_SOURCE', async () => {
      const fetchFn = vi.fn(async () => ({
        ok: false,
        status: 404,
        headers: new Headers(),
        json: async () => ({ message: 'Not Found' }),
      } as unknown as Response));

      const provider = new LiveGithubSourceProvider({ fetchFn });
      await expect(
        provider.fetchFiles({ owner: 'octocat', repo: 'Hello-World' }, sampleSha, ['nonexistent.ts'], new AbortController().signal)
      ).rejects.toThrow('FILE_NOT_FOUND_IN_SOURCE');
    });

    it('enforces GITHUB_SOURCE_LIMITS file size limit', async () => {
      const bigBuffer = Buffer.alloc(600 * 1024, 'a'); // 600 KB > 500 KB limit
      const fetchFn = vi.fn(async () => ({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({
          type: 'file',
          encoding: 'base64',
          content: bigBuffer.toString('base64'),
          size: bigBuffer.byteLength,
        }),
      } as unknown as Response));

      const provider = new LiveGithubSourceProvider({ fetchFn });
      await expect(
        provider.fetchFiles({ owner: 'octocat', repo: 'Hello-World' }, sampleSha, ['big.txt'], new AbortController().signal)
      ).rejects.toThrow('SOURCE_SIZE_LIMIT');
    });

    it('rejects empty paths array with NO_FILES_FETCHED', async () => {
      const provider = new LiveGithubSourceProvider();
      await expect(
        provider.fetchFiles({ owner: 'octocat', repo: 'Hello-World' }, sampleSha, [], new AbortController().signal)
      ).rejects.toThrow('NO_FILES_FETCHED');
    });
  });

  describe('Real public GitHub API smoke test (unauthenticated)', () => {
    it('successfully fetches README from octocat/Hello-World within unauthenticated limits', async () => {
      const provider = new LiveGithubSourceProvider();
      try {
        const resolved = await provider.resolveRef(
          { owner: 'octocat', repo: 'Hello-World' },
          'master',
          AbortSignal.timeout(10_000)
        );
        expect(resolved.commitSha).toMatch(/^[a-f0-9]{40}$/);

        const files = await provider.fetchFiles(
          { owner: 'octocat', repo: 'Hello-World' },
          resolved.commitSha,
          ['README'],
          AbortSignal.timeout(10_000)
        );
        expect(files).toHaveLength(1);
        expect(files[0].path).toBe('README');
        const text = new TextDecoder().decode(files[0].content);
        expect(text).toContain('Hello World!');
      } catch (err: any) {
        // If unauthenticated IP rate limit is hit in CI, ensure it threw honest GITHUB_PROVIDER_FAILURE
        if (err.message === 'GITHUB_PROVIDER_FAILURE') {
          // Acceptable when GitHub public rate limit (60/hr) is exceeded on shared runner IP
          return;
        }
        throw err;
      }
    });
  });
});
