# IdiotCheckInQualityAssessment: Cohort Creation & Builder Subsystem

**Date:** 2026-11-01  
**Target Subsystem:** Cohort Creation, Builder, Intake, Extraction, and Delivery Ecosystem  
**Repository Root:** `D:\ThisPC\Documents\SideQuestHQ\undone-site`  
**Git HEAD:** `4f2a72ca` (`origin/master`)  
**Deployment Target:** Vercel Production (`https://undone-g97iagczz-th-efools-projects.vercel.app` / `https://www.undone.one`)  
**Deployment Status:** Ready (Verified Live, duration 2m 16s)  

---

## 1. Verdict and Assessed Scope

### Overall Verdict: UNMET ACCEPTANCE (HIGH-SEVERITY ARCHITECTURAL DEFECTS PRESENT)

While the immediate repair handoff (`IdiotHandOffGuide.md`) successfully resolved the specific planning context leak (`S1/S2`), decoupled `add_lesson` from auto-review (`B1`), persisted source attachments (`B2/B3`), bounded chat-stage AI tools (`B4`), and enforced topic precedence (`B5`), an exhaustive systemic quality audit reveals that **the root causes behind the planning/review failure are merely symptoms of a larger, fragmented, multi-pipeline architecture**.

Specifically:
1. **Three Disconnected Creation Pipelines**: The application maintains three parallel, competing cohort creation implementations with divergent storage backends, state machines, and UX patterns.
2. **AI Tool Safety Holes in Subsequent Stages**: While `chat` stage tools were restricted, `review`, `ready`, and `published` stages continue to expose the destructive `commit_release` action to the autonomous LLM tool loop without human confirmation.
3. **Client-Side Extraction Vulnerabilities & Encoding Defects**: A concrete Mojibake character encoding bug corrupts web extractions (`â€¢`), while GitHub client extraction makes raw unauthenticated CORS calls subject to aggressive IP rate limiting (60 req/hr).
4. **State Machine Type Gaps**: The centralized `stage-selectors.ts` engine completely omits the `'chat'` stage from `BuilderStage`, causing falling-through and misclassifying active chat workspaces as `'curriculum'` or `'intake'`.

### Assessed Scope Inventory

| Component / Subsystem | Entry Point / File Path | Scope Description |
|---|---|---|
| **Intake & Draft Persistence** | `src/client/components/global/LearningPromptBar/LearningPromptBar.tsx`<br>`src/client/screens/cohortBuilder/intake-draft.ts`<br>`src/app/api/cohort-builder/intake/route.ts`<br>`src/server/infrastructure/db/postgres/cohort-intake.ts` | Landing page prompt input, draft serialization, session recovery, and workspace creation. |
| **Cohort Builder Interaction** | `src/client/screens/cohortBuilder/CohortInteractionScreen.tsx`<br>`src/client/screens/cohortBuilder/ChatPane.tsx`<br>`src/client/screens/cohortBuilder/CohortWorkspacePane.tsx`<br>`src/client/screens/cohortBuilder/stage-selectors.ts`<br>`src/shared/cohort-builder/contracts.ts` | Two-pane split/centered workspace, stage routing, action planning, event reduction, and chat interface. |
| **Client Source Extractors** | `src/client/lib/sourceExtractors/pdfClientExtractor.ts`<br>`src/client/lib/sourceExtractors/youtubeClientExtractor.ts`<br>`src/client/lib/sourceExtractors/githubClientExtractor.ts`<br>`src/client/lib/sourceExtractors/webClientExtractor.ts` | In-browser file and URL parsing (PDF canvas thumbnailing, YouTube captions/chapters, GitHub REST, link preview DOMParser). |
| **AI Tool Execution & Model Loop** | `src/server/domain/cohort-builder/tools.ts`<br>`src/server/infrastructure/ai/interactionModel.ts`<br>`src/server/interaction-worker.ts`<br>`packages/interaction-builder/` | AI tool declarations, stage tool gating, runner execution, and queue lease management. |
| **Release & Publication Pipeline** | `src/server/domain/cohort-builder/release-service.ts`<br>`src/server/domain/cohort-builder/delivery.adapter.ts`<br>`src/app/api/cohort-builder/workspaces/[workspaceId]/release/route.ts`<br>`src/client/screens/dashboard/createCohort/services/publishService.ts` | Transactional relational materialization into `Cohort`, `Season`, `Lesson` vs legacy wizard publishing. |
| **Alternative Creation Experiences** | `src/app/(creation)/quest/new/page.tsx`<br>`src/client/screens/cohortCreation/CreationExperience.tsx`<br>`src/app/(dashboard)/create-cohort/page.tsx`<br>`src/client/screens/dashboard/createCohort/CreateCohort.tsx` | Legacy wizard and multi-step form creation routes. |

