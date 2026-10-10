import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { draftId } from '@/src/shared/cohort-creation/__tests__/fixtures';
import { initialSnapshot } from '@/src/shared/cohort-creation/flow';
import { understandingPreviewHandler } from '../understanding-preview.http';
import { DraftNotFound } from '../draft.service';

function fixture() {
  const state = { ...initialSnapshot(draftId), processing: { requestId: draftId, inputRevision: 0, phase: 'understanding' as const,
    complete: false, building: null, analysis: null, chunking: null, checkpoint: { phase: 'understanding' as const, requestId: draftId,
      inputRevision: 0, inputFingerprint: 'a'.repeat(64), total: 1, partitionIds: ['b'.repeat(64)], completed: [] } } };
  const load = vi.fn(async () => state); const owner = vi.fn(async (): Promise<string | null> => 'owner');
  const read = vi.fn<Parameters<typeof understandingPreviewHandler>[2]>(async () => []);
  return { state, load, owner, read, handle: understandingPreviewHandler({ load }, owner, read) };
}
const request = () => new Request('https://example.test/understanding');
describe('owned understanding preview', () => {
  it('rejects anonymous, malformed and foreign drafts before artifact reads', async () => {
    const f = fixture(); f.owner.mockResolvedValueOnce(null);
    expect((await f.handle(request(), draftId)).status).toBe(401); expect(f.load).not.toHaveBeenCalled();
    expect((await f.handle(request(), 'bad')).status).toBe(404);
    f.load.mockRejectedValueOnce(new DraftNotFound());
    expect((await f.handle(request(), draftId)).status).toBe(404); expect(f.read).not.toHaveBeenCalled();
  });
  it('returns only validated owned accepted content and prevents caching', async () => {
    const f = fixture(); const response = await f.handle(request(), draftId);
    expect(response.status).toBe(200); expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toEqual({ revision: 0, partitions: [] });
    expect(f.read.mock.calls[0][0]).toEqual({ ownerId: 'owner', draftId });
  });
  it('rejects revision races and hides storage errors', async () => {
    const f = fixture(); f.load.mockResolvedValueOnce(f.state).mockResolvedValueOnce({ ...f.state, revision: 1 });
    expect((await f.handle(request(), draftId)).status).toBe(409);
    f.read.mockRejectedValueOnce(new Error('private storage key'));
    const response = await f.handle(request(), draftId); expect(response.status).toBe(503); expect(await response.text()).not.toContain('private');
  });
  it('does not read artifacts before inventory exists', async () => {
    const f = fixture(); f.load.mockResolvedValueOnce({ ...f.state, processing: null } as unknown as typeof f.state);
    expect((await f.handle(request(), draftId)).status).toBe(409); expect(f.read).not.toHaveBeenCalled();
  });
});
