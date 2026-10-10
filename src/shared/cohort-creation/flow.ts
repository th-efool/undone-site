import { z } from 'zod';
import {
  creationErrorSchema, creationSnapshotSchema, querySchema,
  recommendationResultSchema, startingPointSchema,
  type CreationSnapshot, type WorkspaceStage,
} from './contracts';
import { materialManifestSchema } from './materials';
import { webMaterialManifestSchema } from './web';
import { retainedYoutubeMetadataSchema, youtubeMaterialManifestSchema } from './youtube';
import { githubSelectionSchema, githubMaterialManifestSchema, githubRepositoryScope } from './github';
import { notionMaterialManifestSchema } from './notion';

export const creationCommandSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('request_recommendations'), query: querySchema, requestId: z.uuid() }),
  z.strictObject({ type: z.literal('create_own') }),
  z.strictObject({ type: z.literal('choose_starting_point'), startingPoint: startingPointSchema }),
  z.strictObject({ type: z.literal('back_to_recommendations') }),
  z.strictObject({ type: z.literal('cancel_recommendations') }),
  z.strictObject({ type: z.literal('acquire_text'), materialId: z.uuid(), assetId: z.uuid(), requestId: z.uuid() }),
  z.strictObject({ type: z.literal('acquire_pdf'), materialId: z.uuid(), assetId: z.uuid(), requestId: z.uuid() }),
  z.strictObject({ type: z.literal('inspect_youtube'), materialId: z.uuid(), url: z.url().max(2048), requestId: z.uuid() }),
  z.strictObject({ type: z.literal('observe_youtube'), materialId: z.uuid(), requestId: z.uuid() }),
  z.strictObject({ type: z.literal('acquire_github'), materialId: z.uuid(), selection: githubSelectionSchema, requestId: z.uuid() }),
  z.strictObject({ type: z.literal('acquire_notion'), materialId: z.uuid(), url: z.url().max(2048), requestId: z.uuid() }),
  z.strictObject({ type: z.literal('select_youtube_units'), materialId: z.uuid(), unitIds: z.array(z.string().regex(/^[A-Za-z0-9_-]{11}$/)).max(100)
    .refine(ids => new Set(ids).size === ids.length, 'Select each video only once') }),
  z.strictObject({ type: z.literal('cancel_material_acquisition') }),
  z.strictObject({ type: z.literal('remove_material'), materialId: z.uuid() }),
  z.strictObject({ type: z.literal('acquire_web'), materialId: z.uuid(), url: z.url().max(2048), requestId: z.uuid() }),
]);
export type CreationCommand = z.infer<typeof creationCommandSchema>;
export const creationEventSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('recommendations_received'), result: recommendationResultSchema }),
  z.strictObject({ type: z.literal('operation_failed'), requestId: z.uuid(), error: creationErrorSchema }),
  z.strictObject({ type: z.literal('operation_cancelled'), requestId: z.uuid() }),
  z.strictObject({ type: z.literal('material_received'), requestId: z.uuid(), manifest: z.union([notionMaterialManifestSchema, githubMaterialManifestSchema, youtubeMaterialManifestSchema, webMaterialManifestSchema, materialManifestSchema]) }),
  z.strictObject({ type: z.literal('youtube_metadata_received'), requestId: z.uuid(), result: retainedYoutubeMetadataSchema }),
]);
export type CreationEvent = z.infer<typeof creationEventSchema>;

export function initialSnapshot(draftId: string): CreationSnapshot {
  return creationSnapshotSchema.parse({
    schemaVersion: 1, draftId, storage: 'postgres', revision: 0, inputRevision: 0,
    stage: 'recommendations', query: '', status: 'idle', activeRequestId: null,
    result: null, startingPoint: null, error: null,
  });
}

export function canEnterStage(state: CreationSnapshot, stage: WorkspaceStage): boolean {
  if (stage === 'recommendations') return state.status !== 'running';
  if (stage === 'starting_point') return state.status === 'succeeded' && state.result !== null;
  // Later-stage orchestration is deliberately disabled at the 3A boundary.
  return false;
}

