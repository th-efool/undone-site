import { z } from 'zod';
import { PEDAGOGICAL_DIMENSIONS } from '@/src/shared/curriculum/pedagogicalVector.types';
import { understandingReceiptSchema } from './processing';
import { retainedObjectRefSchema } from './storage';

const checksum = z.string().regex(/^[a-f0-9]{64}$/);
const artifact = retainedObjectRefSchema.extend({ kind: z.literal('artifact') });
export const analysisProposalSchema = z.strictObject({
  analyses: z.array(z.strictObject({ chunkIndex: z.number().int().min(0).max(199),
    vector: z.record(z.enum(PEDAGOGICAL_DIMENSIONS), z.number().min(0).max(1)),
    isStrictlyLinear: z.boolean(), confidence: z.number().min(0).max(1),
    reasoning: z.string().trim().min(1).max(2000),
  })).min(1).max(200),
});
export type AnalysisProposal = z.infer<typeof analysisProposalSchema>;
export const analysisReceiptSchema = z.strictObject({
  schemaVersion: z.literal(1), requestId: z.uuid(), inputFingerprint: checksum, partitionId: checksum,
  source: understandingReceiptSchema.shape.source,
  chunking: z.strictObject({ inputFingerprint: checksum, artifact }),
  model: understandingReceiptSchema.shape.model, proposal: analysisProposalSchema,
});
export const analysisCheckpointSchema = z.strictObject({
  phase: z.literal('analysis'), requestId: z.uuid(), inputRevision: z.number().int().nonnegative(),
  inputFingerprint: checksum, chunkingFingerprint: checksum,
  total: z.number().int().min(1).max(1000), partitionIds: z.array(checksum).min(1).max(1000),
  completed: z.array(z.strictObject({ partitionId: checksum, chunkCount: z.number().int().min(1).max(200), artifact })).max(1000),
}).superRefine((checkpoint, ctx) => {
  if (checkpoint.partitionIds.length !== checkpoint.total || new Set(checkpoint.partitionIds).size !== checkpoint.total ||
    checkpoint.completed.length > checkpoint.total || checkpoint.completed.some((item, index) => item.partitionId !== checkpoint.partitionIds[index]) ||
    new Set(checkpoint.completed.map(item => item.artifact.id)).size !== checkpoint.completed.length ||
    checkpoint.completed.reduce((sum, item) => sum + item.chunkCount, 0) > 2500) {
    ctx.addIssue({ code: 'custom', message: 'Invalid analysis coverage ledger' });
  }
});
export type AnalysisCheckpoint = z.infer<typeof analysisCheckpointSchema>;
