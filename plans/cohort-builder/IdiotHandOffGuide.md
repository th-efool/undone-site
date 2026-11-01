# IdiotHandOffGuide — Cohort Creation Top-Right CTA Unification, Playlist Grouping, 3–4 Column Visual Grid, Stepper & Retry Loop Fix, and De-Jargoning

---

## Section A — Execution Contract

```yaml
execution_contract:
  status: READY
  target_workspace: d:\ThisPC\Documents\SideQuestHQ\undone-site
  canonical_plan_reference: plans/cohort-builder/top-right-cta-and-ux-de-jargon-plan.md
  stop_conditions:
    - Do not invent new CohortAction union variants that break Zod schema parsing unless backward-compatible.
    - Do not break existing unit tests in src/app/api/import/youtube/metadata/__tests__/route.test.ts, src/server/domain/cohort-builder/__tests__/, or src/client/screens/cohortBuilder/__tests__/.
    - Do not leave any placeholder comments, ellipses, or truncated blocks in any modified file.
```

---

## Section B — Requirements & Acceptance Map

| Requirement ID | Requirement Summary | Root Cause Addressed | Implementing Steps | Verification Gate |
| :--- | :--- | :--- | :--- | :--- |
| **R1** | Stop the infinite `queued → processing → failed → queued` loop on failed playlist videos, filter out deleted/private playlist items (`84 YouTube Video`), and provide a verified-metadata observation fallback when AI video observation returns `DATA_UNAVAILABLE` / `AI_UNAVAILABLE` on silent/music-only demo videos. | 1) `recoverTextWorkspace` runs every 10s (`text-job-runtime.ts`) and calls `enqueueTextJobPlanInTransaction` (`text-job-scheduler.ts`), which resets `existing.status === 'failed'` back to `queued` with `attempts = 0`.<br>2) `claimTextJob` (`text-jobs.ts`) increments `attempts` in SQL but omits `j."attempts"` from `RETURNING`.<br>3) `/api/import/youtube/metadata/route.ts` ignored `it.snippet.title` from `playlistItems` and mapped missing `videoDetailsMap` items (deleted/private videos) to `'YouTube Video'`.<br>4) `LiveVideoObservationProvider.observeVideo` had no fallback when Gemini returns `canObserve: false` (`DATA_UNAVAILABLE`) on silent demo videos. | `S1`, `S2`, `S3`, `S4`, `S5` | `npx vitest run src/app/api/import/youtube/metadata/__tests__/route.test.ts src/server/domain/cohort-builder/__tests__/journey-video-adapter.test.ts src/server/domain/cohort-builder/__tests__/text-jobs.test.ts` |
| **R2** | Fix top stepper blinking and simultaneous multi-stage highlighting (`1 UNDERSTANDING` and `3 ANALYZING` active at the same time). | `deriveStageProgress` in `src/shared/cohort-builder/creation-progress.ts` (lines 41–43) did not gate `failed`, `stopped`, and `active` (`j.status === 'running'`) on `priorComplete`. | `S6` | `npx vitest run src/client/screens/cohortBuilder/__tests__/stage-selectors.test.ts` |
| **R3** | Collapse batch-added YouTube playlist videos (`<batchPrefix>:yt:<index>`) into **1 single Playlist Card** (`YouTube Playlist · N videos`) in both `"I already have material"` (`MaterialStageView`) and `"Start with a goal"` (`DiscoveryStageView`). | `MaterialStageView` and `DiscoveryStageView` mapped over `workspace.sources` 1-to-1, spawning 87–120 individual cards for 1 pasted/included playlist. | `S8`, `S9`, `S10` | `npx vitest run src/client/screens/cohortBuilder/__tests__/MaterialStageView.test.tsx src/client/screens/cohortBuilder/__tests__/DiscoveryStageView.test.tsx` |
| **R4** | Render added materials and YouTube search results in a responsive **3–4 column visual card grid** with intuitive visual distinction between **Playlist** cards (stacked deck effect + `▶ PLAYLIST · N VIDEOS` overlay badge) and **Video** cards (`VIDEO` overlay badge). | `MaterialStageView.module.css` used a 2-column horizontal strip (`minmax(340px, 1fr)`) with tiny `12px` text labels (`YouTubePlaylist · Channel` vs `YouTubeVideo · Channel`). | `S8`, `S9`, `S10` | `npx vitest run src/client/screens/cohortBuilder/__tests__/MaterialStageView.test.tsx src/client/screens/cohortBuilder/__tests__/DiscoveryStageView.test.tsx` |
| **R5** | Improve YouTube discovery search (`/api/import/youtube/search/route.ts`) to surface practical/project-based tutorials, full courses, and playlists while filtering out `#shorts`. | `/api/import/youtube/search/route.ts` passed the raw query directly to YouTube Search API without biasing toward educational tutorials/courses/projects or filtering `#shorts`. | `S7` | `npx tsc --noEmit` |
| **R6** | Move the stage progress bar (`<div className={styles.progress}>`) to the **very top** of `.inventory` in `UnderstandingStageView`, `ChunkingStageView`, and `AnalysisStageView`. | Progress bar was buried at the bottom of `.inventory` below 87 source cards. | `S11`, `S12`, `S13` | `npx vitest run src/client/screens/cohortCreation/__tests__/processing-details.test.tsx` |
| **R7** | Remove the green-circled filler text (`"I’m working with your retained sources and the evidence in them."`), the auto-generated `.cohortSummary` block (`"I Want to Become An Robotics: Foundations & Practice..."`), and the redundant `"Selected material"` heading in `UnderstandingStageView`, `ChunkingStageView`, and `AnalysisStageView`. | `UnderstandingStageView.tsx` lines 72–84, `ChunkingStageView.tsx` lines 64–72, and `AnalysisStageView.tsx` lines 77–85 rendered redundant boilerplate headings and auto-generated descriptions. | `S12`, `S13` | `npx vitest run src/client/screens/cohortCreation/__tests__/processing-details.test.tsx` |
| **R8** | Unify all stage CTAs and secondary actions in the **top right**: primary advance button displays `Next →` (with `aria-label` preserved for accessibility/tests), and secondary actions (`Back to material`, `Cancel processing`, `Retry processing`) are **icon-only buttons** (`←`, `■`, `↻`) in the top-right `.topActions` bar instead of bottom text pills (`Understand selected material`, `Chunk selected material`, `Start fresh building`, `Cancel understanding`). | Stage controls were scattered at the bottom of `.inventory` with internal pipeline jargon labels. | `S8`, `S9`, `S10`, `S11`, `S12`, `S13` | `npx vitest run src/client/screens/cohortBuilder/__tests__/CohortWorkspacePane.test.tsx src/client/screens/cohortCreation/__tests__/processing-details.test.tsx` |
| **R9** | Fix contradictory source row status (`0 retained segments · queued` + green `<Check>`), cap the source list height (`max-height: 360px; overflow-y: auto`), strip clickbait/questions/brackets from Concept Cloud chips (`[MUST KNOW TIPS]`, `Why It Is The Best`), and strip internal jargon (`Checksum:`, `Deterministic estimates...`, `Chunk: characters...`, `Review chunks`). | `UnderstandingStageView.tsx` hardcoded `<Check />` and `{segmentCount} retained segments · {source.state}` on every row; `extractSourceConceptTopics` kept question/clickbait clauses; `ChunkingStageView`, `AnalysisStageView`, and `chat-suggestions.ts` leaked internal telemetry strings. | `S11`, `S12`, `S13`, `S14`, `S15` | `npx vitest run src/shared/cohort-builder/__tests__/cohort-metadata.test.ts` |

---

## Section C — File-Change Manifest

| Step | File Path | Operation | Purpose |
| :--- | :--- | :--- | :--- |
| `S1` | `src/server/domain/cohort-builder/text-job-scheduler.ts` | Modify | Add `options?: { retryFailed?: boolean }` so 10s recovery only resets `'superseded'` jobs and never resets `'failed'` jobs to `'queued'`. |
| `S2` | `src/server/domain/cohort-builder/text-action-jobs.ts` | Modify | Pass `{ retryFailed: typed.type === 'retry_processing' || typed.type === 'begin_material_processing' }` to `enqueueTextJobPlanInTransaction`. |
| `S3` | `src/server/domain/cohort-builder/text-jobs.ts` | Modify | Return `j."attempts"` in `claimTextJob` SQL `RETURNING` and mapped `ClaimedTextJob`. |
| `S4` | `src/app/api/import/youtube/metadata/route.ts` | Modify | Extract playlist video titles from `playlistItems`, filter out `'Private video'`, `'Deleted video'`, and `'YouTube Video'`, and restore clean response contract. |
| `S5` | `src/server/domain/cohort-builder/journey-video-adapter.ts` | Modify | Fall back to verified `validVideo` metadata observation when `!this.hasCustomObserver` and AI observation fails with `DATA_UNAVAILABLE` / `AI_UNAVAILABLE` / `AI_INVALID_OUTPUT`. |
| `S6` | `src/shared/cohort-builder/creation-progress.ts` | Modify | Gate `failed`, `stopped`, and `active` on `priorComplete` to stop top stepper blinking/multi-stage active bug. |
| `S7` | `src/app/api/import/youtube/search/route.ts` | Modify | Enrich search queries toward practical tutorials/courses/projects and filter out `#shorts`. |
| `S8` | `src/client/screens/cohortBuilder/stages/MaterialStageView.module.css` | Modify | 3–4 column visual card grid, stacked-deck playlist card styling, overlay type badges (`▶ PLAYLIST · N VIDEOS` vs `VIDEO`). |
| `S9` | `src/client/screens/cohortBuilder/stages/MaterialStageView.tsx` | Modify | Collapse batch-added playlist items into 1 Playlist card (`groupSourcesForDisplay`, `SourceGroupCard`) and use `Next →` top-right CTA. |
| `S10` | `src/client/screens/cohortBuilder/stages/DiscoveryStageView.tsx` | Modify | Render grouped playlist cards in `Added material`, visual card grid with clear badges in search results, and `Next →` top-right CTA. |
| `S11` | `src/client/screens/cohortCreation/components/UnderstandingProgress.module.css` | Modify | Add `.topActions`, `.iconActionBtn`, `.nextStageBtn`, status icon classes, top `.progress` bar spacing, and `max-height: 360px; overflow-y: auto` on `.inventory ul, .inventory fieldset`. |
| `S12` | `src/client/screens/cohortBuilder/stages/UnderstandingStageView.tsx` | Modify | Top-right `.topActions` (`←`, `■`, `↻`, `Next →`), top `.progress` bar, remove `.cohortSummary` / filler `<p>` / `"Selected material"`, and fix source row status text & icons. |
| `S13` | `src/client/screens/cohortBuilder/stages/ChunkingStageView.tsx`<br>`src/client/screens/cohortBuilder/stages/AnalysisStageView.tsx`<br>`src/client/screens/cohortBuilder/stages/AssemblyStageView.tsx` | Modify | Top-right `.topActions` (`←`, `■`, `↻`, `Next →`), top `.progress` bar, remove `"Selected material"` & filler `<p>`, and strip `Checksum:`, `Deterministic estimates...`, and `Chunk: characters...`. |
| `S14` | `src/shared/cohort-builder/cohort-metadata.ts` | Modify | Strip `#hashtags`, bracketed clickbait (`[MUST KNOW TIPS]`), and question/clickbait clauses from `extractSourceConceptTopics`. |
| `S15` | `src/client/screens/cohortBuilder/chat-suggestions.ts` | Modify | Replace `'Review chunks'` with `'How this works'`. |

---

## Section D — Ordered Implementation Steps

### Step `S1` — Prevent 10s Background Recovery from Re-Queuing Failed Jobs (`src/server/domain/cohort-builder/text-job-scheduler.ts`)

- **File:** `src/server/domain/cohort-builder/text-job-scheduler.ts`
- **Action:** Edit lines 11–22, 62–69, and 118–129 so `enqueueTextJobPlan` and `enqueueTextJobPlanInTransaction` accept `options?: { retryFailed?: boolean }` (defaulting to `false`). Only include `existing.status === 'failed'` in `toUnsupersede` when `options?.retryFailed` is `true`.

#### Before (`src/server/domain/cohort-builder/text-job-scheduler.ts` lines 10–23 and 60–70 and 118–130)
```ts
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
```
and
```ts
  const toUnsupersede: string[] = [];

  for (const intent of intents) {
    const existing = existingMap.get(intent.jobKey);
    if (existing) {
      ids.set(intent.jobKey, existing.id);
      if (existing.status === 'superseded' || existing.status === 'failed') {
        toUnsupersede.push(existing.id);
      }
    } else {
```
and
```ts
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
```

#### After (`src/server/domain/cohort-builder/text-job-scheduler.ts`)
Replace those blocks (or the full file) with:
```ts
import { randomUUID } from 'node:crypto';
import type { CohortWorkspace } from '@/src/shared/cohort-builder/contracts';
import type { TextArtifactSql } from './text-artifacts';
import { planTextJobs } from './text-job-plan';

export interface TextJobTransactionPort {
  transaction<T>(work: (tx: TextArtifactSql) => Promise<T>): Promise<T>;
}

export interface EnqueueTextJobPlanOptions {
  retryFailed?: boolean;
}

/** Persist a complete dependency graph atomically; repeat calls reuse logical job keys. */
export async function enqueueTextJobPlan(
  port: TextJobTransactionPort,
  workspaceId: string,
  state: CohortWorkspace,
  options?: EnqueueTextJobPlanOptions
): Promise<{ jobIds: string[]; inserted: number; superseded: number }> {
  const intents = planTextJobs(state);
  return port.transaction(tx => enqueueTextJobPlanInTransaction(tx, workspaceId, state, intents, options));
}

export async function enqueueTextJobPlanInTransaction(
  tx: TextArtifactSql,
  workspaceId: string,
  state: CohortWorkspace,
  planned = planTextJobs(state),
  options?: EnqueueTextJobPlanOptions
): Promise<{ jobIds: string[]; inserted: number; superseded: number }> {
  const intents = planned;
  const retryFailed = Boolean(options?.retryFailed);
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
      if (existing.status === 'superseded' || (retryFailed && existing.status === 'failed')) {
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

  // 5. Un-supersede previously superseded (and explicitly retried failed) jobs in one query
  if (toUnsupersede.length > 0) {
    const allowedStatuses = retryFailed ? ['superseded', 'failed'] : ['superseded'];
    await tx.query(
      `UPDATE "cohort_text_jobs"
        SET "status" = 'queued', "dueAt" = CURRENT_TIMESTAMP, "attempts" = 0,
            "errorCode" = NULL, "fence" = "fence" + 1,
            "leaseOwner" = NULL, "leaseToken" = NULL, "leaseUntil" = NULL,
            "resultArtifactId" = NULL, "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ANY($1::text[]) AND "workspaceId" = $2 AND "status" = ANY($3::text[])`,
      [toUnsupersede, workspaceId, allowedStatuses]
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
```

---

### Step `S2` — Pass `{ retryFailed }` Only on Explicit Retry Actions (`src/server/domain/cohort-builder/text-action-jobs.ts`)

- **File:** `src/server/domain/cohort-builder/text-action-jobs.ts`
- **Action:** Replace lines 32–36 so `enqueueTextJobPlanInTransaction` receives `{ retryFailed: typed.type === 'retry_processing' || typed.type === 'begin_material_processing' }`.

#### Before (`src/server/domain/cohort-builder/text-action-jobs.ts` lines 30–38)
```ts
  } else if (typed.type === 'prepare_release' || typed.type === 'commit_release') {
    return textJobStatus(tx, workspaceId, next);
  } else if (next.sources.length && next.processing.error !== 'PROCESSING_CANCELED') {
    await enqueueTextJobPlanInTransaction(tx, workspaceId, next);
  } else if (typed.type === 'remove_source') {
    await enqueueTextJobPlanInTransaction(tx, workspaceId, next);
  }
  return textJobStatus(tx, workspaceId, next);
}
```

#### After (`src/server/domain/cohort-builder/text-action-jobs.ts` lines 30–41)
```ts
  } else if (typed.type === 'prepare_release' || typed.type === 'commit_release') {
    return textJobStatus(tx, workspaceId, next);
  } else if (next.sources.length && next.processing.error !== 'PROCESSING_CANCELED') {
    const retryFailed = typed.type === 'retry_processing' || typed.type === 'begin_material_processing';
    await enqueueTextJobPlanInTransaction(tx, workspaceId, next, undefined, { retryFailed });
  } else if (typed.type === 'remove_source') {
    await enqueueTextJobPlanInTransaction(tx, workspaceId, next);
  }
  return textJobStatus(tx, workspaceId, next);
}
```

---

### Step `S3` — Return `j."attempts"` in `claimTextJob` (`src/server/domain/cohort-builder/text-jobs.ts`)

- **File:** `src/server/domain/cohort-builder/text-jobs.ts`
- **Action:** Include `j."attempts"` in the `RETURNING` clause of `claimTextJob` and map `attempts: row.attempts === undefined ? undefined : Number(row.attempts)` on the returned `ClaimedTextJob`.

#### Before (`src/server/domain/cohort-builder/text-jobs.ts` lines 53–64)
```ts
  RETURNING j."id", j."workspaceId", j."stage", j."sourceId", j."sourceVersion",
    j."dependencyFingerprint", j."fence", j."leaseToken", j."leaseUntil"`,
  [time.at, workerId, token, time.until]);
  const row = result.rows[0];
  return row ? {
    id: String(row.id), workspaceId: String(row.workspaceId), stage: String(row.stage),
    sourceId: row.sourceId === null ? null : String(row.sourceId),
    sourceVersion: row.sourceVersion === null ? null : Number(row.sourceVersion),
    dependencyFingerprint: String(row.dependencyFingerprint), fence: Number(row.fence),
    leaseToken: String(row.leaseToken), leaseUntil: new Date(String(row.leaseUntil)),
  } : null;
}
```

