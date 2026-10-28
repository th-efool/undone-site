import { readFileSync as readFs } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('@/src/server/infrastructure/db/postgres/client', () => ({ prisma: {} }));
import { createPostgresInteractionRepository } from '@/src/server/infrastructure/db/postgres/repositories/interaction.repo';
import { cohortWorkspaceSchema, planCohortAction } from '@/src/shared/cohort-builder/contracts';
import { claimTextJob } from '../text-jobs';
import { runDurableTextJobTick } from '../durable-text-worker';
import { putTextArtifact } from '../text-artifacts';
import { acceptCurrentTextJob } from '../text-job-acceptance';
import type { GithubSourceProvider } from '../github-source';
import { GITHUB_SOURCE_VERSION, type RetainedGithubSource } from '@/src/shared/cohort-builder/github-source';
import { createHash } from 'node:crypto';

afterEach(() => vi.unstubAllEnvs());

const id = '7d4e49d0-bad0-4aba-a777-122326020099';
const ownerId = 'owner-s4d';
const s3Migration = readFs(new URL('../../../../../prisma/sql/interaction/interaction-s3-storage.sql', import.meta.url), 'utf8');
const s4bMigration = readFs(new URL('../../../../../prisma/sql/interaction/interaction-s4b-sources.sql', import.meta.url), 'utf8');

const repoUrl = 'https://github.com/facebook/react';
const ref = 'main';
const commitSha = '1234567890abcdef1234567890abcdef12345678';

function makeRetainedGithubSource(): RetainedGithubSource {
  const file1 = '# React Documentation\nA declarative, efficient UI library.\nSupports components and hooks.';
  const file2 = 'export function useState(initial) {\n  return [initial, () => {}];\n}\n';
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
        path: 'src/hooks.ts',
        content: file2,
        size: Buffer.byteLength(file2),
        checksum: createHash('sha256').update(file2).digest('hex'),
      },
    ],
  };
}

function mockProvider(customData?: RetainedGithubSource) {
  const retained = customData ?? makeRetainedGithubSource();
  const resolveRef = vi.fn<GithubSourceProvider['resolveRef']>(async () => ({ commitSha: retained.commitSha }));
  const fetchFiles = vi.fn<GithubSourceProvider['fetchFiles']>(async (_repo, _sha, paths) => {
    return retained.files
      .filter(f => paths.includes(f.path))
      .map(f => ({ path: f.path, content: Buffer.from(f.content, 'utf-8') }));
  });
  const provider: GithubSourceProvider = {
    id: 'mock-github-fixture',
    version: '1.0.0',
    billing: 'none',
    resolveRef,
    fetchFiles,
  };
  return { provider, resolveRef, fetchFiles, retained };
}

