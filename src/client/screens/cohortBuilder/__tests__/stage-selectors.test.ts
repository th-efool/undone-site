// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  type BuilderStage,
  getActiveStage,
  getEffectiveStage,
  getUnderstandingData,
  getChunkingData,
  getAnalysisData,
  getAssemblyData,
  isStageComplete,
  getStageProgressDetails,
  getValidChunks,
  getValidAnalyses,
} from '../stage-selectors';
import type { CohortWorkspace } from '@/src/shared/cohort-builder/contracts';

const fake = vi.hoisted(() => ({ state: null as any, actions: [] as unknown[] }));
vi.mock('next-auth/react', () => ({ useSession: () => ({ data: { user: { id: 'owner' } } }) }));
vi.mock('@/src/client/interaction/hooks', () => ({
  useInteractionState: () => ({ workspaceId: 'workspace', revision: 0, view: fake.state }),
  useWorkspaceView: () => fake.state,
  useDispatchAction: () => async (action: unknown) => { fake.actions.push(action); return true; },
}));

import { CohortWorkspacePane } from '../CohortWorkspacePane';

afterEach(() => {
  cleanup();
  fake.actions = [];
});

function createMinimalWorkspace(overrides: Partial<CohortWorkspace> = {}): CohortWorkspace {
  return {
    schemaVersion: 1,
    title: 'Test Cohort',
    intent: 'Learn Distributed Systems',
    audience: 'Backend Engineers',
    dailyMinutes: 20,
    lessons: [],
    sources: [],
    chunks: [],
    understanding: [],
    analyses: [],
    processing: {
      status: 'idle',
      stage: 'done',
      generation: 1,
      sourceFingerprint: null,
      error: null,
    },
    ...overrides,
  };
}