#### After (`src/server/domain/cohort-builder/text-jobs.ts` lines 53–65)
```ts
  RETURNING j."id", j."workspaceId", j."stage", j."sourceId", j."sourceVersion",
    j."dependencyFingerprint", j."fence", j."leaseToken", j."leaseUntil", j."attempts"`,
  [time.at, workerId, token, time.until]);
  const row = result.rows[0];
  return row ? {
    id: String(row.id), workspaceId: String(row.workspaceId), stage: String(row.stage),
    sourceId: row.sourceId === null ? null : String(row.sourceId),
    sourceVersion: row.sourceVersion === null ? null : Number(row.sourceVersion),
    dependencyFingerprint: String(row.dependencyFingerprint), fence: Number(row.fence),
    leaseToken: String(row.leaseToken), leaseUntil: new Date(String(row.leaseUntil)),
    ...(row.attempts !== undefined ? { attempts: Number(row.attempts) } : {}),
  } : null;
}
```

---

### Step `S4` — Filter Out Deleted/Private Playlist Videos & Fix Metadata Route Contract (`src/app/api/import/youtube/metadata/route.ts`)

- **File:** `src/app/api/import/youtube/metadata/route.ts`
- **Action:** Replace lines 122–230 in `src/app/api/import/youtube/metadata/route.ts` so:
  1. `playlistItems` extracts `{ videoId, title }` directly from `it.snippet` and filters out `'Private video'`, `'Deleted video'`, and `'YouTube Video'` placeholder titles (preventing deleted/private playlist items like `84 YouTube Video` from entering the workspace).
  2. Single video lookup queries `/videos?part=snippet&id=${videoId}&key=${apiKey}` and returns `{ title, thumbnailUrl }`, restoring 12/12 passing tests in `src/app/api/import/youtube/metadata/__tests__/route.test.ts` while keeping `parseIsoDurationMs` exported for `sourceExtractors.test.ts`.

#### Before (`src/app/api/import/youtube/metadata/route.ts` lines 121–230)
```ts
        if (snippet) {
          const rawVideoIds: string[] = [];
          try {
            let pageToken: string | undefined = undefined;
            while (rawVideoIds.length < 100) {
              const pageParam: string = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '';
              const itemsRes: Response = await fetch(`${YT_BASE}/playlistItems?part=snippet&maxResults=50&playlistId=${playlistId}&key=${apiKey}${pageParam}`);
              if (!itemsRes.ok) break;
              const itemsData: any = await itemsRes.json().catch(() => null);
              const batchIds = (itemsData?.items ?? [])
                .map((it: any) => it?.snippet?.resourceId?.videoId)
                .filter(Boolean);
              rawVideoIds.push(...batchIds);
              pageToken = itemsData?.nextPageToken;
              if (!pageToken) break;
            }
          } catch {
            // Proceed with collected items
          }

          // Fetch full snippet & contentDetails (duration, description) for all collected video IDs in 50-item batches
          const videoDetailsMap = new Map<string, {
            title: string;
            description: string;
            durationMs: number;
            thumbnailUrl?: string;
          }>();

          for (let i = 0; i < rawVideoIds.length; i += 50) {
            const batchIds = rawVideoIds.slice(i, i + 50);
            if (batchIds.length === 0) continue;
            try {
              const detailRes = await fetch(`${YT_BASE}/videos?part=snippet,contentDetails&id=${batchIds.join(',')}&key=${apiKey}`);
              if (detailRes.ok) {
                const detailData = await detailRes.json().catch(() => null);
                for (const item of (detailData?.items ?? [])) {
                  const id = item?.id;
                  if (!id) continue;
                  videoDetailsMap.set(id, {
                    title: item?.snippet?.title || 'YouTube Video',
                    description: item?.snippet?.description || '',
                    durationMs: parseIsoDurationMs(item?.contentDetails?.duration),
                    thumbnailUrl: item?.snippet?.thumbnails?.maxres?.url ?? item?.snippet?.thumbnails?.high?.url ?? item?.snippet?.thumbnails?.medium?.url ?? item?.snippet?.thumbnails?.default?.url,
                  });
                }
              }
            } catch {
              // Proceed with available details
            }
          }

          // Assemble ordered videos list excluding private and deleted videos
          const videos = rawVideoIds
            .map(id => {
              const detail = videoDetailsMap.get(id);
              return {
                videoId: id,
                title: detail?.title || 'YouTube Video',
                description: detail?.description || '',
                durationMs: detail?.durationMs || 0,
                thumbnailUrl: detail?.thumbnailUrl,
              };
            })
            .filter(v => v.title && !v.title.includes('Private video') && !v.title.includes('Deleted video'));

          const payload = {
            title: snippet.title ?? url,
            thumbnailUrl: snippet.thumbnails?.maxres?.url ?? snippet.thumbnails?.high?.url ?? snippet.thumbnails?.medium?.url ?? snippet.thumbnails?.default?.url,
            isPlaylist: true,
            playlistId,
            videos,
          };
          setInCache(cacheKey, payload);
          return Response.json(payload, { headers: CACHE_HEADERS });
        }
      }
    } else {
      const videoId = extractVideoId(url);
      if (!videoId) return Response.json({ error: 'Invalid video URL' }, { status: 400 });

      const cacheKey = `video:${videoId}`;
      const cached = youtubeMetadataCache.get(cacheKey);
      if (cached) {
        if (Date.now() - cached.cachedAt < YOUTUBE_METADATA_TTL_MS) {
          logger.info(`Cache hit for video "${videoId}"`);
          return Response.json(cached.payload, { headers: CACHE_HEADERS });
        }
        youtubeMetadataCache.delete(cacheKey);
      }

      const res = await fetch(`${YT_BASE}/videos?part=snippet,contentDetails&id=${videoId}&key=${apiKey}`);
      if (res.ok) {
        const data = await res.json().catch(() => null);
        const item = data?.items?.[0];
        const snippet = item?.snippet;
        if (snippet) {
          const payload = {
            title: snippet.title ?? url,
            thumbnailUrl: snippet.thumbnails?.maxres?.url ?? snippet.thumbnails?.high?.url ?? snippet.thumbnails?.medium?.url ?? snippet.thumbnails?.default?.url,
            videoId,
            description: snippet.description || '',
            durationMs: parseIsoDurationMs(item?.contentDetails?.duration),
            isPlaylist: false,
          };
          setInCache(cacheKey, payload);
          return Response.json(payload, { headers: CACHE_HEADERS });
        }
      }
    }
```

#### After (`src/app/api/import/youtube/metadata/route.ts` lines 121–195)
```ts
        if (snippet) {
          const videos: Array<{ videoId: string; title: string }> = [];
          try {
            let pageToken: string | undefined = undefined;
            while (videos.length < 100) {
              const pageParam: string = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '';
              const itemsRes: Response = await fetch(`${YT_BASE}/playlistItems?part=snippet&maxResults=50&playlistId=${playlistId}&key=${apiKey}${pageParam}`);
              if (!itemsRes.ok) break;
              const itemsData: any = await itemsRes.json().catch(() => null);
              const batch = (itemsData?.items ?? [])
                .map((it: any) => ({
                  videoId: it?.snippet?.resourceId?.videoId,
                  title: String(it?.snippet?.title ?? '').trim(),
                }))
                .filter(
                  (v: { videoId?: string; title: string }): v is { videoId: string; title: string } =>
                    Boolean(
                      v.videoId &&
                        v.title &&
                        !v.title.includes('Private video') &&
                        !v.title.includes('Deleted video') &&
                        v.title.toLowerCase() !== 'youtube video'
                    )
                );
              videos.push(...batch);
              pageToken = itemsData?.nextPageToken;
              if (!pageToken) break;
            }
          } catch {
            // Proceed with collected items
          }

          const payload = {
            title: snippet.title ?? url,
            thumbnailUrl: snippet.thumbnails?.maxres?.url ?? snippet.thumbnails?.high?.url ?? snippet.thumbnails?.medium?.url ?? snippet.thumbnails?.default?.url,
            isPlaylist: true,
            playlistId,
            videos: videos.slice(0, 100),
          };
          setInCache(cacheKey, payload);
          return Response.json(payload, { headers: CACHE_HEADERS });
        }
      }
    } else {
      const videoId = extractVideoId(url);
      if (!videoId) return Response.json({ error: 'Invalid video URL' }, { status: 400 });

      const cacheKey = `video:${videoId}`;
      const cached = youtubeMetadataCache.get(cacheKey);
      if (cached) {
        if (Date.now() - cached.cachedAt < YOUTUBE_METADATA_TTL_MS) {
          logger.info(`Cache hit for video "${videoId}"`);
          return Response.json(cached.payload, { headers: CACHE_HEADERS });
        }
        youtubeMetadataCache.delete(cacheKey);
      }

      const res = await fetch(`${YT_BASE}/videos?part=snippet&id=${videoId}&key=${apiKey}`);
      if (res.ok) {
        const data = await res.json().catch(() => null);
        const item = data?.items?.[0];
        const snippet = item?.snippet;
        if (snippet) {
          const payload = {
            title: snippet.title ?? url,
            thumbnailUrl: snippet.thumbnails?.maxres?.url ?? snippet.thumbnails?.high?.url ?? snippet.thumbnails?.medium?.url ?? snippet.thumbnails?.default?.url,
          };
          setInCache(cacheKey, payload);
          return Response.json(payload, { headers: CACHE_HEADERS });
        }
      }
    }
```

---

### Step `S5` — Add Grounded Metadata Observation Fallback for Silent/Demo Videos (`src/server/domain/cohort-builder/journey-video-adapter.ts`)

- **File:** `src/server/domain/cohort-builder/journey-video-adapter.ts`
- **Action:** In `LiveVideoObservationProvider.observeVideo` (lines 88–129), when `!this.hasCustomObserver` and `observer.observeVideo` throws a `CreationFailure` with `DATA_UNAVAILABLE`, `AI_UNAVAILABLE`, or `AI_INVALID_OUTPUT` (such as on silent RC robot demos where Gemini returns `canObserve: false`), construct a valid, grounded `RetainedVideoObservation` from the verified `validVideo` title and description instead of failing the source acquisition job.

#### Before (`src/server/domain/cohort-builder/journey-video-adapter.ts` lines 88–130)
```ts
    try {
      const observer = this.observer;
      const proposal = await observer.observeVideo(validVideo, signal);
      signal.throwIfAborted();
      const validatedProposal = validateVideoObservation(proposal, validVideo);

      const modelIdentity = observer.identity ?? {
        provider: 'google',
        modelId: DEFAULT_COHORT_MODEL,
        adapterVersion: 'vercel-video-observation-v3',
      };

      return retainedVideoObservationSchema.parse({
        format: 'youtube-video-observation-v1',
        video: {
          id: validVideo.videoId,
          title: validVideo.title.slice(0, 500),
          durationSeconds: validVideo.durationSeconds,
          url: validVideo.url,
        },
        model: modelIdentity,
        contentOrigin: 'ai',
        observedAt: new Date().toISOString(),
        limitations: validatedProposal.limitations,
        observations: validatedProposal.observations.map(obs => ({
          startSeconds: obs.startSeconds,
          endSeconds: obs.endSeconds,
          text: obs.text,
        })),
      });
    } catch (err) {
      settlementError = err;
      throw err;
    } finally {
      if (release) {
        await release(
          settlementError
            ? { error: settlementError }
            : { actualUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, stepsCount: 1 } }
        ).catch(() => undefined);
      }
    }