export function applyCommand(state: CreationSnapshot, input: CreationCommand): CreationSnapshot {
  const command = creationCommandSchema.parse(input);
  const changed = { ...state, revision: state.revision + 1, error: null };
  switch (command.type) {
    case 'cancel_recommendations':
      if (state.stage !== 'recommendations') throw new Error('Operation is still running');
      if (!state.activeRequestId) return state;
      return applyEvent(state, { type: 'operation_cancelled', requestId: state.activeRequestId });
    case 'cancel_material_acquisition':
      if (state.stage !== 'starting_point') throw new Error('Starting point is not available');
      if (!state.activeRequestId) return state;
      return applyEvent(state, { type: 'operation_cancelled', requestId: state.activeRequestId });
    case 'request_recommendations':
      return creationSnapshotSchema.parse({
        ...changed, query: command.query, inputRevision: state.inputRevision + 1,
        stage: 'recommendations', status: 'running', activeRequestId: command.requestId,
        result: null, startingPoint: null,
        materials: [], extractions: [], materialRefs: [], youtubeSources: [], lastMaterialRequestId: null,
      });
    case 'create_own':
      if (!canEnterStage(state, 'starting_point')) throw new Error('Intent is not ready');
      return creationSnapshotSchema.parse({ ...changed, stage: 'starting_point' });
    case 'choose_starting_point':
      if (state.stage !== 'starting_point' || state.status === 'running' || !state.result) throw new Error('Starting point is not available');
      return creationSnapshotSchema.parse({ ...changed, startingPoint: command.startingPoint, status: 'succeeded' });
    case 'acquire_text':
    case 'acquire_pdf':
    case 'inspect_youtube':
    case 'acquire_github':
    case 'acquire_notion':
    case 'acquire_web': {
      if (state.stage !== 'starting_point' || state.startingPoint !== 'have_material' || state.status === 'running' || !state.result) throw new Error('Starting point is not available');
      if (command.type === 'acquire_github' && state.materials.filter(source => source.id !== command.materialId).reduce((sum, source) => sum + source.selectedUnitIds.length, 0) >= 100) throw new Error('The draft already has 100 selected units. Remove a source before adding GitHub files.');
      if (command.type === 'acquire_notion' && state.materials.filter(source => source.id !== command.materialId).reduce((sum, source) => sum + source.selectedUnitIds.length, 0) >= 100) throw new Error('The draft already has 100 selected units. Remove a source before adding a Notion page.');
      const material = { id: command.materialId, ...(command.type === 'acquire_github'
        ? { kind: 'github' as const, input: { kind: 'url' as const, url: command.selection.url, repositoryScope: githubRepositoryScope(command.selection) } }
        : command.type === 'acquire_notion'
        ? { kind: 'notion' as const, input: { kind: 'url' as const, url: command.url } }
        : command.type === 'inspect_youtube'
        ? { kind: new URL(command.url).pathname === '/playlist' ? 'youtube_playlist' as const : 'youtube_video' as const, input: { kind: 'url' as const, url: command.url } }
        : command.type !== 'acquire_web'
        ? { kind: command.type === 'acquire_pdf' ? 'pdf' as const : 'markdown' as const, input: { kind: 'upload' as const, assetId: command.assetId } }
        : { kind: 'web' as const, input: { kind: 'url' as const, url: command.url } }),
        selectedUnitIds: [], status: 'acquiring' as const };
      return creationSnapshotSchema.parse({ ...changed, inputRevision: state.inputRevision + 1,
        status: 'running', activeRequestId: command.requestId, lastMaterialRequestId: command.requestId,
        materials: [...state.materials.filter(source => source.id !== material.id), material],
        materialRefs: state.materialRefs.filter(ref => ref.materialId !== material.id),
        youtubeSources: state.youtubeSources.filter(source => source.materialId !== material.id),
        extractions: state.extractions.filter(extraction => extraction.materialId !== material.id) });
    }
    case 'remove_material': {
      if (state.stage !== 'starting_point' || state.startingPoint !== 'have_material' || state.status === 'running' ||
        !state.materials.some(source => source.id === command.materialId)) throw new Error('Starting point is not available');
      return creationSnapshotSchema.parse({ ...changed, inputRevision: state.inputRevision + 1,
        status: 'succeeded', lastMaterialRequestId: null,
        materials: state.materials.filter(source => source.id !== command.materialId),
        materialRefs: state.materialRefs.filter(ref => ref.materialId !== command.materialId),
        youtubeSources: state.youtubeSources.filter(source => source.materialId !== command.materialId),
        extractions: state.extractions.filter(extraction => extraction.materialId !== command.materialId) });
    }
    case 'observe_youtube': {
      const source = state.materials.find(source => source.id === command.materialId);
      const preview = state.youtubeSources.find(source => source.materialId === command.materialId);
      if (state.stage !== 'starting_point' || state.startingPoint !== 'have_material' || state.status === 'running' || !state.result ||
        !source || !preview || !source.selectedUnitIds.length || source.status === 'ready') throw new Error('Save a video selection before observing it');
      return creationSnapshotSchema.parse({ ...changed, inputRevision: state.inputRevision + 1, status: 'running',
        activeRequestId: command.requestId, lastMaterialRequestId: command.requestId,
        materials: state.materials.map(item => item.id === source.id ? { ...item, status: 'acquiring' } : item) });
    }
    case 'select_youtube_units': {
      const preview = state.youtubeSources.find(source => source.materialId === command.materialId);
      if (state.stage !== 'starting_point' || state.startingPoint !== 'have_material' || state.status === 'running' || !preview ||
        command.unitIds.some(id => !preview.units.some(unit => unit.unitId === id))) throw new Error('Starting point is not available');
      return creationSnapshotSchema.parse({ ...changed, inputRevision: state.inputRevision + 1, status: 'succeeded', lastMaterialRequestId: null,
        materials: state.materials.map(source => source.id === command.materialId ? { ...source, status: 'needs_input', selectedUnitIds: command.unitIds } : source),
        youtubeSources: state.youtubeSources.map(source => source.materialId === command.materialId
          ? { ...source, observations: source.observations.filter(unit => command.unitIds.includes(unit.unitId)) } : source),
        materialRefs: state.materialRefs.map(ref => ref.materialId === command.materialId
          ? { ...ref, ids: [preview.metadataArtifact.id, ...preview.observations.filter(unit => command.unitIds.includes(unit.unitId)).map(unit => unit.artifact.id)] } : ref),
        extractions: state.extractions.filter(extraction => extraction.materialId !== command.materialId) });
    }
    case 'back_to_recommendations':
      if (!canEnterStage(state, 'recommendations')) throw new Error('Operation is still running');
      return creationSnapshotSchema.parse({ ...changed, stage: 'recommendations', status: state.result ? 'succeeded' : state.status });
  }
}

