import type { CreationSnapshot, RecommendationRequest, RecommendationResult } from '@/src/shared/cohort-creation/contracts';
import type { CreationEvent } from '@/src/shared/cohort-creation/flow';
import type { CreationEventEnvelope, CreationJobSummary } from '@/src/shared/cohort-creation/durable';

export class JobBudgetExceeded extends Error {}
export class LeaseLost extends Error {}
export interface ClaimedCreationJob extends CreationJobSummary {
  draftId: string; ownerId: string; inputFingerprint: string;
  input: RecommendationRequest; leaseToken: string; deadlineAt: Date;
  checkpoint: RecommendationResult | null;
}
export interface CreationJobRepository {
  enqueue(owner: string, previous: CreationSnapshot, next: CreationSnapshot): Promise<CreationSnapshot | null>;
  cancel(owner: string, previous: CreationSnapshot, next: CreationSnapshot): Promise<boolean>;
  claim(worker: string): Promise<ClaimedCreationJob | null>;
  heartbeat(job: ClaimedCreationJob): Promise<boolean>;
  reserveModelCall(job: ClaimedCreationJob): Promise<void | (() => Promise<void>)>;
  checkpoint(job: ClaimedCreationJob, result: RecommendationResult): Promise<boolean>;
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
