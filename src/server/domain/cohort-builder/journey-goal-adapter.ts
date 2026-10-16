import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import type { LanguageModel } from 'ai';
import { z } from 'zod';
import {
  GENERATED_GUIDE_LIMITS,
  GENERATED_GUIDE_VERSION,
  generatedGuideArtifactSchema,
  type GeneratedGuideArtifact,
  type GeneratedGuideProposal,
} from '@/src/shared/cohort-creation/generated-guide';
import {
  learningIntentSchema,
  type LearningIntent,
} from '@/src/shared/cohort-creation/contracts';
import {
  retainGeneratedGuide,
  type CreationGuideAuthor,
} from '@/src/server/domain/cohort-creation/generated-guide';
import { VercelCreationGuideAuthor } from '@/src/server/infrastructure/ai/vercelCreationGuideAuthor';
import { createCohortModel } from '@/src/server/infrastructure/ai/modelRegistry';
import { CreationFailure } from '@/src/server/domain/cohort-creation/errors';
import type { sourceInputSchema } from '@/src/shared/cohort-builder/contracts';
import {
  sourceExtractionSchema,
  type SourceExtraction,
} from './source-adapters';
import { readTextArtifact, type TextArtifactSql } from './text-artifacts';

export type CohortSourceInput = z.infer<typeof sourceInputSchema>;

export interface GoalAdapterDeps {
  author?: CreationGuideAuthor;
  model?: LanguageModel;
  beforeCall?: () => Promise<void | (() => Promise<void>)>;
}

export class LiveCreationGuideAuthor implements CreationGuideAuthor {
  private _author?: CreationGuideAuthor;
  private readonly model?: LanguageModel;
  private readonly beforeCall?: () => Promise<void | (() => Promise<void>)>;

  constructor(options?: GoalAdapterDeps | LanguageModel) {
    if (options && typeof (options as any).doGenerate === 'function') {
      this.model = options as LanguageModel;
    } else if (options) {
      this._author = (options as GoalAdapterDeps).author;
      this.model = (options as GoalAdapterDeps).model;
      this.beforeCall = (options as GoalAdapterDeps).beforeCall;
    }
  }

  get authorInstance(): CreationGuideAuthor {
    if (!this._author) {
      const model = this.model ?? createCohortModel();
      this._author = new VercelCreationGuideAuthor(model, {
        beforeCall: this.beforeCall ?? (async () => {}),
      });
    }
    return this._author;
  }

  get identity(): GeneratedGuideArtifact['identity'] {
    return this.authorInstance.identity;
  }

  async author(intent: LearningIntent, signal: AbortSignal): Promise<GeneratedGuideProposal> {
    return this.authorInstance.author(intent, signal);
  }
}

export interface DefaultCreationGuideAuthorHelper {
  (): CreationGuideAuthor;
  author(intent: LearningIntent, signal: AbortSignal): Promise<GeneratedGuideProposal>;
}

export const defaultCreationGuideAuthor: DefaultCreationGuideAuthorHelper = Object.assign(
  function defaultCreationGuideAuthor(): CreationGuideAuthor {
    return new LiveCreationGuideAuthor();
  },
  {
    author(intent: LearningIntent, signal: AbortSignal): Promise<GeneratedGuideProposal> {
      return new LiveCreationGuideAuthor().author(intent, signal);
    },
  }
);

function createLearningIntent(input: {
  goal: string;
  audience?: string;
  dailyMinutes: number;
}): LearningIntent {
  const goal = input.goal.trim();
  const rawQuery = goal.length >= 3 ? goal.slice(0, 2000) : `${goal} guide`;
  const outcomeText = `Complete learning in ${input.dailyMinutes} minutes/day`;
  const levelText = (input.audience && input.audience.trim()) || 'General';

  return learningIntentSchema.parse({
    id: randomUUID(),
    rawQuery,
    revision: 0,
    topic: {
      value: goal.slice(0, 160),
      origin: 'user',
      acceptedRevision: 0,
    },
    outcomes: {
      value: [outcomeText.slice(0, 300)],
      origin: 'user',
      acceptedRevision: 0,
    },
    level: {
      value: levelText.slice(0, 100),
      origin: 'user',
      acceptedRevision: 0,
    },
    language: null,
    searchTerms: [],
    uncertainties: [],
  });
}

