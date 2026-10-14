import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import type { Prisma } from '@/generated/prisma/client';
import type { CohortWorkspace } from '@/src/shared/cohort-builder/contracts';
import {
  projectCohortToLearnerDelivery,
  learnerDeliveryPayloadSchema,
} from '@/src/shared/cohort-builder/delivery';
import {
  buildPrismaCohortCreateInput,
  validateDeliveryRights,
  materializeLearnerCohort,
} from '../delivery.adapter';

function createSampleWorkspace(overrides?: Partial<CohortWorkspace>): CohortWorkspace {
  return {
    schemaVersion: 1,
    title: 'TypeScript Fundamentals',
    intent: 'Master intermediate TypeScript type transformations and generics',
    audience: 'Junior and mid-level web developers',
    dailyMinutes: 30,
    lessons: [
      {
        id: 'lesson-1',
        version: 1,
        title: 'Generics and Constraints',
        objective: 'Understand how generic type variables and extends constraints work',
        sourceChunkIds: ['chunk-1'],
        pinned: true,
        manualOverride: true,
        evidenceStatus: 'valid',
      },
      {
        id: 'lesson-2',
        version: 1,
        title: 'Mapped Types and Keyof',
        objective: 'Learn how to iterate over keys and build custom utility types',
        sourceChunkIds: ['chunk-2'],
        pinned: false,
        evidenceStatus: 'valid',
      },
    ],
    sources: [
      {
        id: 'source-1',
        version: 0,
        label: 'TS Handbook Ch 1',
        text: 'Generics are a key feature of TypeScript allowing reusable components.',
        checksum: 'a'.repeat(64),
        state: 'ready',
        locations: [{ start: 0, end: 50, page: 1 }],
      },
    ],
    chunks: [
      {
        id: 'chunk-1',
        sourceId: 'source-1',
        sourceVersion: 0,
        start: 0,
        end: 50,
        text: 'Generics are a key feature of TypeScript allowing reusable components.',
        checksum: 'b'.repeat(64),
      },
      {
        id: 'chunk-2',
        sourceId: 'source-1',
        sourceVersion: 0,
        start: 0,
        end: 50,
        text: 'Generics are a key feature of TypeScript allowing reusable components.',
        checksum: 'c'.repeat(64),
      },
    ],
    understanding: [],
    analyses: [],
    processing: {
      status: 'ready',
      stage: 'done',
      generation: 1,
      sourceFingerprint: 'fp-1',
      error: null,
    },
    ...overrides,
  };
}

