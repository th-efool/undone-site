import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';

vi.mock('server-only', () => ({}));

import {
  cohortRecommendationItemSchema,
  cohortWorkspaceSchema,
  type CohortWorkspace,
} from '@/src/shared/cohort-builder/contracts';
import type { ExistingCohortReference } from '@/src/shared/cohort-creation/contracts';
import type { CohortAi } from '../../cohort-creation/ai.contracts';
import type { RecommendationRepository } from '../../cohort-creation/recommendation.service';
import { CreationFailure, creationFailure } from '../../cohort-creation/errors';
import type { TextArtifactSql } from '../text-artifacts';
import { claimTextJob } from '../text-jobs';
import { enqueueJourneyJobPlan } from '../journey-job-scheduler';
import {
  acceptJourneyJob,
  executeRecommendationJob,
  retainJourneyArtifact,
} from '../journey-job-handlers';
import {
  createJourneyRecommendationAdapter,
  executeCohortRecommendations,
  JourneyRecommendationAdapter,
} from '../journey-recommendation-adapter';

const s3Migration = readFileSync(new URL('../../../../../prisma/interaction-s3-storage.sql', import.meta.url), 'utf8');
const journeyMigration = readFileSync(new URL('../../../../../prisma/interaction-journey-stages.sql', import.meta.url), 'utf8');

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
      step: 'recommendations',
      branch: null,
      processingStarted: false,
      intentVersion: 0,
    },
    ...overrides,
  });
}

