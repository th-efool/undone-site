import { validateRefinementResult } from './refinement.service';
import { validateBuildingCheckpoint } from './building.service';
import { validateAnalysisCheckpoint } from './analysis.service';
import { recommendationResultSchema } from '@/src/shared/cohort-creation/contracts';
import { materialManifestSchema } from '@/src/shared/cohort-creation/materials';
import type { CreationEvent } from '@/src/shared/cohort-creation/flow';
import type { ClaimedCreationJob, CreationCheckpoint } from './durable-job';
import { textAcquisitionFingerprint, textExtractionVersion, TEXT_PARSER_VERSION } from './materials/text';
import { retainedWebCheckpointSchema, webMaterialManifestSchema, type RetainedWebCheckpoint } from '@/src/shared/cohort-creation/web';
import { WEB_PARSER_VERSION, webExtractionFingerprint, webExtractionVersion, webReceiptFingerprint } from './materials/web-identity';
import type { ClaimedWebJob } from './durable-job';
import { PDF_PARSER_VERSION, pdfAcquisitionFingerprint, pdfExtractionVersion } from './materials/pdf-identity';
import { retainedYoutubeMetadataSchema, youtubeMaterialManifestSchema } from '@/src/shared/cohort-creation/youtube';
import { validateYoutubeCheckpoint, youtubeMaterialVersion, YOUTUBE_BUNDLE_VERSION } from './materials/youtube-identity';
import { youtubeMetadataFingerprint } from './materials/youtube-artifacts';
import { youtubeSourceUrl } from './materials/youtube-url';
import { githubMaterialManifestSchema, retainedGithubCheckpointSchema, githubSelectionSchema, GITHUB_PARSER_VERSION } from '@/src/shared/cohort-creation/github';
import { githubExtractionVersion, githubReceiptFingerprint, githubUnitId } from './materials/github-extraction';
import type { ClaimedGithubJob } from './durable-job';
import type { ClaimedNotionJob } from './durable-job';
import { notionMaterialManifestSchema, retainedNotionCheckpointSchema, NOTION_PARSER_VERSION } from '@/src/shared/cohort-creation/notion';
import { notionReceiptFingerprint, notionExtractionVersion, notionUnitId } from './materials/notion-extraction';
import { notionPageIdentity } from './materials/notion';
import type { ClaimedDiscoveryJob } from './durable-job';
import { discoveryCheckpointSchema, discoveryResultSchema } from '@/src/shared/cohort-creation/discovery';
import { discoveryFingerprint } from './discovery.service';
import { validateUnderstandingCheckpoint } from './understanding.service';
import { validateChunkingCheckpoint } from './chunking.service';

export function validateDiscoveryCheckpoint(job: ClaimedDiscoveryJob, value: unknown) {
  const checkpoint = discoveryCheckpointSchema.parse(value);
  if (checkpoint.requestId !== job.requestId || checkpoint.inputRevision !== job.inputRevision || checkpoint.inputFingerprint !== discoveryFingerprint(job.input)) throw new Error('Invalid discovery checkpoint input');
  return checkpoint;
}

export function validateNotionRetention(job: ClaimedNotionJob, value: unknown) {
  const retained = retainedNotionCheckpointSchema.parse(value);
  if (job.input.source.input.kind !== 'url') throw new Error('Invalid Notion checkpoint input');
  const identity = notionPageIdentity(job.input.source.input.url);
  if (identity.url !== job.input.source.input.url || retained.pageId !== identity.pageId || retained.materialId !== job.input.source.id ||
    retained.inputRevision !== job.inputRevision || job.input.maxUnits < 1 || retained.unitId !== notionUnitId(identity.pageId) ||
    retained.inputFingerprint !== notionReceiptFingerprint(retained.materialId, retained.inputRevision, identity.pageId)) throw new Error('Invalid Notion checkpoint input');
  return retained;
}

