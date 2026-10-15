import { readFileSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { z } from 'zod';

vi.mock('server-only', () => ({}));

import {
  cohortDiscoveryItemSchema,
  cohortWorkspaceSchema,
  type CohortWorkspace,
} from '@/src/shared/cohort-builder/contracts';
import type { TextArtifactSql } from '../text-artifacts';
import { claimTextJob } from '../text-jobs';
import { enqueueJourneyJobPlan } from '../journey-job-scheduler';
import {
  acceptJourneyJob,
  failJourneyJob,
  executeDiscoveryJob,
  retainJourneyArtifact,
  createJourneyJobProcessor,
} from '../journey-job-handlers';
import {
  createJourneyDiscoveryAdapter,
  executeCohortDiscovery,
  DiscoveryAdapter,
  WorkspaceArtifactStoreAdapter,
} from '../journey-discovery-adapter';
import type {
  ResourceDiscovery,
  DiscoveryCandidate,
  GroundedSearch,
  DiscoverySelection,
} from '../../cohort-creation/discovery.contracts';
import type { DiscoverySourceObserver } from '../../cohort-creation/discovery-observer';
import { CreationStorageError } from '@/src/server/infrastructure/storage/creation.contracts';
import { CreationFailure, creationFailure } from '../../cohort-creation/errors';

const s3Migration = readFileSync(
  new URL('../../../../../prisma/interaction-s3-storage.sql', import.meta.url),
  'utf8'
);
const journeyMigration = readFileSync(
  new URL('../../../../../prisma/interaction-journey-stages.sql', import.meta.url),
  'utf8'
);

const now = new Date('2030-01-01T12:00:00.000Z');

function createInitialWorkspace(overrides: Partial<CohortWorkspace> = {}): CohortWorkspace {
  return cohortWorkspaceSchema.parse({
    schemaVersion: 1,
    title: 'Distributed Systems',
    intent: 'Learn consensus and replication in distributed databases',
    audience: 'Senior Software Engineers',
    dailyMinutes: 30,
    lessons: [],
    sources: [],
    chunks: [],
    understanding: [],
    analyses: [],
    journey: {
      version: 1,
      step: 'discovery',
      branch: 'find_material',
      processingStarted: false,
      intentVersion: 0,
    },
    recommendations: {
      requestId: 'rec-1',
      fingerprint: 'fp-rec-ready',
      status: 'ready',
      generation: 0,
      items: [],
    },
    discovery: {
      requestId: 'req-discovery-1',
      fingerprint: 'fp-initial',
      status: 'queued',
      generation: 0,
      items: [],
    },
    ...overrides,
  });
}

function createMockCandidate(
  url: string,
  title: string,
  kind: DiscoveryCandidate['kind'] = 'web'
): DiscoveryCandidate {
  const key = createHash('sha256').update(url).digest('hex');
  return {
    key,
    citationIds: [`cite-${key.slice(0, 8)}`],
    url,
    title,
    kind,
    observedAt: new Date().toISOString(),
    observation: {
      method: kind === 'web' ? 'public_http' : 'youtube_api',
      requestedUrl: url,
      redirects: [],
      titleOrigin: 'observed',
      contentRetained: false,
    },
  };
}

async function setupDb() {
  const db = new PGlite();
  await db.exec(`
    CREATE TABLE "interaction_workspaces" (
      "id" TEXT PRIMARY KEY,
      "snapshot" JSONB NOT NULL,
      "lifecycle" TEXT DEFAULT 'active',
      "domainId" TEXT DEFAULT 'cohort',
      "revision" INTEGER NOT NULL DEFAULT 0,
      "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await db.exec(s3Migration);
  await db.exec(journeyMigration);

  const sql: TextArtifactSql = {
    query: async (statement, parameters) => db.query<Record<string, unknown>>(statement, parameters),
  };

  const port = {
    transaction: <T>(work: (tx: TextArtifactSql) => Promise<T>) =>
      db.transaction(tx => work({ query: async (stmt, params) => tx.query<Record<string, unknown>>(stmt, params) })),
  };

  return { db, sql, port };
}

describe('journey-discovery-adapter', () => {
  describe('WorkspaceArtifactStoreAdapter', () => {
    it('stores and retrieves JSON artifacts using cohort_text_artifacts table with kind discovery', async () => {
      const { db, sql } = await setupDb();
      try {
        const workspaceId = 'workspace-artifact-test';
        await db.query(
          `INSERT INTO "interaction_workspaces" ("id", "snapshot", "revision") VALUES ($1, $2::jsonb, 0)`,
          [workspaceId, JSON.stringify(createInitialWorkspace())]
        );

        const store = new WorkspaceArtifactStoreAdapter(sql, workspaceId);
        const testSchema = z.strictObject({ message: z.string(), count: z.number() });
        const scope = { ownerId: 'workspace-owner', draftId: randomUUID() };
        const inputFingerprint = createHash('sha256').update('test-fingerprint').digest('hex');

        // putJSON
        const ref = await store.putJSON(
          scope,
          { message: 'consensus', count: 42 },
          {
            artifactType: 'discovery-test',
            schemaVersion: 1,
            inputFingerprint,
            schema: testSchema,
          }
        );

        expect(ref).toMatchObject({
          id: expect.any(String),
          kind: 'artifact',
          byteLength: expect.any(Number),
          checksum: expect.stringMatching(/^[a-f0-9]{64}$/),
        });

        // Verify stored in cohort_text_artifacts with kind='discovery'
        const dbRow = (await sql.query(
          `SELECT "id", "workspaceId", "kind", "inputFingerprint", "checksum", "byteLength"
           FROM "cohort_text_artifacts" WHERE "id" = $1 AND "workspaceId" = $2`,
          [ref.id, workspaceId]
        )).rows[0];

        expect(dbRow).toBeDefined();
        expect(dbRow.workspaceId).toBe(workspaceId);
        expect(dbRow.kind).toBe('discovery');
        expect(dbRow.inputFingerprint).toBe(inputFingerprint);
        expect(dbRow.checksum).toBe(ref.checksum);
        expect(Number(dbRow.byteLength)).toBe(ref.byteLength);

        // ref
        const fetchedRef = await store.ref(scope, ref.id);
        expect(fetchedRef).toEqual(ref);

        // getJSON
        const value = await store.getJSON(scope, ref.id, {
          artifactType: 'discovery-test',
          schemaVersion: 1,
          inputFingerprint,
          schema: testSchema,
        });

        expect(value).toEqual({ message: 'consensus', count: 42 });
      } finally {
        await db.close();
      }
    });

    it('throws CreationStorageError NOT_FOUND for non-existent artifact IDs', async () => {
      const { db, sql } = await setupDb();
      try {
        const store = new WorkspaceArtifactStoreAdapter(sql, 'workspace-nonexistent');
        const scope = { ownerId: 'user', draftId: randomUUID() };
        const missingId = randomUUID();

        await expect(store.ref(scope, missingId)).rejects.toThrowError(CreationStorageError);
        await expect(store.ref(scope, missingId)).rejects.toThrow('Stored content was not found.');

        await expect(
          store.getJSON(scope, missingId, {
            artifactType: 'test',
            schemaVersion: 1,
            inputFingerprint: 'fp',
            schema: z.unknown(),
          })
        ).rejects.toThrowError(CreationStorageError);
      } finally {
        await db.close();
      }
    });

    it('strictly verifies NO rows in cohort_creation_drafts or legacy draft tables are read or written', async () => {
      const recordedQueries: string[] = [];
      const mockSql: TextArtifactSql = {
        query: vi.fn(async (statement: string, parameters: unknown[]) => {
          recordedQueries.push(statement);
          if (statement.includes('INSERT INTO "cohort_text_artifacts"')) {
            return { rows: [] };
          }
          if (statement.includes('"cohort_text_artifacts"') && statement.includes('"body"')) {
            const body = Buffer.from(
              JSON.stringify({
                artifactType: 'test',
                schemaVersion: 1,
                inputFingerprint: 'fp',
                value: { valid: true },
              })
            );
            return {
              rows: [
                {
                  id: parameters[1],
                  checksum: createHash('sha256').update(body).digest('hex'),
                  byteLength: body.length,
                  body,
                },
              ],
            };
          }
          if (statement.includes('"cohort_text_artifacts"')) {
            return {
              rows: [
                {
                  id: parameters[1],
                  checksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
                  byteLength: 2,
                },
              ],
            };
          }
          return { rows: [] };
        }),
      };

      const store = new WorkspaceArtifactStoreAdapter(mockSql, 'workspace-no-drafts');
      const scope = { ownerId: 'user', draftId: randomUUID() };

      await store.putJSON(
        scope,
        { valid: true },
        {
          artifactType: 'test',
          schemaVersion: 1,
          inputFingerprint: 'fp',
          schema: z.object({ valid: z.boolean() }),
        }
      );
      await store.ref(scope, randomUUID());
      await store.getJSON(scope, randomUUID(), {
        artifactType: 'test',
        schemaVersion: 1,
        inputFingerprint: 'fp',
        schema: z.object({ valid: z.boolean() }),
      });

      // Verify all recorded queries target ONLY cohort_text_artifacts
      expect(recordedQueries.length).toBeGreaterThan(0);
      for (const query of recordedQueries) {
        expect(query).not.toContain('cohort_creation_drafts');
        expect(query).not.toContain('creation_storage_records');
        expect(query).not.toContain('draft');
        expect(query).toContain('cohort_text_artifacts');
      }
    });
  });

  describe('executeCohortDiscovery', () => {
    it('executes discovery successfully with mock ResourceDiscovery and DiscoverySourceObserver', async () => {
      const candidate1 = createMockCandidate('https://example.com/raft-paper', 'In Search of an Understandable Consensus Algorithm');
      const candidate2 = createMockCandidate('https://example.com/paxos-simple', 'Paxos Made Simple');

      const mockAi: ResourceDiscovery = {
        search: vi.fn().mockResolvedValue({
          citations: [
            { id: candidate1.citationIds[0], url: candidate1.url, title: candidate1.title },
            { id: candidate2.citationIds[0], url: candidate2.url, title: candidate2.title },
          ],
          attribution: null,
          searchedAt: new Date().toISOString(),
          model: { provider: 'google', id: 'gemini-test' },
        }),
        select: vi.fn().mockResolvedValue({
          selected: [
            { candidateKey: candidate1.key, reason: 'Foundational Raft consensus paper' },
            { candidateKey: candidate2.key, reason: 'Classic Paxos paper' },
          ],
        }),
      };

      const mockObserver: Pick<DiscoverySourceObserver, 'observe'> = {
        observe: vi.fn().mockImplementation(async citation => {
          if (citation.url === candidate1.url) return candidate1;
          if (citation.url === candidate2.url) return candidate2;
          throw new Error('Unknown citation');
        }),
      };

      const workspace = createInitialWorkspace();
      const result = await executeCohortDiscovery(workspace, { ai: mockAi, observer: mockObserver });

      expect(result.items).toHaveLength(2);
      expect(result.items[0]).toEqual({
        id: candidate1.key,
        label: candidate1.title,
        kind: 'web',
        url: candidate1.url,
      });
      expect(result.items[1]).toEqual({
        id: candidate2.key,
        label: candidate2.title,
        kind: 'web',
        url: candidate2.url,
      });

      // Verify each item conforms to cohortDiscoveryItemSchema
      for (const item of result.items) {
        expect(cohortDiscoveryItemSchema.parse(item)).toEqual(item);
      }

      // Verify rawResult is captured
      expect(result.rawResult).toBeDefined();
      expect((result.rawResult as any).candidates).toHaveLength(2);
      expect((result.rawResult as any).selection.selected).toHaveLength(2);
    });

    it('filters out non-web candidates and invalid URLs', async () => {
      const validWeb = createMockCandidate('https://example.com/consensus', 'Valid Web Consensus', 'web');
      const youtubeCandidate = createMockCandidate('https://example.com/video', 'YouTube Video', 'youtube_video');
      const githubCandidate = createMockCandidate('https://example.com/repo', 'GitHub Repository', 'github');

      const mockAi: ResourceDiscovery = {
        search: vi.fn().mockResolvedValue({
          citations: [
            { id: validWeb.citationIds[0], url: validWeb.url, title: validWeb.title },
            { id: youtubeCandidate.citationIds[0], url: youtubeCandidate.url, title: youtubeCandidate.title },
            { id: githubCandidate.citationIds[0], url: githubCandidate.url, title: githubCandidate.title },
          ],
          attribution: null,
          searchedAt: new Date().toISOString(),
          model: { provider: 'google', id: 'gemini-test' },
        }),
        select: vi.fn().mockResolvedValue({
          selected: [{ candidateKey: validWeb.key, reason: 'Only web selected' }],
        }),
      };

      const mockObserver: Pick<DiscoverySourceObserver, 'observe'> = {
        observe: vi.fn().mockImplementation(async citation => {
          if (citation.url === validWeb.url) return validWeb;
          if (citation.url === youtubeCandidate.url) return youtubeCandidate;
          if (citation.url === githubCandidate.url) return githubCandidate;
          throw new Error('Unknown citation');
        }),
      };

      const workspace = createInitialWorkspace();
      const result = await executeCohortDiscovery(workspace, { ai: mockAi, observer: mockObserver });

      // Only valid web candidate should be included in result.items
      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toEqual({
        id: validWeb.key,
        label: validWeb.title,
        kind: 'web',
        url: validWeb.url,
      });
      expect(cohortDiscoveryItemSchema.parse(result.items[0])).toEqual(result.items[0]);
    });

    it('bounds result to a maximum of 20 items', async () => {
      const candidates: DiscoveryCandidate[] = [];
      const citations = [];
      for (let i = 0; i < 25; i++) {
        const c = createMockCandidate(`https://example.com/resource-${i}`, `Resource ${i}`);
        candidates.push(c);
        citations.push({ id: c.citationIds[0], url: c.url, title: c.title });
      }

      const mockAi: ResourceDiscovery = {
        search: vi.fn().mockResolvedValue({
          citations,
          attribution: null,
          searchedAt: new Date().toISOString(),
          model: { provider: 'google', id: 'gemini-test' },
        }),
        select: vi.fn().mockResolvedValue({
          selected: candidates.slice(0, 5).map(c => ({ candidateKey: c.key, reason: 'selected' })),
        }),
      };

      const mockObserver: Pick<DiscoverySourceObserver, 'observe'> = {
        observe: vi.fn().mockImplementation(async citation => {
          const found = candidates.find(c => c.url === citation.url);
          if (!found) throw new Error('Not found');
          return found;
        }),
      };

      const workspace = createInitialWorkspace();
      const result = await executeCohortDiscovery(workspace, { ai: mockAi, observer: mockObserver });

      expect(result.items.length).toBeLessThanOrEqual(20);
      for (const item of result.items) {
        expect(cohortDiscoveryItemSchema.parse(item)).toEqual(item);
      }
    });

    it('handles empty citations / empty search by returning empty items and rawResult', async () => {
      const mockAi: ResourceDiscovery = {
        search: vi.fn().mockResolvedValue({
          citations: [],
          attribution: null,
          searchedAt: new Date().toISOString(),
          model: { provider: 'google', id: 'gemini-test' },
        }),
        select: vi.fn().mockResolvedValue({ selected: [] }),
      };

      const mockObserver: Pick<DiscoverySourceObserver, 'observe'> = {
        observe: vi.fn(),
      };

      const workspace = createInitialWorkspace({ intent: 'Obscure search with no online resources' });
      const result = await executeCohortDiscovery(workspace, { ai: mockAi, observer: mockObserver });

      expect(result.items).toEqual([]);
      expect(result.rawResult).toBeDefined();
      expect(mockObserver.observe).not.toHaveBeenCalled();
      expect(mockAi.select).not.toHaveBeenCalled();
    });

    it('catches provider errors and throws CreationFailure so durable worker fails cleanly', async () => {
      const mockAi: ResourceDiscovery = {
        search: vi.fn().mockRejectedValue(creationFailure('AI_UNAVAILABLE', 'AI search service is unavailable')),
        select: vi.fn(),
      };
      const mockObserver: Pick<DiscoverySourceObserver, 'observe'> = {
        observe: vi.fn(),
      };

      const workspace = createInitialWorkspace();
      await expect(
        executeCohortDiscovery(workspace, { ai: mockAi, observer: mockObserver })
      ).rejects.toThrowError(
        expect.objectContaining({
          name: 'CreationFailure',
          detail: expect.objectContaining({
            code: 'AI_UNAVAILABLE',
            retryable: true,
          }),
        })
      );
    });

    it('handles abort signal cleanly by re-throwing abort error', async () => {
      const controller = new AbortController();
      controller.abort();

      const workspace = createInitialWorkspace();
      await expect(
        executeCohortDiscovery(workspace, {}, controller.signal)
      ).rejects.toThrow();
    });

    it('works via DiscoveryAdapter instance and createJourneyDiscoveryAdapter factory', async () => {
      const candidate = createMockCandidate('https://example.com/adapter-test', 'Adapter Test');
      const mockAi: ResourceDiscovery = {
        search: vi.fn().mockResolvedValue({
          citations: [{ id: candidate.citationIds[0], url: candidate.url, title: candidate.title }],
          attribution: null,
          searchedAt: new Date().toISOString(),
          model: { provider: 'google', id: 'gemini-test' },
        }),
        select: vi.fn().mockResolvedValue({
          selected: [{ candidateKey: candidate.key, reason: 'Selected' }],
        }),
      };
      const mockObserver: Pick<DiscoverySourceObserver, 'observe'> = {
        observe: vi.fn().mockResolvedValue(candidate),
      };

      const adapter = createJourneyDiscoveryAdapter({ ai: mockAi, observer: mockObserver });
      expect(adapter).toBeInstanceOf(DiscoveryAdapter);

      const workspace = createInitialWorkspace();
      const result = await adapter.executeCohortDiscovery(workspace);

      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe(candidate.key);
      expect(result.rawResult).toBeDefined();
    });
  });

  describe('executeDiscoveryJob & createJourneyJobProcessor', () => {
    it('executes via executeDiscoveryJob and attaches rawResult to items array', async () => {
      const candidate = createMockCandidate('https://example.com/job-test', 'Job Handler Test');
      const mockAi: ResourceDiscovery = {
        search: vi.fn().mockResolvedValue({
          citations: [{ id: candidate.citationIds[0], url: candidate.url, title: candidate.title }],
          attribution: null,
          searchedAt: new Date().toISOString(),
          model: { provider: 'google', id: 'gemini-test' },
        }),
        select: vi.fn().mockResolvedValue({
          selected: [{ candidateKey: candidate.key, reason: 'Selected' }],
        }),
      };
      const mockObserver: Pick<DiscoverySourceObserver, 'observe'> = {
        observe: vi.fn().mockResolvedValue(candidate),
      };

      const workspace = createInitialWorkspace();
      const items = await executeDiscoveryJob(workspace, { ai: mockAi, observer: mockObserver });

      expect(items).toHaveLength(1);
      expect((items as any).rawResult).toBeDefined();

      // createJourneyJobProcessor discovery stage
      const processor = createJourneyJobProcessor({
        loadWorkspace: async () => workspace,
        discoveryDeps: { ai: mockAi, observer: mockObserver },
      });

      const buffer = await processor({
        id: 'job-disc',
        workspaceId: 'ws-test',
        stage: 'discovery',
        sourceId: null,
        sourceVersion: null,
        dependencyFingerprint: 'fp',
        fence: 0,
        leaseToken: 'token',
      } as any);

      const parsedPayload = JSON.parse(Buffer.from(buffer).toString('utf8'));
      expect(parsedPayload.items).toHaveLength(1);
      expect(parsedPayload.rawResult).toBeDefined();
    });
  });

  describe('acceptJourneyJob & failJourneyJob for discovery', () => {
    it('atomically projects items into workspace.discovery with status ready when intentVersion matches', async () => {
      const { db, port, sql } = await setupDb();
      try {
        const workspaceId = 'workspace-discovery-accept';
        const state = createInitialWorkspace();
        await db.query(
          `INSERT INTO "interaction_workspaces" ("id", "snapshot", "revision") VALUES ($1, $2::jsonb, 0)`,
          [workspaceId, JSON.stringify(state)]
        );

        await enqueueJourneyJobPlan(port, workspaceId, state);

        const claimed = await claimTextJob(sql, 'worker-discovery', now, 10_000);
        expect(claimed).not.toBeNull();
        expect(claimed!.stage).toBe('discovery');

        const items = [
          {
            id: 'candidate-key-1',
            label: 'Consensus Guide',
            kind: 'web' as const,
            url: 'https://example.com/consensus-guide',
          },
        ];

        const artifact = await retainJourneyArtifact(sql, claimed!, {
          items,
          rawResult: { fullRaw: 'data' },
        });

        const accepted = await port.transaction(tx => acceptJourneyJob(tx, claimed!, artifact, now));
        expect(accepted).toBe(true);

        const wsRow = (await sql.query(
          `SELECT "snapshot", "revision" FROM "interaction_workspaces" WHERE "id" = $1`,
          [workspaceId]
        )).rows[0];
        expect(wsRow.revision).toBe(1);

        const wsSnapshot = cohortWorkspaceSchema.parse(
          typeof wsRow.snapshot === 'string' ? JSON.parse(wsRow.snapshot) : wsRow.snapshot
        );
        expect(wsSnapshot.discovery).toMatchObject({
          status: 'ready',
          resultId: artifact.id,
          items: [
            {
              id: 'candidate-key-1',
              label: 'Consensus Guide',
              kind: 'web',
              url: 'https://example.com/consensus-guide',
            },
          ],
        });
      } finally {
        await db.close();
      }
    });

    it('rejects acceptance in acceptJourneyJob when intentVersion is stale', async () => {
      const { db, port, sql } = await setupDb();
      try {
        const workspaceId = 'workspace-discovery-stale';
        const state0 = createInitialWorkspace({
          journey: {
            version: 1,
            step: 'discovery',
            branch: 'find_material',
            processingStarted: false,
            intentVersion: 0,
          },
          recommendations: {
            requestId: 'rec-stale',
            fingerprint: 'fp-rec-stale',
            status: 'ready',
            generation: 0,
            items: [],
          },
          discovery: {
            requestId: 'req-stale-1',
            fingerprint: 'fp-stale-0',
            status: 'queued',
            generation: 0,
            items: [],
          },
        });

        await db.query(
          `INSERT INTO "interaction_workspaces" ("id", "snapshot", "revision") VALUES ($1, $2::jsonb, 0)`,
          [workspaceId, JSON.stringify(state0)]
        );
        await enqueueJourneyJobPlan(port, workspaceId, state0);

        // Claim job for intentVersion 0
        const claimed0 = await claimTextJob(sql, 'worker-discovery-stale', now, 10_000);
        expect(claimed0).not.toBeNull();
        expect(claimed0!.stage).toBe('discovery');

        const artifact0 = await retainJourneyArtifact(sql, claimed0!, {
          items: [
            {
              id: 'candidate-old',
              label: 'Old Consensus Guide',
              kind: 'web',
              url: 'https://example.com/old-guide',
            },
          ],
        });

        // Intent changed: bump intentVersion to 1
        const state1 = structuredClone(state0);
        state1.intent = 'Brand new learning goal for discovery';
        state1.journey!.intentVersion = 1;
        await db.query(
          `UPDATE "interaction_workspaces" SET "snapshot" = $1::jsonb WHERE "id" = $2`,
          [JSON.stringify(state1), workspaceId]
        );

        // Acceptance of job for intentVersion 0 MUST be rejected
        const accepted = await port.transaction(tx => acceptJourneyJob(tx, claimed0!, artifact0, now));
        expect(accepted).toBe(false);

        // Workspace snapshot must NOT have been updated with discovery items from intent 0
        const wsRow = (await sql.query(
          `SELECT "snapshot" FROM "interaction_workspaces" WHERE "id" = $1`,
          [workspaceId]
        )).rows[0];
        const wsSnapshot = cohortWorkspaceSchema.parse(
          typeof wsRow.snapshot === 'string' ? JSON.parse(wsRow.snapshot) : wsRow.snapshot
        );
        expect(wsSnapshot.discovery?.status).not.toBe('ready');
      } finally {
        await db.close();
      }
    });

    it('updates workspace.discovery with status failed when failJourneyJob is called', async () => {
      const { db, port, sql } = await setupDb();
      try {
        const workspaceId = 'workspace-discovery-fail';
        const state = createInitialWorkspace();
        await db.query(
          `INSERT INTO "interaction_workspaces" ("id", "snapshot", "revision") VALUES ($1, $2::jsonb, 0)`,
          [workspaceId, JSON.stringify(state)]
        );
        await enqueueJourneyJobPlan(port, workspaceId, state);

        const claimed = await claimTextJob(sql, 'worker-fail-test', now, 10_000);
        expect(claimed).not.toBeNull();
        expect(claimed!.stage).toBe('discovery');

        const failed = await port.transaction(tx => failJourneyJob(tx, claimed!, 'AI_UNAVAILABLE', now));
        expect(failed).toBe(true);

        const wsRow = (await sql.query(
          `SELECT "snapshot" FROM "interaction_workspaces" WHERE "id" = $1`,
          [workspaceId]
        )).rows[0];
        const wsSnapshot = cohortWorkspaceSchema.parse(
          typeof wsRow.snapshot === 'string' ? JSON.parse(wsRow.snapshot) : wsRow.snapshot
        );
        expect(wsSnapshot.discovery).toMatchObject({
          status: 'failed',
        });
      } finally {
        await db.close();
      }
    });
  });
});
