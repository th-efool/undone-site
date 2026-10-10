import type { ClaimedRefinementJob } from './durable-job';
import type { RefinementService } from './refinement.service';
import type { ClaimedBuildingJob } from './durable-job';
import { validateBuildingCheckpoint, type BuildingService } from './building.service';
import type { ClaimedAnalysisJob } from './durable-job';
import { validateAnalysisCheckpoint, type AnalysisService } from './analysis.service';
import { CreationFailure, ProviderBackoff } from './errors';
import { JobBudgetExceeded, LeaseLost, type ClaimedCreationJob, type ClaimedRecommendationJob, type ClaimedTextJob, type ClaimedWebJob, type ClaimedPdfJob, type ClaimedYoutubeInspectionJob, type ClaimedYoutubeObservationJob, type CreationJobRepository } from './durable-job';
import type { YoutubeAcquisitionService } from './materials/youtube-acquisition.service';
import { validateYoutubeCheckpoint } from './materials/youtube-identity';
import type { ClaimedGithubJob } from './durable-job';
import type { GithubAcquisitionService } from './materials/github-acquisition.service';
import type { RecommendationService } from './recommendation.service';
import type { ClaimedNotionJob } from './durable-job';
import type { NotionAcquisitionService } from './materials/notion-acquisition.service';
import { validateNotionRetention } from './job-completion';
import { validateDiscoveryCheckpoint } from './job-completion';
import type { ClaimedDiscoveryJob } from './durable-job';
import type { DiscoveryService } from './discovery.service';
import type { ClaimedUnderstandingJob } from './durable-job';
import type { UnderstandingService } from './understanding.service';
import { validateUnderstandingCheckpoint } from './understanding.service';
import type { ClaimedChunkingJob } from './durable-job';
import { validateChunkingCheckpoint, type ChunkingService } from './chunking.service';

