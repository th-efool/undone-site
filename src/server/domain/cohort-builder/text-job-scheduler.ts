import { randomUUID } from 'node:crypto';
import type { CohortWorkspace } from '@/src/shared/cohort-builder/contracts';
import type { TextArtifactSql } from './text-artifacts';
import { planTextJobs } from './text-job-plan';

export interface TextJobTransactionPort {
  transaction<T>(work: (tx: TextArtifactSql) => Promise<T>): Promise<T>;
}

/** Persist a complete dependency graph atomically; repeat calls reuse logical job keys. */
export async function enqueueTextJobPlan(port: TextJobTransactionPort, workspaceId: string, state: CohortWorkspace): Promise<{ jobIds: string[]; inserted: number }> {
  const intents = planTextJobs(state);
  if (intents.length === 0) return { jobIds: [], inserted: 0 };
  return port.transaction(async tx => {
    const ids = new Map<string, string>();
    let inserted = 0;
    for (const intent of intents) {
      const result = await tx.query(`INSERT INTO "cohort_text_jobs"
        ("id", "workspaceId", "jobKey", "sourceId", "sourceVersion", "stage", "dependencyFingerprint")
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT ("workspaceId", "jobKey") DO NOTHING RETURNING "id"`,
      [randomUUID(), workspaceId, intent.jobKey, intent.sourceId, intent.sourceVersion, intent.stage, intent.dependencyFingerprint]);
      inserted += result.rows.length;
      const row = result.rows[0] ?? (await tx.query(`SELECT "id" FROM "cohort_text_jobs" WHERE "workspaceId" = $1 AND "jobKey" = $2`, [workspaceId, intent.jobKey])).rows[0];
      if (!row) throw new Error('JOB_IDENTITY_LOST');
      ids.set(intent.jobKey, String(row.id));
    }
    for (const intent of intents) {
      const jobId = ids.get(intent.jobKey)!;
      for (const prerequisiteKey of intent.prerequisiteKeys) {
        const prerequisiteId = ids.get(prerequisiteKey);
        if (!prerequisiteId) throw new Error('MISSING_PLANNED_DEPENDENCY');
        await tx.query(`INSERT INTO "cohort_text_job_edges" ("workspaceId", "jobId", "prerequisiteId")
          VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`, [workspaceId, jobId, prerequisiteId]);
      }
    }
    return { jobIds: intents.map(intent => ids.get(intent.jobKey)!), inserted };
  });
}
