import 'server-only';
import { randomUUID } from 'node:crypto';
import { prisma } from './infrastructure/db/postgres/client';
import { creationJobRepo } from './infrastructure/db/postgres/repositories/creationJob.repo';
import { creationRecommendationRepo } from './infrastructure/db/postgres/repositories/creationRecommendation.repo';
import { createCohortModel } from './infrastructure/ai/modelRegistry';
import { VercelCohortAi } from './infrastructure/ai/vercelCohortAi';
import { RecommendationService } from './domain/cohort-creation/recommendation.service';
import { runCreationWorker } from './domain/cohort-creation/durable-job.runner';

async function main() {
  if (process.argv.includes('--check')) {
    console.log('Creation worker imports and Node server condition are valid. No database or model call made.');
    await prisma.$disconnect();
    return;
  }
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for the creation worker.');
  if (process.argv.includes('--reconcile')) {
    const { reconcilePrivateCreationStorage } = await import('./infrastructure/storage/creation.runtime');
    const mongoose = (await import('mongoose')).default;
    try { console.log(JSON.stringify(await reconcilePrivateCreationStorage())); }
    finally { await Promise.all([prisma.$disconnect(), mongoose.disconnect()]); }
    return;
  }
  const shutdown = new AbortController();
  const stop = () => shutdown.abort(new Error('Worker shutting down'));
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);
  try {
    await runCreationWorker(creationJobRepo, `creation-${randomUUID()}`, job => new RecommendationService(
      new VercelCohortAi(createCohortModel(), { maxRetries: 0, beforeCall: () => creationJobRepo.reserveModelCall(job) }),
      creationRecommendationRepo), shutdown.signal,
      () => console.error('[creation-worker] Durable operation failed; its lease/checkpoint permits recovery.'));
  } finally {
    process.removeListener('SIGTERM', stop); process.removeListener('SIGINT', stop);
    await prisma.$disconnect();
  }
}
void main().catch(error => { console.error('[creation-worker]', error instanceof Error ? error.message : 'Startup failed'); process.exitCode = 1; });
