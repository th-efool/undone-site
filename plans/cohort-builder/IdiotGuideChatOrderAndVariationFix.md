# IdiotGuideChatOrderAndVariationFix — Chronological Search Bubble Anchoring, Variable-Length Stepper (2–5 Steps), Rich Text Variations, Borderless Inline Trail & `interaction-builder` Plugin Portable Feature Suite + One-Prompt AI Guide

## A. Investigation Findings & Architectural Scope

This plan covers both the immediate Cohort Builder chat UX fixes (`S1`–`S4`) and their promotion into first-class, reusable exports inside the standalone `packages/interaction-builder` plugin (`S5`–`S9`) together with a **One-Prompt AI Integration Guide** (`packages/interaction-builder/docs/one-prompt-ai-integration-guide.md`) so any external site can integrate the entire conversational workspace + stepper + split-canvas architecture in a single prompt.

### Phase 1: Cohort Builder Chat Ordering, Variable Step Counts & Inline Trail (`S1`–`S4`)

1. **Out-of-Order Messages After Sending a Second Query (`ChatPane.tsx`):**
   - **Root Cause:** When a workspace starts in `search` mode (`journey.step === 'recommendations'`), `acceptCohortIntake` (`src/server/infrastructure/db/postgres/cohort-intake.ts#L70`) appends the initial user prompt (`messages[0]`, e.g., `"robotics engineering"`) with `scheduleAssistant: false`. No assistant message row is persisted in `messages` for that initial search.
   - In `ChatPane.tsx`, `showSearchActivityBubble` was rendered **after** `{messages.map(...)}` at the bottom of the message list.
   - As soon as the user sends a second message (`messages[1]`: `"what should i do now"`), `messages.map` renders `messages[0]` followed immediately by `messages[1]` and its assistant response (`messages[2]`), while pushing `showSearchActivityBubble` (which was the assistant response to `messages[0]`) to the **very bottom** of the chat below `messages[2]`.
   - **Fix:** Anchor the search activity bubble to the specific user message that triggered the search (`searchAnchorMessageId` via `resolveActivityAnchorMessageId`). For initial intake search (`messages[0].role === 'user'` with no assistant reply at `messages[1]`), anchor directly to `messages[0].id` and render the search bubble **immediately after `messages[0]`** inside the message list. Subsequent user queries (`messages[1]`) and their assistant replies (`messages[2]`) then naturally render **below** the initial search response in true chronological order.

2. **Dynamic 2–5 Step Counts & Rich Topic-Aware Text Variations (`chat-progress-variations.ts` & `interaction-builder/core`):**
   - **Root Cause:** `searchChecklistSteps` and `buildTurnProgressSteps` always returned a fixed array of 3 hardcoded strings (`Processing your query`, `Understanding your learning goal`, `Searching cohorts for you`), and `searchSummaryMarkdown` used a single static template per outcome.
   - **Fix:** Deterministic 32-bit FNV-1a seeded generator (`hashSeed` + `pickStepCount`) that:
     - Dynamically selects **2, 3, 4, or 5 steps** per query/turn (`[2, 3, 4, 5, 3, 4, 2, 5]`) so the step count varies naturally across queries without flickering on React re-renders.
     - Draws from rich, topic-aware, conversational pools of step descriptions across search/discovery, next-steps guidance (`"what should i do now"`), curriculum planning, source analysis, and studio launch.
     - Provides **18+ distinct, warm, engaging variations** across zero-match, matched, failed, and studio-opened summary responses.

3. **Borderless Inline Thought-Trail Styling (`CohortBuilder.module.css` & `<InteractionStepTrail />`):**
   - **Root Cause:** `.assistantBubble` is an open, borderless editorial text flow, whereas `.chatStepChecklist` was styled as a separate bordered card (`border: 1px solid ...; background: ...; border-radius: 16px; box-shadow: ...`) with heavy `20px` solid `#303cff` blue circles.
   - **Fix:** Replace the boxed card with a sleek, borderless inline vertical timeline (`border-left: 1.5px solid ...`, `background: transparent`, `border-radius: 0`, `box-shadow: none`) with compact `16px` soft-tinted status markers that flow directly into the assistant's markdown response.

---

### Phase 2: First-Class `interaction-builder` Plugin Capabilities & One-Prompt AI Guide (`S5`–`S9`)

To make all of these capabilities portable across any other website or application using `interaction-builder`:

