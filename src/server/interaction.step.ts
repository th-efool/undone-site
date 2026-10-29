import 'server-only';
import { prisma } from './infrastructure/db/postgres/client';
import { runInteractionWorkerLoop } from './interaction-worker';

export async function executeInteractionSlice(token: string): Promise<boolean> {
  'use step';
  const renewed = await prisma.$executeRaw`
    UPDATE interaction_workflow_dispatches SET "leaseUntil"=CURRENT_TIMESTAMP + interval '30 seconds', "updatedAt"=CURRENT_TIMESTAMP
    WHERE token=${token}`;
  if (!renewed) return false;
  await runInteractionWorkerLoop({ workerId: `workflow-${token}`, maxIterations: 1, pollIntervalMs: 0 }, AbortSignal.timeout(240_000));
  return prisma.$transaction(async tx => {
    const reservation = await tx.$queryRaw<Array<{ token: string }>>`
      SELECT token FROM interaction_workflow_dispatches WHERE token=${token} FOR UPDATE`;
    if (reservation[0]?.token !== token) return false;
    const pending = await tx.$queryRaw<Array<{ pending: boolean }>>`
      SELECT EXISTS (SELECT 1 FROM interaction_runs WHERE status IN ('queued','running'))
        OR EXISTS (SELECT 1 FROM cohort_text_jobs j WHERE j.status='running' OR
          (j.status='queued' AND j."attempts" < 3 AND NOT EXISTS (
            SELECT 1 FROM cohort_text_job_edges e JOIN cohort_text_jobs p ON p.id=e."prerequisiteId"
            WHERE e."jobId"=j.id AND p.status <> 'accepted'))) AS pending`;
    if (pending[0]?.pending) return true;
    await tx.$executeRaw`DELETE FROM interaction_workflow_dispatches WHERE token=${token}`;
    return false;
  });
}
