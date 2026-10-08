import { z } from 'zod';
import { PEDAGOGICAL_DIMENSIONS } from '@/src/shared/curriculum/pedagogicalVector.types';
import { fieldValueSchema, learningIntentSchema, materialSourceSchema, workspaceStageSchema } from './contracts';

const key = z.string().min(1).max(128);
const copy = z.string().trim().min(1).max(2000);
const revision = z.number().int().nonnegative();
// These contracts declare boundaries only; their processing/persistence starts in 3B/3C.
export const chunkAnalysisSchema = z.strictObject({
  chunkId: key,
  vector: z.record(z.enum(PEDAGOGICAL_DIMENSIONS), z.number().min(0).max(1)),
  isStrictlyLinear: z.boolean(), confidence: z.number().min(0).max(1),
  reasoning: copy, modelId: key, promptVersion: key, inputRevision: revision,
});
const lessonSchema = z.strictObject({
  id: key, title: fieldValueSchema(copy), objectives: fieldValueSchema(z.array(copy).max(20)),
  order: z.number().int().nonnegative(), type: z.enum(['VIDEO', 'ARTICLE', 'ASSIGNMENT']),
  chunkIds: z.array(key).max(200), materialIds: z.array(key).max(20),
  durationSeconds: z.number().nonnegative(),
});
export const generatedCurriculumSchema = z.strictObject({
  version: key, inputRevision: revision, title: fieldValueSchema(copy),
  description: fieldValueSchema(copy),
  seasons: z.array(z.strictObject({ id: key, title: fieldValueSchema(copy), order: z.number().int().nonnegative(), lessons: z.array(lessonSchema).max(100) })).max(100),
  warnings: z.array(copy).max(100),
});
export const reviewStateSchema = z.strictObject({
  title: fieldValueSchema(copy), description: fieldValueSchema(copy),
  coverAssetId: key.nullable(), visibility: z.enum(['PUBLIC', 'PRIVATE']),
  chatEnabled: z.boolean(), eventsEnabled: z.boolean(),
  baseRevision: revision, warnings: z.array(copy).max(100),
});
export const publicationStateSchema = z.strictObject({
  operationId: key, mode: z.enum(['private_activation', 'public_publish']),
  snapshotRevision: revision, snapshotHash: key,
  status: z.enum(['preparing', 'committed', 'failed', 'canceled']),
  cohortId: key.nullable(), committedAt: z.iso.datetime().nullable(),
});
export const customCohortDraftSchema = z.strictObject({
  id: key, ownerId: key, schemaVersion: z.literal(1), revision, inputRevision: revision,
  stage: workspaceStageSchema, intent: learningIntentSchema,
  materials: z.array(materialSourceSchema).max(20),
  artifactManifest: z.array(z.strictObject({ kind: key, artifactRef: key, inputFingerprint: key })).max(10000),
  cohortId: key.nullable(), updatedAt: z.iso.datetime(),
});
export type ChunkAnalysis = z.infer<typeof chunkAnalysisSchema>;
export type GeneratedCurriculum = z.infer<typeof generatedCurriculumSchema>;
export type ReviewState = z.infer<typeof reviewStateSchema>;
export type PublicationState = z.infer<typeof publicationStateSchema>;
export type CustomCohortDraft = z.infer<typeof customCohortDraftSchema>;
