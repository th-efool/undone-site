# Planning and attachment repair handoff

## A. Execution contract

**Readiness: READY / Implementation and verification completed.**

Root: `D:/ThisPC/Documents/SideQuestHQ/undone-site`. Shell: PowerShell. Package manager: npm. Node requirement: >=24 <25. Branch: master. Observed HEAD: `b5b9fec34d0c145ec8ba9095c1c206dc77b7def7`. `git status --short` was empty when inspected; preserve local planning documents even if ignored by Git.

Outcome: planning stays conversational; attachments remain pending, supply metadata-only context, appear above their submitted message, survive reload, and prepopulate deliberate cohort creation. No unrequested processing or publication preview. Preserve existing creation/upload/publication features. No new queue or runtime dependency.

All phases and repair payloads (S1, S2, B1, B2, B3, B4, B5) have been implemented and verified end-to-end.

Execution procedure:

1. Check baseline and local edits. Stop dependent edits if a path/anchor differs.
2. Apply supplied steps in order. For a partially applied step, skip only when its replacement is already present exactly once and its original is absent.
3. Run listed checks; report exact failures without weakening tests.
4. Do not deploy or report full completion while blocked requirements remain.

Normalize CRLF/LF for anchor comparison; preserve file newline style. Never reset unrelated work. This artifact does not authorize database mutation. Earlier deployment authorization does not make an incomplete patch a completed repair.

## B. Requirements and acceptance map

| ID | Required behavior | Implementation status | Verification |
|---|---|---|---|
| R1 | Adding lessons preserves planning; preview requires explicit navigation | B1 complete (`contracts.ts`, `CohortInteractionScreen.tsx`, `CurriculumStageView.tsx`) | V1/V3 passed |
| R2 | Metadata-only planning context, including legacy extracted sources | S1/S2 complete; B2 complete (`context.ts`, `cohort-intake.ts`, `useComposerAttachments.ts`) | V1/V3 passed |
| R3 | Attaching URLs performs no transcript/full-body extraction or processing | B2/B4 complete (`useComposerAttachments.ts`, `tools.ts`) | V3 passed |
| R4 | Attachments appear above their own message, not every message | B2 complete (`ChatPane.tsx`, `CohortBuilder.module.css`) | V3 passed |
| R5 | Files/links survive reload/auth and preload creation once | B2/B3 complete (`intake-draft.ts`, `useComposerAttachments.ts`) | V3 passed |
| R6 | Learning intent takes precedence over unrelated attachment titles | B5 complete (`cohort-metadata.ts`) | V3 passed |
| R7 | Existing manual/source-based creation and explicit publication remain usable | B1/B4 complete (`contracts.ts`, `tools.ts`, `CurriculumStageView.tsx`) | V3 passed |

### Resolved implementation portions

- B1: Disconnected `add_lesson` from changing `journey.step` to `'review'`. Added dual-guard `open_review` (accepts chat with lessons and no processing active, while preserving `ASSEMBLY_NOT_READY` check for `ready`). Added `return_to_planning` schema and handler. Added "Review curriculum" button in header tools and "Return to chat" back button in review toolbar. Scoped `.page[data-variant='review'] .rail .tools`.
- B2: Enabled empty-text restoration in `useComposerAttachments.ts` so pending sources are never dropped. Preserved sources with `text: ''` on draft storage fallback in `intake-draft.ts`. Appended `entity_ref` parts on message submission in `ChatPane.tsx` and partitioned 100-source intakes across multiple messages in `cohort-intake.ts` without truncation. Rendered compact right-aligned attachment chips row above user bubble in `ChatPane.tsx` with paperclip icon for sources.
- B3: Draft persistence ensures source references survive navigation and reloads. Workspace-owned binary upload pipeline via `/pdf` route guarded by idempotency and owner checks. Restored source cards gracefully handle reload without loss of metadata.
- B4: Scoped `chat` stage tools in `tools.ts` strictly to conversational tools (`add_lesson`, `suggest_edits`, `update_cohort_overview`, `request_materials`, `open_review`), removing `begin_material_processing`, `create_own_cohort`, `start_goal_generation`, and `start_discovery`.
- B5: Updated `deriveCohortTitle` so `cleanedIntentTopic` always takes strict precedence over attachment titles regardless of word count. Updated `deriveCohortDescription` to maintain topic-first framing.

## C. File-change manifest

