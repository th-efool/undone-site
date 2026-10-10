import 'server-only';
import { refinementRequestSchema, refinementResultSchema, type RefinementRequest } from '@/src/shared/cohort-creation/jobs';
import type { BuildingContentService } from './building-content.service';
import { projectReview } from './review.service';
import { validateRefinementProposal, type CreationRefinement } from './refinement';

/** Bounded proposal generation: only explicit application commands apply returned edits. */
export class RefinementService {
  constructor(private readonly content: Pick<BuildingContentService, 'load'>, private readonly ai: CreationRefinement) {}
  async run(scope: { ownerId: string; draftId: string }, value: RefinementRequest, signal: AbortSignal) {
    signal.throwIfAborted(); const request = refinementRequestSchema.parse(value); const state = request.snapshot; const review = state.review!;
    if (scope.draftId !== state.draftId) throw new Error('Refinement draft mismatch');
    const built = await this.content.load(scope, state, signal); const curriculum = projectReview(built.curriculum, review);
    const proposal = validateRefinementProposal(await this.ai.refine(review.request!.prompt, curriculum, review, signal), curriculum);
    signal.throwIfAborted(); return refinementResultSchema.parse({ requestId: request.requestId, inputRevision: request.inputRevision,
      baseEditRevision: review.editRevision, buildFingerprint: review.buildFingerprint, proposal });
  }
}
export function validateRefinementResult(input: RefinementRequest, value: unknown) {
  const request = refinementRequestSchema.parse(input); const result = refinementResultSchema.parse(value); const review = request.snapshot.review!;
  const fields = new Set<string>();
  if (result.requestId !== request.requestId || result.inputRevision !== request.inputRevision || result.baseEditRevision !== review.editRevision ||
    result.buildFingerprint !== review.buildFingerprint) throw new Error('Refinement result is stale');
  for (const change of result.proposal.changes) {
    const key = 'lessonId' in change ? `${change.type}:${change.lessonId}` : change.type;
    if (fields.has(key) || 'lessonId' in change && !review.lessonIds.includes(change.lessonId)) throw new Error('Refinement result has invalid edits');
    fields.add(key);
  }
  return result;
}
