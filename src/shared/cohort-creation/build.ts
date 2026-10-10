import { z } from 'zod';
import { understandingReceiptSchema } from './processing';
import { retainedObjectRefSchema } from './storage';

const checksum = z.string().regex(/^[a-f0-9]{64}$/);
const artifact = retainedObjectRefSchema.extend({ kind: z.literal('artifact') });
export const buildProposalSchema = z.strictObject({ lessons: z.array(z.strictObject({
  title: z.string().trim().min(1).max(300), objectives: z.array(z.string().trim().min(1).max(1000)).min(1).max(20),
  chunkIndices: z.array(z.number().int().min(0).max(199)).min(1).max(200),
})).min(1).max(100) });
export type BuildProposal = z.infer<typeof buildProposalSchema>;
export const buildingReceiptSchema = z.strictObject({ schemaVersion: z.literal(1), requestId: z.uuid(),
  inputFingerprint: checksum, partitionId: checksum, source: understandingReceiptSchema.shape.source,
  analysis: z.strictObject({ inputFingerprint: checksum, artifact }), model: understandingReceiptSchema.shape.model,
  proposal: buildProposalSchema,
});
export const buildingCheckpointSchema = z.strictObject({ phase: z.literal('building'), requestId: z.uuid(),
  inputRevision: z.number().int().nonnegative(), inputFingerprint: checksum, analysisFingerprint: checksum,
  total: z.number().int().min(1).max(1000), partitionIds: z.array(checksum).min(1).max(1000),
  completed: z.array(z.strictObject({ partitionId: checksum, lessonCount: z.number().int().min(1).max(100), artifact })).max(1000),
}).superRefine((checkpoint, ctx) => {
  if (checkpoint.partitionIds.length !== checkpoint.total || new Set(checkpoint.partitionIds).size !== checkpoint.total ||
    checkpoint.completed.length > checkpoint.total || checkpoint.completed.some((item, index) => item.partitionId !== checkpoint.partitionIds[index]) ||
    new Set(checkpoint.completed.map(item => item.artifact.id)).size !== checkpoint.completed.length ||
    checkpoint.completed.reduce((sum, item) => sum + item.lessonCount, 0) > 2500) {
    ctx.addIssue({ code: 'custom', message: 'Invalid building coverage ledger' });
  }
});
export type BuildingCheckpoint = z.infer<typeof buildingCheckpointSchema>;
