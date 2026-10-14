import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));

import type { CohortWorkspace } from '@/src/shared/cohort-builder/contracts';
import {
  validateCohortReadiness,
  deriveCandidateSnapshotHash,
  deriveReleaseEffectKey,
  freezeCohortCandidate,
  createReleaseReceipt,
  executeIdempotentRelease,
  MemoryReleaseEffectStore,
  CohortReadinessError,
} from '../release';

function createSampleWorkspace(overrides?: Partial<CohortWorkspace>): CohortWorkspace {
  return {
    schemaVersion: 1,
    title: 'Rust Concurrency Mastery',
    intent: 'Learn safe multithreading, Arc, Mutex, and async channels in Rust',
    audience: 'Intermediate systems and backend engineers',
    dailyMinutes: 25,
    lessons: [
      {
        id: 'lesson-1',
        version: 1,
        title: 'Threads and Move Closures',
        objective: 'Spawn threads and safely transfer ownership using move closures',
        sourceChunkIds: ['chunk-1'],
        pinned: true,
        evidenceStatus: 'valid',
      },
      {
        id: 'lesson-2',
        version: 1,
        title: 'Channels and Message Passing',
        objective: 'Use mpsc channels for cross-thread communication without shared state',
        sourceChunkIds: ['chunk-2'],
        pinned: false,
        evidenceStatus: 'valid',
      },
    ],
    sources: [
      {
        id: 'source-1',
        version: 0,
        label: 'Rust Book Chapter 16',
        text: 'Fearless concurrency in Rust guarantees memory safety at compile time.',
        checksum: 'a'.repeat(64),
        state: 'ready',
      },
    ],
    chunks: [
      {
        id: 'chunk-1',
        sourceId: 'source-1',
        sourceVersion: 0,
        start: 0,
        end: 40,
        text: 'Fearless concurrency in Rust guarantees memory safety at compile time.',
        checksum: 'b'.repeat(64),
      },
      {
        id: 'chunk-2',
        sourceId: 'source-1',
        sourceVersion: 0,
        start: 0,
        end: 40,
        text: 'Fearless concurrency in Rust guarantees memory safety at compile time.',
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

describe('S5 Release Service (release.ts)', () => {
  describe('validateCohortReadiness', () => {
    it('approves a fully valid and processed workspace', () => {
      const ws = createSampleWorkspace();
      const report = validateCohortReadiness(ws, 'public_publish');

      expect(report.ready).toBe(true);
      expect(report.blockers).toEqual([]);
      expect(report.checks.intentValid).toBe(true);
      expect(report.checks.lessonsValid).toBe(true);
      expect(report.checks.sourcesReady).toBe(true);
      expect(report.checks.evidenceValid).toBe(true);
      expect(report.checks.processingComplete).toBe(true);
      expect(report.checks.rightsValid).toBe(true);
    });

    it('blocks release if intent or title is missing', () => {
      const ws = createSampleWorkspace({ title: '', intent: '   ' });
      const report = validateCohortReadiness(ws, 'private_activation');

      expect(report.ready).toBe(false);
      expect(report.blockers).toContain('Workspace intent is missing or empty.');
      expect(report.blockers).toContain('Workspace title is missing or empty.');
    });

    it('blocks release if curriculum has zero lessons or invalid objectives', () => {
      const ws = createSampleWorkspace({
        lessons: [
          {
            id: 'l-bad',
            version: 1,
            title: '',
            objective: '   ',
            sourceChunkIds: [],
            pinned: false,
          },
        ],
      });
      const report = validateCohortReadiness(ws, 'private_activation');

      expect(report.ready).toBe(false);
      expect(report.blockers[0]).toContain('missing titles or objectives');
    });

    it('blocks release if background processing is failed or active', () => {
      const wsFailed = createSampleWorkspace({
        processing: {
          status: 'failed',
          stage: 'analysis',
          generation: 1,
          sourceFingerprint: null,
          error: 'Connection timeout during analysis',
        },
      });
      const reportFailed = validateCohortReadiness(wsFailed, 'private_activation');
      expect(reportFailed.ready).toBe(false);
      expect(reportFailed.blockers[0]).toContain('Background source processing has failed');

      const wsActive = createSampleWorkspace({
        processing: {
          status: 'processing',
          stage: 'chunking',
          generation: 1,
          sourceFingerprint: null,
          error: null,
        },
      });
      const reportActive = validateCohortReadiness(wsActive, 'private_activation');
      expect(reportActive.ready).toBe(false);
      expect(reportActive.blockers[0]).toContain('Source processing jobs are currently active');
    });

    it('blocks release if sources are not ready', () => {
      const ws = createSampleWorkspace({
        sources: [
          {
            id: 'source-1',
            version: 0,
            label: 'Pending doc',
            text: 'Content',
            checksum: 'a'.repeat(64),
            state: 'queued',
          },
        ],
      });
      const report = validateCohortReadiness(ws, 'private_activation');
      expect(report.ready).toBe(false);
      expect(report.blockers[0]).toContain("not in 'ready' state");
    });

    it('blocks public release with orphaned evidence, but allows private with warning', () => {
      const ws = createSampleWorkspace({
        lessons: [
          {
            id: 'lesson-1',
            version: 1,
            title: 'Valid lesson',
            objective: 'Valid objective',
            sourceChunkIds: ['chunk-1'],
            pinned: false,
            evidenceStatus: 'valid',
          },
          {
            id: 'lesson-2',
            version: 1,
            title: 'Orphaned lesson',
            objective: 'Orphaned objective',
            sourceChunkIds: ['chunk-2'],
            pinned: false,
            evidenceStatus: 'orphaned',
          },
        ],
      });

      const publicReport = validateCohortReadiness(ws, 'public_publish');
      expect(publicReport.ready).toBe(false);
      expect(publicReport.blockers[0]).toContain('Resolve or replace orphaned lessons before public release');

      const privateReport = validateCohortReadiness(ws, 'private_activation');
      expect(privateReport.ready).toBe(true);
      expect(privateReport.warnings[0]).toContain('orphaned evidence');
    });
  });

  describe('deriveCandidateSnapshotHash and freezeCohortCandidate', () => {
    it('produces a deterministic hash across identical workspaces', () => {
      const ws1 = createSampleWorkspace();
      const ws2 = createSampleWorkspace();

      const hash1 = deriveCandidateSnapshotHash(ws1, {
        workspaceId: 'ws-hash-1',
        workspaceRevision: 3,
        mode: 'public_publish',
      });
      const hash2 = deriveCandidateSnapshotHash(ws2, {
        workspaceId: 'ws-hash-1',
        workspaceRevision: 3,
        mode: 'public_publish',
      });

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/);

      // Mutating any lesson objective alters the hash
      const mutatedWs = createSampleWorkspace({
        lessons: [
          { ...ws1.lessons[0], objective: 'Modified objective for hash test' },
          ws1.lessons[1],
        ],
      });
      const mutatedHash = deriveCandidateSnapshotHash(mutatedWs, {
        workspaceId: 'ws-hash-1',
        workspaceRevision: 3,
        mode: 'public_publish',
      });

      expect(mutatedHash).not.toBe(hash1);
    });

    it('freezes a valid candidate and creates an immutable delivery DTO', () => {
      const ws = createSampleWorkspace();
      const frozen = freezeCohortCandidate(ws, {
        workspaceId: 'ws-freeze-1',
        workspaceRevision: 2,
        mode: 'private_activation',
      });

      expect(frozen.snapshotHash).toMatch(/^[a-f0-9]{64}$/);
      expect(frozen.cohortId).toBeDefined();
      expect(frozen.mode).toBe('private_activation');
      expect(frozen.delivery.cohort.visibility).toBe('PRIVATE');
      expect(frozen.readiness.ready).toBe(true);
    });

    it('throws CohortReadinessError when trying to freeze an unready workspace', () => {
      const unreadyWs = createSampleWorkspace({ title: '' });
      expect(() =>
        freezeCohortCandidate(unreadyWs, {
          workspaceId: 'ws-fail',
          workspaceRevision: 1,
          mode: 'public_publish',
        })
      ).toThrow(CohortReadinessError);
    });
  });

  describe('Effect Key, Receipts and Idempotent Release', () => {
    it('generates a deterministic release effect key', () => {
      const key1 = deriveReleaseEffectKey('ws-1', 'public_publish');
      const key2 = deriveReleaseEffectKey('ws-1', 'public_publish');
      expect(key1).toBe(key2);
      expect(key1).toMatch(/^[a-f0-9]{64}$/);

      const keyPrivate = deriveReleaseEffectKey('ws-1', 'private_activation');
      expect(keyPrivate).not.toBe(key1);
    });

    it('creates release receipt pointing to proper destination URL', () => {
      const privReceipt = createReleaseReceipt({
        effectKey: 'e'.repeat(64),
        cohortId: 'cohort-123',
        workspaceId: 'ws-1',
        contentHash: 'c'.repeat(64),
        mode: 'private_activation',
      });
      expect(privReceipt.destinationUrl).toBe('/play?cohort=cohort-123');

      const pubReceipt = createReleaseReceipt({
        effectKey: 'e'.repeat(64),
        cohortId: 'cohort-123',
        workspaceId: 'ws-1',
        contentHash: 'c'.repeat(64),
        mode: 'public_publish',
      });
      expect(pubReceipt.destinationUrl).toBe('/cohort/cohort-123');
    });

    it('executes idempotent release safely with receipt recovery', async () => {
      const store = new MemoryReleaseEffectStore();
      const ws = createSampleWorkspace();
      const frozen = freezeCohortCandidate(ws, {
        workspaceId: 'ws-idempotent-1',
        workspaceRevision: 1,
        mode: 'public_publish',
      });

      let materializerCalls = 0;
      const materializer = async () => {
        materializerCalls += 1;
      };

      // 1. First execution
      const receipt1 = await executeIdempotentRelease(store, frozen, materializer);
      expect(receipt1.cohortId).toBe(frozen.cohortId);
      expect(receipt1.destinationUrl).toBe(`/cohort/${frozen.cohortId}`);
      expect(materializerCalls).toBe(1);

      // 2. Second execution (replay / retry): should return cached receipt without calling materializer again
      const receipt2 = await executeIdempotentRelease(store, frozen, materializer);
      expect(receipt2).toEqual(receipt1);
      expect(materializerCalls).toBe(1);

      // 3. Effect key conflict: same effectKey registered, but different contentHash throws
      const conflictingFrozen = {
        ...frozen,
        snapshotHash: '9'.repeat(64),
      };
      await expect(
        executeIdempotentRelease(store, conflictingFrozen, materializer)
      ).rejects.toThrow('EFFECT_HASH_MISMATCH');
    });
  });
});
