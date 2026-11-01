# IdiotHandOffGuide — Anti-Fragile Cohort Creation Cleanup & Consolidation

## A. Execution Contract

- **Target Outcome**: Consolidate and clean up the cohort creation architecture to be anti-fragile, eliminating ~1,200 lines of duplicate code, dead files, and unused parallel state mirrors. Unify duplicate progress calculation into a single pure engine (`creation-progress.ts`), enforce exact evidence and build-input fingerprints on build completion, prevent UI panel toggling from aborting active builds, replace two-step back navigation with atomic `open_materials`, raise the text job query limit from 101 to 505 for 100-source cohorts, and delete obsolete `GoalStageView`.
- **Root Directory**: `D:/ThisPC/Documents/SideQuestHQ/undone-site`
- **Operating System / Shell**: `windows` / `powershell`
- **Baseline Commit**: `744d67f7` (`master`)
- **Guide Status**: `READY`

### Operational Sequence
1. Verify git working tree state and baseline file SHA-256 digests (`Pre-Flight Baseline Check Command` below).
2. Apply implementation steps `S1` through `S16` in strict sequential order.
3. Run verification steps `V1` through `V6` in strict sequential order.
4. If any file anchor, checksum, typecheck, lint rule, unit test, or Vercel build check fails, **stop immediately**, do not improvise unverified workarounds, and report the exact failing step ID and diagnostic output.
5. Produce the final completion report matching **Section F**.

### Pre-Flight Baseline Check Command
Run this command from `D:/ThisPC/Documents/SideQuestHQ/undone-site` in PowerShell before applying any step:

```powershell
node -e "const fs = require('fs'); const crypto = require('crypto'); const expected = { 'src/shared/cohort-builder/contracts.ts': 'bfccc5dea77d5a0358bf979e791ebe870e400d3f2305575d0856c799eef1dfb8', 'src/shared/cohort-builder/creation-state.ts': 'a26ffef62921fb07b5e041c45fb93c520db37497a7314841c7c24d930820d138', 'src/shared/cohort-builder/creation-machine.ts': 'c6694e0935b71496a19b000f81ff608a78b733bc22ca832eab9830d160c9fa2a', 'src/shared/cohort-builder/creation-view.ts': '635ea7c5119b85d3d1382095187c8525766099f91349d4a2ca0e3c9aa24f38f0', 'src/client/screens/cohortBuilder/stage-selectors.ts': 'fcae47b894b01d7a0e61a14d736bdc4ccbbeb3a61fd7df285859503376fd2833', 'src/shared/cohort-builder/readiness.ts': '54bef56e40d87bcbb1cb8339ddb037e304ef7f12e1313078e35107da7b490d86', 'src/server/domain/cohort-builder/text-job-status.ts': '709c8444ea0c50437f3d7e6510f0b2bf8261cb77ff2b6c4dc2c21d3662652e74', 'src/server/domain/cohort-builder/tools.ts': '221daf66bac8c12a26a19e9ffa6dc1639c18d0801c2fd34b9bcf744e7aa53d70', 'src/client/screens/cohortBuilder/stages/ReadyStageView.tsx': '7ab99d43a3d2abfb5dc9e1021cd7cbcae1b1b8b3168b8e08f5b4b5433911cab8', 'src/client/screens/cohortBuilder/stages/GoalStageView.tsx': '99355f683ebc7765dd006446a37d267d2ed95aad6255a66ac7440116d18e7088', 'src/client/screens/cohortBuilder/stages/GoalStageView.module.css': '1bf34b97d83993282892b041c5a52cf41ae4fe7336235aab41418fe0ba9a940a' }; for (const [file, exp] of Object.entries(expected)) { const actual = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); if (actual !== exp) { console.error('MISMATCH:', file, 'expected', exp, 'got', actual); process.exit(1); } } console.log('ALL_BASELINE_HASHES_VERIFIED');"
```

Expected output: `ALL_BASELINE_HASHES_VERIFIED` with exit code `0`.

---

## B. Requirements and Acceptance Map