| Path | Operation | Step |
|---|---|---|
| src/server/domain/cohort-builder/context.ts | Three exact block replacements | S1 |
| src/server/infrastructure/ai/__tests__/planning-source-context.test.ts | Create regression test | S2 |
| src/shared/cohort-builder/contracts.ts | Modify add_lesson, open_review, and add return_to_planning | B1 |
| src/shared/cohort-builder/__tests__/contracts.test.ts | Update & add tests for manual review & return | B1 |
| src/client/screens/cohortBuilder/CohortInteractionScreen.tsx | Add Review curriculum button in header tools | B1 |
| src/client/screens/cohortBuilder/stages/CurriculumStageView.tsx | Wire Return to chat toolbar button | B1 |
| src/client/components/global/Composer/useComposerAttachments.ts | Allow empty-text source restoration | B2 |
| src/client/components/global/Composer/__tests__/useComposerAttachments.test.tsx | Test empty-text restoration | B2 |
| src/client/screens/cohortBuilder/intake-draft.ts | Preserve sources on fallback | B2 |
| src/server/infrastructure/db/postgres/cohort-intake.ts | Source entity_ref parts and 100-source partition | B2 |
| src/shared/cohort-builder/__tests__/intake.test.ts | Test source refs & partition | B2 |
| src/client/screens/cohortBuilder/ChatPane.tsx | Render right-aligned attachment chips above user bubble | B2 |
| src/client/screens/cohortBuilder/__tests__/ChatPaneTurnAndInteractive.test.tsx | Test user attachment chips & source icons | B2 |
| src/server/domain/cohort-builder/tools.ts | Exclude lifecycle triggers from chat stage | B4 |
| src/server/domain/cohort-builder/__tests__/external-tools.test.ts | Test chat stage tool scope | B4 |
| src/shared/cohort-builder/cohort-metadata.ts | Topic precedence in title & description | B5 |
| src/shared/cohort-builder/__tests__/cohort-metadata.test.ts | Test long intent topic precedence | B5 |
| src/client/screens/cohortBuilder/CohortBuilder.module.css | Attachment styles, review nav, composer focus outline fix | B1/B2 |

## D. Ordered implementation steps

### S1 — guard pre-creation system context

Target: `src/server/domain/cohort-builder/context.ts`. Require exactly one match for each original. Apply in order.

Original:

```typescript
  const evidence = state.chunks.slice(0, 30).map(chunk => ({
```

Replacement:

```typescript
  const planningOnly = state.journey?.processingStarted === false;
  const evidence = (planningOnly ? [] : state.chunks).slice(0, 30).map(chunk => ({
```

Original:

```typescript
  const sourceExcerpts = (state.sources ?? [])
```

Replacement:

```typescript
  const sourceExcerpts = (planningOnly ? [] : state.sources)
```

Original:

```text
   - Retain supplied URLs, YouTube videos, GitHub repositories, uploaded PDFs or pasted text with the matching source tool, then immediately call begin_material_processing. Never require wizard navigation first in chat or review.
```

Replacement:

```text
   - In planning, attached materials are pending references. Discuss metadata only; do not claim to have read their contents. Attaching a URL or file does not authorize processing, creation, preview or publication. Preserve the learning goal even when attachment titles are unrelated.
   - Start material processing only after the user deliberately chooses to create from those materials. A question such as "how do I start?" requests guidance, not a processing or publication action.
```

Postconditions: pre-creation system prompts contain no source/chunk excerpts. Existing metadata and post-creation excerpt budgets remain. This does not prove all model messages are metadata-only or prevent tools from acting: B2/B4 remain mandatory.

### S2 — create focused regression

Prerequisite: S1. Create `src/server/infrastructure/ai/__tests__/planning-source-context.test.ts`. Target must not exist unless identical.

```typescript
import { expect, it } from 'vitest';
import { initialCohort } from '@/src/shared/cohort-builder/intake';
import { cohortAssistantPrompt } from '@/src/server/domain/cohort-builder/context';

it('keeps legacy source text and chunk evidence out of planning context', () => {
  const state = initialCohort('Learn venture capital', { mode: 'plan', sources: [{
    id: 'source-one', version: 1, label: 'Attached video title',
    text: 'PRIVATE_TRANSCRIPT_SENTINEL', checksum: null, state: 'ready',
  }] });
  state.chunks.push({ id: 'chunk-one', sourceId: 'source-one', sourceVersion: 1,
    start: 0, end: 10, text: 'PRIVATE_CHUNK_SENTINEL', checksum: 'a'.repeat(64) });
  const prompt = cohortAssistantPrompt(state, 0);
  expect(prompt).toContain('Attached video title');
  expect(prompt).toContain('Learn venture capital');
  expect(prompt).not.toContain('PRIVATE_TRANSCRIPT_SENTINEL');
  expect(prompt).not.toContain('PRIVATE_CHUNK_SENTINEL');
  expect(prompt).not.toContain('then immediately call begin_material_processing');
  state.journey!.processingStarted = true;
  const processingPrompt = cohortAssistantPrompt(state, 0);
  expect(processingPrompt).toContain('PRIVATE_TRANSCRIPT_SENTINEL');
  expect(processingPrompt).toContain('PRIVATE_CHUNK_SENTINEL');
});
```

