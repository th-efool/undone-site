import { z } from 'zod';

const title = z.string().trim().min(1).max(300);
const description = z.string().trim().min(1).max(2000);
const objectives = z.array(z.string().trim().min(1).max(1000)).min(1).max(20);
const lessonId = z.string().min(1).max(128);
export const refinementProposalSchema = z.strictObject({ message: description,
  changes: z.array(z.discriminatedUnion('type', [
    z.strictObject({ type: z.literal('title'), value: title }),
    z.strictObject({ type: z.literal('description'), value: description }),
    z.strictObject({ type: z.literal('lesson_title'), lessonId, value: title }),
    z.strictObject({ type: z.literal('lesson_objectives'), lessonId, value: objectives }),
  ])).max(20),
});
export type RefinementProposal = z.infer<typeof refinementProposalSchema>;
export const reviewWorkspaceSchema = z.strictObject({ title, description,
  buildFingerprint: z.string().regex(/^[a-f0-9]{64}$/), editRevision: z.number().int().nonnegative(),
  lessonIds: z.array(lessonId).max(2500).default([]), orphanedLessonIds: z.array(lessonId).max(2500).default([]),
  invalidated: z.array(z.enum(['preview', 'publication'])).max(2).default([]),
  lessonEdits: z.array(z.strictObject({ lessonId, title: title.optional(), objectives: objectives.optional() })).max(2500),
  visibility: z.enum(['PUBLIC', 'PRIVATE']), chatEnabled: z.boolean(), eventsEnabled: z.boolean(),
  proposal: z.strictObject({ requestId: z.uuid(), baseEditRevision: z.number().int().nonnegative(), result: refinementProposalSchema }).nullable(),
  request: z.strictObject({ requestId: z.uuid(), prompt: z.string().trim().min(1).max(2000),
    baseEditRevision: z.number().int().nonnegative() }).nullable().default(null),
}).superRefine((review, ctx) => {
  if (new Set(review.lessonIds).size !== review.lessonIds.length || new Set(review.orphanedLessonIds).size !== review.orphanedLessonIds.length ||
    new Set(review.invalidated).size !== review.invalidated.length ||
    new Set(review.lessonEdits.map(edit => edit.lessonId)).size !== review.lessonEdits.length ||
    review.lessonEdits.some(edit => edit.title === undefined && edit.objectives === undefined)) {
    ctx.addIssue({ code: 'custom', message: 'Lesson edits must be unique and nonempty' });
  }
});
export type ReviewWorkspace = z.infer<typeof reviewWorkspaceSchema>;
export const creationReviewSchema = reviewWorkspaceSchema;
export type CreationReview = ReviewWorkspace;
export const conversationEntrySchema = z.strictObject({ id: z.uuid(), draftId: z.uuid(), requestId: z.uuid(),
  role: z.enum(['user', 'assistant']), message: description, proposal: refinementProposalSchema.nullable(),
  createdAt: z.iso.datetime(),
});
export type ConversationEntry = z.infer<typeof conversationEntrySchema>;