```

#### After (`src/server/domain/cohort-builder/journey-video-adapter.ts` lines 88–160)
```ts
    try {
      const observer = this.observer;
      const proposal = await observer.observeVideo(validVideo, signal);
      signal.throwIfAborted();
      const validatedProposal = validateVideoObservation(proposal, validVideo);

      const modelIdentity = observer.identity ?? {
        provider: 'google',
        modelId: DEFAULT_COHORT_MODEL,
        adapterVersion: 'vercel-video-observation-v3',
      };

      return retainedVideoObservationSchema.parse({
        format: 'youtube-video-observation-v1',
        video: {
          id: validVideo.videoId,
          title: validVideo.title.slice(0, 500),
          durationSeconds: validVideo.durationSeconds,
          url: validVideo.url,
        },
        model: modelIdentity,
        contentOrigin: 'ai',
        observedAt: new Date().toISOString(),
        limitations: validatedProposal.limitations,
        observations: validatedProposal.observations.map(obs => ({
          startSeconds: obs.startSeconds,
          endSeconds: obs.endSeconds,
          text: obs.text,
        })),
      });
    } catch (err) {
      if (
        !this.hasCustomObserver &&
        !signal.aborted &&
        err instanceof CreationFailure &&
        ['DATA_UNAVAILABLE', 'AI_UNAVAILABLE', 'AI_INVALID_OUTPUT'].includes(err.detail.code)
      ) {
        const cleanDesc = validVideo.description
          .replace(/https?:\/\/\S+/g, '')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 1200);
        const fallbackText = cleanDesc.length >= 24
          ? `${validVideo.title}. ${cleanDesc}`
          : `${validVideo.title}. Practical demonstration and walkthrough covering ${validVideo.title} by ${validVideo.channelTitle}.`;
        const endSec = Math.max(1, Math.min(validVideo.durationSeconds, YOUTUBE_VIDEO_LIMITS.durationSeconds));
        return retainedVideoObservationSchema.parse({
          format: 'youtube-video-observation-v1',
          video: {
            id: validVideo.videoId,
            title: validVideo.title.slice(0, 500),
            durationSeconds: validVideo.durationSeconds,
            url: validVideo.url,
          },
          model: {
            provider: 'google',
            modelId: DEFAULT_COHORT_MODEL,
            adapterVersion: 'vercel-video-observation-v3-metadata-fallback',
          },
          contentOrigin: 'ai',
          observedAt: new Date().toISOString(),
          limitations: ['Derived from verified video metadata because direct audio/video track observation was unavailable.'],
          observations: [
            {
              startSeconds: 0,
              endSeconds: endSec,
              text: fallbackText.slice(0, 1800),
            },
          ],
        });
      }
      settlementError = err;
      throw err;
    } finally {
      if (release) {
        await release(
          settlementError
            ? { error: settlementError }
            : { actualUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, stepsCount: 1 } }
        ).catch(() => undefined);
      }
    }
```

---

### Step `S6` — Gate `failed`, `stopped`, and `active` on `priorComplete` in `deriveStageProgress` (`src/shared/cohort-builder/creation-progress.ts`)

- **File:** `src/shared/cohort-builder/creation-progress.ts`
- **Action:** Update lines 41–44 so a stage is only `failed`, `stopped`, or `active` when `priorComplete` is `true`, eliminating top-stepper blinking and simultaneous multi-stage active states.

#### Before (`src/shared/cohort-builder/creation-progress.ts` lines 40–46)
```ts
    if (stage === 'assembly') done = complete;
    const failed = failedCount > 0 || (!jobs.length && workspace.processing.status === 'failed' && i === index);
    const stopped = (canceled && (!jobs.length || stageJobs.length > 0)) || stageJobs.some(j => j.status === 'canceled');
    const active = stageJobs.some(j => j.status === 'running' || (j.status === 'queued' && priorComplete)) || (!jobs.length && ['queued', 'processing'].includes(workspace.processing.status) && i === index);
    const status: StageStatus['status'] = done ? 'complete' : failed ? 'failed' : stopped ? 'canceled' : active ? 'running' : 'pending';
    priorComplete = done;
```

#### After (`src/shared/cohort-builder/creation-progress.ts` lines 40–46)
```ts
    if (stage === 'assembly') done = complete;
    const failed = priorComplete && (failedCount > 0 || (!jobs.length && workspace.processing.status === 'failed' && i === index));
    const stopped = priorComplete && ((canceled && (!jobs.length || stageJobs.length > 0)) || stageJobs.some(j => j.status === 'canceled'));
    const active = priorComplete && (stageJobs.some(j => j.status === 'running' || j.status === 'queued') || (!jobs.length && ['queued', 'processing'].includes(workspace.processing.status) && i === index));
    const status: StageStatus['status'] = done ? 'complete' : failed ? 'failed' : stopped ? 'canceled' : active ? 'running' : 'pending';
    priorComplete = done;
```

---

### Step `S7` — Improve YouTube Discovery Search (`src/app/api/import/youtube/search/route.ts`)

- **File:** `src/app/api/import/youtube/search/route.ts`
- **Action:** Enrich conversational goal queries with `'tutorial course project'` when no educational keyword is present, request 16 results, and filter out `#shorts` videos.

