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
import type { YoutubeTranscriptProvider } from '../youtube-transcript';

afterEach(() => vi.unstubAllEnvs());

const id = '7d4e49d0-bad0-4aba-a777-122326020099';
const ownerId = 'owner-s4c';
const s3Migration = readFs(new URL('../../../../../prisma/interaction-s3-storage.sql', import.meta.url), 'utf8');
const s4bMigration = readFs(new URL('../../../../../prisma/interaction-s4b-sources.sql', import.meta.url), 'utf8');

const videoUrl = 'https://www.youtube.com/watch?v=s4cVideo123';
const track = { id: 'en-manual', language: 'en', kind: 'manual' as const, translated: false as const };

function makeRetainedTranscript() {
  return {
    format: 'youtube-transcript-v1',
    provider: { id: 'mock-fixture', version: '1' },
    acquiredAt: '2026-10-14T00:00:00.000Z',
    video: { id: 's4cVideo123', url: videoUrl, durationMs: 60_000, visibility: 'public', state: 'complete' },
    track,
    segments: [
      { startMs: 0, endMs: 5000, text: 'Quorums overlap and provide consensus.' },
      { startMs: 6000, endMs: 10000, text: 'Majorities retain immutable decisions.' },
    ],
  };
}

function mockProvider(customData?: unknown) {
  const bytes = Buffer.from(JSON.stringify(customData ?? makeRetainedTranscript()));
  const close = vi.fn();
  const open = vi.fn<YoutubeTranscriptProvider['open']>(async () => ({
    mediaType: 'application/json',
    bytes: (async function* () { yield bytes; })(),
    close,
  }));
  const provider: YoutubeTranscriptProvider = { id: 'mock-fixture', version: '1', billing: 'none', open };
  return { bytes, close, open, provider };
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
      schemaVersion: 1, title: 'YouTube Test', intent: 'Understand consensus protocols', audience: 'engineers', dailyMinutes: 20, lessons: [],
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

describe('YouTube transcript canonical actions and durable DAG integration', () => {
  it('enforces capability gating by rejecting YouTube actions when disabled', async () => {
    vi.stubEnv('INTERACTION_TEXT_DRIVER', 'durable');
    // INTERACTION_YOUTUBE_ENABLED is omitted
    const { db, repo } = await fixture();
    try {
      await expect(repo.commitAction({
        ownerId, workspaceId: id, expectedRevision: 0, requestId: 'req-gate-1',
        envelope: {
          actionId: crypto.randomUUID(), workspaceId: id, expectedRevision: 0, entityVersions: [],
          action: { type: 'add_youtube_source', sourceId: 'yt-1', label: 'YouTube Video', url: videoUrl, track },
        },
        plan: planCohortAction,
      })).rejects.toThrow('SOURCE_CAPABILITY_DISABLED');
    } finally {
      await db.close();
    }
  });

  it('runs complete DAG from add_youtube_source through acquisition, extraction, chunking and assembly', async () => {
    vi.stubEnv('INTERACTION_TEXT_DRIVER', 'durable');
    vi.stubEnv('INTERACTION_YOUTUBE_ENABLED', '1');
    vi.stubEnv('INTERACTION_YOUTUBE_TEST_MOCK', '1');
    const { db, repo, sql, port } = await fixture();
    const mp = mockProvider();
    try {
      // 1. Commit canonical add_youtube_source
      await repo.commitAction({
        ownerId, workspaceId: id, expectedRevision: 0, requestId: 'req-add-yt',
        envelope: {
          actionId: crypto.randomUUID(), workspaceId: id, expectedRevision: 0, entityVersions: [],
          action: { type: 'add_youtube_source', sourceId: 'yt-source', label: 'Consensus Talk', url: videoUrl, track },
        },
        plan: planCohortAction,
      });

      const loadWorkspace = async () => (await sql.query(`SELECT snapshot FROM interaction_workspaces WHERE id=$1`, [id])).rows[0].snapshot;
      const now = () => new Date('2030-01-01T00:00:00.000Z');
      const tick = () => runDurableTextJobTick({
        sql, transaction: port, workerId: 'worker-yt', leaseMs: 60_000, now, loadWorkspace,
        youtubeTranscriptProvider: mp.provider,
      });

      // 2. Tick acquisition: acquires retained bytes
      const t1 = await tick();
      expect(t1.status).toBe('accepted');
      expect(mp.open).toHaveBeenCalledOnce();
      expect(mp.close).toHaveBeenCalledOnce();

      // Check state after acquisition: retainedInputId present, text still empty
      let ws = cohortWorkspaceSchema.parse(await loadWorkspace());
      expect(ws.sources[0].retainedInputId).toBeDefined();
      expect(ws.sources[0].text).toBe('');

      // 3. Tick extraction: extracts text and locations with segment timestamps
      const t2 = await tick();
      expect(t2.status).toBe('accepted');
      ws = cohortWorkspaceSchema.parse(await loadWorkspace());
      expect(ws.sources[0].extractionId).toBeDefined();
      expect(ws.sources[0].text).toBe('Quorums overlap and provide consensus.\n\nMajorities retain immutable decisions.');
      expect(ws.sources[0].locations).toHaveLength(2);
      expect(ws.sources[0].locations![0]).toMatchObject({
        start: 0, end: 38, startMs: 0, endMs: 5000,
      });
      expect(ws.sources[0].provenance).toMatchObject({
        parserVersion: 'youtube-transcript-v1',
        scope: 'transcript_only',
        videoId: 's4cVideo123',
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
          expect(chunk!.sourceId).toBe('yt-source');
        }
      }

      // Idle tick
      const t7 = await tick();
      expect(t7.status).toBe('idle');
    } finally {
      await db.close();
    }
  });

  it('updates scope without re-acquiring transcript bytes from provider', async () => {
    vi.stubEnv('INTERACTION_TEXT_DRIVER', 'durable');
    vi.stubEnv('INTERACTION_YOUTUBE_ENABLED', '1');
    vi.stubEnv('INTERACTION_YOUTUBE_TEST_MOCK', '1');
    const { db, repo, sql, port } = await fixture();
    const mp = mockProvider();
    try {
      // Add and run to ready
      await repo.commitAction({
        ownerId, workspaceId: id, expectedRevision: 0, requestId: 'req-add-yt',
        envelope: {
          actionId: crypto.randomUUID(), workspaceId: id, expectedRevision: 0, entityVersions: [],
          action: { type: 'add_youtube_source', sourceId: 'yt-source', label: 'Consensus Talk', url: videoUrl, track },
        },
        plan: planCohortAction,
      });

      const loadWorkspace = async () => (await sql.query(`SELECT snapshot FROM interaction_workspaces WHERE id=$1`, [id])).rows[0].snapshot;
      const now = () => new Date('2030-01-01T00:00:00.000Z');
      const tick = () => runDurableTextJobTick({
        sql, transaction: port, workerId: 'worker-yt', leaseMs: 60_000, now, loadWorkspace,
        youtubeTranscriptProvider: mp.provider,
      });

      for (let i = 0; i < 6; i++) await tick();
      let ws = cohortWorkspaceSchema.parse(await loadWorkspace());
      expect(ws.processing.status).toBe('ready');
      expect(mp.open).toHaveBeenCalledTimes(1);

      // Now set scope to only the second segment [6000, 10000]
      const rev = (await sql.query(`SELECT revision FROM interaction_workspaces WHERE id=$1`, [id])).rows[0].revision as number;
      await repo.commitAction({
        ownerId, workspaceId: id, expectedRevision: rev, requestId: 'req-scope-yt',
        envelope: {
          actionId: crypto.randomUUID(), workspaceId: id, expectedRevision: rev,
          entityVersions: [{ kind: 'source', id: 'yt-source', version: ws.sources[0].version }],
          action: { type: 'set_youtube_scope', sourceId: 'yt-source', scope: { startMs: 6000, endMs: 10000 } },
        },
        plan: planCohortAction,
      });

      ws = cohortWorkspaceSchema.parse(await loadWorkspace());
      expect(ws.sources[0].retainedInputId).toBeDefined(); // Retained raw bytes preserved!
      expect(ws.sources[0].text).toBe('');

      // Run acquisition: reuses retained bytes WITHOUT calling mp.open again
      const aTick = await tick();
      expect(aTick.status).toBe('accepted');
      expect(mp.open).toHaveBeenCalledTimes(1); // STILL 1! No re-acquisition!

      // Run extraction: re-extracts scoped segment
      const eTick = await tick();
      expect(eTick.status).toBe('accepted');
      ws = cohortWorkspaceSchema.parse(await loadWorkspace());
      expect(ws.sources[0].text).toBe('Majorities retain immutable decisions.');
      expect(ws.sources[0].locations).toHaveLength(1);
      expect(ws.sources[0].locations![0]).toMatchObject({
        start: 0, end: 38, startMs: 6000, endMs: 10000,
      });

      // Complete downstream stages
      for (let i = 0; i < 4; i++) await tick();
      ws = cohortWorkspaceSchema.parse(await loadWorkspace());
      expect(ws.processing.status).toBe('ready');
      expect(mp.open).toHaveBeenCalledTimes(1); // Provider was never called again
    } finally {
      await db.close();
    }
  });

  it('records honest failed state when provider fails and allows retry', async () => {
    vi.stubEnv('INTERACTION_TEXT_DRIVER', 'durable');
    vi.stubEnv('INTERACTION_YOUTUBE_ENABLED', '1');
    vi.stubEnv('INTERACTION_YOUTUBE_TEST_MOCK', '1');
    const { db, repo, sql, port } = await fixture();

    let shouldFail = true;
    const failingProvider: YoutubeTranscriptProvider = {
      id: 'mock-fixture', version: '1', billing: 'none',
      open: vi.fn(async () => {
        if (shouldFail) throw new Error('TRANSCRIPT_UNAVAILABLE');
        const bytes = Buffer.from(JSON.stringify(makeRetainedTranscript()));
        return { mediaType: 'application/json' as const, bytes: (async function* () { yield bytes; })(), close: () => {} };
      }),
    };

    try {
      await repo.commitAction({
        ownerId, workspaceId: id, expectedRevision: 0, requestId: 'req-add-fail',
        envelope: {
          actionId: crypto.randomUUID(), workspaceId: id, expectedRevision: 0, entityVersions: [],
          action: { type: 'add_youtube_source', sourceId: 'yt-source', label: 'Consensus Talk', url: videoUrl, track },
        },
        plan: planCohortAction,
      });

      const loadWorkspace = async () => (await sql.query(`SELECT snapshot FROM interaction_workspaces WHERE id=$1`, [id])).rows[0].snapshot;
      const now = () => new Date('2030-01-01T00:00:00.000Z');
      const tick = () => runDurableTextJobTick({
        sql, transaction: port, workerId: 'worker-yt', leaseMs: 60_000, now, loadWorkspace,
        youtubeTranscriptProvider: failingProvider,
      });

      // Acquisition fails
      const t1 = await tick();
      expect(t1.status).toBe('failed');

      // Check job failure in DB
      const jobRow = (await sql.query(`SELECT status, "errorCode", attempts FROM cohort_text_jobs WHERE id=$1`, [t1.jobId])).rows[0];
      expect(jobRow.status).toBe('failed');
      expect(jobRow.errorCode).toBe('TRANSCRIPT_UNAVAILABLE');

      // Now provider recovers: retry processing
      shouldFail = false;
      const rev = (await sql.query(`SELECT revision FROM interaction_workspaces WHERE id=$1`, [id])).rows[0].revision as number;
      await repo.commitAction({
        ownerId, workspaceId: id, expectedRevision: rev, requestId: 'req-retry',
        envelope: {
          actionId: crypto.randomUUID(), workspaceId: id, expectedRevision: rev, entityVersions: [],
          action: { type: 'retry_text_job', jobId: String(t1.jobId) },
        },
        plan: planCohortAction,
      });

      // Now tick succeeds
      const t2 = await tick();
      expect(t2.status).toBe('accepted');
    } finally {
      await db.close();
    }
  });

  it('rejects fabricated extraction and enforces CAS consistency', async () => {
    vi.stubEnv('INTERACTION_TEXT_DRIVER', 'durable');
    vi.stubEnv('INTERACTION_YOUTUBE_ENABLED', '1');
    vi.stubEnv('INTERACTION_YOUTUBE_TEST_MOCK', '1');
    const { db, repo, sql, port } = await fixture();
    const mp = mockProvider();

    try {
      await repo.commitAction({
        ownerId, workspaceId: id, expectedRevision: 0, requestId: 'req-add-yt',
        envelope: {
          actionId: crypto.randomUUID(), workspaceId: id, expectedRevision: 0, entityVersions: [],
          action: { type: 'add_youtube_source', sourceId: 'yt-source', label: 'Consensus Talk', url: videoUrl, track },
        },
        plan: planCohortAction,
      });

      const loadWorkspace = async () => (await sql.query(`SELECT snapshot FROM interaction_workspaces WHERE id=$1`, [id])).rows[0].snapshot;
      const now = () => new Date('2030-01-01T00:00:00.000Z');

      // Run acquisition
      await runDurableTextJobTick({
        sql, transaction: port, workerId: 'worker-yt', leaseMs: 60_000, now, loadWorkspace,
        youtubeTranscriptProvider: mp.provider,
      });

      // Claim extraction job manually
      const job = (await claimTextJob(sql, 'adversary', now(), 60_000))!;
      expect(job.stage).toBe('extraction');

      // Attempt to put a fabricated extraction with altered text
      const badExtraction = {
        format: 'cohort-extraction-v1',
        text: 'Fabricated non-transcript text.',
        locations: [{ start: 0, end: 31 }],
        provenance: {
          parserVersion: 'youtube-transcript-v1',
          rawChecksum: 'a'.repeat(64),
          scope: 'transcript_only',
        },
      };
      const badArtifact = await putTextArtifact(sql, {
        workspaceId: id,
        sourceId: job.sourceId!,
        sourceVersion: job.sourceVersion!,
        kind: 'extraction',
        inputFingerprint: job.dependencyFingerprint,
        bytes: Buffer.from(JSON.stringify(badExtraction)),
      });

      // Acceptance must reject fabricated extraction
      await expect(acceptCurrentTextJob(port, job, badArtifact, now())).rejects.toThrow('FABRICATED_SOURCE_EXTRACTION');

      // Test CAS / stale revision conflict
      await expect(repo.commitAction({
        ownerId, workspaceId: id, expectedRevision: 999, requestId: 'req-stale',
        envelope: {
          actionId: crypto.randomUUID(), workspaceId: id, expectedRevision: 999, entityVersions: [],
          action: { type: 'set_intent', intent: 'New intent' },
        },
        plan: planCohortAction,
      })).rejects.toThrow('STALE_WORKSPACE');
    } finally {
      await db.close();
    }
  });
});
