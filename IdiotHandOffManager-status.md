# IdiotHandOffManager Status Ledger

## 1. Guide Identification & Baseline

- **Guide ID**: QA-G2 (Quality Assessment Remediation & UI Polish)
- **Source Assessment**: `D:\ThisPC\Documents\SideQuestHQ\undone-site\IdiotCheckInQualityAssessment.md`
- **Repository Root**: `D:\ThisPC\Documents\SideQuestHQ\undone-site`
- **Baseline Git HEAD**: `0665eb3f`
- **Node Version**: `v24.14.1` (satisfies `>=24 <25`)

## 2. Work Items & Dependency Graph

| Item ID | Description | Predecessors | Read Set | Exclusive Write Set | Owner | State | Evidence |
|---|---|---|---|---|---|---|---|
| UI/COMPOSER | Unified compact composer card, removing divided layout, double highlight, and wasted bottom row | Baseline | `ChatPane.tsx`, `CohortBuilder.module.css` | `ChatPane.tsx`, `CohortBuilder.module.css` | UI-Specialist | complete | Refactored composer to single-row flex layout with inline paperclip, expanding textarea, and send button. Verified with 11/11 tests passing in `ChatPaneTurnAndInteractive.test.tsx` and 10/10 in `shell.test.tsx`. |
| QA/F01 | Remove `commit_release` from AI tools across review/ready/published stages | Baseline | `tools.ts`, `ai-tools-optimization.test.ts` | `tools.ts`, `ai-tools-optimization.test.ts` | Domain-Engineer | complete | Removed `commit_release` from `STAGE_TOOL_NAMES.review`, `ready`, and `published`. Tested with 8/8 tests in `ai-tools-optimization.test.ts`. |
| QA/F02 | Route consolidation: redirect `/create-cohort` to `/quest/start`, update links | Baseline | `create-cohort/page.tsx`, `CommandPalette.tsx`, `ExploreDesktop.tsx` | Same | App-Router-Engineer | complete | Consolidated all creation entry points into canonical `/quest/start`. Preserved metadata for `tab-titles.test.ts`. |
| QA/F03 | Fix Mojibake `â€¢` encoding in web client extractor | Baseline | `webClientExtractor.ts` | `webClientExtractor.ts` | Content-Engineer | complete | Replaced corrupted Mojibake sequence with clean bullet `•`. |
| QA/F04 | Add `'chat'` to `BuilderStage` and state machine selectors | Baseline | `stage-selectors.ts` | `stage-selectors.ts` | State-Engineer | complete | Added `'chat'` to `BuilderStage` union and `computeActiveStage`. Verified with `journey-stages.test.tsx`. |
| QA/F05 | Improve GitHub client extractor resilience and rate limit messaging | Baseline | `githubClientExtractor.ts` | `githubClientExtractor.ts` | Integration-Engineer | complete | Clear user-facing guidance when GitHub unauthenticated API rate limit is reached. |
| QA/F06 | Remove fake `setTimeout` progress timers from publish service | Baseline | `publishService.ts` | `publishService.ts` | Services-Engineer | complete | Removed artificial sleep calls; advances to `publishing` directly. |
| QA/F07 | Delete unused dead hooks (`useQuestline`, `useArchives`, `useEvents`) | Baseline | `src/client/screens/cohort/hooks/` | Same | Cleanup-Specialist | complete | Deleted dead hooks; cleaned up `index.ts` to export only `useCohort`. |
| QA/F08 | Deduplicate `getEffectiveStage` implementation | QA/F04 | `CohortWorkspacePane.tsx`, `stage-selectors.ts` | `CohortWorkspacePane.tsx` | State-Engineer | complete | Re-exported single implementation from `stage-selectors.ts`. Verified with `CohortWorkspacePane.test.tsx`. |
| QA/F09 | Replace `window.location.assign` with Next.js router in intake screen | Baseline | `CohortIntakeScreen.tsx` | `CohortIntakeScreen.tsx` | UI-Specialist | complete | Uses Next.js router push with safe fallback. Verified with `intake-screen.test.tsx`. |
| QA/V0 | Run full test suite | All QA items | All touched test files | Build outputs | Manager | complete | Vitest execution across 22 test files (256 tests) passed with 0 errors. |
| QA/V1 | Run TypeScript & full Next.js production build | QA/V0 | Whole codebase | Dist / .next | Manager | complete | `tsc --noEmit --incremental false` passed with 0 errors; `npm run build` produced optimized production build with 50/50 static routes. |

## 3. Phase Schedule

- **Phase 1: UI Polish (UI/COMPOSER)**: [COMPLETE] Modernize the chat composer into a sleek, unified, single-row card.
- **Phase 2: Security & State Invariants (QA/F01, QA/F04, QA/F08)**: [COMPLETE] Purge `commit_release` from AI tools and fix `BuilderStage` type gaps and duplication.
- **Phase 3: Route & Navigation Unification (QA/F02, QA/F09)**: [COMPLETE] Redirect `/create-cohort` to `/quest/start`, update Command Palette and Explore links, use `router.push`.
- **Phase 4: Extraction & Code Cleanup (QA/F03, QA/F05, QA/F06, QA/F07)**: [COMPLETE] Fix Mojibake bullet bug, improve GitHub extractor resilience, remove fake timers, and delete dead hooks.
- **Phase 5: Verification (QA/V0, QA/V1)**: [COMPLETE] Vitest suite (256 tests), TypeScript checks (0 errors), and production build (50/50 routes).