---

## 2. Requirement and Component Coverage

| Req ID | Target Requirement / Invariant | Inspected Components | Review Method | Result | Finding ID |
|---|---|---|---|---|---|
| **REQ-1** | Conversational planning must remain in chat without auto-switching to review | `contracts.ts`, `CohortInteractionScreen.tsx`, `CurriculumStageView.tsx` | Source, Unit Tests (`contracts.test.ts`) | **Verified** | None |
| **REQ-2** | AI model must never be able to autonomously publish or release a cohort without explicit user click | `src/server/domain/cohort-builder/tools.ts` | Source inspection, tool registry | **Failed** | **FINDING-01** |
| **REQ-3** | Unified entry points for cohort creation across the entire user experience | `src/client/components/global/CommandPalette/`, `ExploreDesktop.tsx`, `package.json`, routes | Route mapping, codebase grep | **Failed** | **FINDING-02** |
| **REQ-4** | Client source extraction must preserve text integrity without encoding artifacts | `src/client/lib/sourceExtractors/webClientExtractor.ts` | Source inspection (line 56) | **Failed** | **FINDING-03** |
| **REQ-5** | State machine must model all user journey stages accurately without type gaps | `src/client/screens/cohortBuilder/stage-selectors.ts` | Source inspection (lines 28, 202) | **Failed** | **FINDING-04** |
| **REQ-6** | GitHub source extraction must be resilient against IP rate limits | `src/client/lib/sourceExtractors/githubClientExtractor.ts` | Source inspection (lines 61-110) | **Failed** | **FINDING-05** |
| **REQ-7** | Release progress and publication feedback must be factual and non-fabricated | `src/client/screens/dashboard/createCohort/services/publishService.ts` | Source inspection (lines 24-34) | **Failed** | **FINDING-06** |
| **REQ-8** | Dead code and redundant hook abstractions must be eliminated | `src/client/screens/cohort/hooks/` (`useQuestline`, `useArchives`, `useEvents`) | Reference grep, usage audit | **Failed** | **FINDING-07** |
| **REQ-9** | No duplicate diverging stage calculation algorithms | `CohortWorkspacePane.tsx` vs `stage-selectors.ts` | AST / diff comparison | **Failed** | **FINDING-08** |
| **REQ-10**| Smooth SPA navigation without white-flash hard window reloads | `CohortIntakeScreen.tsx` (line 37) | Source inspection | **Failed** | **FINDING-09** |

---

## 3. Prioritized Findings

### High Severity Findings

