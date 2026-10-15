import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const state = vi.hoisted(() => ({
  db: null as PGlite | null,
  prisma: null as any,
}));

vi.mock('@/src/server/infrastructure/db/postgres/client', () => ({
  get prisma() {
    return state.prisma;
  },
}));

vi.mock('@/src/server/interaction-worker', () => ({
  runInteractionWorkerLoop: vi.fn().mockResolvedValue(undefined),
}));

import {
  cohortRecommendationItemSchema,
  cohortWorkspaceSchema,
  planCohortAction,
  type CohortWorkspace,
  type CohortActionContext,
} from '@/src/shared/cohort-builder/contracts';
import { readTextArtifact, type TextArtifactSql } from '../text-artifacts';
import { claimTextJob } from '../text-jobs';
import {
  acceptJourneyJob,
  executeRecommendationJob,
  retainJourneyArtifact,
} from '../journey-job-handlers';
import {
  createJourneyRecommendationAdapter,
  executeCohortRecommendations,
} from '../journey-recommendation-adapter';
import { acceptCohortIntake } from '@/src/server/infrastructure/db/postgres/cohort-intake';
import { createPostgresInteractionRepository } from '@/src/server/infrastructure/db/postgres/repositories/interaction.repo';
import { cohortDomain } from '../domain';

const s3Migration = readFileSync(new URL('../../../../../prisma/interaction-s3-storage.sql', import.meta.url), 'utf8');
const journeyMigration = readFileSync(new URL('../../../../../prisma/interaction-journey-stages.sql', import.meta.url), 'utf8');

const now = new Date('2030-01-01T12:00:00.000Z');

async function createTestDb(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(`
    CREATE TABLE IF NOT EXISTS "users" (
      "id" TEXT PRIMARY KEY,
      "email" TEXT
    );

    CREATE TABLE IF NOT EXISTS "interaction_workspaces" (
      "id" TEXT PRIMARY KEY,
      "ownerId" TEXT NOT NULL,
      "domainId" TEXT NOT NULL,
      "domainVersion" INTEGER NOT NULL DEFAULT 1,
      "snapshot" JSONB NOT NULL,
      "revision" INTEGER NOT NULL DEFAULT 0,
      "contextEpoch" INTEGER NOT NULL DEFAULT 0,
      "sequence" INTEGER NOT NULL DEFAULT 0,
      "lifecycle" TEXT NOT NULL DEFAULT 'active',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS "interaction_requests" (
      "id" TEXT PRIMARY KEY,
      "workspaceId" TEXT NOT NULL,
      "actorId" TEXT NOT NULL,
      "operation" TEXT NOT NULL,
      "requestId" TEXT NOT NULL,
      "payloadHash" TEXT NOT NULL,
      "response" JSONB NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "interaction_requests_uq" UNIQUE("workspaceId", "actorId", "operation", "requestId")
    );

    CREATE TABLE IF NOT EXISTS "interaction_events" (
      "id" TEXT PRIMARY KEY,
      "workspaceId" TEXT NOT NULL,
      "sequence" INTEGER NOT NULL,
      "protocolVersion" INTEGER NOT NULL DEFAULT 1,
      "type" TEXT NOT NULL,
      "revision" INTEGER,
      "payload" JSONB NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "interaction_events_uq" UNIQUE("workspaceId", "sequence")
    );

    CREATE TABLE IF NOT EXISTS "interaction_messages" (
      "id" TEXT PRIMARY KEY,
      "workspaceId" TEXT NOT NULL,
      "role" TEXT NOT NULL,
      "parts" JSONB NOT NULL,
      "sequence" INTEGER NOT NULL,
      "runId" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "interaction_messages_uq" UNIQUE("workspaceId", "sequence")
    );

    CREATE TABLE IF NOT EXISTS "interaction_runs" (
      "id" TEXT PRIMARY KEY,
      "workspaceId" TEXT NOT NULL,
      "triggeringMessageId" TEXT,
      "status" TEXT NOT NULL DEFAULT 'queued',
      "contextEpoch" INTEGER NOT NULL DEFAULT 0,
      "observedRevision" INTEGER NOT NULL DEFAULT 0,
      "cursor" INTEGER NOT NULL DEFAULT 0,
      "fence" INTEGER NOT NULL DEFAULT 0,
      "leaseOwner" TEXT,
      "leaseToken" TEXT,
      "leaseUntil" TIMESTAMPTZ,
      "deadline" TIMESTAMPTZ,
      "budgetReservation" JSONB,
      "budgetActual" JSONB,
      "error" TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS "interaction_outbox" (
      "id" TEXT PRIMARY KEY,
      "workspaceId" TEXT NOT NULL,
      "kind" TEXT NOT NULL,
      "payload" JSONB NOT NULL,
      "dedupKey" TEXT NOT NULL UNIQUE,
      "status" TEXT NOT NULL DEFAULT 'pending',
      "attempts" INTEGER NOT NULL DEFAULT 0,
      "dueAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "leaseOwner" TEXT,
      "leaseToken" TEXT,
      "leaseUntil" TIMESTAMP(3),
      "deliveredAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS "cohort_creation_drafts" (
      "id" TEXT PRIMARY KEY,
      "ownerId" TEXT NOT NULL,
      "state" JSONB NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "creation_jobs" (
      "id" TEXT PRIMARY KEY,
      "draftId" TEXT NOT NULL,
      "status" TEXT NOT NULL
    );
  `);

  await db.exec(s3Migration);
  await db.exec(journeyMigration);

  return db;
}

