import { GeneratedGuideService } from './domain/cohort-creation/materials/generated-guide.service';
import { VercelCreationGuideAuthor } from './infrastructure/ai/vercelCreationGuideAuthor';
import { publicationService } from './domain/cohort-creation/publication.runtime';
import { VercelCreationRefinement } from './infrastructure/ai/vercelCreationRefinement';
import { RefinementService } from './domain/cohort-creation/refinement.service';
import type { CreationRefinement } from './domain/cohort-creation/refinement';
import { BuildingContentService } from './domain/cohort-creation/building-content.service';
import { VercelCreationBuild } from './infrastructure/ai/vercelCreationBuild';
import type { CreationBuilding } from './domain/cohort-creation/build';
import { BuildingService } from './domain/cohort-creation/building.service';
import { AnalysisContentService } from './domain/cohort-creation/analysis-content.service';
import { VercelCreationAnalysis } from './infrastructure/ai/vercelCreationAnalysis';
import type { CreationAnalysis } from './domain/cohort-creation/analysis';
import { AnalysisService } from './domain/cohort-creation/analysis.service';
import { ChunkingContentService } from './domain/cohort-creation/chunking-content.service';
import 'server-only';
import { creationJobRepo } from './infrastructure/db/postgres/repositories/creationJob.repo';
import { creationRecommendationRepo } from './infrastructure/db/postgres/repositories/creationRecommendation.repo';
import { createCohortModel } from './infrastructure/ai/modelRegistry';
import { VercelCohortAi } from './infrastructure/ai/vercelCohortAi';
import { RecommendationService } from './domain/cohort-creation/recommendation.service';
import { executeCreationJob } from './domain/cohort-creation/durable-job.runner';
import type { ClaimedCreationJob } from './domain/cohort-creation/durable-job';
import { TextAcquisitionService } from './domain/cohort-creation/materials/text-acquisition.service';
import { WebAcquisitionService } from './domain/cohort-creation/materials/web-acquisition.service';
import { WebRetentionService } from './domain/cohort-creation/materials/web-retention.service';
import { PdfAcquisitionService } from './domain/cohort-creation/materials/pdf-acquisition.service';
import { YoutubeMetadataRetentionService, YoutubeObservationService } from './domain/cohort-creation/materials/youtube-observation.service';
import { YoutubeAcquisitionService } from './domain/cohort-creation/materials/youtube-acquisition.service';
import { VercelMaterialObservation } from './infrastructure/ai/vercelMaterialObservation';
import { YoutubeMetadataReader } from './domain/cohort-creation/materials/youtube-metadata';
import { GithubMaterialReader } from './domain/cohort-creation/materials/github';
import { GithubPublicApi } from './domain/cohort-creation/materials/github-public-api';
import { GithubAcquisitionService } from './domain/cohort-creation/materials/github-acquisition.service';
import { NotionAcquisitionService } from './domain/cohort-creation/materials/notion-acquisition.service';
import { DiscoveryService } from './domain/cohort-creation/discovery.service';
import { DiscoverySourceObserver } from './domain/cohort-creation/discovery-observer';
import { VercelResourceDiscovery } from './infrastructure/ai/vercelResourceDiscovery';
import type { ResourceDiscovery } from './domain/cohort-creation/discovery.contracts';
import { ProcessingContentService } from './domain/cohort-creation/processing-content.service';
import { UnderstandingService } from './domain/cohort-creation/understanding.service';
import type { CreationUnderstanding } from './domain/cohort-creation/understanding';
import { VercelCreationUnderstanding } from './infrastructure/ai/vercelCreationUnderstanding';
import { VercelCreationChunking } from './infrastructure/ai/vercelCreationChunking';
import type { CreationChunking } from './domain/cohort-creation/chunking';
import { ChunkingService } from './domain/cohort-creation/chunking.service';
import { UnderstandingContentService } from './domain/cohort-creation/understanding-content.service';

