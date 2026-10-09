import { CreationFailure } from './errors';
import { JobBudgetExceeded, LeaseLost, type ClaimedCreationJob, type CreationJobRepository } from './durable-job';
import type { RecommendationService } from './recommendation.service';

type RecommenderFactory = (job: ClaimedCreationJob) => Pick<RecommendationService, 'recommend'>;
/** One task invocation; browser connections are deliberately not an input. */
export async function executeCreationJob(repo: CreationJobRepository, job: ClaimedCreationJob,
  recommender: RecommenderFactory, shutdown: AbortSignal) {
  const lease = new AbortController();
  const remaining = Math.max(1, job.deadlineAt.getTime() - Date.now());
  const timeout = AbortSignal.timeout(remaining);
  const signal = AbortSignal.any([shutdown, lease.signal, timeout]);
  let heartbeatPending = false;
  let modelFinished = job.checkpoint !== null;
  const timer = setInterval(async () => {
    if (heartbeatPending) return;
    heartbeatPending = true;
    try { if (!await repo.heartbeat(job)) lease.abort(new LeaseLost()); }
    catch { lease.abort(new LeaseLost()); }
    finally { heartbeatPending = false; }
  }, 20_000);
  try {
    // A complete checkpoint survives a crash between its commit and finalization.
    if (job.checkpoint) {
      await repo.finish(job, { type: 'recommendations_received', result: job.checkpoint });
      return;
    }
    if (job.deadlineAt.getTime() <= Date.now()) throw new DOMException('Job deadline elapsed', 'TimeoutError');
    signal.throwIfAborted();
    const result = await recommender(job).recommend(job.input, signal);
    signal.throwIfAborted();
    modelFinished = true;
    if (!await repo.checkpoint(job, result)) return;
    await repo.finish(job, { type: 'recommendations_received', result });
  } catch (error) {
    if (shutdown.aborted) { await repo.release(job); return; }
    if (lease.signal.aborted || error instanceof LeaseLost) return;
    // Storage failures after generation retain the checkpoint/lease for restart recovery.
    if (modelFinished) throw error;
    const detail = error instanceof JobBudgetExceeded
      ? { code: 'RATE_LIMITED' as const, message: 'The generation budget is exhausted. Try again later.', retryable: true }
      : timeout.aborted || (error instanceof Error && error.name === 'TimeoutError')
        ? { code: 'AI_TIMEOUT' as const, message: 'Recommendations took too long. Try again.', retryable: true }
        : error instanceof CreationFailure ? error.detail
          : { code: 'AI_UNAVAILABLE' as const, message: 'Recommendations could not be generated. Try again.', retryable: true };
    const transient = error instanceof CreationFailure && detail.retryable &&
      ['AI_UNAVAILABLE', 'RATE_LIMITED', 'DATA_UNAVAILABLE'].includes(detail.code);
    if (transient && !timeout.aborted && await repo.retry(job, 1000 * 2 ** job.attempt)) return;
    await repo.finish(job, { type: 'operation_failed', requestId: job.requestId, error: detail });
  } finally { clearInterval(timer); }
}

export async function runCreationWorker(repo: CreationJobRepository, workerId: string,
  recommender: RecommenderFactory, signal: AbortSignal, reportError: (error: unknown) => void) {
  const tasks = new Set<Promise<void>>();
  while (!signal.aborted) {
    try {
      if (tasks.size < 2) {
        const job = await repo.claim(workerId);
        if (job) {
          const task = executeCreationJob(repo, job, recommender, signal).catch(reportError);
          tasks.add(task);
          void task.finally(() => tasks.delete(task));
          continue;
        }
      }
    } catch (error) { reportError(error); }
    await new Promise<void>(resolve => {
      const done = () => { clearTimeout(timer); signal.removeEventListener('abort', done); resolve(); };
      const timer = setTimeout(done, 1000);
      signal.addEventListener('abort', done, { once: true });
      if (signal.aborted) done();
    });
  }
  await Promise.all(tasks);
}
