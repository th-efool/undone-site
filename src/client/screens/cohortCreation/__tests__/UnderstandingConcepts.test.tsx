// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { initialSnapshot } from '@/src/shared/cohort-creation/flow';
import { draftId } from '@/src/shared/cohort-creation/__tests__/fixtures';
import type { UnderstandingPreview } from '@/src/shared/cohort-creation/processing';
import { loadUnderstandingPreview } from '../services/understandingApi';
import { UnderstandingConcepts } from '../components/UnderstandingConcepts';
vi.mock('../services/understandingApi', () => ({ loadUnderstandingPreview: vi.fn() }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
function state(revision: number) {
  return { ...initialSnapshot(draftId), revision, processing: { requestId: draftId, inputRevision: 0, complete: false, phase: 'understanding' as const,
    building: null, analysis: null, chunking: null, checkpoint: { phase: 'understanding' as const, requestId: draftId, inputRevision: 0,
      inputFingerprint: 'a'.repeat(64), total: 1, partitionIds: ['b'.repeat(64)], completed: [{ partitionId: 'b'.repeat(64), artifact: {
        id: draftId, kind: 'artifact' as const, byteLength: 500, checksum: 'c'.repeat(64) } }] } } };
}
const preview = (revision: number, label: string): UnderstandingPreview => ({ revision, partitions: [{ partitionId: 'b'.repeat(64), materialId: draftId,
  unitId: draftId, proposal: { summary: 'Retained summary', concepts: [{ label, summary: 'Grounded explanation', segmentIds: ['retained'] }], limitations: [] } }] });
describe('accepted concept preview', () => {
  it('never shows older concepts against a newer draft revision', async () => {
    vi.mocked(loadUnderstandingPreview).mockResolvedValueOnce(preview(1, 'Old concept'));
    let finish!: (value: UnderstandingPreview) => void;
    vi.mocked(loadUnderstandingPreview).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const view = render(<UnderstandingConcepts snapshot={state(1)} />); await screen.findByText('Old concept');
    view.rerender(<UnderstandingConcepts snapshot={state(2)} />);
    expect(screen.queryByText('Old concept')).toBeNull(); expect(screen.getByText('Loading accepted concepts…')).toBeTruthy();
    await act(async () => finish(preview(2, 'New concept'))); expect(screen.getByText('New concept')).toBeTruthy();
  });
  it('shows retry on read failure and aborts an in-flight preview when leaving', async () => {
    vi.mocked(loadUnderstandingPreview).mockRejectedValueOnce(new Error('Saved concepts unavailable'));
    const view = render(<UnderstandingConcepts snapshot={state(1)} />); await screen.findByRole('alert');
    expect(screen.getByRole('button', { name: 'Reload concepts' })).toBeTruthy();
    await waitFor(() => expect(loadUnderstandingPreview).toHaveBeenCalledOnce());
    const signal = vi.mocked(loadUnderstandingPreview).mock.calls[0][1]; view.unmount(); expect(signal.aborted).toBe(true);
  });
});
