// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { cohortWorkspaceSchema } from '@/src/shared/cohort-builder/contracts';

vi.mock('@/src/client/interaction/hooks', () => ({ useDispatchAction: () => async () => true }));
import { CurriculumStageView } from '../stages/CurriculumStageView';

const workspace = cohortWorkspaceSchema.parse({
  schemaVersion: 1, title: 'Draft cohort', intent: 'Learn systems', audience: 'Engineers', dailyMinutes: 20,
  sources: [], lessons: [{ id: 'lesson-1', version: 0, title: 'Systems basics', objective: 'Understand systems', sourceChunkIds: [], pinned: false }],
  processing: { status: 'ready', stage: 'done', generation: 1, sourceFingerprint: 'a'.repeat(64), error: null },
});

describe('final preview edit preservation', () => {
  afterEach(cleanup);
  it('retains unsaved writing when the creator changes preview tabs', () => {
    render(<CurriculumStageView workspace={workspace} dispatchAction={async () => true} onSelectLessonForChat={() => undefined} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Edit cohort description' })[0]);
    const editor = screen.getByRole('textbox', { name: 'Edit description' });
    fireEvent.change(editor, { target: { value: 'My unsaved public copy' } });
    fireEvent.click(screen.getByRole('button', { name: 'Questline' }));
    expect((screen.getByRole('textbox', { name: 'Edit description' }) as HTMLTextAreaElement).value).toBe('My unsaved public copy');
  });

  it('keeps an edit open after a failed save so the creator can retry', async () => {
    const dispatchAction = vi.fn(async () => false);
    render(<CurriculumStageView workspace={workspace} dispatchAction={dispatchAction} onSelectLessonForChat={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit cohort title' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Edit title' }), { target: { value: 'A durable title' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect((screen.getByRole('textbox', { name: 'Edit title' }) as HTMLTextAreaElement).value).toBe('A durable title');
  });

  it('cancels without dispatching an edit', () => {
    const dispatchAction = vi.fn(async () => true);
    render(<CurriculumStageView workspace={workspace} dispatchAction={dispatchAction} onSelectLessonForChat={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit cohort title' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Edit title' }), { target: { value: 'Discarded title' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel edit' }));
    expect(dispatchAction).not.toHaveBeenCalled();
  });
});
