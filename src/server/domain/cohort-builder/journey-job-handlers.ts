import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { LanguageModel } from 'ai';
import {
  cohortDiscoveryItemSchema,
  cohortRecommendationItemSchema,
  cohortWorkspaceSchema,
  type CohortWorkspace,
} from '@/src/shared/cohort-builder/contracts';
import {
  putTextArtifact,
  readTextArtifact,
  type CohortTextArtifactKind,
  type TextArtifactRef,
  type TextArtifactSql,
} from './text-artifacts';
import {
  acceptTextJob,
  failTextJob,
  type ClaimedTextJob,
} from './text-jobs';
import { commitTextProjection } from './text-projection-commit';
import { planJourneyJobs } from './journey-job-plan';
import type { RecommendationService, RecommendationRepository } from '../cohort-creation/recommendation.service';
import type { CohortAi } from '../cohort-creation/ai.contracts';
import {
  executeCohortRecommendations,
  type JourneyRecommendationAdapter,
} from './journey-recommendation-adapter';
import {
  executeCohortDiscovery,
  type DiscoveryAdapter,
  type DiscoveryAdapterDeps,
} from './journey-discovery-adapter';
import type { ResourceDiscovery } from '../cohort-creation/discovery.contracts';
import type { DiscoverySourceObserver } from '../cohort-creation/discovery-observer';
import type { CreationArtifactRepository } from '@/src/server/infrastructure/storage/creation.store';

export interface RecommendationExecutorDeps {
  adapter?: JourneyRecommendationAdapter;
  recommendationService?: Pick<RecommendationService, 'recommend'>;
  loadCatalog?: (query: string, signal?: AbortSignal) => Promise<Array<{ id: string; label: string; url: string }>>;
  sql?: TextArtifactSql;
  workspaceId?: string;
  jobKey?: string;
  attempt?: number;
  ai?: CohortAi;
  catalogRepo?: RecommendationRepository;
  model?: LanguageModel;
}

export interface DiscoveryExecutorDeps {
  adapter?: DiscoveryAdapter;
  discoverCandidates?: (query: string, signal?: AbortSignal) => Promise<Array<{ id: string; label: string; kind?: 'web'; url: string }>>;
  sql?: TextArtifactSql;
  ai?: ResourceDiscovery;
  observer?: Pick<DiscoverySourceObserver, 'observe'>;
  storage?: Pick<CreationArtifactRepository, 'putJSON' | 'getJSON' | 'ref'>;
  model?: LanguageModel;
  workspaceId?: string;
  jobKey?: string;
  attempt?: number;
}

