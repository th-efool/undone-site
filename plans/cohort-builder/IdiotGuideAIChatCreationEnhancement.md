# IdiotGuideAIChatCreationEnhancement — Cohort Builder AI Chat Stepper, Delayed Panel Reveal ("Tadada~"), Implicit Cohort Start Intent & Empty-State Redesign

## A. Executive Summary & Architectural Overview

This self-contained implementation guide resolves five UX and interaction bugs in the Cohort Builder (`src/client/screens/cohortBuilder/`, `src/client/screens/cohortCreation/`, and `src/server/domain/cohort-builder/`):

1. **Always-Present AI Response in Left Chat Rail (`ChatPane.tsx`):**
   - Previously, when a user entered via `search` mode (`journey.step === 'recommendations'`), `acceptCohortIntake` suppressed assistant run scheduling (`scheduleAssistant: false`), leaving the user's prompt bubble alone in the left chat rail with zero AI response during and after cohort search.
   - We now render a dedicated assistant message bubble in `ChatPane.tsx` whenever a cohort search is in progress or has completed without a subsequent assistant turn, ensuring the user always sees live step progress followed by a contextual conversational response summarizing the search outcome and next action.

2. **Interactive Multi-Step Progress Checklist in AI Chat — Both During Search & Across All AI Turns (`ChatPane.tsx`, `CohortBuilder.module.css`):**
   - Replaces the static 10-second `Thinking…` wait with an interactive, live step-checklist (`ChatStepChecklist`) featuring spinning circle indicators (`LoaderCircle` / `⭕`) for active steps that transition into ticked checkmarks (`Check` / `✓`) as each step completes:
     - **During Cohort Search (`recommendations`):**
       1. `Processing your query` (`⭕` → `✓`)
       2. `Understanding your learning goal` (`⭕` → `✓`)
       3. `Searching cohorts for you` (`⭕` while `recommendations` is `undefined | 'queued' | 'running'`, ticking to `✓` the instant `recommendations.status` becomes `'ready' | 'failed'` or the user opens the studio).
     - **During General AI Chat Turns (`activeTurn`):**
       1. `Processing your query` (`⭕` → `✓`)
       2. Contextual intermediate step (`Preparing cohort creation studio`, `Understanding your learning goal`, `Reviewing your curriculum structure`, `Analyzing your learning sources`, or `Mapping your learning pathway`) (`⭕` → `✓`)
       3. Contextual completion step (`Opening cohort studio`, `Looking for similar cohorts`, or `Drafting tailored response`) (`⭕` spinning until turn completion).

3. **Delayed Right Panel Reveal ("Tadada~" Split-View Transition) (`CohortInteractionScreen.tsx`, `CohortIntakeScreen.tsx`, `CohortBuilder.module.css`):**
   - Previously, `CohortInteractionScreen.tsx` checked `const isChatStep = state.view?.journey?.step === 'chat'`, causing `data-layout="split"` to open the right panel at millisecond zero while `recommendations` was still searching.
   - Now, `CohortInteractionScreen.tsx` keeps `data-layout="centered"` while `journey.step === 'recommendations'` and recommendations are still searching (`!recommendations || status === 'queued' || status === 'running'`).
   - The exact moment `recommendations.status` transitions to `'ready'` or `'failed'` (or `journey.step` advances to `'starting_point' | 'material_input' | 'discovery' | 'goal_setup' | 'processing' | 'ready' | 'review'`), `data-layout` flips to `'split'` with a smooth entrance animation (`Tadada~`) while `"Searching cohorts for you"` simultaneously ticks (`✓`) in the AI chat rail.

4. **Implicit Cohort Creation Intent in Chat Opens Right Panel (`ChatPane.tsx`, `context.ts`, `tools.ts`):**
   - When the user types or clicks a message in chat that states or implies they want to start, create, make, or build a cohort (e.g., `"I want to start a cohort"`, `"let's create my own cohort"`, `"build a cohort"`, `"start with a goal"`, `"I already have material"`), `ChatPane.tsx` immediately dispatches `{ type: 'create_own_cohort' }` (or `{ type: 'choose_starting_point', choice }`) so the right studio panel pops open without waiting for an LLM round-trip, and server prompt/tool descriptions in `context.ts` and `tools.ts` reinforce the same transition.

5. **"No Cohort Found" Empty State Redesign Matching Image 2 (`RecommendationResults.tsx`, `RecommendationResults.module.css`):**
   - Replaces the old dashed box + duplicate bottom bar when `result.items.length === 0` with the editorial empty state from Image 2:
     - Centered illustration `/images/no-cohort-found-illustration.png` blended cleanly onto the warm paper surface.
     - Bold serif heading: `"A new path starts here."`
     - Subtitle: `"No matching public cohorts were found. Be the first to create a cohort for this intent and start learning with a community."`
     - Centered dark navy pill CTA button: `+  Create your own cohort  →`
     - Bottom 3-column horizontal feature strip with soft lavender circular icons and vertical dividers:
       1. `Bring like-minded learners`
       2. `Organize your learning`
       3. `Build in public (or keep it private)`

---

## B. Dependency-Ordered Phase Plan & File Inventory

| Step | Phase | File Path | Action |
| :--- | :--- | :--- | :--- |
| `S1` | Phase 1: Empty State Visual Redesign (`/image-to-code`) | `src/client/screens/cohortCreation/components/RecommendationResults.tsx` | Replace 0-match dashed box + duplicate footer with Image 2 layout (`/images/no-cohort-found-illustration.png`, pill CTA, 3-column feature strip). |
| `S2` | Phase 1: Empty State Visual Redesign (`/image-to-code`) | `src/client/screens/cohortCreation/components/RecommendationResults.module.css` | Add editorial styles for `.emptyState`, `.emptyIllustrationWrap`, `.emptyPrimaryCta`, `.emptyFeatures`, and dark-mode variants. |
| `S3` | Phase 2: Delayed Right Panel Reveal ("Tadada~") | `src/client/screens/cohortBuilder/CohortInteractionScreen.tsx` | Keep `data-layout="centered"` while `recommendations` is searching; pop open `data-layout="split"` when search finishes or studio step starts. |
| `S4` | Phase 2: Delayed Right Panel Reveal ("Tadada~") | `src/client/screens/cohortBuilder/CohortIntakeScreen.tsx` | Keep `data-layout="centered"` with live step checklist during initial intake handoff while `busy && !error`. |
| `S5` | Phase 3: Interactive AI Chat Stepper & Implicit Cohort Start | `src/client/screens/cohortBuilder/ChatPane.tsx` | Add `ChatStepChecklist`, persistent search-step + AI summary message in chat, multi-step `activeTurn` progress, and client-side implicit cohort-start dispatch. |
| `S6` | Phase 3: Interactive AI Chat Stepper & Canvas Entrance CSS | `src/client/screens/cohortBuilder/CohortBuilder.module.css` | Add `.chatStepChecklist`, `.chatStepItem`, spinning `.stepSpinner`, ticked `.stepCheck`, and `.canvas` slide-in reveal animation. |
| `S7` | Phase 4: Server AI Prompt & Tool Directives | `src/server/domain/cohort-builder/context.ts` & `src/server/domain/cohort-builder/tools.ts` | Strengthen implicit cohort-start tool rules in `chat` and `recommendations` stages. |
| `S8` | Phase 5: Unit & Integration Test Updates | `src/client/screens/cohortBuilder/__tests__/shell.test.tsx`, `src/client/screens/cohortBuilder/__tests__/journey-stages.test.tsx`, `src/client/screens/cohortBuilder/__tests__/ChatPaneTurnAndInteractive.test.tsx`, `src/client/screens/cohortCreation/__tests__/CreationExperience.test.tsx` | Update existing tests for delayed split-panel reveal and new empty-state copy, and add regression tests for the interactive stepper and implicit cohort start. |

---

## C. Step-by-Step Implementation Instructions

### Step `S1`: Update `RecommendationResults.tsx` for Image 2 Empty State

**File:** `src/client/screens/cohortCreation/components/RecommendationResults.tsx`

Replace the entire file contents with:

```tsx
import Link from 'next/link';
import { ArrowRight, BookOpen, Clock3, Compass, Plus, Rocket, Star, Users } from 'lucide-react';
import type { RecommendationResult } from '@/src/shared/cohort-creation/contracts';
import styles from './RecommendationResults.module.css';
import { InkUnderline } from './InkUnderline';
import { RecommendationCover } from './RecommendationCover';

export function RecommendationResults({ result, onCreateOwn }: { result: RecommendationResult; onCreateOwn: () => void }) {
  const hasItems = result.items.length > 0;

  return (
    <section aria-label="Cohort recommendations" className={styles.results}>
      <header className={styles.heading}>
        <p className={styles.eyebrow}>{hasItems ? 'People are already learning this' : 'Make room for your curiosity'}</p>
        <h1>
          {result.intent.topic.value}
          <InkUnderline className={styles.underline} />
        </h1>
        <p className={styles.subtitle}>
          {hasItems ? 'I found a few ways you could jump in.' : 'No matching public cohorts yet. Start a new learning journey.'}
        </p>
        {hasItems && (
          <span className={styles.annotation} aria-hidden="true">
            Real people.
            <br />
            Real progress.
            <br />
            Join a community
            <br />
            that’s learning.
          </span>
        )}
      </header>

      {result.mode === 'database_fallback' && (
        <p role="status" className={styles.status}>
          Showing database search results. AI assistance is unavailable.
        </p>
      )}

      {!hasItems ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIllustrationWrap}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/no-cohort-found-illustration.png"
              alt="Stack of books, glowing lantern, treasure map, and compass"
              className={styles.emptyIllustration}
              width={420}
              height={164}
            />
          </div>

          <h2 className={styles.emptyTitle}>A new path starts here.</h2>
          <p className={styles.emptySubtitle}>
            No matching public cohorts were found. Be the first to create a cohort for this intent and start learning with a community.
          </p>

          <button
            type="button"
            className={styles.emptyPrimaryCta}
            onClick={onCreateOwn}
            aria-label="Create your own cohort"
          >
            <Plus size={19} strokeWidth={2.2} aria-hidden="true" />
            <span>Create your own cohort</span>
            <ArrowRight size={19} strokeWidth={2.2} aria-hidden="true" />
          </button>

          <div className={styles.emptyFeatures} role="list" aria-label="Cohort creation highlights">
            <div className={styles.emptyFeatureItem} role="listitem">
              <span className={styles.emptyFeatureIcon} aria-hidden="true">
                <Users size={15} strokeWidth={1.9} />
              </span>
              <span>Bring like-minded learners</span>
            </div>
            <div className={styles.emptyFeatureItem} role="listitem">
              <span className={styles.emptyFeatureIcon} aria-hidden="true">
                <BookOpen size={15} strokeWidth={1.9} />
              </span>
              <span>Organize your learning</span>
            </div>
            <div className={styles.emptyFeatureItem} role="listitem">
              <span className={styles.emptyFeatureIcon} aria-hidden="true">
                <Rocket size={15} strokeWidth={1.9} />
              </span>
              <span>Build in public (or keep it private)</span>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className={styles.cards}>
            {result.items.map((item, index) => (
              <article className={styles.card} data-featured={index === 0} key={item.cohort.cohortId}>
                <div className={styles.art}>
                  <RecommendationCover src={item.cohort.coverImage} featured={index === 0} />
                </div>
                <div className={styles.cardBody}>
                  {item.isBestMatch && (
                    <span className={styles.badge}>
                      <Star size={14} fill="currentColor" aria-hidden="true" />
                      {result.mode === 'ai' ? 'Best match' : 'First search result'}
                    </span>
                  )}
                  <h2>
                    <Link href={`/cohort/${encodeURIComponent(item.cohort.cohortId)}`}>{item.cohort.title}</Link>
                  </h2>
                  <p className={styles.description}>{item.cohort.description || item.reason}</p>
                  <div className={styles.metrics}>
                    <span>
                      <Users size={24} strokeWidth={1.5} aria-hidden="true" />
                      <span>
                        <strong>{item.cohort.memberCount.toLocaleString('en-US')}</strong>
                        <small>learning</small>
                      </span>
                    </span>
                    <span>
                      <BookOpen size={22} strokeWidth={1.5} aria-hidden="true" />
                      <span>
                        <strong>{item.cohort.lessonCount}</strong>
                        <small>lessons</small>
                      </span>
                    </span>
                    {item.cohort.estimatedCompletionTime && (
                      <span>
                        <Clock3 size={23} strokeWidth={1.5} aria-hidden="true" />
                        <span>
                          <strong>{item.cohort.estimatedCompletionTime}</strong>
                          <small>total length</small>
                        </span>
                      </span>
                    )}
                  </div>
                  <ul className={styles.tags} aria-label="Cohort details">
                    <li>{item.cohort.difficulty.charAt(0) + item.cohort.difficulty.slice(1).toLowerCase()}</li>
                    {item.cohort.categories.slice(0, index === 0 ? 3 : 2).map(category => (
                      <li key={category}>{category}</li>
                    ))}
                  </ul>
                  <Link
                    className={styles.join}
                    href={`/cohort/${encodeURIComponent(item.cohort.cohortId)}`}
                    aria-label={`Join ${item.cohort.title}`}
                  >
                    {index === 0 ? 'Join this cohort' : 'Join cohort'} <ArrowRight size={18} aria-hidden="true" />
                  </Link>
                  <p className={styles.srOnly}>{item.reason}</p>
                </div>
              </article>
            ))}
          </div>
          <footer className={styles.create}>
            <span className={styles.compass}>
              <Compass size={26} strokeWidth={1.5} aria-hidden="true" />
            </span>
            <div>
              <strong>Not quite what you’re looking for?</strong>
              <p>Tell me more, or create your own cohort and I’ll help you build it.</p>
            </div>
            <button type="button" onClick={onCreateOwn}>
              Create my own cohort <ArrowRight size={18} aria-hidden="true" />
            </button>
          </footer>
        </>
      )}
    </section>
  );
}
```

---

### Step `S2`: Add Empty-State Styles to `RecommendationResults.module.css`

**File:** `src/client/screens/cohortCreation/components/RecommendationResults.module.css`

Append the following rules to the end of `src/client/screens/cohortCreation/components/RecommendationResults.module.css` (after line 57):

```css
/* Image-2 Redesigned Empty State */
.emptyState {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 20px 24px 28px;
  max-width: 820px;
  margin: 8px auto 0;
}

.emptyIllustrationWrap {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: min(100%, 420px);
  margin: 4px auto 14px;
}

.emptyIllustrationWrap::before {
  content: '';
  position: absolute;
  width: 78%;
  height: 76%;
  border-radius: 999px;
  background: radial-gradient(circle, rgba(216, 222, 248, 0.55) 0%, rgba(216, 222, 248, 0) 72%);
  z-index: 0;
  pointer-events: none;
}

.emptyIllustration {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 400px;
  height: auto;
  object-fit: contain;
  mix-blend-mode: multiply;
}

:global([data-theme='dark']) .emptyIllustration {
  mix-blend-mode: normal;
  border-radius: 16px;
}

.emptyTitle {
  font-family: var(--font-playfair-display), Georgia, serif;
  font-size: clamp(28px, 2.5vw, 35px);
  font-weight: 700;
  line-height: 1.15;
  letter-spacing: -0.025em;
  color: var(--creation-ink, #181d36);
  margin: 0 0 12px;
}

.emptySubtitle {
  font-size: 15px;
  line-height: 1.55;
  color: var(--creation-muted, #64697c);
  max-width: 470px;
  margin: 0 auto 28px;
}

.emptyPrimaryCta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 15px 34px;
  border-radius: 9999px;
  border: 1px solid #283061;
  background: linear-gradient(180deg, #232b5e 0%, #171d44 100%);
  color: #ffffff;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -0.01em;
  box-shadow: 0 10px 24px rgba(23, 29, 68, 0.24), 0 2px 6px rgba(23, 29, 68, 0.14);
  transition: transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
}

.emptyPrimaryCta:hover {
  transform: translateY(-1px);
  background: linear-gradient(180deg, #2b3570 0%, #1c2454 100%);
  box-shadow: 0 14px 28px rgba(23, 29, 68, 0.3), 0 4px 10px rgba(23, 29, 68, 0.18);
}

.emptyFeatures {
  margin-top: 38px;
  width: 100%;
  max-width: 780px;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  align-items: center;
  padding: 13px 18px;
  border-radius: 18px;
  border: 1px solid color-mix(in srgb, var(--creation-line, #e8dfd3) 85%, transparent);
  background: color-mix(in srgb, var(--creation-surface, #fffcf7) 75%, transparent);
  box-shadow: 0 2px 10px rgba(24, 29, 54, 0.03);
}

.emptyFeatureItem {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 4px 12px;
  font-size: 13px;
  font-weight: 600;
  color: var(--creation-ink, #232946);
}

.emptyFeatureItem:not(:last-child) {
  border-right: 1px solid color-mix(in srgb, var(--creation-line, #e8dfd3) 90%, transparent);
}

.emptyFeatureIcon {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: #eceeff;
  color: #4b56d2;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

:global([data-theme='dark']) .emptyFeatureIcon {
  background: rgba(146, 153, 255, 0.16);
  color: #a5acff;
}

@media (max-width: 820px) {
  .emptyFeatures {
    grid-template-columns: 1fr;
    gap: 10px;
  }
  .emptyFeatureItem {
    justify-content: flex-start;
  }
  .emptyFeatureItem:not(:last-child) {
    border-right: 0;
    border-bottom: 1px solid color-mix(in srgb, var(--creation-line, #e8dfd3) 80%, transparent);
    padding-bottom: 10px;
  }
}
```