| Requirement ID | Observable Behavior | Implementing Step IDs | Verification IDs |
| :--- | :--- | :--- | :--- |
| `C1` | **Unified Progress Derivation (`creation-progress.ts`)**: Replace duplicate progress algorithms in `creation-view.ts` and `stage-selectors.ts` with a single pure `deriveStageProgress(workspace): StageProgressDetails` module, eliminating 630+ lines of duplicate logic. | `S1`, `S4`, `S5` | `V1`, `V2`, `V3` |
| `C2` | **Remove Unused Parallel State Mirror**: Delete 181 lines of unused parallel state types and functions (`CreationMachineState`, `BuildRegionState`, `DiscoveryRegionState`, `ReleaseRegionState`, `normalizeCreationBranch`, `deriveCreationMachineState`) from `creation-state.ts`. | `S2`, `S12` | `V1`, `V3`, `V4` |
| `C3` | **Delete Dead Legacy Goal UI**: Remove `GoalStageView.tsx` and `GoalStageView.module.css` (426 lines) and their obsolete tests, leaving clean intake routing to `DiscoveryStageView` ("Start with a goal") and `MaterialStageView`. | `S10`, `S11`, `S13` | `V1`, `V3`, `V4` |
| `C4` | **Strict Evidence & Build-Input Fingerprint Freshness**: `isBuildComplete` verifies `processing.sourceFingerprint === computeSourceEvidenceFingerprint(workspace)` and validates `buildInputFingerprint` (covering locations, provenance, intent, audience, dailyMinutes, and lesson overrides). `projectAcceptedBuildCompletion` computes and attaches `buildInputFingerprint` and validates chunk text boundaries against source slices. | `S2`, `S3`, `S6` | `V1`, `V2`, `V3` |
| `C5` | **Non-Destructive Navigation**: `close_panel` and `return_to_planning` preserve active build status (`next.processing`) rather than resetting `status = 'idle'`, preventing panel toggling from cancelling work in flight. | `S6`, `S14` | `V1`, `V2`, `V3` |
| `C6` | **Atomic `open_materials` Domain Action**: Add `{ type: 'open_materials' }` action transitioning directly to `material_input` step, replacing the fragile two-step `back_to_starting_point` + `choose_starting_point` sequence in `ReadyStageView.tsx`. | `S6`, `S9`, `S14` | `V1`, `V2`, `V3` |
| `C7` | **Release & Job Graph Scaling Invariants**: `validateCohortReadiness` enforces `isBuildComplete` for sourced builds. `textJobStatus` increases SQL `LIMIT` from 101 to 505, ensuring 100-source cohorts are never truncated. | `S7`, `S8` | `V1`, `V2`, `V3` |
| `C8` | **Net Code Reduction & Full Verification**: Net production code decreases by ~1,200 lines. All unit, integration, and full `npm run verify:vercel` deployment checks pass. | `S1`–`S16` | `V1`–`V6` |

---

## C. File-Change Manifest

