import { z } from 'zod';
import { retainedObjectRefSchema } from './storage';

const checksum = z.string().regex(/^[a-f0-9]{64}$/);
export const understandingProposalSchema = z.strictObject({
  summary: z.string().trim().min(1).max(2000),
  concepts: z.array(z.strictObject({ label: z.string().trim().min(1).max(200), summary: z.string().trim().min(1).max(2000),
    segmentIds: z.array(z.string().min(1).max(128)).min(1).max(50) })).min(1).max(20),
  limitations: z.array(z.string().trim().min(1).max(1000)).max(8),
});
export type UnderstandingProposal = z.infer<typeof understandingProposalSchema>;
export const understandingCheckpointSchema = z.strictObject({ phase: z.literal('understanding'), requestId: z.uuid(),
  inputRevision: z.number().int().nonnegative(), inputFingerprint: checksum, total: z.number().int().min(1).max(1000),
  partitionIds: z.array(checksum).min(1).max(1000),
  completed: z.array(z.strictObject({ partitionId: checksum, artifact: retainedObjectRefSchema.extend({ kind: z.literal('artifact') }) })).max(1000),
}).superRefine((checkpoint, ctx) => {
  if (checkpoint.partitionIds.length !== checkpoint.total || new Set(checkpoint.partitionIds).size !== checkpoint.total ||
    checkpoint.completed.some((item, index) => item.partitionId !== checkpoint.partitionIds[index]) ||
    checkpoint.completed.length > checkpoint.total || new Set(checkpoint.completed.map(item => item.partitionId)).size !== checkpoint.completed.length ||
    new Set(checkpoint.completed.map(item => item.artifact.id)).size !== checkpoint.completed.length) ctx.addIssue({ code: 'custom', message: 'Invalid understanding coverage ledger' });
});
export type UnderstandingCheckpoint = z.infer<typeof understandingCheckpointSchema>;
export const understandingReceiptSchema = z.strictObject({ schemaVersion: z.literal(1), requestId: z.uuid(), inputFingerprint: checksum,
  partitionId: checksum, source: z.strictObject({ materialId: z.string().min(1).max(128), unitId: z.string().min(1).max(128),
    extractionVersion: checksum, artifactId: z.uuid(), segmentIds: z.array(z.string().min(1).max(128)).min(1).max(20_000) }),
  model: z.strictObject({ provider: z.string().min(1).max(256), modelId: z.string().min(1).max(256), adapterVersion: z.string().min(1).max(128) }),
  proposal: understandingProposalSchema,
});
