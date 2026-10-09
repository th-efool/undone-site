import { afterEach, describe, expect, it, vi } from 'vitest';
import { executeCreationJob } from '../durable-job.runner';
import { JobBudgetExceeded, type ClaimedCreationJob, type CreationJobRepository } from '../durable-job';
import { creationFailure } from '../errors';
import { draftId, requestId, result } from '@/src/shared/cohort-creation/__tests__/fixtures';

function fixture() {
  const job: ClaimedCreationJob = {
    id: draftId, draftId, ownerId: 'owner', kind: 'recommendations', requestId,
    inputRevision: 1, inputFingerprint: 'fingerprint', status: 'running', attempt: 1,
    input: { requestId, inputRevision: 1, query: result.intent.rawQuery },
    leaseToken: 'lease-one', deadlineAt: new Date(Date.now() + 30_000), checkpoint: null,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
  let currentToken = job.leaseToken;
  let checkpoint: typeof result | null = null;
  const repo: CreationJobRepository = {
    enqueue: vi.fn(), cancel: vi.fn(), claim: vi.fn(), reserveModelCall: vi.fn(),
    heartbeat: vi.fn(async candidate => candidate.leaseToken === currentToken),
    checkpoint: vi.fn(async (candidate, value) => {
      if (candidate.leaseToken !== currentToken) return false;
      checkpoint = value; return true;
    }),
    finish: vi.fn(async candidate => candidate.leaseToken === currentToken),
    retry: vi.fn(async () => true), release: vi.fn(),
  };
  const recommend = vi.fn(async () => result);
  return { repo, job, recommend, checkpoint: () => checkpoint, fence: () => { currentToken = 'new-lease'; } };
}
afterEach(() => vi.useRealTimers());
describe('durable recommendation worker', () => {
  it('commits a validated checkpoint before the terminal event', async () => {
    const { repo, job, recommend, checkpoint } = fixture();
    await executeCreationJob(repo, job, () => ({ recommend }), new AbortController().signal);
    expect(checkpoint()).toEqual(result);
    expect(vi.mocked(repo.checkpoint).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(repo.finish).mock.invocationCallOrder[0]);
    expect(repo.finish).toHaveBeenCalledWith(job, { type: 'recommendations_received', result });
  });
  it('recovers a checkpoint after a crash without another model call, even after its generation deadline', async () => {
    const { repo, job, recommend } = fixture(); job.checkpoint = result; job.deadlineAt = new Date(0);
    await executeCreationJob(repo, job, () => ({ recommend }), new AbortController().signal);
    expect(recommend).not.toHaveBeenCalled();
    expect(repo.finish).toHaveBeenCalledWith(job, { type: 'recommendations_received', result });
  });
  it('does not claim success after cancellation or a replacement lease fences the result', async () => {
    const { repo, job, fence } = fixture();
    await executeCreationJob(repo, job, () => ({ recommend: async () => { fence(); return result; } }), new AbortController().signal);
    expect(repo.finish).not.toHaveBeenCalled();
  });
  it('leaves post-generation storage faults recoverable rather than marking AI failure', async () => {
    const { repo, job, recommend } = fixture(); vi.mocked(repo.finish).mockRejectedValue(new Error('database unavailable'));
    await expect(executeCreationJob(repo, job, () => ({ recommend }), new AbortController().signal)).rejects.toThrow('database unavailable');
    expect(repo.checkpoint).toHaveBeenCalledOnce();
    expect(repo.finish).toHaveBeenCalledOnce();
    expect(repo.retry).not.toHaveBeenCalled();
  });
  it('releases unfinished work on shutdown for a new worker', async () => {
    const { repo, job } = fixture(); const shutdown = new AbortController(); shutdown.abort();
    await executeCreationJob(repo, job, vi.fn(), shutdown.signal);
    expect(repo.release).toHaveBeenCalledWith(job); expect(repo.finish).not.toHaveBeenCalled();
  });
  it('fails elapsed recommendations without starting another paid call', async () => {
    const { repo, job, recommend } = fixture(); job.deadlineAt = new Date(0);
    await executeCreationJob(repo, job, () => ({ recommend }), new AbortController().signal);
    expect(recommend).not.toHaveBeenCalled();
    expect(repo.finish).toHaveBeenCalledWith(job, expect.objectContaining({ error: expect.objectContaining({ code: 'AI_TIMEOUT' }) }));
  });
  it('schedules transient retry but does not retry invalid output or exhausted budgets', async () => {
    for (const [error, retry] of [[creationFailure('AI_UNAVAILABLE', 'temporary'), true],
      [creationFailure('AI_INVALID_OUTPUT', 'invalid'), false], [new JobBudgetExceeded(), false]] as const) {
      const { repo, job } = fixture();
      await executeCreationJob(repo, job, () => ({ recommend: async () => { throw error; } }), new AbortController().signal);
      expect(repo.retry).toHaveBeenCalledTimes(retry ? 1 : 0);
      expect(repo.finish).toHaveBeenCalledTimes(retry ? 0 : 1);
    }
  });
  it('checks its lease every twenty seconds and aborts work when another worker owns it', async () => {
    vi.useFakeTimers(); const { repo, job, fence } = fixture();
    let started = false;
    const work = executeCreationJob(repo, job, () => ({ recommend: (_input, signal) => new Promise((_resolve, reject) => {
      started = true; signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    }) }), new AbortController().signal);
    expect(started).toBe(true); fence();
    await vi.advanceTimersByTimeAsync(20_000); await work;
    expect(repo.heartbeat).toHaveBeenCalledOnce(); expect(repo.finish).not.toHaveBeenCalled();
  });
});