| Step ID | Operation | File Path | Purpose | Baseline SHA-256 |
| :--- | :--- | :--- | :--- | :--- |
| `S1` | `CREATE` | `src/shared/cohort-builder/creation-progress.ts` | Single pure stage progress calculation engine. | *(new file)* |
| `S2` | `MODIFY` | `src/shared/cohort-builder/creation-state.ts` | Remove unused parallel state mirror; enforce exact source & build-input fingerprint matching in `isBuildComplete`. | `a26ffef62921fb07b5e041c45fb93c520db37497a7314841c7c24d930820d138` |
| `S3` | `MODIFY` | `src/shared/cohort-builder/creation-machine.ts` | Save `buildInputFingerprint`; validate source counts, chunk text bounds, and checksums in `projectAcceptedBuildCompletion`. | `c6694e0935b71496a19b000f81ff608a78b733bc22ca832eab9830d160c9fa2a` |
| `S4` | `MODIFY` | `src/shared/cohort-builder/creation-view.ts` | Delegate progress derivation to `creation-progress.ts`, removing duplicate calculation. | `635ea7c5119b85d3d1382095187c8525766099f91349d4a2ca0e3c9aa24f38f0` |
| `S5` | `MODIFY` | `src/client/screens/cohortBuilder/stage-selectors.ts` | Remove obsolete `computeIsStageComplete`, `computeStageProgressDetails`, and caches; delegate to `creation-progress.ts`. | `fcae47b894b01d7a0e61a14d736bdc4ccbbeb3a61fd7df285859503376fd2833` |
| `S6` | `MODIFY` | `src/shared/cohort-builder/contracts.ts` | Add `buildInputFingerprint` to schema; add `open_materials` action; preserve processing in `close_panel`/`return_to_planning`; guard `open_review` with `isBuildComplete`. | `bfccc5dea77d5a0358bf979e791ebe870e400d3f2305575d0856c799eef1dfb8` |
| `S7` | `MODIFY` | `src/shared/cohort-builder/readiness.ts` | Require `isBuildComplete` for sourced builds before release. | `54bef56e40d87bcbb1cb8339ddb037e304ef7f12e1313078e35107da7b490d86` |
| `S8` | `MODIFY` | `src/server/domain/cohort-builder/text-job-status.ts` | Increase SQL query `LIMIT` from 101 to 505 for 100-source support. | `709c8444ea0c50437f3d7e6510f0b2bf8261cb77ff2b6c4dc2c21d3662652e74` |
| `S9` | `MODIFY` | `src/client/screens/cohortBuilder/stages/ReadyStageView.tsx` | Use atomic `open_materials` on Back; update primary CTA to "Review and activate". | `7ab99d43a3d2abfb5dc9e1021cd7cbcae1b1b8b3168b8e08f5b4b5433911cab8` |
| `S10` | `DELETE` | `src/client/screens/cohortBuilder/stages/GoalStageView.tsx` | Remove obsolete dead component (-215 lines). | `99355f683ebc7765dd006446a37d267d2ed95aad6255a66ac7440116d18e7088` |
| `S11` | `DELETE` | `src/client/screens/cohortBuilder/stages/GoalStageView.module.css` | Remove obsolete dead CSS module (-211 lines). | `1bf34b97d83993282892b041c5a52cf41ae4fe7336235aab41418fe0ba9a940a` |
| `S12` | `MODIFY` | `src/shared/cohort-builder/__tests__/creation-machine.test.ts` | Update tests to assert directly on `isBuildComplete` and `isBuildStale`. | `326f2e17a2d2f934e66b349d2b9a7db22f939cd54bd0752a324617d47cb4a7da` |
| `S13` | `MODIFY` | `src/client/screens/cohortBuilder/__tests__/journey-checkpoint4-branch.test.tsx` | Remove obsolete tests for deleted `GoalStageView`. | *(observed file)* |
| `S14` | `MODIFY` | `src/shared/cohort-builder/__tests__/journey-actions.test.ts` | Assert `close_panel` preserves active processing. | *(observed file)* |
| `S15` | `CREATE` | `src/shared/cohort-builder/__tests__/creation-cleanup.test.ts` | Comprehensive test suite verifying all cleanup anti-fragile invariants. | *(new file)* |
| `S16` | `MODIFY` | UI & Integration Test Fixtures | Ensure test fixtures carry genuine source fingerprints so strict completion checks succeed. | *(observed files)* |

---

## D. Ordered Implementation Steps

### Step `S1` — Create `src/shared/cohort-builder/creation-progress.ts`

- **Operation**: `CREATE`
- **File Path**: `src/shared/cohort-builder/creation-progress.ts`
- **Action**: Create the file with the following exact contents:

```ts
import type { CohortWorkspace } from './contracts';
import { isBuildComplete } from './creation-state';

export const CREATION_STAGES = ['understanding', 'chunking', 'analysis', 'assembly'] as const;
export type CanonicalStage = typeof CREATION_STAGES[number];

export interface StageStatus {
  status: 'complete' | 'running' | 'failed' | 'canceled' | 'pending';
  completedCount: number;
  totalCount: number;
  failedCount: number;
  retryable: boolean;
  isCanceled: boolean;
}

export type StageProgressDetails = Record<CanonicalStage, StageStatus>;

export function deriveStageProgress(workspace: CohortWorkspace): StageProgressDetails {
  const sources = workspace.sources;
  const jobs = (workspace.processing.jobs ?? []).filter(j => j.status !== 'superseded');
  const complete = isBuildComplete(workspace);
  const current = workspace.processing.stage;
  const index = current === 'chunking' ? 1 : current === 'analysis' ? 2 : current === 'assembly' || current === 'done' ? 3 : 0;
  const canceled = workspace.processing.error === 'PROCESSING_CANCELED';
  let priorComplete = true;

  return Object.fromEntries(CREATION_STAGES.map((stage, i) => {
    const total = stage === 'assembly' ? 1 : sources.length;
    const groups = stage === 'assembly'
      ? [jobs.filter(j => j.stage === 'assembly')]
      : sources.map(s => jobs.filter(j => j.sourceId === s.id && (stage === 'understanding' ? ['acquisition', 'extraction', 'understanding'].includes(j.stage) : j.stage === stage)));
    const stageJobs = groups.flat();
    let count = groups.filter(group => group.length > 0 && group.every(j => j.status === 'accepted') && group.some(j => j.stage === stage)).length;
    const failedCount = groups.filter(group => group.some(j => j.status === 'failed')).length;
    let done = sources.length > 0 && priorComplete && count === total;
    if (!jobs.length) {
      done = sources.length > 0 && (complete || (['queued', 'processing', 'failed'].includes(workspace.processing.status) && i < index));
      count = done ? total : 0;
    }
    if (stage === 'assembly') done = complete;
    const failed = failedCount > 0 || (!jobs.length && workspace.processing.status === 'failed' && i === index);
    const stopped = (canceled && (!jobs.length || stageJobs.length > 0)) || stageJobs.some(j => j.status === 'canceled');
    const active = stageJobs.some(j => j.status === 'running' || (j.status === 'queued' && priorComplete)) || (!jobs.length && ['queued', 'processing'].includes(workspace.processing.status) && i === index);
    const status: StageStatus['status'] = done ? 'complete' : failed ? 'failed' : stopped ? 'canceled' : active ? 'running' : 'pending';
    priorComplete = done;
    return [stage, {
      status,
      completedCount: done ? total : count,
      totalCount: total,
      failedCount,
      retryable: stageJobs.some(j => j.status === 'failed' && j.retryable),
      isCanceled: !done && stopped,
    }];
  })) as StageProgressDetails;
}
```

- **Postcondition**: File exists and exports `CREATION_STAGES`, `deriveStageProgress`, and progress types.

---

### Step `S2` — Modify `src/shared/cohort-builder/creation-state.ts`

- **Operation**: `MODIFY`
- **File Path**: `src/shared/cohort-builder/creation-state.ts`
- **Action**:
  1. Remove `CohortJourneyStep` import from `./contracts`.
  2. Replace `computeBuildInputFingerprint` source mapping to include locations and provenance:
     - Target anchor:
       ```ts
           .map(source => [source.id, source.version, source.input ?? source.text]);
       ```
     - Replacement:
       ```ts
           .map(source => [source.id, source.version, source.input ?? null, source.text, source.locations ?? [], source.provenance ?? null]);
       ```
  3. Replace the `isBuildComplete` source fingerprint check with exact equality and buildInputFingerprint check:
     - Target anchor:
       ```ts
         if (!processing.sourceFingerprint) return false;
       ```
     - Replacement:
       ```ts
         if (processing.sourceFingerprint !== computeSourceEvidenceFingerprint(workspace)) return false;
         if (processing.buildInputFingerprint && processing.buildInputFingerprint !== computeBuildInputFingerprint(workspace)) return false;
       ```
  4. In `isBuildStale`, detect incomplete ready state:
     - Target anchor:
       ```ts
         if (!processing || sources.length === 0) return false;
       ```
     - Replacement:
       ```ts
         if (!processing || sources.length === 0) return false;
         if (processing.status === 'ready' && !isBuildComplete(workspace)) return true;
       ```
  5. Delete the unused parallel state mirror types: remove lines from `export type CreationStep =` down to `type JobItem =`, replacing with:
     ```ts
     export interface WorkspaceInvariantReport { valid: boolean; violations: string[]; }
     ```
  6. Delete from `/**\n * Normalizes legacy branch` to the end of the file (removing `normalizeCreationBranch` and `deriveCreationMachineState`).

- **Postcondition**: File compiles with zero unused types, exact fingerprint verification, and reduced line count (-181 lines).

---

### Step `S3` — Modify `src/shared/cohort-builder/creation-machine.ts`