/** Shared service composition. SQL leases and checkpoints own execution state. */
export async function executeDurableCreationJob(claimedJob: ClaimedCreationJob, signal: AbortSignal, onConnectorUsed: () => void = () => {}) {
    await executeCreationJob(creationJobRepo, claimedJob, job => new RecommendationService(
      new VercelCohortAi(createCohortModel(), { maxRetries: 0, beforeCall: () => creationJobRepo.reserveModelCall(job) }),
      creationRecommendationRepo), signal,
      () => ({ acquire: async (...args) => {
        const storage = await import('./infrastructure/storage/creation.runtime');
        return new TextAcquisitionService(storage.materialBlobStore, storage.creationArtifactRepository).acquire(...args);
      } }),
      () => ({ acquire: async (...args) => {
        const storage = await import('./infrastructure/storage/creation.runtime');
        return new WebAcquisitionService(new WebRetentionService(storage.materialBlobStore, storage.creationArtifactRepository),
          storage.materialBlobStore, storage.creationArtifactRepository).acquire(...args);
      }, extract: async (...args) => {
        const storage = await import('./infrastructure/storage/creation.runtime');
        return new WebAcquisitionService(new WebRetentionService(storage.materialBlobStore, storage.creationArtifactRepository),
          storage.materialBlobStore, storage.creationArtifactRepository).extract(...args);
      } }),
      () => ({ acquire: async (...args) => {
        const storage = await import('./infrastructure/storage/creation.runtime');
        return new PdfAcquisitionService(storage.materialBlobStore, storage.creationArtifactRepository).acquire(...args);
      } }),
      () => ({ retainMetadata: async (...args) => {
        const storage = await import('./infrastructure/storage/creation.runtime');
        return new YoutubeMetadataRetentionService(new YoutubeMetadataReader(), storage.creationArtifactRepository).retainMetadata(...args);
      } }),
      job => ({ acquire: async (...args) => {
        const storage = await import('./infrastructure/storage/creation.runtime');
        const observer = new VercelMaterialObservation(createCohortModel(), { beforeCall: unitId => creationJobRepo.reserveModelCall(job, unitId) });
        const service = new YoutubeObservationService(new YoutubeMetadataReader(), observer, storage.creationArtifactRepository);
        return new YoutubeAcquisitionService(service, storage.creationArtifactRepository).acquire(...args);
      } }),
      () => ({ acquire: async (...args) => {
        const storage = await import('./infrastructure/storage/creation.runtime');
        let reader = new GithubMaterialReader(new GithubPublicApi());
        if (args[3].connection) {
          onConnectorUsed();
          reader = await (await import('./infrastructure/connectors/creation-source-access')).createOwnedGithubReader(args[0], args[4]);
        }
        return new GithubAcquisitionService(reader, storage.creationArtifactRepository).acquire(...args);
      }, extract: async (...args) => {
        const storage = await import('./infrastructure/storage/creation.runtime');
        return new GithubAcquisitionService(new GithubMaterialReader(new GithubPublicApi()), storage.creationArtifactRepository).extract(...args);
      } }),
      () => ({ acquire: async (...args) => {
        const storage = await import('./infrastructure/storage/creation.runtime');
        onConnectorUsed();
        const reader = await (await import('./infrastructure/connectors/creation-source-access')).createOwnedNotionReader(args[0], args[3]);
        return new NotionAcquisitionService(reader, storage.creationArtifactRepository).acquire(...args);
      }, extract: async (...args) => {
        const storage = await import('./infrastructure/storage/creation.runtime');
        // Retained recovery needs no live connection and must never refetch a mutable page.
        return new NotionAcquisitionService({ read: async () => { throw new Error('Retained recovery cannot read Notion'); } }, storage.creationArtifactRepository).extract(...args);
      } }),
      job => ({ run: async (...args) => {
        const storage = await import('./infrastructure/storage/creation.runtime');
        const adapter = () => new VercelResourceDiscovery(createCohortModel(), { beforeCall: () => creationJobRepo.reserveModelCall(job) });
        const ai: ResourceDiscovery = { search: (...input) => adapter().search(...input), select: (...input) => adapter().select(...input) };
        return new DiscoveryService(ai, new DiscoverySourceObserver(new YoutubeMetadataReader(), new GithubPublicApi()), storage.creationArtifactRepository).run(...args);
      } }),
      job => ({ run: async (...args) => {
        const storage = await import('./infrastructure/storage/creation.runtime');
        const adapter = () => new VercelCreationUnderstanding(createCohortModel(), { beforeCall: partitionId => creationJobRepo.reserveModelCall(job, partitionId) });
        const ai: CreationUnderstanding = { get identity() { return adapter().identity; }, understand: (...input) => adapter().understand(...input) };
        return new UnderstandingService(new ProcessingContentService(storage.creationArtifactRepository), ai, storage.creationArtifactRepository).run(...args);
      } }),
      job => ({ run: async (...args) => {
        const storage = await import('./infrastructure/storage/creation.runtime');
        const adapter = () => new VercelCreationChunking(createCohortModel(), { beforeCall: partitionId => creationJobRepo.reserveModelCall(job, partitionId) });
        const ai: CreationChunking = { get identity() { return adapter().identity; }, chunk: (...input) => adapter().chunk(...input) };
        const content = new UnderstandingContentService(new ProcessingContentService(storage.creationArtifactRepository), storage.creationArtifactRepository);
        return new ChunkingService(content, ai, storage.creationArtifactRepository).run(...args);
      } }),
      job => ({ run: async (...args) => {
        const storage = await import('./infrastructure/storage/creation.runtime');
        const adapter = () => new VercelCreationAnalysis(createCohortModel(), { beforeCall: partitionId => creationJobRepo.reserveModelCall(job, partitionId) });
        const ai: CreationAnalysis = { get identity() { return adapter().identity; }, analyze: (...input) => adapter().analyze(...input) };
        const understanding = new UnderstandingContentService(new ProcessingContentService(storage.creationArtifactRepository), storage.creationArtifactRepository);
        return new AnalysisService(new ChunkingContentService(understanding, storage.creationArtifactRepository), ai, storage.creationArtifactRepository).run(...args);
      } }),
      job => ({ run: async (...args) => {
        const storage = await import('./infrastructure/storage/creation.runtime');
        const adapter = () => new VercelCreationBuild(createCohortModel(), { beforeCall: partitionId => creationJobRepo.reserveModelCall(job, partitionId) });
        const ai: CreationBuilding = { get identity() { return adapter().identity; }, build: (...input) => adapter().build(...input) };
        const understanding = new UnderstandingContentService(new ProcessingContentService(storage.creationArtifactRepository), storage.creationArtifactRepository);
        const chunks = new ChunkingContentService(understanding, storage.creationArtifactRepository);
        return new BuildingService(new AnalysisContentService(chunks, storage.creationArtifactRepository), ai, storage.creationArtifactRepository).run(...args);
      } }),
      job => ({ run: async (...args) => {
        const storage = await import('./infrastructure/storage/creation.runtime');
        const adapter = () => new VercelCreationRefinement(createCohortModel(), { beforeCall: () => creationJobRepo.reserveModelCall(job) });
        const ai: CreationRefinement = { get identity() { return adapter().identity; }, refine: (...input) => adapter().refine(...input) };
        const understanding = new UnderstandingContentService(new ProcessingContentService(storage.creationArtifactRepository), storage.creationArtifactRepository);
        const chunks = new ChunkingContentService(understanding, storage.creationArtifactRepository);
        const analysis = new AnalysisContentService(chunks, storage.creationArtifactRepository);
        return new RefinementService(new BuildingContentService(analysis, storage.creationArtifactRepository), ai).run(...args);
      } }),
      () => ({ run: async (...args) => (await publicationService()).run(...args) }),
      job => ({ acquire: async (...args) => {
        const storage = await import('./infrastructure/storage/creation.runtime');
        const author = new VercelCreationGuideAuthor(createCohortModel(), { beforeCall: () => creationJobRepo.reserveModelCall(job) });
        return new GeneratedGuideService(author, storage.creationArtifactRepository).acquire(...args);
      } }));
}