export function githubJobSelection(job: ClaimedGithubJob) {
  if (job.input.source.input.kind !== 'url' || !job.input.source.input.repositoryScope) throw new Error('Invalid GitHub checkpoint input');
  return githubSelectionSchema.parse({ ...job.input.source.input.repositoryScope, url: job.input.source.input.url });
}
export function validateGithubRetention(job: ClaimedGithubJob, value: unknown) {
  const retained = retainedGithubCheckpointSchema.parse(value); const selection = githubJobSelection(job);
  if (retained.materialId !== job.input.source.id || retained.inputRevision !== job.inputRevision || retained.files.length > job.input.maxUnits ||
    JSON.stringify(retained.selection) !== JSON.stringify(selection) ||
    retained.inputFingerprint !== githubReceiptFingerprint(retained.materialId, retained.inputRevision, selection)) throw new Error('Invalid GitHub checkpoint input');
  return retained;
}

export function validateWebRetention(job: ClaimedWebJob, value: unknown): RetainedWebCheckpoint {
  const retained = retainedWebCheckpointSchema.parse(value);
  if (job.input.source.input.kind !== 'url' || job.input.source.id !== retained.receipt.materialId ||
    job.inputRevision !== retained.receipt.inputRevision || job.input.source.input.url !== retained.receipt.requestedUrl ||
    retained.receiptFingerprint !== webReceiptFingerprint(retained.receipt)) throw new Error('Invalid checkpoint input');
  return retained;
}