- **Operation**: `MODIFY`
- **File Path**: `src/shared/cohort-builder/creation-machine.ts`
- **Action**:
  1. In imports from `./creation-state`, add `computeBuildInputFingerprint`.
  2. In `projectAcceptedBuildCompletion`, add chunk boundary, text substring, and checksum validation before `const next = structuredClone(state);`:
     ```ts
       if (options.sources.length !== state.sources.length || new Set(options.sources.map(s => s.id)).size !== options.sources.length) {
         throw new Error('INVALID_ACCEPTED_SOURCE');
       }
       for (const chunk of options.chunks) {
         const source = state.sources.find(s => s.id === chunk.sourceId && s.version === chunk.sourceVersion);
         if (
           !source ||
           chunk.start < 0 ||
           chunk.end <= chunk.start ||
           chunk.end > source.text.length ||
           source.text.slice(chunk.start, chunk.end) !== chunk.text ||
           sha256(chunk.text) !== chunk.checksum
         ) {
           throw new Error('INVALID_ACCEPTED_CHUNK');
         }
       }
     ```
  3. In `projectAcceptedBuildCompletion`, attach `buildInputFingerprint: computeBuildInputFingerprint(next)` next to `sourceFingerprint: fingerprint`.
  4. In source checksum assignment, replace with strict verification:
     - Target:
       ```ts
           source.checksum = accepted ? accepted.checksum : sha256(source.text);
       ```
     - Replacement:
       ```ts
           if (!accepted || (accepted.checksum !== source.checksum && accepted.checksum !== sha256(source.text))) {
             throw new Error('INVALID_ACCEPTED_SOURCE');
           }
           source.checksum = accepted.checksum;
       ```
  5. In `getCreationCapabilities`, ensure `canOpenReview` requires complete build:
     - Target:
       ```ts
               (workspace.lessons ?? []).length > 0 &&
               !isProcessingActive));
       ```
     - Replacement:
       ```ts
               (workspace.lessons ?? []).length > 0 &&
               (workspace.sources.length === 0 || buildComplete) &&
               !isProcessingActive));
       ```

---

### Step `S4` — Modify `src/shared/cohort-builder/creation-view.ts`

- **Operation**: `MODIFY`
- **File Path**: `src/shared/cohort-builder/creation-view.ts`
- **Action**:
  1. Import `CREATION_STAGES` and `deriveStageProgress` from `./creation-progress`.
  2. Replace the 288-line `deriveProcessingProgress` implementation with:
     ```ts
     export function deriveProcessingProgress(workspace: CohortWorkspace): ProcessingProgress {
       const details = deriveStageProgress(workspace);
       const labels: ProcessingStep['label'][] = ['Understanding', 'Chunking', 'Analyzing', 'Building'];
       const steps = CREATION_STAGES.map((stage, index) => ({
         label: labels[index],
         isComplete: details[stage].status === 'complete',
         isCurrent: details[stage].status === 'running',
         isFailed: details[stage].status === 'failed',
       }));
       return {
         steps,
         currentStepIndex: steps.findIndex(step => step.isCurrent),
         needsRebuild: isBuildStale(workspace) || CREATION_STAGES.some(stage => ['failed', 'canceled'].includes(details[stage].status)),
       };
     }
     ```
  3. In `deriveReadyStageViewModel`, update:
     - `canReview: capabilities.canOpenReview`
     - Retain canonical subtitle copy (asserted by UI test suites):
       ```ts
       subtitle: isReady
         ? 'I’ve turned your material into a learning experience and set it up in your personal feed. You can jump straight in, or review the cohort structure first.'
         : 'Your material is still being processed into a curriculum. You can wait for completion or go back to adjust your sources.',
       ```

---

### Step `S5` — Modify `src/client/screens/cohortBuilder/stage-selectors.ts`

- **Operation**: `MODIFY`
- **File Path**: `src/client/screens/cohortBuilder/stage-selectors.ts`
- **Action**:
  1. Replace `export type CanonicalStage = ...` and duplicate `StageStatus`, `StageProgressDetails` declarations with:
     ```ts
     export type { CanonicalStage, StageStatus, StageProgressDetails } from '@/src/shared/cohort-builder/creation-progress';
     import { deriveStageProgress, type CanonicalStage, type StageProgressDetails } from '@/src/shared/cohort-builder/creation-progress';
     ```
  2. Remove `STAGE_ORDER_MAP`.
  3. Replace `computeIsStageComplete`, `isStageComplete`, `computeStageProgressDetails`, and `getStageProgressDetails` with:
     ```ts
     export function isStageComplete(workspace: CohortWorkspace, stage: CanonicalStage): boolean {
       return deriveStageProgress(workspace)[stage].status === 'complete';
     }

     export function getStageProgressDetails(workspace: CohortWorkspace): StageProgressDetails {
       const cached = stageProgressDetailsCache.get(workspace);
       if (cached) return cached;
       const result = deriveStageProgress(workspace);
       stageProgressDetailsCache.set(workspace, result);
       return result;
     }
     ```
  4. Remove `stageCompleteCache` variable and its reset inside `clearStageSelectorsCache`.