#### FINDING-01: Autonomous Publication Risk — `commit_release` Exposed to LLM in Review & Ready Stages
- **Category:** Category B (Symptom-only fixes and unresolved root causes) / Category C (Security & Invariant Violation)
- **Severity:** **HIGH**
- **Affected Requirement:** REQ-2 (User-only deliberate publication)
- **Location:** `src/server/domain/cohort-builder/tools.ts#L41`, `#L55`, `#L61`, `#L369-376`
- **Preconditions:** Workspace enters `review`, `ready`, or `published` stage; user chats with assistant.
- **Expected Behavior:** Releasing a cohort into the public/private catalog requires explicit user approval through the UI Release Panel (`ReleasePanel.tsx`). AI tools should be restricted to authoring, drafting, and reviewing.
- **Actual Behavior:** `STAGE_TOOL_NAMES['review']`, `STAGE_TOOL_NAMES['ready']`, and `STAGE_TOOL_NAMES['published']` expose `commit_release` directly to the language model. While the tool's prompt docstring notes *"Final user confirmation via the Release Panel is recommended"*, the LLM is deterministically permitted to invoke `commit_release` with a generated or passed `candidateHash`, executing a live database commit into `Cohort`, `Season`, and `Lesson` without the user clicking the confirm button.
- **Attribution:** Pre-existing architectural oversight.
- **Remediation:** Remove `commit_release` from `STAGE_TOOL_NAMES` across all stages in `tools.ts`. Publication must strictly originate from the authenticated user HTTP endpoint (`POST /api/cohort-builder/workspaces/[workspaceId]/release`).

---

#### FINDING-02: Pipeline Triplication & Broken Dashboard Routing (`/create-cohort` vs `/quest/build`)
- **Category:** Category A (Pending or half-finished implementation) / Category F (Duplication & Overengineering)
- **Severity:** **HIGH**
- **Affected Requirement:** REQ-3 (Unified creation pipeline)
- **Locations:**
  - `src/client/components/global/CommandPalette/CommandPalette.tsx#L90`
  - `src/client/screens/dashboard/explore/ExploreDesktop.tsx#L88`
  - `src/app/(dashboard)/create-cohort/page.tsx`
  - `src/app/(creation)/quest/new/page.tsx`
- **Preconditions:** User clicks "Create Cohort" in Command Palette (`Cmd+K`) or the "Build a Cohort" button on `/explore`.
- **Expected Behavior:** User is routed into the unified, modern AI Cohort Builder (`/quest/start` or `/`), where materials and intent are synthesized via the interaction engine and persisted to PostgreSQL.
- **Actual Behavior:** The user is routed to `/create-cohort`, which launches the legacy mock-heavy form wizard (`CreateCohort.tsx`). This wizard writes to `localStorage` via `cohortRepository.registerPublishedCohort`, completely bypassing the PostgreSQL `interaction_workspaces` engine. A user creating a cohort from Explore gets a completely different, disconnected experience from a user creating from the homepage.
- **Attribution:** Pre-existing tech debt from incomplete migration.
- **Remediation:** Deprecate `/create-cohort` or redirect it to `/quest/start`. Update all UI CTAs in `CommandPalette.tsx` and `ExploreDesktop.tsx` to target the canonical builder intake.

---

### Medium Severity Findings

#### FINDING-03: Mojibake Character Corruption in Web Source Client Extractor
- **Category:** Category C (Existing defects, breakage, and regressions)
- **Severity:** **MEDIUM**
- **Affected Requirement:** REQ-4 (Source text fidelity)
- **Location:** `src/client/lib/sourceExtractors/webClientExtractor.ts#L56`
- **Preconditions:** User attaches any webpage containing unordered lists (`<li>`).
- **Expected Behavior:** List items are prefixed with a clean Unicode bullet `• ` (`\u2022`).
- **Actual Behavior:** Line 56 contains hardcoded corrupted Windows-1252/ISO-8859-1 Mojibake:
  ```typescript
  else if (tag === 'li') formatted = `â€¢ ${text}`;
  ```
  Every bulleted list extracted from web articles injects `â€¢ ` into the source text, chunk database, vector search, and generated student lesson evidence.
- **Attribution:** Pre-existing encoding bug.
- **Remediation:** Replace `â€¢ ` with `• ` (or `- `).

---

