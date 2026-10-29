// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import {
  getActiveStage,
  getEffectiveStage,
  isStageComplete,
  getStageProgressDetails,
  getValidChunks,
  getValidAnalyses,
} from '../stage-selectors';
import type { CohortWorkspace } from '@/src/shared/cohort-builder/contracts';
import { ChunkingStageView } from '../stages/ChunkingStageView';
import { AssemblyStageView } from '../stages/AssemblyStageView';
import { ProcessingChecklist } from '../stages/ProcessingChecklist';

afterEach(() => {
  cleanup();
});

function createTestWorkspace(overrides: Partial<CohortWorkspace> = {}): CohortWorkspace {
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

describe('Checkpoint 2 — Stage Canonical Progress Contracts', () => {
  it('1. One source has accepted chunking; another has not: chunking is not complete and progress counts reflect partial completion', () => {
    const workspace = createTestWorkspace({
      sources: [
        { id: 's1', version: 0, label: 'Source 1', text: 'Text 1', checksum: 'a'.repeat(64), state: 'processing' },
        { id: 's2', version: 0, label: 'Source 2', text: 'Text 2', checksum: 'b'.repeat(64), state: 'processing' },
      ],
      chunks: [
        { id: 'c1', sourceId: 's1', sourceVersion: 0, start: 0, end: 50, text: 'Chunk 1', checksum: 'c'.repeat(64) },
      ],
      processing: {
        status: 'processing',
        stage: 'chunking',
        generation: 1,
        sourceFingerprint: null,
        error: null,
        jobs: [
          { id: 'j1-u', sourceId: 's1', stage: 'understanding', status: 'accepted', attempts: 1, error: null, retryable: false },
          { id: 'j2-u', sourceId: 's2', stage: 'understanding', status: 'accepted', attempts: 1, error: null, retryable: false },
          { id: 'j1-c', sourceId: 's1', stage: 'chunking', status: 'accepted', attempts: 1, error: null, retryable: false },
          { id: 'j2-c', sourceId: 's2', stage: 'chunking', status: 'running', attempts: 1, error: null, retryable: true },
        ],
      },
    });

    // Understanding is complete across both sources
    expect(isStageComplete(workspace, 'understanding')).toBe(true);

    // Chunking is NOT complete because s2 is still running
    expect(isStageComplete(workspace, 'chunking')).toBe(false);
    expect(isStageComplete(workspace, 'analysis')).toBe(false);
    expect(isStageComplete(workspace, 'assembly')).toBe(false);

    const details = getStageProgressDetails(workspace);
    expect(details.understanding.status).toBe('complete');
    expect(details.understanding.completedCount).toBe(2);
    expect(details.understanding.totalCount).toBe(2);

    expect(details.chunking.status).toBe('running');
    expect(details.chunking.completedCount).toBe(1);
    expect(details.chunking.totalCount).toBe(2);
    expect(details.chunking.failedCount).toBe(0);

    // Render ChunkingStageView and verify truthful progress and headline
    const dispatchAction = vi.fn().mockResolvedValue(true);
    const { unmount } = render(React.createElement(ChunkingStageView, { workspace, dispatchAction }));
    expect(screen.getByText('Finding natural')).toBeTruthy();
    expect(screen.getByText('1/2 sources structured')).toBeTruthy();
    unmount();
  });

  it('2. Old chunks remain after source edit/scope change: filters out stale chunks and does not falsely claim completion', () => {
    // Source was edited: source.version is 1. Old chunks from version 0 remain in workspace.chunks
    const workspace = createTestWorkspace({
      sources: [
        { id: 's1', version: 1, label: 'Edited Source', text: 'New text', checksum: null, state: 'processing' },
      ],
      chunks: [
        // Stale chunk from version 0
        { id: 'c-old', sourceId: 's1', sourceVersion: 0, start: 0, end: 40, text: 'Old version chunk', checksum: 'a'.repeat(64) },
      ],
      analyses: [
        // Analysis pointing to stale chunk
        { chunkId: 'c-old', summary: 'Old summary', question: 'Old question' },
      ],
      processing: {
        status: 'processing',
        stage: 'chunking',
        generation: 2,
        sourceFingerprint: null,
        error: null,
        jobs: [
          // Old job for version 0
          { id: 'j-chunk-v0', sourceId: 's1', sourceVersion: 0, stage: 'chunking', status: 'accepted', attempts: 1, error: null, retryable: false } as any,
          // Current job for version 1 is still running
          { id: 'j-chunk-v1', sourceId: 's1', sourceVersion: 1, stage: 'chunking', status: 'running', attempts: 1, error: null, retryable: true } as any,
        ],
      },
    });

    // Valid chunks should exclude the old chunk from version 0
    const validChunks = getValidChunks(workspace);
    expect(validChunks).toHaveLength(0);

    // Valid analyses should exclude analysis for old chunk
    const validAnalyses = getValidAnalyses(workspace);
    expect(validAnalyses).toHaveLength(0);

    // Stage completion must NOT be fooled by the old version chunks or jobs
    expect(isStageComplete(workspace, 'chunking')).toBe(false);

    const details = getStageProgressDetails(workspace);
    expect(details.chunking.status).toBe('running');
    expect(details.chunking.completedCount).toBe(0);
  });

  it('3. One source fails while another advances: accurately reports failure, isolates failed stage, and maintains priority in active stage', () => {
    const workspace = createTestWorkspace({
      sources: [
        { id: 's1', version: 0, label: 'Doc 1', text: 'Text 1', checksum: 'a'.repeat(64), state: 'failed' },
        { id: 's2', version: 0, label: 'Doc 2', text: 'Text 2', checksum: 'b'.repeat(64), state: 'processing' },
      ],
      processing: {
        status: 'failed',
        stage: 'chunking',
        generation: 1,
        sourceFingerprint: null,
        error: 'PARSER_CHUNK_FAIL',
        jobs: [
          { id: 'j1-u', sourceId: 's1', stage: 'understanding', status: 'accepted', attempts: 1, error: null, retryable: false },
          { id: 'j2-u', sourceId: 's2', stage: 'understanding', status: 'accepted', attempts: 1, error: null, retryable: false },
          { id: 'j1-c', sourceId: 's1', stage: 'chunking', status: 'failed', attempts: 2, error: 'PARSER_CHUNK_FAIL', retryable: true },
          { id: 'j2-c', sourceId: 's2', stage: 'chunking', status: 'accepted', attempts: 1, error: null, retryable: false },
          { id: 'j2-a', sourceId: 's2', stage: 'analysis', status: 'running', attempts: 1, error: null, retryable: true },
        ],
      },
    });

    // Understanding is complete
    expect(isStageComplete(workspace, 'understanding')).toBe(true);

    // Chunking is NOT complete
    expect(isStageComplete(workspace, 'chunking')).toBe(false);
    expect(isStageComplete(workspace, 'analysis')).toBe(false);

    // Active stage derivation focuses on the failed stage
    expect(getActiveStage(workspace)).toBe('chunking');

    const details = getStageProgressDetails(workspace);
    expect(details.understanding.status).toBe('complete');
    expect(details.chunking.status).toBe('failed');
    expect(details.chunking.completedCount).toBe(1);
    expect(details.chunking.totalCount).toBe(2);
    expect(details.chunking.failedCount).toBe(1);
    expect(details.chunking.retryable).toBe(true);
  });

  it('4. Cancellation with accepted prerequisites retained: preserves prior accepted stages and flags in-flight stage as canceled', () => {
    const workspace = createTestWorkspace({
      sources: [
        { id: 's1', version: 0, label: 'Doc 1', text: 'Text 1', checksum: 'a'.repeat(64), state: 'stale' },
        { id: 's2', version: 0, label: 'Doc 2', text: 'Text 2', checksum: 'b'.repeat(64), state: 'stale' },
      ],
      processing: {
        status: 'idle',
        stage: 'done',
        generation: 1,
        sourceFingerprint: null,
        error: 'PROCESSING_CANCELED',
        jobs: [
          { id: 'j1-u', sourceId: 's1', stage: 'understanding', status: 'accepted', attempts: 1, error: null, retryable: false },
          { id: 'j2-u', sourceId: 's2', stage: 'understanding', status: 'accepted', attempts: 1, error: null, retryable: false },
          { id: 'j1-c', sourceId: 's1', stage: 'chunking', status: 'canceled', attempts: 0, error: null, retryable: true },
          { id: 'j2-c', sourceId: 's2', stage: 'chunking', status: 'canceled', attempts: 0, error: null, retryable: true },
        ],
      },
    });

    // Prior accepted understanding stage is retained as complete
    expect(isStageComplete(workspace, 'understanding')).toBe(true);

    // In-flight chunking stage was canceled, so it is not complete
    expect(isStageComplete(workspace, 'chunking')).toBe(false);
    expect(isStageComplete(workspace, 'analysis')).toBe(false);
    expect(isStageComplete(workspace, 'assembly')).toBe(false);

    const details = getStageProgressDetails(workspace);
    expect(details.understanding.status).toBe('complete');
    expect(details.chunking.status).toBe('canceled');
    expect(details.chunking.isCanceled).toBe(true);
    expect(details.analysis.status).toBe('pending');
    expect(details.assembly.status).toBe('pending');

    // Verify ProcessingChecklist renders understanding complete and chunking canceled
    const { unmount, container } = render(React.createElement(ProcessingChecklist, { workspace }));
    const items = container.querySelectorAll('li');
    expect(items[0].getAttribute('data-state')).toBe('complete');
    expect(items[1].getAttribute('data-state')).toBe('canceled');
    expect(items[2].getAttribute('data-state')).toBe('pending');
    expect(items[3].getAttribute('data-state')).toBe('pending');
    unmount();
  });

  it('5. Targeted retry restores running state: transitions failed/canceled stage back to running with retryable capability', () => {
    const workspace = createTestWorkspace({
      sources: [
        { id: 's1', version: 0, label: 'Doc 1', text: 'Text 1', checksum: 'a'.repeat(64), state: 'processing' },
      ],
      processing: {
        status: 'processing',
        stage: 'chunking',
        generation: 1,
        sourceFingerprint: null,
        error: null,
        jobs: [
          { id: 'j1-u', sourceId: 's1', stage: 'understanding', status: 'accepted', attempts: 1, error: null, retryable: false },
          { id: 'j1-c', sourceId: 's1', stage: 'chunking', status: 'running', attempts: 2, error: null, retryable: true },
        ],
      },
    });

    expect(isStageComplete(workspace, 'understanding')).toBe(true);
    expect(isStageComplete(workspace, 'chunking')).toBe(false);

    const details = getStageProgressDetails(workspace);
    expect(details.chunking.status).toBe('running');
    expect(details.chunking.failedCount).toBe(0);
    expect(details.chunking.isCanceled).toBe(false);
  });

  it('6. Accepted analysis with assembly still pending: all 3 earlier stages complete, assembly running/pending and not claimed complete', () => {
    const workspace = createTestWorkspace({
      sources: [
        { id: 's1', version: 0, label: 'Doc 1', text: 'Text 1', checksum: 'a'.repeat(64), state: 'processing' },
      ],
      chunks: [
        { id: 'c1', sourceId: 's1', sourceVersion: 0, start: 0, end: 50, text: 'Text chunk', checksum: 'c'.repeat(64) },
      ],
      analyses: [
        { chunkId: 'c1', summary: 'Summary 1', question: 'Question 1' },
      ],
      processing: {
        status: 'processing',
        stage: 'assembly',
        generation: 1,
        sourceFingerprint: null,
        error: null,
        jobs: [
          { id: 'j1-u', sourceId: 's1', stage: 'understanding', status: 'accepted', attempts: 1, error: null, retryable: false },
          { id: 'j1-c', sourceId: 's1', stage: 'chunking', status: 'accepted', attempts: 1, error: null, retryable: false },
          { id: 'j1-a', sourceId: 's1', stage: 'analysis', status: 'accepted', attempts: 1, error: null, retryable: false },
          { id: 'j-assembly', sourceId: null, stage: 'assembly', status: 'running', attempts: 1, error: null, retryable: true },
        ],
      },
    });

    expect(isStageComplete(workspace, 'understanding')).toBe(true);
    expect(isStageComplete(workspace, 'chunking')).toBe(true);
    expect(isStageComplete(workspace, 'analysis')).toBe(true);
    expect(isStageComplete(workspace, 'assembly')).toBe(false);

    const details = getStageProgressDetails(workspace);
    expect(details.analysis.status).toBe('complete');
    expect(details.assembly.status).toBe('running');
    expect(details.assembly.completedCount).toBe(0);

    const dispatchAction = vi.fn().mockResolvedValue(true);
    const { unmount } = render(React.createElement(AssemblyStageView, { workspace, dispatchAction }));
    expect(screen.getByText('Bringing it all together…')).toBeTruthy();
    expect(screen.queryByText('Your lessons are saved.')).toBeNull();
    unmount();
  });

  it('7. Manual/pinned lessons exist before new assembly is accepted: presence of lessons does not falsely mark assembly complete', () => {
    const workspace = createTestWorkspace({
      sources: [
        { id: 's1', version: 0, label: 'Doc 1', text: 'Text 1', checksum: 'a'.repeat(64), state: 'processing' },
      ],
      lessons: [
        { id: 'manual-lesson-1', version: 1, title: 'Hand-crafted lesson', objective: 'Preserved objective', sourceChunkIds: [], pinned: true },
      ],
      processing: {
        status: 'processing',
        stage: 'assembly',
        generation: 2,
        sourceFingerprint: null,
        error: null,
        jobs: [
          { id: 'j1-u', sourceId: 's1', stage: 'understanding', status: 'accepted', attempts: 1, error: null, retryable: false },
          { id: 'j1-c', sourceId: 's1', stage: 'chunking', status: 'accepted', attempts: 1, error: null, retryable: false },
          { id: 'j1-a', sourceId: 's1', stage: 'analysis', status: 'accepted', attempts: 1, error: null, retryable: false },
          { id: 'j-assembly', sourceId: null, stage: 'assembly', status: 'queued', attempts: 0, error: null, retryable: true },
        ],
      },
    });

    // Despite workspace.lessons having an entry, assembly is strictly NOT complete
    expect(isStageComplete(workspace, 'assembly')).toBe(false);

    const dispatchAction = vi.fn().mockResolvedValue(true);
    const { unmount } = render(React.createElement(AssemblyStageView, { workspace, dispatchAction }));
    expect(screen.getByText('Bringing it all together…')).toBeTruthy();
    expect(screen.queryByText('Your lessons are saved.')).toBeNull();
    unmount();
  });

  it('8. Missing job projection and conservative legacy fallback: correctly maps processing.status and processing.stage when jobs are absent', () => {
    // 8a: status ready without jobs
    const workspaceReady = createTestWorkspace({
      sources: [{ id: 's1', version: 0, label: 'Doc 1', text: 'Text 1', checksum: 'a'.repeat(64), state: 'ready' }],
      processing: { status: 'ready', stage: 'done', generation: 1, sourceFingerprint: 'fp', error: null },
    });
    expect(isStageComplete(workspaceReady, 'understanding')).toBe(true);
    expect(isStageComplete(workspaceReady, 'chunking')).toBe(true);
    expect(isStageComplete(workspaceReady, 'analysis')).toBe(true);
    expect(isStageComplete(workspaceReady, 'assembly')).toBe(true);

    // 8b: status processing at stage analysis
    const workspaceAnalyzing = createTestWorkspace({
      sources: [{ id: 's1', version: 0, label: 'Doc 1', text: 'Text 1', checksum: 'a'.repeat(64), state: 'processing' }],
      processing: { status: 'processing', stage: 'analysis', generation: 1, sourceFingerprint: null, error: null },
    });
    expect(isStageComplete(workspaceAnalyzing, 'understanding')).toBe(true);
    expect(isStageComplete(workspaceAnalyzing, 'chunking')).toBe(true);
    expect(isStageComplete(workspaceAnalyzing, 'analysis')).toBe(false);
    expect(isStageComplete(workspaceAnalyzing, 'assembly')).toBe(false);

    // 8c: status idle with cancellation
    const workspaceCanceled = createTestWorkspace({
      sources: [{ id: 's1', version: 0, label: 'Doc 1', text: 'Text 1', checksum: 'a'.repeat(64), state: 'stale' }],
      processing: { status: 'idle', stage: 'done', generation: 1, sourceFingerprint: null, error: 'PROCESSING_CANCELED' },
    });
    expect(isStageComplete(workspaceCanceled, 'understanding')).toBe(false);
    expect(isStageComplete(workspaceCanceled, 'chunking')).toBe(false);
    expect(isStageComplete(workspaceCanceled, 'analysis')).toBe(false);
    expect(isStageComplete(workspaceCanceled, 'assembly')).toBe(false);

    // 8d: empty sources
    const workspaceEmpty = createTestWorkspace({ sources: [] });
    expect(isStageComplete(workspaceEmpty, 'understanding')).toBe(false);
    expect(isStageComplete(workspaceEmpty, 'chunking')).toBe(false);
    expect(isStageComplete(workspaceEmpty, 'analysis')).toBe(false);
    expect(isStageComplete(workspaceEmpty, 'assembly')).toBe(false);
  });

  it('9. Current accepted assembly marks all 4 complete: all stages verified complete and all checklist items render Check marks', () => {
    const workspace = createTestWorkspace({
      sources: [
        { id: 's1', version: 0, label: 'Doc 1', text: 'Text 1', checksum: 'a'.repeat(64), state: 'ready' },
      ],
      lessons: [
        { id: 'lesson-1', version: 0, title: 'Consensus Basics', objective: 'Learn consensus', sourceChunkIds: [], pinned: false },
      ],
      processing: {
        status: 'ready',
        stage: 'done',
        generation: 1,
        sourceFingerprint: 'fingerprint-123',
        error: null,
        jobs: [
          { id: 'j1-u', sourceId: 's1', stage: 'understanding', status: 'accepted', attempts: 1, error: null, retryable: false },
          { id: 'j1-c', sourceId: 's1', stage: 'chunking', status: 'accepted', attempts: 1, error: null, retryable: false },
          { id: 'j1-a', sourceId: 's1', stage: 'analysis', status: 'accepted', attempts: 1, error: null, retryable: false },
          { id: 'j-assembly', sourceId: null, stage: 'assembly', status: 'accepted', attempts: 1, error: null, retryable: false },
        ],
      },
    });

    expect(isStageComplete(workspace, 'understanding')).toBe(true);
    expect(isStageComplete(workspace, 'chunking')).toBe(true);
    expect(isStageComplete(workspace, 'analysis')).toBe(true);
    expect(isStageComplete(workspace, 'assembly')).toBe(true);

    const details = getStageProgressDetails(workspace);
    expect(details.understanding.status).toBe('complete');
    expect(details.chunking.status).toBe('complete');
    expect(details.analysis.status).toBe('complete');
    expect(details.assembly.status).toBe('complete');

    const { unmount, container } = render(React.createElement(ProcessingChecklist, { workspace }));
    const items = container.querySelectorAll('li');
    expect(items).toHaveLength(4);
    items.forEach(li => {
      expect(li.getAttribute('data-state')).toBe('complete');
    });
    unmount();

    const dispatchAction = vi.fn().mockResolvedValue(true);
    const { unmount: unmountAssembly } = render(React.createElement(AssemblyStageView, { workspace, dispatchAction }));
    expect(screen.getByText('Your lessons are saved.')).toBeTruthy();
    unmountAssembly();
  });

  it('10. Stage inspection of an earlier stage while later jobs run accurately reflects canonical progress without side effects', () => {
    const workspace = createTestWorkspace({
      sources: [
        { id: 's1', version: 0, label: 'Doc 1', text: 'Text 1', checksum: 'a'.repeat(64), state: 'processing' },
      ],
      chunks: [
        { id: 'c1', sourceId: 's1', sourceVersion: 0, start: 0, end: 50, text: 'Grounded chunk 1', checksum: 'a'.repeat(64) },
        { id: 'c2', sourceId: 's1', sourceVersion: 0, start: 50, end: 100, text: 'Grounded chunk 2', checksum: 'b'.repeat(64) },
      ],
      processing: {
        status: 'processing',
        stage: 'assembly',
        generation: 1,
        sourceFingerprint: null,
        error: null,
        jobs: [
          { id: 'j1-u', sourceId: 's1', stage: 'understanding', status: 'accepted', attempts: 1, error: null, retryable: false },
          { id: 'j1-c', sourceId: 's1', stage: 'chunking', status: 'accepted', attempts: 1, error: null, retryable: false },
          { id: 'j1-a', sourceId: 's1', stage: 'analysis', status: 'accepted', attempts: 1, error: null, retryable: false },
          { id: 'j-assembly', sourceId: null, stage: 'assembly', status: 'running', attempts: 1, error: null, retryable: true },
        ],
      },
    });

    // Active stage is assembly
    expect(getActiveStage(workspace)).toBe('assembly');

    // User inspects 'chunking'
    const inspectedStage = getEffectiveStage(workspace, 'chunking');
    expect(inspectedStage).toBe('chunking');

    // Chunking stage view reflects accepted chunks
    const dispatchAction = vi.fn().mockResolvedValue(true);
    const { unmount } = render(React.createElement(ChunkingStageView, { workspace, dispatchAction }));

    // Chunking itself is complete
    expect(isStageComplete(workspace, 'chunking')).toBe(true);

    // Displays accepted headline
    expect(screen.getByText('Your learning')).toBeTruthy();
    expect(screen.getByText('chunks are saved.')).toBeTruthy();

    // Canonical progress accurately shows assembly as running, analysis as complete
    const stageDetails = getStageProgressDetails(workspace);
    expect(stageDetails.understanding.status).toBe('complete');
    expect(stageDetails.chunking.status).toBe('complete');
    expect(stageDetails.analysis.status).toBe('complete');
    expect(stageDetails.assembly.status).toBe('running');

    // And ProcessingChecklist (rendered in the conversation rail) reflects canonical progress
    const { container: checklistContainer } = render(React.createElement(ProcessingChecklist, { workspace, stageDetails }));
    const checklistItems = checklistContainer.querySelectorAll('li');
    // Stage 0 (understanding): complete
    expect(checklistItems[0].getAttribute('data-state')).toBe('complete');
    // Stage 1 (chunking): complete
    expect(checklistItems[1].getAttribute('data-state')).toBe('complete');
    // Stage 2 (analysis): complete
    expect(checklistItems[2].getAttribute('data-state')).toBe('complete');
    // Stage 3 (assembly): in progress (current)
    expect(checklistItems[3].getAttribute('data-state')).toBe('current');

    // Zero dispatch actions made
    expect(dispatchAction).not.toHaveBeenCalled();
    unmount();
  });
});