async function fixture() {
  const db = new PGlite();
  await db.exec(`CREATE TABLE interaction_workspaces (id TEXT PRIMARY KEY, "ownerId" TEXT, "domainId" TEXT,
    "domainVersion" INT DEFAULT 1, snapshot JSONB, revision INT DEFAULT 0, sequence INT DEFAULT 0,
    "contextEpoch" INT DEFAULT 0, lifecycle TEXT DEFAULT 'active', "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE interaction_requests ("workspaceId" TEXT, "actorId" TEXT, operation TEXT, "requestId" TEXT,
    "payloadHash" TEXT, response JSONB, UNIQUE ("workspaceId", "actorId", operation, "requestId"));
    CREATE TABLE interaction_events (id TEXT, "workspaceId" TEXT, sequence INT, payload JSONB,
    "protocolVersion" INT, type TEXT, revision INT, UNIQUE ("workspaceId", sequence));
    CREATE TABLE interaction_messages (id TEXT PRIMARY KEY, "workspaceId" TEXT, role TEXT, parts JSONB,
    sequence INT, "runId" TEXT, "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`);
  await db.exec(s3Migration);
  await db.exec(s4bMigration);
  await db.query(`INSERT INTO interaction_workspaces (id, "ownerId", "domainId", snapshot) VALUES ($1,$2,'cohort',$3::jsonb)`,
    [id, ownerId, JSON.stringify(cohortWorkspaceSchema.parse({
      schemaVersion: 1, title: 'GitHub Test', intent: 'Understand React library architecture', audience: 'engineers', dailyMinutes: 20, lessons: [],
    }))]);
  const prisma = {
    interactionWorkspace: {
      findFirst: async ({ where }: any) => (await db.query(`SELECT * FROM interaction_workspaces WHERE id=$1 AND "ownerId"=$2`, [where.id, where.ownerId])).rows[0],
    },
    interactionMessage: {
      findMany: async ({ where, take }: any) => (await db.query(`SELECT * FROM interaction_messages
        WHERE "workspaceId"=$1 AND sequence<$2 ORDER BY sequence DESC LIMIT $3`, [where.workspaceId, where.sequence?.lt ?? 2147483647, take])).rows,
    },
    $transaction: async (work: (tx: unknown) => Promise<unknown>) => db.transaction(async tx => work({
      $queryRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => (await tx.query(strings.reduce((sql, part, index) => sql + (index ? `$${index}` : '') + part, ''), values)).rows,
      $queryRawUnsafe: async (sql: string, ...values: unknown[]) => (await tx.query(sql, values)).rows,
      interactionRequest: {
        findUnique: async ({ where }: any) => {
          const key = where.workspaceId_actorId_operation_requestId;
          return (await tx.query(`SELECT * FROM interaction_requests WHERE "workspaceId"=$1 AND "actorId"=$2 AND operation=$3 AND "requestId"=$4`,
            [key.workspaceId, key.actorId, key.operation, key.requestId])).rows[0] ?? null;
        },
        create: async ({ data }: any) => tx.query(`INSERT INTO interaction_requests VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,
          [data.workspaceId, data.actorId, data.operation, data.requestId, data.payloadHash, JSON.stringify(data.response)]),
      },
      interactionWorkspace: {
        update: async ({ where, data }: any) => data.snapshot === undefined
          ? tx.query(`UPDATE interaction_workspaces SET sequence=$1 WHERE id=$2`, [data.sequence, where.id])
          : tx.query(`UPDATE interaction_workspaces SET snapshot=$1::jsonb, revision=$2, sequence=$3, "contextEpoch"="contextEpoch"+1 WHERE id=$4`,
            [JSON.stringify(data.snapshot), data.revision, data.sequence, where.id]),
      },
      interactionEvent: {
        create: async ({ data }: any) => tx.query(`INSERT INTO interaction_events (id, "workspaceId", sequence, payload, "protocolVersion", type, revision)
          VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7)`, [data.id, data.workspaceId, data.sequence, JSON.stringify(data.payload), data.protocolVersion, data.type, data.revision]),
      },
      interactionMessage: {
        create: async ({ data }: any) => (await tx.query(`INSERT INTO interaction_messages (id,"workspaceId",role,parts,sequence,"runId")
          VALUES ($1,$2,$3,$4::jsonb,$5,$6) RETURNING *`, [data.id, data.workspaceId, data.role, JSON.stringify(data.parts), data.sequence, data.runId])).rows[0],
      },
    })),
  };
  const repo = createPostgresInteractionRepository(prisma as any);
  const sql = { query: (s: string, p: unknown[]) => db.query<Record<string, unknown>>(s, p) };
  const port = { transaction: <T>(work: (tx: typeof sql) => Promise<T>) => db.transaction(tx => work({ query: (s, p) => tx.query<Record<string, unknown>>(s, p) })) };
  return { db, repo, sql, port };
}

describe('GitHub source canonical actions and durable DAG integration', { timeout: 20_000 }, () => {
  it('enforces capability gating by rejecting GitHub actions when disabled', async () => {
    vi.stubEnv('INTERACTION_TEXT_DRIVER', 'durable');
    // INTERACTION_GITHUB_ENABLED is omitted
    const { db, repo } = await fixture();
    try {
      await expect(repo.commitAction({
        ownerId, workspaceId: id, expectedRevision: 0, requestId: 'req-gate-gh-1',
        envelope: {
          actionId: crypto.randomUUID(), workspaceId: id, expectedRevision: 0, entityVersions: [],
          action: { type: 'add_github_source', sourceId: 'gh-1', label: 'React Docs', repoUrl, ref, paths: ['README.md'] },
        },
        plan: planCohortAction,
      })).rejects.toThrow('SOURCE_CAPABILITY_DISABLED');
    } finally {
      await db.close();
    }
  });

  it('runs complete DAG from add_github_source through acquisition, extraction, chunking and assembly', async () => {
    vi.stubEnv('INTERACTION_TEXT_DRIVER', 'durable');
    vi.stubEnv('INTERACTION_GITHUB_ENABLED', '1');
    vi.stubEnv('INTERACTION_GITHUB_TEST_MOCK', '1');
    const { db, repo, sql, port } = await fixture();
    const mp = mockProvider();
    try {
      // 1. Commit canonical add_github_source
      await repo.commitAction({
        ownerId, workspaceId: id, expectedRevision: 0, requestId: 'req-add-gh',
        envelope: {
          actionId: crypto.randomUUID(), workspaceId: id, expectedRevision: 0, entityVersions: [],
          action: { type: 'add_github_source', sourceId: 'gh-source', label: 'React Repo', repoUrl, ref, paths: ['README.md', 'src/hooks.ts'] },
        },
        plan: planCohortAction,
      });

      const loadWorkspace = async () => (await sql.query(`SELECT snapshot FROM interaction_workspaces WHERE id=$1`, [id])).rows[0].snapshot;
      const now = () => new Date('2030-01-01T00:00:00.000Z');
      const tick = () => runDurableTextJobTick({
        sql, transaction: port, workerId: 'worker-gh', leaseMs: 60_000, now, loadWorkspace,
        githubSourceProvider: mp.provider,
      });

      // 2. Tick acquisition: acquires retained bytes
      const t1 = await tick();
      expect(t1.status).toBe('accepted');
      expect(mp.resolveRef).toHaveBeenCalledOnce();
      expect(mp.fetchFiles).toHaveBeenCalledOnce();

      // Check state after acquisition: retainedInputId present, text still empty
      let ws = cohortWorkspaceSchema.parse(await loadWorkspace());
      expect(ws.sources[0].retainedInputId).toBeDefined();
      expect(ws.sources[0].text).toBe('');

      // 3. Tick extraction: extracts text and locations with line numbers
      const t2 = await tick();
      expect(t2.status).toBe('accepted');
      ws = cohortWorkspaceSchema.parse(await loadWorkspace());
      expect(ws.sources[0].extractionId).toBeDefined();
      expect(ws.sources[0].text).toContain('File: README.md');
      expect(ws.sources[0].text).toContain('File: src/hooks.ts');
      expect(ws.sources[0].locations).toHaveLength(2);
      expect(ws.sources[0].locations![0]).toMatchObject({
        filePath: 'README.md', startLine: 1, endLine: 3,
      });
      expect(ws.sources[0].provenance).toMatchObject({
        parserVersion: 'github-source-v1',
        scope: 'selected_files',
        repoUrl,
        commitSha,
        fileCount: 2,
      });

      // 4. Tick understanding, chunking, analysis, assembly
      const t3 = await tick(); // understanding
      expect(t3.status).toBe('accepted');
      const t4 = await tick(); // chunking
      expect(t4.status).toBe('accepted');
      const t5 = await tick(); // analysis
      expect(t5.status).toBe('accepted');
      const t6 = await tick(); // assembly
      expect(t6.status).toBe('accepted');

      // 5. Verify assembly output and grounded lessons
      ws = cohortWorkspaceSchema.parse(await loadWorkspace());
      expect(ws.processing.status).toBe('ready');
      expect(ws.processing.stage).toBe('done');
      expect(ws.lessons.length).toBeGreaterThan(0);
      for (const lesson of ws.lessons) {
        expect(lesson.sourceChunkIds.length).toBeGreaterThan(0);
        for (const chunkId of lesson.sourceChunkIds) {
          const chunk = ws.chunks.find(c => c.id === chunkId);
          expect(chunk).toBeDefined();
          expect(chunk!.sourceId).toBe('gh-source');
        }
      }
    } finally {
      await db.close();
    }
  });

  it('updates scope without re-acquiring file bytes from provider', async () => {
    vi.stubEnv('INTERACTION_TEXT_DRIVER', 'durable');
    vi.stubEnv('INTERACTION_GITHUB_ENABLED', '1');
    vi.stubEnv('INTERACTION_GITHUB_TEST_MOCK', '1');
    const { db, repo, sql, port } = await fixture();
    const mp = mockProvider();
    try {
      await repo.commitAction({
        ownerId, workspaceId: id, expectedRevision: 0, requestId: 'req-scope-1',
        envelope: {
          actionId: crypto.randomUUID(), workspaceId: id, expectedRevision: 0, entityVersions: [],
          action: { type: 'add_github_source', sourceId: 'gh-scope-src', label: 'React Repo', repoUrl, ref, paths: ['README.md', 'src/hooks.ts'] },
        },
        plan: planCohortAction,
      });

      const loadWorkspace = async () => (await sql.query(`SELECT snapshot FROM interaction_workspaces WHERE id=$1`, [id])).rows[0].snapshot;
      const now = () => new Date('2030-01-01T00:00:00.000Z');
      const tick = () => runDurableTextJobTick({
        sql, transaction: port, workerId: 'worker-gh', leaseMs: 60_000, now, loadWorkspace,
        githubSourceProvider: mp.provider,
      });

      // Run DAG through assembly
      for (let i = 0; i < 6; i++) await tick();

      expect(mp.fetchFiles).toHaveBeenCalledTimes(1);
      let ws = cohortWorkspaceSchema.parse(await loadWorkspace());
      const initialRetainedId = ws.sources[0].retainedInputId;
      expect(ws.sources[0].locations).toHaveLength(2);

      // Now dispatch set_github_scope to narrow to README.md only
      const currentRev = (await sql.query(`SELECT revision FROM interaction_workspaces WHERE id=$1`, [id])).rows[0].revision as number;
      await repo.commitAction({
        ownerId, workspaceId: id, expectedRevision: currentRev, requestId: 'req-scope-2',
        envelope: {
          actionId: crypto.randomUUID(), workspaceId: id, expectedRevision: currentRev,
          entityVersions: [{ kind: 'source', id: 'gh-scope-src', version: ws.sources[0].version }],
          action: { type: 'set_github_scope', sourceId: 'gh-scope-src', paths: ['README.md'] },
        },
        plan: planCohortAction,
      });

      ws = cohortWorkspaceSchema.parse(await loadWorkspace());
      expect(ws.sources[0].version).toBe(1);
      expect(ws.sources[0].retainedInputId).toBe(initialRetainedId); // retainedInputId preserved!

      // Tick acquisition -> reuses retained bytes!
      const t1 = await tick();
      expect(t1.status).toBe('accepted');
      expect(mp.fetchFiles).toHaveBeenCalledTimes(1); // Provider NOT called again!

      // Tick extraction -> extracts only README.md
      const t2 = await tick();
      expect(t2.status).toBe('accepted');
      ws = cohortWorkspaceSchema.parse(await loadWorkspace());
      expect(ws.sources[0].locations).toHaveLength(1);
      expect(ws.sources[0].locations![0].filePath).toBe('README.md');
      expect(ws.sources[0].provenance?.fileCount).toBe(1);
    } finally {
      await db.close();
    }
  });

  it('records honest failed state when provider fails and allows retry', async () => {
    vi.stubEnv('INTERACTION_TEXT_DRIVER', 'durable');
    vi.stubEnv('INTERACTION_GITHUB_ENABLED', '1');
    vi.stubEnv('INTERACTION_GITHUB_TEST_MOCK', '1');
    const { db, repo, sql, port } = await fixture();
    const mp = mockProvider();
    mp.resolveRef.mockRejectedValueOnce(new Error('Rate limit exceeded on GitHub'));
    try {
      await repo.commitAction({
        ownerId, workspaceId: id, expectedRevision: 0, requestId: 'req-fail-gh',
        envelope: {
          actionId: crypto.randomUUID(), workspaceId: id, expectedRevision: 0, entityVersions: [],
          action: { type: 'add_github_source', sourceId: 'gh-fail-src', label: 'Failing Repo', repoUrl, ref, paths: ['README.md'] },
        },
        plan: planCohortAction,
      });

      const loadWorkspace = async () => (await sql.query(`SELECT snapshot FROM interaction_workspaces WHERE id=$1`, [id])).rows[0].snapshot;
      const now = () => new Date('2030-01-01T00:00:00.000Z');
      const tick = () => runDurableTextJobTick({
        sql, transaction: port, workerId: 'worker-gh', leaseMs: 60_000, now, loadWorkspace,
        githubSourceProvider: mp.provider,
      });

      const t1 = await tick();
      expect(t1.status).toBe('failed');
      const ws = cohortWorkspaceSchema.parse(await loadWorkspace());
      expect(ws.processing.status).toBe('failed');
      expect(ws.processing.error).toBe('GITHUB_PROVIDER_FAILURE');

      // Now restore provider and retry
      mp.resolveRef.mockResolvedValueOnce({ commitSha });
      const currentRev = (await sql.query(`SELECT revision FROM interaction_workspaces WHERE id=$1`, [id])).rows[0].revision as number;
      await repo.commitAction({
        ownerId, workspaceId: id, expectedRevision: currentRev, requestId: 'req-retry-gh',
        envelope: {
          actionId: crypto.randomUUID(), workspaceId: id, expectedRevision: currentRev, entityVersions: [],
          action: { type: 'retry_text_job', jobId: String(t1.jobId) },
        },
        plan: planCohortAction,
      });

      const t2 = await tick();
      expect(t2.status).toBe('accepted');
    } finally {
      await db.close();
    }
  });

  it('rejects fabricated extraction and enforces CAS consistency', async () => {
    vi.stubEnv('INTERACTION_TEXT_DRIVER', 'durable');
    vi.stubEnv('INTERACTION_GITHUB_ENABLED', '1');
    vi.stubEnv('INTERACTION_GITHUB_TEST_MOCK', '1');
    const { db, repo, sql, port } = await fixture();
    const mp = mockProvider();
    try {
      await repo.commitAction({
        ownerId, workspaceId: id, expectedRevision: 0, requestId: 'req-fab-gh',
        envelope: {
          actionId: crypto.randomUUID(), workspaceId: id, expectedRevision: 0, entityVersions: [],
          action: { type: 'add_github_source', sourceId: 'gh-fab-src', label: 'Fabrication Test', repoUrl, ref, paths: ['README.md'] },
        },
        plan: planCohortAction,
      });

      const loadWorkspace = async () => (await sql.query(`SELECT snapshot FROM interaction_workspaces WHERE id=$1`, [id])).rows[0].snapshot;
      const now = () => new Date('2030-01-01T00:00:00.000Z');
      const tick = () => runDurableTextJobTick({
        sql, transaction: port, workerId: 'worker-gh', leaseMs: 60_000, now, loadWorkspace,
        githubSourceProvider: mp.provider,
      });

      // 1. Tick acquisition -> accepted
      await tick();

      // 2. Claim extraction job manually
      const claimed = await claimTextJob(sql, 'adversary-worker', now(), 60_000);
      expect(claimed?.stage).toBe('extraction');

      // 3. Put fabricated extraction artifact citing fake lines
      const fakeChecksum = createHash('sha256').update('fabricated-gh').digest('hex');
      const fakeExtraction = {
        format: 'cohort-extraction-v1',
        text: 'Fabricated code with no grounding.',
        locations: [{ start: 0, end: 35, filePath: 'README.md', startLine: 999, endLine: 1000 }],
        provenance: {
          parserVersion: 'github-source-v1',
          rawChecksum: fakeChecksum, // mismatch with rawChecksum!
          scope: 'selected_files',
          repoUrl,
          ref,
          commitSha,
        },
      };
      const fakeBytes = Buffer.from(JSON.stringify(fakeExtraction), 'utf8');
      const artifactRef = await putTextArtifact(sql, {
        workspaceId: id,
        sourceId: claimed!.sourceId!,
        sourceVersion: claimed!.sourceVersion!,
        kind: 'extraction',
        inputFingerprint: claimed!.dependencyFingerprint,
        bytes: fakeBytes,
      });

      // 4. Try to accept the fabricated extraction -> rejected by validateRetainedSourceEvidence
      await expect(acceptCurrentTextJob(port, claimed!, artifactRef, now())).rejects.toThrow('FABRICATED_SOURCE_EXTRACTION');

    } finally {
      await db.close();
    }
  });
});
