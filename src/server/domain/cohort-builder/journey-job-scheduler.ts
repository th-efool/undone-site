import { randomUUID } from 'node:crypto';
import type { CohortWorkspace } from '@/src/shared/cohort-builder/contracts';
import type { TextArtifactSql } from './text-artifacts';
import type { TextJobTransactionPort } from './text-job-scheduler';
import { planJourneyJobs } from './journey-job-plan';

export async function enqueueJourneyJobPlan(
  port: TextJobTransactionPort,
  workspaceId: string,
  state: CohortWorkspace
): Promise<void> {
  return port.transaction(tx => enqueueJourneyJobPlanInTransaction(tx, workspaceId, state));
}

export async function enqueueJourneyJobPlanInTransaction(
  tx: TextArtifactSql,
  workspaceId: string,
  state: CohortWorkspace
): Promise<void> {
  const intents = planJourneyJobs(state);
  const activeKeys = intents.map(intent => intent.jobKey);

  // 1. Supersede obsolete journey jobs; never touch text:* jobs
  await tx.query(`UPDATE "cohort_text_jobs"
    SET "status" = 'superseded', "fence" = "fence" + 1,
        "leaseOwner" = NULL, "leaseToken" = NULL, "leaseUntil" = NULL, "updatedAt" = CURRENT_TIMESTAMP
    WHERE "workspaceId" = $1 AND "jobKey" LIKE 'journey:%' AND "status" IN ('queued', 'running', 'failed')
      AND NOT ("jobKey" = ANY($2::text[]))`,
    [workspaceId, activeKeys]
  );

  // 2. Inserts/updates new journey jobs under ON CONFLICT ("workspaceId", "jobKey"):
  // If queued/running/accepted with matching dependencyFingerprint, preserve it.
  // If dependencyFingerprint changed, bump fence, reset attempts, set queued.
  // Ensure sourceId and sourceVersion are NULL.
  for (const intent of intents) {
    const newId = randomUUID();
    await tx.query(`INSERT INTO "cohort_text_jobs"
      ("id", "workspaceId", "jobKey", "sourceId", "sourceVersion", "stage", "handlerVersion", "dependencyFingerprint", "status", "attempts", "fence", "dueAt", "updatedAt")
      VALUES ($1, $2, $3, NULL, NULL, $4, $5, $6, 'queued', 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT ("workspaceId", "jobKey") DO UPDATE
        SET "dependencyFingerprint" = EXCLUDED."dependencyFingerprint",
            "fence" = "cohort_text_jobs"."fence" + 1,
            "status" = 'queued',
            "attempts" = 0,
            "dueAt" = CURRENT_TIMESTAMP,
            "errorCode" = NULL,
            "leaseOwner" = NULL,
            "leaseToken" = NULL,
            "leaseUntil" = NULL,
            "resultArtifactId" = NULL,
            "updatedAt" = CURRENT_TIMESTAMP
      WHERE "cohort_text_jobs"."dependencyFingerprint" <> EXCLUDED."dependencyFingerprint"
         OR "cohort_text_jobs"."status" IN ('superseded', 'failed', 'canceled')`,
      [newId, workspaceId, intent.jobKey, intent.stage, intent.handlerVersion, intent.dependencyFingerprint]
    );
  }
}

export async function cancelJourneyDiscovery(
  tx: TextArtifactSql,
  workspaceId: string
): Promise<string[]> {
  const result = await tx.query(
    `UPDATE "cohort_text_jobs"
     SET "status" = 'canceled', "fence" = "fence" + 1,
         "leaseOwner" = NULL, "leaseToken" = NULL, "leaseUntil" = NULL, "updatedAt" = CURRENT_TIMESTAMP
     WHERE "workspaceId" = $1 AND "jobKey" LIKE 'journey:discovery:%'
       AND "status" IN ('queued', 'running', 'failed', 'superseded')
     RETURNING "id"`,
    [workspaceId]
  );
  return result.rows.map(r => String(r.id));
}