export function applyEvent(state: CreationSnapshot, input: CreationEvent): CreationSnapshot {
  const event = creationEventSchema.parse(input);
  const requestId = event.type === 'recommendations_received' ? event.result.requestId : event.requestId;
  if (state.status !== 'running' || state.activeRequestId !== requestId) return state;
  if (event.type === 'recommendations_received' && (
    state.stage !== 'recommendations' ||
    event.result.inputRevision !== state.inputRevision || event.result.intent.rawQuery !== state.query
  )) return state;
  if (event.type === 'material_received' && (state.stage !== 'starting_point' ||
    event.manifest.inputRevision !== state.inputRevision || !state.materials.some(source =>
      source.id === event.manifest.source.id && source.status === 'acquiring' && source.kind === event.manifest.source.kind &&
      ((source.input.kind === 'upload' && event.manifest.source.input.kind === 'upload' && source.input.assetId === event.manifest.source.input.assetId) ||
      (source.input.kind === 'url' && event.manifest.source.input.kind === 'url' && source.input.url === event.manifest.source.input.url))))) return state;
  if (event.type === 'youtube_metadata_received' && (state.stage !== 'starting_point' || event.result.receipt.inputRevision !== state.inputRevision ||
    !state.materials.some(source => source.id === event.result.receipt.materialId && source.status === 'acquiring' &&
      source.kind === event.result.receipt.metadata.kind && source.input.kind === 'url' && source.input.url === event.result.receipt.metadata.sourceUrl))) return state;
  const changed = { ...state, revision: state.revision + 1, activeRequestId: null };
  switch (event.type) {
    case 'youtube_metadata_received': {
      const { receipt, artifact, inputFingerprint } = event.result;
      return creationSnapshotSchema.parse({ ...changed, status: 'succeeded', error: null,
        materials: state.materials.map(source => source.id === receipt.materialId ? { ...source, status: 'needs_input' } : source),
        materialRefs: [...state.materialRefs.filter(ref => ref.materialId !== receipt.materialId), { materialId: receipt.materialId, ids: [artifact.id] }],
        youtubeSources: [...state.youtubeSources.filter(source => source.materialId !== receipt.materialId), {
          materialId: receipt.materialId, sourceRevision: receipt.inputRevision, metadataFingerprint: inputFingerprint, metadataArtifact: artifact,
          units: receipt.metadata.units.map(unit => ({ unitId: unit.videoId, title: unit.title, durationSeconds: unit.durationSeconds })) }] });
    }
    case 'material_received':
      return creationSnapshotSchema.parse({ ...changed, status: 'succeeded', error: null,
        youtubeSources: state.youtubeSources.map(source => source.materialId === event.manifest.source.id && 'youtube' in event.manifest
          ? { ...source, observations: event.manifest.youtube.units } : source),
        materialRefs: [...state.materialRefs.filter(ref => ref.materialId !== event.manifest.source.id),
          { materialId: event.manifest.source.id, ids: [event.manifest.retainedSource.id, event.manifest.extractionArtifact.id,
            ...('receiptArtifact' in event.manifest ? [event.manifest.receiptArtifact.id] : []),
            ...('youtube' in event.manifest ? event.manifest.youtube.units.map(unit => unit.artifact.id) : [])] }],
        materials: state.materials.map(source => source.id === event.manifest.source.id ? event.manifest.source : source),
        extractions: [...state.extractions.filter(extraction => extraction.materialId !== event.manifest.source.id), event.manifest.extraction] });
    case 'recommendations_received':
      return creationSnapshotSchema.parse({ ...changed, status: 'succeeded', result: event.result, error: null });
    case 'operation_failed':
      return creationSnapshotSchema.parse({ ...changed, status: 'failed', error: event.error,
        materials: state.materials.map(source => source.status === 'acquiring' ? { ...source, status: 'failed' } : source) });
    case 'operation_cancelled':
      return creationSnapshotSchema.parse({ ...changed, status: 'canceled', error: null,
        materials: state.materials.map(source => source.status === 'acquiring' ? { ...source, status: 'pending' } : source) });
  }
}
