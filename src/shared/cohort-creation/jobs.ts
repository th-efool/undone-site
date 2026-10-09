import { z } from 'zod';
import { materialSourceSchema } from './contracts';
export const textAcquisitionRequestSchema = z.strictObject({
  requestId: z.uuid(), inputRevision: z.number().int().nonnegative(),
  source: materialSourceSchema.refine(source => source.kind === 'markdown' && source.input.kind === 'upload', 'An uploaded text source is required'),
});
export type TextAcquisitionRequest = z.infer<typeof textAcquisitionRequestSchema>;
