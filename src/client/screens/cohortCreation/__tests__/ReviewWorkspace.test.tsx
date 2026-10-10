// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { initialSnapshot } from '@/src/shared/cohort-creation/flow';
import { draftId } from '@/src/shared/cohort-creation/__tests__/fixtures';
import { reviewWorkspaceSchema } from '@/src/shared/cohort-creation/review';
import { ReviewWorkspace } from '../components/ReviewWorkspace';
import { loadReview } from '../services/reviewApi';
import type { useCreation } from '../hooks/useCreation';
vi.mock('../services/reviewApi', () => ({ loadReview: vi.fn() }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function fixture() {
  const review = reviewWorkspaceSchema.parse({ title: 'Saved title', description: 'Saved description', buildFingerprint: 'a'.repeat(64), editRevision: 0,
    lessonIds: [], orphanedLessonIds: [], lessonEdits: [], visibility: 'PRIVATE', chatEnabled: false, eventsEnabled: false, proposal: null });
  const snapshot = { ...initialSnapshot(draftId), stage: 'review' as const, review };
  vi.mocked(loadReview).mockResolvedValue({ revision: 0, review, curriculum: { version: review.buildFingerprint, inputRevision: 0,
    title: { value: review.title, origin: 'user', acceptedRevision: 0 }, description: { value: review.description, origin: 'user', acceptedRevision: 0 }, seasons: [], warnings: [] },
    conversation: { entries: [], nextBefore: null } });
  return { snapshot, saved: true, editReview: vi.fn(async () => false), editLesson: vi.fn(async () => false),
    requestRefinement: vi.fn(async () => true), applyRefinement: vi.fn(async () => true), discardRefinement: vi.fn(async () => true),
    discardOrphanedEdits: vi.fn(async () => true), cancel: vi.fn() } as unknown as ReturnType<typeof useCreation>;
}
async function type(input: HTMLInputElement, value: string) {
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true })); });
}
describe('functional review workspace', () => {
  it('keeps unsaved metadata across remote revisions and failed saves', async () => {
    const creation = fixture(); const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
    await act(async () => root.render(<ReviewWorkspace creation={creation} />));
    const title = host.querySelector('input')!; await type(title, 'Unsent local title');
    const changed = { ...creation, snapshot: { ...creation.snapshot, revision: 2, review: { ...creation.snapshot.review!, title: 'Other tab title', editRevision: 1 } } };
    await act(async () => root.render(<ReviewWorkspace creation={changed} />));
    expect(title.value).toBe('Unsent local title');
    await act(async () => host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    expect(creation.editReview).toHaveBeenCalledWith(expect.objectContaining({ title: 'Unsent local title', visibility: 'PRIVATE' }));
    expect(title.value).toBe('Unsent local title'); expect(host.textContent).toContain('Unsaved edits');
    await act(async () => root.unmount()); host.remove();
  });
  it('shows bounded suggestions without applying them and requires explicit apply/discard', async () => {
    const creation = fixture(); const requestId = crypto.randomUUID(); creation.snapshot.review!.proposal = { requestId, baseEditRevision: 0,
      result: { message: 'Suggested copy change.', changes: [{ type: 'title', value: 'Proposed title' }] } };
    const host = document.createElement('div'); const root = createRoot(host);
    await act(async () => root.render(<ReviewWorkspace creation={creation} />));
    expect(host.textContent).toContain('Proposed title'); expect(host.querySelector('input')!.value).toBe('Saved title');
    expect(creation.applyRefinement).not.toHaveBeenCalled();
    await act(async () => Array.from(host.querySelectorAll('button')).find(button => button.textContent === 'Apply proposal')!.click());
    expect(creation.applyRefinement).toHaveBeenCalledWith(requestId);
    await act(async () => root.unmount());
  });
});