/** Reads public accessible cohorts catalog or uses RecommendationService (read-only). Produces safe items [{ id, label, url }]. */
export async function executeRecommendationJob(
  workspace: CohortWorkspace,
  deps?: RecommendationExecutorDeps,
  signal?: AbortSignal
): Promise<Array<z.infer<typeof cohortRecommendationItemSchema>>> {
  if (deps?.adapter) {
    const result = await deps.adapter.executeCohortRecommendations(
      workspace,
      { workspaceId: deps.workspaceId, sql: deps.sql, jobKey: deps.jobKey, attempt: deps.attempt, ...deps },
      signal
    );
    const items = [...result.items];
    Object.assign(items, { rawResult: result.rawResult });
    return items;
  }

  if (deps?.ai || deps?.catalogRepo || deps?.model) {
    const result = await executeCohortRecommendations(
      workspace,
      { ai: deps.ai, catalogRepo: deps.catalogRepo, model: deps.model, sql: deps.sql, workspaceId: deps.workspaceId, jobKey: deps.jobKey, attempt: deps.attempt },
      signal
    );
    const items = [...result.items];
    Object.assign(items, { rawResult: result.rawResult });
    return items;
  }

  if (deps?.recommendationService) {
    const rawQuery = workspace.intent.trim() || 'General Learning';
    const query = rawQuery.length >= 3 ? rawQuery.slice(0, 2000) : `${rawQuery} Learning`;
    const result = await deps.recommendationService.recommend(
      {
        requestId: randomUUID(),
        inputRevision: workspace.journey?.intentVersion ?? 0,
        query,
      },
      signal ?? new AbortController().signal
    );
    const items = result.items.map(item => ({
      id: String(item.cohort.cohortId).slice(0, 200),
      label: String(item.cohort.title).trim().slice(0, 300),
      url: `https://undone.app/cohorts/${encodeURIComponent(item.cohort.cohortId)}`,
      description: item.cohort.description?.slice(0, 10000),
      coverImage: item.cohort.coverImage ? item.cohort.coverImage.slice(0, 2048) : null,
      creatorName: item.cohort.creatorName ? item.cohort.creatorName.slice(0, 200) : null,
      difficulty: item.cohort.difficulty,
      categories: Array.isArray(item.cohort.categories) ? item.cohort.categories.map(c => String(c).slice(0, 200)).slice(0, 100) : [],
      estimatedCompletionTime: item.cohort.estimatedCompletionTime ? item.cohort.estimatedCompletionTime.slice(0, 200) : null,
      memberCount: item.cohort.memberCount ?? 0,
      lessonCount: item.cohort.lessonCount ?? 0,
      reason: item.reason?.slice(0, 600),
      isBestMatch: item.isBestMatch,
    }));
    const validated = z.array(cohortRecommendationItemSchema).max(20).parse(items);
    Object.assign(validated, { rawResult: result });
    return validated;
  }

  if (deps?.loadCatalog) {
    const raw = await deps.loadCatalog(workspace.intent.trim(), signal);
    const items = raw.map(item => ({
      id: String(item.id).slice(0, 200),
      label: String(item.label).trim().slice(0, 300),
      url: item.url,
    }));
    return z.array(cohortRecommendationItemSchema).max(20).parse(items);
  }

  if (deps?.sql) {
    try {
      const result = await deps.sql.query(
        `SELECT "id", "title" FROM "cohorts" WHERE "isPublished" = true AND "visibility" = 'PUBLIC' LIMIT 20`,
        []
      );
      const items = result.rows.map(row => ({
        id: String(row.id).slice(0, 200),
        label: String(row.title).trim().slice(0, 300),
        url: `https://undone.app/cohorts/${encodeURIComponent(String(row.id))}`,
      }));
      return z.array(cohortRecommendationItemSchema).max(20).parse(items);
    } catch {
      return [];
    }
  }

  const result = await executeCohortRecommendations(
    workspace,
    deps ? { sql: deps.sql, workspaceId: deps.workspaceId, jobKey: deps.jobKey, attempt: deps.attempt } : undefined,
    signal
  );
  const items = [...result.items];
  Object.assign(items, { rawResult: result.rawResult });
  return items;
}

/** Produces candidate items [{ id, label, kind: 'web', url }]. */
export async function executeDiscoveryJob(
  workspace: CohortWorkspace,
  deps?: DiscoveryExecutorDeps,
  signal?: AbortSignal
): Promise<Array<z.infer<typeof cohortDiscoveryItemSchema>>> {
  if (deps?.discoverCandidates) {
    const raw = await deps.discoverCandidates(workspace.intent.trim(), signal);
    const items = raw.map(item => ({
      id: String(item.id).slice(0, 200),
      label: String(item.label).trim().slice(0, 300),
      kind: 'web' as const,
      url: item.url,
    }));
    return z.array(cohortDiscoveryItemSchema).max(20).parse(items);
  }

  if (deps?.adapter) {
    const result = await deps.adapter.executeCohortDiscovery(
      workspace,
      { workspaceId: deps.workspaceId, sql: deps.sql, jobKey: deps.jobKey, attempt: deps.attempt, ...deps },
      signal
    );
    const items = [...result.items];
    Object.assign(items, { rawResult: result.rawResult });
    return items;
  }

  const result = await executeCohortDiscovery(
    workspace,
    {
      ai: deps?.ai,
      observer: deps?.observer,
      storage: deps?.storage,
      sql: deps?.sql,
      model: deps?.model,
      workspaceId: deps?.workspaceId,
      jobKey: deps?.jobKey,
      attempt: deps?.attempt,
    },
    signal
  );
  const items = [...result.items];
  Object.assign(items, { rawResult: result.rawResult });
  return items;
}

