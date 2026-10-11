import 'server-only';
import { prisma } from './infrastructure/db/postgres/client';
import { creationJobRepo } from './infrastructure/db/postgres/repositories/creationJob.repo';
import { executeDurableCreationJob } from './creation-execution.runtime';
import type { ExecutionScope } from './infrastructure/db/postgres/creationExecution.repo';

export async function executeCreationSlice(scope: ExecutionScope): Promise<number | null> {
  'use step';
  const current = await prisma.creationJob.findFirst({ where: { ...scope, status: { in: ['queued', 'running'] }, cancelRequestedAt: null } });
  if (!current) return null;
  // Receipt renewal bounds recovery after a transport failure without polling the provider.
  await prisma.$executeRaw`UPDATE "creation_execution_dispatches" SET "leaseUntil"=CURRENT_TIMESTAMP + interval '10 minutes',"updatedAt"=CURRENT_TIMESTAMP
    WHERE "jobId"=${current.id}`;
  const job = await creationJobRepo.claim(`workflow-${current.id}`, { ...scope, kind: 'any' });
  if (job) await executeDurableCreationJob(job, AbortSignal.timeout(240_000));
  const next = await prisma.creationJob.findUnique({ where: { id: current.id } });
  if (!next || !['queued', 'running'].includes(next.status) || next.cancelRequestedAt) return null;
  const due = next.status === 'running' ? next.leaseUntil : next.nextRunAt;
  return Math.max(job ? 1_000 : 10_000, Math.min(90_000, (due?.getTime() ?? Date.now() + 10_000) - Date.now()));
}