export async function acquireGeneratedGuide(
  input: CohortSourceInput & { kind: 'generated_guide' },
  author?: CreationGuideAuthor,
  callerSignal?: AbortSignal
): Promise<{ bytes: Uint8Array; artifact: GeneratedGuideArtifact }> {
  if (callerSignal?.aborted) throw new Error('GENERATED_GUIDE_CANCELED');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);
  const signal = AbortSignal.any([controller.signal, ...(callerSignal ? [callerSignal] : [])]);
  let abortListener!: () => void;
  const abortedPromise = new Promise<never>((_, reject) => {
    abortListener = () =>
      reject(new Error(callerSignal?.aborted ? 'GENERATED_GUIDE_CANCELED' : 'GENERATED_GUIDE_DEADLINE'));
    signal.addEventListener('abort', abortListener, { once: true });
  });

  try {
    const effectiveAuthor = author ?? new LiveCreationGuideAuthor();
    const intent = createLearningIntent(input);
    const proposalPromise = effectiveAuthor.author(intent, signal);
    const proposal = await Promise.race([proposalPromise, abortedPromise]);

    signal.throwIfAborted();

    const artifact = retainGeneratedGuide(
      randomUUID(),
      input.intentVersion,
      intent,
      effectiveAuthor.identity,
      proposal,
      signal
    );

    const bytes = Buffer.from(JSON.stringify(artifact), 'utf8');
    if (artifact.utf8ByteLength > GENERATED_GUIDE_LIMITS.textBytes) {
      throw new Error('GENERATED_GUIDE_SIZE_LIMIT');
    }

    return { bytes, artifact };
  } catch (error) {
    if (callerSignal?.aborted) {
      throw new Error('GENERATED_GUIDE_CANCELED');
    }
    if (signal.aborted) {
      throw new Error('GENERATED_GUIDE_DEADLINE');
    }
    if (error instanceof CreationFailure) {
      throw new Error(error.detail.code);
    }
    if (error instanceof Error && ((error as any).code === 'BUDGET_EXHAUSTED' || error.message === 'BUDGET_EXHAUSTED')) {
      throw error;
    }
    const code = error instanceof Error ? error.message : '';
    const safeCodes = [
      'GENERATED_GUIDE_CANCELED',
      'GENERATED_GUIDE_DEADLINE',
      'GENERATED_GUIDE_SIZE_LIMIT',
      'GENERATED_GUIDE_MALFORMED',
      'AI_INVALID_OUTPUT',
      'AI_UNAVAILABLE',
      'RATE_LIMITED',
      'BUDGET_EXHAUSTED',
    ];
    if (safeCodes.includes(code)) {
      throw error;
    }
    if (error instanceof Error && /^[A-Z_]+$/.test(error.message)) {
      throw error;
    }
    throw new Error('GENERATED_GUIDE_FAILED');
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', abortListener);
  }
}

export function extractGeneratedGuide(
  bytes: Uint8Array,
  input: CohortSourceInput & { kind: 'generated_guide' }
): SourceExtraction {
  if (!bytes.length || bytes.length > GENERATED_GUIDE_LIMITS.textBytes * 8) {
    throw new Error('GENERATED_GUIDE_SIZE_LIMIT');
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw new Error('GENERATED_GUIDE_MALFORMED');
  }

  const parsed = generatedGuideArtifactSchema.safeParse(decoded);
  if (!parsed.success) {
    throw new Error('GENERATED_GUIDE_MALFORMED');
  }
  const artifact = parsed.data;

  const locations = artifact.segments.map(seg => {
    if (seg.location.anchor.kind !== 'text') {
      throw new Error('GENERATED_GUIDE_MALFORMED');
    }
    return {
      start: seg.location.anchor.start,
      end: seg.location.anchor.end,
      segmentId: seg.id,
    };
  });

  const rawChecksum = createHash('sha256').update(bytes).digest('hex');

  const result: SourceExtraction = {
    format: 'cohort-extraction-v1',
    text: artifact.text,
    locations,
    provenance: {
      parserVersion: GENERATED_GUIDE_VERSION,
      rawChecksum,
      scope: 'ai_authored_guide',
      model: artifact.identity,
      contentOrigin: 'ai',
      limitations: artifact.coverage.limitations,
    },
  };

  return sourceExtractionSchema.parse(result);
}

export async function readOwnedGeneratedGuide(
  sql: TextArtifactSql,
  identity: { workspaceId: string; artifactId: string; sourceId: string; sourceVersion: number; inputFingerprint: string },
  input: CohortSourceInput & { kind: 'generated_guide' }
) {
  const retained = await readTextArtifact(sql, identity.workspaceId, identity.artifactId);
  if (
    retained.ref.kind !== 'source_raw' ||
    retained.ref.sourceId !== identity.sourceId ||
    retained.ref.sourceVersion !== identity.sourceVersion ||
    retained.ref.inputFingerprint !== identity.inputFingerprint
  ) {
    throw new Error('FOREIGN_GENERATED_GUIDE_ARTIFACT');
  }
  return extractGeneratedGuide(retained.bytes, input);
}