export function jobCompletion(job: ClaimedCreationJob, value: CreationCheckpoint): CreationEvent {
  if (job.kind === 'refine_curriculum') return { type: 'refinement_received', requestId: job.requestId, result: validateRefinementResult(job.input, value) };
  if (job.kind === 'understand_material') {
    const result = validateUnderstandingCheckpoint(job.input.snapshot, job.requestId, value);
    if (result.completed.length !== result.total) throw new Error('Understanding is incomplete');
    return { type: 'understanding_received', requestId: job.requestId, result };
  }
  if (job.kind === 'build_curriculum') {
    const result = validateBuildingCheckpoint(job.input.snapshot, job.requestId, value);
    if (result.completed.length !== result.total) throw new Error('Building is incomplete');
    return { type: 'building_received', requestId: job.requestId, result };
  }
  if (job.kind === 'analyze_material') {
    const result = validateAnalysisCheckpoint(job.input.snapshot, job.requestId, value);
    if (result.completed.length !== result.total) throw new Error('Analysis is incomplete');
    return { type: 'analysis_received', requestId: job.requestId, result };
  }
  if (job.kind === 'chunk_material') {
    const result = validateChunkingCheckpoint(job.input.snapshot, job.requestId, value);
    if (result.completed.length !== result.total) throw new Error('Chunking is incomplete');
    return { type: 'chunking_received', requestId: job.requestId, result };
  }
  if (job.kind === 'discover_material') {
    const result = discoveryResultSchema.parse(value); validateDiscoveryCheckpoint(job, result.checkpoint);
    return { type: 'discovery_received', requestId: job.requestId, result };
  }
  if (job.kind === 'acquire_notion') {
    const manifest = notionMaterialManifestSchema.parse(value); const retained = validateNotionRetention(job, manifest.notion);
    const version = notionExtractionVersion(retained.artifact.checksum);
    if (manifest.inputRevision !== job.inputRevision || manifest.parserVersion !== NOTION_PARSER_VERSION || manifest.inputFingerprint !== version ||
      manifest.extraction.version !== version || manifest.extraction.segmentCount < 1 ||
      JSON.stringify(manifest.source.input) !== JSON.stringify(job.input.source.input)) throw new Error('Invalid Notion checkpoint input');
    return { type: 'material_received', requestId: job.requestId, manifest };
  }
  if (job.kind === 'acquire_github') {
    const manifest = githubMaterialManifestSchema.parse(value); const retained = validateGithubRetention(job, manifest.github);
    const version = githubExtractionVersion(retained.artifact.checksum);
    if (manifest.inputRevision !== job.inputRevision || manifest.parserVersion !== GITHUB_PARSER_VERSION ||
      manifest.inputFingerprint !== version || manifest.extraction.version !== version || manifest.extraction.segmentCount < retained.files.length ||
      JSON.stringify(manifest.source.input) !== JSON.stringify(job.input.source.input) ||
      JSON.stringify(manifest.source.selectedUnitIds) !== JSON.stringify(retained.files.map(file => githubUnitId(retained.commit, file.path)))) throw new Error('Invalid GitHub checkpoint input');
    return { type: 'material_received', requestId: job.requestId, manifest };
  }
  if (job.kind === 'recommendations') {
    const result = recommendationResultSchema.parse(value);
    if (result.requestId !== job.requestId || result.inputRevision !== job.inputRevision || result.intent.rawQuery !== job.input.query) throw new Error('Invalid checkpoint input');
    return { type: 'recommendations_received', result };
  }
  if (job.kind === 'observe_youtube') {
    const manifest = youtubeMaterialManifestSchema.parse(value);
    validateYoutubeCheckpoint(job.input, manifest.youtube);
    const version = youtubeMaterialVersion(manifest.youtube);
    if (manifest.inputRevision !== job.inputRevision || manifest.source.kind !== job.input.source.kind || manifest.source.input.kind !== 'url' || job.input.source.input.kind !== 'url' ||
      manifest.source.input.url !== job.input.source.input.url || manifest.parserVersion !== YOUTUBE_BUNDLE_VERSION ||
      manifest.extraction.version !== version || manifest.inputFingerprint !== version ||
      JSON.stringify(manifest.source.selectedUnitIds) !== JSON.stringify(job.input.source.selectedUnitIds)) throw new Error('Invalid checkpoint input');
    return { type: 'material_received', requestId: job.requestId, manifest };
  }
  if (job.kind === 'inspect_youtube') {
    const retained = retainedYoutubeMetadataSchema.parse(value); const { receipt } = retained;
    if (job.input.source.input.kind !== 'url' || job.input.source.id !== receipt.materialId || job.inputRevision !== receipt.inputRevision ||
      job.input.source.kind !== receipt.metadata.kind || job.input.source.input.url !== receipt.metadata.sourceUrl ||
      youtubeSourceUrl(receipt.metadata.sourceUrl).url !== receipt.metadata.sourceUrl ||
      retained.inputFingerprint !== youtubeMetadataFingerprint(receipt.materialId, receipt.inputRevision, receipt.metadata.sourceUrl)) throw new Error('Invalid checkpoint input');
    return { type: 'youtube_metadata_received', requestId: job.requestId, result: retained };
  }
  if (job.kind === 'acquire_web') {
    const manifest = webMaterialManifestSchema.parse(value);
    validateWebRetention(job, { phase: 'retained_web', receipt: manifest.receipt, receiptArtifact: manifest.receiptArtifact,
      receiptFingerprint: manifest.receiptFingerprint });
    if (!manifest.extraction.complete || manifest.extraction.extractionKind !== 'text' || manifest.parserVersion !== WEB_PARSER_VERSION ||
      manifest.extraction.version !== webExtractionVersion(manifest.retainedSource.checksum) ||
      manifest.inputFingerprint !== webExtractionFingerprint(manifest.receipt) ||
      manifest.source.selectedUnitIds.length !== 1 || manifest.source.selectedUnitIds[0] !== manifest.source.id) throw new Error('Invalid checkpoint input');
    return { type: 'material_received', requestId: job.requestId, manifest };
  }
  const manifest = materialManifestSchema.parse(value);
  const pdf = job.kind === 'acquire_pdf';
  if (manifest.inputRevision !== job.inputRevision || manifest.source.id !== job.input.source.id ||
    manifest.source.kind !== (pdf ? 'pdf' : 'markdown') || manifest.source.input.kind !== 'upload' || job.input.source.input.kind !== 'upload' ||
    manifest.source.input.assetId !== job.input.source.input.assetId || manifest.retainedSource.id !== manifest.source.input.assetId ||
    manifest.retainedSource.kind !== 'upload' || !manifest.extraction.complete || manifest.extraction.extractionKind !== 'text' ||
    manifest.source.selectedUnitIds.length !== 1 || manifest.source.selectedUnitIds[0] !== manifest.source.id ||
    manifest.parserVersion !== (pdf ? PDF_PARSER_VERSION : TEXT_PARSER_VERSION) || manifest.extraction.version !== (pdf ? pdfExtractionVersion : textExtractionVersion)(manifest.retainedSource.checksum) ||
    manifest.inputFingerprint !== (pdf ? pdfAcquisitionFingerprint : textAcquisitionFingerprint)(manifest.source.id, job.inputRevision, manifest.retainedSource)) throw new Error('Invalid checkpoint input');
  return { type: 'material_received', requestId: job.requestId, manifest };
}