import type { TextAcquisitionService } from './materials/text-acquisition.service';
import { CreationStorageError } from '@/src/server/infrastructure/storage/creation.contracts';
import { jobCompletion, validateWebRetention, validateGithubRetention, githubJobSelection } from './job-completion';
import type { WebAcquisitionService } from './materials/web-acquisition.service';
import type { PdfAcquisitionService } from './materials/pdf-acquisition.service';
import type { YoutubeMetadataRetentionService } from './materials/youtube-observation.service';
type RecommenderFactory = (job: ClaimedRecommendationJob) => Pick<RecommendationService, 'recommend'>;
type AcquirerFactory = (job: ClaimedTextJob) => Pick<TextAcquisitionService, 'acquire'>;
type WebAcquirerFactory = (job: ClaimedWebJob) => Pick<WebAcquisitionService, 'acquire' | 'extract'>;
type PdfAcquirerFactory = (job: ClaimedPdfJob) => Pick<PdfAcquisitionService, 'acquire'>;
type YoutubeInspectorFactory = (job: ClaimedYoutubeInspectionJob) => Pick<YoutubeMetadataRetentionService, 'retainMetadata'>;
type YoutubeAcquirerFactory = (job: ClaimedYoutubeObservationJob) => Pick<YoutubeAcquisitionService, 'acquire'>;
type GithubAcquirerFactory = (job: ClaimedGithubJob) => Pick<GithubAcquisitionService, 'acquire' | 'extract'>;
type NotionAcquirerFactory = (job: ClaimedNotionJob) => Pick<NotionAcquisitionService, 'acquire' | 'extract'>;
type DiscoveryFactory = (job: ClaimedDiscoveryJob) => Pick<DiscoveryService, 'run'>;
type RefinementFactory = (job: ClaimedRefinementJob) => Pick<RefinementService, 'run'>;
type BuildingFactory = (job: ClaimedBuildingJob) => Pick<BuildingService, 'run'>;
type AnalysisFactory = (job: ClaimedAnalysisJob) => Pick<AnalysisService, 'run'>;
type ChunkingFactory = (job: ClaimedChunkingJob) => Pick<ChunkingService, 'run'>;
type UnderstandingFactory = (job: ClaimedUnderstandingJob) => Pick<UnderstandingService, 'run'>;
/** One task invocation; browser connections are deliberately not an input. */
export async function executeCreationJob(repo: CreationJobRepository, job: ClaimedCreationJob,
  recommender: RecommenderFactory, shutdown: AbortSignal, acquirer?: AcquirerFactory, webAcquirer?: WebAcquirerFactory, pdfAcquirer?: PdfAcquirerFactory, youtubeInspector?: YoutubeInspectorFactory, youtubeAcquirer?: YoutubeAcquirerFactory, githubAcquirer?: GithubAcquirerFactory, notionAcquirer?: NotionAcquirerFactory, discoverer?: DiscoveryFactory, understander?: UnderstandingFactory, chunker?: ChunkingFactory, analyzer?: AnalysisFactory, builder?: BuildingFactory, refiner?: RefinementFactory) {
  const lease = new AbortController();
  const remaining = Math.max(1, job.deadlineAt.getTime() - Date.now());
  const timeout = AbortSignal.timeout(remaining);
  const signal = AbortSignal.any([shutdown, lease.signal, timeout]);
  let heartbeatPending = false;
  const completedProcessing = (job.kind === 'understand_material' || job.kind === 'chunk_material' || job.kind === 'analyze_material' || job.kind === 'build_curriculum') && job.checkpoint !== null && job.checkpoint.completed.length === job.checkpoint.total;
  let modelFinished = completedProcessing || job.checkpoint !== null && !('phase' in job.checkpoint);
  const timer = setInterval(async () => {
    if (heartbeatPending) return;
    heartbeatPending = true;
    try { if (!await repo.heartbeat(job)) lease.abort(new LeaseLost()); }
    catch { lease.abort(new LeaseLost()); }
    finally { heartbeatPending = false; }
  }, 20_000);
  try {
    // A complete checkpoint survives a crash between its commit and finalization.
    if (job.checkpoint && (completedProcessing || !('phase' in job.checkpoint))) {
      await repo.finish(job, jobCompletion(job, job.checkpoint));
      return;
    }
    if (job.deadlineAt.getTime() <= Date.now()) throw new DOMException('Job deadline elapsed', 'TimeoutError');
    signal.throwIfAborted();
    const result = job.kind === 'recommendations' ? await recommender(job).recommend(job.input, signal)
      : job.kind === 'refine_curriculum' ? await (() => {
        if (!refiner) throw new Error('Refinement service unavailable');
        return refiner(job).run({ ownerId: job.ownerId, draftId: job.draftId }, job.input, signal);
      })()
      : job.kind === 'build_curriculum' ? await (() => {
        if (!builder) throw new Error('Building service unavailable');
        const checkpoint = job.checkpoint ? validateBuildingCheckpoint(job.input.snapshot, job.requestId, job.checkpoint) : undefined;
        return builder(job).run({ ownerId: job.ownerId, draftId: job.draftId }, job.input.snapshot, job.requestId, signal, async value => {
          if (!await repo.checkpoint(job, value)) throw new LeaseLost();
        }, checkpoint);
      })()
      : job.kind === 'analyze_material' ? await (() => {
        if (!analyzer) throw new Error('Analysis service unavailable');
        const checkpoint = job.checkpoint ? validateAnalysisCheckpoint(job.input.snapshot, job.requestId, job.checkpoint) : undefined;
        return analyzer(job).run({ ownerId: job.ownerId, draftId: job.draftId }, job.input.snapshot, job.requestId, signal, async value => {
          if (!await repo.checkpoint(job, value)) throw new LeaseLost();
        }, checkpoint);
      })()
      : job.kind === 'chunk_material' ? await (() => {
        if (!chunker) throw new Error('Chunking service unavailable');
        const checkpoint = job.checkpoint ? validateChunkingCheckpoint(job.input.snapshot, job.requestId, job.checkpoint) : undefined;
        return chunker(job).run({ ownerId: job.ownerId, draftId: job.draftId }, job.input.snapshot, job.requestId, signal, async value => {
          if (!await repo.checkpoint(job, value)) throw new LeaseLost();
        }, checkpoint);
      })()
      : job.kind === 'understand_material' ? await (() => {
        if (!understander) throw new Error('Understanding service unavailable');
        const checkpoint = job.checkpoint ? validateUnderstandingCheckpoint(job.input.snapshot, job.requestId, job.checkpoint) : undefined;
        return understander(job).run({ ownerId: job.ownerId, draftId: job.draftId }, job.input.snapshot, job.requestId, signal, async value => {
          if (!await repo.checkpoint(job, value)) throw new LeaseLost();
        }, checkpoint);
      })()
      : job.kind === 'discover_material' ? await (() => {
        if (!discoverer) throw new Error('Resource discovery unavailable');
        const checkpoint = job.checkpoint && 'phase' in job.checkpoint ? validateDiscoveryCheckpoint(job, job.checkpoint) : undefined;
        return discoverer(job).run({ ownerId: job.ownerId, draftId: job.draftId }, job.input, signal, async value => {
          if (!await repo.checkpoint(job, value)) throw new LeaseLost();
        }, checkpoint);
      })()
      : job.kind === 'acquire_notion' ? await (() => {
        if (!notionAcquirer) throw new Error('Notion acquisition service unavailable');
        const service = notionAcquirer(job); const scope = { ownerId: job.ownerId, draftId: job.draftId };
        if (job.checkpoint && 'phase' in job.checkpoint) return service.extract(scope, job.input.source, job.inputRevision,
          validateNotionRetention(job, job.checkpoint), signal, job.input.maxUnits);
        return service.acquire(scope, job.input.source, job.inputRevision, signal, async retained => {
          if (!await repo.checkpoint(job, retained)) throw new LeaseLost();
        }, job.input.maxUnits);
      })()
      : job.kind === 'acquire_github' ? await (() => {
        if (!githubAcquirer) throw new Error('GitHub acquisition service unavailable');
        const service = githubAcquirer(job); const scope = { ownerId: job.ownerId, draftId: job.draftId }; const selection = githubJobSelection(job);
        if (job.checkpoint && 'phase' in job.checkpoint) return service.extract(scope, job.input.source, job.inputRevision, selection,
          validateGithubRetention(job, job.checkpoint), signal, job.input.maxUnits);
        return service.acquire(scope, job.input.source, job.inputRevision, selection, signal, async retained => {
          if (!await repo.checkpoint(job, retained)) throw new LeaseLost();
        }, job.input.maxUnits);
      })()
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
      })() : job.kind === 'observe_youtube' ? await (() => {
        if (!youtubeAcquirer) throw new Error('YouTube observation service unavailable');
        const checkpoint = job.checkpoint && 'phase' in job.checkpoint ? validateYoutubeCheckpoint(job.input, job.checkpoint) : undefined;
        return youtubeAcquirer(job).acquire({ ownerId: job.ownerId, draftId: job.draftId }, job.input, signal, async value => {
          if (!await repo.checkpoint(job, value)) throw new LeaseLost();
        }, checkpoint);
      })() : job.kind === 'inspect_youtube' ? await (() => {
        if (!youtubeInspector) throw new Error('YouTube inspection service unavailable');
        return youtubeInspector(job).retainMetadata({ ownerId: job.ownerId, draftId: job.draftId }, job.input.source, job.inputRevision, signal);
      })() : job.kind === 'acquire_pdf' ? await (() => {
        if (!pdfAcquirer) throw new Error('PDF acquisition service unavailable');
        return pdfAcquirer(job).acquire({ ownerId: job.ownerId, draftId: job.draftId }, job.input.source, job.inputRevision, signal);
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
        ? { code: job.kind === 'recommendations' || job.kind === 'understand_material' || job.kind === 'chunk_material' || job.kind === 'analyze_material' || job.kind === 'build_curriculum' || job.kind === 'refine_curriculum' ? 'AI_TIMEOUT' as const : 'DATA_UNAVAILABLE' as const,
          message: job.kind === 'refine_curriculum' ? 'Refinement stopped. Your review and edits remain saved.' : job.kind === 'build_curriculum' ? 'Building stopped. Accepted analysis and lessons remain saved.' : job.kind === 'analyze_material' ? 'Analysis stopped. Accepted chunks and analysis remain saved.' : job.kind === 'chunk_material' ? 'Chunking stopped. Retained material, understanding and accepted chunks remain saved.' : job.kind === 'understand_material' ? 'Understanding took too long. Retained material and accepted partitions remain saved.' : job.kind === 'recommendations' ? 'Recommendations took too long. Try again.' : 'Material acquisition took too long. Retry the selected source.', retryable: true }
        : error instanceof CreationFailure ? error.detail
          : { code: job.kind === 'recommendations' || job.kind === 'understand_material' || job.kind === 'chunk_material' || job.kind === 'analyze_material' || job.kind === 'build_curriculum' || job.kind === 'refine_curriculum' ? 'AI_UNAVAILABLE' as const : 'DATA_UNAVAILABLE' as const,
            message: job.kind === 'refine_curriculum' ? 'Refinement stopped. Your review and edits remain saved.' : job.kind === 'build_curriculum' ? 'Building stopped. Accepted analysis and lessons remain saved.' : job.kind === 'analyze_material' ? 'Analysis stopped. Accepted chunks and analysis remain saved.' : job.kind === 'chunk_material' ? 'Chunking stopped. Retained material, understanding and accepted chunks remain saved.' : job.kind === 'understand_material' ? 'Understanding is unavailable. Retained material and accepted partitions remain saved.' : job.kind === 'recommendations' ? 'Recommendations could not be generated. Try again.' : 'Material acquisition is unavailable. Retry the selected source.', retryable: true };
    const transient = (error instanceof CreationFailure || error instanceof CreationStorageError) && detail.retryable &&
      ['AI_UNAVAILABLE', 'RATE_LIMITED', 'DATA_UNAVAILABLE'].includes(detail.code);
    const retryDelay = Math.max(1000 * 2 ** job.attempt, error instanceof ProviderBackoff ? error.retryAfterMs : 0);
    if (transient && !timeout.aborted && await repo.retry(job, retryDelay)) return;
    await repo.finish(job, { type: 'operation_failed', requestId: job.requestId, error: detail });
  } finally { clearInterval(timer); }
}

export async function runCreationWorker(repo: CreationJobRepository, workerId: string,
  recommender: RecommenderFactory, signal: AbortSignal, reportError: (error: unknown) => void, acquirer?: AcquirerFactory, webAcquirer?: WebAcquirerFactory, pdfAcquirer?: PdfAcquirerFactory, youtubeInspector?: YoutubeInspectorFactory, youtubeAcquirer?: YoutubeAcquirerFactory, githubAcquirer?: GithubAcquirerFactory, notionAcquirer?: NotionAcquirerFactory, discoverer?: DiscoveryFactory, understander?: UnderstandingFactory, chunker?: ChunkingFactory, analyzer?: AnalysisFactory, builder?: BuildingFactory, refiner?: RefinementFactory) {
  const tasks = new Set<Promise<void>>();
  while (!signal.aborted) {
    try {
      if (tasks.size < 2) {
        const job = await repo.claim(workerId);
        if (job) {
          const task = executeCreationJob(repo, job, recommender, signal, acquirer, webAcquirer, pdfAcquirer, youtubeInspector, youtubeAcquirer, githubAcquirer, notionAcquirer, discoverer, understander, chunker, analyzer, builder, refiner).catch(reportError);
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
