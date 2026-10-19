// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { cohortWorkspaceSchema } from '@/src/shared/cohort-builder/contracts';

vi.mock('@/src/client/interaction/hooks', () => ({
  useDispatchAction: () => async () => true,
}));

import { CurriculumStageView } from '../stages/CurriculumStageView';

const workspace = cohortWorkspaceSchema.parse({
  schemaVersion: 1, title: 'Distributed Systems', intent: 'Learn consensus', audience: 'Engineers', dailyMinutes: 30,
  sources: [{ id: 'source-1', version: 0, label: 'Notes', text: 'Consensus notes', checksum: 'a'.repeat(64), state: 'ready' }],
  chunks: [{ id: 'chunk-1', sourceId: 'source-1', sourceVersion: 0, start: 0, end: 15, text: 'Consensus', checksum: 'b'.repeat(64) }],
  lessons: [{ id: 'lesson-1', version: 0, title: 'Quorum basics', objective: 'Explain quorum intersection', sourceChunkIds: ['chunk-1'], pinned: true }],
  processing: { status: 'ready', stage: 'done', generation: 1, sourceFingerprint: 'c'.repeat(64), error: null },
});

describe('Journey Checkpoint 5: editable final preview', () => {
  afterEach(cleanup);
  const renderPreview = (dispatchAction = vi.fn(async () => true)) => render(<CurriculumStageView workspace={workspace} workspaceId="ws-1" dispatchAction={dispatchAction} onSelectLessonForChat={() => undefined} />);

  it('shows exactly Overview and Questline without final-step source or community administration', () => {
    renderPreview();
    expect(screen.getByRole('button', { name: 'Overview' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Questline' })).toBeTruthy();
    expect(screen.queryByText(/Source material/i)).toBeNull();
    expect(screen.queryByText(/Community/i)).toBeNull();
    expect(screen.queryByText(/About the creator/i)).toBeNull();
  });

  it('saves a title via a display-only presentation action', async () => {
    const dispatchAction = vi.fn(async () => true);
    renderPreview(dispatchAction);
    fireEvent.click(screen.getByRole('button', { name: 'Edit cohort title' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Edit title' }), { target: { value: 'Reliable systems' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(dispatchAction).toHaveBeenCalledWith({ type: 'edit_presentation', title: 'Reliable systems' }, undefined));
  });

  it('edits the pinned lesson title deliberately and opens the real public publish flow', async () => {
    const dispatchAction = vi.fn(async () => true);
    renderPreview(dispatchAction);
    fireEvent.click(screen.getByRole('button', { name: 'Questline' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit lesson 1 title' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Edit lesson' }), { target: { value: 'Quorum reasoning' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(dispatchAction).toHaveBeenCalledWith(expect.objectContaining({ type: 'edit_lesson', lessonId: 'lesson-1', title: 'Quorum reasoning' }), [{ kind: 'lesson', id: 'lesson-1', version: 0 }]));
    fireEvent.click(screen.getByRole('button', { name: /Publish cohort/i }));
    expect(screen.getByRole('dialog', { name: 'Publish cohort' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: /Publish to Directory/i }).getAttribute('aria-checked')).toBe('true');
  });
});