function createPrismaBridge(db: PGlite) {
  const bridge = {
    $transaction: async <T>(fn: (tx: any) => Promise<T>): Promise<T> => {
      return fn(bridge);
    },
    $queryRaw: async <T = any>(strings: TemplateStringsArray, ...values: any[]): Promise<T> => {
      let query = strings[0];
      for (let i = 0; i < values.length; i++) {
        query += `$${i + 1}${strings[i + 1]}`;
      }
      const res = await db.query(query, values);
      return res.rows as unknown as T;
    },
    $queryRawUnsafe: async <T = any>(sql: string, ...values: any[]): Promise<T> => {
      const res = await db.query(sql, values);
      return res.rows as unknown as T;
    },
    $executeRaw: async (strings: TemplateStringsArray, ...values: any[]): Promise<number> => {
      let query = strings[0];
      for (let i = 0; i < values.length; i++) {
        query += `$${i + 1}${strings[i + 1]}`;
      }
      const res = await db.query(query, values);
      return res.affectedRows ?? (res.rows?.length ?? 1);
    },
    interactionWorkspace: {
      findFirst: async ({ where }: any) => {
        let sql = 'SELECT * FROM "interaction_workspaces" WHERE 1=1';
        const vals: any[] = [];
        if (where?.id) {
          vals.push(where.id);
          sql += ` AND "id" = $${vals.length}`;
        }
        if (where?.ownerId) {
          vals.push(where.ownerId);
          sql += ` AND "ownerId" = $${vals.length}`;
        }
        const res = await db.query(sql, vals);
        const row = res.rows[0] as any;
        if (!row) return null;
        return {
          ...row,
          snapshot: typeof row.snapshot === 'string' ? JSON.parse(row.snapshot) : row.snapshot,
          createdAt: row.createdAt ? new Date(row.createdAt) : new Date(),
          updatedAt: row.updatedAt ? new Date(row.updatedAt) : new Date(),
        };
      },
      findUnique: async ({ where }: any) => {
        const res = await db.query('SELECT * FROM "interaction_workspaces" WHERE "id" = $1', [where.id]);
        const row = res.rows[0] as any;
        if (!row) return null;
        return {
          ...row,
          snapshot: typeof row.snapshot === 'string' ? JSON.parse(row.snapshot) : row.snapshot,
          createdAt: row.createdAt ? new Date(row.createdAt) : new Date(),
          updatedAt: row.updatedAt ? new Date(row.updatedAt) : new Date(),
        };
      },
      findUniqueOrThrow: async ({ where }: any) => {
        const row = await bridge.interactionWorkspace.findUnique({ where });
        if (!row) throw new Error('WORKSPACE_NOT_FOUND');
        return row;
      },
      create: async ({ data }: any) => {
        const res = await db.query(
          `INSERT INTO "interaction_workspaces" ("id", "ownerId", "domainId", "domainVersion", "snapshot", "revision", "sequence", "contextEpoch", "lifecycle")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
          [
            data.id,
            data.ownerId,
            data.domainId,
            data.domainVersion ?? 1,
            JSON.stringify(data.snapshot),
            data.revision ?? 0,
            data.sequence ?? 0,
            data.contextEpoch ?? 0,
            data.lifecycle ?? 'active',
          ]
        );
        const row = res.rows[0] as any;
        return {
          ...row,
          snapshot: typeof row.snapshot === 'string' ? JSON.parse(row.snapshot) : row.snapshot,
        };
      },
      update: async ({ where, data }: any) => {
        const sets: string[] = [];
        const vals: any[] = [];
        for (const [k, v] of Object.entries(data)) {
          if (v && typeof v === 'object' && 'increment' in (v as any)) {
            sets.push(`"${k}" = "${k}" + ${(v as any).increment}`);
          } else {
            vals.push(typeof v === 'object' && v !== null ? JSON.stringify(v) : v);
            sets.push(`"${k}" = $${vals.length}`);
          }
        }
        vals.push(where.id);
        const res = await db.query(
          `UPDATE "interaction_workspaces" SET ${sets.join(', ')} WHERE "id" = $${vals.length} RETURNING *`,
          vals
        );
        const row = res.rows[0] as any;
        return {
          ...row,
          snapshot: typeof row.snapshot === 'string' ? JSON.parse(row.snapshot) : row.snapshot,
        };
      },
    },
    interactionRequest: {
      findUnique: async ({ where }: any) => {
        const k = where?.workspaceId_actorId_operation_requestId;
        if (k) {
          const res = await db.query(
            `SELECT * FROM "interaction_requests" WHERE "workspaceId" = $1 AND "actorId" = $2 AND "operation" = $3 AND "requestId" = $4`,
            [k.workspaceId, k.actorId, k.operation, k.requestId]
          );
          const row = res.rows[0] as any;
          if (!row) return null;
          return { ...row, response: typeof row.response === 'string' ? JSON.parse(row.response) : row.response };
        }
        if (where?.id) {
          const res = await db.query('SELECT * FROM "interaction_requests" WHERE "id" = $1', [where.id]);
          const row = res.rows[0] as any;
          if (!row) return null;
          return { ...row, response: typeof row.response === 'string' ? JSON.parse(row.response) : row.response };
        }
        return null;
      },
      create: async ({ data }: any) => {
        await db.query(
          `INSERT INTO "interaction_requests" ("id", "workspaceId", "actorId", "operation", "requestId", "payloadHash", "response")
           VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
          [data.id, data.workspaceId, data.actorId, data.operation, data.requestId, data.payloadHash, JSON.stringify(data.response)]
        );
        return data;
      },
    },
    interactionMessage: {
      create: async ({ data }: any) => {
        const res = await db.query(
          `INSERT INTO "interaction_messages" ("id", "workspaceId", "role", "parts", "sequence", "runId")
           VALUES ($1, $2, $3, $4::jsonb, $5, $6) RETURNING *`,
          [data.id, data.workspaceId, data.role, JSON.stringify(data.parts), data.sequence, data.runId ?? null]
        );
        const row = res.rows[0] as any;
        return {
          ...row,
          parts: typeof row.parts === 'string' ? JSON.parse(row.parts) : row.parts,
          createdAt: row.createdAt ? new Date(row.createdAt) : new Date(),
        };
      },
    },
    interactionEvent: {
      create: async ({ data }: any) => {
        await db.query(
          `INSERT INTO "interaction_events" ("id", "workspaceId", "sequence", "protocolVersion", "type", "revision", "payload")
           VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
          [data.id, data.workspaceId, data.sequence, data.protocolVersion ?? 1, data.type, data.revision ?? null, JSON.stringify(data.payload)]
        );
        return data;
      },
    },
    interactionRun: {
      findFirst: async ({ where }: any) => {
        let sql = 'SELECT * FROM "interaction_runs" WHERE 1=1';
        const vals: any[] = [];
        if (where?.workspaceId) {
          vals.push(where.workspaceId);
          sql += ` AND "workspaceId" = $${vals.length}`;
        }
        if (where?.status?.in) {
          const inPlaceholders = where.status.in.map((s: string) => {
            vals.push(s);
            return `$${vals.length}`;
          });
          sql += ` AND "status" IN (${inPlaceholders.join(',')})`;
        }
        const res = await db.query(sql, vals);
        const row = res.rows[0] as any;
        if (!row) return null;
        return {
          ...row,
          leaseUntil: row.leaseUntil ? new Date(row.leaseUntil) : null,
          createdAt: row.createdAt ? new Date(row.createdAt) : new Date(),
          updatedAt: row.updatedAt ? new Date(row.updatedAt) : new Date(),
        };
      },
      findUnique: async ({ where }: any) => {
        const res = await db.query('SELECT * FROM "interaction_runs" WHERE "id" = $1', [where.id]);
        const row = res.rows[0] as any;
        if (!row) return null;
        return {
          ...row,
          leaseUntil: row.leaseUntil ? new Date(row.leaseUntil) : null,
          createdAt: row.createdAt ? new Date(row.createdAt) : new Date(),
          updatedAt: row.updatedAt ? new Date(row.updatedAt) : new Date(),
        };
      },
      create: async ({ data }: any) => {
        const res = await db.query(
          `INSERT INTO "interaction_runs" ("id", "workspaceId", "triggeringMessageId", "status", "contextEpoch", "observedRevision", "cursor", "fence", "budgetReservation", "budgetActual", "error")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
          [
            data.id,
            data.workspaceId,
            data.triggeringMessageId ?? null,
            data.status ?? 'queued',
            data.contextEpoch ?? 0,
            data.observedRevision ?? 0,
            data.cursor ?? 0,
            data.fence ?? 0,
            data.budgetReservation ? JSON.stringify(data.budgetReservation) : null,
            data.budgetActual ? JSON.stringify(data.budgetActual) : null,
            data.error ?? null,
          ]
        );
        return res.rows[0];
      },
      update: async ({ where, data }: any) => {
        const sets: string[] = [];
        const vals: any[] = [];
        for (const [k, v] of Object.entries(data)) {
          if (k === 'fence' && typeof v === 'object' && v && 'increment' in v) {
            sets.push(`"fence" = "fence" + 1`);
          } else {
            vals.push(typeof v === 'object' && v !== null ? JSON.stringify(v) : v);
            sets.push(`"${k}" = $${vals.length}`);
          }
        }
        vals.push(where.id);
        const res = await db.query(
          `UPDATE "interaction_runs" SET ${sets.join(', ')} WHERE "id" = $${vals.length} RETURNING *`,
          vals
        );
        return res.rows[0];
      },
    },
    interactionOutbox: {
      create: async ({ data }: any) => {
        await db.query(
          `INSERT INTO "interaction_outbox" ("id", "workspaceId", "kind", "payload", "dedupKey", "status", "attempts", "dueAt")
           VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8)`,
          [
            data.id,
            data.workspaceId,
            data.kind,
            JSON.stringify(data.payload),
            data.dedupKey,
            data.status ?? 'pending',
            data.attempts ?? 0,
            data.dueAt ?? new Date(),
          ]
        );
        return data;
      },
    },
  };
  return bridge;
}

