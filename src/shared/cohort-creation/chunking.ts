import { z } from 'zod';
import { chunkSchema, fieldValueSchema } from './contracts';

export const CHUNK_LIMITS = { perUnit: 200, perDraft: 2500, segmentsPerChunk: 100 } as const;
/** Boundary candidates are existing ordered extraction segments, never generated text. */
export const chunkBoundaryProposalSchema = z.strictObject({
  chunks: z.array(z.strictObject({
    title: z.string().trim().min(1).max(300), summary: z.string().trim().min(1).max(2000),
    startSegmentId: z.string().min(1).max(128), endSegmentId: z.string().min(1).max(128),
    conceptIndices: z.array(z.number().int().min(0).max(19)).max(20),
  })).min(1).max(CHUNK_LIMITS.perUnit),
});
export type ChunkBoundaryProposal = z.infer<typeof chunkBoundaryProposalSchema>;
// Extend the existing application chunk contract rather than replacing it.
export const groundedChunkSchema = chunkSchema.extend({
  partitionId: z.string().regex(/^[a-f0-9]{64}$/), unitId: z.string().min(1).max(128),
  position: z.number().int().nonnegative(),
  summary: fieldValueSchema(z.string().trim().min(1).max(2000)),
  conceptIndices: z.array(z.number().int().min(0).max(19)).max(20),
  contentOrigin: z.enum(['user', 'external', 'ai']),
  coverage: z.strictObject({ scope: z.string().min(1), exhaustive: z.boolean(), limitations: z.array(z.string()) }),
});
export type GroundedChunk = z.infer<typeof groundedChunkSchema>;
