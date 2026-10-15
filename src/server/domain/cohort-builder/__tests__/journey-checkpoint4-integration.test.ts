import { readFileSync } from 'node:fs';
import { randomUUID, createHash } from 'node:crypto';
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
  cohortWorkspaceSchema,
  type CohortWorkspace,
  type CohortAction,
  type CohortDiscoveryItem,
} from '@/src/shared/cohort-builder/contracts';
import {
  readTextArtifact,
  type TextArtifactSql,
} from '../text-artifacts';
import { runDurableTextJobTick } from '../durable-text-worker';
import { acceptCohortIntake } from '@/src/server/infrastructure/db/postgres/cohort-intake';
import { createPostgresInteractionRepository } from '@/src/server/infrastructure/db/postgres/repositories/interaction.repo';
import { cohortDomain } from '../domain';
import type { CreationGuideAuthor } from '@/src/server/domain/cohort-creation/generated-guide';
import type { TextJobTransactionPort } from '../text-job-scheduler';
import type { ResourceDiscovery, DiscoveryCandidate } from '@/src/server/domain/cohort-creation/discovery.contracts';
import type { DiscoverySourceObserver } from '@/src/server/domain/cohort-creation/discovery-observer';
import { GENERATED_GUIDE_LIMITATION } from '@/src/shared/cohort-creation/generated-guide';

