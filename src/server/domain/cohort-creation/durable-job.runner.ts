import { CreationFailure } from './errors';
import { JobBudgetExceeded, LeaseLost, type ClaimedCreationJob, type ClaimedRecommendationJob, type ClaimedTextJob, type ClaimedWebJob, type CreationJobRepository } from './durable-job';
import type { RecommendationService } from './recommendation.service';

import type { TextAcquisitionService } from './materials/text-acquisition.service';
import { CreationStorageError } from '@/src/server/infrastructure/storage/creation.contracts';
import { jobCompletion, validateWebRetention } from './job-completion';
import type { WebAcquisitionService } from './materials/web-acquisition.service';
type RecommenderFactory = (job: ClaimedRecommendationJob) => Pick<RecommendationService, 'recommend'>;
type AcquirerFactory = (job: ClaimedTextJob) => Pick<TextAcquisitionService, 'acquire'>;
type WebAcquirerFactory = (job: ClaimedWebJob) => Pick<WebAcquisitionService, 'acquire' | 'extract'>;
/** One task invocation; browser connections are deliberately not an input. */
export async function executeCreationJob(repo: CreationJobRepository, job: ClaimedCreationJob,
  recommender: RecommenderFactory, shutdown: AbortSignal, acquirer?: AcquirerFactory, webAcquirer?: WebAcquirerFactory) {
  const lease = new AbortController();
  const remaining = Math.max(1, job.deadlineAt.getTime() - Date.now());
  const timeout = AbortSignal.timeout(remaining);
  const signal = AbortSignal.any([shutdown, lease.signal, timeout]);
  let heartbeatPending = false;
  let modelFinished = job.checkpoint !== null && !('phase' in job.checkpoint);
  const timer = setInterval(async () => {
    if (heartbeatPending) return;
    heartbeatPending = true;
    try { if (!await repo.heartbeat(job)) lease.abort(new LeaseLost()); }
    catch { lease.abort(new LeaseLost()); }
    finally { heartbeatPending = false; }
  }, 20_000);
  try {
    // A complete checkpoint survives a crash between its commit and finalization.
    if (job.checkpoint && !('phase' in job.checkpoint)) {
      await repo.finish(job, jobCompletion(job, job.checkpoint));
      return;
    }
    if (job.deadlineAt.getTime() <= Date.now()) throw new DOMException('Job deadline elapsed', 'TimeoutError');
    signal.throwIfAborted();
    const result = job.kind === 'recommendations' ? await recommender(job).recommend(job.input, signal)
      : job.kind === 'acquire_web' ? await (() => {
        if (!webAcquirer) throw new Error('Web acquisition service unavailable');
        const service = webAcquirer(job); const scope = { ownerId: job.ownerId, draftId: job.draftId };
        if (job.checkpoint && 'phase' in job.checkpoint) {
          const retained = validateWebRetention(job, job.checkpoint);
          return service.extract(scope, job.input.source, job.inputRevision, retained.receiptArtifact, retained.receiptFingerprint, signal);
        }
        return service.acquire(scope, job.input.source, job.inputRevision, signal, async retained => {
          if (!await repo.checkpoint(job, retained)) throw new LeaseLost();
        });
      })() : await (() => {
        if (!acquirer) throw new Error('Text acquisition service unavailable');
        return acquirer(job).acquire({ ownerId: job.ownerId, draftId: job.draftId }, job.input.source, job.inputRevision, signal);
      })();
    signal.throwIfAborted();
    const completion = jobCompletion(job, result);
    modelFinished = true;
    if (!await repo.checkpoint(job, result)) return;
    await repo.finish(job, completion);
  } catch (error) {
    if (shutdown.aborted) { await repo.release(job); return; }
    if (lease.signal.aborted || error instanceof LeaseLost) return;
    // Storage failures after generation retain the checkpoint/lease for restart recovery.
    if (modelFinished) throw error;
    const detail = error instanceof CreationStorageError
      ? { code: error.code === 'UNAVAILABLE' ? 'DATA_UNAVAILABLE' as const : 'INVALID_REQUEST' as const,
        message: error.message, retryable: error.code === 'UNAVAILABLE' }
      : error instanceof JobBudgetExceeded
      ? { code: 'RATE_LIMITED' as const, message: 'The generation budget is exhausted. Try again later.', retryable: true }
      : timeout.aborted || (error instanceof Error && error.name === 'TimeoutError')
        ? { code: job.kind === 'recommendations' ? 'AI_TIMEOUT' as const : 'DATA_UNAVAILABLE' as const,
          message: job.kind === 'recommendations' ? 'Recommendations took too long. Try again.' : 'Material acquisition took too long. Retry the selected source.', retryable: true }
        : error instanceof CreationFailure ? error.detail
          : { code: job.kind === 'recommendations' ? 'AI_UNAVAILABLE' as const : 'DATA_UNAVAILABLE' as const,
            message: job.kind === 'recommendations' ? 'Recommendations could not be generated. Try again.' : 'Material acquisition is unavailable. Retry the selected source.', retryable: true };
    const transient = (error instanceof CreationFailure || error instanceof CreationStorageError) && detail.retryable &&
      ['AI_UNAVAILABLE', 'RATE_LIMITED', 'DATA_UNAVAILABLE'].includes(detail.code);
    if (transient && !timeout.aborted && await repo.retry(job, 1000 * 2 ** job.attempt)) return;
    await repo.finish(job, { type: 'operation_failed', requestId: job.requestId, error: detail });
  } finally { clearInterval(timer); }
}

export async function runCreationWorker(repo: CreationJobRepository, workerId: string,
  recommender: RecommenderFactory, signal: AbortSignal, reportError: (error: unknown) => void, acquirer?: AcquirerFactory, webAcquirer?: WebAcquirerFactory) {
  const tasks = new Set<Promise<void>>();
  while (!signal.aborted) {
    try {
      if (tasks.size < 2) {
        const job = await repo.claim(workerId);
        if (job) {
          const task = executeCreationJob(repo, job, recommender, signal, acquirer, webAcquirer).catch(reportError);
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
