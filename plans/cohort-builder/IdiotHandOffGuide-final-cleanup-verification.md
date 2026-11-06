# Cohort creation cleanup: current-baseline closure handoff

## A. Execution contract

Readiness: READY for verification and documentation closure. This is a current-baseline handoff, not permission to replay the interrupted 2026-11-01 draft. Root D:/ThisPC/Documents/SideQuestHQ/undone-site; PowerShell; Node24/npm. Observed HEAD 95b635f7. Preserve all existing studyroom and messaging changes and the homepage layering repair. Never reset the checkout or regenerate Prisma over unrelated changes just to run these checks.

The previously interrupted cleanup has since been implemented in this checkout. Verified source postconditions: creation-progress.ts exists; isBuildComplete compares current evidence fingerprints; processing has optional buildInputFingerprint; the unused CreationMachineState mirror is gone; retired GoalStageView.tsx is absent; open_materials exists; old duplicate progress functions are absent. These are observed source facts, not proof of every runtime guarantee.

Sequence: confirm these postconditions; run the exact gates below; append the supplied memory entry only when absent; execute browser acceptance; record actual results in section F of this file. Stop on missing/mismatched postconditions instead of restoring outdated files. No application replacement payload is required for the already-applied changes. Do not mark overall release verified if any required gate is skipped or fails. No deployment is authorized by this guide.

## B. Requirements and acceptance map

| Requirement | Authoritative owner | Verification |
|---|---|---|
| One progress computation for stepper and detailed stages | creation-progress.ts#deriveStageProgress | V1, V2, V4 |
| Ready output matches current evidence and recorded build inputs | creation-state.ts#isBuildComplete | V1, V2 |
| Fast and durable completion share acceptance projection | creation-machine.ts#projectAcceptedBuildCompletion | V2 |
| Navigation preserves build and materials | contracts.ts open_materials/close_panel | V1, V4 |
| Deleted legacy UI is not restored | no GoalStageView; merged discovery | V0, V4 |
| Large source sets retain complete job projection | text-job-status.ts | creation-cleanup.test.ts, V2 |
| Release requires validated current output and durable receipt | readiness.ts and server release services | V2, V4 |
| Documentation reflects actual ownership | MEMORY/cohort-builder-processing.md | S1 |

Do not equate line count with correctness. Compare production files separately from tests/docs and record both. Compatibility decoders for persisted data and backend generated-guide support are intentional; deleting them would remove supported behavior. Historical snapshots without a recorded build-input fingerprint cannot prove historic audience/pace equality: preserve this explicit compatibility limit rather than fabricate evidence.

## C. File-change manifest

- MODIFY MEMORY/cohort-builder-processing.md, S1 append only if absent.
- MODIFY this handoff's section F after execution, actual results only.
- No package, lockfile, schema, source-file replacement or migration is specified. Any new production defect discovered by the gates requires a separately reviewed exact patch and rerun of affected checks; this handoff is not authorization to improvise a broad rewrite.

## D. Ordered steps

### S0 / V0: validate current implementation

Working directory repository root, PowerShell:

```powershell
git rev-parse HEAD
git status --short
rg -n 'deriveStageProgress' src/shared/cohort-builder/creation-progress.ts src/shared/cohort-builder/creation-view.ts src/client/screens/cohortBuilder/stage-selectors.ts
rg -n 'buildInputFingerprint|computeSourceEvidenceFingerprint' src/shared/cohort-builder/creation-state.ts src/shared/cohort-builder/creation-machine.ts src/shared/cohort-builder/contracts.ts
rg -n 'open_materials' src/shared/cohort-builder/contracts.ts src/client/screens/cohortBuilder/stages/ReadyStageView.tsx
Test-Path src/client/screens/cohortBuilder/stages/GoalStageView.tsx
rg -n 'deriveCreationMachineState|function computeIsStageComplete|function computeStageProgressDetails|LIMIT 101' src/shared/cohort-builder src/client/screens/cohortBuilder/stage-selectors.ts src/server/domain/cohort-builder/text-job-status.ts -g '!**/__tests__/**'
```

Expected: current baseline identified, shared progress imports present, fingerprint comparisons/stamping present, one direct materials command, Test-Path false. Last rg must have no production matches (exit 1 is correct). If it finds anything, inspect the exact match and stop closure; do not blindly delete entire modules. Preserve source version/lease checks, transaction acceptance and release receipts.

### S1: document authoritative ownership

Target MEMORY/cohort-builder-processing.md. Action: insert the complete following paragraph at EOF, once. If it already exists verbatim, skip. Existing file contents must remain unchanged.

