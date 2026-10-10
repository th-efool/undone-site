import { z } from 'zod';
import { PEDAGOGICAL_DIMENSIONS } from '@/src/shared/curriculum/pedagogicalVector.types';
import { retainedObjectRefSchema } from './storage';

const key = z.string().min(1).max(128); const checksum = z.string().regex(/^[a-f0-9]{64}$/);
export const publicationModeSchema = z.enum(['private_activation', 'public_publish']);
export type PublicationMode = z.infer<typeof publicationModeSchema>;
// Keep this source-location projection independent of contracts.ts to avoid snapshot/schema cycles.
const sourceRef = z.strictObject({ materialId: key, unitId: key, segmentId: key,
  anchor: z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('text'), start: z.number().int().nonnegative(), end: z.number().int().positive() }),
    z.strictObject({ kind: z.literal('video'), startSeconds: z.number().nonnegative(), endSeconds: z.number().nonnegative(), estimated: z.boolean() }),
    z.strictObject({ kind: z.literal('page'), page: z.number().int().positive() }),
    z.strictObject({ kind: z.literal('block'), blockId: key }),
    z.strictObject({ kind: z.literal('file'), commit: key, path: z.string().min(1), startLine: z.number().int().positive(), endLine: z.number().int().positive() }),
  ]) }).refine(({ anchor }) => anchor.kind === 'text' ? anchor.end > anchor.start : anchor.kind === 'video' ? anchor.endSeconds > anchor.startSeconds : anchor.kind === 'file' ? anchor.endLine >= anchor.startLine : true);
export const deliveryChunkSchema = z.strictObject({ id: key, title: z.string().trim().min(1).max(2000), text: z.string().min(1),
  sourceRefs: z.array(sourceRef).min(1).max(100), contentOrigin: z.enum(['user', 'external', 'ai']),
  coverage: z.strictObject({ scope: z.string().min(1), exhaustive: z.boolean(), limitations: z.array(z.string()) }),
  durationSeconds: z.number().nonnegative(), durationMethod: z.enum(['source', 'reading_estimate', 'model_estimate']),
  vector: z.record(z.enum(PEDAGOGICAL_DIMENSIONS), z.number().min(0).max(1)), isStrictlyLinear: z.boolean(), order: z.number().int().nonnegative(),
  startSeconds: z.number().nonnegative().optional(), endSeconds: z.number().nonnegative().optional(),
});
export type DeliveryChunk = z.infer<typeof deliveryChunkSchema>;
export const deliveryArtifactSchema = z.strictObject({ schemaVersion: z.literal(1), requestId: z.uuid(), snapshotHash: checksum, cohortId: key,
  lessonId: key, sourceLessonId: key, buildingFingerprint: checksum,
  title: z.string().trim().min(1).max(2000), objectives: z.array(z.string().trim().min(1).max(2000)).max(20),
  chunks: z.array(deliveryChunkSchema).min(1).max(200),
});
export type DeliveryArtifact = z.infer<typeof deliveryArtifactSchema>;
export const publicationReceiptSchema = z.strictObject({ requestId: z.uuid(), mode: publicationModeSchema, snapshotHash: checksum, cohortId: key, committedAt: z.iso.datetime() });
export type PublicationReceipt = z.infer<typeof publicationReceiptSchema>;
export const publicationCheckpointSchema = z.strictObject({ phase: z.literal('publication'), requestId: z.uuid(), mode: publicationModeSchema,
  snapshotHash: checksum, cohortId: key, total: z.number().int().min(1).max(2500), lessonIds: z.array(key).min(1).max(2500),
  completed: z.array(z.strictObject({ lessonId: key, artifact: retainedObjectRefSchema.extend({ kind: z.literal('artifact') }) })).max(2500),
}).superRefine((checkpoint, ctx) => {
  if (checkpoint.lessonIds.length !== checkpoint.total || new Set(checkpoint.lessonIds).size !== checkpoint.total || checkpoint.completed.length > checkpoint.total ||
    checkpoint.completed.some((entry, index) => entry.lessonId !== checkpoint.lessonIds[index]) ||
    new Set(checkpoint.completed.map(entry => entry.artifact.id)).size !== checkpoint.completed.length) ctx.addIssue({ code: 'custom', message: 'Invalid publication artifact inventory' });
});
export type PublicationCheckpoint = z.infer<typeof publicationCheckpointSchema>;
