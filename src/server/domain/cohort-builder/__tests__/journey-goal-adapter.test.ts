import { readFileSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  acquireGeneratedGuide,
  extractGeneratedGuide,
  readOwnedGeneratedGuide,
  LiveCreationGuideAuthor,
  defaultCreationGuideAuthor,
} from '../journey-goal-adapter';
import {
  GENERATED_GUIDE_LIMITS,
  GENERATED_GUIDE_LIMITATION,
  GENERATED_GUIDE_VERSION,
  generatedGuideArtifactSchema,
  renderGeneratedGuide,
  type GeneratedGuideProposal,
} from '@/src/shared/cohort-creation/generated-guide';
import {
  cohortWorkspaceSchema,
  type CohortWorkspace,
} from '@/src/shared/cohort-builder/contracts';
import { extractRetainedSource, sourceExtractionSchema } from '../source-adapters';
import { createTextSourceProcessor } from '../text-source-processor';
import { enqueueTextJobPlan, type TextJobTransactionPort } from '../text-job-scheduler';
import { claimTextJob, acceptTextJob } from '../text-jobs';
import { putTextArtifact, type TextArtifactSql } from '../text-artifacts';
import { computeTextStage } from '../text-pipeline';
import type { CreationGuideAuthor } from '@/src/server/domain/cohort-creation/generated-guide';

const s3Migration = readFileSync(new URL('../../../../../prisma/sql/interaction/interaction-s3-storage.sql', import.meta.url), 'utf8');
const s4bMigration = readFileSync(new URL('../../../../../prisma/sql/interaction/interaction-s4b-sources.sql', import.meta.url), 'utf8');
const journeyMigration = readFileSync(new URL('../../../../../prisma/sql/interaction/interaction-journey-stages.sql', import.meta.url), 'utf8');

const now = new Date('2030-01-01T00:00:00.000Z');
const sampleProposal: GeneratedGuideProposal = {
  title: 'Distributed Consensus Foundations',
  sections: [
    {
      heading: 'Replication and Safety',
      text: 'Distributed nodes coordinate state changes using consensus protocols. Safety ensures no two nodes commit conflicting states at the same index.',
    },
    {
      heading: 'Quorums and Failure Recovery',
      text: 'Majorities overlap in at least one node to guarantee that committed transitions survive crash-recovery scenarios.',
    },
  ],
  limitations: [
    'Theoretical overview only. Implementation details depend on the specific network topology.',
  ],
};

const mockIdentity = {
  provider: 'google',
  modelId: 'gemini-1.5-pro',
  adapterVersion: 'vercel-guide-author-v1',
};