---

### Step `S3`: Delay Right Panel Reveal Until Search Completes or Studio Opens (`CohortInteractionScreen.tsx`)

**File:** `src/client/screens/cohortBuilder/CohortInteractionScreen.tsx`

In `InnerBuilderScreen` (lines 62–73 of `src/client/screens/cohortBuilder/CohortInteractionScreen.tsx`), replace:

```tsx
  const isChatStep = state.view?.journey?.step === 'chat';
```

with:

```tsx
  const isRecommendationsSearching =
    state.view?.journey?.step === 'recommendations' &&
    (!state.view.recommendations ||
      state.view.recommendations.status === 'queued' ||
      state.view.recommendations.status === 'running');

  const isChatStep = state.view?.journey?.step === 'chat' || isRecommendationsSearching;
```

**Why this works:**
- While `journey.step === 'recommendations'` and `recommendations` is `undefined`, `'queued'`, or `'running'`, `isChatStep` is `true`, so `data-layout="centered"` is active and the right canvas stays closed while the user watches the live checklist in chat.
- As soon as `recommendations.status` becomes `'ready'` or `'failed'`, OR `journey.step` transitions to `'starting_point' | 'material_input' | 'discovery' | 'goal_setup' | 'processing' | 'ready' | 'review'`, `isChatStep` becomes `false`, announcing `'Workspace panel opened'` and popping open the right panel (`data-layout="split"`).

---

### Step `S4`: Keep `CohortIntakeScreen.tsx` in Centered Chat Layout with Live Step Checklist While Handoff is In-Flight

**File:** `src/client/screens/cohortBuilder/CohortIntakeScreen.tsx`

In `src/client/screens/cohortBuilder/CohortIntakeScreen.tsx`, update `isPlanMode` layout handling and the message preview (lines 35–175):

**Target (lines 35–36 and 89–175):**
```tsx
  const isPlanMode = draft?.mode === 'plan';
  const logoSrc = isDark ? '/undone-logo-dark.svg' : '/undone-logo-transparent.svg';
```
and
```tsx
  return (
    <div
      id="main-content"
      className={builderStyles.page}
      data-theme={theme}
      data-layout={isPlanMode ? 'centered' : 'split'}
      data-variant="material"
      data-rail-collapsed={!isPlanMode && collapsed}
      data-pane={pane}
    >
      {!isPlanMode && (
```
...through line 174:
```tsx
      {/* Right Workspace Canvas matching AI Builder Workspace */}
      {!isPlanMode && (
```

**Replacement:**
```tsx
  const isPlanMode = draft?.mode === 'plan';
  const isCenteredHandoff = isPlanMode || (enabled && !!draft && busy && !error);
  const logoSrc = isDark ? '/undone-logo-dark.svg' : '/undone-logo-transparent.svg';
```
and in JSX:
```tsx
  return (
    <div
      id="main-content"
      className={builderStyles.page}
      data-theme={theme}
      data-layout={isCenteredHandoff ? 'centered' : 'split'}
      data-variant="material"
      data-rail-collapsed={!isCenteredHandoff && collapsed}
      data-pane={pane}
    >
      {!isCenteredHandoff && (
        <nav className={builderStyles.paneNavigation} aria-label="Builder views">
        <button
          type="button"
          aria-pressed={pane === 'chat'}
          onClick={() => setPane('chat')}
        >
          Chat
        </button>
        <button
          type="button"
          aria-pressed={pane === 'workspace'}
          onClick={() => setPane('workspace')}
        >
          Workspace
        </button>
      </nav>
      )}

      {/* Left Conversation Rail matching AI Builder Workspace */}
      <aside className={builderStyles.rail} aria-label="Creation conversation">
        <header className={builderStyles.brandHeader}>
          <Link className={builderStyles.brand} href="/" aria-label="Undone home">
            <Image
              src={logoSrc}
              width={42}
              height={42}
              alt=""
              priority
            />
            <span>
              <strong>UNDONE</strong>
              <em>For a more curious you.</em>
            </span>
          </Link>
          <button
            type="button"
            className={builderStyles.railToggle}
            onClick={() => setCollapsed(value => !value)}
            aria-label={collapsed ? 'Expand conversation' : 'Collapse conversation'}
            aria-expanded={!collapsed}
          >
            {collapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}
          </button>
        </header>

        <div className={builderStyles.railBody}>
          <div className={builderStyles.messages}>
            <div className={`${builderStyles.messageRow} ${builderStyles.messageUser}`}>
              <div className={builderStyles.userBubble}>
                <p>{draft?.prompt || 'I’m looking for something new to learn.'}</p>
              </div>
            </div>

            <div className={`${builderStyles.messageRow} ${builderStyles.messageAssistant}`}>
              <div className={builderStyles.assistantSparkleWrapper} aria-hidden="true">
                <Sparkles size={18} className={builderStyles.sparkleIcon} />
              </div>
              <div className={builderStyles.assistantBubble}>
                <p>Let’s make a learning journey that fits you.</p>
                {busy && !isPlanMode && (
                  <ol className={builderStyles.chatStepChecklist} aria-label="Assistant progress steps">
                    <li className={builderStyles.chatStepItem} data-step-state="running">
                      <span className={builderStyles.stepMarker} aria-hidden="true">
                        <span className={builderStyles.stepSpinner} />
                      </span>
                      <span className={builderStyles.stepLabel}>Processing your query</span>
                    </li>
                    <li className={builderStyles.chatStepItem} data-step-state="pending">
                      <span className={builderStyles.stepMarker} aria-hidden="true">
                        <span className={builderStyles.stepPendingDot} />
                      </span>
                      <span className={builderStyles.stepLabel}>Understanding your learning goal</span>
                    </li>
                    <li className={builderStyles.chatStepItem} data-step-state="pending">
                      <span className={builderStyles.stepMarker} aria-hidden="true">
                        <span className={builderStyles.stepPendingDot} />
                      </span>
                      <span className={builderStyles.stepLabel}>Searching cohorts for you</span>
                    </li>
                  </ol>
                )}
              </div>
            </div>

            <div className={builderStyles.hint}>
              <Lightbulb size={27} strokeWidth={1.3} aria-hidden="true" />
              <div>
                <strong>Why these?</strong>
                <p>We search public cohorts for your learning intent. You can join a match or create your own.</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Right Workspace Canvas matching AI Builder Workspace */}
      {!isCenteredHandoff && (
```

---

### Step `S5`: Add Interactive Multi-Step Progress Checklist, Search Response Bubble & Implicit Cohort-Start Detection in `ChatPane.tsx`

**File:** `src/client/screens/cohortBuilder/ChatPane.tsx`

Update `src/client/screens/cohortBuilder/ChatPane.tsx` with the following complete implementation:

```tsx
'use client';
import { useFailureToast } from '@/src/client/hooks/useFailureToast';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ArrowUp, BookOpen, Check, LoaderCircle, Paperclip, Square, X } from 'lucide-react';
import { useWorkspaceMessages, useSendMessage, useInteractionState, useDispatchAction } from '@/src/client/interaction/hooks';
import type { CohortAction, CohortWorkspace } from '@/src/shared/cohort-builder/contracts';
import { useComposerAttachments, AttachmentTray } from '@/src/client/components/global/Composer';
import { useAssistantActivity } from './useAssistantActivity';
import { sourceAttachmentAction } from './source-attachment-action';
import { stageSuggestions } from './chat-suggestions';
import type { EntityRef } from 'interaction-builder/core';
import styles from './CohortBuilder.module.css';
import { ProcessingChecklist } from './stages/ProcessingChecklist';
import dynamic from 'next/dynamic';
import { ChatMarkdown as StaticChatMarkdown } from './components/ChatMarkdown';

const DynamicChatMarkdown = dynamic(
  () => import('./components/ChatMarkdown').then((m) => m.ChatMarkdown),
  {
    loading: () => <span className="opacity-60 text-sm">...</span>,
  }
);

const ChatMarkdown = typeof process !== 'undefined' && process.env.NODE_ENV === 'test' ? StaticChatMarkdown : DynamicChatMarkdown;

interface AttachedEntity {
  entity: EntityRef;
  label: string;
}

interface ChatPaneProps {
  attachedEntity: AttachedEntity | null;
  onClearAttachedEntity: () => void;
  connection?: string;
}

export interface ChatProgressStep {
  id: string;
  label: string;
  state: 'pending' | 'running' | 'complete';
}

/** Detects when a user message in chat explicitly or implicitly asks to start/create a cohort or pick a starting branch. */
export function detectImplicitCohortStartAction(
  text: string,
  step: CohortWorkspace['journey'] extends { step: infer S } | undefined ? S | undefined : string | undefined
): CohortAction | null {
  if (step !== 'chat' && step !== 'recommendations') return null;
  const trimmed = text.trim();
  if (!trimmed || trimmed.endsWith('?')) return null;

  if (/\b(?:i\s+(?:already\s+)?have\s+(?:my\s+own\s+)?materials?|use\s+my\s+(?:own\s+)?(?:materials?|sources?|links?|files?))\b/i.test(trimmed)) {
    return { type: 'choose_starting_point', choice: 'have_material' };
  }

  if (/\b(?:find\s+materials?\s+for\s+me|start\s+with\s+a\s+goal)\b/i.test(trimmed)) {
    return { type: 'choose_starting_point', choice: 'find_material' };
  }

  if (
    /\b(?:create|start|build|make|launch|open)\s+(?:a\s+|an\s+|my\s+|our\s+|the\s+|own\s+)*(?:new\s+|custom\s+|own\s+)*(?:cohort|course|curriculum|studio)\b/i.test(trimmed) ||
    /\bcreate\s+my\s+own\b/i.test(trimmed) ||
    /\blet'?s\s+(?:start|build|create|make)\s+(?:it|this|one|a\s+cohort)\b/i.test(trimmed)
  ) {
    return { type: 'create_own_cohort' };
  }

  return null;
}

function buildTurnProgressSteps(
  latestUserText: string,
  step: string | undefined,
  hasLessons: boolean,
  activePhaseIndex: number
): ChatProgressStep[] {
  const isCohortStart = /\b(?:start|create|build|make|launch)\b.*\b(?:cohort|course|curriculum|studio)\b|\bcreate\s+my\s+own\b/i.test(latestUserText);
  const isCohortSearch = /\b(?:search|find|look\s+for|similar|browse)\b.*\bcohorts?\b/i.test(latestUserText);

  const step2Label = isCohortStart
    ? 'Preparing cohort creation studio'
    : isCohortSearch
    ? 'Understanding your learning goal'
    : step === 'review' || step === 'ready' || hasLessons
    ? 'Reviewing your curriculum structure'
    : step === 'material_input' || step === 'discovery'
    ? 'Analyzing your learning sources'
    : 'Mapping your learning pathway';

  const step3Label = isCohortStart
    ? 'Opening cohort studio'
    : isCohortSearch
    ? 'Looking for similar cohorts'
    : 'Drafting tailored response';

  const labels = ['Processing your query', step2Label, step3Label];

  return labels.map((label, idx) => ({
    id: `turn-step-${idx}`,
    label,
    state: idx < activePhaseIndex ? 'complete' : idx === activePhaseIndex ? 'running' : 'pending',
  }));
}

function ChatStepChecklist({ steps, ariaLabel = 'Assistant progress steps' }: { steps: ChatProgressStep[]; ariaLabel?: string }) {
  return (
    <ol className={styles.chatStepChecklist} aria-label={ariaLabel}>
      {steps.map(item => (
        <li
          key={item.id}
          className={styles.chatStepItem}
          data-step-state={item.state}
          aria-current={item.state === 'running' ? 'step' : undefined}
        >
          <span className={styles.stepMarker} aria-hidden="true">
            {item.state === 'complete' ? (
              <Check size={12} strokeWidth={2.8} className={styles.stepCheckIcon} />
            ) : item.state === 'running' ? (
              <LoaderCircle size={14} strokeWidth={2.4} className={styles.stepSpinnerIcon} />
            ) : (
              <span className={styles.stepPendingDot} />
            )}
          </span>
          <span className={styles.stepLabel}>{item.label}</span>
        </li>
      ))}
    </ol>
  );
}

export function ChatPane({ attachedEntity, onClearAttachedEntity }: ChatPaneProps) {
  const messages = useWorkspaceMessages();
  const sendMessage = useSendMessage();
  const dispatchAction = useDispatchAction<CohortAction>();
  const state = useInteractionState<CohortWorkspace>();
  const activity = useAssistantActivity();
  const previousRuns = useRef(new Map<string, string>());
  const [runFailure, setRunFailure] = useState('');
  useFailureToast(runFailure, 'The assistant could not finish. Saved changes remain; send a follow-up to continue.', 'AssistantRun');
  useEffect(() => {
    for (const turn of activity.turns) {
      if (!turn.runId) continue;
      const previous = previousRuns.current.get(turn.runId);
      if (previous && previous !== 'failed' && turn.status === 'failed') setRunFailure(turn.runId);
      previousRuns.current.set(turn.runId, turn.status);
    }
  }, [activity.turns]);
  const [cancelError, setCancelError] = useState('');
  const [sendError, setSendError] = useState('');
  useFailureToast(sendError, 'Could not send. Your draft is kept; retry when ready.', 'ChatSend');
  useFailureToast(cancelError, 'Could not confirm Stop. Check the current run before retrying.', 'ChatStop');
  const committedSourceIds = useRef(new Set<string>());
  const activeTurn = activity.turns.find(turn => turn.status === 'running' || turn.status === 'queued');
  const selected = attachedEntity && state.view?.lessons.find(lesson => lesson.id === attachedEntity.entity.id);
  const staleSelection = !!attachedEntity && (!selected || selected.version !== attachedEntity.entity.version);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const nearBottom = useRef(true);
  const isInitialMount = useRef(true);
  const showsProcessing = state.view?.journey?.step === 'processing' || state.view?.journey?.step === 'ready';

  const composerAttachments = useComposerAttachments({ maxFiles: 10, maxLinks: 20 });

  const step = state.view?.journey?.step;
  const recommendations = state.view?.recommendations;
  const isRecommendationsSearching =
    step === 'recommendations' &&
    (!recommendations || recommendations.status === 'queued' || recommendations.status === 'running');

  // Interactive phase progression for cohort search checklist
  const [searchLeadPhase, setSearchLeadPhase] = useState<number>(() => (isRecommendationsSearching ? 1 : 2));
  useEffect(() => {
    if (!isRecommendationsSearching) {
      setSearchLeadPhase(2);
      return;
    }
    setSearchLeadPhase(1);
    const timer = setTimeout(() => {
      setSearchLeadPhase(2);
    }, 550);
    return () => clearTimeout(timer);
  }, [isRecommendationsSearching, state.view?.journey?.intentVersion]);

  // Interactive phase progression for general AI assistant turns
  const [turnPhaseIndex, setTurnPhaseIndex] = useState(0);
  useEffect(() => {
    if (!activeTurn) {
      setTurnPhaseIndex(0);
      return;
    }
    setTurnPhaseIndex(0);
    const t1 = setTimeout(() => setTurnPhaseIndex(1), 650);
    const t2 = setTimeout(() => setTurnPhaseIndex(2), 1600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [activeTurn?.runId, activeTurn?.status]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      if (scrollRef.current) {
        scrollRef.current.scrollTop = showsProcessing ? scrollRef.current.scrollHeight : 0;
      }
      return;
    }
    if (scrollRef.current && nearBottom.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, showsProcessing, recommendations?.status]);

  const handleSend = async (customText?: string) => {
    if (sending || staleSelection || composerAttachments.isExtracting) return;
    const readySources = composerAttachments.getReadySources();
    const rawText = customText ?? input;
    let textToSend = rawText.trim();

    if (!textToSend && !attachedEntity && readySources.length === 0) return;

    if (!textToSend && readySources.length > 0) {
      textToSend = readySources.length === 1
        ? `I attached ${readySources[0].label} as reference material.`
        : `I attached ${readySources.length} reference materials for our study plan.`;
    }

    setSending(true);

    try {
      setSendError('');
      for (const source of readySources) {
        if (committedSourceIds.current.has(source.id) || state.view?.sources.some(item => item.id === source.id)) continue;
        const ok = await dispatchAction(sourceAttachmentAction(source));
        if (!ok) throw new Error('Could not save an attachment. Your message and attachments are kept; retry.');
        committedSourceIds.current.add(source.id);
      }

      const implicitStageAction = detectImplicitCohortStartAction(textToSend, step);
      if (implicitStageAction) {
        void dispatchAction(implicitStageAction);
      }

      const sourceRefs: Array<{ entity: EntityRef; label: string }> = readySources.map(s => ({
        entity: { kind: 'source', id: s.id, version: state.view?.sources.find(source => source.id === s.id)?.version ?? 0 },
        label: s.label,
      }));
      const entityRefs = [
        ...(attachedEntity ? [attachedEntity] : []),
        ...sourceRefs,
      ];
      const ok = await sendMessage(textToSend, entityRefs);
      if (ok) {
        if (!customText) setInput(current => current === rawText ? '' : current);
        composerAttachments.clearAll();
        onClearAttachedEntity();
        committedSourceIds.current.clear();
      }
    } catch (error) {
      setSendError(error instanceof Error ? error.message : 'Could not send. Please retry.');
    } finally {
      setSending(false);
    }
  };

  async function stopAssistant() {
    if (!activeTurn?.runId) return;
    setCancelError('');
    try {
      const response = await fetch(`/api/interaction/v1/workspaces/${state.workspaceId}/runs/${activeTurn.runId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Stopped by user' }),
      });
      if (!response.ok) throw new Error('Could not stop assistant; retry.');
    } catch (error) {
      setCancelError(error instanceof Error ? error.message : 'Could not stop assistant');
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void handleSend();
    }
  };

  const goal = state.view?.intent?.trim();
  const lessons = state.view?.lessons ?? [];
  const hasAssistantMessage = messages.some(message => message.role === 'assistant');
  const latestAssistantText = messages.filter(message => message.role === 'assistant').at(-1)?.parts
    .filter(part => part.type === 'text').map(part => part.text).join(' ') ?? '';
  const asksAboutBackground = /\b(background|experience|familiar|prerequisites)\b/i.test(latestAssistantText);

  const latestMessage = messages.at(-1);
  const latestUserText = useMemo(() => {
    const lastUser = [...messages].reverse().find(m => m.role === 'user');
    return lastUser?.parts.filter(p => p.type === 'text').map(p => p.text).join(' ') ?? goal ?? '';
  }, [messages, goal]);

  const showSearchActivityBubble =
    step === 'recommendations' ||
    (!!state.view?.journey &&
      step !== 'chat' &&
      step !== 'processing' &&
      step !== 'ready' &&
      !hasAssistantMessage &&
      (messages.length > 0 || !!recommendations));

  const searchChecklistSteps: ChatProgressStep[] = useMemo(() => {
    if (isRecommendationsSearching) {
      return [
        { id: 'search-query', label: 'Processing your query', state: 'complete' },
        {
          id: 'search-goal',
          label: 'Understanding your learning goal',
          state: searchLeadPhase >= 2 ? 'complete' : 'running',
        },
        {
          id: 'search-cohorts',
          label: 'Searching cohorts for you',
          state: searchLeadPhase >= 2 ? 'running' : 'pending',
        },
      ];
    }
    return [
      { id: 'search-query', label: 'Processing your query', state: 'complete' },
      { id: 'search-goal', label: 'Understanding your learning goal', state: 'complete' },
      { id: 'search-cohorts', label: 'Searching cohorts for you', state: 'complete' },
    ];
  }, [isRecommendationsSearching, searchLeadPhase]);

  const searchSummaryMarkdown = useMemo(() => {
    if (isRecommendationsSearching) return null;
    const topicLabel = goal || 'your learning goal';
    if (step === 'recommendations') {
      if (recommendations?.status === 'failed') {
        return `I couldn’t finish searching public cohorts for **${topicLabel}** right now. I’ve opened the studio panel on the right where you can retry the search or create your own cohort directly.`;
      }
      const matchCount = recommendations?.items?.length ?? 0;
      if (matchCount > 0) {
        return `I found **${matchCount}** matching community ${matchCount === 1 ? 'cohort' : 'cohorts'} for **${topicLabel}** and opened them on the right. You can join one directly, or click **Create your own cohort** to build a custom curriculum.`;
      }
      return `I searched our public cohorts for **${topicLabel}**, and no matching community cohorts exist yet. I’ve opened the studio on the right — click **Create your own cohort** (or tell me here how you’d like to start) to launch the first one!`;
    }
    return `I’ve opened the cohort studio on the right for **${topicLabel}**. Choose your starting point on the canvas or tell me what materials and goals you have in mind!`;
  }, [isRecommendationsSearching, goal, step, recommendations?.status, recommendations?.items?.length]);

  const isLatestUser = latestMessage?.role === 'user' && !showSearchActivityBubble;
  const hasActiveTurn =
    activity.turns.some(t => t.status === 'pending' || t.status === 'queued' || t.status === 'running') ||
    !!activeTurn;
  const showSuggestions =
    !sending &&
    !hasActiveTurn &&
    !isRecommendationsSearching &&
    !composerAttachments.isExtracting &&
    !isLatestUser;

  const suggestions = stageSuggestions(step, {
    goal,
    firstLessonTitle: lessons[0]?.title,
    asksAboutBackground,
  });

  const turnChecklistSteps = useMemo(
    () => buildTurnProgressSteps(latestUserText, step, lessons.length > 0, turnPhaseIndex),
    [latestUserText, step, lessons.length, turnPhaseIndex]
  );

  const placeholder = step === 'chat'
    ? 'What do you want to learn? Ask a question, explore topics, or paste links...'
    : step === 'recommendations'
    ? 'Describe what you want to learn...'
    : step === 'starting_point'
    ? 'Describe your starting point or material...'
    : step === 'material_input'
    ? 'Say anything...'
    : step === 'discovery'
    ? 'Refine your search or ask about sources...'
    : step === 'goal_setup'
    ? 'Describe your goal, pacing, or background...'
    : 'Type an instruction or request...';

  return (
    <div className={styles.railBody}>
      <div
        className={styles.messages}
        ref={scrollRef}
        onScroll={() => {
          const node = scrollRef.current;
          if (node) nearBottom.current = node.scrollHeight - node.scrollTop - node.clientHeight < 80;
        }}
      >
        {messages.map(m => {
            const isUser = m.role === 'user';
            return (
              <div
                key={m.id}
                className={`${styles.messageRow} ${isUser ? styles.messageUser : styles.messageAssistant}`}
              >
                {!isUser && (
                  <div className={styles.assistantSparkleWrapper} aria-hidden="true">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/undone-logo.svg"
                      alt=""
                      aria-hidden="true"
                      width={20}
                      height={20}
                      className={styles.assistantMark}
                    />
                  </div>
                )}
                {isUser && (
                  (() => {
                    const entityParts = m.parts.filter(
                      (p): p is Extract<typeof p, { type: 'entity_ref' }> => p.type === 'entity_ref' && !!p.entity
                    );
                    if (entityParts.length === 0) return null;
                    return (
                      <div className={styles.userAttachmentsRow} role="group" aria-label="Attached references">
                        {entityParts.map((p, idx) => {
                          const isSource = p.entity.kind === 'source';
                          const fullTitle = p.label ?? p.entity.id;
                          return (
                            <button
                              type="button"
                              key={idx}
                              className={isSource ? styles.sourceAttachmentChip : styles.entityChip}
                              data-entity-id={p.entity.id}
                              data-entity-version={p.entity.version}
                              title={isSource ? `Source: ${fullTitle}` : `Lesson: ${fullTitle}`}
                              aria-label={isSource ? `Source: ${fullTitle}` : `Lesson: ${fullTitle}`}
                              onClick={() => {
                                if (isSource) return;
                                const targetId = p.entity.id.startsWith('lesson-') ? p.entity.id : `lesson-${p.entity.id}`;
                                document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth' });
                              }}
                            >
                              {isSource ? (
                                <Paperclip size={11} className={styles.entityChipIcon} aria-hidden="true" />
                              ) : (
                                <BookOpen size={11} className={styles.entityChipIcon} aria-hidden="true" />
                              )}
                              <span className={styles.entityChipText}>{fullTitle}</span>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })()
                )}
                <div className={isUser ? styles.userBubble : styles.assistantBubble}>
                  {isUser && !m.parts.some(p => p.type === 'text' && p.text.trim()) && (
                    <p className={styles.userText}>Shared reference materials</p>
                  )}
                  {m.parts.map((p, idx) => {
                    if (p.type === 'text') {
                      return isUser ? (
                        <p key={idx} className={styles.userText}>{p.text}</p>
                      ) : (
                        <ChatMarkdown key={idx} content={p.text} />
                      );
                    }
                    if (p.type === 'entity_ref' && p.entity && !isUser) {
                      const isSource = p.entity.kind === 'source';
                      const fullTitle = p.label ?? p.entity.id;
                      const entityId = p.entity.id;
                      const entityVersion = p.entity.version;
                      return (
                        <div key={idx} className={styles.chipsContainer}>
                          <button
                            type="button"
                            className={isSource ? styles.sourceAttachmentChip : styles.entityChip}
                            data-entity-id={entityId}
                            data-entity-version={entityVersion}
                            title={isSource ? `Source: ${fullTitle}` : `Lesson: ${fullTitle}`}
                            aria-label={isSource ? `Source: ${fullTitle}` : `Lesson: ${fullTitle}`}
                            onClick={() => {
                              if (isSource) return;
                              const targetId = entityId.startsWith('lesson-') ? entityId : `lesson-${entityId}`;
                              if (typeof window !== 'undefined') {
                                window.dispatchEvent(
                                  new CustomEvent('cohort:highlight-entity', {
                                    detail: { entityId, targetId, kind: p.entity?.kind ?? 'lesson' },
                                  })
                                );
                              }
                              const target = document.getElementById(targetId) || document.getElementById(entityId);
                              if (target) {
                                target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                target.focus?.();
                              }
                            }}
                          >
                            {isSource ? (
                              <Paperclip size={12} className={styles.entityChipIcon} aria-hidden="true" />
                            ) : (
                              <BookOpen size={12} className={styles.entityChipIcon} aria-hidden="true" />
                            )}
                            <span className={styles.entityChipPrefix}>{isSource ? 'Source:' : 'Lesson:'}</span>
                            <span className={styles.entityChipText}>{fullTitle}</span>
                          </button>
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
              </div>
            );
          })}

        {showSearchActivityBubble && (
          <div className={`${styles.messageRow} ${styles.messageAssistant}`} role="status" aria-live="polite">
            <div className={styles.assistantSparkleWrapper} aria-hidden="true">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/undone-logo.svg"
                alt=""
                aria-hidden="true"
                width={20}
                height={20}
                className={styles.assistantMark}
              />
            </div>
            <div className={styles.assistantBubble}>
              <ChatStepChecklist steps={searchChecklistSteps} ariaLabel="Cohort search progress" />
              {searchSummaryMarkdown && <ChatMarkdown content={searchSummaryMarkdown} />}
            </div>
          </div>
        )}

        {(step === 'processing' || step === 'ready') && state.view && (
          <ProcessingChecklist workspace={state.view} />
        )}

        {activeTurn && (
          <div className={`${styles.messageRow} ${styles.messageAssistant}`} role="status" aria-live="polite">
            <div className={styles.assistantSparkleWrapper} aria-hidden="true">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/undone-logo.svg"
                alt=""
                aria-hidden="true"
                width={20}
                height={20}
                className={styles.assistantMark}
              />
            </div>
            <div className={styles.assistantBubble}>
              <ChatStepChecklist steps={turnChecklistSteps} ariaLabel="Assistant turn progress" />
              <div className={styles.thinkingContainer}>
                <div className={styles.thinkingDots} aria-label="Thinking">
                  <span className={styles.dot} />
                  <span className={styles.dot} />
                  <span className={styles.dot} />
                </div>
                <span className={styles.thinkingLabel}>
                  Thinking…
                </span>
                <button
                  type="button"
                  className={styles.stopButton}
                  onClick={() => void stopAssistant()}
                  aria-label="Stop assistant turn"
                  title="Stop assistant turn"
                >
                  <Square size={11} fill="currentColor" aria-hidden="true" /> Stop
                </button>
              </div>
              {activity.turns.filter(turn => turn.status === 'pending').length > 0 && (
                <span className={styles.queuedBadge}>
                  {activity.turns.filter(turn => turn.status === 'pending').length} follow-up queued
                </span>
              )}
            </div>
          </div>
        )}
        {staleSelection && (
          <div className={styles.chatAlertRow} role="alert">
            <span>Selected lesson changed or was removed. Clear the selection, then select its current version.</span>
          </div>
        )}
      </div>

      <div className={styles.composerArea}>
        {showSuggestions && suggestions.length > 0 && (
          <div className={styles.suggestions} role="group" aria-label="Suggested next steps">
            {suggestions.slice(0, 3).map(s => (
              <button
                key={s.id}
                type="button"
                onClick={() => void handleSend(s.prompt)}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}

        <form
          className={styles.composerCard}
          onSubmit={e => {
            e.preventDefault();
            void handleSend();
          }}
        >
          {attachedEntity && (
            <div className={styles.activeRefBar}>
              <span>
                Referencing: <strong>{attachedEntity.label}</strong>
              </span>
              <button type="button" className={styles.clearRefBtn} onClick={onClearAttachedEntity}>
                <X size={14} /> Clear
              </button>
            </div>
          )}

          {composerAttachments.files.length > 0 && (
            <div className={styles.attachmentTraySection}>
              <AttachmentTray
                files={composerAttachments.files}
                onRemoveFile={composerAttachments.removeFile}
                disabled={sending}
              />
            </div>
          )}

          <div className={styles.composerInputRow}>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.txt,.md,.json,application/pdf,text/plain,text/markdown,application/json"
              style={{ display: 'none' }}
              onChange={e => {
                if (e.target.files) void composerAttachments.addFiles(e.target.files);
                e.target.value = '';
              }}
            />

            <button
              type="button"
              className={styles.attachBtn}
              onClick={() => fileInputRef.current?.click()}
              title="Attach reference files (.pdf, .txt, .md, .json)"
              aria-label="Attach reference file"
              disabled={sending || composerAttachments.isExtracting}
            >
              <Paperclip size={18} />
            </button>

            <textarea
              ref={textareaRef}
              aria-label="Message the cohort assistant"
              placeholder={placeholder}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              aria-busy={sending || composerAttachments.isExtracting}
              className={styles.composerTextarea}
            />

            <button
              type="submit"
              aria-label="Send message"
              className={styles.sendBtn}
              disabled={
                sending ||
                staleSelection ||
                composerAttachments.isExtracting ||
                (!input.trim() && !attachedEntity && composerAttachments.getReadySources().length === 0)
              }
            >
              <ArrowUp size={18} strokeWidth={2.4} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

---

### Step `S6`: Add Stepper Checklist & Right-Panel Pop-Open Styles in `CohortBuilder.module.css`

**File:** `src/client/screens/cohortBuilder/CohortBuilder.module.css`

Append the following CSS classes to the end of `src/client/screens/cohortBuilder/CohortBuilder.module.css`:

```css
/* ==========================================================================
   Interactive AI Chat Stepper Checklist & Right Panel Pop-Open Animation
   ========================================================================== */

.chatStepChecklist {
  list-style: none !important;
  margin: 4px 0 14px 0 !important;
  padding: 12px 16px !important;
  display: flex;
  flex-direction: column;
  gap: 10px;
  border-radius: 16px;
  background: color-mix(in srgb, var(--creation-surface, #fffcf7) 88%, transparent);
  border: 1px solid color-mix(in srgb, var(--creation-line, #e9e0d5) 85%, transparent);
  box-shadow: 0 2px 8px rgba(8, 20, 61, 0.04);
  max-width: 440px;
}

.chatStepItem {
  display: flex;
  align-items: center;
  gap: 11px;
  margin: 0 !important;
  font-size: 13.5px;
  line-height: 1.35;
  color: var(--creation-muted, #536788);
  transition: color 0.2s ease, opacity 0.2s ease;
}

.chatStepItem[data-step-state='pending'] {
  opacity: 0.6;
}

.chatStepItem[data-step-state='running'] {
  color: var(--creation-ink, #08143d);
  font-weight: 650;
}

.chatStepItem[data-step-state='complete'] {
  color: var(--creation-ink, #08143d);
  font-weight: 600;
}

.stepMarker {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease, transform 0.2s ease;
}

.chatStepItem[data-step-state='pending'] .stepMarker {
  border: 1.5px solid color-mix(in srgb, var(--creation-muted, #536788) 45%, transparent);
  background: transparent;
}

.chatStepItem[data-step-state='running'] .stepMarker {
  border: 1.5px solid color-mix(in srgb, var(--creation-blue, #303cff) 35%, transparent);
  background: color-mix(in srgb, var(--creation-blue, #303cff) 10%, transparent);
  color: var(--creation-blue, #303cff);
}

.chatStepItem[data-step-state='complete'] .stepMarker {
  background: var(--creation-blue, #303cff);
  border: 1.5px solid var(--creation-blue, #303cff);
  color: #ffffff;
}

.stepPendingDot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--creation-muted, #536788) 45%, transparent);
}

.stepSpinner {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid color-mix(in srgb, var(--creation-blue, #303cff) 25%, transparent);
  border-top-color: var(--creation-blue, #303cff);
  animation: chatStepSpin 0.8s linear infinite;
}

.stepSpinnerIcon {
  animation: chatStepSpin 0.85s linear infinite;
}

.stepCheckIcon {
  display: block;
}

.stepLabel {
  margin: 0 !important;
  font-size: 13.5px !important;
  line-height: 1.35 !important;
  color: inherit !important;
}

@keyframes chatStepSpin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes canvasPopOpen {
  from {
    opacity: 0;
    transform: translateX(18px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@media (prefers-reduced-motion: no-preference) {
  .page[data-layout='split'] .canvas {
    animation: canvasPopOpen 0.28s cubic-bezier(0.22, 1, 0.36, 1) both;
  }
}
```

---

### Step `S7`: Strengthen Implicit Cohort-Start Directives in `context.ts` and `tools.ts`

**File 1:** `src/server/domain/cohort-builder/context.ts`

In `src/server/domain/cohort-builder/context.ts` (lines 81–96), replace:

```ts
2. CONVERSATIONAL CO-DESIGN:
   - ${
     state.journey?.step === 'chat'
       ? 'You are in conversational planning mode. Brainstorm ideas, answer questions, and outline proposed study plans directly in your markdown response. When the user explicitly asks to create, make, or build a cohort (e.g., "let\'s make a cohort"), transition into the creation studio by calling create_own_cohort (which will open material input directly if links/sources are already saved, or open the starting point) or choose_starting_point. Never call add_lesson during conversational chat, and never claim you populated a right-hand curriculum canvas while in chat.'
       : 'Collaborate naturally with the user to shape their learning goal, audience, daily commitment, source materials, and lesson sequence.'
   }
```

with:

```ts
2. CONVERSATIONAL CO-DESIGN:
   - ${
     state.journey?.step === 'chat' || state.journey?.step === 'recommendations'
       ? 'You are in conversational planning/intake mode. Brainstorm ideas, answer questions, and outline proposed study plans directly in your markdown response. Whenever the user asks or implies that they want to start, create, make, or build a cohort (e.g., "let\'s make a cohort", "I want to start a cohort", "create my own"), immediately open the right-hand creation studio by calling create_own_cohort (which opens material input directly if links/sources are already saved, or opens starting point selection) or choose_starting_point. Never call add_lesson during conversational chat, and never claim you populated a right-hand curriculum canvas while in chat.'
       : 'Collaborate naturally with the user to shape their learning goal, audience, daily commitment, source materials, and lesson sequence.'
   }
```

**File 2:** `src/server/domain/cohort-builder/tools.ts`

In `src/server/domain/cohort-builder/tools.ts` (lines 160–169), replace:

```ts
    create_own_cohort: tool({
      description: 'Navigate from recommendations to starting point selection.',
      inputSchema: z.object({}),
      execute: async () => executeAction('create_own_cohort', {}, { type: 'create_own_cohort' }),
    }),
    choose_starting_point: tool({
      description: 'Choose starting point branch: have_material, find_material, or have_goal.',
      inputSchema: z.object({ choice: z.enum(['have_material', 'find_material', 'have_goal']) }),
      execute: async ({ choice }: any) => executeAction('choose_starting_point', { choice }, { type: 'choose_starting_point', choice }),
    }),
```

with:

```ts
    create_own_cohort: tool({
      description: 'Open the right-hand cohort creation studio (navigating from chat or recommendations into material input if sources exist, or starting point selection) when the user asks or implies they want to start, create, or build a cohort.',
      inputSchema: z.object({}),
      execute: async () => executeAction('create_own_cohort', {}, { type: 'create_own_cohort' }),
    }),
    choose_starting_point: tool({
      description: 'Open the cohort studio and choose a starting point branch: have_material, find_material, or have_goal.',
      inputSchema: z.object({ choice: z.enum(['have_material', 'find_material', 'have_goal']) }),
      execute: async ({ choice }: any) => executeAction('choose_starting_point', { choice }, { type: 'choose_starting_point', choice }),
    }),
```

---

## D. Test Suite Updates & New Regression Tests

### Step `S8`: Update Client Tests & Add Regression Coverage

#### 1. `src/client/screens/cohortBuilder/__tests__/shell.test.tsx`

In `src/client/screens/cohortBuilder/__tests__/shell.test.tsx`, update lines 281–323 so that:
- When `journey.step === 'recommendations'` and `recommendations` is still searching (`undefined` / `'queued'`), `data-layout` stays `'centered'`.
- As soon as `recommendations.status` becomes `'ready'`, `data-layout` transitions to `'split'` (`Tadada~`).
- In the close-panel modal test (`PLAN-024`), `recommendations` has `status: 'ready'` so the split panel is open.

Replace lines 281–323 of `src/client/screens/cohortBuilder/__tests__/shell.test.tsx`:

```tsx
  fake.view = {
    ...fake.view,
    journey: {
      ...fake.view.journey!,
      step: 'recommendations',
    },
  };
  result.rerender(<CohortInteractionScreen {...props} />);

  // While recommendations are still searching, layout stays centered
  expect(main.getAttribute('data-layout')).toBe('centered');

  // Once recommendations finish searching (status: 'ready'), right panel pops open ('split')
  fake.view = {
    ...fake.view,
    recommendations: {
      requestId: '00000000-0000-0000-0000-000000000001',
      fingerprint: 'fp-ready',
      status: 'ready',
      generation: 0,
      items: [],
    },
  };
  result.rerender(<CohortInteractionScreen {...props} />);

  expect(main.getAttribute('data-layout')).toBe('split');
  expect((composer as HTMLTextAreaElement).value).toBe('My persistent planning draft');
  expect(screen.getByLabelText('Message the cohort assistant')).toBe(composer);
});

it('renders close panel button and opens confirmation modal (PLAN-024)', async () => {
  fake.view = cohortWorkspaceSchema.parse({
    schemaVersion: 1,
    title: 'Explore Recommendations',
    intent: 'Learn ML',
    audience: '',
    dailyMinutes: 25,
    lessons: [],
    journey: {
      version: 1,
      step: 'recommendations',
      branch: null,
      processingStarted: false,
      intentVersion: 0,
    },
    recommendations: {
      requestId: '00000000-0000-0000-0000-000000000001',
      fingerprint: 'fp-ready',
      status: 'ready',
      generation: 0,
      items: [],
    },
  });

  render(<CohortInteractionScreen workspaceId="ws-close-panel" ownerId="owner" initialView={fake.view} />);

  const closeBtn = screen.getByRole('button', { name: /Close workspace panel and return to chat/i });
  expect(closeBtn).toBeDefined();

  // Clicking close button displays confirmation modal
  fireEvent.click(closeBtn);
  expect(screen.getByRole('dialog', { name: /Return to conversational chat/i })).toBeDefined();
  expect(screen.getByText('Return to conversational chat?')).toBeDefined();
  expect(screen.getByRole('button', { name: 'Close panel' })).toBeDefined();
  expect(screen.getByRole('button', { name: 'Keep open' })).toBeDefined();
});
```

#### 2. `src/client/screens/cohortBuilder/__tests__/journey-stages.test.tsx`

In `src/client/screens/cohortBuilder/__tests__/journey-stages.test.tsx`:
- Update lines 179–201 (the zero-match empty state test) to verify the redesigned Image 2 empty state (`A new path starts here.`, `No matching public cohorts were found. Be the first to create a cohort for this intent and start learning with a community.`, `/images/no-cohort-found-illustration.png`, `Create your own cohort`, and the 3 feature pills).
- In `displays recommendations suggestions when in recommendations step` (line 357), set `recommendations: { requestId: '11111111-1111-1111-1111-111111111111', fingerprint: 'fp-1', status: 'ready', generation: 1, items: [] }` on `fake.state` so suggestions are shown after search completes, and verify that clicking `'Create my own'` dispatches `{ type: 'create_own_cohort' }`!

Replace lines 179–201 of `src/client/screens/cohortBuilder/__tests__/journey-stages.test.tsx` with:

```tsx
    it('renders designed empty state when status is "ready" but items is empty', () => {
      const dispatchAction = vi.fn().mockResolvedValue(true);
      const ws = createWorkspace({
        recommendations: {
          requestId: '11111111-1111-1111-1111-111111111111',
          fingerprint: 'fp-1',
          status: 'ready',
          generation: 1,
          items: [],
        },
      });

      render(<RecommendationsStageView workspace={ws} dispatchAction={dispatchAction} />);

      expect(screen.getByText('A new path starts here.')).toBeDefined();
      expect(
        screen.getByText(
          'No matching public cohorts were found. Be the first to create a cohort for this intent and start learning with a community.'
        )
      ).toBeDefined();
      expect(screen.getByText('Bring like-minded learners')).toBeDefined();
      expect(screen.getByText('Organize your learning')).toBeDefined();
      expect(screen.getByText('Build in public (or keep it private)')).toBeDefined();

      const createOwnBtn = screen.getByRole('button', { name: /Create your own cohort/i });
      fireEvent.click(createOwnBtn);
      expect(dispatchAction).toHaveBeenCalledWith({ type: 'create_own_cohort' });
    });
```

And replace lines 357–376 of `src/client/screens/cohortBuilder/__tests__/journey-stages.test.tsx` with:

```tsx
    it('displays recommendations suggestions when in recommendations step and search is ready', () => {
      fake.state = createWorkspace({
        journey: {
          version: 1,
          step: 'recommendations',
          branch: null,
          processingStarted: false,
          intentVersion: 0,
        },
        recommendations: {
          requestId: '11111111-1111-1111-1111-111111111111',
          fingerprint: 'fp-1',
          status: 'ready',
          generation: 1,
          items: [],
        },
      });

      render(<ChatPane attachedEntity={null} onClearAttachedEntity={() => {}} />);

      expect(screen.getByRole('button', { name: 'Advanced options' })).toBeDefined();
      expect(screen.getByRole('button', { name: 'Practical options' })).toBeDefined();
      expect(screen.getByRole('button', { name: 'Create my own' })).toBeDefined();

      fireEvent.click(screen.getByRole('button', { name: 'Advanced options' }));
      expect(fake.sendMessage).toHaveBeenCalledWith('Show more advanced ones', expect.anything());
    });
```

#### 3. `src/client/screens/cohortCreation/__tests__/CreationExperience.test.tsx`

In `src/client/screens/cohortCreation/__tests__/CreationExperience.test.tsx`, update lines 99–109 (`finishes a zero-match search and continues into creating an owned cohort`) to match the updated copy and button label in `RecommendationResults.tsx`:

```tsx
  it('finishes a zero-match search and continues into creating an owned cohort', async () => {
    const running = applyCommand(saved, { type: 'request_recommendations', query: result.intent.rawQuery, requestId: result.requestId });
    saved = applyEvent(running, { type: 'recommendations_received', result: { ...result, items: [] } });
    render(<CreationExperience draftId={draftId} resume />);
    expect(
      await screen.findByText(
        'No matching public cohorts were found. Be the first to create a cohort for this intent and start learning with a community.'
      )
    ).toBeTruthy();
    expect(screen.queryByText('Finding your people…')).toBeNull();
    expect(screen.queryByText('I found a few ways you could jump in.')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /create (my|your) own cohort/i }));
    await screen.findByRole('button', { name: /i already have material/i });
    expect(saved.stage).toBe('starting_point');
  });
```

#### 4. `src/client/screens/cohortBuilder/__tests__/ChatPaneTurnAndInteractive.test.tsx`

In `src/client/screens/cohortBuilder/__tests__/ChatPaneTurnAndInteractive.test.tsx`, add tests verifying:
1. Live multi-step progress checklist (`Processing your query`, `Understanding your learning goal`, `Searching cohorts for you`) during cohort search and ticking all steps (`complete`) + rendering the AI response when `recommendations.status === 'ready'`.
2. Implicit cohort-start intent in chat (`"I want to start a cohort for robotics"`) immediately dispatching `{ type: 'create_own_cohort' }`.

---

## E. Verification Commands & Acceptance Checklist

Run the following verification commands in order:

```powershell
npx vitest run src/client/screens/cohortBuilder/__tests__/shell.test.tsx src/client/screens/cohortBuilder/__tests__/journey-stages.test.tsx src/client/screens/cohortBuilder/__tests__/ChatPaneTurnAndInteractive.test.tsx src/client/screens/cohortCreation/__tests__/CreationExperience.test.tsx
npx vitest run src/shared/cohort-builder src/server/domain/cohort-builder src/client/screens/cohortBuilder
npx tsc --noEmit
```

### Acceptance Checklist
- [ ] Left chat pane always displays an AI response / interactive step checklist during and after cohort search (`no dead chat rail`).
- [ ] AI chat displays interactive step progress (`Processing your query`, intermediate goal/context step, `Searching cohorts for you` / `Looking for similar cohorts`) with spinning indicators (`⭕`) that tick (`✓`) on completion across both cohort search and general AI chat turns.
- [ ] Right workspace panel stays closed (`data-layout="centered"`) while cohort search is in-flight and pops open (`data-layout="split"`) at the exact moment search finishes or the user starts a cohort (`Tadada~`).
- [ ] Typing or clicking an implicit cohort-start message in chat immediately triggers `create_own_cohort` / `choose_starting_point` and opens the right panel.
- [ ] Zero-match recommendations view matches Image 2 (`/images/no-cohort-found-illustration.png`, `"A new path starts here."`, `"No matching public cohorts were found. Be the first to create a cohort for this intent and start learning with a community."`, dark navy pill CTA `+ Create your own cohort →`, and 3-column feature strip).

---

## F. Risk & Rollback Notes

- **Test Compatibility:** Existing tests in `ChatPaneTurnAndInteractive.test.tsx` assert `Thinking…` and `Stop assistant turn` when `activeTurn` is running; keeping `thinkingContainer` alongside `ChatStepChecklist` preserves 100% backward compatibility while adding the live multi-step checklist.
- **Rollback:** All changes are localized to 7 source files and 4 test files; `git checkout -- <file>` cleanly reverts any individual step.