describe('S5 Delivery DTO (delivery.ts)', () => {
  it('projects a valid CohortWorkspace into a schema-compliant LearnerDeliveryPayload', () => {
    const ws = createSampleWorkspace();
    const payload = projectCohortToLearnerDelivery(ws, {
      workspaceId: 'ws-123',
      workspaceRevision: 4,
      cohortId: 'cohort-test-1',
      contentHash: 'f'.repeat(64),
      mode: 'private_activation',
    });

    expect(learnerDeliveryPayloadSchema.safeParse(payload).success).toBe(true);
    expect(payload.workspaceId).toBe('ws-123');
    expect(payload.cohort.id).toBe('cohort-test-1');
    expect(payload.cohort.visibility).toBe('PRIVATE');
    expect(payload.metadata.totalLessons).toBe(2);
    expect(payload.metadata.pinnedLessonCount).toBe(1);
    expect(payload.metadata.hasManualOverrides).toBe(true);
    expect(payload.metadata.hasOrphanedEvidence).toBe(false);
    expect(payload.seasons.length).toBe(1);
    expect(payload.seasons[0].lessons.length).toBe(2);
    expect(payload.seasons[0].lessons[0].pinned).toBe(true);
    expect(payload.seasons[0].lessons[0].chunks[0].text).toContain('Generics');
  });

  it('groups lessons into distinct seasons when multiple sources are present', () => {
    const ws = createSampleWorkspace({
      sources: [
        {
          id: 'source-1',
          version: 0,
          label: 'Book 1: Foundations',
          text: 'Foundational concepts',
          checksum: 'a'.repeat(64),
          state: 'ready',
        },
        {
          id: 'source-2',
          version: 0,
          label: 'Book 2: Advanced Patterns',
          text: 'Advanced patterns and metaprogramming',
          checksum: 'd'.repeat(64),
          state: 'ready',
        },
      ],
      chunks: [
        {
          id: 'chunk-1',
          sourceId: 'source-1',
          sourceVersion: 0,
          start: 0,
          end: 20,
          text: 'Foundational concepts',
          checksum: 'b'.repeat(64),
        },
        {
          id: 'chunk-2',
          sourceId: 'source-2',
          sourceVersion: 0,
          start: 0,
          end: 35,
          text: 'Advanced patterns and metaprogramming',
          checksum: 'c'.repeat(64),
        },
      ],
    });

    const payload = projectCohortToLearnerDelivery(ws, {
      workspaceId: 'ws-123',
      workspaceRevision: 5,
      cohortId: 'cohort-test-multi',
      contentHash: 'f'.repeat(64),
      mode: 'public_publish',
    });

    expect(payload.seasons.length).toBe(2);
    expect(payload.seasons[0].title).toBe('Part: Book 1: Foundations');
    expect(payload.seasons[1].title).toBe('Part: Book 2: Advanced Patterns');
    expect(payload.cohort.visibility).toBe('PUBLIC');
  });

  it('marks lessons as orphaned when evidence chunks are missing', () => {
    const ws = createSampleWorkspace({
      lessons: [
        {
          id: 'lesson-orphan',
          version: 1,
          title: 'Orphaned Lesson',
          objective: 'Lost chunks',
          sourceChunkIds: ['missing-chunk-id'],
          pinned: false,
        },
      ],
    });

    const payload = projectCohortToLearnerDelivery(ws, {
      workspaceId: 'ws-123',
      workspaceRevision: 6,
      cohortId: 'cohort-test-orphan',
      contentHash: 'e'.repeat(64),
      mode: 'private_activation',
    });

    expect(payload.metadata.hasOrphanedEvidence).toBe(true);
    expect(payload.seasons[0].lessons[0].evidenceStatus).toBe('orphaned');
  });

  it('rejects projection on an empty curriculum', () => {
    const ws = createSampleWorkspace({ lessons: [] });
    expect(() =>
      projectCohortToLearnerDelivery(ws, {
        workspaceId: 'ws-123',
        workspaceRevision: 1,
        cohortId: 'cohort-empty',
        contentHash: 'a'.repeat(64),
        mode: 'private_activation',
      })
    ).toThrow('CANNOT_PROJECT_EMPTY_CURRICULUM');
  });
});

