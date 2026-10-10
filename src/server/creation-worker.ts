import 'server-only';
import { randomUUID } from 'node:crypto';
import { prisma } from './infrastructure/db/postgres/client';
import { creationJobRepo } from './infrastructure/db/postgres/repositories/creationJob.repo';
import { creationRecommendationRepo } from './infrastructure/db/postgres/repositories/creationRecommendation.repo';
import { createCohortModel } from './infrastructure/ai/modelRegistry';
import { VercelCohortAi } from './infrastructure/ai/vercelCohortAi';
import { RecommendationService } from './domain/cohort-creation/recommendation.service';
import { runCreationWorker } from './domain/cohort-creation/durable-job.runner';
import { TextAcquisitionService } from './domain/cohort-creation/materials/text-acquisition.service';
import { WebAcquisitionService } from './domain/cohort-creation/materials/web-acquisition.service';
import { WebRetentionService } from './domain/cohort-creation/materials/web-retention.service';
import { PdfAcquisitionService } from './domain/cohort-creation/materials/pdf-acquisition.service';
import { YoutubeMetadataRetentionService } from './domain/cohort-creation/materials/youtube-observation.service';
import { YoutubeMetadataReader } from './domain/cohort-creation/materials/youtube-metadata';

async function main() {
  if (process.argv.includes('--check')) {
    console.log('Creation worker imports and Node server condition are valid. No database or model call made.');
    await prisma.$disconnect();
    return;
  }
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for the creation worker.');
  if (process.argv.includes('--reconcile')) {
    const { maintainPrivateCreationStorage } = await import('./infrastructure/storage/creation.runtime');
    const mongoose = (await import('mongoose')).default;
    try { console.log(JSON.stringify(await maintainPrivateCreationStorage())); }
    finally { await Promise.all([prisma.$disconnect(), mongoose.disconnect()]); }
    return;
  }
  const shutdown = new AbortController();
  const stop = () => shutdown.abort(new Error('Worker shutting down'));
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);
  let maintenance: Promise<void> | null = null;
  const sweep = () => {
    if (maintenance || shutdown.signal.aborted) return;
    maintenance = import('./infrastructure/storage/creation.runtime')
      .then(runtime => runtime.maintainPrivateCreationStorage())
      .then(() => undefined)
      .catch(() => { console.error('[creation-worker] Retention sweep failed; the next sweep will retry.'); })
      .finally(() => { maintenance = null; });
  };
  const retentionTimer = setInterval(sweep, 10 * 60_000);
  retentionTimer.unref();
  sweep();
  try {
    await runCreationWorker(creationJobRepo, `creation-${randomUUID()}`, job => new RecommendationService(
      new VercelCohortAi(createCohortModel(), { maxRetries: 0, beforeCall: () => creationJobRepo.reserveModelCall(job) }),
      creationRecommendationRepo), shutdown.signal,
      () => console.error('[creation-worker] Durable operation failed; its lease/checkpoint permits recovery.'),
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
      } }));
  } finally {
    clearInterval(retentionTimer);
    await maintenance;
    process.removeListener('SIGTERM', stop); process.removeListener('SIGINT', stop);
    await Promise.all([prisma.$disconnect(), (await import('mongoose')).default.disconnect()]);
  }
}
void main().catch(error => { console.error('[creation-worker]', error instanceof Error ? error.message : 'Startup failed'); process.exitCode = 1; });
