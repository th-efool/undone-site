// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { readyFixture, readyReview } from './ready.fixture';
import { draftId } from '@/src/shared/cohort-creation/__tests__/fixtures';
import type { useCreation } from '../hooks/useCreation';
import { PublicationStatus } from '../components/PublicationStatus';
afterEach(cleanup);
const clipboard = vi.fn();
beforeEach(() => { clipboard.mockReset().mockResolvedValue(undefined); Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: clipboard } }); Object.defineProperty(navigator, 'share', { configurable: true, value: undefined }); });
function fixture(mode: 'private_activation' | 'public_publish' = 'public_publish') {
  const receipt = { requestId: draftId, mode, cohortId: draftId, snapshotHash: 'a'.repeat(64), committedAt: '2026-10-11T00:00:00.000Z' };
  return { snapshot: { ...readyFixture(), stage: 'published', review: readyReview, publication: { ...receipt, checkpoint: null, receipt } },
    saved: true, materialPending: false, finalize: vi.fn(async () => true), cancel: vi.fn() } as unknown as ReturnType<typeof useCreation>;
}
describe('committed publication completion', () => {
  it('uses the receipt for visibility and actual cohort/feed routes, without exposing unsupported editing', () => {
    render(<PublicationStatus creation={fixture()} />); const dialog = screen.getByRole('dialog', { name: 'Your cohort is live!' });
    expect(within(dialog).getByText('Visibility: Public')).toBeTruthy();
    expect(within(dialog).getByRole('link', { name: 'View cohort' }).getAttribute('href')).toBe(`/cohort/${draftId}`);
    expect(within(dialog).getByRole('link', { name: 'Start learning' }).getAttribute('href')).toBe(`/play?cohort=${draftId}`);
    expect(within(dialog).getByRole('textbox', { name: 'Cohort link' }).getAttribute('value')).toBe(`${location.origin}/cohort/${draftId}`);
    expect(screen.queryByText('Keep editing')).toBeNull();
  });
  it('copies only after successful clipboard completion and locks duplicate requests', async () => {
    let resolve!: () => void; clipboard.mockImplementation(() => new Promise<void>(done => { resolve = done; }));
    render(<PublicationStatus creation={fixture()} />); const button = screen.getByRole('button', { name: 'Copy' });
    fireEvent.click(button); fireEvent.click(button); expect(clipboard).toHaveBeenCalledExactlyOnceWith(`${location.origin}/cohort/${draftId}`);
    expect(screen.queryByText('Link copied.')).toBeNull(); await act(async () => resolve());
    expect(screen.getByText('Link copied.')).toBeTruthy(); expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy();
  });
  it('reports copy failures and retains a selectable real URL', async () => {
    clipboard.mockRejectedValue(new Error('Denied')); render(<PublicationStatus creation={fixture()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy' })); await screen.findByText(/could not be shared or copied/);
    const input = screen.getByRole('textbox', { name: 'Cohort link' }) as HTMLInputElement;
    expect(document.activeElement).toBe(input); expect(input.selectionEnd).toBe(input.value.length); expect(screen.queryByText('Link copied.')).toBeNull();
  });
  it('uses native share, treats dismissal as cancellation, and falls back to copying', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('Canceled', 'AbortError')); Object.defineProperty(navigator, 'share', { configurable: true, value: share });
    render(<PublicationStatus creation={fixture()} />); fireEvent.click(screen.getByRole('button', { name: /^Share/ }));
    await waitFor(() => expect(share).toHaveBeenCalled()); expect(clipboard).not.toHaveBeenCalled(); expect(screen.queryByText(/could not be shared/)).toBeNull();
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /^Share/ })));
    expect(clipboard).toHaveBeenCalledOnce(); expect(screen.getByText('Link copied.')).toBeTruthy();
  });
  it('keeps private copy honest, dismisses without changing persistence, and promotes the same cohort', async () => {
    const creation = fixture('private_activation'); render(<PublicationStatus creation={creation} />);
    expect(screen.getByRole('dialog', { name: 'Your private cohort is ready' })).toBeTruthy(); expect(screen.getByText('Sharing a link does not grant access.')).toBeTruthy();
    expect(screen.queryByText(/anyone can discover/i)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Done' })); await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(creation.finalize).not.toHaveBeenCalled(); expect(creation.snapshot.publication?.receipt?.cohortId).toBe(draftId);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Publish this cohort publicly' })));
    expect(creation.finalize).toHaveBeenCalledExactlyOnceWith('public_publish');
    fireEvent.click(screen.getByRole('button', { name: 'View completion details' })); expect(screen.getByRole('dialog')).toBeTruthy();
  });
  it('does not expose success or delivery for missing receipts, even with a public draft preference', () => {
    const creation = fixture(); creation.snapshot.publication!.receipt = null; creation.snapshot.review!.visibility = 'PUBLIC';
    render(<PublicationStatus creation={creation} />); expect(screen.queryByRole('dialog')).toBeNull(); expect(screen.queryByRole('link', { name: 'Start learning' })).toBeNull();
    expect(screen.getByRole('alert').textContent).toContain('Publication state is unavailable');
  });
  it('does not expose a receipt before the published stage and retains retry/cancel controls', async () => {
    const creation = fixture(); creation.snapshot.stage = 'finalizing'; creation.snapshot.status = 'running';
    const { rerender } = render(<PublicationStatus creation={creation} />); expect(screen.queryByRole('dialog')).toBeNull(); expect(screen.queryByRole('progressbar')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel finalization' })); expect(creation.cancel).toHaveBeenCalledOnce();
    creation.snapshot.status = 'failed'; creation.snapshot.error = { code: 'DATA_UNAVAILABLE', message: 'Storage unavailable', retryable: true };
    rerender(<PublicationStatus creation={{ ...creation }} />); expect(screen.getByRole('alert').textContent).toBe('Storage unavailable');
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Retry finalization' }))); expect(creation.finalize).toHaveBeenCalledExactlyOnceWith('public_publish');
  });
  it('shows only known persisted progress and disables retry while waiting for the server', () => {
    const creation = fixture(); creation.snapshot.stage = 'finalizing'; creation.snapshot.status = 'failed'; creation.saved = false;
    creation.snapshot.publication!.checkpoint = { phase: 'publication', requestId: draftId, mode: 'public_publish', snapshotHash: 'a'.repeat(64), cohortId: draftId,
      total: 3, lessonIds: ['a', 'b', 'c'], completed: [{ lessonId: 'a', artifact: { id: draftId, kind: 'artifact', checksum: 'b'.repeat(64), byteLength: 100 } }] };
    render(<PublicationStatus creation={creation} />); const progress = screen.getByRole('progressbar', { name: 'Saved publication artifacts' });
    expect(progress.getAttribute('value')).toBe('1'); expect(progress.getAttribute('max')).toBe('3');
    expect((screen.getByRole('button', { name: 'Retry finalization' }) as HTMLButtonElement).disabled).toBe(true);
  });
  it('offers manual selection when clipboard access is unavailable', async () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined }); render(<PublicationStatus creation={fixture()} />);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Copy' })));
    expect(screen.getByText(/Copy is unavailable/)).toBeTruthy(); expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Cohort link' }));
  });
});