export async function retainJourneyArtifact(
  sql: TextArtifactSql,
  job: ClaimedTextJob,
  resultOrItems: unknown[] | { items: unknown[]; rawResult?: unknown }
): Promise<TextArtifactRef> {
  let payload: { items: unknown[]; rawResult?: unknown };
  if (Array.isArray(resultOrItems)) {
    const rawResult = (resultOrItems as { rawResult?: unknown }).rawResult;
    payload = { items: resultOrItems, ...(rawResult !== undefined ? { rawResult } : {}) };
  } else {
    payload = resultOrItems;
  }
  const bytes = Buffer.from(JSON.stringify(payload));
  return putTextArtifact(sql, {
    workspaceId: job.workspaceId,
    kind: job.stage as CohortTextArtifactKind,
    inputFingerprint: job.dependencyFingerprint,
    bytes,
  });
}

/** Atomically validates fence, updates workspace snapshot projection with status='ready', items, resultId, etc., and marks job accepted. */
export async function acceptJourneyJob(
  tx: TextArtifactSql,
  job: ClaimedTextJob,
  artifact: Pick<TextArtifactRef, 'id' | 'workspaceId' | 'kind' | 'inputFingerprint' | 'checksum'>,
  now: Date
): Promise<boolean> {
  if (job.stage !== 'recommendations' && job.stage !== 'discovery') return false;
  if (job.sourceId !== null || job.sourceVersion !== null) return false;
  if (artifact.workspaceId !== job.workspaceId || artifact.inputFingerprint !== job.dependencyFingerprint) return false;
  if (artifact.kind !== job.stage) return false;

  // 1. Lock workspace with active & domainId='cohort' check
  const workspaceRow = (await tx.query(
    `SELECT "snapshot", "revision" FROM "interaction_workspaces"
     WHERE "id" = $1 AND "domainId" = 'cohort' AND "lifecycle" = 'active' FOR UPDATE`,
    [job.workspaceId]
  )).rows[0];
  if (!workspaceRow) return false;

  const state = cohortWorkspaceSchema.parse(
    typeof workspaceRow.snapshot === 'string' ? JSON.parse(workspaceRow.snapshot) : workspaceRow.snapshot
  );

  if (!state.journey) return false;

  // 2. Lock job row and validate fence, stage, dependencyFingerprint, lease
  const jobRow = (await tx.query(
    `SELECT "jobKey", "stage", "dependencyFingerprint", "fence", "status", "leaseToken"
     FROM "cohort_text_jobs" WHERE "id" = $1 AND "workspaceId" = $2 FOR UPDATE`,
    [job.id, job.workspaceId]
  )).rows[0];
  if (!jobRow) return false;
  if (
    jobRow.stage !== job.stage ||
    jobRow.dependencyFingerprint !== job.dependencyFingerprint ||
    Number(jobRow.fence) !== job.fence ||
    jobRow.leaseToken !== job.leaseToken ||
    jobRow.status !== 'running'
  ) {
    return false;
  }

  // Explicit stale intentVersion check from jobRow.jobKey or job:
  const jobKey = String(jobRow.jobKey ?? (job as unknown as { jobKey?: string }).jobKey ?? '');
  if (job.stage === 'recommendations') {
    const match = /^journey:recommendations:(\d+)$/.exec(jobKey);
    const jobIntentVersion = match !== null ? Number(match[1]) : null;
    if (jobIntentVersion !== null && state.journey.intentVersion !== jobIntentVersion) {
      return false;
    }
  } else if (job.stage === 'discovery') {
    const match = /^journey:discovery:(\d+):(\d+)$/.exec(jobKey);
    const jobIntentVersion = match !== null ? Number(match[1]) : null;
    if (jobIntentVersion !== null && state.journey.intentVersion !== jobIntentVersion) {
      return false;
    }
  }

  // 3. Verify job is currently planned for this workspace state
  const planned = planJourneyJobs(state).find(
    intent => intent.jobKey === jobRow.jobKey && intent.stage === job.stage && intent.dependencyFingerprint === job.dependencyFingerprint
  );
  if (!planned) return false;

  // 4. Read retained artifact bytes
  const { bytes } = await readTextArtifact(tx, job.workspaceId, artifact.id, {
    kind: job.stage as CohortTextArtifactKind,
    inputFingerprint: job.dependencyFingerprint,
    checksum: artifact.checksum,
  });

  const parsedJson = JSON.parse(bytes.toString('utf8'));
  const rawItems = Array.isArray(parsedJson) ? parsedJson : (parsedJson.items ?? []);

  // 5. Accept the job in cohort_text_jobs (atomically validates leaseUntil, fence, artifact, dependencies)
  const accepted = await acceptTextJob(tx, job, artifact, now);
  if (!accepted) return false;

  // 6. Update workspace snapshot projection
  let next: CohortWorkspace;
  if (job.stage === 'recommendations') {
    const items = z.array(cohortRecommendationItemSchema).max(20).parse(rawItems);
    next = {
      ...state,
      recommendations: {
        requestId: state.recommendations?.requestId ?? artifact.id,
        fingerprint: job.dependencyFingerprint,
        status: 'ready',
        resultId: artifact.id,
        generation: state.recommendations?.generation ?? 0,
        items,
      },
    };
  } else {
    const items = z.array(cohortDiscoveryItemSchema).max(20).parse(rawItems);
    next = {
      ...state,
      discovery: {
        requestId: state.discovery?.requestId ?? artifact.id,
        fingerprint: job.dependencyFingerprint,
        status: 'ready',
        resultId: artifact.id,
        generation: state.discovery?.generation ?? 0,
        items,
      },
    };
  }

  cohortWorkspaceSchema.parse(next);

  // 7. Route projection update through canonical projection commit machinery
  await commitTextProjection(
    tx,
    job.workspaceId,
    state,
    next,
    Number(workspaceRow.revision),
    `journey-stage:${job.id}:${job.fence}`,
    `Journey ${job.stage} accepted.`
  );

  return true;
}

