import { z } from 'zod';
import { generatedCurriculumSchema } from '@/src/shared/cohort-creation/artifacts';
import { conversationEntrySchema, reviewWorkspaceSchema } from '@/src/shared/cohort-creation/review';

export const reviewResponseSchema = z.strictObject({ revision: z.number().int().nonnegative(),
  curriculum: generatedCurriculumSchema, review: reviewWorkspaceSchema,
  conversation: z.strictObject({ entries: z.array(conversationEntrySchema).max(30), nextBefore: z.uuid().nullable() }) });
export type ReviewResponse = z.infer<typeof reviewResponseSchema>;
export async function loadReview(draftId: string, signal?: AbortSignal, before?: string) {
  const response = await fetch(`/api/cohort-creation/drafts/${encodeURIComponent(draftId)}/review${before ? `?before=${encodeURIComponent(before)}` : ''}`,
    { cache: 'no-store', signal });
  if (!response.ok) throw new Error(response.status === 401 ? 'Sign in again to resume review.' : 'Review could not be loaded. Retry to recover your saved draft.');
  return reviewResponseSchema.parse(await response.json());
}
