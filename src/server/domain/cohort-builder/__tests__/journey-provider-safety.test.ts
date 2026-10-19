import { readFileSync } from 'node:fs';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { PGlite } from '@electric-sql/pglite';

vi.mock('server-only', () => ({}));

import {
  LiveVideoObservationProvider,
  acquireVideoObservation,
} from '../journey-video-adapter';
import {
  LiveCreationGuideAuthor,
  acquireGeneratedGuide,
} from '../journey-goal-adapter';
import {
  reserveModelTurnBudgetSql,
  UserBudgetExceededError,
  hourlyUserModelTurns,
} from '../budget-policy';
import { runTextJobTick } from '../text-job-tick';
import { createTextSourceProcessor } from '../text-source-processor';
import { createTextAssemblyProcessor } from '../text-assembly-processor';
import { fetchRetainedWeb } from '../source-adapters';
import type { TextArtifactSql } from '../text-artifacts';
import type { ClaimedTextJob } from '../text-jobs';
import type { YoutubeVideoMetadata } from '@/src/shared/cohort-creation/youtube';
import { randomUUID } from 'node:crypto';
import { CreationStorageError } from '@/src/server/infrastructure/storage/creation.contracts';
import { VercelMaterialObservation } from '@/src/server/infrastructure/ai/vercelMaterialObservation';
import { VercelCreationGuideAuthor } from '@/src/server/infrastructure/ai/vercelCreationGuideAuthor';
import { MockLanguageModelV4 } from 'ai/test';
import { modelOutput } from '@/src/shared/cohort-creation/__tests__/fixtures';
import { initialCohort } from '@/src/shared/cohort-builder/intake';
import type { CohortWorkspace } from '@/src/shared/cohort-builder/contracts';
import { planTextJobs } from '../text-job-plan';

const s3Migration = readFileSync(
  new URL('../../../../../prisma/interaction-s3-storage.sql', import.meta.url),
  'utf8'
);
const journeyMigration = readFileSync(
  new URL('../../../../../prisma/interaction-journey-stages.sql', import.meta.url),
  'utf8'
);

