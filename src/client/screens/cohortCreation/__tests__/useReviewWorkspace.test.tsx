// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { readyFixture, readyReview } from './ready.fixture';
import { useReviewWorkspace } from '../hooks/useReviewWorkspace';
import type { useCreation } from '../hooks/useCreation';
import { loadReview, type ReviewResponse } from '../services/reviewApi';
vi.mock('../services/reviewApi', () => ({ loadReview: vi.fn() }));
afterEach(cleanup);
beforeEach(() => vi.mocked(loadReview).mockReset());

function fixture() {
  const snapshot = { ...readyFixture(), stage: 'review' as const, review: { ...readyReview, lessonIds: ['lesson-a', 'lesson-b'] } };
  const response: ReviewResponse = { revision: 0, review: snapshot.review, curriculum: { version: readyReview.buildFingerprint, inputRevision: 1,
    title: { value: 'Title', origin: 'ai', acceptedRevision: 1 }, description: { value: 'Description', origin: 'ai', acceptedRevision: 1 }, seasons: [], warnings: [] }, conversation: { entries: [], nextBefore: null } };
  vi.mocked(loadReview).mockResolvedValue(response);
  const calls: string[] = [];
  const creation = { snapshot, saved: true, editReview: vi.fn(async () => { calls.push('metadata'); return true; }),
    editLesson: vi.fn(async (id: string) => { calls.push(id); return true; }), finalize: vi.fn(async () => true), requestRefinement: vi.fn(async () => true),
    applyRefinement: vi.fn(async () => true), discardRefinement: vi.fn(async () => true), backToMaterials: vi.fn(async () => true) } as unknown as ReturnType<typeof useCreation>;
  return { creation, response, calls };
}
describe('review orchestration', () => {
  it('saves metadata then lessons in order, stopping on failure without losing remaining edits', async () => {
    const { creation, calls } = fixture(); vi.mocked(creation.editLesson).mockImplementation(async id => { calls.push(id); return false; });
    const { result } = renderHook(() => useReviewWorkspace(creation));
    await waitFor(() => expect(result.current.preview).not.toBeNull());
    act(() => { result.current.changeMetadata({ title: 'Local title' }); result.current.changeLesson('lesson-a', { title: 'A', objectives: 'First objective' }); result.current.changeLesson('lesson-b', { title: 'B', objectives: 'Second objective' }); });
    await act(async () => { expect(await result.current.saveAll()).toBe(false); });
    expect(calls).toEqual(['metadata', 'lesson-a']); expect(result.current.metadataDirty).toBe(false);
    expect(Object.keys(result.current.lessonEdits)).toEqual(['lesson-a', 'lesson-b']); expect(result.current.canFinalize).toBe(false);
  });
  it('keeps local lessons across revisions and explicitly exposes unmatched edits', async () => {
    const { creation, response } = fixture(); const { result, rerender } = renderHook(({ value }) => useReviewWorkspace(value), { initialProps: { value: creation } });
    await waitFor(() => expect(result.current.preview).not.toBeNull());
    act(() => result.current.changeLesson('lesson-a', { title: 'Unsent', objectives: 'Local objective' }));
    const next = { ...creation, snapshot: { ...creation.snapshot, revision: 1, review: { ...creation.snapshot.review!, lessonIds: [] } } };
    vi.mocked(loadReview).mockResolvedValue({ ...response, revision: 1 }); rerender({ value: next });
    await waitFor(() => expect(result.current.preview?.revision).toBe(1));
    expect(result.current.unmatchedLocalIds).toEqual(['lesson-a']); expect(result.current.lessonEdits['lesson-a'].title).toBe('Unsent');
    await act(async () => { expect(await result.current.saveAll()).toBe(false); }); expect(creation.editLesson).not.toHaveBeenCalled();
    act(() => result.current.discardLocalLesson('lesson-a')); expect(result.current.dirty).toBe(false);
  });
  it('blocks publication, refinement and back navigation with unsaved edits; validates before sending', async () => {
    const { creation } = fixture(); const { result } = renderHook(() => useReviewWorkspace(creation));
    await waitFor(() => expect(result.current.canFinalize).toBe(true));
    act(() => result.current.changeMetadata({ title: '' }));
    await act(async () => { expect(await result.current.finalize('public_publish')).toBe(false); expect(await result.current.requestRefinement('Change title')).toBe(false); expect(await result.current.back()).toBe(false); expect(await result.current.saveAll()).toBe(false); });
    expect(creation.finalize).not.toHaveBeenCalled(); expect(creation.requestRefinement).not.toHaveBeenCalled(); expect(creation.editReview).not.toHaveBeenCalled();
    expect(result.current.actionError).toContain('Enter a title');
  });
  it('locks duplicate finalization and preserves the explicit publication mode', async () => {
    const { creation } = fixture(); let resolve!: (accepted: boolean) => void;
    vi.mocked(creation.finalize).mockImplementation(() => new Promise(done => { resolve = done; }));
    const { result } = renderHook(() => useReviewWorkspace(creation)); await waitFor(() => expect(result.current.canFinalize).toBe(true));
    let first!: Promise<boolean>;
    await act(async () => { first = result.current.finalize('private_activation'); expect(await result.current.finalize('public_publish')).toBe(false); });
    expect(creation.finalize).toHaveBeenCalledExactlyOnceWith('private_activation');
    await act(async () => { resolve(true); await first; });
  });
  it('hides stale reads, aborts superseded requests and supports explicit retry', async () => {
    const { creation, response } = fixture(); const { result, rerender } = renderHook(({ value }) => useReviewWorkspace(value), { initialProps: { value: creation } });
    await waitFor(() => expect(result.current.preview).not.toBeNull()); const signal = vi.mocked(loadReview).mock.calls[0][1]!;
    rerender({ value: { ...creation, snapshot: { ...creation.snapshot, revision: 2 } } });
    await waitFor(() => expect(result.current.error).toContain('saved review changed'));
    expect(signal.aborted).toBe(true); expect(result.current.preview).toBeNull(); expect(result.current.canFinalize).toBe(false);
    vi.mocked(loadReview).mockResolvedValue({ ...response, revision: 2 }); act(() => result.current.reload());
    await waitFor(() => expect(result.current.canFinalize).toBe(true));
  });
  it('does not apply proposals over local edits or a different edit revision', async () => {
    const { creation } = fixture(); creation.snapshot.review!.proposal = { requestId: crypto.randomUUID(), baseEditRevision: 99, result: { message: 'Suggestion', changes: [{ type: 'title', value: 'Proposed' }] } };
    const { result } = renderHook(() => useReviewWorkspace(creation)); await waitFor(() => expect(result.current.preview).not.toBeNull());
    await act(async () => { expect(await result.current.applyProposal()).toBe(false); }); expect(creation.applyRefinement).not.toHaveBeenCalled();
    expect(result.current.canFinalize).toBe(false);
    await act(async () => { expect(await result.current.discardProposal()).toBe(true); }); expect(creation.discardRefinement).toHaveBeenCalled();
  });
  it('aborts older conversation pagination when the draft revision advances', async () => {
    const { creation, response } = fixture(); const cursor = crypto.randomUUID();
    vi.mocked(loadReview).mockResolvedValue({ ...response, conversation: { entries: [], nextBefore: cursor } });
    const { result, rerender } = renderHook(({ value }) => useReviewWorkspace(value), { initialProps: { value: creation } });
    await waitFor(() => expect(result.current.preview).not.toBeNull());
    let resolve!: (value: ReviewResponse) => void;
    vi.mocked(loadReview).mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    let page!: Promise<void>; act(() => { page = result.current.loadOlder(); });
    const signal = vi.mocked(loadReview).mock.calls[1][1]!;
    vi.mocked(loadReview).mockResolvedValue({ ...response, revision: 1 });
    rerender({ value: { ...creation, snapshot: { ...creation.snapshot, revision: 1 } } });
    await waitFor(() => expect(result.current.preview?.revision).toBe(1)); expect(signal.aborted).toBe(true);
    await act(async () => { resolve({ ...response, conversation: { entries: [], nextBefore: cursor } }); await page; });
    expect(result.current.preview?.conversation.nextBefore).toBeNull();
  });
  it('keeps publication disabled after a read failure until a successful retry', async () => {
    const { creation, response } = fixture(); vi.mocked(loadReview).mockRejectedValueOnce(new Error('Owned content unavailable'));
    const { result } = renderHook(() => useReviewWorkspace(creation)); await waitFor(() => expect(result.current.error).toContain('unavailable'));
    expect(result.current.canFinalize).toBe(false); vi.mocked(loadReview).mockResolvedValue(response);
    act(() => result.current.reload()); await waitFor(() => expect(result.current.canFinalize).toBe(true));
  });
});
