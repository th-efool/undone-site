// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { cohortWorkspaceSchema } from '@/src/shared/cohort-builder/contracts';

const fake = vi.hoisted(() => ({ state: null as any, actions: [] as unknown[] }));
vi.mock('@/src/client/interaction/hooks', () => ({
  useWorkspaceView: () => fake.state,
  useDispatchAction: () => async (action: unknown) => { fake.actions.push(action); return true; },
}));

import { CohortWorkspacePane } from '../CohortWorkspacePane';

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
});
