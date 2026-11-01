# IdiotHandOffManager Status Ledger

## 1. Guide Identification & Baseline

- **Guide ID**: G1
- **Guide File**: `D:\ThisPC\Documents\SideQuestHQ\undone-site\IdiotHandOffGuide.md`
- **Guide SHA256**: `F22BDD535982E797096D828C83BD60EF7F0DE0D29CF5E466B608C85F32BA8E5A`
- **Guide Stated Readiness**: READY / Authoring and repair completed.
- **Repository Root**: `D:\ThisPC\Documents\SideQuestHQ\undone-site`
- **Baseline Git HEAD**: `b5b9fec34d0c145ec8ba9095c1c206dc77b7def7`
- **Node Version**: `v24.14.1` (satisfies `>=24 <25`)

## 2. Work Items & Dependency Graph

| Item ID | Description | Predecessors | Read Set | Exclusive Write Set | Owner | State | Evidence |
|---|---|---|---|---|---|---|---|
| G1/S1 | Guard pre-creation system context | Baseline | `src/server/domain/cohort-builder/context.ts` | `src/server/domain/cohort-builder/context.ts` | Worker-1 (`Domain-Context-Engineer`) | verified | Applied exact replacements. Excluded chunks & source excerpts when `processingStarted === false`. Verified in `git diff`. |
| G1/S2 | Create focused regression test | G1/S1 | `src/server/domain/cohort-builder/context.ts` | `src/server/infrastructure/ai/__tests__/planning-source-context.test.ts` | Worker-1 (`Domain-Context-Engineer`) | verified | Created regression test. Vitest passed (1/1 test passed). |
| G1/V0 | Baseline verification | Baseline | Repository root | None (Read-only) | Manager | verified | Git HEAD `b5b9fec34d0c145ec8ba9095c1c206dc77b7def7`, Node `v24.14.1`, baseline prompt test passed. |
| G1/V1 | Planning context test execution | G1/S1, G1/S2 | Test files | None | Manager | verified | Vitest passed for `planning-source-context.test.ts` and `interactive-prompt.test.ts` (exit code 0). |
| G1/V2 | Static & build integration checks | G1/V1 | Codebase | Build output | Manager | verified | `tsc --noEmit` passed (exit 0); `eslint` passed (exit 0); `git diff --check` clean (exit 0); `npm run build` succeeded (exit 0). |
| G1/B1 | Lesson addition & explicit review stage | G1/V2 | `contracts.ts`, `CohortInteractionScreen.tsx`, `CurriculumStageView.tsx`, `CohortBuilder.module.css` | Same | Manager | verified | Disconnected `add_lesson` from changing `journey.step` to `'review'`. Added dual-guard `open_review` (accepts chat with lessons and no processing active, while preserving `ASSEMBLY_NOT_READY` check for `ready`). Added `return_to_planning` schema and handler. Added "Review curriculum" button in header tools and "Return to chat" back button in review toolbar. Scoped `.page[data-variant='review'] .rail .tools`. Tested in `contracts.test.ts` (16/16 passed). |
| G1/B2 | Source metadata persistence & rendering | G1/B1 | `intake.ts`, `intake-draft.ts`, `cohort-intake.ts`, `ChatPane.tsx`, `useComposerAttachments.ts` | Same | Manager | verified | Enabled empty-text restoration in `useComposerAttachments.ts` so pending sources are never dropped. Preserved sources with `text: ''` on draft storage fallback in `intake-draft.ts`. Appended `entity_ref` parts on message submission in `ChatPane.tsx` and partitioned 100-source intakes across multiple messages in `cohort-intake.ts` without truncation. Rendered compact right-aligned attachment chips row above user bubble in `ChatPane.tsx` with paperclip icon for sources. Tested in `useComposerAttachments.test.tsx` (5/5 passed), `intake.test.ts` (12/12 passed), and `ChatPaneTurnAndInteractive.test.tsx` (11/11 passed). |
| G1/B3 | Attachment durable storage & reload | G1/B2 | `cohort-pdf-upload.ts`, `intake-draft.ts`, `ChatPane.tsx` | Same | Manager | verified | Draft persistence ensures source references survive navigation and reloads. Workspace-owned binary upload pipeline via `/pdf` route guarded by idempotency and owner checks. Restored source cards gracefully handle reload without loss of metadata. |
| G1/B4 | Material processing authorization gate | G1/B3 | `tools.ts`, `ChatPane.tsx` | Same | Manager | verified | Scoped `chat` stage tools in `tools.ts` strictly to conversational tools (`add_lesson`, `suggest_edits`, `update_cohort_overview`, `request_materials`, `open_review`), removing `begin_material_processing`, `create_own_cohort`, `start_goal_generation`, and `start_discovery`. Tested in `external-tools.test.ts` (13/13 passed). |
| G1/B5 | Intent precedence over attachment titles | G1/B4 | `cohort-metadata.ts` | `cohort-metadata.ts` | Manager | verified | Updated `deriveCohortTitle` so `cleanedIntentTopic` always takes strict precedence over attachment titles regardless of word count. Updated `deriveCohortDescription` to maintain topic-first framing. Tested in `cohort-metadata.test.ts` (7/7 passed). |
| G1/V3 | Full end-to-end acceptance | B1-B5 | Test suites & build system | None | Manager | verified | Vitest 8/8 test suites (72/72 tests) passed. `tsc --noEmit --incremental false` passed with 0 errors. `eslint` clean on target files. `git diff --check` clean. `npm run build` succeeded with 50/50 static/dynamic routes compiled. Focus-visible outline on composer textarea fixed. |

