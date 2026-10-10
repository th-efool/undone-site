import type { CreationSnapshot, RecommendationRequest, RecommendationResult } from '@/src/shared/cohort-creation/contracts';
import type { CreationEvent } from '@/src/shared/cohort-creation/flow';
import type { CreationEventEnvelope, CreationJobSummary } from '@/src/shared/cohort-creation/durable';
import type { TextAcquisitionRequest, WebAcquisitionRequest, PdfAcquisitionRequest, YoutubeInspectionRequest, YoutubeObservationRequest, GithubAcquisitionRequest } from '@/src/shared/cohort-creation/jobs';
import type { RetainedGithubCheckpoint, GithubMaterialManifest } from '@/src/shared/cohort-creation/github';
import type { RetainedYoutubeMetadata, YoutubeObservationCheckpoint, YoutubeMaterialManifest } from '@/src/shared/cohort-creation/youtube';
import type { RetainedWebCheckpoint, WebMaterialManifest } from '@/src/shared/cohort-creation/web';
import type { MaterialManifest } from '@/src/shared/cohort-creation/materials';
import type { NotionAcquisitionRequest } from '@/src/shared/cohort-creation/jobs';
import type { DiscoveryRequest } from './discovery.service';
import type { DiscoveryCheckpoint, DiscoveryResult } from '@/src/shared/cohort-creation/discovery';
import type { RetainedNotionCheckpoint, NotionMaterialManifest } from '@/src/shared/cohort-creation/notion';
import type { UnderstandingRequest } from '@/src/shared/cohort-creation/jobs';
import type { UnderstandingCheckpoint } from '@/src/shared/cohort-creation/processing';

export class JobBudgetExceeded extends Error {}
export class LeaseLost extends Error {}
type JobBase = Omit<CreationJobSummary, 'kind'> & {
  draftId: string; ownerId: string; inputFingerprint: string;
  leaseToken: string; deadlineAt: Date;
};
export type ClaimedRecommendationJob = JobBase & { kind: 'recommendations'; input: RecommendationRequest; checkpoint: RecommendationResult | null };
export type ClaimedTextJob = JobBase & { kind: 'acquire_text'; input: TextAcquisitionRequest; checkpoint: MaterialManifest | null };
export type ClaimedWebJob = JobBase & { kind: 'acquire_web'; input: WebAcquisitionRequest; checkpoint: RetainedWebCheckpoint | WebMaterialManifest | null };
export type ClaimedPdfJob = JobBase & { kind: 'acquire_pdf'; input: PdfAcquisitionRequest; checkpoint: MaterialManifest | null };
export type ClaimedYoutubeInspectionJob = JobBase & { kind: 'inspect_youtube'; input: YoutubeInspectionRequest; checkpoint: RetainedYoutubeMetadata | null };
export type ClaimedYoutubeObservationJob = JobBase & { kind: 'observe_youtube'; input: YoutubeObservationRequest; checkpoint: YoutubeObservationCheckpoint | YoutubeMaterialManifest | null };
export type ClaimedGithubJob = JobBase & { kind: 'acquire_github'; input: GithubAcquisitionRequest; checkpoint: RetainedGithubCheckpoint | GithubMaterialManifest | null };
export type ClaimedNotionJob = JobBase & { kind: 'acquire_notion'; input: NotionAcquisitionRequest; checkpoint: RetainedNotionCheckpoint | NotionMaterialManifest | null };
export type ClaimedDiscoveryJob = JobBase & { kind: 'discover_material'; input: DiscoveryRequest; checkpoint: DiscoveryCheckpoint | DiscoveryResult | null };
export type ClaimedUnderstandingJob = JobBase & { kind: 'understand_material'; input: UnderstandingRequest; checkpoint: UnderstandingCheckpoint | null };
export type ClaimedCreationJob = ClaimedRecommendationJob | ClaimedTextJob | ClaimedWebJob | ClaimedPdfJob | ClaimedYoutubeInspectionJob | ClaimedYoutubeObservationJob | ClaimedGithubJob | ClaimedNotionJob | ClaimedDiscoveryJob | ClaimedUnderstandingJob;
export type CreationCheckpoint = RecommendationResult | MaterialManifest | RetainedWebCheckpoint | WebMaterialManifest | RetainedYoutubeMetadata | YoutubeObservationCheckpoint | YoutubeMaterialManifest | RetainedGithubCheckpoint | GithubMaterialManifest | RetainedNotionCheckpoint | NotionMaterialManifest | DiscoveryCheckpoint | DiscoveryResult | UnderstandingCheckpoint;
export interface CreationJobRepository {
  enqueue(owner: string, previous: CreationSnapshot, next: CreationSnapshot): Promise<CreationSnapshot | null>;
  cancel(owner: string, previous: CreationSnapshot, next: CreationSnapshot): Promise<boolean>;
  claim(worker: string): Promise<ClaimedCreationJob | null>;
  heartbeat(job: ClaimedCreationJob): Promise<boolean>;
  reserveModelCall(job: ClaimedCreationJob, unitId?: string): Promise<void | (() => Promise<void>)>;
  checkpoint(job: ClaimedCreationJob, result: CreationCheckpoint): Promise<boolean>;
  retry(job: ClaimedCreationJob, delayMs: number): Promise<boolean>;
  finish(job: ClaimedCreationJob, event: CreationEvent): Promise<boolean>;
  release(job: ClaimedCreationJob): Promise<void>;
}
export interface CreationEventPage {
  snapshot: CreationSnapshot; cursor: number; events: CreationEventEnvelope[];
  jobs: CreationJobSummary[]; reset: boolean;
}
export interface CreationEventRepository {
  read(owner: string, draftId: string, after: number): Promise<CreationEventPage | null>;
}