---

### Step `S6` — Modify `src/shared/cohort-builder/contracts.ts`

- **Operation**: `MODIFY`
- **File Path**: `src/shared/cohort-builder/contracts.ts`
- **Action**:
  1. In `cohortWorkspaceSchema.processing`, add:
     ```ts
         sourceFingerprint: z.string().nullable(),
         buildInputFingerprint: z.string().regex(/^[a-f0-9]{64}$/).optional(),
     ```
  2. In `cohortActionSchema`, add:
     ```ts
       z.strictObject({ type: z.literal('open_review') }),
       z.strictObject({ type: z.literal('open_materials') }),
     ```
  3. In `planCohortAction`, add handler for `open_materials`:
     ```ts
       if (action.type === 'open_materials') {
         const current = journey();
         if (current.step === 'published') throw new Error('INVALID_JOURNEY_TRANSITION');
         current.step = 'material_input';
         return navigationResult('Materials opened.');
       }
     ```
  4. In `close_panel` and `return_to_planning` handlers, remove lines resetting `next.processing.status` to `idle` on queued/processing states, preserving the active build in flight.
  5. In `open_review` handler, enforce:
     ```ts
       if (next.sources.length && !isBuildComplete(next)) throw new Error('ASSEMBLY_NOT_READY');
     ```
  6. In `start_goal_generation`, update `requireStep`:
     ```ts
     const current = requireStep('goal_setup', 'material_input', 'chat', 'review', 'discovery');
     ```

---

### Step `S7` — Modify `src/shared/cohort-builder/readiness.ts`

- **Operation**: `MODIFY`
- **File Path**: `src/shared/cohort-builder/readiness.ts`
- **Action**:
  1. Import `isBuildComplete` from `./creation-state`.
  2. In `validateCohortReadiness`:
     ```ts
       const buildComplete = sources.length === 0 || isBuildComplete(workspace);
       if (!buildComplete) blockers.push('Build output is incomplete or outdated. Rebuild before release.');
     ```
  3. Update `checks.processingComplete`:
     ```ts
       processingComplete: buildComplete && !isProcessingFailed && !isProcessingActive,
     ```

---

### Step `S8` — Modify `src/server/domain/cohort-builder/text-job-status.ts`

- **Operation**: `MODIFY`
- **File Path**: `src/server/domain/cohort-builder/text-job-status.ts`
- **Action**:
  1. Update SQL query limit from `LIMIT 101` to `LIMIT 505`:
     ```ts
     `SELECT "id", "sourceId", "stage", "status", "attempts", "errorCode"
       FROM "cohort_text_jobs" WHERE "workspaceId" = $1 AND "jobKey" = ANY($2::text[])
       ORDER BY "createdAt", "id" LIMIT 505`
     ```

---

### Step `S9` — Modify `src/client/screens/cohortBuilder/stages/ReadyStageView.tsx`

- **Operation**: `MODIFY`
- **File Path**: `src/client/screens/cohortBuilder/stages/ReadyStageView.tsx`
- **Action**:
  1. Replace `handleBack`:
     ```ts
       const handleBack = async () => {
         await dispatchAction({ type: 'open_materials' });
       };
     ```
  2. Update primary action button text from `'Go to my feed'` to `'Review and activate'`.

---

### Step `S10` — Delete `src/client/screens/cohortBuilder/stages/GoalStageView.tsx`

- **Operation**: `DELETE`
- **File Path**: `src/client/screens/cohortBuilder/stages/GoalStageView.tsx`
- **Action**: Remove file.

---

### Step `S11` — Delete `src/client/screens/cohortBuilder/stages/GoalStageView.module.css`

- **Operation**: `DELETE`
- **File Path**: `src/client/screens/cohortBuilder/stages/GoalStageView.module.css`
- **Action**: Remove file.

---

### Step `S12` — Update `src/shared/cohort-builder/__tests__/creation-machine.test.ts`

- **Operation**: `MODIFY`
- **File Path**: `src/shared/cohort-builder/__tests__/creation-machine.test.ts`
- **Action**: Remove `deriveCreationMachineState` imports and calls; assert directly on `isBuildComplete(readyWs)`, `isBuildStale(readyWs)`, and `validateWorkspaceInvariants(readyWs).valid`.