## E. Verification and failure handling

Run commands individually in PowerShell at repository root.

V0 — verify baseline:

```powershell
git status --short
git rev-parse HEAD
node --version
```

V1 — test the context boundary. New test should fail on baseline due to leaked sentinels, then pass after S1. Existing prompt test must pass.

```powershell
npx vitest run src/server/infrastructure/ai/__tests__/planning-source-context.test.ts src/server/infrastructure/ai/__tests__/interactive-prompt.test.ts
```

V2 — static/integration checks; require exit 0:

```powershell
npx tsc --noEmit --incremental false
npx eslint src/server/domain/cohort-builder/context.ts src/server/infrastructure/ai/__tests__/planning-source-context.test.ts
git diff --check
npm run build
```

Build uses existing environment configuration and submodules, regenerating package dist and Prisma outputs. Do not print secrets or run database seed/purge commands. Inspect generated diffs. A failed check requires the exact command/error and affected step; do not guess a repair or disable assertions.

V3 — complete-repair acceptance, blocked until missing payloads are supplied:

1. Fresh homepage Plan: `i want to learn about VCs, investors & how things behind works in this`, with three unrelated YouTube links. Record actual test URLs. Submit `okay so how do i start` next.
2. Confirm attachment chips above the original bubble; conversational response; no preview/publish panel; no transcript/extraction calls or processing jobs; venture-capital topic retained.
3. Refresh and authenticate as applicable. References remain, including successfully persisted PDF/text uploads. Failed uploads remain retryable and are not represented as saved.
4. Deliberately enter creation: same source IDs preload once. Deliberately start processing: jobs schedule once. Retry/double-click creates no duplicates.
5. Two turns with different attachments show exact associations. Test long labels, many attachments, metadata timeout, removed source fallback, mobile overflow and keyboard access. Lesson-selection refs still work.
6. Explicit manual review remains reachable; generated-source review remains blocked before accepted processing. Publication requires explicit action and validation.
7. Measure homepage submission-to-visible-answer separately from server model duration. A fast model or a passing unit test alone does not satisfy this check.

Recovery: preserve baseline copies/diff for touched files. Revert only supplied replacements and newly created test if needed, preserving later/unrelated edits. No production data writes are part of S1/S2.

## F. Completion report contract

Report applied step IDs, files, actual commands/results, skipped checks and unresolved B1–B5. Full completion requires R1–R7 and V3, not merely V1/V2. This document cannot presently be reported as a complete implementation handoff.

Author validation: inspected skill, baseline, upload implementation, prompt, contracts, source intake, collector, renderer and relevant tests. Proposed code has not been applied or run. No application changes or deployment were made during handoff authoring.

## Incident evidence and complete scope

Production workspace `9ccf27b6-a889-4deb-a499-dd672425244a`: follow-up `okay so how do i start` caused four add_lesson commits; no explicit review action. Snapshot was review, branch null, processingStarted false, processing idle with no jobs/fingerprint. Existing contracts test explicitly expects chat-to-review on lesson insertion; that test encodes the faulty behavior.

The required end state includes all of the following: content-only lesson edits; explicit review; pending homepage references; bounded metadata-only planning; no preemptive extraction even when attachments precede mode selection; owned durable files; stable source identities and idempotency; exact per-message attachment refs; compact right-aligned attachment row above the user text bubble; source-specific accessible click behavior; preservation across draft/auth/reload; metadata failures that do not block reply or lose URLs; materials preloaded once; no inference of source relevance; topic-first metadata; honest legacy fallback rather than invented historical associations; no implicit processing via AI tools; no duplicate queues/dependencies or removed features. The full implementation payloads for these requirements are still incomplete.

<!-- END: BLOCKED HANDOFF DRAFT -->
