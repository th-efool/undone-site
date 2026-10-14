import { readFileSync as readFs } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import {
  cohortWorkspaceSchema,
  type CohortWorkspace,
} from '@/src/shared/cohort-builder/contracts';
import { PostgresReleaseEffectStore } from '../release-store';
import { releaseWorkspace } from '../release-service';
import { createReleaseReceipt } from '../release';

const s5EffectsSql = readFs(new URL('../../../../../prisma/interaction-s5-effects.sql', import.meta.url), 'utf8');

function createSampleWorkspace(overrides?: Partial<CohortWorkspace>): CohortWorkspace {
  return cohortWorkspaceSchema.parse({
    schemaVersion: 1,
    title: 'TypeScript Design Systems',
    intent: 'Build robust scalable design systems in TypeScript',
    audience: 'Frontend developers',
    dailyMinutes: 30,
    lessons: [
      {
        id: 'lesson-1',
        version: 1,
        title: 'Color Tokens & Contrast',
        objective: 'Construct accessible color tokens',
        sourceChunkIds: ['chunk-1'],
        pinned: true,
        evidenceStatus: 'valid',
      },
      {
        id: 'lesson-2',
        version: 1,
        title: 'Typography Scale',
        objective: 'Implement fluid type scales',
        sourceChunkIds: ['chunk-1'],
        pinned: false,
        evidenceStatus: 'valid',
      },
    ],
    sources: [
      {
        id: 'source-1',
        version: 0,
        label: 'Design Tokens Spec',
        text: 'Color tokens define design semantics and surface contrast.',
        checksum: '1'.repeat(64),
        state: 'ready',
        isRestricted: false,
      },
    ],
    chunks: [
      {
        id: 'chunk-1',
        sourceId: 'source-1',
        sourceVersion: 0,
        start: 0,
        end: 50,
        text: 'Color tokens define design semantics and surface contrast.',
        checksum: '2'.repeat(64),
      },
    ],
    understanding: [],
    analyses: [],
    processing: { status: 'idle', stage: 'done', generation: 1, sourceFingerprint: null, error: null },
    ...overrides,
  });
}

async function setupTestDb() {
  const db = new PGlite();
  await db.exec(`
    CREATE TABLE interaction_workspaces (
      id TEXT PRIMARY KEY,
      "ownerId" TEXT NOT NULL,
      "domainId" TEXT NOT NULL,
      "domainVersion" INT DEFAULT 1,
      snapshot JSONB NOT NULL,
      revision INT DEFAULT 0,
      sequence INT DEFAULT 0,
      "contextEpoch" INT DEFAULT 0,
      lifecycle TEXT DEFAULT 'active',
      "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE interaction_events (
      id TEXT PRIMARY KEY DEFAULT 'evt-' || gen_random_uuid(),
      "workspaceId" TEXT NOT NULL,
      sequence INT NOT NULL,
      payload JSONB NOT NULL,
      "protocolVersion" INT DEFAULT 1,
      type TEXT NOT NULL,
      revision INT,
      "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE ("workspaceId", sequence)
    );
  `);

  await db.exec(s5EffectsSql);
  return db;
}

