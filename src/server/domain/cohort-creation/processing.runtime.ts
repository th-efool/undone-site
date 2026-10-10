import 'server-only';
import type { CreationSnapshot } from '@/src/shared/cohort-creation/contracts';
import type { StorageScope } from '@/src/server/infrastructure/storage/creation.contracts';
import { ProcessingContentService } from './processing-content.service';
import { UnderstandingContentService } from './understanding-content.service';
import { ChunkingContentService } from './chunking-content.service';
import { AnalysisContentService } from './analysis-content.service';
import { BuildingContentService } from './building-content.service';

export async function loadUnderstandingPreview(scope: StorageScope, snapshot: CreationSnapshot, signal: AbortSignal) {
  const { creationArtifactRepository: artifacts } = await import('@/src/server/infrastructure/storage/creation.runtime');
  return new UnderstandingContentService(new ProcessingContentService(artifacts), artifacts).preview(scope, snapshot, signal);
}

export async function loadChunkingPreview(scope: StorageScope, snapshot: CreationSnapshot, signal: AbortSignal) {
  const { creationArtifactRepository: artifacts } = await import('@/src/server/infrastructure/storage/creation.runtime');
  return new ChunkingContentService(new UnderstandingContentService(new ProcessingContentService(artifacts), artifacts), artifacts).preview(scope, snapshot, signal);
}

export async function loadAnalysisPreview(scope: StorageScope, snapshot: CreationSnapshot, signal: AbortSignal) {
  const { creationArtifactRepository: artifacts } = await import('@/src/server/infrastructure/storage/creation.runtime');
  return new AnalysisContentService(new ChunkingContentService(new UnderstandingContentService(
    new ProcessingContentService(artifacts), artifacts), artifacts), artifacts).preview(scope, snapshot, signal);
}

/** Lazy storage construction keeps route imports and unauthenticated requests free of blob connections. */
export async function loadBuiltCurriculum(scope: StorageScope, snapshot: CreationSnapshot, signal: AbortSignal) {
  const { creationArtifactRepository: artifacts } = await import('@/src/server/infrastructure/storage/creation.runtime');
  const content = new ProcessingContentService(artifacts);
  return new BuildingContentService(new AnalysisContentService(new ChunkingContentService(
    new UnderstandingContentService(content, artifacts), artifacts), artifacts), artifacts).load(scope, snapshot, signal);
}