/** If job fails: sets job status='failed', updates projection status='failed'. */
export async function failJourneyJob(
  tx: TextArtifactSql,
  job: ClaimedTextJob,
  errorCode: string,
  now: Date
): Promise<boolean> {
  if (job.stage !== 'recommendations' && job.stage !== 'discovery') return false;

  // 1. Lock workspace FIRST (consistent lock ordering with acceptJourneyJob and source actions)
  const workspaceRow = (await tx.query(
    `SELECT "snapshot", "revision" FROM "interaction_workspaces"
     WHERE "id" = $1 AND "domainId" = 'cohort' AND "lifecycle" = 'active' FOR UPDATE`,
    [job.workspaceId]
  )).rows[0];
  if (!workspaceRow) return false;

  const state = cohortWorkspaceSchema.parse(
    typeof workspaceRow.snapshot === 'string' ? JSON.parse(workspaceRow.snapshot) : workspaceRow.snapshot
  );

  // 2. Lock job row and validate fence, stage, dependencyFingerprint, lease
  const jobRow = (await tx.query(
    `SELECT "jobKey", "stage", "dependencyFingerprint", "fence", "status", "leaseToken"
     FROM "cohort_text_jobs" WHERE "id" = $1 AND "workspaceId" = $2 FOR UPDATE`,
    [job.id, job.workspaceId]
  )).rows[0];
  if (!jobRow) return false;
  if (
    jobRow.stage !== job.stage ||
    jobRow.dependencyFingerprint !== job.dependencyFingerprint ||
    Number(jobRow.fence) !== job.fence ||
    jobRow.leaseToken !== job.leaseToken ||
    jobRow.status !== 'running'
  ) {
    return false;
  }

  // 3. Fail the job in cohort_text_jobs (atomically validates lease & fence)
  const failed = await failTextJob(tx, job, errorCode, now);
  if (!failed) return false;

  // If workspace has journey and job is stale (intentVersion changed), do not overwrite with failed
  const jobKey = String(jobRow.jobKey ?? (job as unknown as { jobKey?: string }).jobKey ?? '');
  if (state.journey && jobKey) {
    const parts = jobKey.split(':');
    const jobIntentVersion = (parts[0] === 'journey' && (parts[1] === 'recommendations' || parts[1] === 'discovery'))
      ? Number(parts[2])
      : NaN;
    if (!Number.isNaN(jobIntentVersion) && state.journey.intentVersion !== jobIntentVersion) {
      return true;
    }
  }

  // 4. Update workspace projection to failed
  let next: CohortWorkspace;
  if (job.stage === 'recommendations') {
    next = {
      ...state,
      recommendations: {
        requestId: state.recommendations?.requestId ?? job.id,
        fingerprint: job.dependencyFingerprint,
        status: 'failed',
        generation: state.recommendations?.generation ?? 0,
        items: state.recommendations?.items ?? [],
      },
    };
  } else {
    next = {
      ...state,
      discovery: {
        requestId: state.discovery?.requestId ?? job.id,
        fingerprint: job.dependencyFingerprint,
        status: 'failed',
        generation: state.discovery?.generation ?? 0,
        items: state.discovery?.items ?? [],
      },
    };
  }

  cohortWorkspaceSchema.parse(next);

  // 5. Route failure projection through canonical projection commit machinery
  await commitTextProjection(
    tx,
    job.workspaceId,
    state,
    next,
    Number(workspaceRow.revision),
    `journey-failure:${job.id}:${job.fence}`,
    `Journey ${job.stage} failed; retry status updated.`
  );

  return true;
}

