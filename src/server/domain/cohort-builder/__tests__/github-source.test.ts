import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  acquireGithubSource,
  extractGithubSource,
  readOwnedGithubSource,
  type GithubSourceProvider,
} from '../github-source';
import {
  GITHUB_SOURCE_LIMITS,
  GITHUB_SOURCE_VERSION,
  type RetainedGithubSource,
} from '@/src/shared/cohort-builder/github-source';

const repoUrl = 'https://github.com/facebook/react';
const ref = 'main';
const commitSha = '1234567890abcdef1234567890abcdef12345678';
const input = { repoUrl, ref, paths: ['README.md', 'src/index.ts'] };

function createRetainedData(): RetainedGithubSource {
  const file1 = '# React\nA declarative, efficient UI library.\nUsed by thousands of companies.';
  const file2 = 'export function createElement() {\n  return { type: "div" };\n}\n';
  return {
    format: GITHUB_SOURCE_VERSION,
    acquiredAt: '2026-10-14T00:00:00.000Z',
    repo: { owner: 'facebook', repo: 'react', url: repoUrl },
    ref,
    commitSha,
    files: [
      {
        path: 'README.md',
        content: file1,
        size: Buffer.byteLength(file1),
        checksum: createHash('sha256').update(file1).digest('hex'),
      },
      {
        path: 'src/index.ts',
        content: file2,
        size: Buffer.byteLength(file2),
        checksum: createHash('sha256').update(file2).digest('hex'),
      },
    ],
  };
}

function createProviderFixture(retained: RetainedGithubSource = createRetainedData()) {
  const resolveRef = vi.fn<GithubSourceProvider['resolveRef']>(async () => ({ commitSha: retained.commitSha }));
  const fetchFiles = vi.fn<GithubSourceProvider['fetchFiles']>(async (_repo, _sha, paths) => {
    return retained.files
      .filter(f => paths.includes(f.path))
      .map(f => ({ path: f.path, content: Buffer.from(f.content, 'utf-8') }));
  });

  const provider: GithubSourceProvider = {
    id: 'github-test-fixture',
    version: '1.0.0',
    billing: 'none',
    resolveRef,
    fetchFiles,
  };

  const bytes = Buffer.from(JSON.stringify(retained), 'utf-8');
  return { bytes, resolveRef, fetchFiles, provider, retained };
}

afterEach(() => vi.useRealTimers());

