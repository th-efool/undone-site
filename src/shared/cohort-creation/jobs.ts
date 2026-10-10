import { z } from 'zod';
import { materialSourceSchema, youtubeSourceStateSchema } from './contracts';
export const textAcquisitionRequestSchema = z.strictObject({
  requestId: z.uuid(), inputRevision: z.number().int().nonnegative(),
  source: materialSourceSchema.refine(source => source.kind === 'markdown' && source.input.kind === 'upload', 'An uploaded text source is required'),
});
export type TextAcquisitionRequest = z.infer<typeof textAcquisitionRequestSchema>;
export const webAcquisitionRequestSchema = z.strictObject({
  requestId: z.uuid(), inputRevision: z.number().int().nonnegative(),
  source: materialSourceSchema.refine(source => source.kind === 'web' && source.input.kind === 'url', 'A web source is required'),
});
export type WebAcquisitionRequest = z.infer<typeof webAcquisitionRequestSchema>;
export const pdfAcquisitionRequestSchema = z.strictObject({
  requestId: z.uuid(), inputRevision: z.number().int().nonnegative(),
  source: materialSourceSchema.refine(source => source.kind === 'pdf' && source.input.kind === 'upload', 'An uploaded PDF source is required'),
});
export type PdfAcquisitionRequest = z.infer<typeof pdfAcquisitionRequestSchema>;
export const youtubeInspectionRequestSchema = z.strictObject({
  requestId: z.uuid(), inputRevision: z.number().int().nonnegative(),
  source: materialSourceSchema.refine(source => ['youtube_video', 'youtube_playlist'].includes(source.kind) && source.input.kind === 'url', 'A YouTube URL source is required'),
});
export type YoutubeInspectionRequest = z.infer<typeof youtubeInspectionRequestSchema>;
export const youtubeObservationRequestSchema = youtubeInspectionRequestSchema.extend({ metadata: youtubeSourceStateSchema })
  .superRefine((input, ctx) => {
    if (input.source.id !== input.metadata.materialId || !input.source.selectedUnitIds.length ||
      new Set(input.source.selectedUnitIds).size !== input.source.selectedUnitIds.length ||
      input.metadata.sourceRevision > input.inputRevision || input.source.selectedUnitIds.some(id => !input.metadata.units.some(unit => unit.unitId === id)) ||
      new Set(input.metadata.units.map(unit => unit.unitId)).size !== input.metadata.units.length ||
      new Set(input.metadata.observations.map(unit => unit.unitId)).size !== input.metadata.observations.length ||
      input.metadata.observations.some(unit => !input.source.selectedUnitIds.includes(unit.unitId))) ctx.addIssue({ code: 'custom', message: 'Invalid selected video observation request' });
  });
export type YoutubeObservationRequest = z.infer<typeof youtubeObservationRequestSchema>;
export const githubAcquisitionRequestSchema = z.strictObject({ requestId: z.uuid(), inputRevision: z.number().int().nonnegative(),
  maxUnits: z.number().int().positive().max(100), source: materialSourceSchema.refine(source => source.kind === 'github' &&
    source.input.kind === 'url' && !!source.input.repositoryScope, 'Select explicit GitHub repository paths') });
export type GithubAcquisitionRequest = z.infer<typeof githubAcquisitionRequestSchema>;
export const notionAcquisitionRequestSchema = z.strictObject({ requestId: z.uuid(), inputRevision: z.number().int().nonnegative(),
  maxUnits: z.number().int().positive().max(100), source: materialSourceSchema.refine(source => source.kind === 'notion' &&
    source.input.kind === 'url', 'Select a connected Notion page') });
export type NotionAcquisitionRequest = z.infer<typeof notionAcquisitionRequestSchema>;