---

### Step `S13` — Update `src/client/screens/cohortBuilder/__tests__/journey-checkpoint4-branch.test.tsx`

- **Operation**: `MODIFY`
- **File Path**: `src/client/screens/cohortBuilder/__tests__/journey-checkpoint4-branch.test.tsx`
- **Action**: Remove `GoalStageView` import and the `describe('GoalStageView', ...)` test suite for the deleted component.

---

### Step `S14` — Update `src/shared/cohort-builder/__tests__/journey-actions.test.ts`

- **Operation**: `MODIFY`
- **File Path**: `src/shared/cohort-builder/__tests__/journey-actions.test.ts`
- **Action**: Update `close_panel` test title and expectation to assert that `plan.nextState.processing` equals `ws.processing` (preserving active build state).

---

### Step `S15` — Create `src/shared/cohort-builder/__tests__/creation-cleanup.test.ts`

- **Operation**: `CREATE`
- **File Path**: `src/shared/cohort-builder/__tests__/creation-cleanup.test.ts`
- **Action**: Create file with complete tests covering:
  1. Stale content and preference rejection at both UI and release boundaries.
  2. Legacy snapshot compatibility without synthetic inputs.
  3. Preserved active processing across `close_panel`, `return_to_planning`, and `open_materials`.
  4. Unified progress agreement across `deriveStageProgress` and `deriveProcessingProgress`.
  5. Rejection of invalid/omitted accepted sources in `projectAcceptedBuildCompletion`.
  6. 100-source job graph retrieval (505 limit).

---

### Step `S16` — Update Test Fixtures for Exact Evidence Matching

- **Operation**: `MODIFY`
- **Target Files**:
  - `src/client/screens/cohortBuilder/__tests__/ready-stage-view.test.tsx`
  - `src/client/screens/cohortBuilder/__tests__/stage-canonical-progress.test.ts`
  - `src/client/screens/cohortBuilder/__tests__/stage-selectors.test.ts`
  - `src/client/screens/cohortBuilder/__tests__/ReleasePanel.test.tsx`
  - `src/server/domain/cohort-builder/__tests__/journey-checkpoint2-integration.test.ts`
  - `src/server/domain/cohort-builder/__tests__/journey-checkpoint4-integration.test.ts`
  - `src/server/domain/cohort-builder/__tests__/journey-checkpoint5-integration.test.ts`
  - `src/server/domain/cohort-builder/__tests__/journey-checkpoint6-acceptance.test.ts`
- **Action**:
  1. In `ready-stage-view.test.tsx`, `stage-canonical-progress.test.ts`, and `stage-selectors.test.ts`: ensure `createTestWorkspace` sets `workspace.processing.sourceFingerprint = computeSourceEvidenceFingerprint(workspace)` when `status === 'ready'`. Update back navigation assertions to expect `{ type: 'open_materials' }`.
  2. In `journey-checkpoint2-integration.test.ts`, update test 6 (lines 898-899):
     - Replace:
       ```ts
           expect(goalPlan.nextState.journey?.step).toBe('goal_setup');
           expect(goalPlan.nextState.journey?.branch).toBe('have_goal');
       ```
     - With:
       ```ts
           expect(goalPlan.nextState.journey?.step).toBe('discovery');
           expect(goalPlan.nextState.journey?.branch).toBe('find_material');
       ```
  3. In `journey-checkpoint4-integration.test.ts`, update test 2 (lines 647-648):
     - Replace:
       ```ts
           expect(ws.journey?.step).toBe('goal_setup');
           expect(ws.journey?.branch).toBe('have_goal');
       ```
     - With:
       ```ts
           expect(ws.journey?.step).toBe('discovery');
           expect(ws.journey?.branch).toBe('find_material');
       ```
  4. In `journey-checkpoint6-acceptance.test.ts`, update Branch 3 (line 914):
     - Replace:
       ```ts
             expect(ws.journey?.step).toBe('goal_setup');
       ```
     - With:
       ```ts
             expect(ws.journey?.step).toBe('discovery');
       ```
  5. In `journey-checkpoint5-integration.test.ts`:
     - Set `sourceFingerprint: computeSourceEvidenceFingerprint(readyWs)` on `readyWs` (around line 200) and on `reviewWs` (around line 300) so strict evidence verification in `isBuildComplete` and `validateCohortReadiness` succeeds.
  6. In `ReleasePanel.test.tsx`:
     - On `restrictedWorkspace`, set `processing: { status: 'ready', stage: 'done', generation: 0, sourceFingerprint: computeSourceEvidenceFingerprint(restrictedWorkspace), error: null }` so private mode activation is valid while public publishing restrictions are verified.

