import { creationReviewSchema, refinementProposalSchema, type CreationReview, type RefinementProposal } from '@/src/shared/cohort-creation/review';
import { generatedCurriculumSchema, type GeneratedCurriculum } from '@/src/shared/cohort-creation/artifacts';
import { creationFailure } from './errors';

export interface CreationRefinement {
  readonly identity: { provider: string; modelId: string; adapterVersion: string };
  refine(prompt: string, curriculum: GeneratedCurriculum, review: CreationReview, signal: AbortSignal): Promise<RefinementProposal>;
}
export function validateRefinementProposal(value: unknown, input: GeneratedCurriculum) {
  const curriculum = generatedCurriculumSchema.parse(input); const proposal = refinementProposalSchema.parse(value);
  const ids = new Set(curriculum.seasons.flatMap(season => season.lessons.map(lesson => lesson.id))); const changed = new Set<string>();
  for (const change of proposal.changes) {
    const key = 'lessonId' in change ? `${change.type}:${change.lessonId}` : change.type;
    if (changed.has(key) || 'lessonId' in change && !ids.has(change.lessonId)) {
      throw creationFailure('AI_INVALID_OUTPUT', 'Refinement must reference existing lessons and propose each editable field at most once.');
    }
    changed.add(key);
  }
  return proposal;
}
export function refinementContext(input: GeneratedCurriculum, value: CreationReview) {
  const curriculum = generatedCurriculumSchema.parse(input); const review = creationReviewSchema.parse(value);
  if (review.buildFingerprint !== curriculum.version) throw creationFailure('INVALID_REQUEST', 'Review no longer matches the accepted curriculum.', false);
  const edits = new Map(review.lessonEdits.map(edit => [edit.lessonId, edit]));
  const lessons = curriculum.seasons.flatMap(season => season.lessons.map(lesson => ({ lessonId: lesson.id,
    title: edits.get(lesson.id)?.title ?? lesson.title.value, objectives: edits.get(lesson.id)?.objectives ?? lesson.objectives.value })));
  if (review.lessonEdits.some(edit => !lessons.some(lesson => lesson.lessonId === edit.lessonId))) {
    throw creationFailure('INVALID_REQUEST', 'Review includes an unknown lesson.', false);
  }
  return { title: review.title, description: review.description, lessons };
}
