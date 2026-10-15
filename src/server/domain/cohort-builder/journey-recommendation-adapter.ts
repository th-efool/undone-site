import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { LanguageModel } from 'ai';
import {
  cohortRecommendationItemSchema,
  type CohortRecommendationItem,
  type CohortWorkspace,
} from '@/src/shared/cohort-builder/contracts';
import type { RecommendationResult } from '@/src/shared/cohort-creation/contracts';
import {
  RecommendationService,
  type RecommendationRepository,
} from '../cohort-creation/recommendation.service';
import type { CohortAi } from '../cohort-creation/ai.contracts';
import { CreationFailure, creationFailure } from '../cohort-creation/errors';

export interface RecommendationAdapterDeps {
  ai?: CohortAi;
  catalogRepo?: RecommendationRepository;
  model?: LanguageModel;
}

async function loadDefaultCatalogRepo(): Promise<RecommendationRepository> {
  const { creationRecommendationRepo } = await import(
    '@/src/server/infrastructure/db/postgres/repositories/creationRecommendation.repo'
  );
  return creationRecommendationRepo;
}

async function loadDefaultAi(model?: LanguageModel): Promise<CohortAi> {
  const [{ createCohortModel }, { VercelCohortAi }] = await Promise.all([
    import('@/src/server/infrastructure/ai/modelRegistry'),
    import('@/src/server/infrastructure/ai/vercelCohortAi'),
  ]);
  const resolvedModel = model ?? createCohortModel();
  return new VercelCohortAi(resolvedModel);
}

export class JourneyRecommendationAdapter {
  constructor(private readonly deps?: RecommendationAdapterDeps) {}

  async executeCohortRecommendations(
    workspace: CohortWorkspace,
    depsOrSignal?: RecommendationAdapterDeps | AbortSignal,
    maybeSignal?: AbortSignal
  ): Promise<{ items: CohortRecommendationItem[]; rawResult?: unknown }> {
    let effectiveDeps = this.deps;
    let signal: AbortSignal | undefined;

    if (depsOrSignal instanceof AbortSignal || (depsOrSignal && typeof (depsOrSignal as AbortSignal).aborted === 'boolean')) {
      signal = depsOrSignal as AbortSignal;
    } else {
      effectiveDeps = { ...this.deps, ...depsOrSignal };
      signal = maybeSignal;
    }

    return executeCohortRecommendations(workspace, effectiveDeps, signal);
  }
}

export function createJourneyRecommendationAdapter(
  deps?: RecommendationAdapterDeps
): JourneyRecommendationAdapter {
  return new JourneyRecommendationAdapter(deps);
}

export async function executeCohortRecommendations(
  workspace: CohortWorkspace,
  deps?: RecommendationAdapterDeps,
  signal?: AbortSignal
): Promise<{ items: CohortRecommendationItem[]; rawResult?: unknown }> {
  signal?.throwIfAborted();

  const rawQuery = workspace.intent.trim();
  const query = rawQuery.length >= 3
    ? rawQuery.slice(0, 2000)
    : (rawQuery ? `${rawQuery} Learning` : 'General Learning');

  const inputRevision = workspace.journey?.intentVersion ?? 0;

  let catalogRepo = deps?.catalogRepo;
  if (!catalogRepo) {
    try {
      catalogRepo = await loadDefaultCatalogRepo();
    } catch {
      signal?.throwIfAborted();
      throw creationFailure('DATA_UNAVAILABLE', 'Cohorts could not be loaded. Try again.');
    }
  }

  let ai = deps?.ai;
  if (!ai) {
    try {
      ai = await loadDefaultAi(deps?.model);
    } catch (error) {
      ai = {
        interpret: async () => {
          throw (error instanceof CreationFailure ? error : creationFailure('AI_UNAVAILABLE', 'Cohort AI unavailable'));
        },
        rank: async () => {
          throw (error instanceof CreationFailure ? error : creationFailure('AI_UNAVAILABLE', 'Cohort AI unavailable'));
        },
      };
    }
  }

  const safeAi: CohortAi = {
    async interpret(q, sig) {
      try {
        return await ai!.interpret(q, sig);
      } catch (err) {
        sig.throwIfAborted();
        if (err instanceof CreationFailure) throw err;
        throw creationFailure('AI_UNAVAILABLE', err instanceof Error ? err.message : 'AI unavailable');
      }
    },
    async rank(intent, candidates, sig) {
      try {
        return await ai!.rank(intent, candidates, sig);
      } catch (err) {
        sig.throwIfAborted();
        if (err instanceof CreationFailure) throw err;
        throw creationFailure('AI_UNAVAILABLE', err instanceof Error ? err.message : 'AI ranking unavailable');
      }
    },
  };

  const service = new RecommendationService(safeAi, catalogRepo);
  const effectiveSignal = signal ?? new AbortController().signal;

  let result: RecommendationResult;
  try {
    result = await service.recommend(
      {
        requestId: randomUUID(),
        inputRevision,
        query,
      },
      effectiveSignal
    );
  } catch (error) {
    effectiveSignal.throwIfAborted();
    if (error instanceof CreationFailure) {
      throw creationFailure(error.detail.code, error.detail.code, error.detail.retryable);
    }
    throw error;
  }

  const items: CohortRecommendationItem[] = result.items.map((item, index) => {
    const candidate: CohortRecommendationItem = {
      id: String(item.cohort.cohortId).slice(0, 200),
      label: String(item.cohort.title).trim().slice(0, 300),
      url: `https://undone.app/cohorts/${encodeURIComponent(item.cohort.cohortId)}`,
      description: item.cohort.description ? item.cohort.description.slice(0, 10000) : '',
      coverImage: item.cohort.coverImage ? item.cohort.coverImage.slice(0, 2048) : null,
      creatorName: item.cohort.creatorName ? item.cohort.creatorName.slice(0, 200) : null,
      difficulty: item.cohort.difficulty,
      categories: Array.isArray(item.cohort.categories)
        ? item.cohort.categories.map(c => String(c).slice(0, 200)).slice(0, 100)
        : [],
      estimatedCompletionTime: item.cohort.estimatedCompletionTime
        ? item.cohort.estimatedCompletionTime.slice(0, 200)
        : null,
      memberCount: typeof item.cohort.memberCount === 'number' && item.cohort.memberCount >= 0 ? item.cohort.memberCount : 0,
      lessonCount: typeof item.cohort.lessonCount === 'number' && item.cohort.lessonCount >= 0 ? item.cohort.lessonCount : 0,
      reason: item.reason ? String(item.reason).slice(0, 600) : undefined,
      isBestMatch: item.isBestMatch !== undefined ? Boolean(item.isBestMatch) : index === 0,
    };
    return cohortRecommendationItemSchema.parse(candidate);
  });

  const validatedItems = z.array(cohortRecommendationItemSchema).max(20).parse(items);
  return { items: validatedItems, rawResult: result };
}