---

## E. Verification and Failure Handling

Execute the following verification commands from `D:/ThisPC/Documents/SideQuestHQ/undone-site` in PowerShell in strict order.

### `V1` — New Creation Cleanup Invariants Unit Suite
```powershell
npx vitest run src/shared/cohort-builder/__tests__/creation-cleanup.test.ts
```
- **Expected Result**: Exit code `0`, all tests pass.

### `V2` — Targeted State Machine, Pipeline, Progress, and UI Suites
```powershell
npx vitest run src/shared/cohort-builder/__tests__/creation-cleanup.test.ts src/shared/cohort-builder/__tests__/creation-machine.test.ts src/shared/cohort-builder/__tests__/client-pipeline.test.ts src/client/screens/cohortBuilder/__tests__/stage-canonical-progress.test.ts src/client/screens/cohortBuilder/__tests__/ready-stage-view.test.tsx src/server/domain/cohort-builder/__tests__/text-assembly-acceptance.test.ts src/client/screens/cohortBuilder/__tests__/stage-selectors.test.ts
```
- **Expected Result**: Exit code `0`, all 7 test files pass with 0 failures.

### `V3` — TypeScript Typecheck
```powershell
npx tsc --noEmit --incremental false
```
- **Expected Result**: Exit code `0`, 0 errors.

### `V4` — ESLint Check on Modified Files
```powershell
npx eslint src/shared/cohort-builder/creation-progress.ts src/shared/cohort-builder/creation-state.ts src/shared/cohort-builder/creation-machine.ts src/shared/cohort-builder/creation-view.ts src/client/screens/cohortBuilder/stage-selectors.ts src/shared/cohort-builder/contracts.ts src/shared/cohort-builder/readiness.ts src/server/domain/cohort-builder/text-job-status.ts src/client/screens/cohortBuilder/stages/ReadyStageView.tsx src/shared/cohort-builder/__tests__/creation-cleanup.test.ts
```
- **Expected Result**: Exit code `0`, 0 errors, 0 warnings.

### `V5` — Git Diff Cleanliness & Production Line Count Verification
```powershell
git diff --check
node -e "const { execSync } = require('child_process'); const diff = execSync('git diff --numstat HEAD').toString(); console.log(diff);"
```
- **Expected Result**: `git diff --check` exits `0`; diff confirms net production reduction of ~1,200 lines.

### `V6` — Full 5-Stage Vercel Deployment Verification
```powershell
npm run verify:vercel
```
- **Expected Result**: Exit code `0`, passing Submodules, Internal Packages, Prisma generation, TypeScript check, and Webpack Production Build Simulation generating all 50/50 static routes.

### Failure Handling Protocol
- **Target Mismatch**: If any anchor in `S2`–`S9` does not match, inspect line endings and verify the file SHA-256 against Section C. Do not guess replacements.
- **Typecheck Failure**: Check import paths for `creation-progress.ts` and ensure all deleted types were properly removed from consuming test files.
- **Test Failure**: If a test fails on `isBuildComplete(workspace) === false`, inspect whether the test fixture manually edited `sources` or `lessons` without calling `computeSourceEvidenceFingerprint` or simulating a rebuild.

---

## F. Completion Report Contract

Upon completing execution of this guide, the implementing agent must return a structured report containing:

1. **Execution Status**: `COMPLETE` or `BLOCKED` (with failing step ID if blocked).
2. **Net Line Count Delta**: Total lines of production code removed vs added (confirming ~1,200 lines eliminated).
3. **Step Application Table**: Status (`APPLIED` / `SKIPPED` / `FAILED`) for each step `S1` through `S16`.
4. **Verification Results Table**: Exit code, duration, and summary for `V1`, `V2`, `V3`, `V4`, `V5`, and `V6`.
5. **Requirement Coverage Confirmation**: Confirmation that `C1` through `C8` are satisfied with test counts.
6. **Unplanned Deviations**: Explicit `None` (or exact description if any recovery was required).