#### FINDING-04: Architectural Type Gap — `BuilderStage` Omits `'chat'` in State Selectors
- **Category:** Category A (Half-finished implementation) / Category C (State desynchronization)
- **Severity:** **MEDIUM**
- **Affected Requirement:** REQ-5 (Complete stage state machine)
- **Location:** `src/client/screens/cohortBuilder/stage-selectors.ts#L28-43`, `#L202-225`
- **Preconditions:** `getActiveStage` or `computeEffectiveStage` called while `workspace.journey.step === 'chat'`.
- **Expected Behavior:** The stage selector returns `'chat'` or a designated planning stage.
- **Actual Behavior:** `BuilderStage` union does not include `'chat'`. `computeActiveStage` has explicit branches for `'recommendations'`, `'starting_point'`, `'material_input'`, `'discovery'`, `'goal_setup'`, `'ready'`, `'review'`, `'published'`, and `'processing'`, but falls through for `'chat'`. It then evaluates:
  ```typescript
  if (processing.status === 'ready') return 'curriculum';
  return lessons.length > 0 ? 'curriculum' : 'intake';
  ```
  This causes active chat states to falsely report as `'curriculum'` or `'intake'` to background hooks and progress trackers.
- **Attribution:** Pre-existing omission when `'chat'` was introduced.
- **Remediation:** Add `'chat'` to `BuilderStage` union in `stage-selectors.ts` and add an explicit `if (workspace.journey.step === 'chat') return 'chat';` branch.

---

#### FINDING-05: Unauthenticated GitHub API Client Rate Limit Exhaustion (60 req/hr)
- **Category:** Category C (Existing defects & reliability risk)
- **Severity:** **MEDIUM**
- **Affected Requirement:** REQ-6 (Reliable source extraction)
- **Location:** `src/client/lib/sourceExtractors/githubClientExtractor.ts#L61-78`, `#L108-115`
- **Preconditions:** User attaches a GitHub repository from a shared network (office/university) or adds a repository with >15 files.
- **Expected Behavior:** GitHub repository extraction uses authenticated server proxying or falls back gracefully without breaking the intake form.
- **Actual Behavior:** `extractGithubClient` issues direct unauthenticated browser `fetch()` requests to `https://api.github.com/repos/...` and raw file URLs. GitHub enforces a strict 60 requests/hr rate limit on unauthenticated IP addresses. A single 20-file repo consumes 35% of the entire IP's hourly budget. When rate-limited, it throws: `GitHub API rate limit exceeded on your IP. Please try again later.` and prevents the user from proceeding.
- **Attribution:** Pre-existing client-only extractor limitation.
- **Remediation:** Route GitHub repo extraction through `/api/import/github`, which can utilize server-configured GitHub tokens (`GITHUB_ACCESS_TOKEN` / GitHub App credentials) to provide 5,000 req/hr.

---

#### FINDING-06: Fabricated Processing Delays in Legacy Publish Service
- **Category:** Category D (Quality-standard gaps) / Category B (Symptom-only fixes)
- **Severity:** **MEDIUM**
- **Affected Requirement:** REQ-7 (Honest progress metrics)
- **Location:** `src/client/screens/dashboard/createCohort/services/publishService.ts#L24-34`
- **Preconditions:** User publishes a cohort in the `/create-cohort` wizard.
- **Expected Behavior:** UI reflects real server processing stages and atomic commits.
- **Actual Behavior:** `publishService.ts` executes sequential artificial sleep calls:
  ```typescript
  onStageChange('preparing-assets');
  await new Promise((resolve) => setTimeout(resolve, 500));
  onStageChange('search-metadata');
  await new Promise((resolve) => setTimeout(resolve, 500));
  onStageChange('creating-community');
  await new Promise((resolve) => setTimeout(resolve, 500));
  ```
  before even issuing the HTTP request to `/api/cohort/publish`.
- **Attribution:** Pre-existing mock/legacy artifact.
- **Remediation:** Remove fake timers and link progress directly to the real server response or SSE stream.

