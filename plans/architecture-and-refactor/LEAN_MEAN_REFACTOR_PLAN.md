# Lean Mean Refactor Plan

Date: 2026-10-31. Status: audit and implementation specification; no refactors performed. Composer restoration repair is explicitly set aside and remains governed by COMPOSER_FINAL_REPAIR_PLAN.md. Do not silently resume that work through this plan.

## 1. Decision and definition of success

Reduce duplicate implementations, obsolete internal copies, repeated configuration, and unnecessary runtime work while preserving every existing feature, route, data format, recovery path, permission boundary, and accessibility behavior. Prefer removing responsibility over adding wrappers. Smaller files alone are not an improvement. Moving 500 lines into five files is not a 500-line reduction.

No honest refactor can promise zero errors. This plan replaces that promise with regression tests, feature parity gates, isolated changes, measured outcomes, and rollback. Do not describe unexecuted tests as passing. Do not downgrade an existing working feature to a placeholder to meet a size target.

### Required accounting for each work package

- Production source net lines and bytes, excluding generated output, lockfiles, documentation, tests, and whitespace-only changes.
- Number of independent implementations/configurations removed.
- Affected features and entry points, before/after behavior evidence.
- Relevant browser JS/CSS transfer size, network requests, and rendering cost where affected; report unmeasured values honestly.
- Tests added for failure modes, not just snapshots of the new implementation.
- No increase in runtime dependencies without a separate justification. This plan requires none.

Target net-negative production code for cleanup packages. A small correctness fix may add lines. Never delete guards, schema validation, concurrency fencing, rollback, or error reporting to achieve a quota. Do not compress readable code into dense one-liners and call it lean.

## 2. Audit coverage and evidence

Read repository memory and inspected runtime composition, source trees, package/build configuration, duplicate files, selected large modules, AI adapters, channel definitions, route caching, and import consumers. This is a repository-wide structural audit plus targeted source inspection, not an exhaustive correctness review of every file.

Snapshot inventory: 2,049 `.ts/.tsx/.css/.mjs` files across src, scripts, interaction-builder/src, notes-board/src, and mobile/src; 1,577 non-test-classified files; 209,544 non-test-classified lines including blanks/comments. This classification includes validation prototypes and tooling, so it is NOT shipped bundle size or a claim that all these lines execute in production. Generated/dist/node_modules directories were excluded. Active workspace changes may move these counts; recompute at implementation start.

Largest inspected hotspots:

| Path | Approx. lines | Interpretation |
|---|---:|---|
| src/client/screens/cohortBuilder/CohortBuilder.module.css | 2,995 | Strong stale-selector investigation candidate |
| src/client/screens/dashboard/createCohort/providers/WizardProvider.tsx | 2,029 | Active route, many responsibilities; NOT disposable legacy |
| src/client/screens/landing/Hero/Hero.module.css | 1,769 | Old composer/card styling remains after component extraction |
| src/client/screens/dashboard/notes/Notes.module.css | 1,527 | Candidate stale legacy/editor styles |
| src/client/screens/dashboard/play/hooks/usePlayback.ts | 1,456 | Complex shared engine; preserve playback protocol |
| src/client/screens/dashboard/message/hooks/useMessage.ts | 1,404 | Realtime/state coordination; characterize before edits |
| src/client/personal-workspace/local/repository.ts | 1,390 | Durability is real complexity, not automatic bloat |
| src/server/domain/studyroom/studyroom.service.ts | 1,250 | Governance and state transitions need parity tests |
| src/server/infrastructure/db/postgres/repositories/interaction.repo.ts | 1,237 | Host-specific guarantees differ from generic adapter |
| src/client/screens/dashboard/notes/validation/indexeddb-prototype.ts | 1,160 | Validation-only consumers found; not a live replacement target |
| src/client/screens/cohortBuilder/stage-selectors.ts | 1,105 | Nine WeakMap caches and repeated derived-data traversals |
| src/client/screens/dashboard/home/components/ChannelHub/ChannelHub.tsx | 992 | Data definitions mixed with presentation and persistence |
| src/client/screens/dashboard/play/components/ChannelSelector.tsx | 912 | Channel definitions plus gesture UI |

### Evidence labels

**Confirmed:** byte-identical duplicate files, observed import chains, repeated ETag pattern, conditional package builds, active wizard route, duplicated adapter mechanics.

