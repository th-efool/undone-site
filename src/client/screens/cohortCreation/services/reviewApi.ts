import { z } from 'zod';
import { creationJson, creationErrorMessage, CreationTransportError } from './creationTransport';
import { generatedCurriculumSchema } from '@/src/shared/cohort-creation/artifacts';
import { conversationEntrySchema, reviewWorkspaceSchema } from '@/src/shared/cohort-creation/review';

export const reviewResponseSchema = z.strictObject({ revision: z.number().int().nonnegative(),
  curriculum: generatedCurriculumSchema, review: reviewWorkspaceSchema,
  conversation: z.strictObject({ entries: z.array(conversationEntrySchema).max(30), nextBefore: z.uuid().nullable() }) });
export type ReviewResponse = z.infer<typeof reviewResponseSchema>;
export async function loadReview(draftId: string, signal?: AbortSignal, before?: string) {
  const { response, body, retryAfterSeconds } = await creationJson(`/api/cohort-creation/drafts/${encodeURIComponent(draftId)}/review${before ? `?before=${encodeURIComponent(before)}` : ''}`, { signal });
  if (!response.ok) throw new CreationTransportError(creationErrorMessage(body, 'Review could not be loaded. Retry to recover your saved draft.'), response.status, retryAfterSeconds);
  return reviewResponseSchema.parse(body);
}
