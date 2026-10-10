import { z } from 'zod';
import { reviewWorkspaceSchema, refinementProposalSchema, type ReviewWorkspace } from './review';
import { invalidatedArtifacts } from './dependencies';
const title = z.string().trim().min(1).max(300); const description = z.string().trim().min(1).max(2000);
const objectives = z.array(z.string().trim().min(1).max(1000)).min(1).max(20);
export const reviewPatchSchema = z.strictObject({ title: title.optional(), description: description.optional(), visibility: z.enum(['PUBLIC', 'PRIVATE']).optional(),
  chatEnabled: z.boolean().optional(), eventsEnabled: z.boolean().optional() }).refine(patch => Object.keys(patch).length > 0, 'Edit at least one field');
export const lessonEditSchema = z.strictObject({ lessonId: z.string().min(1).max(128), title: title.optional(), objectives: objectives.optional() })
  .refine(edit => edit.title !== undefined || edit.objectives !== undefined, 'Edit at least one field');
export function editReview(value: ReviewWorkspace, patch: z.infer<typeof reviewPatchSchema>) {
  const review = reviewWorkspaceSchema.parse(value); const changes = reviewPatchSchema.parse(patch);
  return reviewWorkspaceSchema.parse({ ...review, ...changes, editRevision: review.editRevision + 1,
    invalidated: [...new Set([...review.invalidated, ...('visibility' in changes ? invalidatedArtifacts('visibility') : []),
      ...(Object.keys(changes).some(key => key !== 'visibility') ? invalidatedArtifacts('metadata') : [])])] });
}
export function editLesson(value: ReviewWorkspace, patch: z.infer<typeof lessonEditSchema>) {
  const review = reviewWorkspaceSchema.parse(value); const change = lessonEditSchema.parse(patch);
  if (!review.lessonIds.includes(change.lessonId)) throw new Error('Unknown review lesson');
  const old = review.lessonEdits.find(edit => edit.lessonId === change.lessonId);
  return reviewWorkspaceSchema.parse({ ...review, editRevision: review.editRevision + 1,
    lessonEdits: [...review.lessonEdits.filter(edit => edit.lessonId !== change.lessonId), { ...old, ...change }], invalidated: ['preview', 'publication'] });
}
export function applyRefinement(value: ReviewWorkspace, requestId: string) {
  let review = reviewWorkspaceSchema.parse(value); const pending = review.proposal;
  if (!pending || pending.requestId !== requestId || pending.baseEditRevision !== review.editRevision) throw new Error('Refinement proposal is stale');
  const result = refinementProposalSchema.parse(pending.result); const fields = new Set<string>(); const revision = review.editRevision;
  for (const change of result.changes) {
    const key = 'lessonId' in change ? `${change.type}:${change.lessonId}` : change.type;
    if (fields.has(key)) throw new Error('Refinement proposal is invalid'); fields.add(key);
    review = change.type === 'title' || change.type === 'description' ? editReview(review, { [change.type]: change.value }) :
      editLesson(review, change.type === 'lesson_title' ? { lessonId: change.lessonId, title: change.value } : { lessonId: change.lessonId, objectives: change.value });
  }
  return reviewWorkspaceSchema.parse({ ...review, editRevision: revision + 1, proposal: null, request: null });
}
