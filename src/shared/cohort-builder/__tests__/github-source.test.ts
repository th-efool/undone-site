import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  singleGithubRepo,
  githubRepoUrlSchema,
  githubRefSchema,
  isValidGithubFilePath,
  githubPathSchema,
  githubPathsSchema,
  retainedGithubSourceSchema,
  GITHUB_SOURCE_VERSION,
  GITHUB_SOURCE_LIMITS,
} from '../github-source';
import { sourceCapability } from '@/src/server/domain/cohort-builder/source-policy';
import { githubSourceReadiness } from '@/src/server/domain/cohort-builder/github-policy';
import { planCohortAction, cohortWorkspaceSchema, type CohortWorkspace } from '../contracts';

describe('S4D Checkpoint 1: GitHub source contracts and policy', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.INTERACTION_GITHUB_ENABLED;
    delete process.env.INTERACTION_GITHUB_TEST_MOCK;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('Repository URL normalization and validation', () => {
    it('accepts valid GitHub repository URLs and normalizes them', () => {
      expect(singleGithubRepo('https://github.com/facebook/react')).toEqual({
        owner: 'facebook',
        repo: 'react',
        url: 'https://github.com/facebook/react',
      });
      expect(singleGithubRepo('https://www.github.com/facebook/react.git/')).toEqual({
        owner: 'facebook',
        repo: 'react',
        url: 'https://github.com/facebook/react',
      });
      expect(singleGithubRepo('https://github.com/org-name/repo.js')).toEqual({
        owner: 'org-name',
        repo: 'repo.js',
        url: 'https://github.com/org-name/repo.js',
      });
    });

    it('rejects invalid or unsafe GitHub URLs', () => {
      const invalid = [
        'http://github.com/owner/repo',
        'https://gitlab.com/owner/repo',
        'https://github.com/owner/repo/pull/1',
        'https://github.com/owner/repo/blob/main/README.md',
        'https://user:pass@github.com/owner/repo',
        'https://github.com:8080/owner/repo',
        'https://github.com/owner/repo?ref=main',
        'https://github.com/owner/repo#readme',
        'https://github.com/owner/../repo',
        'https://github.com/owner',
        'https://github.com/',
        'https://github.com/owner/repo/extra/path',
        'javascript:alert(1)',
      ];
      for (const url of invalid) {
        expect(() => singleGithubRepo(url)).toThrow('INVALID_GITHUB_REPO_URL');
      }
    });

    it('validates via githubRepoUrlSchema', () => {
      expect(githubRepoUrlSchema.parse('https://github.com/torvalds/linux.git')).toBe('https://github.com/torvalds/linux');
      expect(() => githubRepoUrlSchema.parse('https://evil.com/a/b')).toThrow();
    });
  });

  describe('Git ref validation', () => {
    it('accepts valid branch, tag, and SHA references', () => {
      expect(githubRefSchema.parse('main')).toBe('main');
      expect(githubRefSchema.parse('feature/login-v2')).toBe('feature/login-v2');
      expect(githubRefSchema.parse('v1.0.4')).toBe('v1.0.4');
      expect(githubRefSchema.parse('759b0bca25602be838973fad12b7b6b1b0a9de32')).toBe('759b0bca25602be838973fad12b7b6b1b0a9de32');
    });

    it('rejects malformed or traversal refs', () => {
      expect(() => githubRefSchema.parse('/leading/slash')).toThrow();
      expect(() => githubRefSchema.parse('trailing/slash/')).toThrow();
      expect(() => githubRefSchema.parse('double//slash')).toThrow();
      expect(() => githubRefSchema.parse('../traversal')).toThrow();
      expect(() => githubRefSchema.parse('.hidden')).toThrow();
      expect(() => githubRefSchema.parse('')).toThrow();
    });
  });

  describe('File path filtering and limits', () => {
    it('accepts valid text and code paths', () => {
      const valid = [
        'README.md',
        'docs/index.mdx',
        'src/components/Button.tsx',
        'packages/core/src/index.ts',
        'python/module/main.py',
        'config.yaml',
        'schema.sql',
        'styles.css',
      ];
      for (const path of valid) {
        expect(isValidGithubFilePath(path)).toBe(true);
        expect(githubPathSchema.parse(path)).toBe(path);
      }
    });

    it('rejects binary files, lockfiles, traversal, and absolute paths', () => {
      const invalid = [
        '/absolute/path.ts',
        'path/with/../traversal.ts',
        'binary.exe',
        'archive.zip',
        'image.png',
        'photo.jpg',
        'document.pdf',
        'package-lock.json',
        'yarn.lock',
        'pnpm-lock.yaml',
        'cargo.lock',
        'empty//path.ts',
        'trailing/slash/',
      ];
      for (const path of invalid) {
        expect(isValidGithubFilePath(path)).toBe(false);
        expect(() => githubPathSchema.parse(path)).toThrow();
      }
    });

    it('enforces file list limits and deduplication', () => {
      expect(() => githubPathsSchema.parse([])).toThrow();
      expect(() => githubPathsSchema.parse(['src/a.ts', 'src/a.ts'])).toThrow(/Duplicate/);

      const tooMany = Array.from({ length: 26 }, (_, i) => `src/file${i}.ts`);
      expect(() => githubPathsSchema.parse(tooMany)).toThrow();

      const validList = ['README.md', 'src/index.ts', 'docs/intro.md'];
      expect(githubPathsSchema.parse(validList)).toEqual(validList);
    });
  });

  describe('Retained GitHub source schema', () => {
    const validRetained = {
      format: GITHUB_SOURCE_VERSION,
      acquiredAt: '2026-10-14T12:00:00.000Z',
      repo: {
        owner: 'facebook',
        repo: 'react',
        url: 'https://github.com/facebook/react',
      },
      ref: 'main',
      commitSha: 'a'.repeat(40),
      files: [
        {
          path: 'README.md',
          content: '# React\nA declarative UI library',
          size: 32,
          checksum: 'b'.repeat(64),
        },
      ],
    };

    it('validates a schema-conforming retained source', () => {
      const parsed = retainedGithubSourceSchema.parse(validRetained);
      expect(parsed.repo.repo).toBe('react');
      expect(parsed.commitSha).toHaveLength(40);
      expect(parsed.files).toHaveLength(1);
    });

    it('rejects commit SHA that is not 40 hex characters', () => {
      expect(() => retainedGithubSourceSchema.parse({ ...validRetained, commitSha: 'not-a-sha' })).toThrow();
      expect(() => retainedGithubSourceSchema.parse({ ...validRetained, commitSha: 'a'.repeat(39) })).toThrow();
    });

    it('rejects repo identity mismatch', () => {
      expect(() =>
        retainedGithubSourceSchema.parse({
          ...validRetained,
          repo: {
            owner: 'facebook',
            repo: 'other-repo',
            url: 'https://github.com/facebook/react',
          },
        })
      ).toThrow(/mismatch/);
    });

    it('rejects total files size exceeding 2MB', () => {
      expect(() =>
        retainedGithubSourceSchema.parse({
          ...validRetained,
          files: [
            {
              path: 'file1.ts',
              content: 'x',
              size: GITHUB_SOURCE_LIMITS.totalBytes + 1,
              checksum: 'b'.repeat(64),
            },
          ],
        })
      ).toThrow();
    });
  });

  describe('Capability gating and readiness', () => {
    it('is disabled by default', () => {
      expect(githubSourceReadiness()).toEqual({ enabled: false, code: 'GITHUB_CAPABILITY_DISABLED' });
      expect(sourceCapability('github')).toBe(false);
    });

    it('is enabled when INTERACTION_GITHUB_ENABLED is 1', () => {
      process.env.INTERACTION_GITHUB_ENABLED = '1';
      expect(githubSourceReadiness()).toEqual({ enabled: true, code: null });
      expect(sourceCapability('github')).toBe(true);
    });

    it('allows test mock override in test environment', () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = 'test';
      process.env.INTERACTION_GITHUB_ENABLED = '1';
      process.env.INTERACTION_GITHUB_TEST_MOCK = '1';
      expect(sourceCapability('github')).toBe(true);
    });
  });

  describe('Canonical action planning', () => {
    const createBaseWorkspace = (): CohortWorkspace =>
      cohortWorkspaceSchema.parse({
        schemaVersion: 1,
        title: 'Test Cohort',
        intent: 'Learn testing',
        audience: 'Developers',
        dailyMinutes: 15,
        lessons: [],
        sources: [],
        chunks: [],
        understanding: [],
        analyses: [],
        processing: { status: 'idle', stage: 'done', generation: 0, sourceFingerprint: null, error: null },
      });

    it('plans add_github_source with correct queued source and stage transition', () => {
      const state = createBaseWorkspace();
      const plan = planCohortAction(
        state,
        {
          type: 'add_github_source',
          label: 'React repo docs',
          repoUrl: 'https://github.com/facebook/react',
          ref: 'main',
          paths: ['README.md', 'docs/intro.md'],
        },
        {
          actionId: 'action-1',
          workspaceId: 'workspace-1',
          expectedRevision: 0,
          currentRevision: 0,
          entityVersions: new Map(),
        }
      );

      expect(plan.summary).toContain('Added GitHub source: React repo docs');
      expect(plan.nextState.sources).toHaveLength(1);
      const source = plan.nextState.sources[0];
      expect(source.label).toBe('React repo docs');
      expect(source.state).toBe('queued');
      expect(source.input).toEqual({
        kind: 'github',
        repoUrl: 'https://github.com/facebook/react',
        ref: 'main',
        paths: ['README.md', 'docs/intro.md'],
      });
      expect(plan.nextState.processing.status).toBe('queued');
      expect(plan.nextState.processing.stage).toBe('acquisition');
    });

    it('plans set_github_scope to update paths and increment source version', () => {
      const state = createBaseWorkspace();
      state.sources.push({
        id: 'source-gh-1',
        version: 1,
        label: 'React repo',
        text: 'old text',
        state: 'ready',
        checksum: 'c'.repeat(64),
        input: {
          kind: 'github',
          repoUrl: 'https://github.com/facebook/react',
          ref: 'main',
          paths: ['README.md'],
        },
        locations: [{ start: 0, end: 10, filePath: 'README.md', startLine: 1, endLine: 5 }],
        provenance: {
          parserVersion: 'github-source-v1',
          rawChecksum: 'd'.repeat(64),
          scope: 'selected_files',
          repoUrl: 'https://github.com/facebook/react',
          ref: 'main',
          commitSha: 'e'.repeat(40),
          fileCount: 1,
        },
      });

      const plan = planCohortAction(
        state,
        {
          type: 'set_github_scope',
          sourceId: 'source-gh-1',
          paths: ['README.md', 'packages/react/src/index.ts'],
        },
        {
          actionId: 'action-2',
          workspaceId: 'workspace-1',
          expectedRevision: 0,
          currentRevision: 0,
          entityVersions: new Map([['source-gh-1', 1]]),
        }
      );

      expect(plan.summary).toBe('Source scope updated.');
      const updated = plan.nextState.sources[0];
      expect(updated.version).toBe(2);
      expect(updated.state).toBe('queued');
      expect(updated.text).toBe('');
      expect(updated.locations).toBeUndefined();
      expect(updated.provenance).toBeUndefined();
      expect(updated.input).toEqual({
        kind: 'github',
        repoUrl: 'https://github.com/facebook/react',
        ref: 'main',
        paths: ['README.md', 'packages/react/src/index.ts'],
      });
    });

    it('rejects set_github_scope with stale entity version', () => {
      const state = createBaseWorkspace();
      state.sources.push({
        id: 'source-gh-1',
        version: 2,
        label: 'React repo',
        text: '',
        state: 'ready',
        checksum: null,
        input: {
          kind: 'github',
          repoUrl: 'https://github.com/facebook/react',
          ref: 'main',
        },
      });

      expect(() =>
        planCohortAction(
          state,
          {
            type: 'set_github_scope',
            sourceId: 'source-gh-1',
            paths: ['README.md'],
          },
          {
            actionId: 'action-3',
            workspaceId: 'workspace-1',
            expectedRevision: 0,
            currentRevision: 0,
            entityVersions: new Map([['source-gh-1', 1]]), // stale!
          }
        )
      ).toThrow('STALE_ENTITY');
    });

    it('rejects set_github_scope on non-github source', () => {
      const state = createBaseWorkspace();
      state.sources.push({
        id: 'source-web-1',
        version: 1,
        label: 'Web source',
        text: '',
        state: 'ready',
        checksum: null,
        input: {
          kind: 'web',
          url: 'https://example.com',
        },
      });

      expect(() =>
        planCohortAction(
          state,
          {
            type: 'set_github_scope',
            sourceId: 'source-web-1',
            paths: ['README.md'],
          },
          {
            actionId: 'action-4',
            workspaceId: 'workspace-1',
            expectedRevision: 0,
            currentRevision: 0,
            entityVersions: new Map(),
          }
        )
      ).toThrow('INVALID_GITHUB_SOURCE');
    });
  });
});
