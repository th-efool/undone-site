import { analysisCheckpointSchema } from './analysis';
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
import { discoveryResultSchema } from './discovery';
import { understandingCheckpointSchema, chunkingCheckpointSchema } from './processing';

export const creationCommandSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('request_recommendations'), query: querySchema, requestId: z.uuid() }),
  z.strictObject({ type: z.literal('create_own') }),
  z.strictObject({ type: z.literal('understand_material'), requestId: z.uuid() }),
  z.strictObject({ type: z.literal('analyze_material'), requestId: z.uuid() }),
  z.strictObject({ type: z.literal('chunk_material'), requestId: z.uuid() }),
  z.strictObject({ type: z.literal('cancel_processing') }),
  z.strictObject({ type: z.literal('back_to_materials') }),
  z.strictObject({ type: z.literal('discover_material'), requestId: z.uuid() }),
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
  z.strictObject({ type: z.literal('discovery_received'), requestId: z.uuid(), result: discoveryResultSchema }),
  z.strictObject({ type: z.literal('understanding_received'), requestId: z.uuid(), result: understandingCheckpointSchema }),
  z.strictObject({ type: z.literal('analysis_received'), requestId: z.uuid(), result: analysisCheckpointSchema }),
  z.strictObject({ type: z.literal('chunking_received'), requestId: z.uuid(), result: chunkingCheckpointSchema }),
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
    case 'analyze_material':
      if (!['starting_point', 'processing'].includes(state.stage) || state.status === 'running' || !state.processing?.chunking?.complete || !state.processing.chunking.checkpoint) throw new Error('Chunking is not complete');
      return creationSnapshotSchema.parse({ ...changed, stage: 'processing', status: 'running', activeRequestId: command.requestId,
        processing: { ...state.processing, phase: 'analysis', analysis: { requestId: command.requestId, checkpoint: null, complete: false } } });
    case 'chunk_material':
      if (!['starting_point', 'processing'].includes(state.stage) || state.status === 'running' || !state.processing?.complete || !state.processing.checkpoint) throw new Error('Understanding is not complete');
      return creationSnapshotSchema.parse({ ...changed, stage: 'processing', status: 'running', activeRequestId: command.requestId,
        processing: { ...state.processing, phase: 'chunking', analysis: null, chunking: { requestId: command.requestId, checkpoint: null, complete: false } } });
    case 'understand_material':
      if (!['starting_point', 'processing'].includes(state.stage) || state.status === 'running' || !state.result || !state.materials.length ||
        state.materials.some(source => source.status !== 'ready' || !source.selectedUnitIds.length) || state.extractions.length !== state.materials.length ||
        state.extractions.some(extraction => !state.materialRefs.some(ref => ref.materialId === extraction.materialId && ref.ids.includes(extraction.artifactRef)))) throw new Error('Retained material is not ready');
      return creationSnapshotSchema.parse({ ...changed, stage: 'processing', status: 'running', activeRequestId: command.requestId,
        processing: { requestId: command.requestId, inputRevision: state.inputRevision, checkpoint: null, complete: false } });
    case 'cancel_processing':
      if (state.stage !== 'processing') throw new Error('Processing is not available');
      return state.activeRequestId ? applyEvent(state, { type: 'operation_cancelled', requestId: state.activeRequestId }) : state;
    case 'back_to_materials':
      if (state.stage !== 'processing' || state.status === 'running') throw new Error('Processing is still running');
      return creationSnapshotSchema.parse({ ...changed, stage: 'starting_point', status: 'succeeded' });
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
        materials: [], extractions: [], materialRefs: [], youtubeSources: [], lastMaterialRequestId: null, discovery: null, processing: null,
      });
    case 'create_own':
      if (!canEnterStage(state, 'starting_point')) throw new Error('Intent is not ready');
      return creationSnapshotSchema.parse({ ...changed, stage: 'starting_point' });
    case 'discover_material':
      if (state.stage !== 'starting_point' || !['find_material', 'have_goal'].includes(state.startingPoint ?? '') || state.status === 'running' || !state.result) throw new Error('Starting point is not available');
      return creationSnapshotSchema.parse({ ...changed, processing: null, inputRevision: state.inputRevision + 1, status: 'running', activeRequestId: command.requestId,
        discovery: { requestId: command.requestId, inputRevision: state.inputRevision + 1, checkpoint: null, result: null } });
    case 'choose_starting_point':
      if (state.stage !== 'starting_point' || state.status === 'running' || !state.result) throw new Error('Starting point is not available');
      return creationSnapshotSchema.parse({ ...changed, processing: null, startingPoint: command.startingPoint, status: 'succeeded',
        discovery: state.startingPoint === command.startingPoint ? state.discovery : null });
    case 'acquire_text':
    case 'acquire_pdf':
    case 'inspect_youtube':
    case 'acquire_github':
    case 'acquire_notion':
    case 'acquire_web': {
      const url = command.type === 'acquire_github' ? command.selection.url : 'url' in command ? command.url : null;
      const kind = command.type === 'acquire_github' ? 'github' : command.type === 'inspect_youtube'
        ? new URL(command.url).pathname === '/playlist' ? 'youtube_playlist' : 'youtube_video' : command.type === 'acquire_web' ? 'web' : null;
      const discovered = state.discovery?.result?.candidates.find(candidate => candidate.url === url && candidate.kind === kind);
      const previous = state.materials.find(source => source.id === command.materialId);
      const sameInput = previous && (url !== null
        ? previous.input.kind === 'url' && previous.input.url === url && (
          command.type === 'acquire_github' ? previous.kind === 'github' && JSON.stringify(previous.input.repositoryScope) === JSON.stringify(githubRepositoryScope(command.selection))
          : command.type === 'acquire_notion' ? previous.kind === 'notion' : previous.kind === kind)
        : previous.input.kind === 'upload' && 'assetId' in command && previous.input.assetId === command.assetId &&
          previous.kind === (command.type === 'acquire_pdf' ? 'pdf' : 'markdown'));
      if (state.stage !== 'starting_point' || !state.startingPoint || (state.startingPoint !== 'have_material' && !discovered && !sameInput) || state.status === 'running' || !state.result) throw new Error('Starting point is not available');
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
        ...(discovered && state.discovery?.checkpoint?.observationArtifact ? { discoveredFrom: {
          requestId: state.discovery.requestId, inputRevision: state.discovery.inputRevision, candidateKey: discovered.key,
          searchArtifactId: state.discovery.checkpoint.searchArtifact.id, observationArtifactId: state.discovery.checkpoint.observationArtifact.id } }
          : sameInput && previous?.discoveredFrom ? { discoveredFrom: previous.discoveredFrom } : {}),
        selectedUnitIds: [], status: 'acquiring' as const };
      return creationSnapshotSchema.parse({ ...changed, processing: null, inputRevision: state.inputRevision + 1,
        status: 'running', activeRequestId: command.requestId, lastMaterialRequestId: command.requestId,
        materials: [...state.materials.filter(source => source.id !== material.id), material],
        materialRefs: state.materialRefs.filter(ref => ref.materialId !== material.id),
        youtubeSources: state.youtubeSources.filter(source => source.materialId !== material.id),
        extractions: state.extractions.filter(extraction => extraction.materialId !== material.id) });
    }
    case 'remove_material': {
      if (state.stage !== 'starting_point' || !state.startingPoint || state.status === 'running' ||
        !state.materials.some(source => source.id === command.materialId)) throw new Error('Starting point is not available');
      return creationSnapshotSchema.parse({ ...changed, processing: null, inputRevision: state.inputRevision + 1,
        status: 'succeeded', lastMaterialRequestId: null,
        materials: state.materials.filter(source => source.id !== command.materialId),
        materialRefs: state.materialRefs.filter(ref => ref.materialId !== command.materialId),
        youtubeSources: state.youtubeSources.filter(source => source.materialId !== command.materialId),
        extractions: state.extractions.filter(extraction => extraction.materialId !== command.materialId) });
    }
    case 'observe_youtube': {
      const source = state.materials.find(source => source.id === command.materialId);
      const preview = state.youtubeSources.find(source => source.materialId === command.materialId);
      if (state.stage !== 'starting_point' || !state.startingPoint || state.status === 'running' || !state.result ||
        !source || !preview || !source.selectedUnitIds.length || source.status === 'ready') throw new Error('Save a video selection before observing it');
      return creationSnapshotSchema.parse({ ...changed, processing: null, inputRevision: state.inputRevision + 1, status: 'running',
        activeRequestId: command.requestId, lastMaterialRequestId: command.requestId,
        materials: state.materials.map(item => item.id === source.id ? { ...item, status: 'acquiring' } : item) });
    }
    case 'select_youtube_units': {
      const preview = state.youtubeSources.find(source => source.materialId === command.materialId);
      if (state.stage !== 'starting_point' || !state.startingPoint || state.status === 'running' || !preview ||
        command.unitIds.some(id => !preview.units.some(unit => unit.unitId === id))) throw new Error('Starting point is not available');
      return creationSnapshotSchema.parse({ ...changed, processing: null, inputRevision: state.inputRevision + 1, status: 'succeeded', lastMaterialRequestId: null,
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
  if (event.type === 'discovery_received' && (state.stage !== 'starting_point' || state.discovery?.requestId !== requestId ||
    event.result.checkpoint.inputRevision !== state.inputRevision || event.result.checkpoint.requestId !== requestId)) return state;
  if (event.type === 'understanding_received' && (state.stage !== 'processing' || state.processing?.phase !== 'understanding' || state.processing.requestId !== requestId ||
    event.result.requestId !== requestId || event.result.inputRevision !== state.inputRevision || event.result.completed.length !== event.result.total)) return state;
  if (event.type === 'analysis_received' && (state.stage !== 'processing' || state.processing?.phase !== 'analysis' || state.processing.analysis?.requestId !== requestId ||
    event.result.requestId !== requestId || event.result.inputRevision !== state.inputRevision || event.result.completed.length !== event.result.total ||
    event.result.chunkingFingerprint !== state.processing.chunking?.checkpoint?.inputFingerprint ||
    JSON.stringify(event.result.partitionIds) !== JSON.stringify(state.processing.chunking.checkpoint.partitionIds) ||
    event.result.completed.some((item, index) => item.chunkCount !== state.processing!.chunking!.checkpoint!.completed[index]?.chunkCount))) return state;
  if (event.type === 'chunking_received' && (state.stage !== 'processing' || state.processing?.phase !== 'chunking' || state.processing.chunking?.requestId !== requestId ||
    event.result.requestId !== requestId || event.result.inputRevision !== state.inputRevision || event.result.completed.length !== event.result.total ||
    event.result.understandingFingerprint !== state.processing.checkpoint?.inputFingerprint ||
    JSON.stringify(event.result.partitionIds) !== JSON.stringify(state.processing.checkpoint.partitionIds))) return state;
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
    case 'analysis_received':
      return creationSnapshotSchema.parse({ ...changed, status: 'succeeded', error: null, processing: { ...state.processing!, analysis: { requestId, checkpoint: event.result, complete: true } } });
    case 'chunking_received':
      return creationSnapshotSchema.parse({ ...changed, status: 'succeeded', error: null,
        processing: { ...state.processing!, chunking: { requestId, checkpoint: event.result, complete: true } } });
    case 'understanding_received':
      return creationSnapshotSchema.parse({ ...changed, status: 'succeeded', error: null,
        processing: { requestId, inputRevision: state.inputRevision, checkpoint: event.result, complete: true } });
    case 'discovery_received':
      return creationSnapshotSchema.parse({ ...changed, status: 'succeeded', error: null,
        discovery: { requestId, inputRevision: state.inputRevision, checkpoint: event.result.checkpoint, result: event.result } });
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
