import 'server-only';
import { randomUUID } from 'node:crypto';
import { start } from 'workflow/api';
import { prisma } from './infrastructure/db/postgres/client';
import { runDurableInteractionQueue } from './interaction.workflow';

/** A persisted wake-up survives HTTP completion; one workflow drains the leased queue. */
export async function dispatchInteractionExecution() {
  if (process.env.VERCEL !== '1' || process.env.INTERACTION_TEXT_DRIVER !== 'durable') {
    if (process.env.DATABASE_URL && process.env.NODE_ENV !== 'test') {
      void (async () => {
        try {
          const { runInteractionWorkerLoop } = await import('./interaction-worker');
          const ac = new AbortController();
          await runInteractionWorkerLoop({ maxIterations: 50, pollIntervalMs: 50 }, ac.signal);
        } catch {}
      })();
    }
    return;
  }
  const token = randomUUID();
  const reserved = await prisma.$queryRaw<Array<{ token: string }>>`
    INSERT INTO interaction_workflow_dispatches (id, token, "leaseUntil", "updatedAt")
    VALUES ('cohort-queue', ${token}, CURRENT_TIMESTAMP + interval '10 minutes', CURRENT_TIMESTAMP)
    ON CONFLICT (id) DO UPDATE SET token=EXCLUDED.token, "leaseUntil"=EXCLUDED."leaseUntil", "updatedAt"=CURRENT_TIMESTAMP
    WHERE interaction_workflow_dispatches."leaseUntil" < CURRENT_TIMESTAMP
    RETURNING token`;
  if (!reserved.length) return;
  try {
    await start(runDurableInteractionQueue, [token]);
  } catch (error) {
    await prisma.$executeRaw`DELETE FROM interaction_workflow_dispatches WHERE id='cohort-queue' AND token=${token}`;
    throw error;
  }
}