function createMockAuthor(overrides?: Partial<CreationGuideAuthor>): CreationGuideAuthor {
  return {
    identity: mockIdentity,
    author: vi.fn().mockResolvedValue(sampleProposal),
    ...overrides,
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('journey-goal-adapter: generated_guide canonical source', () => {
  describe('LiveCreationGuideAuthor & defaultCreationGuideAuthor', () => {
    it('initializes with mock author and delegates calls', async () => {
      const mockAuthor = createMockAuthor();
      const liveAuthor = new LiveCreationGuideAuthor({ author: mockAuthor });

      expect(liveAuthor.identity).toEqual(mockIdentity);

      const signal = new AbortController().signal;
      const result = await liveAuthor.author(
        {
          id: randomUUID(),
          rawQuery: 'Learn distributed systems',
          revision: 0,
          topic: { value: 'Distributed systems', origin: 'user', acceptedRevision: 0 },
          outcomes: { value: ['Understand consensus'], origin: 'user', acceptedRevision: 0 },
          level: { value: 'Intermediate', origin: 'user', acceptedRevision: 0 },
          language: null,
          searchTerms: [],
          uncertainties: [],
        },
        signal
      );

      expect(result).toEqual(sampleProposal);
      expect(mockAuthor.author).toHaveBeenCalledOnce();
    });

    it('exposes defaultCreationGuideAuthor helper', () => {
      const helper = defaultCreationGuideAuthor();
      expect(helper).toBeInstanceOf(LiveCreationGuideAuthor);
      expect(typeof defaultCreationGuideAuthor.author).toBe('function');
    });
  });

  describe('acquireGeneratedGuide', () => {
    it('acquires guide with mock CreationGuideAuthor and returns valid artifact and serialized bytes', async () => {
      const mockAuthor = createMockAuthor();
      const input = {
        kind: 'generated_guide' as const,
        goal: 'Master Distributed Consensus and Raft',
        audience: 'Backend Engineers',
        dailyMinutes: 30,
        intentVersion: 2,
      };

      const { bytes, artifact } = await acquireGeneratedGuide(input, mockAuthor);

      // 1. Artifact conforms to schema
      expect(generatedGuideArtifactSchema.parse(artifact)).toEqual(artifact);

      // 2. Serialized bytes roundtrip to the exact artifact
      const parsedFromBytes = JSON.parse(new TextDecoder('utf-8').decode(bytes));
      expect(parsedFromBytes).toEqual(artifact);

      // 3. Retains AI origin and does NOT claim external source verification
      expect(artifact.contentOrigin).toBe('ai');
      expect(artifact.extractionKind).toBe('generated_guide');
      expect(artifact.coverage.scope).toBe('ai_authored_guide');
      expect(artifact.coverage.exhaustive).toBe(false);

      // 4. Retains limitations including GENERATED_GUIDE_LIMITATION
      expect(artifact.coverage.limitations).toContain(GENERATED_GUIDE_LIMITATION);
      expect(artifact.coverage.limitations).toContain(sampleProposal.limitations[0]);

      // 5. Text equals rendered proposal
      expect(artifact.text).toBe(renderGeneratedGuide(sampleProposal));
      expect(artifact.utf8ByteLength).toBe(Buffer.byteLength(artifact.text, 'utf8'));

      // 6. Author was called with converted LearningIntent
      expect(mockAuthor.author).toHaveBeenCalledOnce();
      const callArgs = (mockAuthor.author as any).mock.calls[0];
      const intentPassed = callArgs[0];
      expect(intentPassed.topic.value).toBe(input.goal);
      expect(intentPassed.level.value).toBe(input.audience);
      expect(intentPassed.outcomes.value[0]).toBe(`Complete learning in ${input.dailyMinutes} minutes/day`);
    });

    it('falls back to "General" when audience is not provided', async () => {
      const mockAuthor = createMockAuthor();
      const input = {
        kind: 'generated_guide' as const,
        goal: 'Learn Docker Containers',
        audience: '',
        dailyMinutes: 15,
        intentVersion: 0,
      };

      await acquireGeneratedGuide(input, mockAuthor);

      const callArgs = (mockAuthor.author as any).mock.calls[0];
      expect(callArgs[0].level.value).toBe('General');
    });

    it('throws GENERATED_GUIDE_CANCELED if callerSignal is already aborted', async () => {
      const mockAuthor = createMockAuthor();
      const input = {
        kind: 'generated_guide' as const,
        goal: 'Learn Docker Containers',
        audience: '',
        dailyMinutes: 15,
        intentVersion: 0,
      };

      const controller = new AbortController();
      controller.abort();

      await expect(acquireGeneratedGuide(input, mockAuthor, controller.signal)).rejects.toThrow('GENERATED_GUIDE_CANCELED');
      expect(mockAuthor.author).not.toHaveBeenCalled();
    });

    it('throws GENERATED_GUIDE_CANCELED if callerSignal aborts during authoring', async () => {
      const controller = new AbortController();
      const mockAuthor = createMockAuthor({
        author: vi.fn().mockImplementation(async (_intent, signal) => {
          return new Promise((_resolve, reject) => {
            signal.addEventListener('abort', () => reject(new Error('ABORTED')), { once: true });
          });
        }),
      });

      const input = {
        kind: 'generated_guide' as const,
        goal: 'Learn Kubernetes Architecture',
        audience: 'DevOps',
        dailyMinutes: 20,
        intentVersion: 0,
      };

      const promise = acquireGeneratedGuide(input, mockAuthor, controller.signal);
      controller.abort();

      await expect(promise).rejects.toThrow('GENERATED_GUIDE_CANCELED');
    });

    it('rethrows standard uppercase error codes from author failure', async () => {
      const mockAuthor = createMockAuthor({
        author: vi.fn().mockRejectedValue(new Error('AI_INVALID_OUTPUT')),
      });

      const input = {
        kind: 'generated_guide' as const,
        goal: 'Learn Rust Concurrency',
        audience: 'Engineers',
        dailyMinutes: 20,
        intentVersion: 0,
      };

      await expect(acquireGeneratedGuide(input, mockAuthor)).rejects.toThrow('AI_INVALID_OUTPUT');
    });
  });

  describe('extractGeneratedGuide', () => {
    it('parses retained bytes and produces valid SourceExtraction conforming to sourceExtractionSchema', async () => {
      const mockAuthor = createMockAuthor();
      const input = {
        kind: 'generated_guide' as const,
        goal: 'Master Distributed Consensus and Raft',
        audience: 'Backend Engineers',
        dailyMinutes: 30,
        intentVersion: 1,
      };

      const { bytes, artifact } = await acquireGeneratedGuide(input, mockAuthor);
      const extraction = extractGeneratedGuide(bytes, input);

      // Validate against canonical sourceExtractionSchema
      expect(sourceExtractionSchema.parse(extraction)).toEqual(extraction);

      // Verify SourceExtraction fields
      expect(extraction.format).toBe('cohort-extraction-v1');
      expect(extraction.text).toBe(artifact.text);
      expect(extraction.provenance.parserVersion).toBe(GENERATED_GUIDE_VERSION);
      expect(extraction.provenance.scope).toBe('ai_authored_guide');
      expect(extraction.provenance.contentOrigin).toBe('ai');
      expect(extraction.provenance.model).toEqual(mockIdentity);
      expect(extraction.provenance.limitations).toEqual(artifact.coverage.limitations);
      expect(extraction.provenance.rawChecksum).toBe(createHash('sha256').update(bytes).digest('hex'));

      // Locations correctly map segment anchors
      expect(extraction.locations.length).toBe(artifact.segments.length);
      expect(extraction.locations[0].start).toBe(0);
      expect(extraction.locations[extraction.locations.length - 1].end).toBe(artifact.text.length);

      for (let i = 0; i < extraction.locations.length; i++) {
        const loc = extraction.locations[i];
        const seg = artifact.segments[i];
        expect(loc.start).toBe((seg.location.anchor as any).start);
        expect(loc.end).toBe((seg.location.anchor as any).end);
        expect(loc.segmentId).toBe(seg.id);
      }
    });

    it('rejects empty bytes with GENERATED_GUIDE_SIZE_LIMIT', () => {
      const input = {
        kind: 'generated_guide' as const,
        goal: 'Test',
        audience: 'Test',
        dailyMinutes: 10,
        intentVersion: 0,
      };

      expect(() => extractGeneratedGuide(new Uint8Array(0), input)).toThrow('GENERATED_GUIDE_SIZE_LIMIT');
    });

    it('rejects invalid JSON with GENERATED_GUIDE_MALFORMED', () => {
      const input = {
        kind: 'generated_guide' as const,
        goal: 'Test',
        audience: 'Test',
        dailyMinutes: 10,
        intentVersion: 0,
      };

      expect(() => extractGeneratedGuide(Buffer.from('not-valid-json', 'utf8'), input)).toThrow('GENERATED_GUIDE_MALFORMED');
    });

    it('rejects JSON failing generatedGuideArtifactSchema with GENERATED_GUIDE_MALFORMED', () => {
      const input = {
        kind: 'generated_guide' as const,
        goal: 'Test',
        audience: 'Test',
        dailyMinutes: 10,
        intentVersion: 0,
      };

      const invalidArtifact = {
        format: 'wrong-format',
        text: 'hello',
      };

      expect(() => extractGeneratedGuide(Buffer.from(JSON.stringify(invalidArtifact), 'utf8'), input)).toThrow('GENERATED_GUIDE_MALFORMED');
    });
  });

  describe('readOwnedGeneratedGuide', () => {
    it('verifies ownership and integrity of retained generated guide artifact', async () => {
      const mockAuthor = createMockAuthor();
      const input = {
        kind: 'generated_guide' as const,
        goal: 'Learn Paxos',
        audience: 'Engineers',
        dailyMinutes: 20,
        intentVersion: 0,
      };

      const { bytes } = await acquireGeneratedGuide(input, mockAuthor);
      const checksum = createHash('sha256').update(bytes).digest('hex');
      const identity = {
        workspaceId: 'ws-guide-1',
        artifactId: 'art-guide-1',
        sourceId: 'src-guide-1',
        sourceVersion: 0,
        inputFingerprint: 'fp-guide-1',
      };

      const row = {
        id: identity.artifactId,
        workspaceId: identity.workspaceId,
        sourceId: identity.sourceId,
        sourceVersion: identity.sourceVersion,
        kind: 'source_raw',
        inputFingerprint: identity.inputFingerprint,
        checksum,
        byteLength: bytes.byteLength,
        body: bytes,
      };

      const sql = {
        query: async (_statement: string, parameters: unknown[]) => ({
          rows: parameters[0] === identity.workspaceId ? [row] : [],
        }),
      };

      const extracted = await readOwnedGeneratedGuide(sql as any, identity, input);
      expect(extracted.provenance.scope).toBe('ai_authored_guide');
      expect(extracted.text).toContain('Distributed Consensus');

      // Foreign workspace fails
      await expect(
        readOwnedGeneratedGuide(sql as any, { ...identity, workspaceId: 'foreign-ws' }, input)
      ).rejects.toThrow('ARTIFACT_NOT_FOUND');

      // Stale sourceVersion fails
      await expect(
        readOwnedGeneratedGuide(sql as any, { ...identity, sourceVersion: 1 }, input)
      ).rejects.toThrow('FOREIGN_GENERATED_GUIDE_ARTIFACT');
    });
  });

  describe('source-adapters: extractRetainedSource integration', () => {
    it('extracts retained generated_guide source via extractRetainedSource', async () => {
      const mockAuthor = createMockAuthor();
      const input = {
        kind: 'generated_guide' as const,
        goal: 'Master Raft',
        audience: 'Staff Engineers',
        dailyMinutes: 25,
        intentVersion: 0,
      };

      const { bytes } = await acquireGeneratedGuide(input, mockAuthor);
      const checksum = createHash('sha256').update(bytes).digest('hex');

      const source = {
        id: 'guide-source',
        version: 0,
        label: 'Generated learning guide',
        text: '',
        checksum: null,
        state: 'queued' as const,
        input,
      };

      const ref = {
        id: 'art-123',
        workspaceId: 'ws-123',
        kind: 'source_raw' as const,
        checksum,
        byteLength: bytes.byteLength,
        sourceId: source.id,
        sourceVersion: source.version,
        inputFingerprint: 'fp-123',
      };

      const extracted = await extractRetainedSource(source, ref, bytes);
      expect(extracted.format).toBe('cohort-extraction-v1');
      expect(extracted.provenance.scope).toBe('ai_authored_guide');
      expect(extracted.provenance.model?.provider).toBe('google');
      expect(extracted.text).toContain('Replication and Safety');
    });

    it('maps unreadable generated_guide errors to GENERATED_GUIDE_UNREADABLE', async () => {
      const input = {
        kind: 'generated_guide' as const,
        goal: 'Master Raft',
        audience: 'Staff Engineers',
        dailyMinutes: 25,
        intentVersion: 0,
      };

      const badBytes = Buffer.from('invalid-json', 'utf8');
      const checksum = createHash('sha256').update(badBytes).digest('hex');

      const source = {
        id: 'guide-source',
        version: 0,
        label: 'Generated learning guide',
        text: '',
        checksum: null,
        state: 'queued' as const,
        input,
      };

      const ref = {
        id: 'art-123',
        workspaceId: 'ws-123',
        kind: 'source_raw' as const,
        checksum,
        byteLength: badBytes.byteLength,
        sourceId: source.id,
        sourceVersion: source.version,
        inputFingerprint: 'fp-123',
      };

      await expect(extractRetainedSource(source, ref, badBytes)).rejects.toThrow('GENERATED_GUIDE_MALFORMED');
    });
  });

  describe('text-source-processor: source DAG execution on generated_guide', () => {
    async function setupDb() {
      const db = new PGlite();
      await db.exec(`
        CREATE TABLE "interaction_workspaces" (
          "id" TEXT PRIMARY KEY,
          "ownerId" TEXT NOT NULL DEFAULT 'user-guide-owner'
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
      await db.exec(s3Migration);
      await db.exec(s4bMigration);
      await db.exec(journeyMigration);
      await db.exec(`INSERT INTO "interaction_workspaces" ("id", "ownerId") VALUES ('workspace-guide', 'user-guide-owner')`);

      const sql: TextArtifactSql = {
        query: async (statement, parameters) => db.query<Record<string, unknown>>(statement, parameters),
      };
      const port: TextJobTransactionPort = {
        transaction: work =>
          db.transaction(tx =>
            work({
              query: async (statement, parameters) => tx.query<Record<string, unknown>>(statement, parameters),
            })
          ),
      };

      return { db, sql, port };
    }

    it('runs acquisition, extraction, understanding, chunking, analysis, and assembly for generated_guide', async () => {
      const { db, sql, port } = await setupDb();
      try {
        const workspaceId = 'workspace-guide';
        const mockAuthor = createMockAuthor();

        let state: CohortWorkspace = cohortWorkspaceSchema.parse({
          schemaVersion: 1,
          title: 'Distributed Systems',
          intent: 'Learn distributed consensus and replication',
          audience: 'Backend Engineers',
          dailyMinutes: 25,
          lessons: [],
          sources: [
            {
              id: 'generated-guide:0',
              version: 0,
              label: 'Generated learning guide',
              text: '',
              checksum: null,
              state: 'queued',
              input: {
                kind: 'generated_guide',
                goal: 'Learn distributed consensus and replication',
                audience: 'Backend Engineers',
                dailyMinutes: 25,
                intentVersion: 0,
              },
            },
          ],
          chunks: [],
          understanding: [],
          analyses: [],
          processing: {
            status: 'queued',
            stage: 'acquisition',
            generation: 0,
            sourceFingerprint: null,
            error: null,
          },
          journey: {
            version: 1,
            step: 'processing',
            branch: 'have_goal',
            processingStarted: true,
            intentVersion: 0,
          },
        });

        // 1. Enqueue job plan in the database
        const planned = await enqueueTextJobPlan(port, workspaceId, state);
        expect(planned.inserted).toBe(6); // acquisition, extraction, understanding, chunking, analysis, assembly

        const processor = createTextSourceProcessor({
          sql,
          loadWorkspace: async () => state,
          guideAuthor: mockAuthor,
        });

        // 2. Stage 1: Acquisition
        const acquisitionJob = (await claimTextJob(sql, 'worker-1', now, 60_000))!;
        expect(acquisitionJob).not.toBeNull();
        expect(acquisitionJob.stage).toBe('acquisition');
        expect(acquisitionJob.sourceId).toBe('generated-guide:0');

        const rawBytes = await processor(acquisitionJob);
        expect(rawBytes.length).toBeGreaterThan(0);

        // Store raw artifact
        const rawArtifact = await putTextArtifact(sql, {
          workspaceId,
          sourceId: acquisitionJob.sourceId!,
          sourceVersion: acquisitionJob.sourceVersion!,
          kind: 'source_raw',
          inputFingerprint: acquisitionJob.dependencyFingerprint,
          bytes: rawBytes,
        });

        // Accept acquisition job
        expect(await acceptTextJob(sql, acquisitionJob, rawArtifact, now)).toBe(true);

        // Update state with retainedInputId
        state = structuredClone(state);
        state.sources[0].retainedInputId = rawArtifact.id;

        // 3. Stage 2: Extraction
        const extractionJob = (await claimTextJob(sql, 'worker-1', now, 60_000))!;
        expect(extractionJob).not.toBeNull();
        expect(extractionJob.stage).toBe('extraction');
        expect(extractionJob.sourceId).toBe('generated-guide:0');

        const extractionBytes = await processor(extractionJob);
        const extraction = sourceExtractionSchema.parse(JSON.parse(Buffer.from(extractionBytes).toString('utf8')));
        expect(extraction.format).toBe('cohort-extraction-v1');
        expect(extraction.provenance.scope).toBe('ai_authored_guide');
        expect(extraction.text).toContain('Replication and Safety');

        // Store extraction artifact
        const extractionArtifact = await putTextArtifact(sql, {
          workspaceId,
          sourceId: extractionJob.sourceId!,
          sourceVersion: extractionJob.sourceVersion!,
          kind: 'extraction',
          inputFingerprint: extractionJob.dependencyFingerprint,
          bytes: extractionBytes,
        });

        // Accept extraction job
        expect(await acceptTextJob(sql, extractionJob, extractionArtifact, now)).toBe(true);

        // Update state with extraction results
        state = structuredClone(state);
        state.sources[0].text = extraction.text;
        state.sources[0].locations = extraction.locations;
        state.sources[0].provenance = extraction.provenance;
        state.sources[0].extractionId = extractionArtifact.id;
        state.sources[0].checksum = extraction.provenance.rawChecksum;
        state.sources[0].state = 'ready';

        // 4. Stage 3: Understanding
        const understandingJob = (await claimTextJob(sql, 'worker-1', now, 60_000))!;
        expect(understandingJob).not.toBeNull();
        expect(understandingJob.stage).toBe('understanding');

        const understandingBytes = await processor(understandingJob);
        const understandingResult = cohortWorkspaceSchema.shape.understanding.parse(
          JSON.parse(Buffer.from(understandingBytes).toString('utf8'))
        );
        expect(understandingResult.length).toBeGreaterThan(0);
        expect(understandingResult[0].topics.length).toBeGreaterThan(0);

        const understandingArtifact = await putTextArtifact(sql, {
          workspaceId,
          sourceId: understandingJob.sourceId!,
          sourceVersion: understandingJob.sourceVersion!,
          kind: 'understanding',
          inputFingerprint: understandingJob.dependencyFingerprint,
          bytes: understandingBytes,
        });
        expect(await acceptTextJob(sql, understandingJob, understandingArtifact, now)).toBe(true);

        state = structuredClone(state);
        state.understanding = understandingResult;

        // 5. Stage 4: Chunking
        const chunkingJob = (await claimTextJob(sql, 'worker-1', now, 60_000))!;
        expect(chunkingJob).not.toBeNull();
        expect(chunkingJob.stage).toBe('chunking');

        const chunkingBytes = await processor(chunkingJob);
        const chunks = cohortWorkspaceSchema.shape.chunks.parse(
          JSON.parse(Buffer.from(chunkingBytes).toString('utf8'))
        );
        expect(chunks.length).toBeGreaterThan(0);
        expect(chunks[0].sourceId).toBe('generated-guide:0');

        const chunkingArtifact = await putTextArtifact(sql, {
          workspaceId,
          sourceId: chunkingJob.sourceId!,
          sourceVersion: chunkingJob.sourceVersion!,
          kind: 'chunks',
          inputFingerprint: chunkingJob.dependencyFingerprint,
          bytes: chunkingBytes,
        });
        expect(await acceptTextJob(sql, chunkingJob, chunkingArtifact, now)).toBe(true);

        state = structuredClone(state);
        state.chunks = chunks;

        // 6. Stage 5: Analysis
        const analysisJob = (await claimTextJob(sql, 'worker-1', now, 60_000))!;
        expect(analysisJob).not.toBeNull();
        expect(analysisJob.stage).toBe('analysis');

        const analysisBytes = await processor(analysisJob);
        const analyses = cohortWorkspaceSchema.shape.analyses.parse(
          JSON.parse(Buffer.from(analysisBytes).toString('utf8'))
        );
        expect(analyses.length).toBeGreaterThan(0);

        const analysisArtifact = await putTextArtifact(sql, {
          workspaceId,
          sourceId: analysisJob.sourceId!,
          sourceVersion: analysisJob.sourceVersion!,
          kind: 'analysis',
          inputFingerprint: analysisJob.dependencyFingerprint,
          bytes: analysisBytes,
        });
        expect(await acceptTextJob(sql, analysisJob, analysisArtifact, now)).toBe(true);

        state = structuredClone(state);
        state.analyses = analyses;

        // 7. Verify Assembly Stage
        state.processing.stage = 'assembly';
        const assemblyResult = computeTextStage(state);
        expect(assemblyResult.stage).toBe('assembly');

        const assembledLessons = cohortWorkspaceSchema.shape.lessons.parse(assemblyResult.result);
        expect(assembledLessons.length).toBeGreaterThan(0);
        // Verify lessons contain sourceChunkIds pointing to chunks extracted from the guide
        expect(assembledLessons[0].sourceChunkIds.length).toBeGreaterThan(0);
        expect(chunks.some(c => assembledLessons[0].sourceChunkIds.includes(c.id))).toBe(true);
      } finally {
        await db.close();
      }
    }, 30_000);
  });
});
