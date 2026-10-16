import type { TextArtifactSql } from './text-artifacts';
import { acceptAssemblyProjection } from './text-assembly-acceptance';
import { acceptCurrentTextJob } from './text-job-acceptance';
import type { ClaimedTextJob } from './text-jobs';
import { runTextJobTick, type TextJobTickResult } from './text-job-tick';
import type { TextJobTransactionPort } from './text-job-scheduler';
import { createTextAssemblyProcessor } from './text-assembly-processor';
import { createTextSourceProcessor } from './text-source-processor';
import { failCurrentTextJob } from './text-job-failure';
import type { WebTransport } from '../cohort-creation/materials/web-fetch';
import type { YoutubeTranscriptProvider } from './youtube-transcript';
import type { GithubSourceProvider } from './github-source';
import {
  createJourneyJobProcessor,
  acceptJourneyJob,
  failJourneyJob,
  type RecommendationExecutorDeps,
  type DiscoveryExecutorDeps,
} from './journey-job-handlers';
import { cohortWorkspaceSchema } from '@/src/shared/cohort-builder/contracts';
import {
  createJourneyRecommendationAdapter,
  type JourneyRecommendationAdapter,
} from './journey-recommendation-adapter';
import {
  createJourneyDiscoveryAdapter,
  type DiscoveryAdapter,
} from './journey-discovery-adapter';

/** Durable S3 driver composition. It is injectable and remains opt-in until migration rollout. */
export function runDurableTextJobTick(input: {
  sql: TextArtifactSql;
  transaction: TextJobTransactionPort;
  workerId: string;
  leaseMs: number;
  now: () => Date;
  loadWorkspace: (workspaceId: string) => Promise<unknown>;
  webTransport?: WebTransport;
  youtubeTranscriptProvider?: YoutubeTranscriptProvider;
  videoObservationProvider?: any;
  githubSourceProvider?: GithubSourceProvider;
  recommendationAdapter?: JourneyRecommendationAdapter;
  recommendationDeps?: RecommendationExecutorDeps;
  discoveryDeps?: DiscoveryExecutorDeps;
  discoveryAdapter?: DiscoveryAdapter;
  guideAuthor?: any;
}): Promise<TextJobTickResult> {
  const source = createTextSourceProcessor({
    sql: input.sql,
    loadWorkspace: input.loadWorkspace,
    webTransport: input.webTransport,
    youtubeTranscriptProvider: input.youtubeTranscriptProvider,
    videoObservationProvider: input.videoObservationProvider,
    githubSourceProvider: input.githubSourceProvider,
    guideAuthor: input.guideAuthor,
  });
  const assembly = createTextAssemblyProcessor({ sql: input.sql, loadWorkspace: input.loadWorkspace });
  const journey = createJourneyJobProcessor({
    loadWorkspace: async (id) => cohortWorkspaceSchema.parse(await input.loadWorkspace(id)),
    recommendationDeps: input.recommendationDeps ?? {
      adapter: input.recommendationAdapter ?? createJourneyRecommendationAdapter(),
      sql: input.sql,
    },
    discoveryDeps: input.discoveryDeps ?? {
      adapter: input.discoveryAdapter ?? createJourneyDiscoveryAdapter({ sql: input.sql }),
      sql: input.sql,
    },
  });
  return runTextJobTick({
    sql: input.sql, workerId: input.workerId, leaseMs: input.leaseMs, now: input.now, renewLease: true,
    process: (job: ClaimedTextJob) =>
      job.stage === 'recommendations' || job.stage === 'discovery'
        ? journey(job)
        : job.stage === 'assembly'
        ? assembly(job)
        : source(job),
    fail: (job, code, at) =>
      job.stage === 'recommendations' || job.stage === 'discovery'
        ? input.transaction.transaction(tx => failJourneyJob(tx, job, code, at))
        : failCurrentTextJob(input.transaction, job, code, at),
    accept: (job, artifact, at) =>
      job.stage === 'recommendations' || job.stage === 'discovery'
        ? input.transaction.transaction(tx => acceptJourneyJob(tx, job, artifact, at))
        : job.stage === 'assembly'
        ? acceptAssemblyProjection(input.transaction, job, artifact, at)
        : acceptCurrentTextJob(input.transaction, job, artifact, at),
  });
}
