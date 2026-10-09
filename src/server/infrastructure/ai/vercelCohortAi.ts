import 'server-only';
import { APICallError, generateText, NoObjectGeneratedError, NoOutputGeneratedError, Output, RetryError, type LanguageModel } from 'ai';
import { z } from 'zod';
import type { ExistingCohortReference, LearningIntent } from '@/src/shared/cohort-creation/contracts';
import { intentProposalSchema, rankingProposalSchema, validateRanking, type CohortAi } from '@/src/server/domain/cohort-creation/ai.contracts';
import { CreationFailure, creationFailure } from '@/src/server/domain/cohort-creation/errors';
import { intentInstructions, rankingInstructions } from './prompts/creation';

function sanitizedAiError(error: unknown, signal: AbortSignal): CreationFailure {
  if (error instanceof CreationFailure) return error;
  if (signal.aborted) {
    return signal.reason?.name === 'TimeoutError'
      ? creationFailure('AI_TIMEOUT', 'Recommendations took too long. Try again.')
      : creationFailure('CANCELLED', 'Recommendation generation was canceled.');
  }
  if (error instanceof Error && error.name === 'TimeoutError') return creationFailure('AI_TIMEOUT', 'Recommendations took too long. Try again.');
  if (NoObjectGeneratedError.isInstance(error) || NoOutputGeneratedError.isInstance(error) || error instanceof z.ZodError) {
    return creationFailure('AI_INVALID_OUTPUT', 'The generated response could not be validated. Try again.');
  }
  const cause = RetryError.isInstance(error) ? error.lastError : error;
  if (APICallError.isInstance(cause) && cause.statusCode === 429) {
    return creationFailure('RATE_LIMITED', 'The AI service is busy. Try again shortly.');
  }
  return creationFailure('AI_UNAVAILABLE', 'Recommendations are temporarily unavailable. Try again.');
}

export class VercelCohortAi implements CohortAi {
  constructor(private readonly model: LanguageModel, private readonly execution?: {
    maxRetries: number; beforeCall: () => Promise<void | (() => Promise<void>)>;
  }) {}

  private async structured<T extends z.ZodType>(schema: T, instructions: string, input: unknown, signal: AbortSignal): Promise<z.output<T>> {
    // One schema repair at most; both attempts share the caller's total abort budget.
    for (let attempt = 0; attempt < 2; attempt++) {
      // Durable lease/budget failures must reach the worker without AI error remapping.
      if (signal.aborted) throw sanitizedAiError(signal.reason, signal);
      const release = await this.execution?.beforeCall();
      try {
        signal.throwIfAborted();
        const prompt = JSON.stringify({ input, ...(attempt ? { correction: 'Previous output failed schema validation. Return only the requested structured fields.' } : {}) });
        // Conservative byte bound keeps this foundation task below its input budget.
        if (Buffer.byteLength(prompt + instructions, 'utf8') > 15_000) {
          throw creationFailure('AI_INVALID_OUTPUT', 'The recommendation context is too large.', false);
        }
        const result = await generateText({
          model: this.model, instructions,
          prompt,
          output: Output.object({ schema }), maxOutputTokens: 2000,
          maxRetries: this.execution?.maxRetries ?? 2, timeout: { totalMs: 15_000 }, abortSignal: signal,
          telemetry: { isEnabled: false, recordInputs: false, recordOutputs: false },
        });
        signal.throwIfAborted();
        return schema.parse(result.output);
      } catch (error) {
        const invalid = NoObjectGeneratedError.isInstance(error) || NoOutputGeneratedError.isInstance(error) || error instanceof z.ZodError;
        if (attempt === 0 && invalid && !signal.aborted) continue;
        throw sanitizedAiError(error, signal);
      } finally {
        // An uncertain release remains conservatively occupied until its durable lease expires.
        if (release) await release().catch(() => undefined);
      }
    }
    throw creationFailure('AI_INVALID_OUTPUT', 'The generated response could not be validated.');
  }

  interpret(query: string, signal: AbortSignal) {
    return this.structured(intentProposalSchema, intentInstructions, { query }, signal);
  }

  async rank(intent: LearningIntent, candidates: ExistingCohortReference[], signal: AbortSignal) {
    const base = { query: intent.rawQuery, topic: intent.topic.value, outcomes: intent.outcomes.value };
    const selected: ExistingCohortReference[] = [];
    const excerpts: { candidateKey: string; title: string; description: string; categories: string[]; difficulty: string }[] = [];
    for (const candidate of candidates) {
      const excerpt = {
        candidateKey: candidate.cohortId, title: candidate.title.slice(0, 160),
        description: candidate.description.slice(0, 300), categories: candidate.categories.slice(0, 3).map(category => category.slice(0, 80)),
        difficulty: candidate.difficulty,
      };
      if (Buffer.byteLength(JSON.stringify({ ...base, candidates: [...excerpts, excerpt] }), 'utf8') > 12_000) break;
      selected.push(candidate); excerpts.push(excerpt);
    }
    if (!selected.length) throw creationFailure('AI_INVALID_OUTPUT', 'The recommendation context is too large.', false);
    const proposal = await this.structured(rankingProposalSchema, rankingInstructions, { ...base, candidates: excerpts }, signal);
    return validateRanking(proposal, selected);
  }
}