async function setupTestDb(): Promise<{ db: PGlite; sql: TextArtifactSql }> {
  const db = new PGlite();
  await db.exec(`
    CREATE TABLE IF NOT EXISTS "interaction_workspaces" (
      "id" TEXT PRIMARY KEY,
      "ownerId" TEXT NOT NULL,
      "domainId" TEXT NOT NULL DEFAULT 'cohort',
      "domainVersion" INTEGER NOT NULL DEFAULT 1,
      "snapshot" JSONB NOT NULL DEFAULT '{}',
      "revision" INTEGER NOT NULL DEFAULT 0,
      "contextEpoch" INTEGER NOT NULL DEFAULT 0,
      "sequence" INTEGER NOT NULL DEFAULT 0,
      "lifecycle" TEXT NOT NULL DEFAULT 'active',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await db.exec(s3Migration);
  await db.exec(journeyMigration);
  await db.exec(`
    CREATE TABLE IF NOT EXISTS "creation_budgets" (
      "key" TEXT PRIMARY KEY,
      "used" INTEGER NOT NULL DEFAULT 0,
      "expiresAt" TIMESTAMP(3) NOT NULL
    );
    CREATE TABLE IF NOT EXISTS "cohort_admin_controls" (
      "control_key" VARCHAR(64) PRIMARY KEY,
      "value" JSONB NOT NULL,
      "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updated_by" VARCHAR(128) NOT NULL,
      "reason" TEXT
    );
    CREATE TABLE IF NOT EXISTS "cohort_admin_control_audit" (
      "id" BIGSERIAL PRIMARY KEY,
      "control_key" VARCHAR(64) NOT NULL,
      "old_value" JSONB,
      "new_value" JSONB NOT NULL,
      "actor_id" VARCHAR(128) NOT NULL,
      "reason" TEXT NOT NULL,
      "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  const sql: TextArtifactSql = {
    query: async (queryText: string, parameters: unknown[]) => {
      const res = await db.query(queryText, parameters as any[]);
      return { rows: res.rows as Record<string, unknown>[] };
    },
  };
  return { db, sql };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('Checkpoint 3: Provider Safety, Metadata Fail-Closed, Budgets & Aborts', () => {
  describe('1. YouTube Metadata Fail-Closed & Video Verification', () => {
    // 11 characters required for valid YouTube videoId
    const videoId = 'sampleVid12';
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

    it('fails closed when YouTube metadata reader fails on network error (no placeholder fallback)', async () => {
      const failingReader = {
        read: vi.fn().mockRejectedValue(
          new CreationStorageError('UNAVAILABLE', 'YouTube metadata could not be reached.')
        ),
      };

      const provider = new LiveVideoObservationProvider({
        reader: failingReader,
        observer: {
          identity: { provider: 'google', modelId: 'gemini', adapterVersion: 'v1' },
          observeVideo: vi.fn(),
        },
      });

      const controller = new AbortController();
      const dummyMetadata: YoutubeVideoMetadata = {
        videoId,
        url: videoUrl,
        title: 'Placeholder title',
        description: '',
        channelId: 'channel',
        channelTitle: 'channel',
        durationSeconds: 120,
        etag: 'etag',
        privacy: 'public' as const,
        publishedAt: new Date().toISOString(),
      };

      // Must throw CreationStorageError/UNAVAILABLE and NOT fall back to dummy metadata
      await expect(
        provider.observeVideo(dummyMetadata, controller.signal)
      ).rejects.toThrow('YouTube metadata could not be reached.');

      expect(failingReader.read).toHaveBeenCalledWith(videoUrl, controller.signal);
    });

    it('fails closed when YouTube metadata reader returns videos that do not match requested video ID', async () => {
      const otherId = 'otherVid123';
      const mismatchedReader = {
        read: vi.fn().mockResolvedValue({
          schemaVersion: 1,
          sourceUrl: videoUrl,
          fetchedAt: new Date().toISOString(),
          kind: 'youtube_video',
          playlistId: null,
          units: [
            {
              videoId: otherId,
              url: `https://www.youtube.com/watch?v=${otherId}`,
              title: 'Wrong Video',
              description: 'This is not the video requested',
              channelId: 'chan-wrong',
              channelTitle: 'Wrong Channel',
              durationSeconds: 180,
              etag: 'etag-wrong',
              privacy: 'public' as const,
              publishedAt: new Date().toISOString(),
            },
          ],
          coverage: 'complete_metadata',
        }),
      };

      const provider = new LiveVideoObservationProvider({
        reader: mismatchedReader,
        observer: {
          identity: { provider: 'google', modelId: 'gemini', adapterVersion: 'v1' },
          observeVideo: vi.fn(),
        },
      });

      const dummyMetadata: YoutubeVideoMetadata = {
        videoId,
        url: videoUrl,
        title: 'Placeholder title',
        description: '',
        channelId: 'channel',
        channelTitle: 'channel',
        durationSeconds: 120,
        etag: 'etag',
        privacy: 'public' as const,
        publishedAt: new Date().toISOString(),
      };

      // Must throw VIDEO_NOT_FOUND rather than accepting the wrong video from units[0]
      await expect(
        provider.observeVideo(dummyMetadata, new AbortController().signal)
      ).rejects.toThrow('VIDEO_NOT_FOUND');
    });

    it('succeeds when verified metadata matches requested video ID', async () => {
      const verifiedMetadata: YoutubeVideoMetadata = {
        videoId,
        url: videoUrl,
        title: 'Verified Consensus Lecture',
        description: 'Detailed lecture notes',
        channelId: 'chan-verified',
        channelTitle: 'Verified Channel',
        durationSeconds: 240,
        etag: 'etag-verified',
        privacy: 'public' as const,
        publishedAt: new Date().toISOString(),
      };

      const validReader = {
        read: vi.fn().mockResolvedValue({
          schemaVersion: 1,
          sourceUrl: videoUrl,
          fetchedAt: new Date().toISOString(),
          kind: 'youtube_video',
          playlistId: null,
          units: [verifiedMetadata],
          coverage: 'complete_metadata',
        }),
      };

      const mockObserver = {
        identity: { provider: 'google', modelId: 'gemini-1.5-pro', adapterVersion: 'vercel-video-observation-v3' },
        observeVideo: vi.fn().mockResolvedValue({
          canObserve: true,
          observations: [
            { startSeconds: 0, endSeconds: 60, text: 'Introduction to consensus.' },
            { startSeconds: 60, endSeconds: 200, text: 'Paxos and Raft consensus protocols.' },
          ],
          limitations: ['Non-exhaustive coverage.'],
        }),
      };

      const provider = new LiveVideoObservationProvider({
        reader: validReader,
        observer: mockObserver,
      });

      const result = await provider.observeVideo(verifiedMetadata, new AbortController().signal);
      expect(result.video.id).toBe(videoId);
      expect(result.video.title).toBe('Verified Consensus Lecture');
      expect(result.observations).toHaveLength(2);
      expect(mockObserver.observeVideo).toHaveBeenCalledWith(verifiedMetadata, expect.any(Object));
    });
  });

  describe('2. Budget Policy & beforeCall Hooks for Live Paths', () => {
    it('reserveModelTurnBudgetSql atomically increments creation_budgets and rejects when limit exceeded', async () => {
      const { sql } = await setupTestDb();
      const userId = 'user-budget-test';
      const workspaceId = 'ws-budget-test';
      const limit = 2;

      // 1st call: succeeds
      const first = await reserveModelTurnBudgetSql(sql, { userId, workspaceId, limit });
      expect(first.reservation.resource).toBe('model_turn');
      expect(typeof first.release).toBe('function');

      // 2nd call: succeeds
      const second = await reserveModelTurnBudgetSql(sql, { userId, workspaceId, limit });
      expect(second.reservation.resource).toBe('model_turn');

      // 3rd call: budget exhausted, throws UserBudgetExceededError
      await expect(
        reserveModelTurnBudgetSql(sql, { userId, workspaceId, limit })
      ).rejects.toBeInstanceOf(UserBudgetExceededError);

      await expect(
        reserveModelTurnBudgetSql(sql, { userId, workspaceId, limit })
      ).rejects.toThrow('Hourly assistant turn budget reached.');
    });

    it('createTextSourceProcessor enforces budget hook before calling LiveCreationGuideAuthor', async () => {
      const { sql, db } = await setupTestDb();
      const workspaceId = '11111111-1111-4111-8111-111111111111';
      const ownerId = 'user-guide-budget';

      await db.query(`
        INSERT INTO "interaction_workspaces" ("id", "ownerId", "domainId", "snapshot")
        VALUES ($1, $2, 'cohort', '{}')
      `, [workspaceId, ownerId]);

      // Seed budget as already exhausted (used = limit)
      const nowMs = Date.now();
      const hour = Math.floor(nowMs / 3_600_000);
      const budgetKey = `user:${ownerId}:model_turn:${hour}`;
      const expiresAt = new Date((hour + 2) * 3_600_000);
      const limit = hourlyUserModelTurns();
      await db.query(`
        INSERT INTO "creation_budgets" ("key", "used", "expiresAt")
        VALUES ($1, $2, $3)
      `, [budgetKey, limit, expiresAt]);

      const mockAuthor = {
        identity: { provider: 'test', modelId: 'test', adapterVersion: '1' },
        author: vi.fn(),
      };

      const baseGuide = initialCohort('Learn Rust');
      const workspace: CohortWorkspace = {
        ...baseGuide,
        journey: {
          version: 1,
          step: 'processing',
          branch: 'have_goal',
          processingStarted: true,
          intentVersion: 0,
        },
        sources: [
          {
            id: 'src-guide',
            version: 1,
            label: 'AI Guide',
            text: '',
            checksum: null,
            state: 'queued',
            input: {
              kind: 'generated_guide',
              goal: 'Learn Rust',
              audience: 'Beginners',
              dailyMinutes: 30,
              intentVersion: 0,
            },
          },
        ],
      };

      const processor = createTextSourceProcessor({
        sql,
        loadWorkspace: async () => workspace,
        guideAuthor: mockAuthor as any,
      });

      const [plannedGuide] = planTextJobs(workspace);
      const claimedJob: ClaimedTextJob = {
        id: 'job-guide-test',
        workspaceId,
        stage: plannedGuide.stage,
        sourceId: plannedGuide.sourceId,
        sourceVersion: plannedGuide.sourceVersion,
        dependencyFingerprint: plannedGuide.dependencyFingerprint,
        fence: 1,
        leaseToken: 'token',
        leaseUntil: new Date(Date.now() + 10_000),
      };

      // Expect processor to throw UserBudgetExceededError / BUDGET_EXHAUSTED
      await expect(processor(claimedJob)).rejects.toThrow('Hourly assistant turn budget reached.');

      // Verify the AI author was NEVER called
      expect(mockAuthor.author).not.toHaveBeenCalled();
    });

    it('createTextSourceProcessor enforces budget hook before calling LiveVideoObservationProvider', async () => {
      const { sql, db } = await setupTestDb();
      const workspaceId = '22222222-2222-4222-8222-222222222222';
      const ownerId = 'user-video-budget';

      await db.query(`
        INSERT INTO "interaction_workspaces" ("id", "ownerId", "domainId", "snapshot")
        VALUES ($1, $2, 'cohort', '{}')
      `, [workspaceId, ownerId]);

      // Seed budget as exhausted
      const nowMs = Date.now();
      const hour = Math.floor(nowMs / 3_600_000);
      const budgetKey = `user:${ownerId}:model_turn:${hour}`;
      const expiresAt = new Date((hour + 2) * 3_600_000);
      const limit = hourlyUserModelTurns();
      await db.query(`
        INSERT INTO "creation_budgets" ("key", "used", "expiresAt")
        VALUES ($1, $2, $3)
      `, [budgetKey, limit, expiresAt]);

      const mockProvider = {
        observeVideo: vi.fn(),
      };

      const baseVideo = initialCohort('Learn Algorithms');
      const workspace: CohortWorkspace = {
        ...baseVideo,
        journey: {
          version: 1,
          step: 'processing',
          branch: 'have_material',
          processingStarted: true,
          intentVersion: 0,
        },
        sources: [
          {
            id: 'src-video',
            version: 1,
            label: 'Algorithms Video',
            text: '',
            checksum: null,
            state: 'queued',
            input: {
              kind: 'youtube',
              url: 'https://www.youtube.com/watch?v=sampleVid12',
              mode: 'video_observation',
            },
          },
        ],
      };

      const processor = createTextSourceProcessor({
        sql,
        loadWorkspace: async () => workspace,
        videoObservationProvider: mockProvider,
      });

      const [plannedVideo] = planTextJobs(workspace);
      const claimedJob: ClaimedTextJob = {
        id: 'job-video-test',
        workspaceId,
        stage: plannedVideo.stage,
        sourceId: plannedVideo.sourceId,
        sourceVersion: plannedVideo.sourceVersion,
        dependencyFingerprint: plannedVideo.dependencyFingerprint,
        fence: 1,
        leaseToken: 'token',
        leaseUntil: new Date(Date.now() + 10_000),
      };

      // Expect budget exhaustion error before observing video
      await expect(processor(claimedJob)).rejects.toThrow('Hourly assistant turn budget reached.');

      // Observer was never called
      expect(mockProvider.observeVideo).not.toHaveBeenCalled();
    });

    it('VercelMaterialObservation invokes beforeCall before model generation and settles release function', async () => {
      const releaseFn = vi.fn().mockResolvedValue(undefined);
      const beforeCall = vi.fn().mockResolvedValue(releaseFn);

      const fakeModel: any = new MockLanguageModelV4({
        provider: 'google.generative-ai',
        modelId: 'gemini-1.5-pro',
        doGenerate: modelOutput({
          canObserve: true,
          observations: [{ startSeconds: 0, endSeconds: 30, text: 'Consensus overview.' }],
          limitations: ['Estimated intervals.'],
        }),
      });
      Object.defineProperty(fakeModel, 'supportedUrls', {
        value: Promise.resolve({
          'video/mp4': [new RegExp('https://www.youtube.com/watch\\?v=[A-Za-z0-9_-]{11}')],
        }),
        configurable: true,
      });

      const observation = new VercelMaterialObservation(fakeModel, {
        beforeCall,
      });

      const video: YoutubeVideoMetadata = {
        videoId: 'sampleVid12',
        url: 'https://www.youtube.com/watch?v=sampleVid12',
        title: 'Sample Video',
        description: '',
        channelId: 'chan',
        channelTitle: 'chan',
        durationSeconds: 60,
        etag: 'etag',
        privacy: 'public' as const,
        publishedAt: new Date().toISOString(),
      };

      const result = await observation.observeVideo(video, new AbortController().signal);
      expect(result.canObserve).toBe(true);
      expect(beforeCall).toHaveBeenCalledWith(video.videoId);
      expect(releaseFn).toHaveBeenCalledOnce();
    });

    it('VercelCreationGuideAuthor invokes beforeCall before model generation and settles release function', async () => {
      const releaseFn = vi.fn().mockResolvedValue(undefined);
      const beforeCall = vi.fn().mockResolvedValue(releaseFn);

      const fakeModel = new MockLanguageModelV4({
        provider: 'google.generative-ai',
        modelId: 'gemini-1.5-pro',
        doGenerate: modelOutput({
          title: 'Learn Rust Guide',
          sections: [
            {
              heading: 'Getting Started',
              text: 'Guide body text explaining Rust fundamentals.',
            },
          ],
          limitations: ['AI-authored content.'],
        }),
      });

      const author = new VercelCreationGuideAuthor(fakeModel as any, {
        beforeCall,
      });

      const intent = {
        id: randomUUID(),
        rawQuery: 'Learn Rust',
        revision: 0,
        topic: { value: 'Learn Rust', origin: 'user' as const, acceptedRevision: 0 },
        outcomes: { value: ['Complete in 30 min'], origin: 'user' as const, acceptedRevision: 0 },
        level: { value: 'Beginner', origin: 'user' as const, acceptedRevision: 0 },
        language: null,
        searchTerms: [],
        uncertainties: [],
      };

      const result = await author.author(intent, new AbortController().signal);
      expect(result.sections).toHaveLength(1);
      expect(beforeCall).toHaveBeenCalledOnce();
      expect(releaseFn).toHaveBeenCalledOnce();
    });
  });

  describe('3. AbortSignal Propagation Across Durable Worker and Adapters', () => {
    it('runTextJobTick passes real AbortSignal into process and aborts immediately when heartbeat fails (lease lost)', async () => {
      const fakeJob: ClaimedTextJob = {
        id: 'job-abort-lost-lease',
        workspaceId: 'ws-abort',
        stage: 'chunking',
        sourceId: 'src-1',
        sourceVersion: 1,
        dependencyFingerprint: 'dep-fp',
        fence: 1,
        leaseToken: 'token-lost',
        leaseUntil: new Date(Date.now() + 1000),
      };

      const fakeSql = {
        query: vi.fn(async (statement: string) => {
          if (statement.includes('UPDATE "cohort_text_jobs" j') && statement.includes('SET "status" = \'running\'')) {
            return { rows: [fakeJob] };
          }
          if (statement.includes('WHERE "id" = $3') && statement.includes('leaseToken')) {
            return { rows: [] }; // heartbeat fails -> lease lost!
          }
          return { rows: [] };
        }),
      };

      let observedSignal: AbortSignal | undefined;

      const result = await runTextJobTick({
        sql: fakeSql as any,
        workerId: 'worker-abort-test',
        leaseMs: 1000,
        now: () => new Date(),
        renewLease: true,
        process: async (_job, signal) => {
          observedSignal = signal;
          // Wait for heartbeat to run and fail
          await new Promise<void>((resolve) => {
            if (signal?.aborted) return resolve();
            signal?.addEventListener('abort', () => resolve(), { once: true });
          });
          return new Uint8Array([1, 2, 3]);
        },
        accept: async () => true,
      });

      expect(result.status).toBe('stale');
      expect(observedSignal).toBeDefined();
      expect(observedSignal!.aborted).toBe(true);
      expect((observedSignal!.reason as Error).message).toBe('LEASE_LOST');
    });

    it('runTextJobTick aborts downstream signal and fails with PROCESSOR_DEADLINE when timeout expires', async () => {
      const fakeJob: ClaimedTextJob = {
        id: 'job-abort-deadline',
        workspaceId: 'ws-abort-deadline',
        stage: 'chunking',
        sourceId: 'src-1',
        sourceVersion: 1,
        dependencyFingerprint: 'dep-fp',
        fence: 1,
        leaseToken: 'token-dl',
        leaseUntil: new Date(Date.now() + 10_000),
      };

      const fakeSql = {
        query: vi.fn(async (statement: string) => {
          if (statement.includes('UPDATE "cohort_text_jobs" j') && statement.includes('SET "status" = \'running\'')) {
            return { rows: [fakeJob] };
          }
          return { rows: [] };
        }),
      };

      const fail = vi.fn(async () => true);
      let observedSignal: AbortSignal | undefined;

      const result = await runTextJobTick({
        sql: fakeSql as any,
        workerId: 'worker-dl-test',
        leaseMs: 10_000,
        now: () => new Date(),
        processTimeoutMs: 50,
        process: async (_job, signal) => {
          observedSignal = signal;
          await new Promise((r) => setTimeout(r, 200));
          return new Uint8Array([1]);
        },
        accept: async () => true,
        fail,
      });

      expect(result.status).toBe('failed');
      expect(observedSignal).toBeDefined();
      expect(observedSignal!.aborted).toBe(true);
      expect((observedSignal!.reason as Error).message).toBe('PROCESSOR_DEADLINE');
      expect(fail).toHaveBeenCalledWith(
        expect.objectContaining({ id: fakeJob.id }),
        'PROCESSOR_DEADLINE',
        expect.any(Date)
      );
    });

    it('fetchRetainedWeb respects AbortSignal and aborts streaming on signal abort', async () => {
      const controller = new AbortController();

      const mockTransport = {
        resolve: vi.fn().mockResolvedValue([{ address: '93.184.216.34', family: 4 }]),
        open: vi.fn().mockImplementation(async (_url: URL, _addr: any, signal: AbortSignal) => {
          return {
            status: 200,
            headers: { 'content-type': 'text/html' },
            bytes: (async function* () {
              yield new Uint8Array([65, 66, 67]);
              // Trigger abort during stream
              controller.abort();
              signal.throwIfAborted();
              yield new Uint8Array([68, 69, 70]);
            })(),
            close: vi.fn(),
          };
        }),
      };

      await expect(
        fetchRetainedWeb('https://example.com/article', mockTransport as any, controller.signal)
      ).rejects.toThrow('WEB_SOURCE_REJECTED');
    });

    it('createTextAssemblyProcessor checks AbortSignal and halts when aborted', async () => {
      const processor = createTextAssemblyProcessor({
        sql: { query: vi.fn() } as any,
        loadWorkspace: vi.fn(),
      });

      const controller = new AbortController();
      controller.abort();

      const claimedJob: ClaimedTextJob = {
        id: 'job-assembly',
        workspaceId: 'ws-assembly',
        stage: 'assembly',
        sourceId: null,
        sourceVersion: null,
        dependencyFingerprint: 'dep',
        fence: 1,
        leaseToken: 'tok',
        leaseUntil: new Date(),
      };

      await expect(processor(claimedJob, controller.signal)).rejects.toThrow();
    });

    it('acquireVideoObservation aborts immediately when callerSignal is already aborted', async () => {
      const controller = new AbortController();
      controller.abort();

      await expect(
        acquireVideoObservation(
          { kind: 'youtube', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
          undefined,
          controller.signal
        )
      ).rejects.toThrow('VIDEO_OBSERVATION_CANCELED');
    });

    it('acquireGeneratedGuide aborts immediately when callerSignal is already aborted', async () => {
      const controller = new AbortController();
      controller.abort();

      await expect(
        acquireGeneratedGuide(
          {
            kind: 'generated_guide',
            goal: 'Learn Go',
            audience: 'General',
            dailyMinutes: 20,
            intentVersion: 0,
          },
          undefined,
          controller.signal
        )
      ).rejects.toThrow('GENERATED_GUIDE_CANCELED');
    });
  });

  describe('3. Fail-Closed Provider Accounting & Restart Safety (Checkpoint 1)', () => {
    it('resolveWorkspaceOwner fails closed with OWNER_REQUIRED when workspace does not exist', async () => {
      const { sql } = await setupTestDb();
      const { resolveWorkspaceOwner } = await import('../budget-policy');

      await expect(
        resolveWorkspaceOwner(sql, 'non-existent-workspace-id')
      ).rejects.toThrow('OWNER_REQUIRED');
    });

    it('resolveWorkspaceOwner fails closed with ACCOUNTING_STORAGE_UNAVAILABLE on database failure', async () => {
      const failingSql: TextArtifactSql = {
        query: vi.fn().mockRejectedValue(new Error('connection dropped')),
      };
      const { resolveWorkspaceOwner } = await import('../budget-policy');

      await expect(
        resolveWorkspaceOwner(failingSql, 'some-ws')
      ).rejects.toThrow('ACCOUNTING_STORAGE_UNAVAILABLE');
    });

    it('reserveModelTurnBudgetSql fails closed with MODEL_CALLS_PAUSED when model calls are paused by operator', async () => {
      const { sql } = await setupTestDb();
      const { setModelCallsPaused } = await import('../admin-controls');
      await setModelCallsPaused({ query: (stmt, p) => sql.query(stmt, p ?? []) }, {
        paused: true,
        actorId: 'operator-1',
        reason: 'Maintenance window',
      });

      await expect(
        reserveModelTurnBudgetSql(sql, {
          userId: 'user-pause-test',
          workspaceId: 'ws-pause-test',
        })
      ).rejects.toThrow('MODEL_CALLS_PAUSED');
    });

    it('reserveModelTurnBudgetSql is restart-safe and does not double-count on duplicate invocationKey', async () => {
      const { sql, db } = await setupTestDb();
      const userId = 'user-restart-test';
      const workspaceId = 'ws-restart-test';
      const invocationKey = 'job:rec:0:gen:0:att:0:ord:1';

      // First attempt
      const res1 = await reserveModelTurnBudgetSql(sql, {
        userId,
        workspaceId,
        invocationKey,
        limit: 10,
      });
      expect(res1.isExistingReservation).toBe(false);

      // Check user budget count = 1
      const nowMs = Date.now();
      const hour = Math.floor(nowMs / 3_600_000);
      const userKey = `user:${userId}:model_turn:${hour}`;
      const userBudgetRow1 = (await db.query(`SELECT "used" FROM "creation_budgets" WHERE "key" = $1`, [userKey])).rows[0] as { used: number };
      expect(userBudgetRow1.used).toBe(1);

      // Settle reservation
      await res1.release({ actualUsage: { promptTokens: 100, completionTokens: 50 } });

      // Check invocation record is settled (used = 2)
      const invRow1 = (await db.query(`SELECT "used" FROM "creation_budgets" WHERE "key" = $1`, [`inv:${invocationKey}`])).rows[0] as { used: number };
      expect(invRow1.used).toBe(2);

      // Re-execution / restart with the same invocationKey (e.g. idempotency replay)
      const res2 = await reserveModelTurnBudgetSql(sql, {
        userId,
        workspaceId,
        invocationKey,
        limit: 10,
      });
      expect(res2.isExistingReservation).toBe(true);

      // User budget count MUST STILL BE 1 (not double-counted!)
      const userBudgetRow2 = (await db.query(`SELECT "used" FROM "creation_budgets" WHERE "key" = $1`, [userKey])).rows[0] as { used: number };
      expect(userBudgetRow2.used).toBe(1);
    });

    it('createDurableProviderCallHook tracks call ordinals for nested provider calls', async () => {
      const { sql, db } = await setupTestDb();
      const workspaceId = 'ws-nested-calls';
      const ownerId = 'user-nested-calls';

      await db.query(`
        INSERT INTO "interaction_workspaces" ("id", "ownerId", "domainId", "snapshot")
        VALUES ($1, $2, 'cohort', '{}')
      `, [workspaceId, ownerId]);

      const { createDurableProviderCallHook } = await import('../budget-policy');
      const hook = createDurableProviderCallHook({
        sql,
        workspaceId,
        jobKey: 'journey:discovery:0:0',
        operation: 'discovery',
        generation: 0,
        attempt: 0,
      });

      // Call 1 (e.g. search): ordinal 1
      const release1 = await hook();
      if (typeof release1 === 'function') await release1();

      // Call 2 (e.g. select): ordinal 2
      const release2 = await hook();
      if (typeof release2 === 'function') await release2();

      // Invocations recorded:
      const inv1 = (await db.query(`SELECT "key" FROM "creation_budgets" WHERE "key" = $1`, [
        'inv:job:journey:discovery:0:0:op:discovery:gen:0:att:0:ord:1'
      ])).rows;
      expect(inv1).toHaveLength(1);

      const inv2 = (await db.query(`SELECT "key" FROM "creation_budgets" WHERE "key" = $1`, [
        'inv:job:journey:discovery:0:0:op:discovery:gen:0:att:0:ord:2'
      ])).rows;
      expect(inv2).toHaveLength(1);

      // Total user turns spent = 2
      const nowMs = Date.now();
      const hour = Math.floor(nowMs / 3_600_000);
      const userKey = `user:${ownerId}:model_turn:${hour}`;
      const userBudgetRow = (await db.query(`SELECT "used" FROM "creation_budgets" WHERE "key" = $1`, [userKey])).rows[0] as { used: number };
      expect(userBudgetRow.used).toBe(2);
    });

    it('executeCohortRecommendations fails closed when sql is missing and default AI is requested', async () => {
      const { executeCohortRecommendations } = await import('../journey-recommendation-adapter');
      const workspace = initialCohort('Learn Chemistry');

      await expect(
        executeCohortRecommendations(workspace, {})
      ).rejects.toThrow('ACCOUNTING_STORAGE_UNAVAILABLE');
    });

    it('executeCohortDiscovery fails closed when sql is missing and default AI is requested', async () => {
      const { executeCohortDiscovery } = await import('../journey-discovery-adapter');
      const workspace = initialCohort('Learn Physics');

      await expect(
        executeCohortDiscovery(workspace, {})
      ).rejects.toThrow('ACCOUNTING_STORAGE_UNAVAILABLE');
    });

    it('executeCohortRecommendations fails closed when workspace has no owner in database', async () => {
      const { sql } = await setupTestDb();
      const { executeCohortRecommendations } = await import('../journey-recommendation-adapter');
      const workspace = initialCohort('Learn Biology');
      const mockModel: any = new MockLanguageModelV4({
        doGenerate: vi.fn() as any,
      });

      await expect(
        executeCohortRecommendations(workspace, {
          sql,
          workspaceId: 'ws-no-owner',
          model: mockModel as any,
        })
      ).rejects.toThrow('OWNER_REQUIRED');
    });

    it('single reservation per single-call operation for generated_guide and video_observation (no double outer reservation)', async () => {
      const { sql, db } = await setupTestDb();
      const workspaceId = '33333333-3333-4333-8333-333333333333';
      const ownerId = 'user-single-reservation';

      await db.query(`
        INSERT INTO "interaction_workspaces" ("id", "ownerId", "domainId", "snapshot")
        VALUES ($1, $2, 'cohort', '{}')
      `, [workspaceId, ownerId]);

      const fakeGuideModel = new MockLanguageModelV4({
        provider: 'google.generative-ai',
        modelId: 'gemini-1.5-pro',
        doGenerate: modelOutput({
          title: 'Learn Rust Guide',
          sections: [
            {
              heading: 'Getting Started',
              text: 'Guide body text explaining Rust fundamentals in clear structured prose.',
            },
          ],
          limitations: ['AI-authored content.'],
        }),
      });

      const baseGuide = initialCohort('Learn Rust');
      const guideWorkspace: CohortWorkspace = {
        ...baseGuide,
        journey: {
          version: 1,
          step: 'processing',
          branch: 'have_goal',
          processingStarted: true,
          intentVersion: 0,
        },
        sources: [
          {
            id: 'src-guide-single',
            version: 1,
            label: 'AI Guide',
            text: '',
            checksum: null,
            state: 'queued',
            input: {
              kind: 'generated_guide',
              goal: 'Learn Rust',
              audience: 'Beginners',
              dailyMinutes: 30,
              intentVersion: 0,
            },
          },
        ],
      };

      const { createDurableProviderCallHook } = await import('../budget-policy');
      const [plannedGuide] = planTextJobs(guideWorkspace);
      const guideHook = createDurableProviderCallHook({
        sql,
        workspaceId,
        jobKey: plannedGuide.jobKey,
        dependencyFingerprint: plannedGuide.dependencyFingerprint,
        operation: 'guide_author',
        attempt: 0,
      });

      const liveAuthor = new LiveCreationGuideAuthor({
        model: fakeGuideModel as any,
        beforeCall: guideHook,
      });

      await acquireGeneratedGuide(
        guideWorkspace.sources[0].input as any,
        liveAuthor,
        new AbortController().signal
      );

      const nowMs = Date.now();
      const hour = Math.floor(nowMs / 3_600_000);
      const userKey = `user:${ownerId}:model_turn:${hour}`;
      const guideBudget = (await db.query(`SELECT "used" FROM "creation_budgets" WHERE "key" = $1`, [userKey])).rows[0] as { used: number };
      expect(guideBudget.used).toBe(1);

      const invRows = (await db.query(`SELECT "invocationKey", "status", "ordinal" FROM "cohort_model_invocations" WHERE "workspaceId" = $1`, [workspaceId])).rows as Array<{ invocationKey: string; status: string; ordinal: number }>;
      expect(invRows).toHaveLength(1);
      expect(invRows[0].status).toBe('settled');
      expect(Number(invRows[0].ordinal)).toBe(1);
    });

    it('schema-repair retry inside VercelCreationGuideAuthor increments ordinal (1 then 2) and settles both', async () => {
      const { sql, db } = await setupTestDb();
      const workspaceId = '44444444-4444-4444-8444-444444444444';
      const ownerId = 'user-repair-ordinal';

      await db.query(`
        INSERT INTO "interaction_workspaces" ("id", "ownerId", "domainId", "snapshot")
        VALUES ($1, $2, 'cohort', '{}')
      `, [workspaceId, ownerId]);

      let callNum = 0;
      const repairingModel = new MockLanguageModelV4({
        provider: 'google.generative-ai',
        modelId: 'gemini-1.5-pro',
        doGenerate: async () => {
          callNum += 1;
          if (callNum === 1) {
            // Return invalid schema on attempt 1 so it triggers repair attempt 2
            return modelOutput({ invalid: true });
          }
          return modelOutput({
            title: 'Repaired Guide',
            sections: [{ heading: 'Section 1', text: 'Valid repaired guide text content.' }],
            limitations: ['AI-authored content.'],
          });
        },
      });

      const { createDurableProviderCallHook } = await import('../budget-policy');
      const hook = createDurableProviderCallHook({
        sql,
        workspaceId,
        jobKey: 'text:src-1:1:acquisition',
        dependencyFingerprint: 'fp-guide-repair',
        operation: 'guide_author',
        attempt: 0,
      });

      const author = new LiveCreationGuideAuthor({
        model: repairingModel as any,
        beforeCall: hook,
      });

      const acquired = await acquireGeneratedGuide(
        {
          kind: 'generated_guide',
          goal: 'Learn TypeScript',
          audience: 'Developers',
          dailyMinutes: 25,
          intentVersion: 0,
        },
        author,
        new AbortController().signal
      );
      expect(acquired.artifact.text).toContain('Repaired Guide');

      const invRows = (await db.query(
        `SELECT "ordinal", "status", "promptTokens", "completionTokens", "error"
         FROM "cohort_model_invocations"
         WHERE "workspaceId" = $1
         ORDER BY "ordinal" ASC`,
        [workspaceId]
      )).rows as Array<{ ordinal: number; status: string; promptTokens: number | null; completionTokens: number | null; error: string | null }>;

      expect(invRows).toHaveLength(2);
      expect(Number(invRows[0].ordinal)).toBe(1);
      expect(invRows[0].status).toBe('unknown_outcome_retained');
      expect(Number(invRows[1].ordinal)).toBe(2);
      expect(invRows[1].status).toBe('settled');
    });

    it('LiveVideoObservationProvider with VercelMaterialObservation reserves once per attempt and increments ordinal on schema repair', async () => {
      const { sql, db } = await setupTestDb();
      const workspaceId = '55555555-5555-4555-8555-555555555555';
      const ownerId = 'user-video-ordinal';
      const videoId = 'sampleVid12';
      const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

      await db.query(`
        INSERT INTO "interaction_workspaces" ("id", "ownerId", "domainId", "snapshot")
        VALUES ($1, $2, 'cohort', '{}')
      `, [workspaceId, ownerId]);

      let callNum = 0;
      const fakeVideoModel: any = new MockLanguageModelV4({
        provider: 'google.generative-ai',
        modelId: 'gemini-1.5-pro',
        doGenerate: async () => {
          callNum += 1;
          if (callNum === 1) {
            return modelOutput({ bad: 1 });
          }
          return modelOutput({
            canObserve: true,
            observations: [{ startSeconds: 0, endSeconds: 45, text: 'Observed lecture segment.' }],
            limitations: ['Estimated intervals.'],
          });
        },
      });
      Object.defineProperty(fakeVideoModel, 'supportedUrls', {
        value: Promise.resolve({
          'video/mp4': [new RegExp('https://www.youtube.com/watch\\?v=[A-Za-z0-9_-]{11}')],
        }),
        configurable: true,
      });

      const verifiedMetadata: YoutubeVideoMetadata = {
        videoId,
        url: videoUrl,
        title: 'Lecture Video',
        description: 'Notes',
        channelId: 'chan-1',
        channelTitle: 'Channel 1',
        durationSeconds: 120,
        etag: 'etag-1',
        privacy: 'public' as const,
        publishedAt: new Date().toISOString(),
      };

      const validReader = {
        read: vi.fn().mockResolvedValue({
          schemaVersion: 1,
          sourceUrl: videoUrl,
          fetchedAt: new Date().toISOString(),
          kind: 'youtube_video',
          playlistId: null,
          units: [verifiedMetadata],
          coverage: 'complete_metadata',
        }),
      };

      const { createDurableProviderCallHook } = await import('../budget-policy');
      const unitHook = createDurableProviderCallHook({
        sql,
        workspaceId,
        jobKey: 'text:src-vid:1:acquisition',
        dependencyFingerprint: 'fp-vid-1',
        operation: `video_observation:${videoId}`,
        attempt: 0,
      });

      const provider = new LiveVideoObservationProvider({
        reader: validReader,
        model: fakeVideoModel,
        beforeCall: () => unitHook(),
      });

      const result = await provider.observeVideo(verifiedMetadata, new AbortController().signal);
      expect(result.video.id).toBe(videoId);

      const invRows = (await db.query(
        `SELECT "ordinal", "status" FROM "cohort_model_invocations" WHERE "workspaceId" = $1 ORDER BY "ordinal" ASC`,
        [workspaceId]
      )).rows as Array<{ ordinal: number; status: string }>;
      // 2 actual model calls (attempt 1 failed schema, attempt 2 succeeded), NOT 3 or 4 from duplicate outer wrapper
      expect(invRows).toHaveLength(2);
      expect(Number(invRows[0].ordinal)).toBe(1);
      expect(invRows[0].status).toBe('unknown_outcome_retained');
      expect(Number(invRows[1].ordinal)).toBe(2);
      expect(invRows[1].status).toBe('settled');
    });
  });

  describe('4. Real Isolated PostgreSQL Multi-Connection Concurrency & Atomic Deduplication', () => {
    it('atomically deduplicates simultaneous reservations for the same invocationKey across separate PostgreSQL pool connections', async () => {
      const { mkdtempSync, rmSync, existsSync } = await import('node:fs');
      const { resolve } = await import('node:path');
      const { pathToFileURL } = await import('node:url');
      const { Pool } = await import('pg');

      const root = process.cwd();
      const port = 15449;
      const embeddedPostgresModule = resolve(
        root,
        process.env.S3_EMBEDDED_POSTGRES_MODULE ??
          '.tmp/s3-postgres-runtime/node_modules/embedded-postgres/dist/index.js'
      );
      if (!existsSync(embeddedPostgresModule)) {
        return;
      }
      const tempDir = mkdtempSync(resolve(root, '.tmp/pg-acct-concurrency-'));
      const { default: EmbeddedPostgres } = await import(pathToFileURL(embeddedPostgresModule).href);

      const database = new EmbeddedPostgres({
        databaseDir: resolve(tempDir, 'data'),
        user: 's3test',
        password: 's3-local-only',
        port,
        persistent: false,
        createPostgresUser: false,
        postgresFlags: ['-h', '127.0.0.1', '-c', 'timezone=UTC'],
        onLog: () => {},
        onError: () => {},
      });

      const connectionString = `postgresql://s3test:s3-local-only@127.0.0.1:${port}/s3test`;
      try {
        await database.initialise();
        await database.start();
        await database.createDatabase('s3test');

        const pool = new Pool({ connectionString, max: 10 });
        try {
          await pool.query(`
            CREATE TABLE IF NOT EXISTS "interaction_workspaces" (
              "id" TEXT PRIMARY KEY,
              "ownerId" TEXT NOT NULL,
              "domainId" TEXT NOT NULL DEFAULT 'cohort',
              "snapshot" JSONB NOT NULL DEFAULT '{}'
            );
            CREATE TABLE IF NOT EXISTS "creation_budgets" (
              "key" TEXT PRIMARY KEY,
              "used" INTEGER NOT NULL DEFAULT 0,
              "expiresAt" TIMESTAMP(3) NOT NULL
            );
            CREATE TABLE IF NOT EXISTS "cohort_admin_controls" (
              "control_key" VARCHAR(64) PRIMARY KEY,
              "value" JSONB NOT NULL,
              "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              "updated_by" VARCHAR(128) NOT NULL,
              "reason" TEXT
            );
          `);
          await pool.query(s3Migration);
          await pool.query(journeyMigration);

          const workspaceId = 'ws-pg-concurrent';
          const userId = 'user-pg-concurrent';
          await pool.query(
            `INSERT INTO "interaction_workspaces" ("id", "ownerId") VALUES ($1, $2)`,
            [workspaceId, userId]
          );

          // Create 6 separate dedicated clients from the pool to guarantee true concurrent connections
          const clients = await Promise.all(Array.from({ length: 6 }, () => pool.connect()));
          try {
            const sameInvocationKey = 'job:journey:recommendations:0:fp:abc:op:recommendation_ai:gen:0:att:0:ord:1';
            const results = await Promise.all(
              clients.map(client =>
                reserveModelTurnBudgetSql(
                  { query: (q, p) => client.query(q, p) },
                  {
                    userId,
                    workspaceId,
                    invocationKey: sameInvocationKey,
                    jobKey: 'journey:recommendations:0',
                    dependencyFingerprint: 'abc',
                    operation: 'recommendation_ai',
                    attempt: 0,
                    ordinal: 1,
                    limit: 10,
                  }
                )
              )
            );

            // Exactly 1 connection must report isExistingReservation = false; the other 5 must report true
            const freshCount = results.filter(r => !r.isExistingReservation).length;
            const existingCount = results.filter(r => r.isExistingReservation).length;
            expect(freshCount).toBe(1);
            expect(existingCount).toBe(5);

            // User hourly budget must be incremented to 1, NOT 6!
            const hour = Math.floor(Date.now() / 3_600_000);
            const userBudgetKey = `user:${userId}:model_turn:${hour}`;
            const budgetRes = await pool.query(`SELECT "used" FROM "creation_budgets" WHERE "key" = $1`, [userBudgetKey]);
            expect(Number(budgetRes.rows[0].used)).toBe(1);

            // Settle with actual token usage on the winning reservation
            const winner = results.find(r => !r.isExistingReservation)!;
            await winner.release({
              actualUsage: { promptTokens: 320, completionTokens: 180, totalTokens: 500, stepsCount: 1 },
            });

            const invRow = (await pool.query(
              `SELECT "status", "promptTokens", "completionTokens", "totalTokens"
               FROM "cohort_model_invocations" WHERE "invocationKey" = $1`,
              [sameInvocationKey]
            )).rows[0];
            expect(invRow.status).toBe('settled');
            expect(Number(invRow.promptTokens)).toBe(320);
            expect(Number(invRow.completionTokens)).toBe(180);
            expect(Number(invRow.totalTokens)).toBe(500);

            // Test budget exhaustion across concurrent connections with distinct invocation keys:
            // Limit is 3, 1 is already used, so out of 5 concurrent distinct invocations, exactly 2 succeed and 3 reject
            const distinctOutcomes = await Promise.allSettled(
              clients.slice(0, 5).map((client, idx) =>
                reserveModelTurnBudgetSql(
                  { query: (q, p) => client.query(q, p) },
                  {
                    userId,
                    workspaceId,
                    invocationKey: `job:journey:discovery:0:0:op:discovery_ai:gen:0:att:0:ord:${idx + 10}`,
                    jobKey: 'journey:discovery:0:0',
                    operation: 'discovery_ai',
                    attempt: 0,
                    ordinal: idx + 10,
                    limit: 3,
                  }
                )
              )
            );

            const fulfilled = distinctOutcomes.filter(o => o.status === 'fulfilled');
            const rejected = distinctOutcomes.filter(o => o.status === 'rejected');
            expect(fulfilled).toHaveLength(2);
            expect(rejected).toHaveLength(3);

            // Verify no orphan invocation rows exist for the 3 rejected calls
            const totalInvRows = await pool.query(
              `SELECT count(*)::int AS count FROM "cohort_model_invocations" WHERE "workspaceId" = $1`,
              [workspaceId]
            );
            expect(Number(totalInvRows.rows[0].count)).toBe(3); // 1 initial + 2 fulfilled
          } finally {
            for (const c of clients) c.release();
          }
        } finally {
          await pool.end();
        }
      } finally {
        await database.stop().catch(() => {});
        rmSync(tempDir, { recursive: true, force: true });
      }
    }, 90_000);
  });
});