## 3. Phase Schedule & Verification Log

- **Phase 1 (Complete)**: S1 & S2 implementation, V1 context test verification, V2 static and full build gates.
- **Phase 2 (Complete - B1)**: Manual Review & Preserved Planning:
  - Disconnect `add_lesson` from changing `journey.step` to `'review'`.
  - Extend `open_review` with dual guard:
    - If `step === 'ready'`: enforce `ASSEMBLY_NOT_READY` check (preserving source-generated readiness guards).
    - If `step === 'chat'`: require `lessons.length > 0` and no active processing (`PROCESSING_ACTIVE`), set `current.step = 'review'`.
  - Add `return_to_planning` action schema & handle in `contracts.ts` (alias to `close_panel`).
  - Add explicit "Review curriculum" button in `CohortInteractionScreen.tsx` header when in chat and lessons exist.
  - Wire `.backBtn` ("Return to chat") in `CurriculumStageView.tsx` toolbar.
  - Ensure `.canvasHeader .tools` is not suppressed in review mode in `CohortBuilder.module.css`.
  - Update `contracts.test.ts` to assert that `add_lesson` keeps `journey.step === 'chat'`, and explicit `open_review` is required to open review.
  - Run verification suite.
- **Phase 3 (Complete - B2 & B3)**: Source metadata persistence, durable reload & message rendering:
  - Empty-text restoration in `useComposerAttachments.ts`.
  - Source metadata retained on draft storage fallback in `intake-draft.ts`.
  - `entity_ref` part generation on message submission and 100-source chunking in `cohort-intake.ts`.
  - Right-aligned attachment chips row above user bubble in `ChatPane.tsx`.
  - Focus-visible outline conflict resolved in `CohortBuilder.module.css` for composer textarea.
- **Phase 4 (Complete - B4 & B5)**: Tool boundaries & Intent metadata precedence:
  - Chat tools restricted to conversational tools in `tools.ts`.
  - Topic-first title and description derivation in `cohort-metadata.ts` regardless of prompt length.
- **Phase 5 (Complete - V3)**: Full End-to-End Verification:
  - Vitest: 8 test files, 72 tests passed.
  - TypeScript: `npx tsc --noEmit --incremental false` exited 0.
  - ESLint: exited 0 on target files.
  - Git diff check: clean (exit 0).
  - Production build: `npm run build` exited 0 with all packages and Next.js routes generated.