const s3Migration = readFileSync(new URL('../../../../../prisma/interaction-s3-storage.sql', import.meta.url), 'utf8');
const s4bMigration = readFileSync(new URL('../../../../../prisma/interaction-s4b-sources.sql', import.meta.url), 'utf8');
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
      "leaseUntil" TIMESTAMP(3),
      "deadline" TIMESTAMP(3),
      "budgetReservation" JSONB,
      "budgetActual" JSONB,
      "error" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS "cohort_creation_drafts" (
      "draftId" UUID PRIMARY KEY,
      "ownerId" TEXT NOT NULL,
      "snapshot" JSONB NOT NULL
    );
  `);

  await db.exec(s3Migration);
  await db.exec(s4bMigration);
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
    $executeRawUnsafe: async (sql: string, ...values: any[]): Promise<number> => {
      const res = await db.query(sql, values);
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

describe('Checkpoint 4: Discovery & Goal Generation Branches End-to-End', () => {
  let db: PGlite;
  let sql: TextArtifactSql;
  let txPort: TextJobTransactionPort;
  let repo: ReturnType<typeof createPostgresInteractionRepository>;

  beforeEach(async () => {
    vi.stubEnv('INTERACTION_COHORT_JOURNEY_ENABLED', '1');
    vi.stubEnv('INTERACTION_TEXT_DRIVER', 'durable');

    db = await createTestDb();
    state.db = db;
    state.prisma = createPrismaBridge(db);

    sql = {
      async query(statement: string, parameters: unknown[]) {
        const res = await db.query(statement, parameters as any[]);
        return { rows: res.rows as Record<string, unknown>[] };
      },
    };

    txPort = {
      async transaction<T>(fn: (tx: TextArtifactSql) => Promise<T>): Promise<T> {
        return fn(sql);
      },
    };

    repo = createPostgresInteractionRepository(state.prisma);
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    if (db) {
      await db.close();
    }
    state.db = null;
    state.prisma = null;
  });

  async function loadWorkspace(id: string): Promise<CohortWorkspace> {
    const res = await db.query(`SELECT "snapshot" FROM "interaction_workspaces" WHERE "id" = $1`, [id]);
    const row = res.rows[0] as { snapshot: unknown };
    return cohortWorkspaceSchema.parse(typeof row.snapshot === 'string' ? JSON.parse(row.snapshot) : row.snapshot);
  }

  async function commit(workspaceId: string, ownerId: string, action: CohortAction) {
    const current = await repo.loadWorkspace<CohortWorkspace>({ workspaceId, ownerId });
    if (!current) throw new Error('Workspace not found');

    const envelope = {
      actionId: randomUUID(),
      workspaceId,
      expectedRevision: current.revision,
      entityVersions: [],
      action,
    };

    return repo.commitAction({
      workspaceId,
      ownerId,
      expectedRevision: current.revision,
      envelope,
      plan: cohortDomain.plan,
    });
  }

  async function simulateRecommendationsCompleted(workspaceId: string) {
    const recReady = JSON.stringify({
      requestId: randomUUID(),
      fingerprint: 'fp-rec',
      status: 'ready',
      generation: 0,
      items: [],
    });
    await db.query(`UPDATE "interaction_workspaces"
      SET snapshot = jsonb_set(snapshot, '{recommendations}', $1::jsonb)
      WHERE id = $2`, [recReady, workspaceId]);
    await db.query(`DELETE FROM "cohort_text_jobs" WHERE "workspaceId" = $1 AND "jobKey" LIKE 'journey:recommendations:%'`, [workspaceId]);
  }

  it('1. Find material branch: discovery, candidate proof verification, resource selection, and processing pipeline', async () => {
    const ownerId = 'user-discovery-1';
    const intakeRes = await acceptCohortIntake(ownerId, {
      requestId: randomUUID(),
      prompt: 'Learn Rust Async Programming from Grounded Documentation',
    });
    const workspaceId = intakeRes.workspaceId;

    let ws = await loadWorkspace(workspaceId);
    expect(ws.journey?.step).toBe('recommendations');
    expect(ws.journey?.processingStarted).toBe(false);

    await simulateRecommendationsCompleted(workspaceId);

    // 1. User selects "Create my own cohort" -> starting_point
    await commit(workspaceId, ownerId, { type: 'create_own_cohort' });
    ws = await loadWorkspace(workspaceId);
    expect(ws.journey?.step).toBe('starting_point');

    // 2. User chooses "Find material for me" -> discovery
    await commit(workspaceId, ownerId, { type: 'choose_starting_point', choice: 'find_material' });
    ws = await loadWorkspace(workspaceId);
    expect(ws.journey?.step).toBe('discovery');
    expect(ws.journey?.branch).toBe('find_material');

    // 3. User explicitly requests discovery -> enqueues discovery job
    await commit(workspaceId, ownerId, { type: 'start_discovery' });
    ws = await loadWorkspace(workspaceId);
    expect(ws.discovery?.status).toBe('queued');

    // Verify discovery job planned in cohort_text_jobs
    const jobs = await db.query<any>(`SELECT * FROM "cohort_text_jobs" WHERE "workspaceId" = $1 AND "stage" = 'discovery'`, [workspaceId]);
    expect(jobs.rows.length).toBe(1);
    expect(jobs.rows[0].status).toBe('queued');

    // 4. Execute discovery durable worker tick with mock discovery provider
    const candidate1: CohortDiscoveryItem = {
      id: 'rust-tokio-guide',
      label: 'Tokio Async Rust Tutorial',
      kind: 'web',
      url: 'https://tokio.rs/tokio/tutorial',
    };
    const candidate2: CohortDiscoveryItem = {
      id: 'rust-async-book',
      label: 'Asynchronous Programming in Rust Book',
      kind: 'web',
      url: 'https://rust-lang.github.io/async-book',
    };

    const discoveryAdapter = {
      async executeCohortDiscovery() {
        return {
          items: [candidate1, candidate2],
          rawResult: {
            candidates: [
              { key: candidate1.id, title: candidate1.label, url: candidate1.url, kind: 'web' },
              { key: candidate2.id, title: candidate2.label, url: candidate2.url, kind: 'web' },
            ],
            selection: { selected: [{ candidateKey: candidate1.id, reason: 'Official async guide' }] },
          },
        };
      },
    };

    const tickRes = await runDurableTextJobTick({
      sql,
      transaction: txPort,
      workerId: 'worker-disc-1',
      leaseMs: 10_000,
      now: () => now,
      loadWorkspace,
      discoveryAdapter,
    });
    expect(tickRes.status).toBe('accepted');

    // Verify workspace projection updated
    ws = await loadWorkspace(workspaceId);
    expect(ws.discovery?.status).toBe('ready');
    expect(ws.discovery?.items.length).toBe(2);
    expect(ws.discovery?.items[0].label).toBe('Tokio Async Rust Tutorial');
    expect(ws.discovery?.resultId).toBeDefined();

    // Verify artifact saved in cohort_text_artifacts and NO rows in legacy cohort_creation_drafts
    const artifactRes = await readTextArtifact(sql, workspaceId, ws.discovery!.resultId!);
    expect(artifactRes.ref.kind).toBe('discovery');
    const legacyDrafts = await db.query(`SELECT * FROM "cohort_creation_drafts"`);
    expect(legacyDrafts.rows.length).toBe(0);

    // 5. Security & Proof Validation: Attacker passes arbitrary forged URLs or candidates
    const forgedCandidateAction: CohortAction = {
      type: 'select_discovery_resources',
      resultId: ws.discovery!.resultId!,
      candidateIds: ['unverified-malicious-site'],
    };
    await expect(commit(workspaceId, ownerId, forgedCandidateAction)).rejects.toThrow('INVALID_DISCOVERY_CANDIDATE');

    const forgedResultIdAction: CohortAction = {
      type: 'select_discovery_resources',
      resultId: randomUUID(),
      candidateIds: [candidate1.id],
    };
    await expect(commit(workspaceId, ownerId, forgedResultIdAction)).rejects.toThrow('INVALID_DISCOVERY_RESULT');

    // 6. User selects valid discovered resources -> atomically creates web sources and advances to material_input
    await commit(workspaceId, ownerId, {
      type: 'select_discovery_resources',
      resultId: ws.discovery!.resultId!,
      candidateIds: [candidate1.id, candidate2.id],
    });

    ws = await loadWorkspace(workspaceId);
    expect(ws.journey?.step).toBe('material_input');
    expect(ws.sources.length).toBe(2);
    expect(ws.sources[0].label).toBe('Tokio Async Rust Tutorial');
    expect(ws.sources[0].input?.kind).toBe('web');
    expect((ws.sources[0].input as any).url).toBe(candidate1.url);
    expect(ws.sources[1].input?.kind).toBe('web');
    expect((ws.sources[1].input as any).url).toBe(candidate2.url);

    // Before explicit Continue, sources are retained with processingStarted=false
    expect(ws.journey?.processingStarted).toBe(false);
    expect(ws.processing.status).toBe('idle');

    // 7. Explicit Continue (begin_material_processing) starts the source DAG in the common pipeline
    await commit(workspaceId, ownerId, { type: 'begin_material_processing' });
    ws = await loadWorkspace(workspaceId);
    expect(ws.journey?.step).toBe('processing');
    expect(ws.journey?.processingStarted).toBe(true);
    expect(ws.processing.status).toBe('queued');

    // Verify source jobs planned
    const sourceJobs = await db.query(`SELECT * FROM "cohort_text_jobs" WHERE "workspaceId" = $1 AND "stage" = 'acquisition'`, [workspaceId]);
    expect(sourceJobs.rows.length).toBe(2);
  });

  it('2. Have a goal branch: goal setup, pacing, generated-guide acquisition in source DAG, and assembly', async () => {
    const ownerId = 'user-goal-1';
    const intakeRes = await acceptCohortIntake(ownerId, {
      requestId: randomUUID(),
      prompt: 'I want to master System Design for Distributed Systems',
    });
    const workspaceId = intakeRes.workspaceId;
    await simulateRecommendationsCompleted(workspaceId);

    // 1. Starting point -> Have a goal
    await commit(workspaceId, ownerId, { type: 'create_own_cohort' });
    await commit(workspaceId, ownerId, { type: 'choose_starting_point', choice: 'have_goal' });

    let ws = await loadWorkspace(workspaceId);
    expect(ws.journey?.step).toBe('goal_setup');
    expect(ws.journey?.branch).toBe('have_goal');

    // 2. User clarifies goal, audience, and pacing
    await commit(workspaceId, ownerId, { type: 'set_intent', intent: 'Distributed Systems & Microservices Architecture' });
    await commit(workspaceId, ownerId, { type: 'set_audience', audience: 'Senior Software Engineers' });
    await commit(workspaceId, ownerId, { type: 'set_daily_minutes', dailyMinutes: 30 });
    await simulateRecommendationsCompleted(workspaceId);

    ws = await loadWorkspace(workspaceId);
    expect(ws.intent).toBe('Distributed Systems & Microservices Architecture');
    expect(ws.audience).toBe('Senior Software Engineers');
    expect(ws.dailyMinutes).toBe(30);

    // 3. User requests goal generation -> creates generated_guide source and sets processingStarted=true
    await commit(workspaceId, ownerId, { type: 'start_goal_generation' });

    ws = await loadWorkspace(workspaceId);
    expect(ws.journey?.step).toBe('processing');
    expect(ws.journey?.processingStarted).toBe(true);
    expect(ws.sources.length).toBe(1);

    const guideSource = ws.sources[0];
    expect(guideSource.input?.kind).toBe('generated_guide');
    expect((guideSource.input as any).goal).toBe('Distributed Systems & Microservices Architecture');
    expect((guideSource.input as any).dailyMinutes).toBe(30);

    // 4. Execute source DAG through durable text worker
    const guideAuthor: CreationGuideAuthor = {
      identity: { provider: 'test-ai', modelId: 'deterministic-guide', adapterVersion: 'v1' },
      async author(_intent: any) {
        return {
          title: 'Architecting Distributed Systems',
          sections: [
            { heading: 'Foundations of Consensus', text: 'Consensus protocols like Raft and Paxos ensure state machine replication across unreliable networks.' },
            { heading: 'Event-Driven Microservices', text: 'Decoupling services using partitioned event logs like Kafka allows high throughput asynchronous execution.' },
          ],
          limitations: [GENERATED_GUIDE_LIMITATION, 'Scope is introductory architectural patterns.'],
        };
      },
    };

    // Run acquisition tick
    const acqTick = await runDurableTextJobTick({
      sql,
      transaction: txPort,
      workerId: 'worker-guide-1',
      leaseMs: 10_000,
      now: () => now,
      loadWorkspace,
      guideAuthor,
    });
    expect(acqTick.status).toBe('accepted');

    // Verify acquisition artifact in cohort_text_artifacts
    const acqJobs = await db.query<any>(`SELECT "resultArtifactId" FROM "cohort_text_jobs" WHERE "workspaceId" = $1 AND "stage" = 'acquisition'`, [workspaceId]);
    const acqArtifactId = (acqJobs.rows[0] as any).resultArtifactId;
    const acqArtifact = await readTextArtifact(sql, workspaceId, acqArtifactId);
    expect(acqArtifact.bytes.toString('utf8')).toContain('Architecting Distributed Systems');

    // Run extraction tick
    const extTick = await runDurableTextJobTick({
      sql,
      transaction: txPort,
      workerId: 'worker-guide-1',
      leaseMs: 10_000,
      now: () => now,
      loadWorkspace,
      guideAuthor,
    });
    expect(extTick.status).toBe('accepted');

    // Verify extraction output in database
    const extJobs = await db.query<any>(`SELECT "resultArtifactId" FROM "cohort_text_jobs" WHERE "workspaceId" = $1 AND "stage" = 'extraction'`, [workspaceId]);
    const extArtifact = await readTextArtifact(sql, workspaceId, (extJobs.rows[0] as any).resultArtifactId);
    const parsedExt = JSON.parse(extArtifact.bytes.toString('utf8'));
    expect(parsedExt.provenance.scope).toBe('ai_authored_guide');
    expect(parsedExt.provenance.contentOrigin).toBe('ai');
    expect(parsedExt.provenance.limitations).toContain(GENERATED_GUIDE_LIMITATION);

    // Run remaining pipeline ticks: understanding, chunking, analysis, assembly
    for (let i = 0; i < 4; i++) {
      const stageTick = await runDurableTextJobTick({
        sql,
        transaction: txPort,
        workerId: 'worker-guide-1',
        leaseMs: 10_000,
        now: () => now,
        loadWorkspace,
        guideAuthor,
      });
      expect(stageTick.status).toBe('accepted');
    }

    ws = await loadWorkspace(workspaceId);
    expect(ws.processing.status).toBe('ready');
    expect(ws.lessons.length).toBeGreaterThan(0);
    expect(ws.journey?.step).toBe('ready');
  });

  it('3. Edge cases: empty discovery, provider failure, retry, and stale intent rejection', async () => {
    const ownerId = 'user-edge-1';
    const intakeRes = await acceptCohortIntake(ownerId, {
      requestId: randomUUID(),
      prompt: 'Niche topic with zero public sources',
    });
    const workspaceId = intakeRes.workspaceId;
    await simulateRecommendationsCompleted(workspaceId);

    await commit(workspaceId, ownerId, { type: 'create_own_cohort' });
    await commit(workspaceId, ownerId, { type: 'choose_starting_point', choice: 'find_material' });
    await commit(workspaceId, ownerId, { type: 'start_discovery' });

    // Empty discovery results returned honestly
    const emptyDiscoveryAdapter = {
      async executeCohortDiscovery() {
        return { items: [], rawResult: { candidates: [], selection: { selected: [] } } };
      },
    };

    await runDurableTextJobTick({
      sql,
      transaction: txPort,
      workerId: 'worker-edge-1',
      leaseMs: 10_000,
      now: () => now,
      loadWorkspace,
      discoveryAdapter: emptyDiscoveryAdapter,
    });

    let ws = await loadWorkspace(workspaceId);
    expect(ws.discovery?.status).toBe('ready');
    expect(ws.discovery?.items.length).toBe(0);

    // User can switch back or choose "I already have material"
    await commit(workspaceId, ownerId, { type: 'back_to_starting_point' });
    await commit(workspaceId, ownerId, { type: 'choose_starting_point', choice: 'have_material' });
    ws = await loadWorkspace(workspaceId);
    expect(ws.journey?.step).toBe('material_input');
    expect(ws.journey?.branch).toBe('have_material');

    // Stale intentVersion: Updating intent bumps intentVersion and clears stale projections
    const oldIntentVersion = ws.journey?.intentVersion ?? 0;
    await commit(workspaceId, ownerId, { type: 'set_intent', intent: 'Brand New Different Topic' });
    ws = await loadWorkspace(workspaceId);
    expect(ws.journey?.intentVersion).toBe(oldIntentVersion + 1);
    expect(ws.discovery).toBeUndefined();
    expect(ws.recommendations).toBeUndefined();
  });
});
