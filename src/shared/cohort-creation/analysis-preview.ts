import { z } from 'zod';
import { chunkAnalysisSchema } from './artifacts';
import { CHUNK_LIMITS, groundedChunkSchema } from './chunking';

/** Accepted display data only; receipts and original source bodies stay on the server. */
export const analysisPreviewSchema = z.strictObject({
  revision: z.number().int().nonnegative(),
  chunks: z.array(groundedChunkSchema).max(CHUNK_LIMITS.perDraft),
  analyses: z.array(chunkAnalysisSchema).max(CHUNK_LIMITS.perDraft),
}).superRefine((value, context) => {
  const chunks = new Set(value.chunks.map(chunk => chunk.id));
  const analyses = new Set(value.analyses.map(analysis => analysis.chunkId));
  if (chunks.size !== value.chunks.length || analyses.size !== value.analyses.length ||
    value.analyses.some(analysis => !chunks.has(analysis.chunkId))) {
    context.addIssue({ code: 'custom', message: 'Analysis must reference unique accepted chunks.' });
  }
});
export type AnalysisPreview = z.infer<typeof analysisPreviewSchema>;