1. **`packages/interaction-builder/src/core/progress-ux.ts` (exported from `interaction-builder/core`, `interaction-builder/react`, and `interaction-builder`):**
   - `InteractionProgressStep` (`{ id, label, state: 'pending' | 'running' | 'complete' }`)
   - `hashSeed(input)` & `pickStepCount(seed, allowedCounts)` — deterministic FNV-1a seed & 2–5 step count selector
   - `buildVariedSteps(options)` — domain-agnostic 2–5 step generator with custom 5-stage pools (`FiveStagePools`) and `{{topic}}` interpolation
   - `buildVariedSearchSteps(options)` — topic-aware 2–5 step discovery/search checklist generator with configurable `resourcePlural` (e.g. `'cohorts'`, `'projects'`, `'templates'`)
   - `buildVariedTurnSteps(options)` — intent-aware 2–5 step assistant turn checklist generator
   - `buildVariedSearchSummary(options)` — multi-variant markdown summary generator for 0-match, matched, failed, and studio-opened states with configurable `createCtaLabel`, `resourceSingular`, and `resourcePlural`
   - `hasUnansweredInitialUserPrompt(messages)`, `resolveActivityAnchorMessageId(messages, showBubble)`, `isAnchoredBubbleAtConversationEnd(messages, showBubble, anchorId)` — chronological activity bubble anchoring helpers
   - `createImplicitActionDetector(rules)` — declarative regex-to-action router so natural-language chat messages immediately dispatch client-side optimistic domain actions
   - `resolveSplitCanvasLayout(options)` — delayed `"Tadada~"` split-canvas reveal controller (`'centered' | 'split'`)
   - `createStageSuggestions(map, maxSuggestions)` — declarative stage-aware quick-reply suggestion chip generator

2. **`packages/interaction-builder/src/react/progress-ui.tsx` (exported from `interaction-builder/react`):**
   - `<InteractionStepTrail />` — zero-dependency React component rendering the borderless inline vertical timeline with built-in SVG check/spinner/dot markers, CSS custom property hooks (`--ib-step-line`, `--ib-step-ink`, `--ib-step-muted`, `--ib-step-accent`), and optional `classNames` override
   - `useStepProgression(isActive, options)` — multi-phase timer hook advancing across `2..5` steps
   - `useAnchoredActivityBubble(showBubble)` — React hook wrapping `useWorkspaceMessages()` and chronological message anchoring (`shouldRenderAfterMessage`, `shouldRenderStandalone`, `isLatestUser`)
   - `useAssistantActivity(options)` — portable ETag-aware assistant turn activity poller with `visibilitychange` pause/resume and `cancelActiveTurn()`

3. **One-Prompt AI Integration Guide (`packages/interaction-builder/docs/one-prompt-ai-integration-guide.md`):**
   - Copy-pasteable master prompt and full-stack reference implementation (Domain + API Route + Split-Screen React UI + `<InteractionStepTrail />` + `useAnchoredActivityBubble` + `createImplicitActionDetector` + `resolveSplitCanvasLayout`) enabling any AI coding agent to integrate `interaction-builder` into any site in a single prompt.

---

## B. File Inventory

| Step | File Path | Action |
| :--- | :--- | :--- |
| `S1` | `src/client/screens/cohortBuilder/chat-progress-variations.ts` | Export variable-length (2–5 steps) step generators, outcome summaries, and UX helpers from `interaction-builder/core`. |
| `S2` | `src/client/screens/cohortBuilder/ChatPane.tsx` & `src/client/screens/cohortBuilder/CohortIntakeScreen.tsx` | Anchor search activity bubble chronologically right after `messages[0]` and wire 2–5 phase progression + varied step/summary generators. |
| `S3` | `src/client/screens/cohortBuilder/CohortBuilder.module.css` | Replace boxed `.chatStepChecklist` card with a borderless, inline vertical timeline trail. |
| `S4` | `src/client/screens/cohortBuilder/__tests__/ChatPaneTurnAndInteractive.test.tsx` | Add regression tests for chronological message ordering after follow-up queries and variable-length step generation (2–5 steps). |
| `S5` | `packages/interaction-builder/src/core/progress-ux.ts` & `packages/interaction-builder/src/core/index.ts` | Add portable core progress UX, chronological anchoring, implicit intent detector, split-canvas reveal, and stage suggestions to `interaction-builder/core`. |
| `S6` | `packages/interaction-builder/src/react/progress-ui.tsx` & `packages/interaction-builder/src/react/index.ts` | Add `<InteractionStepTrail />`, `useStepProgression`, `useAnchoredActivityBubble`, and `useAssistantActivity` to `interaction-builder/react`. |
| `S7` | `packages/interaction-builder/__tests__/progress-ux.test.tsx` | Add unit and DOM component tests for all new `interaction-builder` plugin features. |
| `S8` | `packages/interaction-builder/docs/one-prompt-ai-integration-guide.md`, `packages/interaction-builder/docs/README.md`, `packages/interaction-builder/README.md` | Author the One-Prompt AI Integration Guide and link it across package documentation. |
| `S9` | `packages/interaction-builder/dist/*` | Build `packages/interaction-builder` (`npm run build`) and verify all package + host tests pass. |

---

## C. Verification Commands

```powershell
# 1. Build interaction-builder plugin subpaths & TypeScript declarations
Push-Location packages/interaction-builder; npm run build; Pop-Location

# 2. Run interaction-builder plugin unit & component tests
npx vitest run packages/interaction-builder/__tests__/progress-ux.test.tsx

# 3. Run host Cohort Builder unit & integration tests
npx vitest run src/client/screens/cohortBuilder/__tests__/ChatPaneTurnAndInteractive.test.tsx src/client/screens/cohortBuilder/__tests__/journey-stages.test.tsx src/client/screens/cohortBuilder/__tests__/shell.test.tsx src/client/screens/cohortBuilder/__tests__/intake-screen.test.tsx

# 4. Run full repository TypeScript typecheck
npx tsc --noEmit
```