function createMockCatalogRepo() {
  const mockCohorts = [
    {
      cohortId: 'cohort-dist-sys-101',
      title: 'Distributed Systems In Practice',
      description: 'Consensus, replication, and fault tolerance at scale.',
      coverImage: 'https://undone.app/images/dist-sys.png',
      creatorName: 'Leslie Lamport Fan',
      difficulty: 'INTERMEDIATE' as const,
      categories: ['Computer Science', 'Distributed Systems'],
      estimatedCompletionTime: '4 weeks',
      memberCount: 42,
      lessonCount: 12,
      visibility: 'PUBLIC' as const,
      isPublished: true as const,
    },
    {
      cohortId: 'cohort-raft-paxos-201',
      title: 'Paxos, Raft & Consensus',
      description: 'Deep dive into state machine replication and quorums.',
      coverImage: null,
      creatorName: 'Consensus Expert',
      difficulty: 'ADVANCED' as const,
      categories: ['Distributed Systems', 'Consensus'],
      estimatedCompletionTime: '3 weeks',
      memberCount: 18,
      lessonCount: 8,
      visibility: 'PUBLIC' as const,
      isPublished: true as const,
    },
  ];

  return {
    async findCandidates() {
      return mockCohorts;
    },
    async retainEligible(ids: string[]) {
      return new Set(ids);
    },
  };
}