describe('S4D Checkpoint 2: Bounded retained GitHub acquisition and extraction', () => {
  it('acquires files, retains JSON, and extracts line-anchored locations', async () => {
    const fixture = createProviderFixture();
    const result = await acquireGithubSource(input, fixture.provider);

    expect(fixture.resolveRef).toHaveBeenCalledWith({ owner: 'facebook', repo: 'react' }, 'main', expect.any(AbortSignal));
    expect(fixture.fetchFiles).toHaveBeenCalledWith(
      { owner: 'facebook', repo: 'react' },
      commitSha,
      ['README.md', 'src/index.ts'],
      expect.any(AbortSignal)
    );

    expect(result.extraction.repo).toEqual({ owner: 'facebook', repo: 'react', url: repoUrl });
    expect(result.extraction.commitSha).toBe(commitSha);
    expect(result.extraction.text).toContain('File: README.md');
    expect(result.extraction.text).toContain('File: src/index.ts');

    // Check line provenance locations
    expect(result.extraction.locations).toHaveLength(2);
    const loc1 = result.extraction.locations[0];
    expect(loc1.filePath).toBe('README.md');
    expect(loc1.startLine).toBe(1);
    expect(loc1.endLine).toBe(3); // 3 lines in file1

    const loc2 = result.extraction.locations[1];
    expect(loc2.filePath).toBe('src/index.ts');
    expect(loc2.startLine).toBe(1);
    expect(loc2.endLine).toBe(4); // 4 lines in file2 (including trailing newline)
  });

  it('reduces scope on retained bytes without re-calling the provider', async () => {
    const fixture = createProviderFixture();
    const result = await acquireGithubSource(input, fixture.provider);
    expect(fixture.fetchFiles).toHaveBeenCalledOnce();

    // Now extract only README.md from the retained bytes
    const scoped = extractGithubSource(result.bytes, {
      repoUrl,
      ref,
      paths: ['README.md'],
    });

    expect(scoped.fileCount).toBe(1);
    expect(scoped.text).toContain('File: README.md');
    expect(scoped.text).not.toContain('File: src/index.ts');
    expect(scoped.locations).toHaveLength(1);
    expect(scoped.locations[0].filePath).toBe('README.md');
    expect(scoped.coverage.selectedFiles).toBe(1);
    expect(scoped.coverage.totalFiles).toBe(2);

    // Provider was not called again
    expect(fixture.fetchFiles).toHaveBeenCalledOnce();
  });

  it('rejects missing or paid provider before network calls', async () => {
    await expect(acquireGithubSource(input)).rejects.toThrow('GITHUB_PROVIDER_REQUIRED');
    const fixture = createProviderFixture();
    await expect(acquireGithubSource(input, { ...fixture.provider, billing: 'paid' })).rejects.toThrow(
      'GITHUB_PROVIDER_NOT_AUTHORIZED'
    );
    expect(fixture.resolveRef).not.toHaveBeenCalled();
    expect(fixture.fetchFiles).not.toHaveBeenCalled();
  });

  it('rejects invalid or missing commit SHA from resolver', async () => {
    const fixture = createProviderFixture();
    fixture.resolveRef.mockResolvedValueOnce({ commitSha: 'not-40-hex' });
    await expect(acquireGithubSource(input, fixture.provider)).rejects.toThrow('INVALID_COMMIT_SHA');
  });

  it('rejects binary files during acquisition', async () => {
    const fixture = createProviderFixture();
    fixture.fetchFiles.mockResolvedValueOnce([
      { path: 'src/data.txt', content: Buffer.from([0xff, 0xfe, 0x00, 0x00, 0x80]) },
    ]);
    await expect(acquireGithubSource({ repoUrl, ref, paths: ['src/data.txt'] }, fixture.provider)).rejects.toThrow(
      'BINARY_FILE_REJECTED'
    );

  });

  it('enforces per-file and total size limits', async () => {
    const fixture = createProviderFixture();
    fixture.fetchFiles.mockResolvedValueOnce([
      { path: 'huge.txt', content: Buffer.alloc(GITHUB_SOURCE_LIMITS.fileBytes + 1) },
    ]);
    await expect(acquireGithubSource({ repoUrl, ref, paths: ['huge.txt'] }, fixture.provider)).rejects.toThrow(
      'SOURCE_SIZE_LIMIT'
    );
  });

  it('rejects scope paths that are not present in the retained files', () => {
    const fixture = createProviderFixture();
    expect(() =>
      extractGithubSource(fixture.bytes, {
        repoUrl,
        ref,
        paths: ['nonexistent.ts'],
      })
    ).toThrow('FILE_NOT_FOUND_IN_SOURCE');
  });

  it('rejects foreign repository and ref in retained bytes', () => {
    const fixture = createProviderFixture();
    expect(() =>
      extractGithubSource(fixture.bytes, {
        repoUrl: 'https://github.com/facebook/other-repo',
        ref,
      })
    ).toThrow('FOREIGN_GITHUB_REPOSITORY');

    expect(() =>
      extractGithubSource(fixture.bytes, {
        repoUrl,
        ref: 'other-branch',
      })
    ).toThrow('FOREIGN_GITHUB_REF');
  });

  it('handles cancellation and deadline timeouts', async () => {
    vi.useFakeTimers();
    const fixture = createProviderFixture();
    fixture.resolveRef.mockImplementation(() => new Promise(() => {}));

    const work = acquireGithubSource(input, fixture.provider);
    const rejection = expect(work).rejects.toThrow('GITHUB_DEADLINE');
    await vi.advanceTimersByTimeAsync(GITHUB_SOURCE_LIMITS.timeoutMs);
    await rejection;

    const controller = new AbortController();
    const cancelFixture = createProviderFixture();
    cancelFixture.resolveRef.mockImplementation(() => new Promise(() => {}));
    const cancelWork = acquireGithubSource(input, cancelFixture.provider, controller.signal);
    controller.abort();
    await expect(cancelWork).rejects.toThrow('GITHUB_CANCELED');
  });

  it('redacts internal provider errors to safe public code', async () => {
    const fixture = createProviderFixture();
    fixture.resolveRef.mockRejectedValueOnce(new Error('Internal GitHub rate limit reached or token leak'));
    await expect(acquireGithubSource(input, fixture.provider)).rejects.toThrow('GITHUB_PROVIDER_FAILURE');
  });

  it('reads owned GitHub artifact from database double and verifies integrity', async () => {
    const fixture = createProviderFixture();
    const bytes = fixture.bytes;
    const row = {
      id: 'artifact-gh-1',
      workspaceId: 'owned-workspace',
      sourceId: 'source-1',
      sourceVersion: 1,
      kind: 'source_raw',
      inputFingerprint: 'fingerprint-1',
      checksum: createHash('sha256').update(bytes).digest('hex'),
      byteLength: bytes.length,
      body: bytes,
    };

    const sql = {
      query: async (_statement: string, parameters: unknown[]) => ({
        rows: parameters[0] === row.workspaceId ? [row] : [],
      }),
    };

    const identity = {
      workspaceId: 'owned-workspace',
      artifactId: 'artifact-gh-1',
      sourceId: 'source-1',
      sourceVersion: 1,
      inputFingerprint: 'fingerprint-1',
    };

    const extracted = await readOwnedGithubSource(sql, identity, input);
    expect(extracted.repo.owner).toBe('facebook');
    expect(extracted.text).toContain('File: README.md');

    // Wrong workspace
    await expect(readOwnedGithubSource(sql, { ...identity, workspaceId: 'foreign' }, input)).rejects.toThrow(
      'ARTIFACT_NOT_FOUND'
    );

    // Wrong source version
    await expect(readOwnedGithubSource(sql, { ...identity, sourceVersion: 2 }, input)).rejects.toThrow(
      'FOREIGN_GITHUB_ARTIFACT'
    );
  });
});
