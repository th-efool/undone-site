import { z } from 'zod';
import { creationSnapshotSchema } from './contracts';

export const creationJobSummarySchema = z.strictObject({
  id: z.uuid(), kind: z.string().min(1).max(64),
  status: z.enum(['queued', 'running', 'succeeded', 'failed', 'canceled']),
  inputRevision: z.number().int().nonnegative(), requestId: z.uuid(),
  attempt: z.number().int().nonnegative(), createdAt: z.iso.datetime(), updatedAt: z.iso.datetime(),
});
export type CreationJobSummary = z.infer<typeof creationJobSummarySchema>;
export const creationEventEnvelopeSchema = z.strictObject({
  schemaVersion: z.literal(1), draftId: z.uuid(), jobId: z.uuid().nullable(),
  inputRevision: z.number().int().nonnegative(), sequence: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  kind: z.enum(['snapshot', 'job_queued', 'job_started', 'job_completed', 'job_failed', 'job_canceled']),
  snapshot: creationSnapshotSchema, job: creationJobSummarySchema.nullable(), createdAt: z.iso.datetime(),
});
export type CreationEventEnvelope = z.infer<typeof creationEventEnvelopeSchema>;
export const creationStreamFrameSchema = z.union([
  creationEventEnvelopeSchema,
  z.strictObject({ kind: z.literal('heartbeat'), cursor: z.number().int().nonnegative() }),
]);
