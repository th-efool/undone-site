import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { recommendationDispatcher } from '../recommendation.dispatch';
import type { ClaimedRecommendationJob, ClaimedYoutubeInspectionJob, CreationJobRepository } from '../durable-job';
import { applyCommand, applyEvent, initialSnapshot } from '@/src/shared/cohort-creation/flow';
import { CreationStorageError } from '@/src/server/infrastructure/storage/creation.contracts';
import { draftId, requestId, result } from '@/src/shared/cohort-creation/__tests__/fixtures';
import { creationFailure } from '../errors';

function fixture() {
  const snapshot = applyCommand(initialSnapshot(draftId), { type: 'request_recommendations', requestId, query: result.intent.rawQuery });
  const job: ClaimedRecommendationJob = {
    id: draftId, draftId, ownerId: 'alice', kind: 'recommendations', requestId,
    inputRevision: snapshot.inputRevision, inputFingerprint: 'fingerprint', status: 'running', attempt: 1,
    input: { requestId, inputRevision: snapshot.inputRevision, query: snapshot.query },
    leaseToken: 'lease', deadlineAt: new Date(Date.now() + 30_000), checkpoint: null,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
  const repo: CreationJobRepository = {
    enqueue: vi.fn(), cancel: vi.fn(), claim: vi.fn().mockResolvedValueOnce(job).mockResolvedValue(null),
    reserveModelCall: vi.fn(), heartbeat: vi.fn().mockResolvedValue(true),
    checkpoint: vi.fn().mockResolvedValue(true), finish: vi.fn().mockResolvedValue(true),
    retry: vi.fn(), release: vi.fn(),
  };
  const recommend = vi.fn().mockResolvedValue({ ...result, inputRevision: snapshot.inputRevision, items: [] });
  const pending: (() => Promise<void>)[] = [];
  const report = vi.fn();
  const dispatch = recommendationDispatcher(repo, () => ({ recommend }), work => pending.push(work), report);
  return { snapshot, repo, recommend, pending, dispatch, report };
}

describe('short recommendation dispatch', () => {
  it('starts owned YouTube inspection without AI and persists storage failure', async () => {
    const f = fixture();
    const accepted = applyEvent(f.snapshot, { type: 'recommendations_received', result });
    const own = applyCommand(applyCommand(accepted, { type: 'create_own' }), { type: 'choose_starting_point', startingPoint: 'have_material' });
    const running = applyCommand(own, { type: 'inspect_youtube', requestId, materialId: draftId, url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw' });
    const job: ClaimedYoutubeInspectionJob = {
      id: draftId, draftId, ownerId: 'alice', kind: 'inspect_youtube', requestId,
      inputRevision: running.inputRevision, inputFingerprint: 'fingerprint', status: 'running', attempt: 1,
      input: { requestId, inputRevision: running.inputRevision, source: running.materials[0] },
      leaseToken: 'lease', deadlineAt: new Date(Date.now() + 120_000), checkpoint: null,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    vi.mocked(f.repo.claim).mockReset().mockResolvedValueOnce(job).mockResolvedValue(null);
    const retainMetadata = vi.fn().mockRejectedValue(new CreationStorageError('UNAVAILABLE', 'Private storage is unavailable.'));
    const dispatch = recommendationDispatcher(f.repo, () => ({ recommend: f.recommend }), work => f.pending.push(work), f.report, () => ({ retainMetadata }));
    dispatch('alice', running); dispatch('alice', running);
    await Promise.all(f.pending.map(work => work()));
    expect(f.repo.claim).toHaveBeenCalledWith(expect.any(String), { ownerId: 'alice', draftId, requestId, kind: 'inspect_youtube' });
    expect(retainMetadata).toHaveBeenCalledOnce();
    expect(f.recommend).not.toHaveBeenCalled();
    expect(f.repo.finish).toHaveBeenCalledWith(job, expect.objectContaining({ type: 'operation_failed' }));
    // Presence of a retained preview means native observation, which must never
    // be pulled into this short metadata execution path.
    dispatch('alice', { ...running, youtubeSources: [{ materialId: draftId }] as typeof running.youtubeSources });
    expect(f.pending).toHaveLength(2);
  });
  it('executes zero-match searches after response using the exact owned request', async () => {
    const f = fixture();
    f.dispatch('alice', f.snapshot);
    expect(f.repo.claim).not.toHaveBeenCalled();
    await f.pending[0]();
    expect(f.repo.claim).toHaveBeenCalledWith(expect.stringMatching(/^web-search-/), { ownerId: 'alice', draftId, requestId });
    expect(f.repo.finish).toHaveBeenCalledWith(expect.anything(), { type: 'recommendations_received', result: expect.objectContaining({ items: [] }) });
    expect(f.report).not.toHaveBeenCalled();
  });
  it('leaves duplicates and already claimed searches to the existing lease holder', async () => {
    const f = fixture();
    f.dispatch('alice', f.snapshot); f.dispatch('alice', f.snapshot);
    await Promise.all(f.pending.map(work => work()));
    expect(f.recommend).toHaveBeenCalledOnce();
    expect(f.repo.finish).toHaveBeenCalledOnce();
  });
  it('does not dispatch material work, idle drafts or failed searches', () => {
    const f = fixture();
    f.dispatch('alice', initialSnapshot(draftId));
    f.dispatch('alice', { ...f.snapshot, stage: 'processing' });
    f.dispatch('alice', { ...f.snapshot, status: 'failed' });
    expect(f.pending).toEqual([]);
  });
  it('persists a recoverable provider failure instead of leaving search running', async () => {
    const f = fixture();
    f.recommend.mockRejectedValue(creationFailure('AI_UNAVAILABLE', 'Search unavailable.'));
    f.dispatch('alice', f.snapshot); await f.pending[0]();
    expect(f.repo.finish).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ type: 'operation_failed' }));
  });
});
