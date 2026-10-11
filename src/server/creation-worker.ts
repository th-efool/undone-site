import 'server-only';
import { randomUUID } from 'node:crypto';
import { prisma } from './infrastructure/db/postgres/client';
import { creationJobRepo } from './infrastructure/db/postgres/repositories/creationJob.repo';
import { runCreationPollingLoop } from './domain/cohort-creation/durable-job.runner';
import { executeDurableCreationJob } from './creation-execution.runtime';

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
  let connectorUsed = false;
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
    await runCreationPollingLoop(creationJobRepo, `creation-${randomUUID()}`, shutdown.signal,
      (job, signal) => executeDurableCreationJob(job, signal, () => { connectorUsed = true; }),
      () => console.error('[creation-worker] Durable operation failed; its lease/checkpoint permits recovery.'));
  } finally {
    clearInterval(retentionTimer);
    await maintenance;
    process.removeListener('SIGTERM', stop); process.removeListener('SIGINT', stop);
    await Promise.all([prisma.$disconnect(), (await import('mongoose')).default.disconnect(), connectorUsed ? (await import('./infrastructure/connectors/creation-corsair')).closeCreationCorsairRuntime() : undefined]);
  }
}
void main().catch(error => { console.error('[creation-worker]', error instanceof Error ? error.message : 'Startup failed'); process.exitCode = 1; });
