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
  return port.transaction(tx => enqueueTextJobPlanInTransaction(tx, workspaceId, state, intents));
}

export async function enqueueTextJobPlanInTransaction(
  tx: TextArtifactSql,
  workspaceId: string,
  state: CohortWorkspace,
  planned = planTextJobs(state)
): Promise<{ jobIds: string[]; inserted: number; superseded: number }> {
  const intents = planned;
  // 1. Mark obsolete jobs as superseded in one query
  const obsolete = await tx.query(
    `UPDATE "cohort_text_jobs"
      SET "status" = 'superseded', "fence" = "fence" + 1,
          "leaseOwner" = NULL, "leaseToken" = NULL, "leaseUntil" = NULL, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "workspaceId" = $1 AND "status" IN ('queued', 'running', 'failed')
        AND "jobKey" LIKE 'text:%'
        AND NOT ("jobKey" = ANY($2::text[])) RETURNING "id"`,
    [workspaceId, intents.map(intent => intent.jobKey)]
  );

  // If there are no intents, or if the workspace processing is already ready and all sources are ready (client-extracted), skip enqueuing
  if (intents.length === 0 || (state.processing.status === 'ready' && state.sources.every(s => s.state === 'ready'))) {
    return { jobIds: [], inserted: 0, superseded: obsolete.rows.length };
  }

  // 2. Fetch all existing jobs for these jobKeys in one query
  const existingRes = await tx.query(
    `SELECT "id", "jobKey", "status" FROM "cohort_text_jobs"
      WHERE "workspaceId" = $1 AND "jobKey" = ANY($2::text[]) FOR UPDATE`,
    [workspaceId, intents.map(intent => intent.jobKey)]
  );
  const existingMap = new Map<string, { id: string; status: string }>(
    existingRes.rows.map((r: any) => [r.jobKey, { id: String(r.id), status: r.status }])
  );

  // 3. Prepare inserts for new jobs and collect all job IDs
  const ids = new Map<string, string>();
  const toInsert: Array<{
    id: string;
    jobKey: string;
    sourceId: string | null;
    sourceVersion: number | null;
    stage: string;
    dependencyFingerprint: string;
    handlerVersion: number;
  }> = [];
  const toUnsupersede: string[] = [];

  for (const intent of intents) {
    const existing = existingMap.get(intent.jobKey);
    if (existing) {
      ids.set(intent.jobKey, existing.id);
      if (existing.status === 'superseded' || existing.status === 'failed') {
        toUnsupersede.push(existing.id);
      }
    } else {
      const newId = randomUUID();
      ids.set(intent.jobKey, newId);
      const hasInput = intent.sourceId
        ? state.sources.some(source => source.id === intent.sourceId && source.input)
        : state.sources.some(source => source.input);
      toInsert.push({
        id: newId,
        jobKey: intent.jobKey,
        sourceId: intent.sourceId,
        sourceVersion: intent.sourceVersion,
        stage: intent.stage,
        dependencyFingerprint: intent.dependencyFingerprint,
        handlerVersion: hasInput ? 2 : 1,
      });
    }
  }

  // 4. Batch insert new jobs in chunks if any
  let inserted = 0;
  if (toInsert.length > 0) {
    const values: unknown[] = [];
    const rowPlaceholders: string[] = [];
    toInsert.forEach((item, idx) => {
      const offset = idx * 8;
      rowPlaceholders.push(
        `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, CURRENT_TIMESTAMP)`
      );
      values.push(
        item.id,
        workspaceId,
        item.jobKey,
        item.sourceId,
        item.sourceVersion,
        item.stage,
        item.dependencyFingerprint,
        item.handlerVersion
      );
    });

    const insertSql = `INSERT INTO "cohort_text_jobs"
      ("id", "workspaceId", "jobKey", "sourceId", "sourceVersion", "stage", "dependencyFingerprint", "handlerVersion", "updatedAt")
      VALUES ${rowPlaceholders.join(', ')}
      ON CONFLICT ("workspaceId", "jobKey") DO NOTHING RETURNING "id"`;

    const res = await tx.query(insertSql, values);
    inserted = res.rows.length;
  }

  // 5. Un-supersede previously superseded jobs in one query
  if (toUnsupersede.length > 0) {
    await tx.query(
      `UPDATE "cohort_text_jobs"
        SET "status" = 'queued', "dueAt" = CURRENT_TIMESTAMP, "attempts" = 0,
            "errorCode" = NULL, "fence" = "fence" + 1,
            "leaseOwner" = NULL, "leaseToken" = NULL, "leaseUntil" = NULL,
            "resultArtifactId" = NULL, "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ANY($1::text[]) AND "workspaceId" = $2 AND "status" IN ('superseded', 'failed')`,
      [toUnsupersede, workspaceId]
    );
  }

  // 6. Batch insert all edges in one query
  const edgesToInsert: Array<[string, string, string]> = [];
  for (const intent of intents) {
    const jobId = ids.get(intent.jobKey)!;
    for (const prerequisiteKey of intent.prerequisiteKeys) {
      const prerequisiteId = ids.get(prerequisiteKey);
      if (!prerequisiteId) throw new Error('MISSING_PLANNED_DEPENDENCY');
      edgesToInsert.push([workspaceId, jobId, prerequisiteId]);
    }
  }

  if (edgesToInsert.length > 0) {
    const edgeValues: unknown[] = [];
    const edgePlaceholders: string[] = [];
    edgesToInsert.forEach((edge, idx) => {
      const offset = idx * 3;
      edgePlaceholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3})`);
      edgeValues.push(edge[0], edge[1], edge[2]);
    });

    await tx.query(
      `INSERT INTO "cohort_text_job_edges" ("workspaceId", "jobId", "prerequisiteId")
        VALUES ${edgePlaceholders.join(', ')}
        ON CONFLICT DO NOTHING`,
      edgeValues
    );
  }

  return {
    jobIds: intents.map(intent => ids.get(intent.jobKey)!),
    inserted,
    superseded: obsolete.rows.length,
  };
}