---

### Low Severity Findings

#### FINDING-07: Dead Code Hooks in Cohort Screen (`useQuestline`, `useArchives`, `useEvents`)
- **Category:** Category E (Dead code and unused artifacts)
- **Severity:** **LOW**
- **Affected Requirement:** REQ-8 (Codebase cleanliness)
- **Locations:**
  - `src/client/screens/cohort/hooks/useQuestline.ts` (100% unused)
  - `src/client/screens/cohort/hooks/useArchives.ts` (100% unused)
  - `src/client/screens/cohort/hooks/useEvents.ts` (100% unused)
- **Evidence:** `git grep` confirms no file in the entire repository imports these three hooks. The respective tab components (`Questline.tsx`, `Archives.tsx`, `Events.tsx`) receive `props.cohort` directly from server components (`QuestlineViewer.tsx`, etc.).
- **Attribution:** Abandoned legacy hooks.
- **Remediation:** Delete these three files and clean up `src/client/screens/cohort/hooks/index.ts`.

---

#### FINDING-08: Code Duplication Between `CohortWorkspacePane.tsx` and `stage-selectors.ts`
- **Category:** Category F (Duplication & Overengineering)
- **Severity:** **LOW**
- **Affected Requirement:** REQ-9 (DRY state logic)
- **Locations:**
  - `src/client/screens/cohortBuilder/CohortWorkspacePane.tsx#L52-72`
  - `src/client/screens/cohortBuilder/stage-selectors.ts#L387-407`
- **Evidence:** Both files export a function named `getEffectiveStage(...)` with overlapping responsibilities. `CohortWorkspacePane.tsx` adds a `drafts` parameter, whereas `stage-selectors.ts` implements a `WeakMap` cache.
- **Attribution:** Incomplete consolidation.
- **Remediation:** Consolidate into `stage-selectors.ts` as the single authoritative source of truth.

---

#### FINDING-09: Hard Page Reload via `window.location.assign` in `CohortIntakeScreen`
- **Category:** Category D (Quality-standard gaps)
- **Severity:** **LOW**
- **Affected Requirement:** REQ-10 (SPA navigation)
- **Location:** `src/client/screens/cohortBuilder/CohortIntakeScreen.tsx#L37`
- **Evidence:** Uses `window.location.assign(`/quest/build/${body.workspaceId}`)` instead of `useRouter().push()`, triggering a full document reload, discarding in-memory client state, and incurring unnecessary network waterfalls.
- **Attribution:** Pre-existing implementation.
- **Remediation:** Replace with Next.js `router.push()`.

---

## 4. Checks and Evidence

| Check ID | Tool / Command | Target / Scope | Result / Observed Output |
|---|---|---|---|
| **CHK-01** | `git grep -n "commit_release" src/` | AI tools and contracts | Found `commit_release` exposed in `STAGE_TOOL_NAMES['review']`, `['ready']`, `['published']`. Verified in `tools.ts#L41`, `#L55`, `#L61`. |
| **CHK-02** | `git grep -n "/create-cohort" src/` | Global routes and links | Found active user-facing navigation in `CommandPalette.tsx` and `ExploreDesktop.tsx` pointing to legacy `/create-cohort`. |
| **CHK-03** | Source inspection of `webClientExtractor.ts` | Line 56 character encoding | Confirmed literal `â€¢` Mojibake string in list item formatter. |
| **CHK-04** | Source inspection of `stage-selectors.ts` | Lines 28-43, 202-225 | Confirmed `BuilderStage` lacks `'chat'` and `computeActiveStage` falls through to `'curriculum'`. |
| **CHK-05** | Source inspection of `githubClientExtractor.ts` | Lines 61-115 | Confirmed direct browser `fetch` to `api.github.com` without client token handling. |
| **CHK-06** | Source inspection of `publishService.ts` | Lines 24-34 | Confirmed three artificial 500ms `setTimeout` delays. |
| **CHK-07** | `git grep` on `useQuestline`, `useArchives`, `useEvents` | Entire codebase | 0 external imports found; 100% dead code. |
| **CHK-08** | Vercel Deployment Verification | `npx vercel inspect` on commit `4f2a72ca` | **● Ready** in 2m 16s on `https://undone-g97iagczz-th-efools-projects.vercel.app`. Production aliases updated. |

