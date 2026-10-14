// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { cohortWorkspaceSchema } from '@/src/shared/cohort-builder/contracts';

const fake = vi.hoisted(() => ({ state: null as any, actions: [] as unknown[], succeeds: true }));
vi.mock('@/src/client/interaction/hooks', () => ({
  useWorkspaceView: () => fake.state,
  useDispatchAction: () => async (action: unknown) => { fake.actions.push(action); return fake.succeeds; },
}));

import { CohortWorkspacePane } from '../CohortWorkspacePane';
afterEach(() => { cleanup(); fake.succeeds = true; });

describe('grounded cohort workspace UI', () => {
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
});