export function createJourneyJobProcessor(deps: {
  loadWorkspace: (workspaceId: string) => Promise<CohortWorkspace>;
  recommendationDeps?: RecommendationExecutorDeps;
  discoveryDeps?: DiscoveryExecutorDeps;
}): (job: ClaimedTextJob, signal?: AbortSignal) => Promise<Uint8Array> {
  return async (job, signal) => {
    const workspace = await deps.loadWorkspace(job.workspaceId);
    const jobKey = (job as { jobKey?: string }).jobKey ?? job.id;
    const attempt = (job as { attempts?: number }).attempts ?? job.fence;
    if (job.stage === 'recommendations') {
      const recDeps: RecommendationExecutorDeps = {
        workspaceId: job.workspaceId,
        jobKey,
        attempt,
        sql: deps.recommendationDeps?.sql,
        ...deps.recommendationDeps,
      };
      const items = await executeRecommendationJob(workspace, recDeps, signal);
      const rawResult = (items as { rawResult?: unknown }).rawResult;
      return Buffer.from(JSON.stringify({ items, ...(rawResult !== undefined ? { rawResult } : {}) }));
    }
    if (job.stage === 'discovery') {
      const discDeps: DiscoveryExecutorDeps = {
        workspaceId: job.workspaceId,
        jobKey,
        attempt,
        sql: deps.discoveryDeps?.sql,
        ...deps.discoveryDeps,
      };
      const items = await executeDiscoveryJob(workspace, discDeps, signal);
      const rawResult = (items as { rawResult?: unknown }).rawResult;
      return Buffer.from(JSON.stringify({ items, ...(rawResult !== undefined ? { rawResult } : {}) }));
    }
    throw new Error('UNSUPPORTED_JOURNEY_STAGE');
  };
}