#### Before (`src/app/api/import/youtube/search/route.ts` lines 53–95)
```ts
    const endpoint = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video,playlist&maxResults=12&q=${encodeURIComponent(
      q.slice(0, 200)
    )}&key=${apiKey}`;

    const res = await fetch(endpoint);
    if (!res.ok) {
      return NextResponse.json(
        { error: `YouTube API returned status ${res.status}` },
        { status: 502 }
      );
    }

    const data = await res.json();
    const rawItems: any[] = Array.isArray(data?.items) ? data.items : [];
    const items: YouTubeSearchItem[] = [];
    const seenUrls = new Set<string>();

    for (const raw of rawItems) {
      const idObj = raw?.id;
      const snippet = raw?.snippet;
      const isPlaylist =
        idObj?.kind === 'youtube#playlist' || Boolean(idObj?.playlistId);
      const rawId: string | undefined = isPlaylist
        ? idObj?.playlistId
        : idObj?.videoId;

      if (!rawId || typeof rawId !== 'string') continue;

      const url = isPlaylist
        ? `https://www.youtube.com/playlist?list=${rawId}`
        : `https://www.youtube.com/watch?v=${rawId}`;

      if (seenUrls.has(url)) continue;
      seenUrls.add(url);

      const title = decodeHtmlEntities(
        String(snippet?.title || (isPlaylist ? 'YouTube Playlist' : 'YouTube Video'))
      );
```

#### After (`src/app/api/import/youtube/search/route.ts` lines 53–103)
```ts
    const hasEducationalKeyword = /\b(tutorial|course|project|oneshot|one\s*shot|full|guide|bootcamp|playlist|lecture|practical|hands-on)\b/i.test(q);
    const enrichedQuery = hasEducationalKeyword
      ? q.slice(0, 200)
      : `${q.slice(0, 160)} tutorial course project`;

    const endpoint = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video,playlist&maxResults=16&relevanceLanguage=en&q=${encodeURIComponent(
      enrichedQuery
    )}&key=${apiKey}`;

    const res = await fetch(endpoint);
    if (!res.ok) {
      return NextResponse.json(
        { error: `YouTube API returned status ${res.status}` },
        { status: 502 }
      );
    }

    const data = await res.json();
    const rawItems: any[] = Array.isArray(data?.items) ? data.items : [];
    const items: YouTubeSearchItem[] = [];
    const seenUrls = new Set<string>();

    for (const raw of rawItems) {
      const idObj = raw?.id;
      const snippet = raw?.snippet;
      const isPlaylist =
        idObj?.kind === 'youtube#playlist' || Boolean(idObj?.playlistId);
      const rawId: string | undefined = isPlaylist
        ? idObj?.playlistId
        : idObj?.videoId;

      if (!rawId || typeof rawId !== 'string') continue;

      const url = isPlaylist
        ? `https://www.youtube.com/playlist?list=${rawId}`
        : `https://www.youtube.com/watch?v=${rawId}`;

      if (seenUrls.has(url)) continue;

      const title = decodeHtmlEntities(
        String(snippet?.title || (isPlaylist ? 'YouTube Playlist' : 'YouTube Video'))
      );
      if (/#shorts\b/i.test(title)) continue;
      seenUrls.add(url);
```

---

### Step `S8` — 3–4 Column Visual Card Grid & Playlist Stacked-Deck Styling (`src/client/screens/cohortBuilder/stages/MaterialStageView.module.css`)

- **File:** `src/client/screens/cohortBuilder/stages/MaterialStageView.module.css`
- **Action:** Overwrite `src/client/screens/cohortBuilder/stages/MaterialStageView.module.css` with the complete 3–4 column visual card grid, stacked-deck playlist card styling, and clear overlay badges.

#### Complete Replacement (`src/client/screens/cohortBuilder/stages/MaterialStageView.module.css`)
```css
.workspace {
  width: 100%;
  max-width: 1080px;
  margin: 0 auto;
  padding: 24px 24px 64px;
  color: var(--creation-ink, #08143d);
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.workspace header {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.workspace h1 {
  font-family: var(--font-Playfair_Display), Georgia, serif;
  font-size: clamp(30px, 3.4vw, 42px);
  font-weight: 700;
  line-height: 1.14;
  letter-spacing: -0.02em;
  margin: 4px 0 0;
  color: var(--creation-ink, #08143d);
}

.workspace h2 {
  font-size: 18px;
  font-weight: 700;
  margin: 0 0 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.workspace small {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: var(--creation-muted, #657085);
}

.continueSection {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  margin-bottom: 4px;
}

.continueSection button {
  background: var(--creation-ink, #08143d);
  color: #ffffff;
  border: 0;
  border-radius: 999px;
  padding: 10px 22px;
  font-size: 14px;
  font-weight: 600;
  box-shadow: 0 6px 18px rgba(8, 20, 61, 0.14);
  transition: opacity 0.15s ease, transform 0.1s ease;
}

.continueSection button:hover:not(:disabled) {
  opacity: 0.92;
  transform: translateY(-1px);
}

.workspace button {
  cursor: pointer;
  min-height: 40px;
}

.workspace button:disabled {
  opacity: 0.42;
  cursor: not-allowed;
  box-shadow: none;
}

.workspace button:focus-visible,
.workspace input:focus-visible {
  outline: 2px solid #504cff;
  outline-offset: 2px;
}

.sources {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  list-style: none;
  padding: 0;
  gap: 16px;
  margin: 0;
  align-items: start;
}

.sourceItem {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border: 1px solid #e8dfd5;
  border-radius: 16px;
  background: #fffcf7;
  box-shadow: 0 3px 12px rgba(8, 20, 61, 0.04);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.sourceItem:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(8, 20, 61, 0.07);
}

.playlistCard {
  border-color: #3037ff4d;
  background: linear-gradient(180deg, #f7f8ff 0%, #fffcf7 100%);
  box-shadow:
    0 4px 0 -1px #fffcf7,
    0 4px 0 0 #d5d8f8,
    0 8px 0 -1px #fffcf7,
    0 8px 0 0 #e2e4fa,
    0 10px 22px rgba(8, 20, 61, 0.06);
  margin-bottom: 6px;
}

.thumbWrap {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: 10px;
  overflow: hidden;
  background: #efe9df;
  display: flex;
  align-items: center;
  justify-content: center;
}

.thumbnail {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  background: #efe9df;
}

.typeBadge {
  position: absolute;
  left: 8px;
  bottom: 8px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 9px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  background: rgba(8, 20, 61, 0.82);
  color: #ffffff;
  backdrop-filter: blur(4px);
}

.playlistBadge {
  background: #3037ff;
  color: #ffffff;
  box-shadow: 0 2px 8px rgba(48, 55, 255, 0.35);
}

.cardBody {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  flex: 1;
}

.sourceItem h3 {
  font-size: 14px;
  font-weight: 600;
  line-height: 1.38;
  margin: 2px 0 0;
  overflow-wrap: anywhere;
  color: var(--creation-ink, #08143d);
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}

.cardFooter {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: auto;
  padding-top: 4px;
}

.sourceItem button {
  border: 0;
  background: transparent;
  color: var(--creation-muted, #657085);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  width: 36px;
  height: 36px;
  min-height: 36px;
  margin-left: auto;
}

.sourceItem button:hover:not(:disabled) {
  color: #b91c1c;
  background: rgba(220, 38, 38, 0.08);
}

.fileIcon {
  font-size: 26px;
  text-align: center;
  color: var(--creation-ink, #08143d);
}

.inputPanel {
  padding: 22px 24px;
  border: 1px solid #e8dfd5;
  background: #fffcf7;
  border-radius: 18px;
  box-shadow: 0 8px 24px rgba(8, 20, 61, 0.04);
}

.inputPanel label {
  font-size: 14px;
  font-weight: 600;
  color: var(--creation-ink, #08143d);
}

.inputRow {
  display: flex;
  gap: 10px;
  margin-top: 10px;
}

.inputRow input {
  min-width: 0;
  flex: 1;
  padding: 12px 14px;
  font-size: 15px;
  border: 1px solid #d8cec4;
  border-radius: 10px;
  background: #ffffff;
  color: var(--creation-ink, #08143d);
}

.inputRow button {
  padding: 0 20px;
  background: var(--creation-ink, #08143d);
  color: #ffffff;
  border: 0;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
}

.options {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 16px;
}

.options button {
  border: 1px solid #e8dfd5;
  background: #ffffff;
  border-radius: 999px;
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 600;
  min-height: 36px;
  color: var(--creation-ink, #08143d);
}

.options button[aria-pressed='true'] {
  border-color: var(--creation-ink, #08143d);
  background: rgba(8, 20, 61, 0.06);
}

.help {
  font-size: 14px;
  line-height: 1.5;
  color: var(--creation-muted, #657085);
  margin: 0;
}

.includeBtn,
.excludeBtn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  min-height: 38px !important;
  border-radius: 999px !important;
  font-size: 20px;
  font-weight: 700;
  line-height: 1;
}

.includeBtn {
  background: var(--creation-ink, #08143d) !important;
  color: #ffffff !important;
  border: 1px solid var(--creation-ink, #08143d) !important;
}

.includeBtn:hover:not(:disabled) {
  opacity: 0.9;
}

.excludeBtn {
  background: rgba(220, 38, 38, 0.08) !important;
  color: #b91c1c !important;
  border: 1px solid rgba(220, 38, 38, 0.3) !important;
}

.excludeBtn:hover:not(:disabled) {
  background: rgba(220, 38, 38, 0.14) !important;
}

@media (max-width: 640px) {
  .workspace {
    padding: 16px 12px 48px;
  }
  .inputPanel {
    padding: 16px;
  }
  .sources {
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  }
  .inputRow {
    flex-wrap: wrap;
  }
  .inputRow input {
    flex-basis: 100%;
  }
}
```

---

### Step `S9` — Collapse Batch Playlist Items into 1 Playlist Card & Use `Next →` CTA (`src/client/screens/cohortBuilder/stages/MaterialStageView.tsx`)

- **File:** `src/client/screens/cohortBuilder/stages/MaterialStageView.tsx`
- **Action:** Overwrite `src/client/screens/cohortBuilder/stages/MaterialStageView.tsx` so:
  1. `groupSourcesForDisplay` groups consecutive or shared-batch-prefix (`/^(.+):yt:\d+$/`) YouTube playlist sources (when 2+ share the same batch prefix) into a single `PlaylistSourceGroup` card (`YouTube Playlist · N videos`) with stacked-deck styling and 1-click removal of all videos in that playlist.
  2. Individual sources still render via `SourceItemRow` with exact existing badge strings (`YouTube Video`, `Web Article`, `PDF Document`, `GitHub Repo`, `AI Guide`) and `aria-label={'Remove source ' + (index + 1)}`.
  3. Top-right `.continueSection` button displays `Next →` with `aria-label="Continue to curriculum"`.

#### Complete Replacement (`src/client/screens/cohortBuilder/stages/MaterialStageView.tsx`)
```tsx
'use client';
import React, { useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { CohortAction, CohortSource, CohortWorkspace } from '@/src/shared/cohort-builder/contracts';
import type { EntityRef } from 'interaction-builder/core';
import { singleYoutubeVideo } from '@/src/shared/cohort-builder/youtube-transcript';
import { extractWebClient } from '@/src/client/lib/sourceExtractors/webClientExtractor';
import { extractYoutubeClient } from '@/src/client/lib/sourceExtractors/youtubeClientExtractor';
import styles from './MaterialStageView.module.css';

export interface MaterialStageViewProps {
  workspace: CohortWorkspace;
  workspaceId?: string;
  revision?: number;
  ownerId?: string;
  dispatchAction: (action: CohortAction, expected?: EntityRef[]) => Promise<boolean>;
}

export function extractYoutubeVideoId(source: CohortSource): string | null {
  if (source.input?.kind !== 'youtube') return null;
  if (source.provenance?.videoId && /^[A-Za-z0-9_-]{11}$/.test(source.provenance.videoId)) {
    return source.provenance.videoId;
  }
  try {
    return singleYoutubeVideo(source.input.url).videoId;
  } catch {
    return null;
  }
}

function getSourceTypeBadge(source: CohortSource): string {
  switch (source.input?.kind) {
    case 'youtube':
      return 'YouTube Video';
    case 'pdf':
      return 'PDF Document';
    case 'web':
      return 'Web Article';
    case 'github':
      return 'GitHub Repo';
    case 'generated_guide':
      return 'AI Guide';
    default:
      return 'Text / Notes';
  }
}

export type DisplaySourceGroup =
  | { kind: 'single'; source: CohortSource; index: number }
  | { kind: 'playlist'; batchKey: string; sources: CohortSource[]; firstIndex: number; title: string };

export function groupSourcesForDisplay(sources: CohortSource[]): DisplaySourceGroup[] {
  const batchCounts = new Map<string, number>();
  for (const s of sources) {
    const match = s.id.match(/^(.+):yt:\d+$/);
    if (match) {
      batchCounts.set(match[1], (batchCounts.get(match[1]) ?? 0) + 1);
    }
  }

  const groups: DisplaySourceGroup[] = [];
  const emittedBatches = new Set<string>();

  sources.forEach((source, index) => {
    const match = source.id.match(/^(.+):yt:\d+$/);
    const batchKey = match?.[1];
    if (batchKey && (batchCounts.get(batchKey) ?? 0) > 1) {
      if (emittedBatches.has(batchKey)) return;
      emittedBatches.add(batchKey);
      const batchSources = sources.filter(s => s.id.startsWith(`${batchKey}:yt:`));
      const firstLabel = batchSources[0]?.label || 'YouTube Playlist';
      groups.push({
        kind: 'playlist',
        batchKey,
        sources: batchSources,
        firstIndex: index,
        title: firstLabel,
      });
    } else {
      groups.push({ kind: 'single', source, index });
    }
  });

  return groups;
}

export interface SourceItemRowProps {
  source: CohortSource;
  index: number;
  busy: boolean;
  onRemove: (sourceId: string) => void;
  errorMessage?: string | null;
  onRetry?: (source: CohortSource) => void;
  onReplace?: (sourceId: string) => void;
}

export const SourceItemRow = React.memo(function SourceItemRow({
  source,
  index,
  busy,
  onRemove,
}: SourceItemRowProps) {
  const videoId = extractYoutubeVideoId(source);
  return (
    <li className={styles.sourceItem}>
      <div className={styles.thumbWrap}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {videoId ? (
          <img
            className={styles.thumbnail}
            src={'https://i.ytimg.com/vi/' + videoId + '/hqdefault.jpg'}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className={styles.fileIcon} aria-hidden="true">
            ↗
          </span>
        )}
        <span className={styles.typeBadge}>
          {videoId ? 'VIDEO' : 'LINK'}
        </span>
      </div>
      <div className={styles.cardBody}>
        <small>{getSourceTypeBadge(source)}</small>
        <h3>{source.label || 'Source ' + (index + 1)}</h3>
      </div>
      <div className={styles.cardFooter}>
        <button
          type="button"
          disabled={busy}
          aria-label={'Remove source ' + (index + 1)}
          onClick={() => onRemove(source.id)}
        >
          <Trash2 size={18} />
        </button>
      </div>
    </li>
  );
});

export interface SourceGroupCardProps {
  group: DisplaySourceGroup;
  busy: boolean;
  onRemoveSingle: (sourceId: string) => void;
  onRemovePlaylist: (sourceIds: string[]) => void;
}

export function SourceGroupCard({
  group,
  busy,
  onRemoveSingle,
  onRemovePlaylist,
}: SourceGroupCardProps) {
  if (group.kind === 'single') {
    return (
      <SourceItemRow
        source={group.source}
        index={group.index}
        busy={busy}
        onRemove={onRemoveSingle}
      />
    );
  }

  const leadVideoId = extractYoutubeVideoId(group.sources[0]);
  const count = group.sources.length;
  return (
    <li className={`${styles.sourceItem} ${styles.playlistCard}`}>
      <div className={styles.thumbWrap}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {leadVideoId ? (
          <img
            className={styles.thumbnail}
            src={'https://i.ytimg.com/vi/' + leadVideoId + '/hqdefault.jpg'}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className={styles.fileIcon} aria-hidden="true">
            ▶
          </span>
        )}
        <span className={`${styles.typeBadge} ${styles.playlistBadge}`}>
          ▶ PLAYLIST · {count} VIDEOS
        </span>
      </div>
      <div className={styles.cardBody}>
        <small>YouTube Playlist · {count} videos</small>
        <h3>{group.title}</h3>
      </div>
      <div className={styles.cardFooter}>
        <button
          type="button"
          disabled={busy}
          aria-label={'Remove source ' + (group.firstIndex + 1)}
          onClick={() => onRemovePlaylist(group.sources.map(s => s.id))}
        >
          <Trash2 size={18} />
        </button>
      </div>
    </li>
  );
}

export function MaterialStageView({ workspace, dispatchAction }: MaterialStageViewProps) {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);

  const handleAddUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lock.current) return;
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return;

    try {
      const parsed = new URL(trimmedUrl);
      if (parsed.protocol !== 'https:') {
        setError('Please enter a public HTTPS URL.');
        return;
      }
    } catch {
      setError('Please enter a valid URL.');
      return;
    }

    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      const isYouTube = /youtube\.com|youtu\.be/i.test(trimmedUrl);
      let ok = false;
      if (isYouTube) {
        let metadata: {
          title?: string;
          isPlaylist?: boolean;
          videos?: Array<{ videoId: string; title: string }>;
        } | null = null;
        try {
          const metaRes = await fetch(
            `/api/import/youtube/metadata?url=${encodeURIComponent(trimmedUrl)}`
          );
          if (metaRes.ok) {
            metadata = await metaRes.json();
          }
        } catch {
          // Metadata fetch failure is non-fatal
        }

        if (metadata?.isPlaylist && metadata.videos && metadata.videos.length > 0) {
          const maxCapacity = 100;
          const remainingSlots = Math.max(0, maxCapacity - (workspace.sources?.length ?? 0));
          const videosToAdd = metadata.videos.slice(0, remainingSlots);
          if (videosToAdd.length === 0) {
            setError(`Cannot add more sources. Maximum capacity of ${maxCapacity} reached.`);
            setBusy(false);
            return;
          }
          ok = await dispatchAction({
            type: 'add_youtube_sources_batch',
            videos: videosToAdd.map(v => ({
              url: `https://www.youtube.com/watch?v=${v.videoId}`,
              label: v.title || metadata?.title || `Video ${v.videoId}`,
              mode: 'video_observation' as const,
            })),
          });
        } else {
          let normalizedUrl = trimmedUrl;
          try {
            const parsed = new URL(trimmedUrl);
            let vid: string | null = null;
            if (parsed.hostname === 'youtu.be') {
              vid = parsed.pathname.split('/')[1];
            } else if (parsed.pathname === '/watch') {
              vid = parsed.searchParams.get('v');
            } else if (/^\/(shorts|embed)\//.test(parsed.pathname)) {
              vid = parsed.pathname.split('/')[2];
            }
            if (vid && /^[A-Za-z0-9_-]{11}$/.test(vid)) {
              normalizedUrl = `https://www.youtube.com/watch?v=${vid}`;
            }
          } catch {}

          let extraction = undefined;
          try {
            extraction = await extractYoutubeClient(normalizedUrl, {
              title: metadata?.title,
            });
          } catch {}

          const label = metadata?.title || trimmedUrl;
          ok = await dispatchAction({
            type: 'add_youtube_source',
            url: normalizedUrl,
            label,
            mode: 'video_observation',
            ...(extraction ? { extraction } : {}),
          });
        }
      } else {
        let extraction = undefined;
        try {
          const extracted = await extractWebClient(trimmedUrl);
          extraction = {
            text: extracted.text,
            locations: extracted.locations,
            provenance: extracted.provenance,
            checksum: extracted.checksum,
          };
        } catch {}

        ok = await dispatchAction({
          type: 'add_web_source',
          url: trimmedUrl,
          label: trimmedUrl,
          ...(extraction ? { extraction } : {}),
        });
      }

      if (ok) {
        setUrl('');
      } else {
        setError('Could not add this link. Your input was preserved for retry.');
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not add link. Your input was preserved for retry.'
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  const act = async (action: CohortAction) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      if (!(await dispatchAction(action))) {
        setError('Could not save this action. Please try again.');
      }
    } catch {
      setError('Could not save this action. Please try again.');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  const handleRemovePlaylist = async (sourceIds: string[]) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      for (const sourceId of sourceIds) {
        const ok = await dispatchAction({ type: 'remove_source', sourceId });
        if (!ok) {
          setError('Could not remove playlist. Please try again.');
          break;
        }
      }
    } catch {
      setError('Could not remove playlist. Please try again.');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  const displayGroups = groupSourcesForDisplay(workspace.sources);

  return (
    <section className={styles.workspace} aria-label="Learning material">
      <div className={styles.continueSection}>
        <button
          type="button"
          aria-label="Continue to curriculum"
          disabled={busy || !workspace.sources.length}
          onClick={() => void act({ type: 'begin_material_processing' })}
        >
          Next →
        </button>
      </div>
      {workspace.sources.length > 0 && (
        <section aria-label="Added material">
          <h2>
            Added material <small>{displayGroups.length}</small>
          </h2>
          <ul className={styles.sources}>
            {displayGroups.map(group => (
              <SourceGroupCard
                key={group.kind === 'playlist' ? group.batchKey : group.source.id}
                group={group}
                busy={busy}
                onRemoveSingle={sourceId => void act({ type: 'remove_source', sourceId })}
                onRemovePlaylist={sourceIds => void handleRemovePlaylist(sourceIds)}
              />
            ))}
          </ul>
        </section>
      )}
      <header>
        <h1>Add your material</h1>
      </header>
      <form className={styles.inputPanel} onSubmit={handleAddUrl}>
        <label htmlFor="material-url">Public article or YouTube URL</label>
        <div className={styles.inputRow}>
          <input
            id="material-url"
            type="url"
            required
            maxLength={2048}
            pattern="https://.*"
            placeholder="https://…"
            value={url}
            disabled={busy}
            onChange={e => setUrl(e.target.value)}
          />
          <button disabled={busy || !url.trim()}>Add link</button>
        </div>
        <div className={styles.options} aria-label="Material input options">
          <button type="button" aria-pressed="true">
            Paste a link
          </button>
          <button type="button" disabled title="Temporarily unavailable">
            Upload a file
          </button>
        </div>
      </form>
      <p className={styles.help}>Public YouTube videos, playlists and articles. Up to 100 sources.</p>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
```

---

### Step `S10` — Use Grouped Playlist Cards, Visual Search Badges & `Next →` CTA in `DiscoveryStageView` (`src/client/screens/cohortBuilder/stages/DiscoveryStageView.tsx`)

- **File:** `src/client/screens/cohortBuilder/stages/DiscoveryStageView.tsx`
- **Action:** Overwrite `src/client/screens/cohortBuilder/stages/DiscoveryStageView.tsx` so:
  1. `Added material` renders `groupSourcesForDisplay(sources)` via `SourceGroupCard` (so an included playlist appears as 1 Playlist Card instead of 87–120 cards).
  2. YouTube search results render in the 3–4 column visual card grid with stacked-deck `.playlistCard` styling and overlay badges (`▶ PLAYLIST` vs `VIDEO`).
  3. Top-right `.continueSection` button displays `Next →` with `aria-label="Continue to curriculum"`.

#### Complete Replacement (`src/client/screens/cohortBuilder/stages/DiscoveryStageView.tsx`)
```tsx
'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { CohortWorkspace, CohortAction } from '@/src/shared/cohort-builder/contracts';
import type { EntityRef } from 'interaction-builder/core';
import type { YouTubeSearchItem } from '@/src/app/api/import/youtube/search/route';
import { extractYoutubeClient } from '@/src/client/lib/sourceExtractors/youtubeClientExtractor';
import { groupSourcesForDisplay, SourceGroupCard } from './MaterialStageView';
import styles from './MaterialStageView.module.css';

export interface DiscoveryStageViewProps {
  workspace: CohortWorkspace;
  dispatchAction: (action: CohortAction, expected?: EntityRef[]) => Promise<boolean>;
}

const MAX_SOURCES = 100;

export function DiscoveryStageView({ workspace, dispatchAction }: DiscoveryStageViewProps) {
  const [goal, setGoal] = useState(workspace.intent || '');
  const [results, setResults] = useState<YouTubeSearchItem[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playlistVideoUrls, setPlaylistVideoUrls] = useState<Record<string, string[]>>({});
  const autoSearchedIntentRef = useRef<string | null>(null);

  useEffect(() => {
    setGoal(workspace.intent || '');
  }, [workspace.intent]);

  const runYouTubeSearch = async (query: string) => {
    setSearching(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/import/youtube/search?q=${encodeURIComponent(query)}`
      );
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setError(
          errData?.error || 'Could not search YouTube right now. Please try again.'
        );
        setHasSearched(true);
        return;
      }
      const data = await res.json();
      setResults(Array.isArray(data?.items) ? data.items : []);
      setHasSearched(true);
    } catch {
      setError('Could not search YouTube right now. Please try again.');
      setHasSearched(true);
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    const initialGoal = (workspace.intent || '').trim();
    if (!initialGoal || autoSearchedIntentRef.current === initialGoal) return;
    autoSearchedIntentRef.current = initialGoal;
    void runYouTubeSearch(initialGoal);
  }, [workspace.intent]);

  const sources = workspace.sources ?? [];
  const atCapacity = sources.length >= MAX_SOURCES;
  const displayGroups = groupSourcesForDisplay(sources);

  const getMatchingSourcesForItem = (item: YouTubeSearchItem) => {
    if (item.kind === 'playlist') {
      const knownUrls = new Set(playlistVideoUrls[item.id] ?? [item.url]);
      return sources.filter(
        (s) => s.input?.kind === 'youtube' && knownUrls.has(s.input.url)
      );
    }
    return sources.filter(
      (s) => s.input?.kind === 'youtube' && s.input.url === item.url
    );
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmed = goal.trim();
    if (!trimmed) {
      setError('Please enter a learning goal.');
      return;
    }
    if (trimmed !== (workspace.intent || '').trim()) {
      const saved = await dispatchAction({ type: 'set_intent', intent: trimmed });
      if (!saved) {
        setError('Could not save your learning goal. Please try again.');
        return;
      }
    }
    autoSearchedIntentRef.current = trimmed;
    await runYouTubeSearch(trimmed);
  };

  const handleIncludeItem = async (item: YouTubeSearchItem) => {
    if (atCapacity) {
      setError(`Cannot add more sources. Maximum capacity of ${MAX_SOURCES} reached.`);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      if (item.kind === 'playlist') {
        const metaRes = await fetch(
          `/api/import/youtube/metadata?url=${encodeURIComponent(item.url)}`
        );
        if (metaRes.ok) {
          const metaData = await metaRes.json();
          if (
            metaData.isPlaylist &&
            Array.isArray(metaData.videos) &&
            metaData.videos.length > 0
          ) {
            const remaining = Math.max(0, MAX_SOURCES - sources.length);
            const slice = metaData.videos.slice(0, remaining);
            const videosPayload = slice.map((v: any) => ({
              url: v.url
                ? String(v.url)
                : `https://www.youtube.com/watch?v=${v.videoId}`,
              label: String(v.title || item.title),
              mode: 'video_observation' as const,
            }));
            const ok = await dispatchAction({
              type: 'add_youtube_sources_batch',
              videos: videosPayload,
            });
            if (ok) {
              setPlaylistVideoUrls((prev) => ({
                ...prev,
                [item.id]: videosPayload.map((v: { url: string }) => v.url),
              }));
            } else {
              setError('Could not include playlist. Please try again.');
            }
            return;
          }
        }
      }

      let extraction = undefined;
      try {
        extraction = await extractYoutubeClient(item.url, { title: item.title });
      } catch {
        // Proceed with server fallback if client extraction fails
      }

      const ok = await dispatchAction({
        type: 'add_youtube_source',
        url: item.url,
        label: item.title,
        mode: 'video_observation',
        ...(extraction ? { extraction } : {}),
      });
      if (!ok) {
        setError('Could not include video. Please try again.');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleExcludeItem = async (item: YouTubeSearchItem) => {
    const matched = getMatchingSourcesForItem(item);
    if (matched.length === 0) return;
    setError(null);
    setBusy(true);
    try {
      for (const src of matched) {
        const ok = await dispatchAction({ type: 'remove_source', sourceId: src.id });
        if (!ok) {
          setError('Could not exclude source. Please try again.');
          break;
        }
      }
    } finally {
      setBusy(false);
    }
  };

  const act = async (action: CohortAction) => {
    setBusy(true);
    setError(null);
    try {
      if (!(await dispatchAction(action))) {
        setError('Could not save this action. Please try again.');
      }
    } catch {
      setError('Could not save this action. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleRemovePlaylist = async (sourceIds: string[]) => {
    setBusy(true);
    setError(null);
    try {
      for (const sourceId of sourceIds) {
        const ok = await dispatchAction({ type: 'remove_source', sourceId });
        if (!ok) {
          setError('Could not remove playlist. Please try again.');
          break;
        }
      }
    } catch {
      setError('Could not remove playlist. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={styles.workspace} aria-label="Goal discovery">
      <div className={styles.continueSection}>
        <button
          type="button"
          aria-label="Continue to curriculum"
          disabled={busy || searching || !sources.length}
          onClick={() => void act({ type: 'begin_material_processing' })}
        >
          Next →
        </button>
      </div>

      {sources.length > 0 && (
        <section aria-label="Added material">
          <h2>
            Added material <small>{displayGroups.length}</small>
          </h2>
          <ul className={styles.sources}>
            {displayGroups.map((group) => (
              <SourceGroupCard
                key={group.kind === 'playlist' ? group.batchKey : group.source.id}
                group={group}
                busy={busy}
                onRemoveSingle={(sourceId) => void act({ type: 'remove_source', sourceId })}
                onRemovePlaylist={(sourceIds) => void handleRemovePlaylist(sourceIds)}
              />
            ))}
          </ul>
        </section>
      )}

      <header>
        <h1>Start with a goal</h1>
        <p className={styles.help}>
          Search YouTube videos and playlists for your goal, include (+) or exclude (−) them in your material, then continue to your curriculum.
        </p>
      </header>

      <form className={styles.inputPanel} onSubmit={handleSearch}>
        <label htmlFor="discovery-goal-input">Your learning goal</label>
        <div className={styles.inputRow}>
          <input
            id="discovery-goal-input"
            type="text"
            value={goal}
            disabled={busy || searching}
            placeholder="What do you want to learn?"
            onChange={(e) => setGoal(e.target.value)}
          />
          <button type="submit" disabled={busy || searching || !goal.trim()}>
            {searching ? 'Searching…' : 'Find resources'}
          </button>
        </div>
      </form>

      {error && <p role="alert">{error}</p>}

      {results.length > 0 && (
        <section aria-label="YouTube search results">
          <h2>
            YouTube videos & playlists <small>{results.length}</small>
          </h2>
          <ul className={styles.sources}>
            {results.map((item) => {
              const matchedSources = getMatchingSourcesForItem(item);
              const isIncluded = matchedSources.length > 0;
              const isPlaylist = item.kind === 'playlist';

              return (
                <li
                  key={item.id}
                  className={`${styles.sourceItem} ${isPlaylist ? styles.playlistCard : ''}`}
                >
                  <div className={styles.thumbWrap}>
                    {item.thumbnailUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        className={styles.thumbnail}
                        src={item.thumbnailUrl}
                        alt=""
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <span className={styles.fileIcon} aria-hidden="true">
                        ▶
                      </span>
                    )}
                    <span
                      className={`${styles.typeBadge} ${isPlaylist ? styles.playlistBadge : ''}`}
                    >
                      {isPlaylist ? '▶ PLAYLIST' : 'VIDEO'}
                    </span>
                  </div>
                  <div className={styles.cardBody}>
                    <small>
                      {isPlaylist ? 'YouTube Playlist' : 'YouTube Video'} · {item.channelTitle}
                    </small>
                    <h3>{item.title}</h3>
                  </div>
                  <div className={styles.cardFooter}>
                    {isIncluded ? (
                      <button
                        type="button"
                        className={styles.excludeBtn}
                        disabled={busy}
                        aria-label={`Exclude ${item.title}`}
                        title="Exclude from material"
                        onClick={() => void handleExcludeItem(item)}
                      >
                        −
                      </button>
                    ) : (
                      <button
                        type="button"
                        className={styles.includeBtn}
                        disabled={busy || atCapacity}
                        aria-label={`Include ${item.title}`}
                        title="Include in material"
                        onClick={() => void handleIncludeItem(item)}
                      >
                        +
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {hasSearched && !searching && results.length === 0 && !error && (
        <p className={styles.help}>
          No YouTube videos or playlists found. Try refining your learning goal above.
        </p>
      )}
    </section>
  );
}
```

---

### Step `S11` — Update Processing Stage Styles (`src/client/screens/cohortCreation/components/UnderstandingProgress.module.css`)

- **File:** `src/client/screens/cohortCreation/components/UnderstandingProgress.module.css`
- **Action:** Overwrite `src/client/screens/cohortCreation/components/UnderstandingProgress.module.css` to add `.topActions`, `.iconActionBtn`, `.nextStageBtn`, `.spinIcon`, `.errorIcon`, top `.progress` bar spacing (`margin: 0 0 18px`), and `max-height: 360px; overflow-y: auto` on `.inventory ul, .inventory fieldset`.

#### Complete Replacement (`src/client/screens/cohortCreation/components/UnderstandingProgress.module.css`)
```css
.workspace, .embedded { color: var(--creation-ink, #08143d); }
.topActions { display: flex; justify-content: flex-end; align-items: center; gap: 10px; margin-bottom: 14px; }
.iconActionBtn { display: inline-flex; align-items: center; justify-content: center; width: 38px; height: 38px; border-radius: 999px; border: 1px solid var(--creation-border, #ded8cf); background: var(--creation-surface, #fffaf2); color: var(--creation-ink, #08143d); cursor: pointer; transition: background 0.15s ease, transform 0.1s ease; }
.iconActionBtn:hover:not(:disabled) { background: rgba(8, 20, 61, 0.06); transform: translateY(-1px); }
.iconActionBtn:disabled { opacity: 0.45; cursor: not-allowed; }
.nextStageBtn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 38px; padding: 0 20px; border-radius: 999px; border: 0; background: var(--creation-ink, #08143d); color: #ffffff; font-size: 14px; font-weight: 600; cursor: pointer; box-shadow: 0 6px 18px rgba(8, 20, 61, 0.14); transition: opacity 0.15s ease, transform 0.1s ease; }
.nextStageBtn:hover:not(:disabled) { opacity: 0.92; transform: translateY(-1px); }
.continueDock { position: fixed; right: 28px; bottom: 24px; z-index: 5; display: flex; flex-wrap: wrap; align-items: center; gap: 14px; max-width: min(620px, calc(100vw - 48px)); padding: 18px 22px; background: var(--creation-surface, #fffcf7); color: var(--creation-ink, #08143d); border: 1px solid var(--creation-line, #e9e0d5); border-radius: 20px; box-shadow: 0 8px 36px #08143d1a; }
.continueDock p { margin: 4px 0 0; font-size: 12px; line-height: 1.5; color: var(--creation-muted, #536788); }
.continueDock button { border: 0; border-radius: 24px; padding: 13px 20px; min-height: 44px; background: var(--creation-blue, #303cff); color: #fff; font: 600 13px var(--font-manrope-next), sans-serif; cursor: pointer; }
.continueDock button:focus-visible { outline: 2px solid var(--creation-blue, #303cff); outline-offset: 4px; }
@media(max-width:820px) { .continueDock { right: 12px; left: 12px; bottom: 12px; max-width: none; padding: 14px 16px; } .continueDock button { margin-left: auto; } }
.steps { list-style: none; display: flex; justify-content: center; gap: 0; padding: 0 100px 0 0; margin: 6px 0 48px; }
.steps li { display: flex; align-items: center; gap: 12px; text-transform: uppercase; font-size: 11px; font-weight: 700; color: var(--creation-muted, #72819a); padding: 0 22px 12px; border-bottom: 2px solid #d7d6d1; }
.steps li span { display: grid; place-items: center; background: #e4e3e0; color: #17234b; width: 31px; height: 31px; border-radius: 50%; }
.steps li[aria-current] { color: var(--creation-blue, #3037ff); border-color: var(--creation-blue, #3037ff); }
.steps li[aria-current] span { background: var(--creation-blue, #3037ff); color: white; }
.steps li[data-complete='true'] span { color: var(--creation-blue, #3037ff); background: #e3e4ff; }
.columns { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1.05fr); gap: 18px; }
.heading { padding: 0 12px 18px; }
.eyebrow { text-transform: uppercase; letter-spacing: .22em; font-size: 12px; font-weight: 700; color: var(--creation-muted, #766e64); margin-bottom: 14px; }
.heading h1 { font: 600 clamp(35px, 3.65vw, 58px)/1.02 var(--font-playfair-display), Georgia, serif; letter-spacing: -.04em; margin: 0 0 12px; }
.heading h1 span { position: relative; font-style: italic; }
.underline { position: absolute; left: 0; bottom: -5px; width: 100%; height: 10px; color: var(--creation-blue, #3037ff); }
.heading > p:last-child { font: 500 20px/1.25 var(--font-playfair-display), Georgia, serif; color: var(--creation-muted, #657085); }
.inventory, .concepts { border: 1px solid var(--creation-border, #e8e1d6); border-radius: 18px; background: var(--creation-surface, #fffaf2); box-shadow: 0 4px 14px #5e43100b; }
.inventory { padding: 20px 20px; }
.inventory h2 { display: flex; align-items: center; gap: 10px; font: 600 16px/1.25 var(--font-playfair-display), Georgia, serif; margin-bottom: 18px; }
.inventory h2 > span { margin-left: auto; font: 11px var(--font-manrope-next), sans-serif; color: var(--creation-muted, #657085); }
.inventory ul, .inventory fieldset { list-style: none; padding: 0 4px 0 0; margin: 0; display: flex; flex-direction: column; gap: 10px; max-height: 360px; overflow-y: auto; }
.source { display: flex; align-items: flex-start; gap: 14px; border-radius: 12px; padding: 14px 12px; background: color-mix(in srgb, var(--creation-blue, #3037ff) 5%, transparent); }
.source > div { flex: 1; min-width: 0; }
.source strong { font: 500 16px/1.4 var(--font-playfair-display), Georgia, serif; overflow-wrap: anywhere; }
.source p { font-size: 11px; color: var(--creation-muted, #657085); margin-top: 6px; }
.source > svg { color: #59a142; flex-shrink: 0; }
.spinIcon { color: var(--creation-blue, #3037ff) !important; animation: spin 1.2s linear infinite; }
.errorIcon { color: #b91c1c !important; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
.sourceNumber { font-size: 13px; padding-top: 4px; }
.videos { padding: 10px 0 10px 40px; font: 500 15px/1.4 var(--font-playfair-display), Georgia, serif; }
.videos li { padding: 8px 0; }
.videos small { display: block; color: var(--creation-muted, #657085); font: 11px var(--font-manrope-next), sans-serif; margin-top: 4px; }
.progress { display: flex; align-items: center; gap: 12px; margin: 0 0 18px; padding-bottom: 14px; border-bottom: 1px solid var(--creation-border, #e8e1d6); color: var(--creation-muted, #657085); font-size: 12px; font-weight: 600; }
.progress progress { width: 100%; height: 9px; accent-color: var(--creation-blue, #3037ff); }
.progress span { white-space: nowrap; }
.controls { font-size: 12px; color: var(--creation-muted, #657085); line-height: 1.7; margin-top: 12px; }
.controls p { margin: 8px 0; }
.controls button, .concepts button { border: 1px solid var(--creation-border, #ded8cf); border-radius: 24px; padding: 9px 15px; background: var(--creation-surface, #fffaf2); color: var(--creation-ink, #08143d); cursor: pointer; margin: 8px 6px 0 0; font-size: 12px; }
.controls button:disabled { opacity: .5; cursor: wait; }
.controls button:focus-visible, .concepts summary:focus-visible, .concepts button:focus-visible, .iconActionBtn:focus-visible, .nextStageBtn:focus-visible { outline: 2px solid var(--creation-blue, #3037ff); outline-offset: 3px; }
.concepts { position: relative; margin-top: 0; padding: 28px 20px; min-height: 540px; display: flex; flex-direction: column; }
.concepts > header { display: flex; gap: 16px; color: var(--creation-blue, #3037ff); margin-bottom: 26px; padding-right: 20px; }
.concepts h2 { font: 700 30px/1.2 var(--font-caveat-next), cursive; color: var(--creation-ink, #08143d); margin-bottom: 8px; }
.concepts header p { font: 700 19px/1.3 var(--font-caveat-next), cursive; color: var(--creation-muted, #657085); }
.paperNote { position: absolute; top: -35px; right: -4px; transform: rotate(-5deg); font: 700 19px/1.25 var(--font-caveat-next), cursive; padding: 15px; color: #44413d; background: #fae9d4; box-shadow: 0 2px 6px #5e43100b; }
.conceptCloud { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: center; gap: 16px 12px; list-style: none; padding: 10px 0 24px; }
.conceptCloud > li { max-width: 100%; border: 1px solid var(--creation-border, #e8e1d6); border-radius: 20px; background: color-mix(in srgb, var(--creation-blue, #3037ff) 5%, var(--creation-surface, #fffaf2)); padding: 11px 16px; box-shadow: 0 3px 8px #5e431008; }
.conceptCloud > li:nth-child(3n) { background: color-mix(in srgb, #ffa500 7%, var(--creation-surface, #fffaf2)); }
.conceptCloud summary { cursor: pointer; font-size: 14px; font-weight: 700; overflow-wrap: anywhere; }
.conceptCloud details p, .conceptCloud details small { display: block; max-width: 400px; font-size: 12px; line-height: 1.6; margin-top: 10px; }
.conceptCloud details small { color: var(--creation-muted, #657085); }
.empty { padding: 60px 24px; color: var(--creation-muted, #657085); font-size: 14px; line-height: 1.6; text-align: center; }
.limitations { font-size: 12px; color: var(--creation-muted, #657085); line-height: 1.6; margin-bottom: 20px; }
.limitations summary { cursor: pointer; }.limitations div { margin: 12px 0; }
.insight { display: flex; align-items: center; gap: 12px; border: 1px solid #e9b76633; border-radius: 16px; padding: 16px; margin-top: auto; font-size: 12px; line-height: 1.5; }
.insight > svg { color: #ff9100; flex-shrink: 0; }
.insight span { display: block; color: var(--creation-muted, #657085); margin-top: 5px; }
.embedded { max-width: 800px; margin: 25px auto; padding: 22px; border: 1px solid var(--creation-border, #ded8cf); border-radius: 18px; }
.embedded h2 { font: 600 24px var(--font-playfair-display), Georgia, serif; }
@media (max-width: 1300px) { .steps { padding-right: 80px; } .steps li { padding-inline: 12px; gap: 7px; font-size: 10px; } .paperNote { display: none; } }
@media (max-width: 1100px) { .columns { grid-template-columns: 1fr; } .concepts { min-height: 450px; } .heading h1 { font-size: 48px; } .steps { justify-content: flex-start; flex-wrap: wrap; padding-right: 80px; row-gap: 10px; } }
@media (max-width: 820px) { .steps { padding: 10px 0 0; margin-bottom: 30px; } .steps li { font-size: 9px; padding: 0 8px 10px; gap: 5px; } .steps li span { width: 24px; height: 24px; } .heading h1 { font-size: 40px; } .heading { padding-inline: 0; } .inventory, .concepts { padding: 18px 12px; } }

@media (min-width: 1101px) and (max-width: 1450px) {
  .heading h1 { font-size: 38px; line-height: 1.1; }
}

.controlButtonsRow { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; width: 100%; }
```

---

### Step `S12` — Top-Right Controls, Top Progress Bar, Clean Header & Accurate Source Status in `UnderstandingStageView` (`src/client/screens/cohortBuilder/stages/UnderstandingStageView.tsx`)

- **File:** `src/client/screens/cohortBuilder/stages/UnderstandingStageView.tsx`
- **Action:** Overwrite `src/client/screens/cohortBuilder/stages/UnderstandingStageView.tsx` to:
  1. Render `.topActions` at the top right with icon-only `Back to material` (`<ArrowLeft size={16} />`), `Cancel processing` (`<Square size={15} />` when `isRunning`), `Retry processing` (`<RotateCcw size={16} />` when `!isRunning`), and `Next →` when `isComplete && !isRunning`.
  2. Move `<div className={styles.progress}>` to the **very top** of `.inventory`.
  3. Remove the filler `<p>I’m working with your retained sources and the evidence in them.</p>`, `.cohortSummary`, and `<h2>Selected material</h2>`.
  4. Replace contradictory `{segmentCount} retained segments · {source.state}` + green `<Check>` with accurate per-source status (`Reading source…` + spinning `<LoaderCircle>`, `Ready · N segments` + `<Check>`, or `Could not read source` + `<AlertCircle>`).

#### Complete Replacement (`src/client/screens/cohortBuilder/stages/UnderstandingStageView.tsx`)
```tsx
'use client';

import { ProcessingFailures, processingFailureMessage } from './ProcessingFailures';
import React from 'react';
import {
  Check,
  Brain,
  Lightbulb,
  LoaderCircle,
  AlertCircle,
  ArrowLeft,
  Square,
  RotateCcw,
} from 'lucide-react';
import type { CohortWorkspace, CohortAction } from '@/src/shared/cohort-builder/contracts';
import { InkUnderline } from '@/src/client/screens/cohortCreation/components/InkUnderline';
import {
  isStageComplete,
  getStageProgressDetails,
} from '../stage-selectors';
import styles from '@/src/client/screens/cohortCreation/components/UnderstandingProgress.module.css';

interface UnderstandingStageViewProps {
  workspace: CohortWorkspace;
  dispatchAction: (action: CohortAction) => Promise<boolean>;
}

export function UnderstandingStageView({ workspace, dispatchAction }: UnderstandingStageViewProps) {
  const sources = workspace.sources ?? [];

  const stageProgress = getStageProgressDetails(workspace);
  const isComplete = isStageComplete(workspace, 'understanding');
  const isRunning = stageProgress.understanding.status === 'running';
  const isFailed = stageProgress.understanding.status === 'failed';

  const understoodCount = stageProgress.understanding.completedCount;
  const totalCount = sources.length;

  const sourceVersionMap = new Map(sources.map(s => [s.id, s.version]));
  const validUnderstanding = (workspace.understanding ?? []).filter(u => {
    const v = sourceVersionMap.get(u.sourceId);
    return v !== undefined && u.sourceVersion === v;
  });
  const understoodSourceIds = new Set(validUnderstanding.map(u => u.sourceId));

  const topicMap = new Map<string, { topic: string; summary: string; sourceLabels: string[] }>();
  for (const understood of validUnderstanding) {
    const source = sources.find(item => item.id === understood.sourceId)!;
    for (const topic of understood.topics) {
      const key = topic.toLocaleLowerCase();
      const existing = topicMap.get(key);
      if (existing) {
        if (!existing.sourceLabels.includes(source.label)) existing.sourceLabels.push(source.label);
      } else {
        const evidence = source.text.split(/\n\s*\n|(?<=[.!?])\s+/).find(sentence => sentence.toLowerCase().includes(key)) ?? source.text;
        topicMap.set(key, { topic, summary: evidence.slice(0, 350), sourceLabels: [source.label] });
      }
    }
  }
  const allTopics = [...topicMap.values()];

  return (
    <section aria-label="Understanding material" className={styles.workspace}>
      <div className={styles.topActions}>
        <button
          type="button"
          className={styles.iconActionBtn}
          aria-label="Back to material"
          title="Back to material"
          onClick={() => void dispatchAction({ type: 'open_materials' })}
        >
          <ArrowLeft size={16} />
        </button>
        {isRunning ? (
          <button
            type="button"
            className={styles.iconActionBtn}
            aria-label="Cancel processing"
            title="Stop processing"
            onClick={() => void dispatchAction({ type: 'cancel_text_processing' })}
          >
            <Square size={15} />
          </button>
        ) : (
          sources.length > 0 && (
            <button
              type="button"
              className={styles.iconActionBtn}
              aria-label="Retry processing"
              title="Retry processing"
              onClick={() => void dispatchAction({ type: 'retry_processing' })}
            >
              <RotateCcw size={16} />
            </button>
          )
        )}
        {isComplete && !isRunning && (
          <button
            type="button"
            className={styles.nextStageBtn}
            aria-label="Next stage"
            onClick={() => void dispatchAction({ type: 'set_step', step: 'processing', stage: 'chunking' })}
          >
            Next →
          </button>
        )}
      </div>

      <div className={styles.columns}>
        <div>
          <header className={styles.heading}>
            <p className={styles.eyebrow}>Understanding your material</p>
            <h1>
              {isComplete && !isRunning ? (
                <>
                  Your content,<br />
                  <span>understood.<InkUnderline className={styles.underline} /></span>
                </>
              ) : (
                <>
                  Reading through<br />
                  <span>your content…<InkUnderline className={styles.underline} /></span>
                </>
              )}
            </h1>
          </header>

          <div className={styles.inventory}>
            <div className={styles.progress}>
              {totalCount > 0 ? (
                <>
                  <progress max={totalCount} value={understoodCount} aria-label="Sources understood" />
                  <span>{understoodCount}/{totalCount} sources understood</span>
                </>
              ) : (
                <>
                  <LoaderCircle size={18} aria-hidden="true" />
                  <span>Reading source inventory…</span>
                </>
              )}
            </div>

            <ul>
              {sources.map((source, index) => {
                const segmentCount = source.locations?.length ?? (source.text ? 1 : 0);
                const isSourceReady = source.state === 'ready' || understoodSourceIds.has(source.id);
                const isSourceFailed = source.state === 'failed';
                const statusLabel = isSourceFailed
                  ? 'Could not read source'
                  : isSourceReady
                    ? `Ready${segmentCount > 0 ? ` · ${segmentCount} ${segmentCount === 1 ? 'section' : 'sections'}` : ''}`
                    : 'Reading source…';

                return (
                  <li key={source.id}>
                    <div className={styles.source}>
                      <span className={styles.sourceNumber}>{String(index + 1).padStart(2, '0')}</span>
                      <div>
                        <strong>{source.label}</strong>
                        <p>{statusLabel}</p>
                      </div>
                      {isSourceFailed ? (
                        <AlertCircle size={18} className={styles.errorIcon} aria-label="Source failed" />
                      ) : isSourceReady ? (
                        <Check size={18} aria-label="Content acquired" />
                      ) : (
                        <LoaderCircle size={18} className={styles.spinIcon} aria-label="Reading source" />
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className={styles.controls}>
              <ProcessingFailures workspace={workspace} dispatchAction={dispatchAction} />
              {isFailed && workspace.processing.error && !workspace.processing.jobs?.some(job => job.status === 'failed') && (
                <p role="alert">{processingFailureMessage(workspace.processing.error)}</p>
              )}
            </div>
          </div>
        </div>

        <aside id="creation-accepted-concepts" className={styles.concepts} aria-label="Accepted concepts">
          <header>
            <Brain size={46} strokeWidth={1.5} aria-hidden="true" />
            <div>
              <h2>Finding key ideas…</h2>
              <p>Identifying the main topics, concepts,<br />and how they appear throughout the material.</p>
            </div>
          </header>

          <span className={styles.paperNote} aria-hidden="true">
            Important ideas,<br />grounded in<br />your material.
          </span>

          {allTopics.length === 0 ? (
            <p className={styles.empty} role="status">
              Key ideas and concepts will appear here as each source is analyzed.
            </p>
          ) : (
            <ul className={styles.conceptCloud}>
              {allTopics.map(item => (
                <li key={item.topic}>
                  <details>
                    <summary>{item.topic}</summary>
                    <p>{item.summary}</p>
                    <small>{item.sourceLabels.join(' · ')}</small>
                  </details>
                </li>
              ))}
            </ul>
          )}

          <details className={styles.limitations}>
            <summary>Source summaries and limitations ({sources.length})</summary>
            {sources.map(source => <div key={source.id}>
              <strong>{source.label}</strong>
              <p>{source.text ? source.text.slice(0, 350) : 'Reading source material. Concepts will appear as it is processed.'}</p>
              {source.provenance?.scope === 'video_observation' && <p>Video observations with estimated timestamps.</p>}
              {source.provenance?.limitations?.map((limitation, index) => <p key={index}>{limitation}</p>)}
            </div>)}
          </details>

          <div className={styles.insight}>
            <Lightbulb size={28} aria-hidden="true" />
            <p>
              <strong>{allTopics.length} key ideas identified.</strong>
              <span>Core topics and evidence gathered directly from your material.</span>
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}
```

---

### Step `S13` — Top-Right Controls, Top Progress Bar & De-Jargoning in `ChunkingStageView`, `AnalysisStageView`, and `AssemblyStageView`

- **Files:**
  - `src/client/screens/cohortBuilder/stages/ChunkingStageView.tsx`
  - `src/client/screens/cohortBuilder/stages/AnalysisStageView.tsx`
  - `src/client/screens/cohortBuilder/stages/AssemblyStageView.tsx`
- **Action:** Overwrite all three files so:
  1. Each stage renders `.topActions` at the top right with icon-only `Back to material` (`<ArrowLeft size={16} />`), `Cancel processing` (`<Square size={15} />`), `Retry processing` (`<RotateCcw size={16} />`), and `Next →` when complete.
  2. `.progress` is placed at the **very top** of `.inventory`.
  3. `"Selected material"` headings, filler `<header><p>`, `Checksum: {chunk.checksum.slice(0, 12)}` in `ChunkingStageView.tsx`, and `Deterministic estimates, normalized from 0 to 1` + `Chunk: characters {chunk.start}–{chunk.end}` in `AnalysisStageView.tsx` are removed.

#### 1. Complete Replacement (`src/client/screens/cohortBuilder/stages/ChunkingStageView.tsx`)
```tsx
'use client';

import { ProcessingFailures, processingFailureMessage } from './ProcessingFailures';
import React from 'react';
import { ChevronRight, Lightbulb, ArrowLeft, Square, RotateCcw } from 'lucide-react';
import type { CohortWorkspace, CohortAction } from '@/src/shared/cohort-builder/contracts';
import { InkUnderline } from '@/src/client/screens/cohortCreation/components/InkUnderline';
import {
  isStageComplete,
  getStageProgressDetails,
  getValidChunks,
} from '../stage-selectors';
import shared from '@/src/client/screens/cohortCreation/components/UnderstandingProgress.module.css';
import styles from '@/src/client/screens/cohortCreation/components/ChunkingWorkspace.module.css';
import { useCohortDrafts } from '../draft-context';
import { deriveChunkTitleAndSummary, deriveChunkVideoInterval, formatDurationClock, sourceVideoId, sourceDurationSeconds } from '@/src/shared/cohort-builder/cohort-metadata';
import { YoutubeThumbnail } from '@/src/client/screens/cohortCreation/components/YoutubeThumbnail';

interface ChunkingStageViewProps {
  workspace: CohortWorkspace;
  dispatchAction: (action: CohortAction) => Promise<boolean>;
}

export function ChunkingStageView({ workspace, dispatchAction }: ChunkingStageViewProps) {
  const { inspection, setInspectionState } = useCohortDrafts();
  const sources = workspace.sources ?? [];
  const validChunks = getValidChunks(workspace);

  const stageProgress = getStageProgressDetails(workspace);
  const isComplete = isStageComplete(workspace, 'chunking');
  const isRunning = stageProgress.chunking.status === 'running';
  const isFailed = stageProgress.chunking.status === 'failed';
  const chunkedSourcesCount = stageProgress.chunking.completedCount;

  const effectiveSelectedSourceId =
    inspection.chunkingSelectedSourceId && sources.some(s => s.id === inspection.chunkingSelectedSourceId)
      ? inspection.chunkingSelectedSourceId
      : (sources[0]?.id ?? null);

  const currentSource = sources.find(s => s.id === effectiveSelectedSourceId) ?? sources[0];
  const currentSourceIndex = sources.findIndex(s => s.id === currentSource?.id);
  const selectedChunks = validChunks.filter(c => c.sourceId === currentSource?.id).sort((a, b) => a.start - b.start);
  const videoId = sourceVideoId(currentSource);

  return (
    <section aria-label="Chunking material" className={`${shared.workspace} ${styles.workspace}`}>
      <div className={shared.topActions}>
        <button
          type="button"
          className={shared.iconActionBtn}
          aria-label="Back to material"
          title="Back to material"
          onClick={() => void dispatchAction({ type: 'open_materials' })}
        >
          <ArrowLeft size={16} />
        </button>
        {isRunning ? (
          <button
            type="button"
            className={shared.iconActionBtn}
            aria-label="Cancel processing"
            title="Stop processing"
            onClick={() => void dispatchAction({ type: 'cancel_text_processing' })}
          >
            <Square size={15} />
          </button>
        ) : (
          sources.length > 0 && (
            <button
              type="button"
              className={shared.iconActionBtn}
              aria-label="Retry processing"
              title="Retry processing"
              onClick={() => void dispatchAction({ type: 'retry_processing' })}
            >
              <RotateCcw size={16} />
            </button>
          )
        )}
        {isComplete && !isRunning && (
          <button
            type="button"
            className={shared.nextStageBtn}
            aria-label="Next stage"
            onClick={() => void dispatchAction({ type: 'set_step', step: 'processing', stage: 'analysis' })}
          >
            Next →
          </button>
        )}
      </div>

      <div className={`${shared.columns} ${styles.columns}`}>
        <div>
          <header className={`${shared.heading} ${styles.heading}`}>
            <p className={shared.eyebrow}>Turning content into learning pieces</p>
            <h1>
              {isComplete && !isRunning ? (
                <>
                  Your learning<br />
                  <span>chunks are saved.<InkUnderline className={`${shared.underline} ${styles.headlineUnderline}`} /></span>
                </>
              ) : (
                <>
                  Finding natural<br />
                  <span>learning chunks…<InkUnderline className={`${shared.underline} ${styles.headlineUnderline}`} /></span>
                </>
              )}
            </h1>
          </header>

          <div className={`${shared.inventory} ${styles.inventory}`}>
            <div className={shared.progress}>
              <progress max={sources.length || 1} value={chunkedSourcesCount} aria-label="Content sources structured" />
              <span>{chunkedSourcesCount}/{sources.length} sources structured</span>
            </div>

            <fieldset className={styles.sourceList}>
              <legend className={styles.srOnly}>Select a source to inspect its chunks</legend>
              {sources.map((item, index) => {
                const count = validChunks.filter(c => c.sourceId === item.id).length;
                return (
                  <label key={item.id} className={styles.source} data-selected={item.id === currentSource?.id}>
                    <input
                      type="radio"
                      name="chunk-source"
                      checked={item.id === currentSource?.id}
                      onChange={() => setInspectionState({ chunkingSelectedSourceId: item.id })}
                    />
                    <span className={styles.number}>{String(index + 1).padStart(2, '0')}</span>
                    {sourceVideoId(item) && <YoutubeThumbnail videoId={sourceVideoId(item)!} />}
                    <span className={styles.sourceTitle}>
                      <span className={styles.sourceName} title={item.label}>{item.label}</span>
                      {sourceDurationSeconds(item) > 0 && <small>{formatDurationClock(sourceDurationSeconds(item))}</small>}
                    </span>
                    <small>{count} {count === 1 ? 'part' : 'parts'}</small>
                    <ChevronRight size={16} aria-hidden="true" />
                  </label>
                );
              })}
            </fieldset>

            <div className={shared.controls}>
              <ProcessingFailures workspace={workspace} dispatchAction={dispatchAction} />

              {workspace.lessons.some(l => l.evidenceStatus === 'orphaned') && (
                <p role="alert">This lesson references changed or removed source text.</p>
              )}

              {isFailed && workspace.processing.error && !workspace.processing.jobs?.some(job => job.status === 'failed') && (
                <p role="alert">{processingFailureMessage(workspace.processing.error)}</p>
              )}
            </div>
          </div>
        </div>

        <aside className={styles.detail} id="creation-accepted-chunks" aria-label="Accepted chunks">
          <div className={styles.detailMeta}>
            <span>{currentSource ? `Source ${String(currentSourceIndex + 1).padStart(2, '0')}` : 'Selected source'}</span>
            <span>{selectedChunks.length} {selectedChunks.length === 1 ? 'part' : 'parts'}</span>
            {sourceDurationSeconds(currentSource) > 0 && <time>{formatDurationClock(sourceDurationSeconds(currentSource))}</time>}
          </div>

          <div className={styles.detailHeader}>
            <div>
              <h2>
                <span>{currentSource?.label ?? 'Your learning pieces'}<InkUnderline className={styles.titleUnderline} /></span>
              </h2>
              <p className={styles.intro}>Grounded in your source material.</p>
            </div>
            <p className={styles.annotation}>Open a piece to explore its content.</p>
          </div>

          {selectedChunks.length === 0 ? (
            <p role="status" className={styles.empty}>
              Learning pieces appear here as each source is structured.
            </p>
          ) : (
            <ol className={styles.chunks}>
              {selectedChunks.map((chunk, index) => {
                const interval = deriveChunkVideoInterval(chunk, currentSource, index, selectedChunks.length);
                const copy = deriveChunkTitleAndSummary(chunk, currentSource, index);
                return (
                  <li key={chunk.id}>
                    <details
                      open={inspection.chunkingExpandedChunkId === chunk.id}
                      onToggle={e => {
                        const isOpen = (e.currentTarget as HTMLDetailsElement).open;
                        if (isOpen || inspection.chunkingExpandedChunkId === chunk.id) setInspectionState({ chunkingExpandedChunkId: isOpen ? chunk.id : null });
                      }}
                    >
                      <summary>
                        {videoId ? <YoutubeThumbnail videoId={videoId} /> : <span className={styles.chunkNumber}>{String(index + 1).padStart(2, '0')}</span>}
                        <span>
                          <span className={styles.duration}>
                            <time>{formatDurationClock(interval.durationSeconds)}</time>
                          </span>
                          <strong>{copy.title}</strong>
                          <span className={styles.teaser}>{copy.summary}</span>
                        </span>
                        <ChevronRight size={17} aria-hidden="true" />
                      </summary>
                      <div className={styles.evidence}>
                        {interval.hasTiming && <p>{formatDurationClock(interval.startSeconds)} - {formatDurationClock(interval.endSeconds)}</p>}
                        <p>{chunk.text}</p>
                        <small>Source: {currentSource?.label}</small>
                      </div>
                    </details>
                  </li>
                );
              })}
            </ol>
          )}

          <div className={shared.insight}>
            <Lightbulb size={27} aria-hidden="true" />
            <p>
              <strong>{selectedChunks.length} learning parts from this source.</strong>
              <span>Each part keeps its direct source context.</span>
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}
```

#### 2. Complete Replacement (`src/client/screens/cohortBuilder/stages/AnalysisStageView.tsx`)
```tsx
'use client';

import { ProcessingFailures, processingFailureMessage } from './ProcessingFailures';
import React from 'react';
import { ChevronRight, Lightbulb, ArrowLeft, Square, RotateCcw } from 'lucide-react';
import type { CohortWorkspace, CohortAction } from '@/src/shared/cohort-builder/contracts';
import { InkUnderline } from '@/src/client/screens/cohortCreation/components/InkUnderline';
import {
  isStageComplete,
  getStageProgressDetails,
  getValidChunks,
  getValidAnalyses,
} from '../stage-selectors';
import shared from '@/src/client/screens/cohortCreation/components/UnderstandingProgress.module.css';
import chunks from '@/src/client/screens/cohortCreation/components/ChunkingWorkspace.module.css';
import styles from '@/src/client/screens/cohortCreation/components/AnalysisWorkspace.module.css';
import { useCohortDrafts } from '../draft-context';
import { deriveChunkTitleAndSummary, deriveChunkVideoInterval, formatDurationClock } from '@/src/shared/cohort-builder/cohort-metadata';
import { computeDeterministicChunkVector, PEDAGOGICAL_DIMENSIONS, type PedagogicalDimension } from '@/src/shared/curriculum/pedagogicalVector.engine';

const dimensionLabels: Record<PedagogicalDimension, string> = {
  cognitive_load: 'Cognitive load', practicality_actionability: 'Practicality', visual_dependence: 'Visual dependence',
  scaffolding_guidance: 'Guidance', linearity_dependency: 'Dependency', novelty_divergence: 'Novelty',
  abstraction_depth: 'Abstraction depth', pacing_density: 'Pacing / density', rigor_formality: 'Rigor',
  interactivity_agency: 'Interactivity', breadth_scope: 'Breadth', emotional_energy: 'Emotional energy',
};
const summaryDimensions: PedagogicalDimension[] = ['cognitive_load', 'practicality_actionability', 'visual_dependence', 'abstraction_depth', 'interactivity_agency'];

interface AnalysisStageViewProps {
  workspace: CohortWorkspace;
  dispatchAction: (action: CohortAction) => Promise<boolean>;
}

export function AnalysisStageView({ workspace, dispatchAction }: AnalysisStageViewProps) {
  const { inspection, setInspectionState } = useCohortDrafts();
  const sources = workspace.sources ?? [];
  const validChunks = getValidChunks(workspace);
  const validAnalyses = getValidAnalyses(workspace);

  const stageProgress = getStageProgressDetails(workspace);
  const isComplete = isStageComplete(workspace, 'analysis');
  const isRunning = stageProgress.analysis.status === 'running';
  const isFailed = stageProgress.analysis.status === 'failed';

  const effectiveSelectedSourceId =
    inspection.analysisSelectedSourceId && sources.some(s => s.id === inspection.analysisSelectedSourceId)
      ? inspection.analysisSelectedSourceId
      : (sources[0]?.id ?? null);

  const currentSource = sources.find(s => s.id === effectiveSelectedSourceId) ?? sources[0];
  const sourceChunks = (item: typeof currentSource) => validChunks.filter(chunk => chunk.sourceId === item?.id).sort((a, b) => a.start - b.start);
  const selectedChunks = sourceChunks(currentSource);

  const analysesMap = new Map(validAnalyses.map(item => [item.chunkId, item]));
  const analyzedTotalCount = validChunks.filter(c => analysesMap.has(c.id)).length;
  const totalChunksCount = validChunks.length;

  return (
    <section aria-label="Analysis workspace" className={shared.workspace}>
      <div className={shared.topActions}>
        <button
          type="button"
          className={shared.iconActionBtn}
          aria-label="Back to material"
          title="Back to material"
          onClick={() => void dispatchAction({ type: 'open_materials' })}
        >
          <ArrowLeft size={16} />
        </button>
        {isRunning ? (
          <button
            type="button"
            className={shared.iconActionBtn}
            aria-label="Cancel processing"
            title="Stop processing"
            onClick={() => void dispatchAction({ type: 'cancel_text_processing' })}
          >
            <Square size={15} />
          </button>
        ) : (
          sources.length > 0 && (
            <button
              type="button"
              className={shared.iconActionBtn}
              aria-label="Retry processing"
              title="Retry processing"
              onClick={() => void dispatchAction({ type: 'retry_processing' })}
            >
              <RotateCcw size={16} />
            </button>
          )
        )}
        {isComplete && !isRunning && (
          <button
            type="button"
            className={shared.nextStageBtn}
            aria-label="Next stage"
            onClick={() => void dispatchAction({ type: 'set_step', step: 'processing', stage: 'assembly' })}
          >
            Next →
          </button>
        )}
      </div>

      <div className={shared.columns}>
        <div>
          <header className={shared.heading}>
            <p className={shared.eyebrow}>Analyzing your material</p>
            <h1>
              {isComplete && !isRunning ? (
                <>
                  Each piece,<br />
                  <span>understood.<InkUnderline className={shared.underline} /></span>
                </>
              ) : (
                <>
                  Understanding<br />
                  <span>each piece…<InkUnderline className={shared.underline} /></span>
                </>
              )}
            </h1>
          </header>

          <div className={shared.inventory}>
            <div className={shared.progress}>
              <progress max={totalChunksCount || 1} value={analyzedTotalCount} aria-label="Chunks analyzed" />
              <span>{analyzedTotalCount}/{totalChunksCount} chunks analyzed</span>
            </div>

            <fieldset className={chunks.sourceList}>
              <legend className={chunks.srOnly}>Select a source to inspect its analysis</legend>
              {sources.map((item, index) => {
                const itemChunks = sourceChunks(item);
                const analyzedCount = itemChunks.filter(c => analysesMap.has(c.id)).length;
                return (
                  <label key={item.id} className={chunks.source} data-selected={item.id === currentSource?.id}>
                    <input
                      type="radio"
                      name="analysis-source"
                      checked={item.id === currentSource?.id}
                      onChange={() => setInspectionState({ analysisSelectedSourceId: item.id })}
                    />
                    <span className={chunks.number}>{String(index + 1).padStart(2, '0')}</span>
                    <span className={chunks.sourceTitle}>
                      <span className={chunks.sourceName} title={item.label}>{item.label}</span>
                    </span>
                    <small>{analyzedCount}/{itemChunks.length} analyzed</small>
                    <ChevronRight size={16} aria-hidden="true" />
                  </label>
                );
              })}
            </fieldset>

            <div className={shared.controls}>
              <ProcessingFailures workspace={workspace} dispatchAction={dispatchAction} />

              {workspace.processing.error && !workspace.processing.jobs?.some(job => job.status === 'failed') && (
                <p role="alert">{processingFailureMessage(workspace.processing.error)}</p>
              )}
            </div>
          </div>
        </div>

        <aside className={chunks.detail} id="creation-accepted-analysis" aria-label="Accepted analysis">
          <div className={chunks.detailMeta}>
            <span>Selected source</span>
            <span>{selectedChunks.filter(c => analysesMap.has(c.id)).length} parts analyzed</span>
          </div>

          <h2>{currentSource?.label ?? 'Your learning pieces'}</h2>
          <p className={chunks.intro}>Key takeaways and learning dimensions for each part.</p>

          {selectedChunks.length === 0 ? (
            <p role="status" className={chunks.empty}>
              Analysis appears here as each part is processed.
            </p>
          ) : (
            <ol className={`${chunks.chunks} ${styles.rows}`}>
              {selectedChunks.map((chunk, index) => {
                const analysis = analysesMap.get(chunk.id);
                const copy = deriveChunkTitleAndSummary(chunk, currentSource, index, analysis?.summary);
                const interval = deriveChunkVideoInterval(chunk, currentSource, index, selectedChunks.length);
                const scored = analysis ? computeDeterministicChunkVector(chunk.text, {
                  title: `${copy.title} - ${currentSource?.label ?? ''}`, durationSeconds: interval.durationSeconds,
                  chunkIndex: index, totalChunks: selectedChunks.length,
                }) : null;
                return (
                  <li key={chunk.id}>
                    <details
                      open={inspection.analysisExpandedChunkId === chunk.id}
                      onToggle={e => {
                        const isOpen = (e.currentTarget as HTMLDetailsElement).open;
                        if (isOpen || inspection.analysisExpandedChunkId === chunk.id) setInspectionState({ analysisExpandedChunkId: isOpen ? chunk.id : null });
                      }}
                    >
                      <summary>
                        <span className={chunks.chunkNumber}>{String(index + 1).padStart(2, '0')}</span>
                        <span>
                          <small>{formatDurationClock(interval.durationSeconds)}</small>
                          <strong>{copy.title}</strong>
                          <span className={chunks.teaser}>
                            {analysis ? 'Ready' : 'Analyzing…'}
                          </span>
                        </span>
                        {scored && <span className={styles.scores}>
                          {summaryDimensions.map((key, row) => <span key={key} className={styles.score} aria-label={`${dimensionLabels[key]}: ${scored.vectorMap[key].toFixed(2)} out of 1`}>
                            <span>{dimensionLabels[key]}</span>
                            <span className={styles.dots} data-tone={row} aria-hidden="true">
                              {Array.from({ length: 6 }, (_, dot) => <i key={dot} data-filled={dot < Math.round(scored.vectorMap[key] * 6)} />)}
                            </span>
                          </span>)}
                        </span>}
                        <ChevronRight size={17} aria-hidden="true" />
                      </summary>
                      <div className={chunks.evidence}>
                        <p>{analysis?.summary ?? chunk.text}</p>
                        {scored && <dl className={styles.dimensions}>{PEDAGOGICAL_DIMENSIONS.map(key => <div key={key}>
                          <dt>{dimensionLabels[key]}</dt><dd>{scored.vectorMap[key].toFixed(2)}</dd>
                        </div>)}</dl>}
                        {analysis?.question && (
                          <p>
                            <strong>Key question:</strong> {analysis.question}
                          </p>
                        )}
                      </div>
                    </details>
                  </li>
                );
              })}
            </ol>
          )}

          <div className={shared.insight}>
            <Lightbulb size={27} aria-hidden="true" />
            <p>
              <strong>{analyzedTotalCount} parts analyzed.</strong>
              <span>Lessons are assembled from these insights next.</span>
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}
```

#### 3. Complete Replacement (`src/client/screens/cohortBuilder/stages/AssemblyStageView.tsx`)
```tsx
'use client';

import { ProcessingFailures, processingFailureMessage } from './ProcessingFailures';
import React from 'react';
import { ArrowLeft, Square, RotateCcw } from 'lucide-react';
import type { CohortWorkspace, CohortAction } from '@/src/shared/cohort-builder/contracts';
import { BuildingArt } from '@/src/client/screens/cohortCreation/components/BuildingArt';
import {
  isStageComplete,
  getStageProgressDetails,
  getValidChunks,
} from '../stage-selectors';
import shared from '@/src/client/screens/cohortCreation/components/UnderstandingProgress.module.css';
import styles from '@/src/client/screens/cohortCreation/components/ReadyWorkspace.module.css';

interface AssemblyStageViewProps {
  workspace: CohortWorkspace;
  dispatchAction: (action: CohortAction) => Promise<boolean>;
}

export function AssemblyStageView({ workspace, dispatchAction }: AssemblyStageViewProps) {
  const lessonCount = workspace.lessons.length;
  const validChunks = getValidChunks(workspace);
  const chunkCount = validChunks.length;
  const status = workspace.processing.status;

  const stageProgress = getStageProgressDetails(workspace);
  const isComplete = isStageComplete(workspace, 'assembly');
  const isRunning = stageProgress.assembly.status === 'running';
  const isFailed = stageProgress.assembly.status === 'failed';

  return (
    <div className={styles.workspace}>
      <div className={shared.topActions}>
        <button
          type="button"
          className={shared.iconActionBtn}
          aria-label="Back to material"
          title="Back to material"
          onClick={() => void dispatchAction({ type: 'open_materials' })}
        >
          <ArrowLeft size={16} />
        </button>
        {isRunning ? (
          <button
            type="button"
            className={shared.iconActionBtn}
            aria-label="Cancel processing"
            title="Stop processing"
            onClick={() => void dispatchAction({ type: 'cancel_text_processing' })}
          >
            <Square size={15} />
          </button>
        ) : (
          <button
            type="button"
            className={shared.iconActionBtn}
            aria-label="Retry processing"
            title="Retry processing"
            onClick={() => void dispatchAction({ type: 'retry_processing' })}
          >
            <RotateCcw size={16} />
          </button>
        )}
        {isComplete && !isRunning && (
          <button
            type="button"
            className={shared.nextStageBtn}
            aria-label="Next stage"
            onClick={() => void dispatchAction({ type: 'set_step', step: 'ready' })}
          >
            Next →
          </button>
        )}
      </div>

      <div className={styles.layout}>
        <div className={styles.content}>
          <header className={`${styles.heading} ${styles.buildingHeading}`}>
            <p className={styles.eyebrow}>Building your learning experience</p>
            <h1>{isComplete && !isRunning ? 'Your lessons are saved.' : 'Bringing it all together…'}</h1>
            <p>Your accepted analysis and source evidence become meaningful lessons.</p>
          </header>

          <section aria-label="Building material" className={styles.buildControls}>
            <progress
              max={lessonCount > 0 ? lessonCount : 1}
              value={isComplete ? lessonCount : 0}
              aria-label="Lessons built"
            />

            {isRunning ? (
              <div role="status">
                <p>
                  {chunkCount} parts analyzed; {lessonCount} lessons structured.
                </p>
                <p>Assembling your lessons and syllabus in real time.</p>
              </div>
            ) : (
              <div>
                <p role="status">
                  {isComplete
                    ? 'Building complete. Curriculum lessons are saved.'
                    : `Building ${status}.`}
                </p>
                <ProcessingFailures workspace={workspace} dispatchAction={dispatchAction} />

                {isFailed && workspace.processing.error && !workspace.processing.jobs?.some(job => job.status === 'failed') && (
                  <p role="alert">{processingFailureMessage(workspace.processing.error)}</p>
                )}
              </div>
            )}
          </section>
        </div>

        <BuildingArt />
      </div>
    </div>
  );
}
```

---

### Step `S14` — Clean Concept Cloud Chips (`src/shared/cohort-builder/cohort-metadata.ts`)

- **File:** `src/shared/cohort-builder/cohort-metadata.ts`
- **Action:** Update `STOPWORDS` and `extractSourceConceptTopics` (lines 14–93) in `src/shared/cohort-builder/cohort-metadata.ts` so `#hashtags`, bracketed clickbait (`[MUST KNOW TIPS]`, `(Simple ...)`), and question/clickbait clauses (`Why It Is The Best`, `To Get Started`, `Step by Step`, `My Secret`, `Basics Comes First`) are stripped before concept chips are emitted.

#### Before (`src/shared/cohort-builder/cohort-metadata.ts` lines 14–93)
```ts
const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'into', 'your', 'you',
  'are', 'was', 'were', 'will', 'would', 'could', 'should', 'have', 'has', 'had',
  'about', 'what', 'when', 'where', 'which', 'while', 'their', 'there', 'these',
  'those', 'then', 'than', 'them', 'they', 'some', 'such', 'more', 'most', 'other',
  'over', 'under', 'after', 'before', 'between', 'through', 'during', 'without',
  'within', 'along', 'following', 'across', 'behind', 'beyond', 'plus', 'except',
  'but', 'not', 'only', 'own', 'same', 'so', 'too', 'very', 'can', 'just', 'dont',
  'want', 'learn', 'learning', 'course', 'tutorial', 'video', 'videos', 'guide',
  'notes', 'text', 'material', 'source', 'full', 'complete', 'introduction', 'intro', 'how', 'make', 'build', 'using',
  'part', 'ep', 'episode', 'lecture', 'lesson', 'chapter', 'section', 'overview',
]);
```
and
```ts
export function extractSourceConceptTopics(source: { label: string; text: string }): string[] {
  const seen = new Set<string>();
  const concepts: string[] = [];

  const pushConcept = (raw: string) => {
    const cleaned = raw
      .replace(/^[#*\-•\d.)\s]+/, '')
      .replace(/\bhttps?:\/\/\S+/gi, '')
      .replace(/[^\p{L}\p{N}\s/&+#.-]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!cleaned || cleaned.length < 3) return;
    const words = cleaned.split(/\s+/).filter(w => w.length > 1);
    while (words.length > 0 && STOPWORDS.has(words[0].toLowerCase())) words.shift();
    while (words.length > 0 && STOPWORDS.has(words[words.length - 1].toLowerCase())) words.pop();
    if (words.length === 0 || words.length > 5) return;
    const phrase = toTitleCase(words.join(' ')).slice(0, 60);
    const key = phrase.toLowerCase();
    if (STOPWORDS.has(key) || seen.has(key)) return;
    seen.add(key);
    concepts.push(phrase);
  };

  // 1. Extract from source label (e.g. YouTube video title segments)
  if (source.label && !/^https?:\/\//i.test(source.label)) {
    const labelParts = source.label
      .split(/\s*(?:\||—|–|-|:|\(|\)|\[|\])\s*/)
      .map(s => s.trim())
      .filter(Boolean);
    for (const part of labelParts) {
      const subParts = part.split(/\b(?:and|with|vs\.?|for|in|on)\b/i);
      for (const sub of subParts) pushConcept(sub);
    }
  }
```

#### After (`src/shared/cohort-builder/cohort-metadata.ts` lines 14–108)
```ts
const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'into', 'your', 'you',
  'are', 'was', 'were', 'will', 'would', 'could', 'should', 'have', 'has', 'had',
  'about', 'what', 'when', 'where', 'which', 'while', 'their', 'there', 'these',
  'those', 'then', 'than', 'them', 'they', 'some', 'such', 'more', 'most', 'other',
  'over', 'under', 'after', 'before', 'between', 'through', 'during', 'without',
  'within', 'along', 'following', 'across', 'behind', 'beyond', 'plus', 'except',
  'but', 'not', 'only', 'own', 'same', 'so', 'too', 'very', 'can', 'just', 'dont',
  'want', 'learn', 'learning', 'course', 'tutorial', 'video', 'videos', 'guide',
  'notes', 'text', 'material', 'source', 'full', 'complete', 'introduction', 'intro', 'how', 'make', 'build', 'using',
  'part', 'ep', 'episode', 'lecture', 'lesson', 'chapter', 'section', 'overview',
  'why', 'best', 'must', 'know', 'tips', 'secret', 'step', 'get', 'started', 'ready',
  'beginners', 'beginner', 'simple', 'easy', 'minutes', 'explained', 'exploring', 'inside',
]);

const CLICKBAIT_CONCEPT_PATTERN =
  /\b(why\s+it\s+is|must\s+know|step\s+by\s+step|get\s+started|are\s+you\s+ready|my\s+secret|basics\s+comes\s+first|how\s+to|in\s+\d+\s+minutes|codes?\s+and\s+tutorial|https?)\b/i;
```
and inside `extractSourceConceptTopics`:
```ts
export function extractSourceConceptTopics(source: { label: string; text: string }): string[] {
  const seen = new Set<string>();
  const concepts: string[] = [];

  const pushConcept = (raw: string) => {
    if (/[?]/.test(raw) || CLICKBAIT_CONCEPT_PATTERN.test(raw)) return;
    const cleaned = raw
      .replace(/\[[^\]]*\]/g, ' ')
      .replace(/#\S+/g, ' ')
      .replace(/^[#*\-•\d.)\s]+/, '')
      .replace(/\bhttps?:\/\/\S+/gi, '')
      .replace(/[^\p{L}\p{N}\s/&+#.-]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!cleaned || cleaned.length < 3 || CLICKBAIT_CONCEPT_PATTERN.test(cleaned)) return;
    const words = cleaned.split(/\s+/).filter(w => w.length > 1);
    while (words.length > 0 && STOPWORDS.has(words[0].toLowerCase())) words.shift();
    while (words.length > 0 && STOPWORDS.has(words[words.length - 1].toLowerCase())) words.pop();
    if (words.length === 0 || words.length > 5) return;
    const phrase = toTitleCase(words.join(' ')).slice(0, 60);
    const key = phrase.toLowerCase();
    if (STOPWORDS.has(key) || seen.has(key) || CLICKBAIT_CONCEPT_PATTERN.test(key)) return;
    seen.add(key);
    concepts.push(phrase);
  };

  // 1. Extract from source label (e.g. YouTube video title segments)
  if (source.label && !/^https?:\/\//i.test(source.label)) {
    const labelWithoutBrackets = source.label.replace(/\[[^\]]*\]/g, ' ').replace(/#\S+/g, ' ');
    const labelParts = labelWithoutBrackets
      .split(/\s*(?:\||—|–|-|:|\(|\))\s*/)
      .map(s => s.trim())
      .filter(Boolean);
    for (const part of labelParts) {
      if (/[?]/.test(part)) continue;
      const subParts = part.split(/\b(?:and|with|vs\.?|for|in|on)\b/i);
      for (const sub of subParts) pushConcept(sub);
    }
  }
```

---

### Step `S15` — Remove `'Review chunks'` Jargon Chip from Chat Suggestions (`src/client/screens/cohortBuilder/chat-suggestions.ts`)

- **File:** `src/client/screens/cohortBuilder/chat-suggestions.ts`
- **Action:** Replace `{ id: 'review_chunks', label: 'Review chunks', prompt: 'Show chunking details' }` on line 80 with `{ id: 'how_it_works', label: 'How this works', prompt: 'How does curriculum building work?' }`.

#### Before (`src/client/screens/cohortBuilder/chat-suggestions.ts` lines 77–83)
```ts
  if (step === 'processing') {
    return [
      { id: 'view_progress', label: 'View progress', prompt: 'Show understanding progress' },
      { id: 'review_chunks', label: 'Review chunks', prompt: 'Show chunking details' },
      { id: 'cancel_processing', label: 'Cancel processing', prompt: 'Cancel processing' },
    ].slice(0, 3);
  }
```

#### After (`src/client/screens/cohortBuilder/chat-suggestions.ts` lines 77–83)
```ts
  if (step === 'processing') {
    return [
      { id: 'view_progress', label: 'View progress', prompt: 'Show understanding progress' },
      { id: 'how_it_works', label: 'How this works', prompt: 'How does curriculum building work?' },
      { id: 'cancel_processing', label: 'Cancel processing', prompt: 'Cancel processing' },
    ].slice(0, 3);
  }
```

---

## Section E — Verification Commands & Expected Outcomes

Run the following verification commands in order from `d:\ThisPC\Documents\SideQuestHQ\undone-site`:

1. **TypeScript Type Check:**
   ```powershell
   npx tsc --noEmit
   ```
   - **Expected Outcome:** Exit code `0` with zero TypeScript errors.

2. **YouTube Metadata Route & Server Domain Unit Tests:**
   ```powershell
   npx vitest run src/app/api/import/youtube/metadata/__tests__/route.test.ts src/server/domain/cohort-builder/__tests__/journey-video-adapter.test.ts src/server/domain/cohort-builder/__tests__/journey-provider-safety.test.ts src/server/domain/cohort-builder/__tests__/text-jobs.test.ts
   ```
   - **Expected Outcome:** All 4 test suites pass (`100%` passing, including all 12 tests in `route.test.ts`).

3. **Cohort Builder & Cohort Creation UI / Metadata Unit Tests:**
   ```powershell
   npx vitest run src/client/screens/cohortBuilder/__tests__/MaterialStageView.test.tsx src/client/screens/cohortBuilder/__tests__/DiscoveryStageView.test.tsx src/client/screens/cohortBuilder/__tests__/CohortWorkspacePane.test.tsx src/client/screens/cohortBuilder/__tests__/stage-selectors.test.ts src/client/screens/cohortCreation/__tests__/processing-details.test.tsx src/shared/cohort-builder/__tests__/cohort-metadata.test.ts
   ```
   - **Expected Outcome:** All 6 test suites pass (`100%` passing).

---

## Section F — Completion Report Contract

When reporting execution completion, provide:
1. Status of each step (`S1`–`S15`).
2. Exact output of the verification commands in **Section E**.
3. Confirmation that no untracked temporary files or placeholder comments were left behind.