function createMockPrisma(db: PGlite) {
  const cohortsStore = new Map<string, any>();

  const client = {
    $queryRawUnsafe: async <T = any>(sql: string, ...params: any[]): Promise<T> => {
      const res = await db.query(sql, params);
      return res.rows as unknown as T;
    },
    cohort: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        return cohortsStore.get(where.id) ?? null;
      },
      create: async ({ data }: { data: any }) => {
        const record = {
          ...data,
          id: data.id,
          creatorId: data.creator.connect.id,
          visibility: data.visibility,
          publishedAt: data.publishedAt ?? new Date(),
          creationSettings: data.creationSettings,
        };
        cohortsStore.set(data.id, record);
        return record;
      },
      update: async ({ where, data }: { where: { id: string }; data: any }) => {
        const existing = cohortsStore.get(where.id);
        if (!existing) throw new Error('NOT_FOUND');
        const updated = {
          ...existing,
          ...data,
          creationSettings: {
            ...existing.creationSettings,
            ...data.creationSettings,
          },
        };
        cohortsStore.set(where.id, updated);
        return updated;
      },
    },
    interactionWorkspace: {
      update: async ({ where, data }: { where: { id: string }; data: any }) => {
        await db.query(
          `UPDATE interaction_workspaces
           SET snapshot = $1, revision = $2, sequence = $3, "contextEpoch" = "contextEpoch" + 1, "updatedAt" = CURRENT_TIMESTAMP
           WHERE id = $4`,
          [JSON.stringify(data.snapshot), data.revision, data.sequence, where.id]
        );
        return data;
      },
    },
    interactionEvent: {
      create: async ({ data }: { data: any }) => {
        await db.query(
          `INSERT INTO interaction_events ("workspaceId", sequence, "protocolVersion", type, revision, payload)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [data.workspaceId, data.sequence, data.protocolVersion, data.type, data.revision, JSON.stringify(data.payload)]
        );
        return data;
      },
    },
  };

  return { client, cohortsStore };
}

describe('PostgresReleaseEffectStore', () => {
  it('records pending effect and commits release receipt', async () => {
    const db = await setupTestDb();
    const queryClient = {
      query: async (statement: string, parameters?: unknown[]) => {
        const res = await db.query(statement, (parameters as any[]) ?? []);
        return { rows: res.rows as Record<string, unknown>[] };
      },
    };

    const store = new PostgresReleaseEffectStore(queryClient);

    await db.query(
      `INSERT INTO interaction_workspaces (id, "ownerId", "domainId", snapshot)
       VALUES ('ws-1', 'owner-1', 'cohort', '{}')`
    );

    const effectKey = 'a'.repeat(64);
    const contentHash = 'b'.repeat(64);

    // Initial state: not found
    const initial = await store.get(effectKey);
    expect(initial).toBeNull();

    // Record pending
    await store.recordPending({
      effectKey,
      workspaceId: 'ws-1',
      contentHash,
      mode: 'private_activation',
      cohortId: 'cohort_1',
      createdAt: new Date().toISOString(),
    });

    const pending = await store.get(effectKey);
    expect(pending).not.toBeNull();
    expect(pending?.state).toBe('pending');
    expect(pending?.mode).toBe('private_activation');
    expect(pending?.receipt).toBeUndefined();

    // Commit receipt
    const receipt = createReleaseReceipt({
      effectKey,
      cohortId: 'cohort_1',
      workspaceId: 'ws-1',
      contentHash,
      mode: 'private_activation',
    });

    await store.commitReceipt(effectKey, receipt);

    const committed = await store.get(effectKey);
    expect(committed).not.toBeNull();
    expect(committed?.state).toBe('committed');
    expect(committed?.receipt).toEqual(receipt);

    // Repeated recordPending must not overwrite committed status
    await store.recordPending({
      effectKey,
      workspaceId: 'ws-1',
      contentHash,
      mode: 'private_activation',
      cohortId: 'cohort_1',
      createdAt: new Date().toISOString(),
    });

    const stillCommitted = await store.get(effectKey);
    expect(stillCommitted?.state).toBe('committed');
  });
});

describe('releaseWorkspace Service', () => {
  it('releases a private cohort atomically with relational records and receipt', async () => {
    const db = await setupTestDb();
    const workspaceId = 'ws-private-1';
    const ownerId = 'user-owner-1';
    const initialWs = createSampleWorkspace();

    await db.query(
      `INSERT INTO interaction_workspaces (id, "ownerId", "domainId", snapshot, revision, sequence)
       VALUES ($1, $2, 'cohort', $3, 1, 1)`,
      [workspaceId, ownerId, JSON.stringify(initialWs)]
    );

    const { client, cohortsStore } = createMockPrisma(db);

    const result = await releaseWorkspace(client as any, {
      workspaceId,
      ownerId,
      mode: 'private_activation',
    });

    expect(result.receipt).toBeDefined();
    expect(result.receipt.mode).toBe('private_activation');
    expect(result.receipt.destinationUrl).toBe(`/play?cohort=${result.receipt.cohortId}`);
    expect(result.revision).toBe(2);

    // 1. Verify relational cohort was materialized
    const materialized = cohortsStore.get(result.receipt.cohortId);
    expect(materialized).toBeDefined();
    expect(materialized.visibility).toBe('PRIVATE');
    expect(materialized.creatorId).toBe(ownerId);
    expect(materialized.isPublished).toBe(true);

    // 2. Verify workspace snapshot was updated
    const wsRes = await db.query(`SELECT snapshot, revision, sequence FROM interaction_workspaces WHERE id = $1`, [workspaceId]);
    const updatedWs = (wsRes.rows[0] as any).snapshot;
    expect(updatedWs.release?.status).toBe('released');
    expect(updatedWs.release?.mode).toBe('private_activation');
    expect(updatedWs.release?.cohortId).toBe(result.receipt.cohortId);

    // 3. Verify interaction_event recorded
    const eventRes = await db.query(`SELECT * FROM interaction_events WHERE "workspaceId" = $1`, [workspaceId]);
    expect(eventRes.rows.length).toBe(1);
    expect((eventRes.rows[0] as any).type).toBe('cohort.released');

    // 4. Verify interaction_effects table recorded committed receipt
    const effectRes = await db.query(`SELECT * FROM interaction_effects WHERE "effectKey" = $1`, [result.receipt.effectKey]);
    expect(effectRes.rows.length).toBe(1);
    expect((effectRes.rows[0] as any).state).toBe('committed');

    // 5. Test idempotency: Calling releaseWorkspace again produces identical receipt without duplicate cohorts
    const duplicate = await releaseWorkspace(client as any, {
      workspaceId,
      ownerId,
      mode: 'private_activation',
    });

    expect(duplicate.receipt).toEqual(result.receipt);
    expect(cohortsStore.size).toBe(1);
  });

  it('promotes private activation to public publish and blocks downgrades', async () => {
    const db = await setupTestDb();
    const workspaceId = 'ws-promote-1';
    const ownerId = 'user-owner-2';
    const initialWs = createSampleWorkspace();

    await db.query(
      `INSERT INTO interaction_workspaces (id, "ownerId", "domainId", snapshot, revision, sequence)
       VALUES ($1, $2, 'cohort', $3, 1, 1)`,
      [workspaceId, ownerId, JSON.stringify(initialWs)]
    );

    const { client, cohortsStore } = createMockPrisma(db);

    // First: private activation
    const privateRes = await releaseWorkspace(client as any, {
      workspaceId,
      ownerId,
      mode: 'private_activation',
    });
    expect(cohortsStore.get(privateRes.receipt.cohortId)?.visibility).toBe('PRIVATE');

    // Second: promotion to public publish
    const publicRes = await releaseWorkspace(client as any, {
      workspaceId,
      ownerId,
      mode: 'public_publish',
    });
    expect(publicRes.receipt.mode).toBe('public_publish');
    expect(cohortsStore.get(publicRes.receipt.cohortId)?.visibility).toBe('PUBLIC');

    // Third: downgrade from PUBLIC to PRIVATE must throw
    await expect(
      releaseWorkspace(client as any, {
        workspaceId,
        ownerId,
        mode: 'private_activation',
      })
    ).rejects.toThrow('CANNOT_DOWNGRADE_PUBLIC_COHORT');
  });

  it('blocks public release when sources are restricted or lessons are orphaned', async () => {
    const db = await setupTestDb();
    const workspaceId = 'ws-blocked-1';
    const ownerId = 'user-owner-3';

    // 1. Restricted source
    const wsWithRestricted = createSampleWorkspace();
    wsWithRestricted.sources[0].isRestricted = true;

    await db.query(
      `INSERT INTO interaction_workspaces (id, "ownerId", "domainId", snapshot, revision, sequence)
       VALUES ($1, $2, 'cohort', $3, 1, 1)`,
      [workspaceId, ownerId, JSON.stringify(wsWithRestricted)]
    );

    const { client } = createMockPrisma(db);

    await expect(
      releaseWorkspace(client as any, {
        workspaceId,
        ownerId,
        mode: 'public_publish',
      })
    ).rejects.toThrow('COHORT_NOT_READY_FOR_RELEASE');

    // But private activation is permitted for restricted sources
    const privateRes = await releaseWorkspace(client as any, {
      workspaceId,
      ownerId,
      mode: 'private_activation',
    });
    expect(privateRes.receipt.mode).toBe('private_activation');
  });

  it('blocks release when workspace has active processing jobs', async () => {
    const db = await setupTestDb();
    const workspaceId = 'ws-processing-1';
    const ownerId = 'user-owner-4';

    const wsActive = createSampleWorkspace({
      processing: { status: 'processing', stage: 'understanding', generation: 2, sourceFingerprint: null, error: null },
    });

    await db.query(
      `INSERT INTO interaction_workspaces (id, "ownerId", "domainId", snapshot, revision, sequence)
       VALUES ($1, $2, 'cohort', $3, 1, 1)`,
      [workspaceId, ownerId, JSON.stringify(wsActive)]
    );

    const { client } = createMockPrisma(db);

    await expect(
      releaseWorkspace(client as any, {
        workspaceId,
        ownerId,
        mode: 'private_activation',
      })
    ).rejects.toThrow('COHORT_NOT_READY_FOR_RELEASE');
  });
});
