// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { cohortWorkspaceSchema } from '@/src/shared/cohort-builder/contracts';
import { initialCohort } from '@/src/shared/cohort-builder/intake';

const fake = vi.hoisted(() => ({ state: null as any, actions: [] as unknown[], succeeds: true }));
vi.mock('next-auth/react',()=>({useSession:()=>({data:{user:{id:'owner'}}})}));
vi.mock('@/src/client/interaction/hooks', () => ({
  useInteractionState:()=>({workspaceId:'workspace',revision:0,view:fake.state}),
  useWorkspaceView: () => fake.state,
  useDispatchAction: () => async (action: unknown) => { fake.actions.push(action); return fake.succeeds; },
}));

import { CohortWorkspacePane, getProcessingProgress } from '../CohortWorkspacePane';
afterEach(() => { cleanup(); fake.succeeds = true; });

describe('grounded cohort workspace UI', () => {
  it('requires deliberate overview conflict recovery and preserves untouched remote fields', async () => {
    fake.actions = [];
    fake.state = cohortWorkspaceSchema.parse({ schemaVersion: 1, title: 'Test', intent: 'Old goal', audience: 'Original', dailyMinutes: 20, lessons: [] });
    const result = render(<CohortWorkspacePane onSelectLessonForChat={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: /Edit details/ }));
    fireEvent.change(screen.getByRole('dialog').querySelector('textarea')!, { target: { value: 'My changed goal' } });
    fake.state = { ...fake.state, audience: 'Remote audience' };
    result.rerender(<CohortWorkspacePane onSelectLessonForChat={() => undefined} />);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Save changes' })));
    expect(fake.actions).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Keep my overview edits against current values' }));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Save changes' })));
    expect(fake.actions).toEqual([{ type: 'set_intent', intent: 'My changed goal' }]);
  });
  it('sends pasted text through the canonical action and shows retained evidence', async () => {
    fake.actions = [];
    fake.state = cohortWorkspaceSchema.parse({
      schemaVersion: 1, title: 'Systems', intent: 'Learn consensus', audience: 'Engineers', dailyMinutes: 25,
      sources: [{ id: 'source-1', version: 0, label: 'Notes', text: 'Quorums overlap.', checksum: 'a'.repeat(64), state: 'ready' }],
      chunks: [{ id: 'source-1:v0:0', sourceId: 'source-1', sourceVersion: 0, start: 0, end: 16, text: 'Quorums overlap.', checksum: 'b'.repeat(64) }],
      lessons: [{ id: 'lesson-1', version: 0, title: 'Quorums', objective: 'Understand overlap', sourceChunkIds: ['source-1:v0:0'], pinned: false }],
      processing: { status: 'ready', stage: 'done', generation: 1, sourceFingerprint: 'fingerprint', error: null },
    });
    render(<CohortWorkspacePane onSelectLessonForChat={() => undefined} />);
    expect(screen.getByText(/Grounded in/).textContent).toContain('Quorums overlap.');
    const title = screen.getByPlaceholderText('e.g. Distributed systems notes');
    const body = screen.getByLabelText('Paste text to retain and ground this curriculum');
    fireEvent.change(title, { target: { value: 'Another note' } });
    fireEvent.change(body, { target: { value: 'Leaders replicate logs.' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Add text source' })); });
    expect(fake.actions).toContainEqual({ type: 'add_text_source', label: 'Another note', text: 'Leaders replicate logs.' });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Edit' })); });
    expect((title as HTMLInputElement).value).toBe('Notes');
    fireEvent.change(body, { target: { value: 'Quorums overlap in every majority.' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save source changes' })); });
    expect(fake.actions).toContainEqual({ type: 'edit_text_source', sourceId: 'source-1', label: 'Notes', text: 'Quorums overlap in every majority.' });
  });

  it('shows orphaned evidence and an actual failed stage with retry', async () => {
    fake.actions = [];
    fake.state = cohortWorkspaceSchema.parse({
      schemaVersion: 1, title: 'Systems', intent: 'Learn consensus', audience: 'Engineers', dailyMinutes: 25,
      sources: [{ id: 'source-1', version: 1, label: 'Notes', text: 'New text.', checksum: null, state: 'queued' }],
      lessons: [{ id: 'lesson-1', version: 1, title: 'Manual interpretation', objective: 'Retained edit', sourceChunkIds: ['source-1:v0:0'], pinned: true, evidenceStatus: 'orphaned' }],
      processing: { status: 'failed', stage: 'chunking', generation: 2, sourceFingerprint: null, error: 'TOO_MANY_CHUNKS' },
    });
    render(<CohortWorkspacePane onSelectLessonForChat={() => undefined} />);
    expect(screen.getByText('TOO_MANY_CHUNKS')).toBeTruthy();
    expect(screen.getByText(/references changed or removed source text/)).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Retry processing' })); });
    expect(fake.actions).toContainEqual({ type: 'retry_processing' });
  });

  it('retries only the failed job and shows a terminal attempt ceiling', async () => {
    fake.actions = [];
    fake.state = cohortWorkspaceSchema.parse({ schemaVersion: 1, title: 'Systems', intent: 'Learn', audience: '', dailyMinutes: 20,
      sources: [{ id: 's', version: 0, label: 'Notes', text: 'Retained.', checksum: null, state: 'queued' }], lessons: [],
      processing: { status: 'failed', stage: 'analysis', generation: 1, sourceFingerprint: null, error: 'PROCESSOR_FAILURE', jobs: [
        { id: 'retry', sourceId: 's', stage: 'analysis', status: 'failed', attempts: 1, error: 'PROCESSOR_FAILURE', retryable: true },
        { id: 'terminal', sourceId: null, stage: 'assembly', status: 'failed', attempts: 3, error: 'RETRY_EXHAUSTED', retryable: false },
      ] },
    });
    render(<CohortWorkspacePane onSelectLessonForChat={() => undefined} />);
    expect(screen.getByText(/Retry limit reached/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Retry processing' })).toBeNull();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Retry analysis' })));
    expect(fake.actions).toEqual([{ type: 'retry_text_job', jobId: 'retry' }]);
  });
  it('keeps an unsaved lesson objective open after a conflict', async () => {
    fake.state = cohortWorkspaceSchema.parse({ schemaVersion: 1, title: 'Systems', intent: 'Learn', audience: '', dailyMinutes: 20,
      lessons: [{ id: 'lesson', version: 1, title: 'Pinned lesson', objective: 'Original', sourceChunkIds: [], pinned: true }] });
    fake.actions = []; fake.succeeds = false;
    render(<CohortWorkspacePane onSelectLessonForChat={() => undefined} />);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Edit lesson' })));
    const objective = screen.getByDisplayValue('Original');
    fireEvent.change(objective, { target: { value: 'Unsaved objective' } });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Update Lesson' })));
    expect(screen.getByDisplayValue('Unsaved objective')).toBeTruthy();
    expect(fake.actions).toEqual([{ type: 'edit_lesson', lessonId: 'lesson', objective: 'Unsaved objective' }]);
  });
  it('renders YouTube transcript timestamp range in evidence citations', async () => {
    fake.actions = [];
    fake.state = cohortWorkspaceSchema.parse({
      schemaVersion: 1, title: 'Systems', intent: 'Learn consensus', audience: 'Engineers', dailyMinutes: 25,
      sources: [{
        id: 'yt-source', version: 0, label: 'Consensus Talk', text: 'Quorums overlap and provide consensus.',
        checksum: 'a'.repeat(64), state: 'ready',
        input: { kind: 'youtube', url: 'https://www.youtube.com/watch?v=s4cVideo123', track: { id: 'en', language: 'en', kind: 'manual', translated: false } },
        locations: [{ start: 0, end: 38, startMs: 65_000, endMs: 125_000, segmentId: 'seg-1' }],
        provenance: { parserVersion: 'youtube-transcript-v1', rawChecksum: 'b'.repeat(64), scope: 'transcript_only' },
      }],
      chunks: [{ id: 'chunk-yt-1', sourceId: 'yt-source', sourceVersion: 0, start: 0, end: 38, text: 'Quorums overlap and provide consensus.', checksum: 'c'.repeat(64) }],
      lessons: [{ id: 'lesson-1', version: 0, title: 'Quorum Overlap', objective: 'Understand overlap', sourceChunkIds: ['chunk-yt-1'], pinned: false }],
      processing: { status: 'ready', stage: 'done', generation: 1, sourceFingerprint: 'fp', error: null },
    });
    render(<CohortWorkspacePane onSelectLessonForChat={() => undefined} />);
    expect(screen.getByText('Inspect evidence')).toBeDefined();
    expect(screen.getByText(/timestamp 01:05–02:05/)).toBeDefined();
  });
  it('renders GitHub file and line citations in evidence citations', async () => {
    fake.actions = [];
    fake.state = cohortWorkspaceSchema.parse({
      schemaVersion: 1, title: 'Systems', intent: 'Learn consensus', audience: 'Engineers', dailyMinutes: 25,
      sources: [{
        id: 'gh-source', version: 0, label: 'Consensus Repo', text: 'Quorums overlap and provide consensus.',
        checksum: 'a'.repeat(64), state: 'ready',
        input: { kind: 'github', repoUrl: 'https://github.com/sidequesthq/undone', ref: 'main', paths: ['src/consensus.ts'] },
        locations: [{ start: 0, end: 38, filePath: 'src/consensus.ts', startLine: 10, endLine: 25 }],
        provenance: {
          parserVersion: 'github-source-v1',
          rawChecksum: 'b'.repeat(64),
          scope: 'selected_files',
          repoUrl: 'https://github.com/sidequesthq/undone',
          ref: 'main',
          commitSha: 'c'.repeat(40),
          fileCount: 1,
        },
      }],
      chunks: [{ id: 'chunk-gh-1', sourceId: 'gh-source', sourceVersion: 0, start: 0, end: 38, text: 'Quorums overlap and provide consensus.', checksum: 'd'.repeat(64) }],
      lessons: [{ id: 'lesson-1', version: 0, title: 'Quorum Overlap', objective: 'Understand overlap', sourceChunkIds: ['chunk-gh-1'], pinned: false }],
      processing: { status: 'ready', stage: 'done', generation: 1, sourceFingerprint: 'fp', error: null },
    });
    render(<CohortWorkspacePane onSelectLessonForChat={() => undefined} />);
    expect(screen.getByText('Inspect evidence')).toBeDefined();
    expect(screen.getByText(/src\/consensus\.ts#L10-L25/)).toBeDefined();
    expect(screen.getByText(/https:\/\/github\.com\/sidequesthq\/undone@ccccccc/)).toBeDefined();
  });

  it('initial empty workspace shows no completed steps and no false progress checkmarks', () => {
    fake.state = initialCohort('my goal');
    const progress = getProcessingProgress(fake.state);
    expect(progress.currentStepIndex).toBe(-1);
    expect(progress.steps.every(s => !s.isComplete)).toBe(true);

    render(<CohortWorkspacePane onSelectLessonForChat={() => undefined} />);
    const checkmarks = screen.queryAllByLabelText('Complete');
    expect(checkmarks).toHaveLength(0);

    const stepsList = screen.getByRole('list', { name: 'Creation journey progress' });
    const items = stepsList.querySelectorAll('li');
    expect(items).toHaveLength(4);
    items.forEach(li => {
      expect(li.getAttribute('data-complete')).toBe('false');
      expect(li.getAttribute('aria-current')).toBeNull();
    });
    expect(screen.getByText('1')).toBeDefined();
    expect(screen.getByText('2')).toBeDefined();
    expect(screen.getByText('3')).toBeDefined();
    expect(screen.getByText('4')).toBeDefined();
  });

  it('workspace with running stage (stage: chunking, status: running) marks only Understanding as complete and Chunking as active', () => {
    fake.state = {
      schemaVersion: 1,
      title: 'Systems',
      intent: 'Learn consensus',
      audience: 'Engineers',
      dailyMinutes: 25,
      sources: [{ id: 'source-1', version: 0, label: 'Notes', text: 'Quorums overlap.', checksum: 'a'.repeat(64), state: 'processing' }],
      chunks: [],
      understanding: [],
      analyses: [],
      lessons: [],
      processing: { status: 'processing', stage: 'chunking', generation: 1, sourceFingerprint: null, error: null },
    };
    const progress = getProcessingProgress(fake.state);
    expect(progress.currentStepIndex).toBe(1);
    expect(progress.steps[0].isComplete).toBe(true);
    expect(progress.steps[1].isCurrent).toBe(true);
    expect(progress.steps[1].isComplete).toBe(false);
    expect(progress.steps[2].isComplete).toBe(false);
    expect(progress.steps[3].isComplete).toBe(false);

    render(<CohortWorkspacePane onSelectLessonForChat={() => undefined} />);
    const checkmarks = screen.getAllByLabelText('Complete');
    expect(checkmarks).toHaveLength(1);

    const stepsList = screen.getByRole('list', { name: 'Creation journey progress' });
    const items = stepsList.querySelectorAll('li');
    // Step 0: Understanding - complete
    expect(items[0].getAttribute('data-complete')).toBe('true');
    expect(items[0].getAttribute('aria-current')).toBeNull();
    // Step 1: Chunking - active
    expect(items[1].getAttribute('aria-current')).toBe('step');
    expect(items[1].getAttribute('data-complete')).toBe('false');
    // Steps 2 & 3: Analyzing & Building - pending
    expect(items[2].getAttribute('data-complete')).toBe('false');
    expect(items[2].getAttribute('aria-current')).toBeNull();
    expect(items[3].getAttribute('data-complete')).toBe('false');
    expect(items[3].getAttribute('aria-current')).toBeNull();
  });

  it('fully ready workspace with ready sources marks all 4 steps complete', () => {
    fake.state = cohortWorkspaceSchema.parse({
      schemaVersion: 1,
      title: 'Systems',
      intent: 'Learn consensus',
      audience: 'Engineers',
      dailyMinutes: 25,
      sources: [{ id: 'source-1', version: 0, label: 'Notes', text: 'Quorums overlap.', checksum: 'a'.repeat(64), state: 'ready' }],
      chunks: [{ id: 'source-1:v0:0', sourceId: 'source-1', sourceVersion: 0, start: 0, end: 16, text: 'Quorums overlap.', checksum: 'b'.repeat(64) }],
      lessons: [{ id: 'lesson-1', version: 0, title: 'Quorums', objective: 'Understand overlap', sourceChunkIds: ['source-1:v0:0'], pinned: false }],
      processing: { status: 'ready', stage: 'done', generation: 1, sourceFingerprint: 'fingerprint', error: null },
    });
    const progress = getProcessingProgress(fake.state);
    expect(progress.steps.every(s => s.isComplete)).toBe(true);

    render(<CohortWorkspacePane onSelectLessonForChat={() => undefined} />);
    const checkmarks = screen.getAllByLabelText('Complete');
    expect(checkmarks).toHaveLength(4);

    const stepsList = screen.getByRole('list', { name: 'Creation journey progress' });
    const items = stepsList.querySelectorAll('li');
    items.forEach(li => {
      expect(li.getAttribute('data-complete')).toBe('true');
    });
  });

  it('source edit after prior assembly (source state pending, processing status idle) does NOT show all steps complete', () => {
    fake.state = {
      schemaVersion: 1,
      title: 'Systems',
      intent: 'Learn consensus',
      audience: 'Engineers',
      dailyMinutes: 25,
      sources: [{ id: 'source-1', version: 1, label: 'Notes edited', text: 'Quorums overlap and more.', checksum: null, state: 'pending' as any }],
      chunks: [],
      understanding: [],
      analyses: [],
      lessons: [{ id: 'lesson-1', version: 0, title: 'Quorums', objective: 'Understand overlap', sourceChunkIds: [], pinned: false }],
      processing: { status: 'idle', stage: 'done', generation: 1, sourceFingerprint: 'old-fingerprint', error: null },
    };
    const progress = getProcessingProgress(fake.state);
    expect(progress.steps.every(s => s.isComplete)).toBe(false);
    expect(progress.needsRebuild).toBe(true);

    render(<CohortWorkspacePane onSelectLessonForChat={() => undefined} />);
    const checkmarks = screen.queryAllByLabelText('Complete');
    expect(checkmarks.length).toBe(0);

    const stepsList = screen.getByRole('list', { name: 'Creation journey progress' });
    const items = stepsList.querySelectorAll('li');
    items.forEach(li => {
      expect(li.getAttribute('data-complete')).toBe('false');
    });
    expect(screen.getByText(/rebuild needed/)).toBeDefined();
  });

  it('failed processing does not show subsequent steps complete', () => {
    fake.state = cohortWorkspaceSchema.parse({
      schemaVersion: 1,
      title: 'Systems',
      intent: 'Learn consensus',
      audience: 'Engineers',
      dailyMinutes: 25,
      sources: [{ id: 'source-1', version: 0, label: 'Notes', text: 'Quorums overlap.', checksum: 'a'.repeat(64), state: 'ready' }],
      lessons: [],
      processing: { status: 'failed', stage: 'analysis', generation: 1, sourceFingerprint: null, error: 'ANALYSIS_FAILED' },
    });
    const progress = getProcessingProgress(fake.state);
    expect(progress.steps[0].isComplete).toBe(true); // Understanding
    expect(progress.steps[1].isComplete).toBe(true); // Chunking
    expect(progress.steps[2].isFailed).toBe(true);   // Analyzing failed
    expect(progress.steps[2].isComplete).toBe(false);
    expect(progress.steps[3].isComplete).toBe(false); // Building pending (NEVER complete!)

    render(<CohortWorkspacePane onSelectLessonForChat={() => undefined} />);
    const stepsList = screen.getByRole('list', { name: 'Creation journey progress' });
    const items = stepsList.querySelectorAll('li');
    expect(items[0].getAttribute('data-complete')).toBe('true');
    expect(items[1].getAttribute('data-complete')).toBe('true');
    expect(items[2].getAttribute('data-complete')).toBe('false');
    expect(items[2].getAttribute('data-failed')).toBe('true');
    expect(items[3].getAttribute('data-complete')).toBe('false');
    expect(items[3].getAttribute('data-failed')).toBeNull();
    expect(screen.getByLabelText('Failed')).toBeDefined();
  });

  it('multi-source mixed-rate progress: does not infer global stage completion from one advanced source', () => {
    // Source A is at analysis, but Source B is still running understanding
    fake.state = cohortWorkspaceSchema.parse({
      schemaVersion: 1,
      title: 'Distributed Systems',
      intent: 'Learn consensus and replication',
      audience: 'Engineers',
      dailyMinutes: 25,
      sources: [
        { id: 'source-a', version: 0, label: 'Consensus paper', text: 'Quorums overlap.', checksum: 'a'.repeat(64), state: 'processing' },
        { id: 'source-b', version: 0, label: 'Replication notes', text: 'Leaders replicate logs.', checksum: 'b'.repeat(64), state: 'processing' },
      ],
      lessons: [],
      processing: {
        status: 'queued',
        stage: 'understanding',
        generation: 1,
        sourceFingerprint: 'multi-fingerprint',
        error: null,
        jobs: [
          // Source A completed understanding & chunking, and is queued for analysis
          { id: 'job-a-u', sourceId: 'source-a', stage: 'understanding', status: 'accepted', attempts: 1, error: null, retryable: false },
          { id: 'job-a-c', sourceId: 'source-a', stage: 'chunking', status: 'accepted', attempts: 1, error: null, retryable: false },
          { id: 'job-a-a', sourceId: 'source-a', stage: 'analysis', status: 'queued', attempts: 0, error: null, retryable: false },
          // Source B is only running understanding
          { id: 'job-b-u', sourceId: 'source-b', stage: 'understanding', status: 'running', attempts: 1, error: null, retryable: false },
          { id: 'job-b-c', sourceId: 'source-b', stage: 'chunking', status: 'queued', attempts: 0, error: null, retryable: false },
          { id: 'job-b-a', sourceId: 'source-b', stage: 'analysis', status: 'queued', attempts: 0, error: null, retryable: false },
        ],
      },
    });

    const progress = getProcessingProgress(fake.state);
    // Global understanding is NOT complete because Source B has not finished understanding!
    expect(progress.steps[0].isComplete).toBe(false);
    expect(progress.steps[0].isCurrent).toBe(true);
    // Steps 1, 2, 3 must NOT be complete
    expect(progress.steps[1].isComplete).toBe(false);
    expect(progress.steps[2].isComplete).toBe(false);
    expect(progress.steps[3].isComplete).toBe(false);
    expect(progress.currentStepIndex).toBe(0);
  });

  it('multi-source partial failure: marks only failing stage and never marks subsequent stages complete', () => {
    // Both sources completed understanding. Source A failed chunking, while Source B accepted chunking and is analyzing
    fake.state = cohortWorkspaceSchema.parse({
      schemaVersion: 1,
      title: 'Systems',
      intent: 'Learn',
      audience: 'Engineers',
      dailyMinutes: 20,
      sources: [
        { id: 'source-a', version: 0, label: 'Doc A', text: 'Text A', checksum: 'a'.repeat(64), state: 'failed' },
        { id: 'source-b', version: 0, label: 'Doc B', text: 'Text B', checksum: 'b'.repeat(64), state: 'processing' },
      ],
      lessons: [],
      processing: {
        status: 'failed',
        stage: 'chunking',
        generation: 1,
        sourceFingerprint: 'fprint',
        error: 'CHUNKING_FAILED',
        jobs: [
          { id: 'job-a-u', sourceId: 'source-a', stage: 'understanding', status: 'accepted', attempts: 1, error: null, retryable: false },
          { id: 'job-a-c', sourceId: 'source-a', stage: 'chunking', status: 'failed', attempts: 1, error: 'CHUNKING_FAILED', retryable: true },
          { id: 'job-b-u', sourceId: 'source-b', stage: 'understanding', status: 'accepted', attempts: 1, error: null, retryable: false },
          { id: 'job-b-c', sourceId: 'source-b', stage: 'chunking', status: 'accepted', attempts: 1, error: null, retryable: false },
          { id: 'job-b-a', sourceId: 'source-b', stage: 'analysis', status: 'running', attempts: 1, error: null, retryable: false },
        ],
      },
    });

    const progress = getProcessingProgress(fake.state);
    expect(progress.steps[0].isComplete).toBe(true);  // Understanding complete for both
    expect(progress.steps[1].isFailed).toBe(true);    // Chunking failed for Source A
    expect(progress.steps[1].isComplete).toBe(false);
    expect(progress.steps[2].isComplete).toBe(false);  // Analyzing is NOT complete
    expect(progress.steps[3].isComplete).toBe(false);  // Building is NOT complete
    expect(progress.needsRebuild).toBe(true);
  });

  it('server cancellation (status: idle, error: PROCESSING_CANCELED): retains accepted stages without false completion of in-flight work', () => {
    fake.state = cohortWorkspaceSchema.parse({
      schemaVersion: 1,
      title: 'Canceled Workspace',
      intent: 'Learn',
      audience: 'Engineers',
      dailyMinutes: 20,
      sources: [
        { id: 'source-1', version: 0, label: 'Doc', text: 'Content', checksum: 'a'.repeat(64), state: 'stale' },
      ],
      lessons: [],
      processing: {
        status: 'idle',
        stage: 'chunking',
        generation: 1,
        sourceFingerprint: 'fprint',
        error: 'PROCESSING_CANCELED',
        jobs: [
          { id: 'job-1', sourceId: 'source-1', stage: 'understanding', status: 'accepted', attempts: 1, error: null, retryable: false },
          { id: 'job-2', sourceId: 'source-1', stage: 'chunking', status: 'canceled', attempts: 1, error: null, retryable: false },
        ],
      },
    });

    const progress = getProcessingProgress(fake.state);
    expect(progress.steps[0].isComplete).toBe(true);   // Understanding was accepted prior to cancel
    expect(progress.steps[1].isComplete).toBe(false);  // Chunking was canceled
    expect(progress.steps[1].isCurrent).toBe(false);
    expect(progress.steps[2].isComplete).toBe(false);
    expect(progress.steps[3].isComplete).toBe(false);
    expect(progress.currentStepIndex).toBe(-1);
    expect(progress.needsRebuild).toBe(true);
  });

  it('targeted retry: retrying failed job restores active state and preserves prerequisites', () => {
    // When job-a-c is retried, its status updates from failed to running
    fake.state = cohortWorkspaceSchema.parse({
      schemaVersion: 1,
      title: 'Retrying Workspace',
      intent: 'Learn',
      audience: 'Engineers',
      dailyMinutes: 20,
      sources: [
        { id: 'source-a', version: 0, label: 'Doc A', text: 'Text A', checksum: 'a'.repeat(64), state: 'processing' },
      ],
      lessons: [],
      processing: {
        status: 'queued',
        stage: 'chunking',
        generation: 1,
        sourceFingerprint: 'fprint',
        error: null,
        jobs: [
          { id: 'job-a-u', sourceId: 'source-a', stage: 'understanding', status: 'accepted', attempts: 1, error: null, retryable: false },
          { id: 'job-a-c', sourceId: 'source-a', stage: 'chunking', status: 'running', attempts: 2, error: null, retryable: true },
        ],
      },
    });

    const progress = getProcessingProgress(fake.state);
    expect(progress.steps[0].isComplete).toBe(true);   // Understanding remains complete
    expect(progress.steps[1].isComplete).toBe(false);
    expect(progress.steps[1].isFailed).toBe(false);    // No longer failed
    expect(progress.steps[1].isCurrent).toBe(true);    // Chunking is now actively retrying
    expect(progress.currentStepIndex).toBe(1);
  });

  it('manual lessons do not fabricate progress during incomplete processing', () => {
    fake.state = cohortWorkspaceSchema.parse({
      schemaVersion: 1,
      title: 'Manual Lessons Workspace',
      intent: 'Learn',
      audience: 'Engineers',
      dailyMinutes: 20,
      sources: [
        { id: 'source-1', version: 0, label: 'Doc 1', text: 'Text', checksum: 'a'.repeat(64), state: 'processing' },
      ],
      lessons: [
        { id: 'manual-1', version: 1, title: 'Manual lesson', objective: 'Objective', sourceChunkIds: [], pinned: true, manualOverride: true },
        { id: 'manual-2', version: 1, title: 'Another manual lesson', objective: 'Objective 2', sourceChunkIds: [], pinned: true, manualOverride: true },
      ],
      processing: {
        status: 'queued',
        stage: 'understanding',
        generation: 1,
        sourceFingerprint: 'fprint',
        error: null,
        jobs: [
          { id: 'job-u', sourceId: 'source-1', stage: 'understanding', status: 'running', attempts: 1, error: null, retryable: false },
        ],
      },
    });

    const progress = getProcessingProgress(fake.state);
    expect(progress.steps.every(s => s.isComplete)).toBe(false);
    expect(progress.steps[0].isCurrent).toBe(true);
    expect(progress.steps[3].isComplete).toBe(false); // Building is NOT complete just because lessons exist!
  });

  it('supports stepper inspection via click and keyboard (Enter/Space), toggling views and returning to active stage without dispatching actions', async () => {
    fake.actions = [];
    fake.state = cohortWorkspaceSchema.parse({
      schemaVersion: 1,
      title: 'Active Curriculum Workspace',
      intent: 'Learn testing',
      audience: 'Engineers',
      dailyMinutes: 20,
      sources: [
        { id: 'source-1', version: 0, label: 'Doc 1', text: 'Quorums overlap and replicate logs.', checksum: 'a'.repeat(64), state: 'ready' },
      ],
      chunks: [
        { id: 'c-1', sourceId: 'source-1', sourceVersion: 0, start: 0, end: 15, text: 'Quorums overlap', checksum: 'b'.repeat(64) },
      ],
      understanding: [
        { sourceId: 'source-1', sourceVersion: 0, topics: ['Consensus', 'Quorum'] },
      ],
      lessons: [
        { id: 'lesson-1', version: 0, title: 'Consensus Basics', objective: 'Objective', sourceChunkIds: ['c-1'], pinned: false },
      ],
      processing: {
        status: 'ready',
        stage: 'done',
        generation: 1,
        sourceFingerprint: 'fprint',
        error: null,
      },
    });

    render(<CohortWorkspacePane onSelectLessonForChat={() => undefined} />);

    // Initially in curriculum stage
    expect(screen.getByText('Learning Blueprint')).toBeDefined();
    expect(screen.queryByTestId('stage-inspection-banner')).toBeNull();

    // Find stepper items
    const steps = screen.getByLabelText('Creation journey progress').querySelectorAll('li');
    expect(steps.length).toBe(4);

    // 1. Click Understanding step (step 0)
    fireEvent.click(steps[0]);
    expect(screen.getByTestId('stage-inspection-banner')).toBeDefined();
    expect(screen.getByText(/Inspecting/i).textContent).toContain('understanding');
    // Understanding stage should be rendered
    expect(screen.getByLabelText('Accepted concepts')).toBeDefined();
    expect(fake.actions).toEqual([]);

    // 2. Use keyboard 'Enter' on Chunking step (step 1)
    fireEvent.keyDown(steps[1], { key: 'Enter' });
    expect(screen.getByText(/Inspecting/i).textContent).toContain('chunking');
    expect(screen.getByLabelText('Chunking material')).toBeDefined();
    expect(fake.actions).toEqual([]);

    // 3. Use keyboard ' ' (Space) on Analyzing step (step 2)
    fireEvent.keyDown(steps[2], { key: ' ' });
    expect(screen.getByText(/Inspecting/i).textContent).toContain('analysis');
    expect(screen.getByLabelText('Analysis workspace')).toBeDefined();
    expect(fake.actions).toEqual([]);

    // 4. Click 'Return to active stage' button in banner
    fireEvent.click(screen.getByRole('button', { name: 'Reset to active stage' }));
    expect(screen.queryByTestId('stage-inspection-banner')).toBeNull();
    expect(screen.getByText('Learning Blueprint')).toBeDefined();
    expect(fake.actions).toEqual([]);
  });
});