function createMockAi() {
  return {
    async interpret(query: string) {
      return {
        topic: query.slice(0, 160),
        outcomes: ['Understand consensus', 'Master replication'],
        level: 'INTERMEDIATE',
        language: 'en',
        searchTerms: ['distributed systems', 'consensus'],
        uncertainties: [],
      };
    },
    async rank(intent: any, candidates: any[]) {
      return {
        matches: candidates.map((cohort, index) => ({
          candidateKey: cohort.cohortId,
          reason: index === 0 ? 'Exact match for distributed consensus learning goals' : 'Covers fundamental consensus theory',
        })),
      };
    },
  };
}

function createActionContext(workspaceId: string, overrides?: Partial<CohortActionContext>): CohortActionContext {
  return {
    actionId: randomUUID(),
    workspaceId,
    expectedRevision: 0,
    currentRevision: 0,
    entityVersions: new Map(),
    ...overrides,
  };
}

describe('Checkpoint 2: Cohort Journey End-to-End Integration Suite', () => {
  let db: PGlite;
  let prismaBridge: any;
  let sql: TextArtifactSql;

  beforeEach(async () => {
    vi.stubEnv('INTERACTION_COHORT_JOURNEY_ENABLED', '1');
    vi.stubEnv('INTERACTION_TEXT_DRIVER', 'durable');

    db = await createTestDb();
    prismaBridge = createPrismaBridge(db);
    state.db = db;
    state.prisma = prismaBridge;

    sql = {
      query: async (statement, parameters) => db.query<Record<string, unknown>>(statement, parameters),
    };
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    if (db) {
      await db.close();
    }
  });

  it('1. Intake transitions directly into recommendations queued, no source DAG, no assistant run, and 0 legacy drafts', async () => {
    const ownerId = 'owner-alice';
    const requestId = randomUUID();

    const intakeReceipt = await acceptCohortIntake(
      ownerId,
      { requestId, prompt: 'Learn Distributed Systems' },
      prismaBridge
    );

    expect(intakeReceipt).toBeDefined();
    expect(intakeReceipt.workspaceId).toBeDefined();
    const workspaceId = intakeReceipt.workspaceId;

    // Verify workspace snapshot:
    const wsRow = (await db.query<any>(`SELECT "snapshot", "revision" FROM "interaction_workspaces" WHERE "id" = $1`, [workspaceId])).rows[0];
    expect(wsRow).toBeDefined();
    const ws = cohortWorkspaceSchema.parse(typeof wsRow.snapshot === 'string' ? JSON.parse(wsRow.snapshot) : wsRow.snapshot);

    expect(ws.journey).toEqual({
      version: 1,
      step: 'recommendations',
      branch: null,
      processingStarted: false,
      intentVersion: 0,
    });
    expect(ws.intent).toBe('Learn Distributed Systems');
    expect(ws.sources).toHaveLength(0);
    expect(ws.lessons).toHaveLength(0);
    expect(ws.processing.status).toBe('idle');

    // Verify only the journey recommendations job was queued in cohort_text_jobs:
    const textJobs = (await db.query<any>(`SELECT "jobKey", "stage", "status" FROM "cohort_text_jobs" WHERE "workspaceId" = $1`, [workspaceId])).rows;
    expect(textJobs).toHaveLength(1);
    expect(textJobs[0]).toMatchObject({
      jobKey: 'journey:recommendations:0',
      stage: 'recommendations',
      status: 'queued',
    });

    // Verify NO source DAG jobs (text:*) were scheduled:
    const sourceDagJobs = (await db.query<any>(
      `SELECT "id" FROM "cohort_text_jobs" WHERE "workspaceId" = $1 AND "jobKey" NOT LIKE 'journey:%'`,
      [workspaceId]
    )).rows;
    expect(sourceDagJobs).toHaveLength(0);

    // Verify NO assistant runs (interaction_runs) were scheduled:
    const interactionRuns = (await db.query<any>(`SELECT "id" FROM "interaction_runs" WHERE "workspaceId" = $1`, [workspaceId])).rows;
    expect(interactionRuns).toHaveLength(0);

    // Verify ZERO rows in legacy drafts or creation jobs:
    const legacyDrafts = (await db.query<any>(`SELECT count(*) as count FROM "cohort_creation_drafts"`)).rows;
    expect(Number(legacyDrafts[0].count)).toBe(0);

    const legacyJobs = (await db.query<any>(`SELECT count(*) as count FROM "creation_jobs"`)).rows;
    expect(Number(legacyJobs[0].count)).toBe(0);
  });

  it('2. Intake is strictly idempotent with replay, and detects payload mismatch', async () => {
    const ownerId = 'owner-bob';
    const requestId = randomUUID();

    const first = await acceptCohortIntake(
      ownerId,
      { requestId, prompt: 'Learn Consensus Algorithms' },
      prismaBridge
    );

    // Replay with identical prompt and requestId returns the exact same workspaceId
    const replay = await acceptCohortIntake(
      ownerId,
      { requestId, prompt: 'Learn Consensus Algorithms' },
      prismaBridge
    );
    expect(replay.workspaceId).toBe(first.workspaceId);

    // Replay with different prompt throws IDEMPOTENCY_MISMATCH
    await expect(
      acceptCohortIntake(
        ownerId,
        { requestId, prompt: 'A completely different prompt' },
        prismaBridge
      )
    ).rejects.toThrow('IDEMPOTENCY_MISMATCH');
  });

  it('3. Recommendation adapter produces safe display items conforming to schema and retains raw result', async () => {
    const ownerId = 'owner-charlie';
    const { workspaceId } = await acceptCohortIntake(
      ownerId,
      { requestId: randomUUID(), prompt: 'Learn Distributed Systems' },
      prismaBridge
    );

    const wsRow = (await db.query<any>(`SELECT "snapshot" FROM "interaction_workspaces" WHERE "id" = $1`, [workspaceId])).rows[0];
    const ws = cohortWorkspaceSchema.parse(typeof wsRow.snapshot === 'string' ? JSON.parse(wsRow.snapshot) : wsRow.snapshot);

    const catalogRepo = createMockCatalogRepo();
    const ai = createMockAi();
    const adapter = createJourneyRecommendationAdapter({ catalogRepo, ai });

    const { items, rawResult } = await adapter.executeCohortRecommendations(ws);
    expect(items).toHaveLength(2);
    expect(cohortRecommendationItemSchema.parse(items[0])).toBeTruthy();
    expect(items[0]).toMatchObject({
      id: 'cohort-dist-sys-101',
      label: 'Distributed Systems In Practice',
      url: 'https://undone.app/cohorts/cohort-dist-sys-101',
      difficulty: 'INTERMEDIATE',
      isBestMatch: true,
    });
    expect(rawResult).toBeDefined();

    // Also verify executeRecommendationJob delegates to adapter cleanly:
    const delegatedItems = await executeRecommendationJob(ws, { adapter });
    expect(delegatedItems).toHaveLength(2);
    expect(delegatedItems[0].id).toBe(items[0].id);
  });

  it('4. Retains journey artifact and atomically accepts recommendation job into workspace projection', async () => {
    const ownerId = 'owner-diana';
    const { workspaceId } = await acceptCohortIntake(
      ownerId,
      { requestId: randomUUID(), prompt: 'Learn Distributed Systems' },
      prismaBridge
    );

    const wsRow = (await db.query<any>(`SELECT "snapshot" FROM "interaction_workspaces" WHERE "id" = $1`, [workspaceId])).rows[0];
    const ws = cohortWorkspaceSchema.parse(typeof wsRow.snapshot === 'string' ? JSON.parse(wsRow.snapshot) : wsRow.snapshot);

    const catalogRepo = createMockCatalogRepo();
    const ai = createMockAi();
    const adapter = createJourneyRecommendationAdapter({ catalogRepo, ai });

    // 1. Worker claims the recommendation job:
    const claimed = await claimTextJob(sql, 'worker-1', now, 60_000);
    expect(claimed).not.toBeNull();
    expect(claimed?.stage).toBe('recommendations');
    expect(claimed?.workspaceId).toBe(workspaceId);
    const claimedRow = (await db.query<any>(`SELECT "jobKey" FROM "cohort_text_jobs" WHERE "id" = $1`, [claimed!.id])).rows[0];
    expect(claimedRow.jobKey).toBe('journey:recommendations:0');

    // 2. Worker executes recommendations:
    const execResult = await adapter.executeCohortRecommendations(ws);

    // 3. Worker retains artifact with rawResult:
    const artifactRef = await retainJourneyArtifact(sql, claimed!, execResult);
    expect(artifactRef).toBeDefined();
    expect(artifactRef.kind).toBe('recommendations');
    expect(artifactRef.inputFingerprint).toBe(claimed!.dependencyFingerprint);

    // Verify artifact is in database and readable via canonical readTextArtifact:
    const { bytes } = await readTextArtifact(sql, workspaceId, artifactRef.id);
    const storedArtifact = JSON.parse(bytes.toString('utf8'));
    expect(storedArtifact.items).toHaveLength(2);
    expect(storedArtifact.rawResult).toBeDefined();

    // 4. Worker atomically accepts the journey job:
    const accepted = await acceptJourneyJob(sql, claimed!, artifactRef, now);
    expect(accepted).toBe(true);

    // 5. Verify workspace snapshot projection is updated to status='ready':
    const updatedWsRow = (await db.query<any>(`SELECT "snapshot" FROM "interaction_workspaces" WHERE "id" = $1`, [workspaceId])).rows[0];
    const updatedWs = cohortWorkspaceSchema.parse(typeof updatedWsRow.snapshot === 'string' ? JSON.parse(updatedWsRow.snapshot) : updatedWsRow.snapshot);
    expect(updatedWs.recommendations).toBeDefined();
    expect(updatedWs.recommendations?.status).toBe('ready');
    expect(updatedWs.recommendations?.resultId).toBe(artifactRef.id);
    expect(updatedWs.recommendations?.items).toHaveLength(2);
    expect(updatedWs.recommendations?.items[0].label).toBe('Distributed Systems In Practice');

    // 6. Verify job status is 'accepted' in cohort_text_jobs:
    const jobRow = (await db.query<any>(`SELECT "status", "resultArtifactId" FROM "cohort_text_jobs" WHERE "id" = $1`, [claimed!.id])).rows[0];
    expect(jobRow.status).toBe('accepted');
    expect(jobRow.resultArtifactId).toBe(artifactRef.id);
  });

  it('5. Rejects acceptance of stale intentVersion when intent changes before job completes', async () => {
    const ownerId = 'owner-evan';
    const { workspaceId } = await acceptCohortIntake(
      ownerId,
      { requestId: randomUUID(), prompt: 'Original Goal: Learn Rust' },
      prismaBridge
    );

    const wsRow = (await db.query<any>(`SELECT "snapshot" FROM "interaction_workspaces" WHERE "id" = $1`, [workspaceId])).rows[0];
    const ws = cohortWorkspaceSchema.parse(typeof wsRow.snapshot === 'string' ? JSON.parse(wsRow.snapshot) : wsRow.snapshot);

    // Claim the initial recommendations job for intentVersion:0
    const claimed = await claimTextJob(sql, 'worker-1', now, 60_000);
    expect(claimed).not.toBeNull();
    expect(claimed?.stage).toBe('recommendations');
    const claimedRow = (await db.query<any>(`SELECT "jobKey" FROM "cohort_text_jobs" WHERE "id" = $1`, [claimed!.id])).rows[0];
    expect(claimedRow.jobKey).toBe('journey:recommendations:0');

    const adapter = createJourneyRecommendationAdapter({ catalogRepo: createMockCatalogRepo(), ai: createMockAi() });
    const execResult = await adapter.executeCohortRecommendations(ws);
    const artifactRef = await retainJourneyArtifact(sql, claimed!, execResult);

    // In the meantime, user changes intent: bumping intentVersion to 1
    const repo = createPostgresInteractionRepository(prismaBridge);
    await repo.commitAction({
      workspaceId,
      ownerId,
      expectedRevision: 0,
      requestId: randomUUID(),
      envelope: {
        actionId: randomUUID(),
        workspaceId,
        expectedRevision: 0,
        entityVersions: [],
        action: { type: 'set_intent', intent: 'New Goal: Learn Go concurrency' },
      },
      plan: cohortDomain.plan,
    });

    // Check that workspace has intentVersion = 1
    const changedWsRow = (await db.query<any>(`SELECT "snapshot" FROM "interaction_workspaces" WHERE "id" = $1`, [workspaceId])).rows[0];
    const changedWs = cohortWorkspaceSchema.parse(typeof changedWsRow.snapshot === 'string' ? JSON.parse(changedWsRow.snapshot) : changedWsRow.snapshot);
    expect(changedWs.journey?.intentVersion).toBe(1);

    // Now worker attempts to accept the old job for intentVersion:0
    const accepted = await acceptJourneyJob(sql, claimed!, artifactRef, now);
    expect(accepted).toBe(false);

    // Confirm that old recommendations were NOT applied to workspace:
    const finalWsRow = (await db.query<any>(`SELECT "snapshot" FROM "interaction_workspaces" WHERE "id" = $1`, [workspaceId])).rows[0];
    const finalWs = cohortWorkspaceSchema.parse(typeof finalWsRow.snapshot === 'string' ? JSON.parse(finalWsRow.snapshot) : finalWsRow.snapshot);
    expect(finalWs.recommendations).toBeUndefined();
  });

  it('6. Canonical journey transitions: create_own_cohort, choose_starting_point, and back_to_recommendations', async () => {
    const ownerId = 'owner-fiona';
    const { workspaceId } = await acceptCohortIntake(
      ownerId,
      { requestId: randomUUID(), prompt: 'Learn Microservices' },
      prismaBridge
    );

    const repo = createPostgresInteractionRepository(prismaBridge);

    // 1. create_own_cohort: recommendations -> starting_point
    await repo.commitAction({
      workspaceId,
      ownerId,
      expectedRevision: 0,
      requestId: randomUUID(),
      envelope: {
        actionId: randomUUID(),
        workspaceId,
        expectedRevision: 0,
        entityVersions: [],
        action: { type: 'create_own_cohort' },
      },
      plan: cohortDomain.plan,
    });

    let wsRow = (await db.query<any>(`SELECT "snapshot", "revision" FROM "interaction_workspaces" WHERE "id" = $1`, [workspaceId])).rows[0];
    let ws = cohortWorkspaceSchema.parse(typeof wsRow.snapshot === 'string' ? JSON.parse(wsRow.snapshot) : wsRow.snapshot);
    expect(ws.journey?.step).toBe('starting_point');
    expect(ws.journey?.branch).toBeNull();
    expect(ws.journey?.processingStarted).toBe(false);
    expect(wsRow.revision).toBe(1);

    // 2. choose_starting_point: have_material -> material_input
    await repo.commitAction({
      workspaceId,
      ownerId,
      expectedRevision: 1,
      requestId: randomUUID(),
      envelope: {
        actionId: randomUUID(),
        workspaceId,
        expectedRevision: 1,
        entityVersions: [],
        action: { type: 'choose_starting_point', choice: 'have_material' },
      },
      plan: cohortDomain.plan,
    });

    wsRow = (await db.query<any>(`SELECT "snapshot", "revision" FROM "interaction_workspaces" WHERE "id" = $1`, [workspaceId])).rows[0];
    ws = cohortWorkspaceSchema.parse(typeof wsRow.snapshot === 'string' ? JSON.parse(wsRow.snapshot) : wsRow.snapshot);
    expect(ws.journey?.step).toBe('material_input');
    expect(ws.journey?.branch).toBe('have_material');
    expect(wsRow.revision).toBe(2);

    // 3. back_to_starting_point
    await repo.commitAction({
      workspaceId,
      ownerId,
      expectedRevision: 2,
      requestId: randomUUID(),
      envelope: {
        actionId: randomUUID(),
        workspaceId,
        expectedRevision: 2,
        entityVersions: [],
        action: { type: 'back_to_starting_point' },
      },
      plan: cohortDomain.plan,
    });

    wsRow = (await db.query<any>(`SELECT "snapshot", "revision" FROM "interaction_workspaces" WHERE "id" = $1`, [workspaceId])).rows[0];
    ws = cohortWorkspaceSchema.parse(typeof wsRow.snapshot === 'string' ? JSON.parse(wsRow.snapshot) : wsRow.snapshot);
    expect(ws.journey?.step).toBe('starting_point');

    // 4. back_to_recommendations
    await repo.commitAction({
      workspaceId,
      ownerId,
      expectedRevision: 3,
      requestId: randomUUID(),
      envelope: {
        actionId: randomUUID(),
        workspaceId,
        expectedRevision: 3,
        entityVersions: [],
        action: { type: 'back_to_recommendations' },
      },
      plan: cohortDomain.plan,
    });

    wsRow = (await db.query<any>(`SELECT "snapshot", "revision" FROM "interaction_workspaces" WHERE "id" = $1`, [workspaceId])).rows[0];
    ws = cohortWorkspaceSchema.parse(typeof wsRow.snapshot === 'string' ? JSON.parse(wsRow.snapshot) : wsRow.snapshot);
    expect(ws.journey?.step).toBe('recommendations');

    // 5. Re-enter starting_point and choose find_material branch -> discovery
    await repo.commitAction({
      workspaceId,
      ownerId,
      expectedRevision: 4,
      requestId: randomUUID(),
      envelope: {
        actionId: randomUUID(),
        workspaceId,
        expectedRevision: 4,
        entityVersions: [],
        action: { type: 'create_own_cohort' },
      },
      plan: cohortDomain.plan,
    });

    await repo.commitAction({
      workspaceId,
      ownerId,
      expectedRevision: 5,
      requestId: randomUUID(),
      envelope: {
        actionId: randomUUID(),
        workspaceId,
        expectedRevision: 5,
        entityVersions: [],
        action: { type: 'choose_starting_point', choice: 'find_material' },
      },
      plan: cohortDomain.plan,
    });

    wsRow = (await db.query<any>(`SELECT "snapshot" FROM "interaction_workspaces" WHERE "id" = $1`, [workspaceId])).rows[0];
    ws = cohortWorkspaceSchema.parse(typeof wsRow.snapshot === 'string' ? JSON.parse(wsRow.snapshot) : wsRow.snapshot);
    expect(ws.journey?.step).toBe('discovery');
    expect(ws.journey?.branch).toBe('find_material');

    // 6. Test have_goal branch
    const startPointPlan = planCohortAction(
      ws,
      { type: 'back_to_starting_point' },
      createActionContext(workspaceId, { currentRevision: 6, expectedRevision: 6 })
    );
    const goalPlan = planCohortAction(
      startPointPlan.nextState,
      { type: 'choose_starting_point', choice: 'have_goal' },
      createActionContext(workspaceId, { currentRevision: 7, expectedRevision: 7 })
    );
    expect(goalPlan.nextState.journey?.step).toBe('goal_setup');
    expect(goalPlan.nextState.journey?.branch).toBe('have_goal');
  });

  it('7. Optimistic locking: rejects stale revision with STALE_WORKSPACE', async () => {
    const ownerId = 'owner-grace';
    const { workspaceId } = await acceptCohortIntake(
      ownerId,
      { requestId: randomUUID(), prompt: 'Learn Cloud Architecture' },
      prismaBridge
    );

    const repo = createPostgresInteractionRepository(prismaBridge);

    // Attempt action with expectedRevision: 99 when revision is 0
    await expect(
      repo.commitAction({
        workspaceId,
        ownerId,
        expectedRevision: 99,
        requestId: randomUUID(),
        envelope: {
          actionId: randomUUID(),
          workspaceId,
          expectedRevision: 99,
          entityVersions: [],
          action: { type: 'create_own_cohort' },
        },
        plan: cohortDomain.plan,
      })
    ).rejects.toThrow('STALE_WORKSPACE');
  });
});