---

## 5. Unverified Risks and Blocked Investigation

1. **Large Binary PDF Memory Pressure in Mobile Safari**:
   - `pdfClientExtractor.ts` renders Page 1 thumbnails via `<canvas>` directly inside client browser threads. On low-memory iOS Safari devices, loading a 25MB PDF could trigger WebKit memory limits and reload the tab. Testing on a physical low-memory mobile device is required to establish exact memory thresholds.
2. **PostgreSQL Connection Pool Contention Under High Intake Concurrency**:
   - Both `acceptCohortIntake` and `acceptPdfUpload` perform raw SQL queries and interactive transactions with 15s timeouts. Under sustained load (e.g. 50 simultaneous intakes), connection exhaustion on PgBouncer / Prisma requires load verification using `scripts/load/measured-load-harness.ts`.

---

## 6. Correction Order and Completion Criteria

To bring the cohort creation and builder subsystems to production-grade quality, address the findings in the following dependency-ordered phases:

### Phase 1: Security & AI Boundary Remediation (Critical/High)
1. **Fix FINDING-01 (`commit_release` in AI tools)**:
   - Edit `src/server/domain/cohort-builder/tools.ts` to purge `commit_release` and `prepare_release` from all AI stage tool sets (`review`, `ready`, `published`).
   - *Verification:* Add unit tests in `src/server/domain/cohort-builder/__tests__/external-tools.test.ts` asserting `commit_release` is never returned by `createCohortAiTools` under any stage.

### Phase 2: Creation Route Consolidation (High)
2. **Fix FINDING-02 (Pipeline Triplication)**:
   - Redirect `/create-cohort` to `/quest/start` in `next.config.js` or page handler.
   - Update `CommandPalette.tsx` and `ExploreDesktop.tsx` to link to `/quest/start` or `/`.
   - *Verification:* Navigation click tests and Cypress/Playwright route assertions.

### Phase 3: Extraction & State Machine Integrity (Medium)
3. **Fix FINDING-03 (Mojibake Encoding)**:
   - Replace `â€¢` with `•` in `src/client/lib/sourceExtractors/webClientExtractor.ts`.
   - *Verification:* Unit test in `webClientExtractor.test.ts` checking bullet parsing.
4. **Fix FINDING-04 (`BuilderStage` Type Gap)**:
   - Add `'chat'` to `BuilderStage` in `src/client/screens/cohortBuilder/stage-selectors.ts` and handle `workspace.journey.step === 'chat'`.
   - *Verification:* Vitest in `src/client/screens/cohortBuilder/__tests__/stage-selectors.test.ts`.
5. **Fix FINDING-05 (GitHub Extraction Resilience)**:
   - Update `extractGithubClient` to call `/api/import/github` proxy route instead of directly hitting rate-limited `api.github.com`.
   - *Verification:* Mocked API test asserting server proxy usage.

### Phase 4: Code Cleanliness & Polish (Low)
6. **Fix FINDING-06, FINDING-07, FINDING-08, FINDING-09**:
   - Remove fake `setTimeout` in `publishService.ts`.
   - Delete dead hooks `useQuestline.ts`, `useArchives.ts`, `useEvents.ts`.
   - Unify `getEffectiveStage` into `stage-selectors.ts`.
   - Replace `window.location.assign` with `router.push` in `CohortIntakeScreen.tsx`.
   - *Verification:* `npx tsc --noEmit` and `npm run build`.