function createMockCohort(overrides: Partial<ExistingCohortReference> = {}): ExistingCohortReference {
  return {
    cohortId: 'cohort-dist-sys-1',
    title: 'Production Distributed Systems',
    description: 'Master consensus algorithms, fault-tolerant replication, and distributed transactions.',
    coverImage: 'https://undone.app/images/dist-sys.jpg',
    creatorName: 'Leslie Lamport',
    difficulty: 'ADVANCED',
    categories: ['Distributed Systems', 'Databases', 'Cloud Architecture'],
    estimatedCompletionTime: '6 weeks',
    memberCount: 142,
    lessonCount: 18,
    visibility: 'PUBLIC',
    isPublished: true,
    ...overrides,
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

describe('journey-recommendation-adapter', () => {
  it('executes recommendations successfully with mock CohortAi and catalog repo', async () => {
    const mockCohort = createMockCohort();
    const mockAi: CohortAi = {
      interpret: vi.fn().mockResolvedValue({
        topic: 'Distributed Systems',
        outcomes: ['Master Paxos and Raft'],
        level: 'ADVANCED',
        language: 'en',
        searchTerms: ['consensus', 'replication'],
        uncertainties: [],
      }),
      rank: vi.fn().mockResolvedValue({
        matches: [{ candidateKey: mockCohort.cohortId, reason: 'Highly aligned with consensus topics' }],
      }),
    };

    const mockRepo: RecommendationRepository = {
      findCandidates: vi.fn().mockResolvedValue([mockCohort]),
      retainEligible: vi.fn().mockResolvedValue(new Set([mockCohort.cohortId])),
    };

    const workspace = createInitialWorkspace();
    const result = await executeCohortRecommendations(workspace, { ai: mockAi, catalogRepo: mockRepo });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: mockCohort.cohortId,
      label: mockCohort.title,
      url: `https://undone.app/cohorts/${mockCohort.cohortId}`,
      reason: 'Highly aligned with consensus topics',
      isBestMatch: true,
    });
    expect(result.rawResult).toBeDefined();
    expect(mockAi.interpret).toHaveBeenCalled();
    expect(mockRepo.findCandidates).toHaveBeenCalled();
    expect(mockAi.rank).toHaveBeenCalled();
    expect(mockRepo.retainEligible).toHaveBeenCalledWith([mockCohort.cohortId], expect.any(Object));
  });

  it('populates and validates all safe display fields according to cohortRecommendationItemSchema', async () => {
    const mockCohort = createMockCohort({
      coverImage: 'https://undone.app/cover.png',
      creatorName: 'Ada Lovelace',
      difficulty: 'INTERMEDIATE',
      categories: ['Algorithms', 'Math'],
      estimatedCompletionTime: '4 weeks',
      memberCount: 88,
      lessonCount: 12,
    });

    const mockAi: CohortAi = {
      interpret: vi.fn().mockResolvedValue({
        topic: 'Algorithms',
        outcomes: ['Algorithm Design'],
        level: 'INTERMEDIATE',
        language: 'en',
        searchTerms: ['algorithms'],
        uncertainties: [],
      }),
      rank: vi.fn().mockResolvedValue({
        matches: [{ candidateKey: mockCohort.cohortId, reason: 'Covers core algorithms cleanly' }],
      }),
    };

    const mockRepo: RecommendationRepository = {
      findCandidates: vi.fn().mockResolvedValue([mockCohort]),
      retainEligible: vi.fn().mockResolvedValue(new Set([mockCohort.cohortId])),
    };

    const workspace = createInitialWorkspace();
    const { items } = await executeCohortRecommendations(workspace, { ai: mockAi, catalogRepo: mockRepo });

    expect(items).toHaveLength(1);
    const item = items[0];

    // Verify all display fields
    expect(item.description).toBe(mockCohort.description);
    expect(item.coverImage).toBe('https://undone.app/cover.png');
    expect(item.creatorName).toBe('Ada Lovelace');
    expect(item.difficulty).toBe('INTERMEDIATE');
    expect(item.categories).toEqual(['Algorithms', 'Math']);
    expect(item.estimatedCompletionTime).toBe('4 weeks');
    expect(item.memberCount).toBe(88);
    expect(item.lessonCount).toBe(12);
    expect(item.reason).toBe('Covers core algorithms cleanly');
    expect(item.isBestMatch).toBe(true);

    // Strictly validate against cohortRecommendationItemSchema
    const parsed = cohortRecommendationItemSchema.parse(item);
    expect(parsed).toEqual(item);
  });

  it('handles honest empty state when catalog returns no matches', async () => {
    const mockAi: CohortAi = {
      interpret: vi.fn().mockResolvedValue({
        topic: 'Obscure Subject',
        outcomes: [],
        level: null,
        language: null,
        searchTerms: ['obscure'],
        uncertainties: [],
      }),
      rank: vi.fn().mockResolvedValue({ matches: [] }),
    };

    const mockRepo: RecommendationRepository = {
      findCandidates: vi.fn().mockResolvedValue([]),
      retainEligible: vi.fn().mockResolvedValue(new Set()),
    };

    const workspace = createInitialWorkspace({ intent: 'Learn an obscure topic with no public cohorts' });
    const result = await executeCohortRecommendations(workspace, { ai: mockAi, catalogRepo: mockRepo });

    expect(result.items).toEqual([]);
    expect(result.rawResult).toBeDefined();
    expect(mockAi.rank).not.toHaveBeenCalled();
  });

  it('handles honest empty state when candidate eligibility check filters out all cohorts', async () => {
    const mockCohort = createMockCohort({ cohortId: 'cohort-now-private' });
    const mockAi: CohortAi = {
      interpret: vi.fn().mockResolvedValue({
        topic: 'Distributed Systems',
        outcomes: [],
        level: null,
        language: null,
        searchTerms: ['consensus'],
        uncertainties: [],
      }),
      rank: vi.fn().mockResolvedValue({
        matches: [{ candidateKey: mockCohort.cohortId, reason: 'Matched before privacy change' }],
      }),
    };

    const mockRepo: RecommendationRepository = {
      findCandidates: vi.fn().mockResolvedValue([mockCohort]),
      // Cohort is no longer eligible (e.g. unpublished/private)
      retainEligible: vi.fn().mockResolvedValue(new Set()),
    };

    const workspace = createInitialWorkspace();
    const result = await executeCohortRecommendations(workspace, { ai: mockAi, catalogRepo: mockRepo });

    expect(result.items).toEqual([]);
  });

  it('falls back to database search when AI interpretation fails', async () => {
    const mockCohort = createMockCohort();
    const mockAi: CohortAi = {
      interpret: vi.fn().mockRejectedValue(creationFailure('AI_UNAVAILABLE', 'AI rate limit exceeded')),
      rank: vi.fn(),
    };

    const mockRepo: RecommendationRepository = {
      findCandidates: vi.fn().mockResolvedValue([mockCohort]),
      retainEligible: vi.fn().mockResolvedValue(new Set([mockCohort.cohortId])),
    };

    const workspace = createInitialWorkspace();
    const result = await executeCohortRecommendations(workspace, { ai: mockAi, catalogRepo: mockRepo });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe(mockCohort.cohortId);
    expect(result.items[0].reason).toContain('database');
    expect((result.rawResult as { mode: string }).mode).toBe('database_fallback');
  });

  it('throws retryable failure when catalog repository is unavailable', async () => {
    const mockAi: CohortAi = {
      interpret: vi.fn().mockResolvedValue({
        topic: 'Distributed Systems',
        outcomes: [],
        level: null,
        language: null,
        searchTerms: ['consensus'],
        uncertainties: [],
      }),
      rank: vi.fn(),
    };

    const mockRepo: RecommendationRepository = {
      findCandidates: vi.fn().mockRejectedValue(new Error('Connection terminated unexpectedly')),
      retainEligible: vi.fn(),
    };

    const workspace = createInitialWorkspace();
    await expect(
      executeCohortRecommendations(workspace, { ai: mockAi, catalogRepo: mockRepo })
    ).rejects.toThrowError(
      expect.objectContaining({
        name: 'CreationFailure',
        detail: expect.objectContaining({
          code: 'DATA_UNAVAILABLE',
          retryable: true,
        }),
      })
    );
  });

  it('works via JourneyRecommendationAdapter instance and factory', async () => {
    const mockCohort = createMockCohort();
    const mockAi: CohortAi = {
      interpret: vi.fn().mockResolvedValue({
        topic: 'Distributed Systems',
        outcomes: ['Consensus'],
        level: null,
        language: null,
        searchTerms: ['consensus'],
        uncertainties: [],
      }),
      rank: vi.fn().mockResolvedValue({
        matches: [{ candidateKey: mockCohort.cohortId, reason: 'Best fit' }],
      }),
    };
    const mockRepo: RecommendationRepository = {
      findCandidates: vi.fn().mockResolvedValue([mockCohort]),
      retainEligible: vi.fn().mockResolvedValue(new Set([mockCohort.cohortId])),
    };

    const adapter = createJourneyRecommendationAdapter({ ai: mockAi, catalogRepo: mockRepo });
    expect(adapter).toBeInstanceOf(JourneyRecommendationAdapter);

    const workspace = createInitialWorkspace();
    const result = await adapter.executeCohortRecommendations(workspace);

    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe(mockCohort.cohortId);
  });

  it('rejects acceptance in acceptJourneyJob when intentVersion is stale', async () => {
    const { db, port, sql } = await setupDb();
    try {
      const workspaceId = 'workspace-stale-check';
      const state0 = createInitialWorkspace({
        journey: {
          version: 1,
          step: 'recommendations',
          branch: null,
          processingStarted: false,
          intentVersion: 0,
        },
      });

      await db.query(
        `INSERT INTO "interaction_workspaces" ("id", "snapshot", "revision") VALUES ($1, $2::jsonb, 0)`,
        [workspaceId, JSON.stringify(state0)]
      );
      await enqueueJourneyJobPlan(port, workspaceId, state0);

      // Claim job for intentVersion 0
      const claimed0 = await claimTextJob(sql, 'worker-stale-test', now, 10_000);
      expect(claimed0).not.toBeNull();
      expect(claimed0!.stage).toBe('recommendations');

      // Create artifact for job 0
      const artifact0 = await retainJourneyArtifact(sql, claimed0!, [
        {
          id: 'cohort-consensus',
          label: 'Consensus Systems',
          url: 'https://undone.app/cohorts/cohort-consensus',
        },
      ]);

      // User bumps intent to intentVersion: 1
      const state1 = structuredClone(state0);
      state1.intent = 'Brand new learning goal';
      state1.journey!.intentVersion = 1;
      await db.query(
        `UPDATE "interaction_workspaces" SET "snapshot" = $1::jsonb WHERE "id" = $2`,
        [JSON.stringify(state1), workspaceId]
      );

      // Attempt to accept the stale job for intentVersion 0
      const accepted = await port.transaction(tx => acceptJourneyJob(tx, claimed0!, artifact0, now));
      expect(accepted).toBe(false);

      // Workspace snapshot must NOT have been updated with recommendations from intent 0
      const wsRow = (await sql.query(
        `SELECT "snapshot" FROM "interaction_workspaces" WHERE "id" = $1`,
        [workspaceId]
      )).rows[0];
      const wsSnapshot = cohortWorkspaceSchema.parse(
        typeof wsRow.snapshot === 'string' ? JSON.parse(wsRow.snapshot) : wsRow.snapshot
      );
      expect(wsSnapshot.recommendations).toBeUndefined();
    } finally {
      await db.close();
    }
  });

  it('atomically accepts recommendations and projects safe display items when intentVersion matches', async () => {
    const { db, port, sql } = await setupDb();
    try {
      const workspaceId = 'workspace-fresh-accept';
      const state = createInitialWorkspace();
      await db.query(
        `INSERT INTO "interaction_workspaces" ("id", "snapshot", "revision") VALUES ($1, $2::jsonb, 0)`,
        [workspaceId, JSON.stringify(state)]
      );
      await enqueueJourneyJobPlan(port, workspaceId, state);

      const claimed = await claimTextJob(sql, 'worker-fresh', now, 10_000);
      expect(claimed).not.toBeNull();

      const items = [
        {
          id: 'cohort-1',
          label: 'Raft in Practice',
          url: 'https://undone.app/cohorts/cohort-1',
          description: 'Detailed study of Raft consensus',
          memberCount: 50,
          lessonCount: 10,
          reason: 'Matches intent',
          isBestMatch: true,
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
      expect(wsSnapshot.recommendations).toMatchObject({
        status: 'ready',
        resultId: artifact.id,
        items: [
          expect.objectContaining({
            id: 'cohort-1',
            label: 'Raft in Practice',
            url: 'https://undone.app/cohorts/cohort-1',
            description: 'Detailed study of Raft consensus',
            memberCount: 50,
            lessonCount: 10,
            isBestMatch: true,
          }),
        ],
      });
    } finally {
      await db.close();
    }
  });

  it('statically verifies no imports of recommendation.runtime.ts, creationJobRepo, or legacy dispatchers', () => {
    const adapterSource = readFileSync(
      new URL('../journey-recommendation-adapter.ts', import.meta.url),
      'utf8'
    );
    const handlersSource = readFileSync(
      new URL('../journey-job-handlers.ts', import.meta.url),
      'utf8'
    );
    const workerSource = readFileSync(
      new URL('../durable-text-worker.ts', import.meta.url),
      'utf8'
    );

    const forbiddenPatterns = [
      'recommendation.runtime',
      'creationJobRepo',
      'recommendationDispatcher',
      'recommendation.dispatch',
    ];

    for (const pattern of forbiddenPatterns) {
      expect(adapterSource).not.toContain(pattern);
      expect(handlersSource).not.toContain(pattern);
      expect(workerSource).not.toContain(pattern);
    }
  });
});