describe('S5 Delivery Adapter (delivery.adapter.ts)', () => {
  it('builds complete Prisma.CohortCreateInput data structure', () => {
    const ws = createSampleWorkspace();
    const delivery = projectCohortToLearnerDelivery(ws, {
      workspaceId: 'ws-456',
      workspaceRevision: 2,
      cohortId: 'cohort-create-test',
      contentHash: '9'.repeat(64),
      mode: 'public_publish',
    });

    const input = buildPrismaCohortCreateInput(delivery, 'user-creator-1');

    expect(input.id).toBe('cohort-create-test');
    expect(input.creator).toEqual({ connect: { id: 'user-creator-1' } });
    expect(input.title).toBe(ws.title);
    expect(input.visibility).toBe('PUBLIC');
    expect(input.isPublished).toBe(true);
    expect(input.members?.create).toEqual([{ userId: 'user-creator-1', role: 'CREATOR' }]);
    expect(input.community?.create?.chatEnabled).toBe(true);
    expect(input.sources?.create).toBeDefined();
    expect(input.seasons?.create).toBeDefined();
  });

  it('enforces visibility and rights rules for public vs private release', () => {
    const ws = createSampleWorkspace();

    // Valid private activation
    const privateDelivery = projectCohortToLearnerDelivery(ws, {
      workspaceId: 'ws-1',
      workspaceRevision: 1,
      cohortId: 'c-1',
      contentHash: '1'.repeat(64),
      mode: 'private_activation',
    });
    expect(validateDeliveryRights(privateDelivery).allowed).toBe(true);

    // Valid public publish
    const publicDelivery = projectCohortToLearnerDelivery(ws, {
      workspaceId: 'ws-1',
      workspaceRevision: 1,
      cohortId: 'c-2',
      contentHash: '2'.repeat(64),
      mode: 'public_publish',
    });
    expect(validateDeliveryRights(publicDelivery).allowed).toBe(true);

    // Invalid: public publish with restricted source
    const restrictedDelivery = structuredClone(publicDelivery);
    restrictedDelivery.sources[0].isRestricted = true;
    const restrictedCheck = validateDeliveryRights(restrictedDelivery);
    expect(restrictedCheck.allowed).toBe(false);
    expect(restrictedCheck.violations[0]).toContain('restricted sources cannot be published publicly');

    // Invalid: public publish with orphaned evidence
    const orphanedDelivery = structuredClone(publicDelivery);
    orphanedDelivery.metadata.hasOrphanedEvidence = true;
    orphanedDelivery.seasons[0].lessons[0].evidenceStatus = 'orphaned';
    const orphanedCheck = validateDeliveryRights(orphanedDelivery);
    expect(orphanedCheck.allowed).toBe(false);
    expect(orphanedCheck.violations[0]).toContain('orphaned or invalidated evidence');
  });

  it('materializes a new cohort in transactional Prisma and blocks downgrade', async () => {
    const cohortsStore = new Map<string, any>();

    const mockTx = {
      cohort: {
        findUnique: async ({ where }: { where: { id: string } }) => {
          return cohortsStore.get(where.id) ?? null;
        },
        create: async ({ data }: { data: any }) => {
          cohortsStore.set(data.id, {
            ...data,
            creatorId: data.creator.connect.id,
          });
          return { id: data.id, visibility: data.visibility, publishedAt: data.publishedAt };
        },
        update: async ({ where, data }: { where: { id: string }; data: any }) => {
          const prior = cohortsStore.get(where.id);
          const updated = { ...prior, ...data };
          cohortsStore.set(where.id, updated);
          return updated;
        },
      },
    } as unknown as Prisma.TransactionClient;

    const ws = createSampleWorkspace();
    const delivery = projectCohortToLearnerDelivery(ws, {
      workspaceId: 'ws-mat-1',
      workspaceRevision: 1,
      cohortId: 'cohort-mat-1',
      contentHash: '3'.repeat(64),
      mode: 'public_publish',
    });

    // 1. Initial materialization
    const res1 = await materializeLearnerCohort(mockTx, 'creator-alice', delivery);
    expect(res1.cohortId).toBe('cohort-mat-1');
    expect(res1.isNew).toBe(true);
    expect(res1.visibility).toBe('PUBLIC');

    // 2. Idempotent replay: same content, same creator
    const res2 = await materializeLearnerCohort(mockTx, 'creator-alice', delivery);
    expect(res2.isNew).toBe(false);
    expect(res2.cohortId).toBe('cohort-mat-1');

    // 3. Ownership mismatch: different creator fails
    await expect(
      materializeLearnerCohort(mockTx, 'creator-bob', delivery)
    ).rejects.toThrow('OWNERSHIP_MISMATCH');

    // 4. Content mutation denied on same ID
    const mutatedDelivery = structuredClone(delivery);
    mutatedDelivery.contentHash = '4'.repeat(64);
    await expect(
      materializeLearnerCohort(mockTx, 'creator-alice', mutatedDelivery)
    ).rejects.toThrow('CONTENT_MUTATION_DENIED');

    // 5. Downgrade prevention: cannot downgrade a PUBLIC cohort to private_activation
    const downgradeDelivery = structuredClone(delivery);
    downgradeDelivery.mode = 'private_activation';
    downgradeDelivery.cohort.visibility = 'PRIVATE';
    await expect(
      materializeLearnerCohort(mockTx, 'creator-alice', downgradeDelivery)
    ).rejects.toThrow('CANNOT_DOWNGRADE_PUBLIC_COHORT');
  });
});
