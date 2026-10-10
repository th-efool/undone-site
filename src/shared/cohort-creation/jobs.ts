import { refinementProposalSchema } from './review';
import { z } from 'zod';
import { creationSnapshotSchema, materialSourceSchema, youtubeSourceStateSchema } from './contracts';
export const understandingRequestSchema = z.strictObject({ requestId: z.uuid(), inputRevision: z.number().int().nonnegative(), snapshot: creationSnapshotSchema })
  .superRefine((request, ctx) => {
    const state = request.snapshot;
    if (request.inputRevision !== state.inputRevision || state.stage !== 'starting_point' || state.status === 'running' || state.processing !== null ||
      !state.result || !state.materials.length || state.materials.some(source => source.status !== 'ready') || state.extractions.length !== state.materials.length ||
      state.extractions.some(extraction => !state.materialRefs.some(ref => ref.materialId === extraction.materialId && ref.ids.includes(extraction.artifactRef)))) {
      ctx.addIssue({ code: 'custom', message: 'Accepted retained material is required for understanding' });
    }
  });
export type UnderstandingRequest = z.infer<typeof understandingRequestSchema>;
export const chunkingRequestSchema = z.strictObject({ requestId: z.uuid(), inputRevision: z.number().int().nonnegative(), snapshot: creationSnapshotSchema })
  .superRefine((request, ctx) => {
    const state = request.snapshot;
    if (request.inputRevision !== state.inputRevision || state.stage !== 'processing' || state.status !== 'succeeded' ||
      !state.processing?.complete || !state.processing.checkpoint || state.processing.phase !== 'understanding' || state.processing.chunking !== null) {
      ctx.addIssue({ code: 'custom', message: 'Complete accepted understanding is required for chunking' });
    }
  });
export type ChunkingRequest = z.infer<typeof chunkingRequestSchema>;
export const analysisRequestSchema = z.strictObject({ requestId: z.uuid(), inputRevision: z.number().int().nonnegative(), snapshot: creationSnapshotSchema })
  .superRefine((request, ctx) => {
    const state = request.snapshot;
    if (request.inputRevision !== state.inputRevision || state.stage !== 'processing' || state.status !== 'succeeded' ||
      !state.processing?.chunking?.complete || !state.processing.chunking.checkpoint || state.processing.phase !== 'chunking' || state.processing.analysis !== null) {
      ctx.addIssue({ code: 'custom', message: 'Complete accepted chunking is required for analysis' });
    }
  });
export type AnalysisRequest = z.infer<typeof analysisRequestSchema>;
export const buildingRequestSchema = z.strictObject({ requestId: z.uuid(), inputRevision: z.number().int().nonnegative(), snapshot: creationSnapshotSchema })
  .superRefine((request, ctx) => {
    const state = request.snapshot;
    if (request.inputRevision !== state.inputRevision || state.stage !== 'processing' || state.status !== 'succeeded' ||
      !state.processing?.analysis?.complete || !state.processing.analysis.checkpoint || state.processing.phase !== 'analysis' || state.processing.building !== null) {
      ctx.addIssue({ code: 'custom', message: 'Complete accepted analysis is required for building' });
    }
  });
export type BuildingRequest = z.infer<typeof buildingRequestSchema>;
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

export const refinementRequestSchema = z.strictObject({ requestId: z.uuid(), inputRevision: z.number().int().nonnegative(), snapshot: creationSnapshotSchema })
  .superRefine((request, ctx) => {
    const state = request.snapshot;
    if (state.stage !== 'review' || state.status !== 'succeeded' || !state.review || !state.processing?.building?.complete ||
      state.inputRevision !== request.inputRevision || state.review.request?.requestId !== request.requestId ||
      state.review.request.baseEditRevision !== state.review.editRevision || state.review.orphanedLessonIds.length) ctx.addIssue({ code: 'custom', message: 'Current owned review is required for refinement' });
  });
export type RefinementRequest = z.infer<typeof refinementRequestSchema>;
export const refinementResultSchema = z.strictObject({ requestId: z.uuid(), inputRevision: z.number().int().nonnegative(), baseEditRevision: z.number().int().nonnegative(),
  buildFingerprint: z.string().regex(/^[a-f0-9]{64}$/), proposal: refinementProposalSchema });
export type RefinementResult = z.infer<typeof refinementResultSchema>;

export const publicationRequestSchema = z.strictObject({ requestId: z.uuid(), inputRevision: z.number().int().nonnegative(), mode: z.enum(['private_activation', 'public_publish']),
  cohortId: z.uuid(), snapshotHash: z.string().regex(/^[a-f0-9]{64}$/), snapshot: creationSnapshotSchema })
  .superRefine((request, ctx) => {
    const state = request.snapshot;
    if (state.stage !== 'review' || state.status !== 'succeeded' || state.activeRequestId !== null || state.inputRevision !== request.inputRevision ||
      !state.review || state.review.orphanedLessonIds.length || state.review.proposal || state.review.request || !state.processing?.building?.complete ||
      state.review.buildFingerprint !== state.processing.building.checkpoint?.inputFingerprint || state.publication?.requestId !== request.requestId ||
      state.publication.mode !== request.mode || state.publication.cohortId !== request.cohortId || state.publication.snapshotHash !== request.snapshotHash) ctx.addIssue({ code: 'custom', message: 'Current accepted review is required for publication' });
  });
export type PublicationRequest = z.infer<typeof publicationRequestSchema>;