describe('stage-selectors', () => {
  describe('getActiveStage', () => {
    it('returns "intake" when sources array is empty and lessons is empty', () => {
      const workspace = createMinimalWorkspace({ sources: [], lessons: [] });
      expect(getActiveStage(workspace)).toBe('intake');
    });

    it('returns "curriculum" when sources array is empty but lessons already exist', () => {
      const workspace = createMinimalWorkspace({
        sources: [],
        lessons: [{ id: 'l1', version: 0, title: 'L1', objective: 'Obj1', sourceChunkIds: [], pinned: false }],
      });
      expect(getActiveStage(workspace)).toBe('curriculum');
    });

    it('returns "curriculum" when processing status is "ready" and no release or release is draft', () => {
      const workspace = createMinimalWorkspace({
        sources: [{ id: 's1', version: 0, label: 'Source 1', text: 'Some text', checksum: null, state: 'ready' }],
        processing: { status: 'ready', stage: 'done', generation: 1, sourceFingerprint: 'fp', error: null },
      });
      expect(getActiveStage(workspace)).toBe('curriculum');

      const workspaceDraftRelease = createMinimalWorkspace({
        sources: [{ id: 's1', version: 0, label: 'Source 1', text: 'Some text', checksum: null, state: 'ready' }],
        processing: { status: 'ready', stage: 'done', generation: 1, sourceFingerprint: 'fp', error: null },
        release: { status: 'draft' },
      });
      expect(getActiveStage(workspaceDraftRelease)).toBe('curriculum');
    });

    it('returns "review" when processing status is "ready" and release status is prepared or released', () => {
      const workspacePrepared = createMinimalWorkspace({
        sources: [{ id: 's1', version: 0, label: 'Source 1', text: 'Some text', checksum: null, state: 'ready' }],
        processing: { status: 'ready', stage: 'done', generation: 1, sourceFingerprint: 'fp', error: null },
        release: { status: 'prepared', candidateHash: 'a'.repeat(64) },
      });
      expect(getActiveStage(workspacePrepared)).toBe('review');

      const workspaceReleased = createMinimalWorkspace({
        sources: [{ id: 's1', version: 0, label: 'Source 1', text: 'Some text', checksum: null, state: 'ready' }],
        processing: { status: 'ready', stage: 'done', generation: 1, sourceFingerprint: 'fp', error: null },
        release: { status: 'released' },
      });
      expect(getActiveStage(workspaceReleased)).toBe('review');
    });

    describe('processing with jobs array', () => {
      it('derives "understanding" when active job is in acquisition, extraction, or understanding', () => {
        const workspaceAcquisition = createMinimalWorkspace({
          sources: [{ id: 's1', version: 0, label: 'S1', text: 'txt', checksum: null, state: 'processing' }],
          processing: {
            status: 'processing',
            stage: 'acquisition',
            generation: 1,
            sourceFingerprint: null,
            error: null,
            jobs: [{ id: 'j1', sourceId: 's1', stage: 'acquisition', status: 'running', attempts: 1, error: null, retryable: true }],
          },
        });
        expect(getActiveStage(workspaceAcquisition)).toBe('understanding');

        const workspaceExtraction = createMinimalWorkspace({
          sources: [{ id: 's1', version: 0, label: 'S1', text: 'txt', checksum: null, state: 'processing' }],
          processing: {
            status: 'processing',
            stage: 'extraction',
            generation: 1,
            sourceFingerprint: null,
            error: null,
            jobs: [{ id: 'j1', sourceId: 's1', stage: 'extraction', status: 'running', attempts: 1, error: null, retryable: true }],
          },
        });
        expect(getActiveStage(workspaceExtraction)).toBe('understanding');

        const workspaceUnderstanding = createMinimalWorkspace({
          sources: [{ id: 's1', version: 0, label: 'S1', text: 'txt', checksum: null, state: 'queued' }],
          processing: {
            status: 'queued',
            stage: 'understanding',
            generation: 1,
            sourceFingerprint: null,
            error: null,
            jobs: [{ id: 'j1', sourceId: 's1', stage: 'understanding', status: 'queued', attempts: 0, error: null, retryable: true }],
          },
        });
        expect(getActiveStage(workspaceUnderstanding)).toBe('understanding');
      });

      it('derives "chunking", "analysis", and "assembly" when respective jobs are active', () => {
        const chunkingWorkspace = createMinimalWorkspace({
          sources: [{ id: 's1', version: 0, label: 'S1', text: 'txt', checksum: null, state: 'processing' }],
          processing: {
            status: 'processing',
            stage: 'chunking',
            generation: 1,
            sourceFingerprint: null,
            error: null,
            jobs: [
              { id: 'j1', sourceId: 's1', stage: 'understanding', status: 'accepted', attempts: 1, error: null, retryable: false },
              { id: 'j2', sourceId: 's1', stage: 'chunking', status: 'running', attempts: 1, error: null, retryable: true },
            ],
          },
        });
        expect(getActiveStage(chunkingWorkspace)).toBe('chunking');

        const analysisWorkspace = createMinimalWorkspace({
          sources: [{ id: 's1', version: 0, label: 'S1', text: 'txt', checksum: null, state: 'processing' }],
          processing: {
            status: 'processing',
            stage: 'analysis',
            generation: 1,
            sourceFingerprint: null,
            error: null,
            jobs: [
              { id: 'j1', sourceId: 's1', stage: 'understanding', status: 'accepted', attempts: 1, error: null, retryable: false },
              { id: 'j2', sourceId: 's1', stage: 'chunking', status: 'accepted', attempts: 1, error: null, retryable: false },
              { id: 'j3', sourceId: 's1', stage: 'analysis', status: 'running', attempts: 1, error: null, retryable: true },
            ],
          },
        });
        expect(getActiveStage(analysisWorkspace)).toBe('analysis');

        const assemblyWorkspace = createMinimalWorkspace({
          sources: [{ id: 's1', version: 0, label: 'S1', text: 'txt', checksum: null, state: 'processing' }],
          processing: {
            status: 'processing',
            stage: 'assembly',
            generation: 1,
            sourceFingerprint: null,
            error: null,
            jobs: [
              { id: 'j1', sourceId: 's1', stage: 'understanding', status: 'accepted', attempts: 1, error: null, retryable: false },
              { id: 'j2', sourceId: 's1', stage: 'chunking', status: 'accepted', attempts: 1, error: null, retryable: false },
              { id: 'j3', sourceId: 's1', stage: 'analysis', status: 'accepted', attempts: 1, error: null, retryable: false },
              { id: 'j4', sourceId: null, stage: 'assembly', status: 'running', attempts: 1, error: null, retryable: true },
            ],
          },
        });
        expect(getActiveStage(assemblyWorkspace)).toBe('assembly');
      });

      describe('mixed source speeds', () => {
        it('returns "understanding" when one source is at chunking but another is still in understanding', () => {
          const workspace = createMinimalWorkspace({
            sources: [
              { id: 's1', version: 0, label: 'Fast Source', text: 'txt', checksum: null, state: 'processing' },
              { id: 's2', version: 0, label: 'Slow Source', text: 'txt', checksum: null, state: 'processing' },
            ],
            processing: {
              status: 'processing',
              stage: 'chunking',
              generation: 1,
              sourceFingerprint: null,
              error: null,
              jobs: [
                { id: 'j1-s1', sourceId: 's1', stage: 'understanding', status: 'accepted', attempts: 1, error: null, retryable: false },
                { id: 'j2-s1', sourceId: 's1', stage: 'chunking', status: 'running', attempts: 1, error: null, retryable: true },
                { id: 'j1-s2', sourceId: 's2', stage: 'understanding', status: 'running', attempts: 1, error: null, retryable: true },
              ],
            },
          });
          expect(getActiveStage(workspace)).toBe('understanding');
        });

        it('returns "understanding" when one source is running chunking while another source has understanding queued', () => {
          const workspace = createMinimalWorkspace({
            sources: [
              { id: 's1', version: 0, label: 'Fast Source', text: 'txt', checksum: null, state: 'processing' },
              { id: 's2', version: 0, label: 'Slow Source', text: 'txt', checksum: null, state: 'queued' },
            ],
            processing: {
              status: 'processing',
              stage: 'chunking',
              generation: 1,
              sourceFingerprint: null,
              error: null,
              jobs: [
                { id: 'j1-s1', sourceId: 's1', stage: 'understanding', status: 'accepted', attempts: 1, error: null, retryable: false },
                { id: 'j2-s1', sourceId: 's1', stage: 'chunking', status: 'running', attempts: 1, error: null, retryable: true },
                { id: 'j1-s2', sourceId: 's2', stage: 'understanding', status: 'queued', attempts: 0, error: null, retryable: true },
              ],
            },
          });
          expect(getActiveStage(workspace)).toBe('understanding');
        });

        it('returns "chunking" when one source has reached analysis but another is still chunking', () => {
          const workspace = createMinimalWorkspace({
            sources: [
              { id: 's1', version: 0, label: 'Fast Source', text: 'txt', checksum: null, state: 'processing' },
              { id: 's2', version: 0, label: 'Slow Source', text: 'txt', checksum: null, state: 'processing' },
            ],
            processing: {
              status: 'processing',
              stage: 'analysis',
              generation: 1,
              sourceFingerprint: null,
              error: null,
              jobs: [
                { id: 'j1-s1', sourceId: 's1', stage: 'understanding', status: 'accepted', attempts: 1, error: null, retryable: false },
                { id: 'j2-s1', sourceId: 's1', stage: 'chunking', status: 'accepted', attempts: 1, error: null, retryable: false },
                { id: 'j3-s1', sourceId: 's1', stage: 'analysis', status: 'running', attempts: 1, error: null, retryable: true },
                { id: 'j1-s2', sourceId: 's2', stage: 'understanding', status: 'accepted', attempts: 1, error: null, retryable: false },
                { id: 'j2-s2', sourceId: 's2', stage: 'chunking', status: 'running', attempts: 1, error: null, retryable: true },
              ],
            },
          });
          expect(getActiveStage(workspace)).toBe('chunking');
        });

        it('returns "analysis" when all sources completed chunking and are in analysis', () => {
          const workspace = createMinimalWorkspace({
            sources: [
              { id: 's1', version: 0, label: 'Source 1', text: 'txt', checksum: null, state: 'processing' },
              { id: 's2', version: 0, label: 'Source 2', text: 'txt', checksum: null, state: 'queued' },
            ],
            processing: {
              status: 'processing',
              stage: 'analysis',
              generation: 1,
              sourceFingerprint: null,
              error: null,
              jobs: [
                { id: 'j1-s1', sourceId: 's1', stage: 'understanding', status: 'accepted', attempts: 1, error: null, retryable: false },
                { id: 'j2-s1', sourceId: 's1', stage: 'chunking', status: 'accepted', attempts: 1, error: null, retryable: false },
                { id: 'j3-s1', sourceId: 's1', stage: 'analysis', status: 'running', attempts: 1, error: null, retryable: true },
                { id: 'j1-s2', sourceId: 's2', stage: 'understanding', status: 'accepted', attempts: 1, error: null, retryable: false },
                { id: 'j2-s2', sourceId: 's2', stage: 'chunking', status: 'accepted', attempts: 1, error: null, retryable: false },
                { id: 'j3-s2', sourceId: 's2', stage: 'analysis', status: 'queued', attempts: 0, error: null, retryable: true },
              ],
            },
          });
          expect(getActiveStage(workspace)).toBe('analysis');
        });
      });

      describe('job failures', () => {
        it('returns "understanding" when a job fails in extraction or understanding', () => {
          const workspace = createMinimalWorkspace({
            sources: [{ id: 's1', version: 0, label: 'S1', text: 'txt', checksum: null, state: 'failed' }],
            processing: {
              status: 'failed',
              stage: 'extraction',
              generation: 1,
              sourceFingerprint: null,
              error: 'PDF_PARSE_ERROR',
              jobs: [{ id: 'j1', sourceId: 's1', stage: 'extraction', status: 'failed', attempts: 3, error: 'PDF_PARSE_ERROR', retryable: false }],
            },
          });
          expect(getActiveStage(workspace)).toBe('understanding');
        });

        it('returns "chunking" when a job fails in chunking', () => {
          const workspace = createMinimalWorkspace({
            sources: [{ id: 's1', version: 0, label: 'S1', text: 'txt', checksum: null, state: 'failed' }],
            processing: {
              status: 'failed',
              stage: 'chunking',
              generation: 1,
              sourceFingerprint: null,
              error: 'TOO_MANY_CHUNKS',
              jobs: [
                { id: 'j1', sourceId: 's1', stage: 'understanding', status: 'accepted', attempts: 1, error: null, retryable: false },
                { id: 'j2', sourceId: 's1', stage: 'chunking', status: 'failed', attempts: 1, error: 'TOO_MANY_CHUNKS', retryable: true },
              ],
            },
          });
          expect(getActiveStage(workspace)).toBe('chunking');
        });

        it('returns "analysis" when a job fails in analysis', () => {
          const workspace = createMinimalWorkspace({
            sources: [{ id: 's1', version: 0, label: 'S1', text: 'txt', checksum: null, state: 'failed' }],
            processing: {
              status: 'failed',
              stage: 'analysis',
              generation: 1,
              sourceFingerprint: null,
              error: 'MODEL_RATE_LIMIT',
              jobs: [
                { id: 'j1', sourceId: 's1', stage: 'understanding', status: 'accepted', attempts: 1, error: null, retryable: false },
                { id: 'j2', sourceId: 's1', stage: 'chunking', status: 'accepted', attempts: 1, error: null, retryable: false },
                { id: 'j3', sourceId: 's1', stage: 'analysis', status: 'failed', attempts: 2, error: 'MODEL_RATE_LIMIT', retryable: true },
              ],
            },
          });
          expect(getActiveStage(workspace)).toBe('analysis');
        });

        it('returns "assembly" when assembly job fails', () => {
          const workspace = createMinimalWorkspace({
            sources: [{ id: 's1', version: 0, label: 'S1', text: 'txt', checksum: null, state: 'failed' }],
            processing: {
              status: 'failed',
              stage: 'assembly',
              generation: 1,
              sourceFingerprint: null,
              error: 'ASSEMBLY_TIMEOUT',
              jobs: [
                { id: 'j1', sourceId: 's1', stage: 'understanding', status: 'accepted', attempts: 1, error: null, retryable: false },
                { id: 'j2', sourceId: 's1', stage: 'chunking', status: 'accepted', attempts: 1, error: null, retryable: false },
                { id: 'j3', sourceId: 's1', stage: 'analysis', status: 'accepted', attempts: 1, error: null, retryable: false },
                { id: 'j4', sourceId: null, stage: 'assembly', status: 'failed', attempts: 3, error: 'ASSEMBLY_TIMEOUT', retryable: false },
              ],
            },
          });
          expect(getActiveStage(workspace)).toBe('assembly');
        });

        it('prioritizes failed job stage even if another job is still marked running', () => {
          const workspace = createMinimalWorkspace({
            sources: [
              { id: 's1', version: 0, label: 'S1', text: 'txt', checksum: null, state: 'failed' },
              { id: 's2', version: 0, label: 'S2', text: 'txt', checksum: null, state: 'processing' },
            ],
            processing: {
              status: 'failed',
              stage: 'chunking',
              generation: 1,
              sourceFingerprint: null,
              error: 'CHUNK_OVERFLOW',
              jobs: [
                { id: 'j1-s1', sourceId: 's1', stage: 'chunking', status: 'failed', attempts: 1, error: 'CHUNK_OVERFLOW', retryable: true },
                { id: 'j1-s2', sourceId: 's2', stage: 'understanding', status: 'running', attempts: 1, error: null, retryable: true },
              ],
            },
          });
          expect(getActiveStage(workspace)).toBe('chunking');
        });
      });
    });

    describe('processing fallback when jobs array is absent', () => {
      it.each([
        ['acquisition', 'understanding'],
        ['extraction', 'understanding'],
        ['understanding', 'understanding'],
        ['chunking', 'chunking'],
        ['analysis', 'analysis'],
        ['assembly', 'assembly'],
        ['done', 'curriculum'],
      ] as const)('maps processing stage "%s" to builder stage "%s"', (processingStage, expectedStage) => {
        const workspace = createMinimalWorkspace({
          sources: [{ id: 's1', version: 0, label: 'S1', text: 'txt', checksum: null, state: 'processing' }],
          processing: {
            status: 'processing',
            stage: processingStage,
            generation: 1,
            sourceFingerprint: null,
            error: null,
          },
        });
        expect(getActiveStage(workspace)).toBe(expectedStage);
      });
    });

    describe('cancellations and idle states', () => {
      it('returns "curriculum" after cancellation if lessons exist in workspace', () => {
        const workspace = createMinimalWorkspace({
          sources: [{ id: 's1', version: 0, label: 'S1', text: 'txt', checksum: null, state: 'stale' }],
          lessons: [{ id: 'l1', version: 0, title: 'L1', objective: 'Obj1', sourceChunkIds: [], pinned: false }],
          processing: {
            status: 'idle',
            stage: 'done',
            generation: 1,
            sourceFingerprint: null,
            error: 'PROCESSING_CANCELED',
            jobs: [{ id: 'j1', sourceId: 's1', stage: 'chunking', status: 'canceled', attempts: 0, error: null, retryable: true }],
          },
        });
        expect(getActiveStage(workspace)).toBe('curriculum');
      });

      it('returns "intake" after cancellation if no lessons exist', () => {
        const workspace = createMinimalWorkspace({
          sources: [{ id: 's1', version: 0, label: 'S1', text: 'txt', checksum: null, state: 'stale' }],
          lessons: [],
          processing: {
            status: 'idle',
            stage: 'done',
            generation: 1,
            sourceFingerprint: null,
            error: 'PROCESSING_CANCELED',
            jobs: [{ id: 'j1', sourceId: 's1', stage: 'chunking', status: 'canceled', attempts: 0, error: null, retryable: true }],
          },
        });
        expect(getActiveStage(workspace)).toBe('intake');
      });

      it('returns fallback stage from processing.stage when status is failed and jobs are canceled', () => {
        const workspace = createMinimalWorkspace({
          sources: [{ id: 's1', version: 0, label: 'S1', text: 'txt', checksum: null, state: 'stale' }],
          processing: {
            status: 'failed',
            stage: 'chunking',
            generation: 1,
            sourceFingerprint: null,
            error: 'PROCESSING_CANCELED',
            jobs: [{ id: 'j1', sourceId: 's1', stage: 'chunking', status: 'canceled', attempts: 0, error: null, retryable: true }],
          },
        });
        expect(getActiveStage(workspace)).toBe('chunking');
      });

      it('defaults to "curriculum" if sources exist and lessons exist in idle state', () => {
        const workspace = createMinimalWorkspace({
          sources: [{ id: 's1', version: 0, label: 'S1', text: 'txt', checksum: null, state: 'ready' }],
          lessons: [{ id: 'l1', version: 0, title: 'Existing Lesson', objective: 'Obj', sourceChunkIds: [], pinned: false }],
          processing: { status: 'idle', stage: 'done', generation: 0, sourceFingerprint: null, error: null },
        });
        expect(getActiveStage(workspace)).toBe('curriculum');
      });

      it('defaults to "intake" if sources exist but no lessons exist in idle state', () => {
        const workspace = createMinimalWorkspace({
          sources: [{ id: 's1', version: 0, label: 'S1', text: 'txt', checksum: null, state: 'ready' }],
          lessons: [],
          processing: { status: 'idle', stage: 'done', generation: 0, sourceFingerprint: null, error: null },
        });
        expect(getActiveStage(workspace)).toBe('intake');
      });
    });
  });

  describe('getEffectiveStage', () => {
    it('returns getActiveStage(workspace) when inspectedStage is null', () => {
      const workspace = createMinimalWorkspace({
        sources: [{ id: 's1', version: 0, label: 'S1', text: 'txt', checksum: null, state: 'processing' }],
        processing: { status: 'processing', stage: 'chunking', generation: 1, sourceFingerprint: null, error: null },
      });
      expect(getEffectiveStage(workspace, null)).toBe('chunking');
    });

    it('returns inspectedStage when inspectedStage is set, overriding active stage', () => {
      const workspace = createMinimalWorkspace({
        sources: [{ id: 's1', version: 0, label: 'S1', text: 'txt', checksum: null, state: 'processing' }],
        processing: { status: 'processing', stage: 'chunking', generation: 1, sourceFingerprint: null, error: null },
      });
      const inspected: BuilderStage = 'understanding';
      expect(getEffectiveStage(workspace, inspected)).toBe('understanding');
      expect(getEffectiveStage(workspace, 'assembly')).toBe('assembly');
      expect(getEffectiveStage(workspace, 'review')).toBe('review');
    });

    it('is completely read-only and does not mutate workspace object', () => {
      const workspace = createMinimalWorkspace({
        sources: [{ id: 's1', version: 0, label: 'S1', text: 'txt', checksum: null, state: 'ready' }],
      });
      const copy = JSON.parse(JSON.stringify(workspace));
      getEffectiveStage(workspace, 'chunking');
      expect(workspace).toEqual(copy);
    });
  });

  describe('getUnderstandingData', () => {
    it('returns empty list when workspace has no sources', () => {
      const workspace = createMinimalWorkspace({ sources: [] });
      const data = getUnderstandingData(workspace);
      expect(data).toHaveLength(0);
      expect(data.sources).toHaveLength(0);
      expect(data.totalTopics).toBe(0);
      expect(data.totalSegments).toBe(0);
    });

    it('maps sources with their topics, status, and segment counts', () => {
      const workspace = createMinimalWorkspace({
        sources: [
          {
            id: 'source-1',
            version: 0,
            label: 'Distributed Systems',
            text: 'Content with segments',
            checksum: null,
            state: 'ready',
            locations: [
              { start: 0, end: 10, page: 1 },
              { start: 11, end: 20, page: 2 },
            ],
          },
          {
            id: 'source-2',
            version: 0,
            label: 'Raft Consensus',
            text: 'Leader election algorithm',
            checksum: null,
            state: 'processing',
          },
        ],
        understanding: [
          {
            sourceId: 'source-1',
            sourceVersion: 0,
            topics: ['Replication', 'Quorums', 'Fault Tolerance'],
          },
        ],
      });

      const data = getUnderstandingData(workspace);
      expect(data).toHaveLength(2);
      expect(data.sources).toHaveLength(2);

      // Source 1
      expect(data[0].sourceId).toBe('source-1');
      expect(data[0].label).toBe('Distributed Systems');
      expect(data[0].status).toBe('ready');
      expect(data[0].segmentCount).toBe(2);
      expect(data[0].topics).toEqual(['Replication', 'Quorums', 'Fault Tolerance']);

      // Source 2 (no topics entry, fallback segment count from text)
      expect(data[1].sourceId).toBe('source-2');
      expect(data[1].label).toBe('Raft Consensus');
      expect(data[1].status).toBe('processing');
      expect(data[1].segmentCount).toBe(1);
      expect(data[1].topics).toEqual([]);

      expect(data.totalTopics).toBe(3);
      expect(data.totalSegments).toBe(3);
    });
  });

  describe('getChunkingData', () => {
    it('returns sources with chunk counts and chunks for selected source', () => {
      const workspace = createMinimalWorkspace({
        sources: [
          { id: 's1', version: 0, label: 'Doc 1', text: 'Full text 1', checksum: null, state: 'ready' },
          { id: 's2', version: 0, label: 'Doc 2', text: 'Full text 2', checksum: null, state: 'ready' },
        ],
        chunks: [
          { id: 'c1', sourceId: 's1', sourceVersion: 0, start: 0, end: 50, text: 'Short chunk', checksum: 'a'.repeat(64) },
          { id: 'c2', sourceId: 's1', sourceVersion: 0, start: 50, end: 300, text: 'A'.repeat(200), checksum: 'b'.repeat(64) },
          { id: 'c3', sourceId: 's2', sourceVersion: 0, start: 0, end: 40, text: 'Doc 2 chunk', checksum: 'c'.repeat(64) },
        ],
      });

      // Default selection (first source: s1)
      const dataDefault = getChunkingData(workspace);
      expect(dataDefault.sources).toHaveLength(2);
      expect(dataDefault.sources[0]).toEqual({ id: 's1', sourceId: 's1', label: 'Doc 1', status: 'ready', chunkCount: 2 });
      expect(dataDefault.sources[1]).toEqual({ id: 's2', sourceId: 's2', label: 'Doc 2', status: 'ready', chunkCount: 1 });
      expect(dataDefault.selectedSourceId).toBe('s1');
      expect(dataDefault.chunks).toHaveLength(2);

      // Verify chunk fields
      const firstChunk = dataDefault.chunks[0];
      expect(firstChunk.id).toBe('c1');
      expect(firstChunk.sourceId).toBe('s1');
      expect(firstChunk.start).toBe(0);
      expect(firstChunk.end).toBe(50);
      expect(firstChunk.offset).toBe(0);
      expect(firstChunk.length).toBe(50);
      expect(firstChunk.text).toBe('Short chunk');
      expect(firstChunk.snippet).toBe('Short chunk');

      // Verify snippet truncation for long text
      const secondChunk = dataDefault.chunks[1];
      expect(secondChunk.length).toBe(250);
      expect(secondChunk.snippet).toBe('A'.repeat(160) + '...');

      // Explicit selection: s2
      const dataS2 = getChunkingData(workspace, 's2');
      expect(dataS2.selectedSourceId).toBe('s2');
      expect(dataS2.chunks).toHaveLength(1);
      expect(dataS2.chunks[0].id).toBe('c3');
    });

    it('handles empty workspace chunks gracefully', () => {
      const workspace = createMinimalWorkspace({
        sources: [{ id: 's1', version: 0, label: 'Doc 1', text: 'Text', checksum: null, state: 'ready' }],
        chunks: [],
      });
      const data = getChunkingData(workspace);
      expect(data.sources[0].chunkCount).toBe(0);
      expect(data.chunks).toHaveLength(0);
      expect(data.totalChunks).toBe(0);
    });
  });

  describe('getAnalysisData', () => {
    it('joins chunks with analyses summary and pedagogical question', () => {
      const workspace = createMinimalWorkspace({
        sources: [
          { id: 's1', version: 0, label: 'Doc 1', text: 'Text 1', checksum: null, state: 'ready' },
        ],
        chunks: [
          { id: 'c1', sourceId: 's1', sourceVersion: 0, start: 0, end: 100, text: 'Passage on Consensus', checksum: 'a'.repeat(64) },
          { id: 'c2', sourceId: 's1', sourceVersion: 0, start: 100, end: 200, text: 'Passage on Paxos', checksum: 'b'.repeat(64) },
        ],
        analyses: [
          {
            chunkId: 'c1',
            summary: 'Explains consensus in synchronous networks.',
            question: 'How does network synchrony affect consensus impossibility?',
          },
        ],
      });

      const data = getAnalysisData(workspace);
      expect(data.sources).toHaveLength(1);
      expect(data.sources[0].chunkCount).toBe(2);
      expect(data.sources[0].analyzedCount).toBe(1);
      expect(data.totalAnalyses).toBe(1);

      expect(data.chunks).toHaveLength(2);

      // Chunk 1 has analysis
      const chunk1 = data.chunks[0];
      expect(chunk1.hasAnalysis).toBe(true);
      expect(chunk1.summary).toBe('Explains consensus in synchronous networks.');
      expect(chunk1.question).toBe('How does network synchrony affect consensus impossibility?');
      expect(chunk1.analysis).toEqual({
        summary: 'Explains consensus in synchronous networks.',
        question: 'How does network synchrony affect consensus impossibility?',
      });

      // Chunk 2 has no analysis
      const chunk2 = data.chunks[1];
      expect(chunk2.hasAnalysis).toBe(false);
      expect(chunk2.summary).toBeNull();
      expect(chunk2.question).toBeNull();
      expect(chunk2.analysis).toBeNull();
    });

    it('filters by selectedSourceId when provided', () => {
      const workspace = createMinimalWorkspace({
        sources: [
          { id: 's1', version: 0, label: 'Doc 1', text: 'Text 1', checksum: null, state: 'ready' },
          { id: 's2', version: 0, label: 'Doc 2', text: 'Text 2', checksum: null, state: 'ready' },
        ],
        chunks: [
          { id: 'c1', sourceId: 's1', sourceVersion: 0, start: 0, end: 50, text: 'Text', checksum: 'a'.repeat(64) },
          { id: 'c2', sourceId: 's2', sourceVersion: 0, start: 0, end: 50, text: 'Text', checksum: 'b'.repeat(64) },
        ],
        analyses: [
          { chunkId: 'c2', summary: 'Summary for c2', question: 'Question for c2' },
        ],
      });

      const data = getAnalysisData(workspace, 's2');
      expect(data.selectedSourceId).toBe('s2');
      expect(data.chunks).toHaveLength(1);
      expect(data.chunks[0].chunkId).toBe('c2');
      expect(data.chunks[0].hasAnalysis).toBe(true);
    });
  });

  describe('getAssemblyData', () => {
    it('returns assembly job status and comprehensive progress counts', () => {
      const workspace = createMinimalWorkspace({
        sources: [
          { id: 's1', version: 0, label: 'S1', text: 'txt', checksum: null, state: 'ready' },
          { id: 's2', version: 0, label: 'S2', text: 'txt', checksum: null, state: 'processing' },
        ],
        chunks: [
          { id: 'c1', sourceId: 's1', sourceVersion: 0, start: 0, end: 10, text: 't1', checksum: 'a'.repeat(64) },
          { id: 'c2', sourceId: 's2', sourceVersion: 0, start: 0, end: 10, text: 't2', checksum: 'b'.repeat(64) },
        ],
        analyses: [
          { chunkId: 'c1', summary: 'S', question: 'Q' },
        ],
        lessons: [
          { id: 'l1', version: 0, title: 'Lesson 1', objective: 'Obj 1', sourceChunkIds: ['c1'], pinned: false },
        ],
        processing: {
          status: 'processing',
          stage: 'assembly',
          generation: 1,
          sourceFingerprint: null,
          error: null,
          jobs: [
            { id: 'j1', sourceId: 's1', stage: 'analysis', status: 'accepted', attempts: 1, error: null, retryable: false },
            { id: 'j2', sourceId: 's2', stage: 'analysis', status: 'accepted', attempts: 1, error: null, retryable: false },
            { id: 'j-assembly', sourceId: null, stage: 'assembly', status: 'running', attempts: 1, error: null, retryable: true },
          ],
        },
      });

      const data = getAssemblyData(workspace);
      expect(data.status).toBe('running');
      expect(data.stage).toBe('assembly');
      expect(data.job?.id).toBe('j-assembly');
      expect(data.progress.totalLessons).toBe(1);
      expect(data.progress.totalSources).toBe(2);
      expect(data.progress.readySources).toBe(1);
      expect(data.progress.totalChunks).toBe(2);
      expect(data.progress.totalAnalyses).toBe(1);
      expect(data.progress.totalJobs).toBe(3);
      expect(data.progress.completedJobs).toBe(2);
      expect(data.progress.runningJobs).toBe(1);
      expect(data.progress.failedJobs).toBe(0);
      expect(data.progress.queuedJobs).toBe(0);
    });

    it('handles workspaces without jobs gracefully', () => {
      const workspace = createMinimalWorkspace({
        sources: [{ id: 's1', version: 0, label: 'S1', text: 'txt', checksum: null, state: 'ready' }],
        processing: { status: 'ready', stage: 'done', generation: 1, sourceFingerprint: null, error: null },
      });
      const data = getAssemblyData(workspace);
      expect(data.status).toBe('accepted');
      expect(data.job).toBeNull();
      expect(data.progress.totalJobs).toBe(0);
    });
  });

  describe('Stage Navigation / Inspection UI Interaction', () => {
    it('clicking any step in the stepper sets inspectedStage without dispatching actions', () => {
      fake.state = createMinimalWorkspace({
        sources: [{ id: 's1', version: 0, label: 'S1', text: 'txt', checksum: null, state: 'ready' }],
        processing: { status: 'ready', stage: 'done', generation: 1, sourceFingerprint: 'fp', error: null },
      });

      render(React.createElement(CohortWorkspacePane, { onSelectLessonForChat: () => undefined }));

      // Initially no inspection banner
      expect(screen.queryByTestId('stage-inspection-banner')).toBeNull();

      // Click "Chunking" step
      const chunkingStep = screen.getByText('Chunking');
      fireEvent.click(chunkingStep);

      // Banner appears indicating inspection
      const banner = screen.getByTestId('stage-inspection-banner');
      expect(banner.textContent).toContain('chunking');

      // Verify that this is 100% read-only presentation state: zero actions dispatched
      expect(fake.actions).toHaveLength(0);

      // Click "Analyzing" step
      const analyzingStep = screen.getByText('Analyzing');
      fireEvent.click(analyzingStep);
      expect(screen.getByTestId('stage-inspection-banner').textContent).toContain('analysis');
      expect(fake.actions).toHaveLength(0);

      // Click reset button in the inspection banner
      const resetBtn = screen.getByRole('button', { name: 'Reset to active stage' });
      fireEvent.click(resetBtn);
      expect(screen.queryByTestId('stage-inspection-banner')).toBeNull();
      expect(fake.actions).toHaveLength(0);
    });

    it('toggling the same step clears inspectedStage', () => {
      fake.state = createMinimalWorkspace({
        sources: [{ id: 's1', version: 0, label: 'S1', text: 'txt', checksum: null, state: 'ready' }],
        processing: { status: 'ready', stage: 'done', generation: 1, sourceFingerprint: 'fp', error: null },
      });

      render(React.createElement(CohortWorkspacePane, { onSelectLessonForChat: () => undefined }));

      const understandingStep = screen.getByText('Understanding');
      fireEvent.click(understandingStep);
      expect(screen.getByTestId('stage-inspection-banner').textContent).toContain('understanding');

      // Clicking again toggles off inspection
      fireEvent.click(understandingStep);
      expect(screen.queryByTestId('stage-inspection-banner')).toBeNull();
      expect(fake.actions).toHaveLength(0);
    });
  });

  describe('isStageComplete & getStageProgressDetails', () => {
    it('returns false for all stages on empty sources', () => {
      const workspace = createMinimalWorkspace({ sources: [] });
      expect(isStageComplete(workspace, 'understanding')).toBe(false);
      expect(isStageComplete(workspace, 'chunking')).toBe(false);
      expect(isStageComplete(workspace, 'analysis')).toBe(false);
      expect(isStageComplete(workspace, 'assembly')).toBe(false);

      const details = getStageProgressDetails(workspace);
      expect(details.understanding.status).toBe('pending');
      expect(details.chunking.status).toBe('pending');
      expect(details.analysis.status).toBe('pending');
      expect(details.assembly.status).toBe('pending');
    });

    it('requires all sources to have accepted understanding before stage completion', () => {
      const workspace = createMinimalWorkspace({
        sources: [
          { id: 's1', version: 0, label: 'S1', text: 'txt', checksum: null, state: 'ready' },
          { id: 's2', version: 0, label: 'S2', text: 'txt', checksum: null, state: 'processing' },
        ],
        processing: {
          status: 'processing',
          stage: 'understanding',
          generation: 1,
          sourceFingerprint: null,
          error: null,
          jobs: [
            { id: 'j1', sourceId: 's1', stage: 'understanding', status: 'accepted', attempts: 1, error: null, retryable: false },
            { id: 'j2', sourceId: 's2', stage: 'understanding', status: 'running', attempts: 1, error: null, retryable: true },
          ],
        },
      });

      expect(isStageComplete(workspace, 'understanding')).toBe(false);
      const details = getStageProgressDetails(workspace);
      expect(details.understanding.completedCount).toBe(1);
      expect(details.understanding.totalCount).toBe(2);
      expect(details.understanding.status).toBe('running');
    });

    it('filters out stale chunks from older source versions in getValidChunks and getValidAnalyses', () => {
      const workspace = createMinimalWorkspace({
        sources: [
          { id: 's1', version: 1, label: 'S1 v1', text: 'new text', checksum: null, state: 'ready' },
        ],
        chunks: [
          { id: 'c-old', sourceId: 's1', sourceVersion: 0, start: 0, end: 10, text: 'old', checksum: 'a'.repeat(64) },
          { id: 'c-new', sourceId: 's1', sourceVersion: 1, start: 0, end: 10, text: 'new', checksum: 'b'.repeat(64) },
        ],
        analyses: [
          { chunkId: 'c-old', summary: 'old summary', question: 'old question' },
          { chunkId: 'c-new', summary: 'new summary', question: 'new question' },
        ],
      });

      const validChunks = getValidChunks(workspace);
      expect(validChunks).toHaveLength(1);
      expect(validChunks[0].id).toBe('c-new');

      const validAnalyses = getValidAnalyses(workspace);
      expect(validAnalyses).toHaveLength(1);
      expect(validAnalyses[0].chunkId).toBe('c-new');
    });
  });
});