```markdown

- Creation lifecycle: `src/shared/cohort-builder/creation-state.ts` owns current build completeness/staleness; `creation-machine.ts#projectAcceptedBuildCompletion` is shared by fast and durable completion; `creation-progress.ts#deriveStageProgress` feeds both `creation-view.ts` and the client stage-selector compatibility adapters. `contracts.ts#open_materials` changes navigation without resetting jobs. `processing.buildInputFingerprint` is optional for historical snapshots; new accepted builds record it. Do not restore the deleted `GoalStageView` or the unused parallel `CreationMachineState` mirror. Verify with `creation-cleanup.test.ts`, `creation-machine.test.ts`, stage-selector/progress tests and durable assembly/release tests.
```

Postcondition: exactly one ownership paragraph; no copied logs/secrets.

## E. Verification and failure handling

### V1: focused architectural regression

```powershell
npx vitest run src/shared/cohort-builder/__tests__/creation-cleanup.test.ts src/shared/cohort-builder/__tests__/creation-machine.test.ts src/client/screens/cohortBuilder/__tests__/stage-canonical-progress.test.ts src/client/screens/cohortBuilder/__tests__/stage-selectors.test.ts src/client/screens/cohortBuilder/__tests__/ready-stage-view.test.tsx
```

Expected exit zero; no skip/todo additions. This verifies fingerprint freshness, navigation preservation, full job graph projection, progress consistency and readiness interaction. Author ran this exact set on 2026-11-06: 84 tests passed, zero failures. It does not prove production deployment behavior.

### V2: all cohort domain/UI tests

```powershell
npx vitest run src/shared/cohort-builder/__tests__ src/client/screens/cohortBuilder/__tests__ src/server/domain/cohort-builder/__tests__ --maxWorkers=2
```

Expected exit zero. These use repository fixtures/mocks/local test databases; do not substitute production database credentials or enable real paid provider calls. Record complete failed test names/errors. A pre-existing failure remains a failed gate; label it accurately and do not call closure complete. Preserve independent assertions when correcting outdated fixtures. In particular, do not replace stale fingerprint rejection tests with fixtures that automatically seal mutated input.

### V3: types, build, hygiene and footprint

```powershell
npx tsc --noEmit --incremental false
npm run verify:vercel
git diff --check
git diff 13944cdf HEAD --numstat -- src/shared/cohort-builder src/client/screens/cohortBuilder src/server/domain/cohort-builder
```

Expected type/build/hygiene exit zero. Existing unrelated studyroom modifications may affect global checks; record failing paths and exact errors rather than editing them under this task. Count production additions/deletions separately from tests. Note that the last comparison spans other subsequent cohort work; do not attribute every line to this cleanup. `verify:vercel` runs local build verification, not a production deployment.

### V4: browser lifecycle acceptance

Use the local app and a designated test account. Save workspace IDs and revision/build generation at each step. User-supplied test material should be short retained text or existing accepted evidence to avoid paid provider calls; do not send test messages to other people.

1. Open materials, add a source, start build, open chat and return to materials while work is active. Source IDs, job identity and generation must survive navigation. Navigation alone must not cancel or restart work.
2. Allow completion; stepper, checklist, ready heading and actions must agree. A genuinely fast build may finish immediately; do not add timers to simulate work.
3. Change source content or teaching preferences after completion. The previous output must not activate as current without the required rebuild. Repeat after reload.
4. Fail one acquisition/provider call through browser request interception or existing test adapters. Keep accepted material and input drafts, show an actionable failure, and retry without duplicating sources or committed actions.
5. Stop a build, then deliver its delayed result through the existing controlled worker test adapter. The canceled or superseded result must not resurrect a newer build. The automated lease/acceptance tests are required evidence for this race; a screenshot is insufficient.
6. Review and activate privately. Verify a confirmed release receipt and a real destination before navigation. Retry after a simulated lost response; one release effect/receipt must remain. Public publishing remains a separate explicit action.
7. Test merged goal discovery: save goal, start resource discovery, select specific results, add them to materials. Unselected candidates must not be added. Community cohort search must not be presented as acquired resource material.
8. At desktop and mobile sizes, Back remains actionable during incomplete/failed builds, unsaved chat survives pane switching, and buttons explain blocked state honestly.

If browser authentication or controlled race fixtures are unavailable, report the exact missing prerequisite and retain the gate as outstanding. Do not claim runtime correctness from type checks.

### Author validation limits and homepage work

Author verified current source postconditions and V1 only for cohort closure in this resumed turn. V2–V4 remain executor gates. The earlier interrupted sandbox results are not current-baseline results and must not be copied as current passes.

Homepage is a separate directly implemented CSS repair: central controls above decoration, carousel below decoration, clipped hero boundary, repositioned blue scrap/banner. Browser checked 1600x900, 1440x768 and 390x844; no horizontal overflow; banner text hit-test visible at compact desktop. Four existing landing behavior tests fail on auth destination and inline alert expectations; they are not cohort lifecycle acceptance evidence. Do not edit notification/auth flows just to hide those failures.

## F. Completion report contract

Executor fills this section with: baseline and preserved working changes; V0–V4 actual results; applied S1 or verified preexistence; source/test/doc footprint; browser workspace IDs and sanitized evidence; any failed/skipped gate and its blocker. Completion requires every required gate passing. Until then report `verification incomplete`, not `final error-free architecture`.

Author status: current source audit and 84/84 V1 tests passed; cohort application code unchanged during this resumed turn; broad/build/browser lifecycle closure not claimed.

END OF HANDOFF
