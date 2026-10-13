import { randomUUID } from 'node:crypto';
import type { CohortWorkspace } from '@/src/shared/cohort-builder/contracts';
import type { TextArtifactSql } from './text-artifacts';
import { planTextJobs } from './text-job-plan';

export interface TextJobTransactionPort {
  transaction<T>(work: (tx: TextArtifactSql) => Promise<T>): Promise<T>;
}

/** Persist a complete dependency graph atomically; repeat calls reuse logical job keys. */
export async function enqueueTextJobPlan(port: TextJobTransactionPort, workspaceId: string, state: CohortWorkspace): Promise<{ jobIds: string[]; inserted: number; superseded: number }> {
  const intents = planTextJobs(state);
  return port.transaction(async tx => {
    const obsolete = await tx.query(`UPDATE "cohort_text_jobs"
      SET "status" = 'superseded', "fence" = "fence" + 1,
          "leaseOwner" = NULL, "leaseToken" = NULL, "leaseUntil" = NULL, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "workspaceId" = $1 AND "status" IN ('queued', 'running', 'failed')
        AND NOT ("jobKey" = ANY($2::text[])) RETURNING "id"`,
    [workspaceId, intents.map(intent => intent.jobKey)]);
    const ids = new Map<string, string>();
    let inserted = 0;
    for (const intent of intents) {
      const result = await tx.query(`INSERT INTO "cohort_text_jobs"
        ("id", "workspaceId", "jobKey", "sourceId", "sourceVersion", "stage", "dependencyFingerprint")
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT ("workspaceId", "jobKey") DO NOTHING RETURNING "id"`,
      [randomUUID(), workspaceId, intent.jobKey, intent.sourceId, intent.sourceVersion, intent.stage, intent.dependencyFingerprint]);
      inserted += result.rows.length;
      const row = result.rows[0] ?? (await tx.query(`SELECT "id", "status" FROM "cohort_text_jobs"
        WHERE "workspaceId" = $1 AND "jobKey" = $2 FOR UPDATE`, [workspaceId, intent.jobKey])).rows[0];
      if (!row) throw new Error('JOB_IDENTITY_LOST');
      if (row.status === 'superseded') {
        await tx.query(`UPDATE "cohort_text_jobs"
          SET "status" = 'queued', "dueAt" = CURRENT_TIMESTAMP, "attempts" = 0,
              "errorCode" = NULL, "fence" = "fence" + 1,
              "leaseOwner" = NULL, "leaseToken" = NULL, "leaseUntil" = NULL,
              "resultArtifactId" = NULL, "updatedAt" = CURRENT_TIMESTAMP
          WHERE "id" = $1 AND "workspaceId" = $2 AND "status" = 'superseded'`, [row.id, workspaceId]);
      }
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
    return { jobIds: intents.map(intent => ids.get(intent.jobKey)!), inserted, superseded: obsolete.rows.length };
  });
}
