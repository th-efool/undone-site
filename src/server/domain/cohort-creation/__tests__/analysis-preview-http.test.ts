import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { draftId } from '@/src/shared/cohort-creation/__tests__/fixtures';
import { initialSnapshot } from '@/src/shared/cohort-creation/flow';
import { analysisPreviewHandler } from '../analysis-preview.http';
import { DraftNotFound } from '../draft.service';

function fixture() {
  const operation = { requestId: draftId, complete: false, checkpoint: { phase: 'analysis' as const, requestId: draftId, inputRevision: 0,
    inputFingerprint: 'a'.repeat(64), chunkingFingerprint: 'b'.repeat(64), total: 1, partitionIds: ['c'.repeat(64)], completed: [] } };
  const state = { ...initialSnapshot(draftId), processing: { requestId: draftId, inputRevision: 0, phase: 'analysis' as const,
    complete: true, building: null, chunking: null, analysis: operation, checkpoint: null } };
  const load = vi.fn(async () => state); const owner = vi.fn(async (): Promise<string | null> => 'owner');
  const read = vi.fn<Parameters<typeof analysisPreviewHandler>[2]>(async () => ({ chunks: [], analyses: [] }));
  return { state, load, owner, read, handle: analysisPreviewHandler({ load }, owner, read) };
}
const request = () => new Request('https://example.test/analysis');
describe('owned analysis preview HTTP boundary', () => {
  it('rejects anonymous, malformed and foreign draft reads before storage access', async () => {
    const f = fixture(); f.owner.mockResolvedValueOnce(null);
    expect((await f.handle(request(), draftId)).status).toBe(401); expect(f.load).not.toHaveBeenCalled();
    expect((await f.handle(request(), 'bad')).status).toBe(404); f.load.mockRejectedValueOnce(new DraftNotFound());
    expect((await f.handle(request(), draftId)).status).toBe(404); expect(f.read).not.toHaveBeenCalled();
  });
  it('reads the owned draft and returns uncached schema-validated accepted chunks', async () => {
    const f = fixture(); const response = await f.handle(request(), draftId);
    expect(response.status).toBe(200); expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toEqual({ revision: 0, chunks: [], analyses: [] }); expect(f.read.mock.calls[0][0]).toEqual({ ownerId: 'owner', draftId });
  });
  it('rejects stale reads and returns safe errors for malformed or unavailable retained data', async () => {
    const f = fixture(); f.load.mockResolvedValueOnce(f.state).mockResolvedValueOnce({ ...f.state, revision: 1 });
    expect((await f.handle(request(), draftId)).status).toBe(409);
    f.read.mockRejectedValueOnce(new Error('secret storage key')); const response = await f.handle(request(), draftId);
    expect(response.status).toBe(503); expect(await response.text()).not.toContain('secret');
    f.read.mockResolvedValueOnce({ chunks: [], analyses: [{ chunkId: 'invented' }] } as never);
    expect((await f.handle(request(), draftId)).status).toBe(503);
  });
  it('does not read analysis before the inventory exists', async () => {
    const f = fixture(); f.load.mockResolvedValueOnce({ ...f.state, processing: null } as unknown as typeof f.state);
    expect((await f.handle(request(), draftId)).status).toBe(409); expect(f.read).not.toHaveBeenCalled();
  });
});
