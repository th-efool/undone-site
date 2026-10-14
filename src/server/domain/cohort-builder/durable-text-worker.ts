import type { TextArtifactSql } from './text-artifacts';
import { acceptAssemblyProjection } from './text-assembly-acceptance';
import { acceptCurrentTextJob } from './text-job-acceptance';
import { runTextJobTick, type TextJobTickResult } from './text-job-tick';
import type { TextJobTransactionPort } from './text-job-scheduler';
import { createTextAssemblyProcessor } from './text-assembly-processor';
import { createTextSourceProcessor } from './text-source-processor';

/** Durable S3 driver composition. It is injectable and remains opt-in until migration rollout. */
export function runDurableTextJobTick(input: {
  sql: TextArtifactSql;
  transaction: TextJobTransactionPort;
  workerId: string;
  leaseMs: number;
  now: () => Date;
  loadWorkspace: (workspaceId: string) => Promise<unknown>;
}): Promise<TextJobTickResult> {
  const source = createTextSourceProcessor({ sql: input.sql, loadWorkspace: input.loadWorkspace });
  const assembly = createTextAssemblyProcessor({ sql: input.sql, loadWorkspace: input.loadWorkspace });
  return runTextJobTick({
    sql: input.sql, workerId: input.workerId, leaseMs: input.leaseMs, now: input.now,
    process: job => job.stage === 'assembly' ? assembly(job) : source(job),
    accept: (job, artifact, at) => job.stage === 'assembly'
      ? acceptAssemblyProjection(input.transaction, job, artifact, at)
      : acceptCurrentTextJob(input.transaction, job, artifact, at),
  });
}