**Candidate:** unused dependencies, unreferenced CSS selectors, prototype retirement, further cache/state simplification. These need the specified proof before deletion. Literal search is not a full reachability graph: dynamic imports, bracket property access, CSS composition, framework entry points, workers, and package consumers matter.

No production profiling, full test run, production build, or real-device visual matrix was performed for this planning audit. Do not quote memory's historical test counts or performance claims as current measurements.

## 3. Execution rules

1. Inspect git status in root and packages/interaction-builder; preserve concurrent edits. That package is a Git submodule, not an ordinary root folder. Do not reset or stage unrelated work.
2. Read MEMORY/README.md and subsystem memory before each package; inspect actual source afterward. Memory is an index, not proof of current behavior.
3. First capture a baseline for the affected feature and its focused tests. Stop to distinguish pre-existing failures from introduced ones.
4. One work package per reviewable change. No whole-repository rename, formatter sweep, storage migration, dependency upgrade, or redesign bundled with cleanup.
5. Prefer updating direct consumers and deleting obsolete internal forwarding copies. Preserve public package exports and external URLs. A compatibility shim is justified only by identified external consumers, not hypothetical ones.
6. No new generic framework: no universal fetch client, generic repository base class, catch-all React hook, mega context, or plugin-based pipeline to remove a few repeated lines.
7. Complete deletion includes imports, exports, fixtures, docs references, package metadata and tests; it does not mean deleting historical tests that cover current guarantees.
8. Do not spend paid model/provider quota or mutate production data for a refactor verification without existing authorization. Use local fixtures and mocks at infrastructure boundaries.

## 4. Ordered work packages

| Order | ID | Work | Dependency | Risk |
|---|---|---|---|---|
| 0 | LM-00 | Build/feature baseline | none | low |
| 1 | LM-01 | Two remaining ETag defects | LM-00 | low |
| 2 | LM-02 | Proven duplicate component remnants | LM-00 | low |
| 3 | LM-03 | Evidence-driven CSS pruning | LM-02 | medium |
| 4 | LM-04 | Dependency pruning | LM-00, LM-02 | medium |
| 5 | LM-05 | Reliable smaller build workflow | LM-00 | medium |
| 6 | LM-06 | Shared channel metadata | LM-00 | medium |
| 7 | LM-07 | Consolidate AI execution mechanics | LM-00, LM-05 | medium/high |
| 8 | LM-08 | Selector projections and caches | LM-00 | medium |
| 9 | LM-09 | Large UI/state owners | LM-06, LM-08 where relevant | high |
| 10 | LM-10 | Validation prototype disposition | production parity evidence | medium |
| 11 | LM-11 | Final cross-feature checks | all selected units | high-value gate |

Units 1–5 are the initial execution batch. Review their actual savings before approving high-risk consolidation. This is not a mandate to refactor everything listed.

## LM-00 — Establish a useful baseline, not a new platform

Use existing commands and tools. Capture current commit IDs (root/submodule), git diff scope, dependency lockfile, route list, focused test results, production build output, and representative browser requests. Put transient reports in .tmp/lean-mean/. No custom analytics service.

Feature inventory must cover: anonymous homepage and auth return, authenticated Home, Explore/search, /play desktop/mobile, /create-cohort wizard, /quest builder, Notes offline/cross-device recovery, Messages/realtime, Study Rooms/governance, public/private cohort views and publishing, GitHub account connections, and mobile export/native configuration.

For performance-sensitive changes use the same fixture/browser/network state before and after. Record transferred JS/CSS, long tasks or render counts when relevant, API calls per interaction, and backend query counts. A package removed from package.json does not prove reduced browser JS if it was never imported.

## LM-01 — Finish the small caching correctness repair

Confirmed paths:

- `src/app/api/cohort-builder/workspaces/[workspaceId]/sources/route.ts`: base64(JSON.stringify(payload)).slice(0,24).
- `src/app/api/studyroom/route.ts`: base64(etagPayload).slice(0,24).

These fingerprints ignore changes beyond the first prefix. The activity endpoint has already been corrected; follow its full-payload SHA-256 pattern. No shared cache framework required for two replacements.

```ts
import { createHash } from 'node:crypto';
const etag = `W/"${createHash('sha256')
  .update(JSON.stringify(payload))
  .digest('hex')}"`;
