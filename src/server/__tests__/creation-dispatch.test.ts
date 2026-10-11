import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({ reserve: vi.fn(), confirm: vi.fn(), release: vi.fn(), start: vi.fn(), fallback: vi.fn() }));
vi.mock('workflow/api', () => ({ start: mocks.start }));
vi.mock('../creation.workflow', () => ({ runDurableCreation: vi.fn() }));
vi.mock('../infrastructure/db/postgres/creationExecution.repo', () => ({ creationExecutionRepo: mocks }));
vi.mock('../domain/cohort-creation/recommendation.runtime', () => ({ dispatchRecommendation: mocks.fallback }));
import { dispatchCreationExecution } from '../creation-dispatch.runtime';
import { initialSnapshot } from '@/src/shared/cohort-creation/flow';
import { draftId, requestId } from '@/src/shared/cohort-creation/__tests__/fixtures';

describe('durable creation dispatch', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.stubEnv('VERCEL', '1'); mocks.reserve.mockResolvedValue(null); mocks.release.mockResolvedValue(undefined); });
  const snapshot = () => ({ ...initialSnapshot(draftId), status: 'running' as const, activeRequestId: requestId });
  it('does not enqueue idle drafts', async () => {
    await dispatchCreationExecution('alice', initialSnapshot(draftId));
    expect(mocks.reserve).not.toHaveBeenCalled();
  });
  it('deduplicates observers through SQL reservations', async () => {
    mocks.reserve.mockResolvedValueOnce({ jobId: 'job', token: 'token' });
    mocks.start.mockResolvedValue({ runId: 'run' });
    await dispatchCreationExecution('alice', snapshot());
    await dispatchCreationExecution('alice', snapshot());
    expect(mocks.start).toHaveBeenCalledOnce();
    expect(mocks.reserve).toHaveBeenCalledWith({ ownerId: 'alice', draftId, requestId });
    expect(mocks.start.mock.calls[0][1]).toEqual([{ ownerId: 'alice', draftId, requestId }]);
    expect(mocks.confirm).toHaveBeenCalledWith('job', 'token', 'run');
  });
  it('releases failed starts for recovery without failing an accepted command', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.reserve.mockResolvedValueOnce({ jobId: 'job', token: 'token' });
    mocks.start.mockRejectedValueOnce(new Error('queue unavailable'));
    await expect(dispatchCreationExecution('alice', snapshot())).resolves.toBeUndefined();
    expect(mocks.release).toHaveBeenCalledWith('job', 'token');
    log.mockRestore();
  });
  it('preserves local CLI and bounded short-job hosting', async () => {
    vi.stubEnv('VERCEL', '');
    await dispatchCreationExecution('alice', snapshot());
    expect(mocks.fallback).toHaveBeenCalledOnce(); expect(mocks.start).not.toHaveBeenCalled();
  });
});