```

For Study Rooms hash the exact response representation selected by query/format, not merely room IDs; occupancy/visible fields must invalidate it. Preserve query-specific cache keys, ownership checks, private/public Cache-Control, response envelope and 304 behavior. Check that micro-cache invalidation still happens on room mutations. Do not simply remove conditional requests or shorten poll intervals.

Tests: same leading payload but changed later capability -> 200/new ETag; unchanged -> 304; studyroom occupancy/title/access-visible data changes -> new ETag; query variants do not cross-contaminate; unauthorized clients cannot receive another user's representation. Update existing sources route tests that currently assert the broken truncated value. Test response behavior, not a fixed algorithm string only.

## LM-02 — Delete proven leftovers after consolidation

Byte-identical pairs found:

1. global/SuggestionPromptRow and landing/Hero/components/SuggestionPromptRow: row TSX, card TSX, and CSS are identical. The landing index already re-exports the global implementation.
2. global/DashboardSectionHeader/SectionHeader.module.css and home/components/SectionHeader/SectionHeader.module.css are identical. Home's TSX already re-exports the global component.
3. global/FriendAvatarGroup/FriendAvatarGroup.module.css and message/components/RightSidebar/FriendAvatarGroup/FriendAvatarGroup.module.css are identical. Message's TSX already re-exports the global component.
4. Explore and Home SectionHeader TSX are identical forwarding files to DashboardSectionHeader.

Use full prefixes under `src/client/components/` or `src/client/screens/` as applicable. Keep the existing global implementations canonical. Search direct file imports, directory barrels, tests, stories and dynamic imports before deleting.

Exact intended edits:

- Remove the three unused concrete landing SuggestionPromptRow copies if no direct consumers remain; migrate any direct consumers to global first.
- Remove unused home SectionHeader CSS and message FriendAvatarGroup CSS after verifying no imports.
- Update FriendsOnline's `../FriendAvatarGroup/FriendAvatarGroup` import to the global barrel; remove that internal forwarding file/directory only after all consumers migrate.
- Point internal SectionHeader consumers directly to DashboardSectionHeader. Remove obsolete local barrels/forwarders only when unreferenced. Do not add another layer of wrappers.

Tests: homepage prompt selection still populates the same field; Home/Explore headings and actions unchanged; FriendsOnline avatar count/names/online markers unchanged. Inspect representative screenshots because module class names may change even with identical CSS. Do not duplicate global tests into every old directory.

## LM-03 — Prune CSS by selector reachability and cascade behavior

Start with Hero.module.css, CohortBuilder.module.css, Notes.module.css. A corrected literal-name scan found candidate stale selectors, NOT proof of dead CSS:

- Hero: old `promptToolbar`, `sourceTextWrapper`, `sourceTextarea`, `intakeErrorBanner`, `cohortCard` and related groups.
- CohortBuilder: `turnStatusNotice`, `stopTurnBtn`, connection badge variants, old lesson-card/source-item groups, `mainContainer`, `leftPane`, `workspaceRegion`.
- Notes: old tree/task/panel selectors, `legacyViewer`, `presentBtn`, `canvasSearch`.

For every group: identify all CSS module importers repo-wide; inspect styles.foo, styles['foo'], computed keys, template literals, :global, composes, nested media rules, animation names, and DOM classes emitted by child/package components. Delete only after proving no reachable use. Do not run a regex purge against all CSS. Do not treat selectors used only at a breakpoint as dead.

Also inspect repeated rules for the SAME selector in the same media/layer context. Consolidate preserving declaration order and specificity; later overrides may be deliberate. Keep existing global @layer order, semantic token aliases, accessibility focus, dark themes, reduced motion, safe-area rules, and native-mobile styling.

No new styling system or utility rewrite. Keep a small deletion list in the change description with consumer proof. Verify screenshots at 375/768/1440px, light/dark, focus/error/loading/expanded states. Run style/cascade tests and relevant route tests. Capture built CSS bytes before/after; source-line reduction alone is insufficient.

## LM-04 — Remove unused direct dependencies, not required runtime plumbing

Literal import inventory found no direct source imports for these candidates: `@reduxjs/toolkit`, `react-redux`, `cmdk`, `dayjs`, `lodash-es`, `lodash.debounce`, `remeda`. Some remain in next.config optimizePackageImports. Verify all configs, scripts, subpackages, imports/requires, and peer requirements with `npm explain <name>` and repo-wide search before removal. Remove associated unused @types only if no consumers remain. Update lockfile through the package manager, not hand-editing.

No-direct-import is NOT removal proof for `@babel/runtime`, `@swc/helpers`, `@prisma/client`, `mongodb`, `tsx`, or `pdfjs-dist`: generated code, frameworks, workers, transitive/peer use and command-line entry points may need them. Preserve these unless a clean-install/build/runtime proof establishes otherwise.

Do NOT remove @google/generative-ai yet: chunking.service.ts and vectorScoring.service.ts still import it. Provider consolidation is a separate behavior-sensitive task, not a mechanical package cleanup. Do not upgrade either SDK incidentally.

Make one small dependency batch; clean install with existing lockfile/toolchain; build both local packages and root; run relevant tests. Preserve development tooling used by the owner, including local path packages, unless specifically shown obsolete. Report install footprint separately from browser bundle savings.

## LM-05 — Make build output trustworthy with less orchestration

Confirmed: root `build:notes` and `build:interaction` rebuild only when dist/index.js is absent. Source changes can leave stale dist. Root TypeScript excludes packages; root typecheck does not verify package source. verify-vercel currently typechecks before prebuild/Prisma generation, then runs conditional package builds. next.config has ignoreBuildErrors:true.

Change the existing scripts rather than adding a build service:

1. Canonical package build commands run actual builds (npm --prefix ... run build), not file-existence checks. Keep force aliases only if external consumers depend on them; otherwise remove duplicated aliases and update callers.
2. Verification order: ensure submodule -> build local packages -> generate Prisma -> package/root typechecks -> focused tests/release suite -> Next production build. Avoid running the same expensive build twice; choose one canonical release command and reuse it.
3. Either remove ignoreBuildErrors after baseline is clean or make the mandatory deployment command enforce typechecks before building. A bypassable optional verification script is not equivalent. Inspect actual Vercel/CI configuration before deciding; do not claim deployment protection from package.json alone.
4. Preserve root-environment loading and workflow compilation behavior; it exists to prevent environment capture errors. Do not remove it as redundant without its dedicated tests.

Checks: change a package source fixture then rebuild and verify the consumed export changes; clean checkout build succeeds; package type error blocks release; root type error blocks release; workflow/node worker --check succeeds; mobile export still follows its configured path. Verify submodule source and pinned commit are both delivered; never ship only root references to uncommitted package work.

## LM-06 — Canonical channel facts without flattening different UIs

Confirmed separate CHANNELS arrays in ChannelHub.tsx and ChannelSelector.tsx. They share IDs/labels/icons but have different descriptions, parameters, ordering, and interaction semantics. homeStorageAdapter already imports canonical IDs/preferences from shared code: extend the existing shared contract where possible instead of adding a parallel source of truth.

Extract only truly identical facts (IDs, common names, stable defaults where equal). Keep Home-specific slider metadata and Play-specific descriptions/order as explicit small projections. Keep React icon components in client code; shared server contracts must not import Lucide or client modules. Do not unify the radial gesture UI with the settings UI.

Before edits, produce a seven-channel table of current IDs, labels, icon mapping, order, parameter IDs/defaults and persisted keys. The icon comment in ChannelSelector currently contradicts its actual map (Default/Coffee vs actual Circle, etc.); preserve current rendered behavior and correct the comment, not the icons, unless separately requested.

Keep homeStorageAdapter as persistence owner. Do not create a second debouncer/cache/provider. Preserve user-scoped config, serialized saves, rollback, legacy reads, and server preference hydration. Tests must cover all channels, mobile gestures/keyboard selection, saved slider round trip, user switch, and Home-to-Play consistency. Accept the extraction only if it reduces duplication and does not increase unrelated route bundles.

## LM-07 — Small shared AI call mechanics, distinct domain validation

Confirmed repetition across vercelCreationAnalysis.ts and vercelCreationChunking.ts: invalid-output classification, two-attempt correction loop, beforeCall/release lifecycle, cancellation, output limit checks, provider error translation. Inspect Understanding/Build/Refinement/GuideAuthor before expanding scope; parameters and policies differ.

Start with Analysis and Chunking only. Extract at most one internal helper in the existing AI directory for identical execution mechanics. Keep prompts, domain input preparation, output schema, validateAnalysis/validateChunkBoundaries, coverage proof, adapterVersion, cache identity, byte limits and user-facing error messages in their owning adapters. No base class, subclass registry, middleware stack or universal workflow abstraction.

Helper contract should be as narrow as the shared behavior: operation callback per attempt plus invalid-output classifier/error translation only if genuinely identical. If it needs many flags to preserve differences, abandon the extraction and retain separate implementations. Require combined production lines to decrease after deleting callers' duplicated loops. Do not use this work to change models, retry counts, concurrency, billing admission, or output budgets.

Tests (mock provider; real domain validators): valid result; malformed output repaired exactly once; nonretryable domain failure not retried; 429 translated correctly; cancellation before admission and during generation; token-length stop rejected; lease release exactly once for each admitted attempt including errors; no partial evidence accepted; over-limit input rejected without truncation. Keep paid-work cache keys/version semantics stable unless output contract actually changes.

## LM-08 — One derived projection where it replaces repeated work

stage-selectors.ts currently maintains multiple WeakMaps for stages, valid chunks/analyses, progress, understanding, chunking, analysis, assembly. Do not replace these blindly with a global cache or delete memoization because it looks verbose.

Profile a fixture with many sources/jobs/chunks while switching stages. Identify repeated source/job grouping and filter passes. If confirmed, compute a shared immutable index once per workspace identity (jobs by source/version, valid chunks, analyses by chunk). Reuse it in existing selectors while keeping their exports and results stable. Preserve separately parameterized selected-source/stage results; do not mix different inspection selections in one cached value.

Keep WeakMap lifetime semantics and clearStageSelectorsCache API if tests/callers use it. Avoid a generic memoization library. Do not mutate workspace objects to attach caches. Snapshot identity must change on domain updates; verify that invariant before relying on identity caches.

Tests: completed old-version jobs do not mark new source ready; queued work never shows ready; legacy snapshots retain behavior; source selection and stage overrides stay isolated; repeated references return stable results where currently promised; different workspace revisions invalidate correctly. Compare pre/post output for a broad fixture matrix and measure traversal counts. If complexity increases without measurable benefit, skip this unit.

## LM-09 — Large state owners: simplify ownership, do not rewrite features

### WizardProvider (active /create-cohort)

The route imports CreateCohort -> WizardProvider. It supports imports, curriculum edits, bulk selection, community/onboarding setup and publishing. It is NOT redundant merely because /quest/build exists. Do not redirect or delete it without complete feature parity, existing-data migration, and separate user approval for product convergence.

Inventory each public action, state field, effect and consumer. Find values derived from other state: replace only provably redundant mirrors with render-time derivation, preserving action ordering and undo/recovery. Shared curriculum transformations already exist under src/shared/curriculum; remove duplicate local logic in favor of those exact functions only after comparing behavior. Do not introduce a reducer framework just to shorten useState declarations. Existing multiple context exports may reduce rerenders; measure before merging them.

### Playback / Messaging

usePlayback and useMessage are coordination engines, not arbitrary large components. Preserve per-channel cancellation, boundary pause, explicit chunk replay, completion acknowledgement/rollback, exclusions, SSE/Centrifugo reconciliation, optimistic IDs, reconnect, and unread state. Identify one duplicated transformation or independently owned resource at a time. Extract only if it removes repeated implementations or makes cleanup/cancellation enforceable in one place. A pile of hooks sharing the same refs is not simpler.

### Study Rooms

Keep governance and membership authorization server-side; preserve session lifecycle, moderation, discovery privacy, shared environment vs personal tools. Consolidate repeated query/projection code only after role/status tests prove equivalent access. Do not deduplicate by replacing stricter predicates with the broadest common query.

For all three: characterization tests before refactor; compare command/event sequences, not just final snapshots. No schema/data migration within this work package. Treat UI file extraction as organizational only unless independent evidence shows smaller bundles or fewer renders.

## LM-10 — Validation prototypes and duplicate repositories

The notes `validation/indexeddb-prototype.ts` is referenced by validation harness/tests, while production uses personal-workspace/local/{database,repository,facade}. That is duplicate conceptual code, but deleting validation proof may remove useful failure scenarios.

List every prototype test scenario. Port any unique invariant test to the real production repository: atomic outbox generation, transaction rollback, offline reopen, asset preservation, conflict retention, and multi-tab coordination. Then retire the prototype and harness only if no live/runtime caller exists and all useful tests now exercise production code. Moving it to a tests folder without deleting duplication improves classification, not total maintainability.

Do NOT merge the host Postgres interaction.repo with the package generic PG/memory/SQLite adapters to save lines. They serve different consumers and guarantees (admission, budget, ownership, lease fencing, domain jobs). First document semantic differences; share tiny pure helpers only when identical. Do not remove testkit adapters needed for package contract tests.

Do NOT merge Postgres/Mongo or replace local-first IndexedDB with server-only storage. Those are persistence architecture migrations with real feature consequences, not lean refactors.

## 5. Feature-preservation gates

| Area | Must remain true |
|---|---|
| Homepage/auth | Draft, links/files, mode, retry identity, auth return URL preserved |
| Home/feed | Pause/resume/order, truthful completion, explicit replay, channel preferences preserved |
| Playback | Desktop/mobile controls, timing boundaries, mute/speed, next/previous, error rollback preserved |
| Creation | Both creation routes work; curriculum edits, sources, processing, review, publish preserved |
| Notes | Offline edit/reopen, assets, export/recovery, GitHub sync, multi-device conflicts preserved |
| Messaging | Durable message IDs, membership, send/retry, reconnect and unread semantics preserved |
| Study Rooms | Discovery/join/leave, roles/moderation, shared/personal controls preserved |
| Security | Auth before sensitive data, private-cache isolation, input/output validation and SSRF boundaries preserved |
| Accessibility | Keyboard navigation, visible focus, announcements, reduced motion, mobile touch/safe areas preserved |
| Package/mobile | Public exports, worker imports, clean installs, export/native integration preserved |

Compatibility is measured by behavior and persisted data, not just exported TypeScript names. Save representative old data fixtures before changing serialization/migration helpers. No working feature can be silently removed because it lacks a test.

## 6. Verification commands and evidence

Use package-local scripts where present; root TypeScript excludes packages. Run commands separately and inspect each exit status. Some integration suites require configured local fixtures; report skipped infrastructure tests explicitly, never substitute production databases.

```powershell
npm run build:notes:force
npm run build:interaction:force
npx tsc --noEmit --incremental false
npm --prefix packages/interaction-builder test
npx vitest run src/app/styles src/client/components/ui
npx vitest run src/client/components/global src/client/screens/landing
npx vitest run src/client/screens/cohortBuilder src/shared/cohort-builder
npx vitest run src/server/infrastructure/ai
npx vitest run src/server/domain/home src/server/domain/feed src/server/domain/progress
npx vitest run src/client/personal-workspace src/shared/personal-workspace
npm run interaction:worker:check
npm run creation:worker:check
npm run messaging:worker:check
npm run build
```

Add affected API route, studyroom, messaging, mobile and notes-package checks as their units execute; locate their existing tests rather than inventing an all-purpose placeholder command. Run full Vitest at the final gate after assessing infrastructure dependencies. Preserve meaningful existing tests even when they become easier to pass through shared implementations.

For CSS/UI changes use actual rendered browser checks, not only jsdom. For concurrency/data code use real transaction/IndexedDB harnesses; mocks that simply report success cannot verify locking, rollback or durability. For dependency/build changes verify a clean install/build separately from a warm workspace with existing dist artifacts.

## 7. What not to do

- No blanket deletion of exports because rg found no literal imports.
- No replacement of specific domain adapters with a 30-option generic helper.
- No global store introduced to remove two local states.
- No error swallowing or fake-success fallback to make tests green.
- No security/cache/validation removal disguised as performance work.
- No test removal merely because the implementation becomes shared.
- No forced unification of desktop/mobile layouts, authoring flows, storage engines or package adapters.
- No claim of runtime speedup from reduced source lines alone.
- No replay of previous composer repair while it is set aside.

## 8. Delivery and rollback

Deliver per-unit diffs with before/after measurements and tests. Update subsystem MEMORY only when ownership/entry points/contracts materially change; do not paste audit logs there. Keep rollback code-only for initial units. Preserve data contracts so reverting a component/cache/helper does not require data repair. If a later change requires schema/data migration, stop and write a separate migration plan with compatibility and rollback before proceeding.

Final report must separate completed, skipped (with reason), and deferred units. State actual production lines/bytes removed, duplicate sources eliminated, dependency changes, built bundle differences, feature-parity results, and remaining uncertainty. Do not report a target percentage as achieved without measurement.

The recommended first outcome is a smaller, more trustworthy codebase through proven cleanup and corrected caching—not a new architecture. Only proceed to deeper refactors when the measured first batch demonstrates that the next change pays for its complexity.
