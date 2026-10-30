# Feed and Home — detailed remediation implementation plan

**Requested:** 2026-10-30. **Status:** PLAN ONLY; none of the changes below have been implemented by writing this document.

This is the active plan for the Feed/Home audit. Implement this section only when asked to implement it. The older plans are preserved verbatim after `END OF FEED/HOME PLAN`; their deploy, push, commit, and unrelated subsystem instructions do not apply to this work.

## 0. Execution rules and fixed decisions

1. Read `AGENTS.md`, `MEMORY/README.md`, `MEMORY/home-dashboard.md`, `MEMORY/cache-boundaries.md`, and `MEMORY/play-playback.md` before editing. Read `MEMORY/study-rooms.md` before the Home studyroom integration and `MEMORY/css-styling.md` before CSS changes.
2. Run `git status --short`. Preserve unrelated changes. Do not reset files, repair production data, deploy, push, or run paid processing as part of this plan.
3. Paths in this plan are repository-relative. Locate functions by symbol, not old line numbers. Existing line numbers will move.
4. Add no dependency. Reuse React, Next, TanStack Query, Zod, Mongoose, Prisma, Vitest, and Testing Library already installed. Do not upgrade versions as a repair strategy.
5. Keep Feed authorization in SQL before projecting any content. Keep user identity server-derived. Never accept a body-supplied userId as authorization.
6. Do not hide errors by returning success, default cohorts, fabricated activity, or an empty collection that looks authoritative.
7. New behavior must be exercised through real module boundaries. Mock the databases/network, not the function whose integration is being tested.
8. Keep explicit chunk replay, local-calendar pause dates, removal preserving progress, and private-cohort isolation intact.
9. Do not implement calendar-provider OAuth, notification delivery, streak analytics, or another ranking engine. These were not working features. Show their availability truthfully as specified below.
10. Do not replace all of `usePlayback.ts`. Change its feed-fetch, cache, and completion sections only; preserve media, keyboard, provider cleanup, volume, chunk boundaries, and deferred-tool behavior.

### Architecture decisions — do not choose a competing design halfway through

- **Progress:** Mongo `UserChunkProgress` is authoritative for retained chunks. Home derives completed lessons from those records. Do NOT add an unreliable Mongo-to-Postgres dual write. Preserve existing Postgres lesson completion only as a fallback for legacy lessons with no retained chunks.
- **Feed continuation:** Use exclusion-based continuation for the updated client, not offsets over a mutable ranked list. Add POST to the existing `/api/feed` route for a bounded exclusion list; keep GET initial-page/direct-link compatibility. Do not introduce Redis or a feed-session database.
- **Home mutations:** Allow one pending Home mutation at a time. A synchronous ref guards it and all card mutation controls reflect it. This is the smallest reliable correction to whole-list optimistic rollback. Do not invent a generic optimistic transaction framework.
- **Ranks:** Persist all affected ranks and pause state atomically in Mongo for pause/resume. Multi-document transactions require replica-set/sharded Mongo support; validate that runtime prerequisite before shipping. Never silently fall back to partial writes.
- **Preferences:** One validated, user-scoped composite preference document is canonical. Legacy individual keys are migration inputs only, not permanent competing sources of truth.
- **Loading:** A loading shell must not mount the stateful Home data/mutation hook. Loaded-empty, loading, and error are distinct states.
- **Metrics:** Unknown activity is unavailable, not zero and not a synthetic streak. Keep the visual shell if useful, but remove fictitious numbers.

## 1. Audit baseline and issue mapping

The previous audit ran 114 tests: 113 passed, 1 failed. First run: 73/73 passed. Second run: 40 passed, 1 failed. The failure was Home's loading-composition test: `StudyRoomCard` called `useRouter` without an App Router test context. This is evidence of a test harness problem, not proof of a production crash.

Scoped ESLint reported 38 errors and 10 warnings. This is a baseline, not a count to preserve. Many errors are explicit-any and React hook rules; warnings in mocked test images are not production image defects.

Three isolated reproductions in `.tmp/feed-home-review/reproduce.ts` confirmed: explicit chunk removed by frontier gating; offset continuation skipping the next five uncompleted chunks; general preference saves deleting slider parameters from the Feed payload. That temporary script asserts the OLD broken behavior. Convert cases into proper regression tests; do not treat that script passing after implementation as success.

| Audit finding | Work package | Required outcome |
|---|---|---|
| 1. Feed completion not reflected in Home | FH-02 | Same chunk progress source; completed lessons aggregate correctly |
| 2. Progress write failures reported as success | FH-01 | Non-2xx error; playback rolls back and offers retry |
| 3. Offset pagination skips content | FH-04 | No skipped unserved chunks as progress changes |
| 4. Explicit chunk links ignored | FH-03 | Authorized requested chunk first, including replay |
| 5. General preference save erases sliders | FH-06 | Preserve every unrelated preference key |
| 6. Backend preference hydration incomplete | FH-06 | Full channel and slider round trip, user isolation |
| 7. Pause/resume ranks not durable | FH-08 | Reloaded order matches successful local order |
| 8. Rollback overwrites another mutation | FH-07 | No overlapping Home mutation; no stale prop overwrite |
| 9. Catalog capped at first 100 lessons | FH-05 | Scan all authorized lessons in bounded SQL batches |
| 10. Storage failures disguised as state | FH-01/FH-09 | Required data fails visibly; optional vectors degrade only |
| 11. Mobile Home misses core controls | FH-10 | Shared subscription and channel functionality |
| 12. Channel save failures/navigation loss | FH-06 | Status, retry, serialized saves, unmount flush |
| 13. Local timezone not sent | FH-11 | Same local day/hour on warm and regular feed requests |
| 14. Placeholder Home content | FH-09/FH-12 | Real rooms/date; honest unavailable features |
| 15. Dead/duplicated code | FH-13 | Remove proven-unreachable implementations |
| 16. Batch reorder skips invalidation | FH-08 | Every successful mutation invalidates correctly |
| Test/quality gaps across all findings | FH-14 | Integration regressions and clean touched-file checks |

## 2. Dependency order and checkpoints

Execute in this order. Each row is a reviewable unit; a commit is optional and requires the session's normal Git instructions.

| Order | Package | Depends on | Checkpoint |
|---|---|---|---|
| 1 | FH-01 progress errors and validation | none | Failed storage never reports success |
| 2 | FH-02 Home progress projection | FH-01 | Completing all chunks moves a cohort to completed |
| 3 | FH-03 explicit selection | none | Replay and non-frontier selection pass |
| 4 | FH-05 complete catalog | none | Lesson 101+ reachable; access filter preserved |
| 5 | FH-04 continuation | FH-01, FH-03, FH-05 | Progress changes cannot shift an offset |
| 6 | FH-06 preferences | none | Save/hydrate/navigate/account-switch tests pass |
| 7 | FH-07 Home mutation serialization | none | Deferred concurrent action cannot corrupt state |
| 8 | FH-08 persistent order/cache | FH-07 | Reload and batch cache tests pass |
| 9 | FH-09 loading/error data boundary | FH-01, FH-02 | Loading never seeds fake/local subscription data |
| 10 | FH-10 mobile parity | FH-07, FH-08, FH-09 | Mobile can resume/edit/remove cohorts |
| 11 | FH-11 timezone | FH-04, FH-06 | UTC/local-day boundary tests pass |
| 12 | FH-12 truthful supporting widgets | FH-09 | Real rooms and current calendar; no fake metrics |
| 13 | FH-13 cleanup | all affected call paths finished | Dead code removed without dangling exports |
| 14 | FH-14 verification/memory | all | Final tests, lint, types, build, manual matrix |

No new SQL schema, paid API, background worker, or package is needed for the chosen progress/feed/preferences designs. FH-08 needs Mongo transactions. Existing database credentials must stay in environment files; never copy them into this plan, fixtures, or logs.

## FH-01 — make progress persistence truthful

### Files and callers

- `src/server/domain/progress/chunkProgress.service.ts`: `recordProgress`, `recordProgressBatch`, `getUserProgressMap`, and status handling.
- `src/app/api/progress/chunk/route.ts`: single and batch POST branches.
- `src/client/screens/dashboard/play/hooks/usePlayback.ts`: `completeActiveChunk` and every other `/api/progress/chunk` caller found by `rg`.
- `src/server/domain/progress/__tests__/chunkProgress.service.test.ts`, `chunkProgress.batch.test.ts`, `chunkProgress.test.ts`.
- `src/app/api/progress/chunk/__tests__/route.batch.test.ts`.
- `src/client/screens/dashboard/play/hooks/__tests__/usePlayback.test.ts`.

### Exact changes

1. Introduce `ProgressStorageError` in the service module (or a sibling only if imports require it). Missing Mongo configuration and failed Mongo operations throw this error. Keep a logged cause on the server; return a stable generic error message to clients.
2. `recordProgress` must return a persisted document or throw. A null result from `findOneAndUpdate` is failure. Remove its `return null` fallback.
3. `recordProgressBatch([])` may return `{ count: 0, completedIds: [] }`. Nonempty input with missing Mongo or bulk-write failure must throw. Unordered bulk writes can partially succeed: report failure, allow idempotent retry, and do not claim the entire batch succeeded. Do not roll back already durable completion as compensation.
4. `getUserProgressMap` returns an empty map only when a successful query found no records. Storage outage must throw. Feed/Home callers will handle it in FH-09.
5. Parse and validate request payloads before database work using the installed Zod package. Keep both `batch` and `updates` aliases for existing clients. Bound batch length to 200 and identifiers to 128 nonblank characters. Accept only the four `ChunkStatus` enum values. Reject negative/nonfinite watched time and nonpositive/nonfinite total time. Do not coerce objects, booleans, `null`, or numeric strings into valid measurements. Invalid JSON is 400.
6. Preserve SQL access validation and the lesson/cohort/chunk binding. For a batch containing an inaccessible/nonexistent chunk, reject the entire request before writes with 404; do not silently filter it and return global success. Empty batch is a successful no-op.
7. The delivery reader accepts legacy `chunkId` and numeric identifiers; progress validation currently checks `chunk.id` only. Reuse a tiny pure identity normalizer for both paths if needed: `String(raw.id ?? raw.chunkId)` only after confirming the value is a string/number. Do not regenerate chunk IDs. Add legacy identity coverage to avoid a feed item that cannot be completed.
8. Before computing status in `recordProgress`, calculate `effectiveWatched = Math.max(existing?.watchedSeconds ?? 0, input.watchedSeconds)` and `effectiveTotal` from validated input. Use those values for both status and persistence, matching the batch path. A completion retry is idempotent; preserve original `completedAt` for existing completion.
9. Map `ProgressStorageError` to 503 with `Cache-Control: no-store`. Unknown failures remain 500. Never leak database exception messages in the API body.
10. On successful completion, the client must parse the body and confirm `success === true`, a non-null progress object, matching `chunkId`, and `status === 'COMPLETED'`. A malformed HTTP 200 must trigger the existing error/rollback path too. Preserve manual retry.
11. Invalidate any affected progress-dependent cache after a confirmed write. FH-02 removes the stale Home aggregate cache, so do not add a new cache here.

### Core snippets

```ts
export class ProgressStorageError extends Error {
  constructor(cause?: unknown) {
    super('Progress storage is unavailable', { cause });
    this.name = 'ProgressStorageError';
  }
}

// Use at the persistence boundary, not as an empty-result fallback.
if (!process.env.MONGODB_URI) throw new ProgressStorageError();

// Route catch, before the generic 500 branch:
if (error instanceof ProgressStorageError) {
  return NextResponse.json(
    { error: 'Progress could not be saved. Please retry.' },
    { status: 503, headers: { 'Cache-Control': 'no-store' } },
  );
}
```

```ts
const saved = await response.json();
if (!response.ok || saved.success !== true ||
    saved.progress?.chunkId !== targetChunkId ||
    saved.progress?.status !== 'COMPLETED') {
  throw new Error('Completion could not be saved. Retry.');
}
```

Keep the existing special 401 message before parsing an error response. Catch malformed JSON as a save failure. Do not blindly copy this snippet before the response-status check.

### Required tests / acceptance

- Mongo connect failure, write exception, null write result, missing configuration: non-2xx, no `success: true`.
- Client receives HTTP 200 with null progress: restores the removed chunk, clears reported marker, displays retry error.
- Valid empty batch succeeds; mixed inaccessible batch performs no writes; 201 items returns 400.
- Unknown status, negative/NaN/infinite measurement, oversized ID and invalid JSON return 400 before persistence.
- Retrying completed progress preserves completed status/time and does not create duplicates.
- A delayed smaller heartbeat cannot downgrade already completed progress. If testing exposes concurrent read/modify/write regression, replace the status update with an atomic monotonic Mongo update or conditional retry; do not merely add a client guard.

## FH-02 — use the same progress source for Feed and Home

### Files

- `src/app/(dashboard)/home/page.tsx`: extract the data loader for direct testing.
- New `src/server/domain/home/home.service.ts`: `loadHomeForUser` and pure completion projection.
- New `src/server/domain/home/__tests__/home.service.test.ts`.
- `src/server/infrastructure/cache/homeServerCache.ts` and existing invalidation callers.
- `src/client/screens/dashboard/home/models/home.ts` if response typing needs consolidation.

### Required semantics

- A retained lesson is completed only if every unique retained chunk ID has a matching user progress record with matching cohortId/lessonId and `COMPLETED` status.
- One completed chunk does not complete a multi-chunk lesson.
- Duplicate/stale/foreign progress rows cannot inflate counts.
- No retained chunks: preserve an existing Postgres `LessonProgress` completion for that legacy lesson. Do not synthesize chunks or mark it complete by default.
- Malformed retained chunk IDs: count the lesson as incomplete/unavailable, never vacuously complete.
- Cohort percentage remains completed lessons / total lessons, rounded, to preserve the current UI meaning. A zero-lesson cohort is 0%, not completed.
- Existing hidden, paused, scheduled, creator-owned and subscribed filtering remains intact.

### Implementation steps

1. Move the current Home loader out of the route into `home.service.ts`. The route continues authentication/redirect/metadata/Suspense composition. Use Prisma payload types or inference instead of `any[]` for loaded cohorts.
2. Expand lesson selection to include `id` and `chunks` as well as legacy `progress.status`; preserve cohort/season IDs needed to bind progress correctly.
3. Load the current user's Mongo chunk progress once and map by chunkId. Do not query Mongo per lesson. If limiting the query by chunk IDs, deduplicate IDs across the authorized selected cohorts first.
4. Use the pure predicate below for retained lessons. Access controls already restrict the selected cohorts; never load arbitrary other users' progress.
5. Remove the current 30-second cache of combined membership + configs + progress from Home's load path. A process-local invalidation cannot guarantee correctness across Next workers. Keep database selection bounded to this user's cohorts; do not compensate with an unscoped global cache.
6. Once the aggregate cache has no readers, remove its imports/invalidation calls and file in FH-13. Until then, stale calls are harmless but should not survive final cleanup.
7. Ensure a navigation/refresh after completion loads fresh data. Test actual server projection after writing/returning completed progress, rather than expecting local `cohortStore` to drive server props.
8. Remove the service comment promising a future Postgres roll-up. Replace it with one short statement that retained chunk progress is canonical and Home derives lesson completion.

```ts
type CompletionRecord = {
  cohortId: string;
  lessonId: string;
  status: string;
};

function retainedLessonCompleted(
  ids: string[],
  lessonId: string,
  cohortId: string,
  progress: ReadonlyMap<string, CompletionRecord>,
): boolean {
  return ids.length > 0 && ids.every((id) => {
    const saved = progress.get(id);
    return saved?.lessonId === lessonId &&
      saved.cohortId === cohortId && saved.status === 'COMPLETED';
  });
}
```

The caller must validate the entire retained ID list first. Do not silently filter bad IDs and then call this predicate on the surviving subset.

### Tests

- 0/3, 1/3, 2/3, 3/3 completed chunks produce incomplete, incomplete, incomplete, completed lesson.
- Two lessons, only one fully completed: Home shows 50%, not 100% and not chunk-count percentage.
- All lessons completed: cohort leaves active/paused and enters recentlyCompleted.
- Progress record for another lesson/cohort/user is ignored.
- Legacy lesson without chunks respects SQL completion; valid retained chunks take precedence over stale SQL completion.
- Hidden creator-owned cohort stays hidden. Mongo failure produces unavailable state, not 0%.
- Load, complete, load again on a different service instance: fresh result without process-local invalidation dependency.

## FH-03 — honor explicit chunk selection before ranking

### Files

- `src/shared/feed/feedEngine.ts`: candidate construction and final interleaving.
- `src/shared/feed/__tests__/feedEngine.test.ts`.
- `src/app/api/feed/__tests__/route.test.ts`: include a real-engine integration block/file.

### Exact algorithm

1. Route continues validating requested chunk exists in the authorized catalog; otherwise return 404.
2. In `generateFeed`, find the requested chunk in `allChunks` before completion/frontier filtering.
3. Build ordinary candidates with existing channel/frontier/completion rules.
4. If an explicit chunk exists, add it to candidates even if completed or not the next sequential chunk. Deduplicate by chunkId.
5. Remove the fallback `candidateChunks.length > 0 ? candidateChunks : allChunks`. When nothing is eligible and no explicit selection exists, return an empty feed; do not revive completed content.
6. Keep score metadata if needed, but enforce first position structurally, after ranking/interleaving. A finite +1000 score is not the selection contract.
7. Preserve the requested item once, not twice, and count it toward feedSize. No requested chunk should bypass authorization.

```ts
const requested = requestedChunkId
  ? allChunks.find((chunk) => chunk.chunkId === requestedChunkId)
  : undefined;
if (requested && !candidateChunks.some((c) => c.chunkId === requested.chunkId)) {
  candidateChunks.push(requested);
}
const eligibleChunks = candidateChunks;

// After scoring, before final output limiting: put the requested scored item
// first and exclude its duplicate from the normal interleaving pool.
```

Do not insert an unscored `FeedChunkInput` directly into `FeedItem[]`; use the scored item. Make the interleaver start with that item so its last-lesson/cohort counters are correct.

### Tests

- Request chunk 2 in a sequential lesson with chunk 1 incomplete: first output is chunk 2.
- Replay completed chunk 1 while chunk 2 incomplete: first output is chunk 1.
- All chunks completed, no explicit selection: empty.
- All completed with explicit selection: requested chunk returned once.
- Explicit inaccessible/mismatched cohort/lesson selection: 404, no private content.
- Real route + real engine test must verify response items, not just arguments passed to a mocked `generateFeed`.

## FH-04 — replace mutable-offset pagination with bounded exclusions

### Files and contracts

- `src/app/api/feed/route.ts`: factor GET/POST through one validated handler.
- New `src/shared/feed/feedRequest.ts`: request/response schema and constants usable by client/server without server imports.
- `src/shared/feed/feedEngine.types.ts`, `feedEngine.ts`: `excludedChunkIds?: ReadonlySet<string>` (internal input).
- `src/client/screens/dashboard/play/hooks/usePlayback.ts`: cache type, prefetch, fetch, continuation, completion, session storage.
- Feed route pagination tests and playback hook tests.

### New request protocol

Use POST for normal and continued client fetches so exclusion IDs do not exceed URL limits. This POST is read-only and remains available for anonymous discovery with the same SQL access policy. Response is always `no-store`; no content mutation occurs.

```ts
type FeedRequest = {
  channel: 'default' | 'spark' | 'explore' | 'build' | 'listen' | 'deep_dive' | 'quick';
  limit: number;                  // integer 1..20, default 5
  excludeChunkIds: string[];      // unique IDs, max 5000, each 1..128 chars
  cohort?: string;
  lesson?: string;
  chunk?: string;
  q?: string;                    // max 200 chars
  prefs?: Record<string, string>;
  timezoneOffset: number;        // minutes, -840..840
};
type FeedResponse = {
  items: FeedItem[];
  hasMore: boolean;
  delivery?: { unavailableLessons: number };
};
```

Validate bounded JSON body size (1 MiB maximum) before parsing using an existing reusable request helper if one is appropriate; do not import studyroom-specific security behavior wholesale. Reject overlarge body with 413. Max 5000 IDs is a safety limit, not silent truncation. At that limit the UI offers a refresh/restart with explicit text; add a `shortcut:` comment documenting when to move to a durable continuation protocol.

### Server steps

1. Keep GET for initial-page/direct-link consumers, normalizing old `lessonId`/`lesson` aliases. GET pageIndex=0 remains supported.
2. Stop accepting pageIndex>0 with the broken offset semantics. Return 400 with a stable `FEED_CONTINUATION_REQUIRED` code instructing the caller to use POST exclusions. Update all repository callers together. Do not silently return page 0.
3. Build the full authorized candidates and apply completion/frontier rules FIRST. Apply exclusion filtering AFTER frontier gating but BEFORE limiting/interleaving. Otherwise excluding an unfinished first chunk would unlock later chunks prematurely.
4. Requested chunk takes precedence over normal frontier/completion, but an already-served requested chunk must be excluded on continuation. Only initial fetch has an empty exclusion list and guarantees it first.
5. Rank/interleave `limit + 1` eligible unseen candidates, return first `limit`, and compute hasMore from the extra candidate. No offset slicing.
6. `hasMore=false` means no more currently eligible unseen candidates, not that future progress cannot unlock more. Client must clear exhaustion after successful completion and request more if needed.

### Client steps

1. Replace cache `pageIndex` with `servedChunkIds: string[]` and hasMore/exhausted state. Maintain a set during updates to avoid duplicates.
2. A reset fetch sends empty exclusions. A continuation sends served IDs for that exact account, channel, cohort/lesson/chunk selection, search query, and preference revision.
3. Record IDs on successful response only. Aborted/failed requests must not consume IDs. Only the current AbortController may update the cache.
4. Preserve served IDs when a completed item is removed from the visible queue. This prevents already-served incomplete items from being reinserted on subsequent continuation.
5. After completion is durably acknowledged, clear channel exhaustion and request continuation when the remaining queue is below the existing threshold. Never rely solely on prefetch before the completion write: it can see old progress and incorrectly conclude exhaustion.
6. Retain retry after a feed error; do not call an empty/error response an exhausted successful feed.
7. Update `prefetchDefaultFeed` to use the same POST request builder, preferences, timezone and response validation. Do not maintain two protocols.
8. Bump persistent cache prefix from v1 to v2. Do not hydrate v1 pageIndex data. On disk save only the retained playable items; on hydration derive served IDs from those retained items, not from items discarded by the 15-item compaction. This may re-offer older uncompleted content after reload, which is preferable to silently losing unseen content. Completed chunks are excluded by server progress.
9. Within the same mounted session, preserve the full served set even as completed items leave the queue. On account/selection change reset cache state immediately; abort old requests and do not write old responses under a new identity.
10. Search/preference changes reset the candidate session rather than combining IDs/ranks from incompatible queries. Preserve active item only if it still exists in the fresh response.

### Integration tests

- 12 distinct lessons: fetch c0..c4, complete them, continue excluding those IDs, receive c5..c9. Next response c10..c11. No skipped or duplicated IDs.
- Complete only c0 between calls: next page still contains the next five unseen eligible items.
- In a strict lesson, exclusion of incomplete chunk 1 does NOT expose chunk 2; completion of chunk 1 DOES expose chunk 2 on the next request.
- Score changes between calls do not remove unseen eligible items through offset arithmetic.
- Explicit requested chunk returned once across initial and continued requests.
- Failure/abort/retry preserves served IDs; switching accounts never reuses another account's items.
- Reload a compacted cache with previously fetched >15 items: omitted uncompleted items remain fetchable.
- Bound tests: 5001 exclusions rejected visibly; request body limit enforced; no silent truncation.

## FH-05 — remove the fixed 100-lesson blind spot

### Files

- `src/app/api/feed/route.ts` catalog query; extract to `src/server/domain/feed/feedCatalog.ts` only to keep a directly testable server loader.
- `src/server/infrastructure/cache/feedServerCache.ts` if removing obsolete catalog cache.
- Feed route/catalog tests.

### Implementation

1. Remove the single `take: 100` query as the complete catalog definition.
2. Scan authorized lesson metadata in batches of 100 with stable `orderBy: { id: 'asc' }`, cursor `{ id: lastId }`, `skip: 1` for subsequent batches. Preserve all existing publication, selected cohort/lesson and `accessibleCohortWhere(userId)` constraints on EVERY batch.
3. Engine ordering already uses season/lesson/chunk order, so SQL cursor order does not define presentation order.
4. Accumulate projected valid chunks; preserve rejected delivery diagnostics. Stop only when batch length <100, not after the first batch with no eligible chunks.
5. Remove process-local caching of authorized lesson payloads from this path: cached membership/publication decisions can outlive access changes and scale badly with full catalogs. Keep optional vector metadata cache separately. Do not replace authorization queries with cached content permission decisions.
6. Do not remove the cap by issuing one unbounded `findMany()` call. SQL batching limits query size, although total ranking still scales with catalog size. Document that remaining O(total authorized chunks) cost; do not claim the first 100 bug is fixed by adding a different silent cap.
7. For very large catalogs, measure database time/memory before release. If resource limits are exceeded, return an explicit unavailable response and track a subsequent search-index/ranking design; do not pretend truncation is a complete feed. No speculative new search infrastructure in this patch.
8. Fix the optional vector cache key to identify the actual sorted chunk IDs, not just cohort IDs plus count. Two lessons in the same cohort with equal chunk counts must not collide. Use a server-side SHA-256 digest of normalized IDs with a small version prefix if the existing cache expects string keys.

```ts
let cursor: string | undefined;
for (;;) {
  const batch = await prisma.lesson.findMany({
    where: authorizedWhere,
    select: lessonSelect,
    orderBy: { id: 'asc' },
    take: 100,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  // Project/collect this batch, retaining delivery validation.
  if (batch.length < 100) break;
  cursor = batch[batch.length - 1].id;
}
```

Do not pass Prisma relation objects to the browser. A disappearing cursor row under concurrent publication must not loop forever; assert cursor advancement and treat repeated/no-advance batches as failure.

### Tests

- 205 authorized lessons loaded in 100/100/5 batches; last lesson can rank into the response.
- First 100 lessons completed or invalid, lesson 101 valid: response still contains lesson 101.
- Every batch includes access/published/selection filters; unauthorized cohort never enters projection.
- Two equal-size lesson selections have different vector-cache keys.
- Query failure on batch 2 returns error, not a partial response presented as a complete catalog.

## FH-06 — canonical preferences, hydration, save reliability

### Files and reach

- `src/client/repositories/homeStorageAdapter.ts`.
- `src/client/screens/dashboard/home/components/ChannelHub/ChannelHub.tsx`.
- `src/app/api/user/channel-config/route.ts` and new focused route tests.
- `src/client/screens/dashboard/play/hooks/usePlayback.ts`: both readers of raw localStorage preferences and active channel.
- `src/client/components/global/Sidebar/ProfilePill.tsx`: logout cleanup.
- Search `sidequest_channel_prefs`, `sidequest_active_channel`, and `sidequest_pref_` across ALL `src` before editing; migrate each live caller.
- New `src/shared/feed/channelPreferences.ts` for pure key/default/range definitions if needed; do not import a React UI component into server code.
- New adapter tests and `ChannelHub` component tests.

### Canonical storage contract

```ts
type StoredChannelConfig = {
  version: 2;
  activeChannel: ChannelId;
  prefs: Record<string, string>;
  dirty: boolean;
  updatedAt: string;
};
// Key: sidequest_channel_config_v2:<userId-or-anon>
```

Keep slider values serialized as normalized strings for compatibility with existing vector parsing. Validate finite 0..1 values for recognized numeric controls. General strings retain their recognized enumerated values. Share valid channel IDs/defaults, rather than defining mutually inconsistent defaults in UI/adapter/API.

### Fix local writes

1. Change general preference saves to merge into existing `prefs`; never construct a replacement dictionary containing only legacy keys.
2. Change slider saves to update only their namespaced key in the same document. `getChannelParam`, `getChannelPreferences`, and Feed request building all read that same document.
3. Remove permanent individual-key override precedence. It causes UI and Feed to read different data. Legacy keys can be imported once into the anonymous v2 store, then removed only after successful write. Do not automatically attach unattributed old global preferences to a newly signed-in account.
4. Authenticated cold start reads that user's server configuration; anonymous preferences remain anonymous. Scope pending/cached sync state by userId, or remove the 30-second client sync cache.
5. `clearUserChoices` must clear channel config/pending save state for the signed-out user as well as Home choices. Do not delete another user's namespace. Abort or invalidate in-flight hydration when identity changes.

```ts
const nextPrefs = {
  ...current.prefs,
  weekly_goal: partial.weeklyGoal ?? current.prefs.weekly_goal,
};
// Validate and serialize defined fields. Do not write undefined values.
```

### Fix backend hydration

1. GET already returns the complete `prefs` dictionary; retain all validated known namespaced keys rather than cherry-picking only depth/rigor/scaffolding.
2. `ChannelHub` applies returned activeChannel AND all returned parameter values. Explicit valid channel URL takes precedence for active selection, not for overwriting server slider values.
3. Preserve dirty local drafts on mount: display/use the pending user's draft and retry it rather than replacing it with older remote values.
4. Guard hydration with a generation/AbortController. A slow server response must not overwrite edits made after the request began or edits from a different account.
5. Tighten PUT validation to the recognized keys, bounded key count, numeric 0..1 values, known channel values and general enums. Reject malformed data with 400 instead of stringifying arbitrary objects. Keep generic error bodies; do not expose exception messages.

### Save lifecycle

1. Keep local responsiveness. Each edit updates the local canonical document immediately and marks it dirty.
2. Use one serialized save path per user. A pending timer may coalesce changes for 500ms, but an older full-document HTTP request must finish before a newer one starts. Store the latest pending snapshot, replacing intermediate unsent snapshots.
3. Treat non-2xx as failure. Keep dirty data, show `Changes not saved` and a Retry button; only a confirmed latest revision becomes `Saved`.
4. On unmount, flush the latest unsent snapshot with `fetch(..., { keepalive: true })` instead of clearing and discarding it. Keep the payload far below keepalive's practical body limit via key/value bounds. Do not use `sendBeacon` because it cannot express the current PUT/auth response contract.
5. A small user-keyed save coordinator in the adapter may outlive the component; the component subscribes to status while mounted. Do not set component state after unmount. It needs only latest pending snapshot, one in-flight promise, revision, and listener cleanup—not a generic offline queue.
6. If navigation/process termination still prevents acknowledgment, the dirty draft remains in storage and retries on next authenticated mount. Do not label it saved based on a dispatched request.
7. Capture user identity in each task. Never send user A's draft after logout under user B's session. Cancel timers/queued work at logout; in-flight acknowledgment must not mutate the next user's storage/status.
8. Implement slider persistence from event handlers, not inside React state updater callbacks; updater callbacks must remain pure under StrictMode.
9. Use layout/effect synchronization for render-independent refs where necessary. Remove render-time ref writes flagged by lint; do not disable the rule globally.

### Tests

- Save spark_novelty=0.91, change weekly goal: request and slider both still contain 0.91.
- Save several channel values, reload/new device from server: all restore, including zero values.
- Server activeChannel is build: UI selects build unless URL selects a valid different channel.
- Slow hydration arrives after a local slider edit: local draft survives.
- A changes preference, logout, B logs in: B receives neither A's draft nor A's cached config.
- Two saves, first delayed: server ends with latest snapshot; HTTP 500 leaves dirty and visible Retry.
- Unmount before 500ms: latest snapshot flushed once or remains dirty for retry; no silent loss.
- StrictMode does not schedule duplicate side effects from state updaters.

## FH-07 — prevent destructive optimistic rollback races

### Files

- `src/client/screens/dashboard/home/hooks/useHome.ts`.
- `HomeDesktop.tsx`, `HomeMobile.tsx`.
- `components/ActiveCohorts/ActiveCohorts.tsx`, `SubscribedCohortCard.tsx`.
- Hook and card tests.

### Chosen behavior

Only one Home mutation is allowed at a time: pause, resume, edit, delete, and any still-live reorder. Disable mutation controls while saving; navigation remains available. A synchronous guard is mandatory because React state alone updates too late to stop two actions in the same tick.

```ts
const mutationPendingRef = useRef(false);

async function runHomeMutation(operation: () => Promise<void>) {
  if (mutationPendingRef.current) throw new Error('A change is still saving. Please wait.');
  mutationPendingRef.current = true;
  setIsSyncing(true);
  try {
    await operation();
  } finally {
    mutationPendingRef.current = false;
    setIsSyncing(false);
  }
}
```

### Integration details

1. Acquire the guard BEFORE taking snapshots or changing local state. Release in finally for success, HTTP error, validation error and network exhaustion.
2. Keep a single combined cohort state `{ activeCohorts, continueLater }` or ensure both setters always execute together from one derived result. Prefer the combined state to eliminate impossible intermediate combinations.
3. The existing whole-state rollback is safe only while concurrent mutations AND server-prop hydration are prevented. While pending, do not apply new server props. After settlement, refresh the route (`router.refresh`) and accept the refreshed props once; do not replay a previously deferred stale payload.
4. Ensure session identity changes reset the guard/state and ignore old callbacks. Capture userId/generation before request; an old response cannot save old arrays into a new user's local key.
5. Pass `mutationPending` through ActiveCohorts to every card. Disable pause/resume/menu edit/delete submission and conflicting global controls; keep accessible status text (`role=status`). A card's local pending state is still useful for its label but must not be the only lock.
6. Remove unused legacy debounced actions in FH-13. Until removed, route them through the same guard; do not leave an unguarded mutation backdoor.
7. Never treat 401 as a successful sync. Surface reauthentication and roll back.

### Tests

- Start a deferred pause A; immediately attempt delete B: second action rejected before state/write. Resolve A, then delete B successfully.
- Pause A fails: original list restored and subsequent B action works.
- Server props refresh while A pending cannot erase optimistic state; settling triggers authoritative refresh.
- Logout/account switch during request: no old-state write under the new user.
- All cards' mutation controls disabled while any Home mutation pending; navigation links remain usable.

## FH-08 — persist pause/resume order and fix cache behavior

### Files

- `src/app/api/user/cohort-config/route.ts`.
- New `src/server/domain/home/cohortOrder.service.ts` if required to test transaction/reordering separately.
- `src/client/screens/dashboard/home/hooks/useHome.ts`.
- `src/client/screens/dashboard/home/utils/cohortManagement.ts` and tests.
- `src/server/database/mongo/models/UserCohortConfig.ts` (reuse existing model; no new schema required).
- Existing route tests plus a new transaction integration test against a disposable replica-set Mongo when available.

### API extension

Keep existing single settings PUT and batch rank PUT compatibility, but add a discriminated operation for membership ordering:

```ts
type CohortStateChange = {
  operation: 'pause' | 'resume';
  cohortId: string;
  pausedUntil?: string | null;
  pausedReason?: string;
};
```

The client sends intent, not an authoritative full subscription list. The server loads the user's authorized enrolled/created visible cohorts and current configs and calculates order. This avoids accepting arbitrary foreign cohort IDs or trusting stale browser rank lists.

### Server steps

1. Authenticate first. Validate operation, exact cohort ID, future valid pause date or null. An indefinite pause remains null/absent, never `new Date()`.
2. Resolve current active and paused groups using the same expiry rules as Home. Sort deterministically by rank, then cohortId for ties. Ignore hidden rows.
3. Pause: remove target from active, append to paused. Resume: remove from paused, append to active. Normalize combined rank 1..N with active before paused.
4. In a Mongo session transaction, read current configs and bulkWrite all affected ranks plus target pause fields. For resume set isPaused=false, pausedUntil=null, pausedReason='' (or unset reason consistently). For pause persist the newly calculated rank, not `activeCohort.rank` from before the operation.
5. Mongo transaction callback may retry; do not perform external side effects or respond from inside it. Query authoritative configs within the transaction and pass session to writes. If Mongo deployment does not support transactions, return a clear service error; do not run the writes outside the transaction.
6. Return the saved canonical ordering and target state. Client may reconcile it after optimistic rendering; use server ordering as final truth.
7. Existing batch reorder: validate integer finite ranks, unique cohort IDs, authorized visible IDs, and batch <=200. Empty batch returns count 0 without calling `bulkWrite([])`. Count affected rows once; current modifiedCount + matchedCount double-counts modified matches.
8. Invalidate the existing Home cache after EVERY successful batch/single operation until FH-02/FH-13 remove that obsolete cache. Add the missing invalidation immediately after batch success. Do not invalidate on validation failure or uncommitted transaction.
9. With the aggregate cache removed, config reads are fresh on all workers. Remove obsolete cache imports together in cleanup, not just the function definition.
10. Feed config priority is already 1-based: change `(cfg.rank ?? idx) + 1` to a validated positive rank fallback `cfg.rank ?? (idx + 1)`. Do not add one to valid stored ranks.
11. Do not strip every ID at its last underscore. Only remove an exact legacy `${userId}_` prefix when that representation is confirmed. Preserve valid cohort IDs containing underscores. Apply the same normalizer to Home and Feed config mapping.

### Automatic expiry

Home/Feed must consider expired pauses active immediately. When an expiry is observed, use the same server normalization rule: append expired items after currently active items, then remaining paused items. The next persisted ordering mutation writes normalized ranks. Do not require a cron job merely to display expired items as active. Compare dates as instants; custom date construction remains local calendar midnight after the selected day.

### Tests

- A,B,C active: pause A -> active B,C, paused A; resume A -> active B,C,A. Reload through server yields B,C,A.
- Existing paused D: pause A appends after D, ranks unique; resume preserves active ordering.
- Concurrent clients: transaction retries or rejects conflict without half-written rank/state. Check real replica-set behavior before claiming this property.
- Resume clears old pause timestamp/reason. Indefinite pause remains paused on reload.
- Valid ID containing underscores still matches Feed/Home configuration.
- Batch success invalidates; batch failure does not. Empty batch returns count=0; one modified row counts once.
- Rank 1 gives Feed priority 1; first fallback rank is 1.

## FH-09 — separate loading, empty, error, and optional enrichment

### Home files

- `src/app/(dashboard)/home/page.tsx`, `loading.tsx`, new `error.tsx` if no applicable local boundary exists.
- `src/client/screens/dashboard/home/Home.tsx`, new `HomeLoading.tsx`.
- `src/client/repositories/homeRepository.ts`, `homeStorageAdapter.ts`, `hooks/useHome.ts`.
- `src/app/(dashboard)/home/__tests__/homeLoading.test.tsx` and server loader tests.

### Home behavior

1. Replace both `<Home />` loading uses with a presentational `HomeLoading`. Reuse the actual layout classes; show a loading status and inert placeholders only. Do not call useHome, ChannelHub synchronization, local storage persistence, or mutate backend settings while loading.
2. Remove DEFAULT_COHORTS and manufactured progress from homeRepository. Missing data means []/unavailable, never Neuroscience/AI/game-design examples.
3. Keep server-supplied [] authoritative. Once loaded, the server arrays own membership/progress; local storage stores user drafts/choices, not invented subscriptions.
4. Stop `Promise.all(...).catch(() => [[], []])` and Mongo config `catch(() => [])` in the server loader. Required database failure must reach an error boundary with Retry, rather than overwriting stored choices with empty results.
5. Error UI must not print database error text. It should say Home could not load and offer reset/retry. Loaded-empty remains Discover cohorts.
6. Remove `NODE_ENV === 'test'` branches that bypass required Mongo behavior in the loader; tests should mock the database boundary. Production behavior must be testable without changing NODE_ENV.
7. On the loaded Home path, remove redundant backend config hydration which races server props. Retain only a supported explicit offline/native path if a real caller exists; otherwise remove it in cleanup.
8. Distinguish `loading` prop from TanStack's query over synchronous local repository data. A synchronously populated local query is not evidence the server finished loading.

### Feed behavior

1. Split required personalized reads from optional vector enrichment. Required for authenticated feed: user progress and user cohort configs; channel prefs when the server is the selected source. Any failure returns 503/no-store.
2. Optional: transcript/chunk vector enrichment may fail and use deterministic delivery vectors. Log once without sensitive content. It must not swallow a failed user-config read.
3. Separate `hiddenCohortIds` and `pausedCohortIds`; do not conflate them into one state flag. General feed excludes both. An explicit authorized cohort/chunk link may intentionally replay hidden/paused content because hiding a subscription is not content deletion; document this behavior in tests/UI. Access policy always applies.
4. Do not skip config loading merely because chunks are empty. This is optional optimization only if it cannot change error semantics; prefer explicit required-read behavior.
5. Remove the dead pausedCohortIds accumulator or actually use the canonical sets. No duplicate hidden/paused filtering with different ID normalization.

### Tests

- Loading renders no fabricated cohorts and triggers no storage writes/config GETs.
- Authenticated successful empty Home renders discover link; failed Home renders retry, not discover-empty.
- Mongo failure cannot turn a paused/hidden subscription into an active card or general feed candidate.
- Optional vector failure alone still returns valid authorized content.
- Tests execute normal cache/config branches using mocked DB, not environment bypasses.

## FH-10 — complete mobile Home's core flows

### Files

- `src/client/mobile/screens/Home/HomeMobile.tsx` and module CSS.
- `src/client/screens/dashboard/home/Home.tsx` / `HomeDesktop.tsx` for common props.
- Reuse `ActiveCohorts`, `SubscribedCohortCard`, `RecentlyCompleted`, `ChannelHub`.
- New `src/client/mobile/screens/Home/__tests__/HomeMobile.test.tsx`.

### Changes

1. Keep mobile layout and search, but show the same combined active-first/paused-last subscription list as desktop. Extract a small pure `getSubscribedCohorts` helper only because two renderers now use it.
2. Reuse existing card actions and global pending state. Do not create another mobile pause/edit/delete persistence implementation.
3. Show paused cards with Resume, edit, remove, and pause options as appropriate. Avoid exposing Pause on a paused card if the hook only supports active cohorts: either support rescheduling explicitly or show Resume plus existing schedule information.
4. Mount ChannelHub in mobile layout with styles that fit 320px and touch inputs. Show completed section with a collapsed toggle. Display shared sync errors.
5. Add a real accessible label for the search input. Search both active and paused lists; show `No matching cohorts` separately from an empty subscription state.
6. Preserve route links via `getCohortHref`, not an independently concatenated legacy ID.
7. Ensure >=44px interactive hit areas, no horizontal overflow, readable dialog labels, Escape/outside dismissal and focus return. Shared cards may need mobile CSS adjustments, not another component copy.

### Tests/manual checks

- A desktop-paused cohort is visible and resumable on mobile.
- Edit/delete success and failure use the shared hook and show errors; all mutation controls respect global pending.
- Empty, all-paused, all-completed, search-no-match states each have useful text.
- At 320/375/768px, sliders/popovers are usable without horizontal overflow; keyboard can reach every action.

## FH-11 — make schedule scoring use the learner's local day

### Files

- Feed request builder introduced in FH-04, both playback/prefetch callers.
- `src/app/api/feed/route.ts`.
- `src/shared/feed/feedScoring.ts` and `src/shared/curriculum/pedagogicalVector.engine.ts` date consumers.
- Tests for request building and time-sensitive scoring.

### Changes

1. Set timezoneOffset to `new Date().getTimezoneOffset()` on every request. Do not cache it indefinitely across DST/date changes.
2. Keep offset sign semantics: local wall-clock instant = UTC now minus offset minutes. India is -330, so local wall clock is UTC+05:30.
3. The route currently shifts the Date but scoring calls `getDay()`/possibly `getHours()`, which can add the server timezone again. Make the contract explicit: pass a UTC-encoded local wall-clock Date to the engine, and use `getUTCDay`/`getUTCHours` for calendar scoring consumers. Search every `currentTime` consumer before changing this contract.
4. Do not use shifted wall time for elapsed recency calculations. Pass actual `now` separately to the heuristic for `now - lastActiveAt`. If needed add `localDayOfWeek`/`localHour` primitives instead of overloading Date; use one contract consistently in tests and existing engine callers.
5. Recommended exact shape: add optional `localDayOfWeek` and `localHour` to FeedEngineInput; derive them server-side from shifted Date's UTC getters; use real currentTime for elapsed durations. Default callers that omit them retain their current local Date semantics until migrated.
6. Offset remains validated -840..840. No browser timezone string trust is needed for current-day scoring. Pause-until timestamps remain ISO instants and are not shifted again.

### Tests

- At Sunday 20:00 UTC, offset -330 gives Monday 01:30; Monday schedule matches.
- At Monday 02:00 UTC, offset +480 gives Sunday 18:00; Sunday schedule matches.
- Run date-sensitive pure tests under UTC and a non-UTC TZ: same explicit localDay/localHour yields same ranking.
- Prefetch and regular fetch send identical offset/preferences. Recency of an event one hour ago stays one hour regardless of offset.

## FH-12 — replace misleading supporting UI with truthful behavior

### A. Streak/activity widget

Files: `HomeDesktop.tsx`, `components/HomeStreakWidget/HomeStreakWidget.tsx`, tests.

1. Remove defaults todayMinutes=18, streakDays=12 and hard-coded completed-week activity.
2. Do not derive study minutes from watchedSeconds sums: seeks, overlapping chunks and replay make that unreliable. This plan does not add session telemetry.
3. Make activity data an optional object. When absent, retain a compact neutral learning encouragement and text `Activity statistics are not available yet`; omit chart, numerical streak and progress ratio.
4. Remove `12 days strong!` from encouragements unless dynamically generated from supplied verified data.
5. If numeric data is supplied by an existing authoritative caller, validate zero correctly (`??`, not `||`) and render it. Tests cover zero and absent data.

### B. Real studyrooms

Files: HomeDesktop, HomeMobile if shown there, existing studyroom discovery DTO/API/card components.

1. Remove `messageMock` import from Home. Read `MEMORY/study-rooms.md` first.
2. Fetch `/api/studyroom?format=v2&tab=discover&limit=4` using an existing query pattern with user-scoped key. Validate returned `StudyRoomDiscoveryResponse`; use real `rooms`, not mock LiveSession data.
3. Prefer the existing DTO-native discovery card (find the component used by StudyRoomScreen). If its size cannot fit Home, make a small Home section using Link/title/onlineCount from the DTO; do not invent participants or map IDs to fake slugs.
4. Link by actual slug to `/studyroom/<slug>`. Preserve access controls in the API. An empty response shows `No studyrooms available` plus Browse studyrooms. Failure shows retry without substitute rooms.
5. Do not label zero-occupancy discovery results `Active` unless the API actually filters for active occupancy. Use `Studyrooms` as the heading, or filter using real status/onlineCount with an honest empty state.
6. No new polling loop: reuse existing query stale/refetch behavior, pause hidden-tab polling if one is retained.

### C. Calendar current date and provider honesty

Files: `src/client/components/global/UpcomingEvents/UpcomingEvents.tsx`, associated tests. This is shared; search all callers.

1. Initialize activeDate/selectedDay/currentDay from local now, not 2026-08-06. Compute current-month comparison from now's year/month.
2. At local midnight, update the today marker with a timeout and cleanup; refresh when the document becomes visible. Do not force the user back to the current month if they intentionally navigated elsewhere.
3. Preserve `useUnifiedTasks` as the source of tasks. Remove unused INITIAL_EVENTS fixture from production component only after checking references.
4. Default provider label to `Sidequest Native` (or visible `Undone tasks` while retaining internal enum if needed). Google/Outlook/Apple must not appear connected merely because selected. Disable unavailable integrations with `Not connected`/`Coming later`, or remove their selector choices. Do not build OAuth here.
5. Check create-task date, Today label, month navigation and selected-day filtering use the same local calendar state; replace all hard-coded year/month/day constants in the behavior path.

### D. General tuning controls with no consumers

Files: ChannelHub and shared preference metadata.

1. Keep persisted existing values for compatibility, but do not present weekly goal, allocation or reminder as functioning automation if no consumer exists.
2. Render those specific controls disabled with concise text `Coming later`; do not permit a save that implies reminders will be sent or allocation changed. Keep working channel sliders enabled.
3. If a real existing consumer is discovered, trace it and test it before enabling the respective control. Do not invent reminder delivery as part of this plan.
4. The FH-06 merge regression test is still mandatory even if some general controls become disabled: hydration/API compatibility must not erase slider values.

### Tests

- New user sees no 12-day streak, made-up minutes, fake cohorts, mock room titles or August 6 today marker.
- Fake clock at 2026-10-30: calendar selects October 30. Midnight change updates today correctly while preserving browsed month.
- Studyroom loading/empty/error/success all render honestly; actual slug navigation works.
- Unsupported providers/reminders cannot imply successful connection/scheduling.

## FH-13 — remove dead code and consolidate only necessary duplication

Run caller searches after functional changes, because some previously unused UI may have been reused by mobile. Delete only modules with no live imports, dynamic references, tests requiring a supported public contract, or exports used by another package.

### Candidate deletion list

- `src/client/repositories/feedRepository.ts`: current only external reference is an unused import in usePlayback. Remove import and module if still unused. Its separate localStorage progress/ranking path is obsolete; do not repair it instead of the live API.
- `src/client/screens/dashboard/home/components/ActiveCohortRow/`.
- `src/client/screens/dashboard/home/components/ActiveCohorts/InspectorPanel.tsx` and its CSS.
- `src/client/screens/dashboard/home/components/HomeSummaryBar/`.
- `src/client/screens/dashboard/home/components/ContinueLater/` and `ContinueLaterCard/`, if mobile uses the shared subscribed card as planned.
- `useHome` legacy `moveCohort`, `saveDailyGoal`, `saveSchedule`, `saveOrderStyle`, `saveFrequency`, `debouncedSyncCohort`, cohortTimers/reorderTimerRef when no live controls call them. Remove matching obsolete exports/imports and tests for dead behavior. Keep pure helpers that new order tests or production code genuinely use.
- `HomeHeroProps` compatibility fields never read by HomeHero, after caller search; unused imports and computed slider `percent`.
- Obsolete Home aggregate cache and Feed authorized catalog cache after their read paths are removed. Keep vector cache, authorization policy, and unrelated cache users intact.
- Unused stored paused/completed/search keys only after searching callers; no broad deletion of user localStorage.

### Duplication fixes to make

1. One channel defaults/key schema shared by adapter/API/engine; do not move icon JSX into shared server code.
2. One subscribed-cohort ordering helper for desktop/mobile.
3. One Feed request builder for prefetch/active requests.
4. One config-ID normalization function handling only verified legacy prefixes, rather than substring guesses.
5. Remove the engine's constant `previousCohortId = null` scoring input if variety is solely enforced by the interleaver. Either remove the unused score term/signature after all callers are checked or pass meaningful sequential state; do not pretend a constant contributes variety. Prefer retaining interleaving and deleting the redundant heuristic term with updated score tests.
6. Avoid broad formatting changes. Format only touched files/blocks. Do not create a generic repository/service framework to eliminate a few lines.

### Verification

```powershell
rg -n 'feedRepository|ActiveCohortRow|InspectorPanel|HomeSummaryBar|ContinueLaterCard' src packages
rg -n 'moveCohort|saveDailyGoal|saveSchedule|saveOrderStyle|saveFrequency' src packages
rg -n 'getHomeServerCache|invalidateHomeServerCache|getFeedCatalogCache|invalidateFeedCatalogCache' src
```

Interpret matches: comments/tests/exports are not proof of a live UI path, but deleting a file requires updating legitimate tests/exports. Do not remove a test solely because it fails; replace it with tests for the supported new behavior.

## FH-14 — verification, test repair, and operational documentation

### Test design requirements

- Fix Home loading tests to match the new presentational loading shell. If rendering loaded StudyRoom cards in tests, mock Next navigation or provide the real App Router context at the boundary. Do not delete the assertion or mock all of Home to make the test meaningless.
- Feed integration tests use actual delivery projection + engine + route and mock only auth/database/time.
- Home projection tests use actual progress aggregation/config filtering and mocked records.
- Use deferred promises for request races; fake timers for debounce/midnight/pause expiry. Restore timers and mocks after each test.
- Remove production `NODE_ENV === 'test'` bypasses where they hide required state/cache logic. Use dependency mocks and explicit cache reset methods instead.
- Treat accessibility checks as behavior: labels, keyboard operation, pending state, focus return and empty/error messages. Do not rely only on snapshots.

### Commands

Run focused tests after each package, then this combined pass. Paths are quoted for PowerShell parentheses/brackets.

```powershell
npx vitest run src/shared/feed src/server/domain/progress src/app/api/progress/chunk src/app/api/feed src/app/api/user/cohort-config src/app/api/user/channel-config src/client/screens/dashboard/home src/client/mobile/screens/Home src/client/screens/dashboard/play/hooks "src/app/(dashboard)/home" "src/app/api/cohort/[id]/join"
npx vitest run src/server/domain/home src/server/domain/feed src/server/domain/cohort-creation/__tests__/delivery-feed.test.ts
npx tsc --noEmit --incremental false
npx eslint src/client/screens/dashboard/home src/client/mobile/screens/Home src/client/repositories/homeStorageAdapter.ts src/client/repositories/homeRepository.ts src/shared/feed src/app/api/feed "src/app/(dashboard)/home" src/app/api/user/cohort-config src/app/api/user/channel-config src/server/domain/home src/server/domain/feed
npm run build
```

Also lint/test the changed progress/playback/shared UpcomingEvents files explicitly; the scoped command above is not the entire changed-file set. If a planned new folder was unnecessary, omit only that nonexistent test path, not existing tests. Build may require the project's environment and generated workspace packages; report environment blockers separately from code errors. Never print secret environment values.

Fix touched-file explicit-any/type errors with actual inferred/DTO types; avoid `as any`, eslint-disable, weakening tsconfig, or changing tests to bypass the new contract. If unrelated baseline failures remain, record their exact files and reasons without claiming the whole repository passes.

### Manual acceptance matrix

| Scenario | Expected result |
|---|---|
| New account, no subscriptions | Real empty state; no fake cohorts/streak/rooms |
| Slow Home response | Inert loading shell; no local data seeded |
| Home database outage | Retry/error, not successful empty collection |
| Finish last retained chunk | Completion acknowledged; Home refresh shows completed lesson/cohort |
| Progress DB outage | Chunk restored; visible retry; no false success |
| Page through feed while completing | Every unseen eligible item remains reachable |
| Open Part 2 directly / replay Part 1 | Exact requested authorized chunk first |
| Catalog >100 lessons | Later lesson reachable |
| Save slider, change general pref/hydrate | Slider value and Feed request remain identical |
| Navigate immediately after edit | Saved or explicit persisted dirty draft, never silent loss |
| Account A -> logout -> account B | No A content, draft, preference, or pending response reused |
| Pause A, resume A, reload | Persisted active-first/paused-last normalized order |
| Act on another card while save pending | Disabled/guarded until first settles |
| Pause indefinitely / custom local date | Indefinite remains paused; custom covers selected day |
| Mobile all-paused state | Cohorts visible and resumable |
| Local midnight/timezone edge | Correct calendar day and schedule score |
| Keyboard-only / 320px viewport | All supported controls usable, no overflow |

### Memory updates after implementation only

- `MEMORY/home-dashboard.md`: canonical progress source, loading/error ownership, mutation guard, server order transaction, mobile shared controls, focused commands.
- `MEMORY/cache-boundaries.md`: remove obsolete Home/catalog caching claims; document required-vs-optional Feed reads, POST no-store, vector cache key.
- `MEMORY/play-playback.md`: exclusion continuation, exact selection/replay, durable completion acknowledgment and v2 cache behavior.
- Update an existing directive only if its actual instructions changed. Do not create unrelated directives or duplicate this entire plan into MEMORY.

## 3. Done checklist — do not mark complete early

- [x] FH-01 truthful, validated progress persistence and client acknowledgment.
- [x] FH-02 Home derives retained completion from Mongo; legacy fallback tested.
- [x] FH-03 explicit selection/replay survives frontier/completion filtering.
- [x] FH-04 offset-free client continuation, migration and race tests.
- [x] FH-05 full authorized catalog batching with no silent first-100 cutoff.
- [x] FH-06 user-scoped canonical preferences, hydration and reliable save lifecycle.
- [x] FH-07 globally guarded Home mutations and identity-safe rollback.
- [x] FH-08 atomic durable rank/pause changes; cache/count/ID corrections.
- [x] FH-09 loading/error/empty separation; no swallowed required state failures.
- [x] FH-10 mobile pause/resume/edit/delete/channel/completed functionality.
- [x] FH-11 current local-day scoring without double timezone shifts.
- [x] FH-12 honest activity/rooms/calendar/provider/reminder UI.
- [x] FH-13 proven dead implementations and stale exports removed.
- [x] FH-14 integration tests, lint, types, build, manual acceptance and memory updated.

Final implementation report must list which packages are complete, test counts, remaining failures/blockers, schema/runtime requirements, and any intentionally unavailable features. Do not say all bugs are fixed merely because the old 113 passing tests still pass. Do not deploy or execute the older plans below unless separately instructed.

---

**END OF FEED/HOME PLAN — earlier plans below are preserved historical context, not part of this request.**

---

# Fix video quest structure, complete playback coverage, overlap, and durations

Status: inspection complete; implementation proposed, not executed.

## Required result

Different source videos remain separate video lessons. One source video must appear once, with its original title and ordered parts underneath:

```text
There's never been a better time to go into math: …
  Part 1   [start–end] [actual duration]
  Part 2   [start–end] [actual duration]
  Part 3   [start–end] [actual duration]
  …
  End
```

`End` marks the actual end of the video, not another empty chunk. No repeated parent video rows for individual observations, no Part 0, no repeated source title beside every part, no omitted playback seconds, and no fabricated 3-minute durations.

The existing code expresses a 60-second minimum target and 15-second successive playback overlap. Preserve these as the implementation baseline. A genuinely short video can have one short part; merge tiny trailing remainders into the preceding part when practical.

## Inspection findings

The screenshot shows repeated source titles, one chunk per lesson, Part 0, 0:00–0:04 followed by 0:11–0:20, and identical 3m labels. It establishes a displayed coverage gap; it does not establish that the underlying video file lost frames.

1. **Assembly makes chunks into separate lessons.** `src/server/domain/cohort-builder/text-pipeline.ts`, `computeTextStage`, maps `state.chunks` directly into generated lessons with titles derived from observation text. Its acceptance path requires lesson count to equal chunk count. `text-assembly-processor.ts` repeats that count requirement. Delivery faithfully publishes each resulting lesson. This is a structural problem upstream of the UI.
2. **Text coverage is not video timeline coverage.** `text-pipeline.ts`, `splitSource`, currently groups timed locations toward 60 seconds and validates retained text characters. It does not require coverage from video time zero to the source duration. Its 24 KiB evidence bound can also produce smaller units. `src/server/domain/cohort-creation/material-observation.ts` explicitly permits and records unobserved temporal gaps. Observation intervals are evidence anchors, not a complete playback partition.
3. **Overlap is not guaranteed by the current helper.** `src/shared/cohort-builder/cohort-metadata.ts`, `deriveChunkVideoInterval`, extends a raw end by 15 seconds, clamped to the final observation end. It does not inspect the next chunk's start. A gap greater than 15 seconds still leaves missing playback; a smaller gap reduces the actual overlap. Leading/trailing video content outside observations is also excluded.
4. **Another chunking path changes duration without changing playback anchors.** `src/server/domain/cohort-creation/chunking.ts`, `groundChunkBoundaries`, calculates a minimum duration and backward overlap but leaves `sourceRefs` unchanged. Its existing minimum/overlap test checks duration numbers only. This cannot prove playable interval coverage or real overlap. Verify whether this path serves the affected cohort before changing its behavior, but align any active video path with the same contract.
5. **Part 0 is a direct indexing leak.** `src/shared/cohort-builder/delivery.ts` stores zero-based chunk order; `LessonRow.tsx` renders `Part {chunk.order}`. `delivery.adapter.ts` also assigns the source label as every chunk's title, explaining the repeated title within parts.
6. **Duration behavior differs between the screenshot and current local code.** Current `delivery.ts` calculates video lesson duration from chunk intervals; its 180-second floor is now limited to non-video lessons. Summing overlapping intervals still inflates a grouped video's duration. `delivery.adapter.ts` persists the duration and labels every chunk as `reading_estimate`, even for video. `cohortStore.ts` contains 3-minute chunk fallbacks. These are verified problems/candidates, but the exact origin of the screenshot's 3m requires checking the affected persisted payload and deployed revision.
7. **Fallbacks can hide missing timing.** `src/server/infrastructure/db/postgres/mappers/cohortMapper.ts` synthesizes five-minute chunks for missing chunk arrays and substitutes zero timestamps. Player/feed paths also need inspection during implementation so missing timing does not become apparently valid playback.

Scope of evidence: local source and supplied screenshot inspected. No production database, deployed revision, or actual retained artifact for this cohort was inspected. Current local 60-second grouping and duration logic mean it would be incorrect to attribute every screenshot symptom to today's code without that comparison. `directives/process_video.md` and `execution/inspect_videos.py` concern local media encoding/inspection, not this curriculum projection.

## Implementation sequence

### 1. Capture a reproducible affected-cohort fixture

- Resolve the exact cohort/workspace from the supplied page and authorized application data. Read its saved sources, source duration/provenance, observation locations, chunks, generated lessons, delivery payload, and deployed code/version.
- Compare saved output with current deterministic projection. Identify stale artifacts, publication snapshots, and mapper fallbacks separately.
- Retain a sanitized regression fixture for the observed 0:00–0:04 / 0:11–0:20 gap, repeated lessons, and 3m labels. Keep transient inspection output in `.tmp/`; never copy secrets into fixtures.

### 2. Define a source-level playback plan

- Introduce one shared, deterministic playback planner using the ordered parts and verified full video duration. Keep immutable text/evidence offsets separate from playable time ranges.
- Partition the full timeline into contiguous core intervals covering exactly `[0, videoDuration]`. Use meaningful boundaries near the existing 60-second target; merge tiny adjacent fragments/remainders. Internal byte-bounded evidence units must not force tiny learner-facing parts.
- Add 15 seconds of context across each successive boundary, clamped to the video end. Validate actual interval intersection, not a claimed overlap field. Consolidate boundary cases where a tiny final interval cannot satisfy the normal rule.
- Example for a 180-second source: playback parts `0:00–1:15`, `1:00–2:15`, `2:00–3:00`. This covers the full video and has 15 seconds of real overlap at each boundary.
- Explicitly include leading, internal, and trailing regions with no observations in playback. Do not invent a transcript or claim those regions were analyzed. Preserve observation limitations independently. If complete semantic analysis is required, missing observations require reacquisition/review, not fabricated summaries.
- If duration/timing cannot be verified, surface that limitation and block acceptance as a complete timed video. Do not substitute 0, 1 second, or 180 seconds as known duration.

### 3. Generate one video lesson containing all its parts

- Update `text-pipeline.ts` assembly and `text-assembly-processor.ts` validation together: group video chunks by canonical source identity/version in source order, and generate one stable lesson per video source with the original video title.
- Keep different videos separate even when their titles match. Preserve non-video behavior unless required by a shared invariant.
- Replace `lessons.length === chunks.length` checks with complete, ordered, exactly-once evidence membership checks appropriate to grouped lessons.
- Update `text-assembly-acceptance.ts`, `lesson-projection.ts`, preview, and delivery to use identical grouping. Handle pinned/manual lessons explicitly so old generated rows cannot survive beside the new grouped row or erase intentional edits.

### 4. Carry truthful timing and labels through delivery

- Extend shared contracts as needed for playback/core ranges, timing availability/provenance, and part identity. Use the shared playback plan in builder preview, delivery, persisted chunks, questline, and player/feed.
- In `delivery.ts`, set the full-video parent duration to verified source duration. Set each part duration to its actual playable end minus start. Do not sum overlapping parts to obtain unique source duration; keep any replay-inclusive study estimate separately named.
- In `delivery.adapter.ts`, retain accurate timing provenance, part metadata, and identifiers instead of labeling videos as reading estimates or duplicating the parent title.
- In `cohortMapper.ts`, `cohortStore.ts`, and the connected player/feed adapters, remove fabricated timing fallback behavior for these video records. Format short durations in seconds and longer durations as minutes plus seconds.
- In `LessonRow.tsx`, render one parent row, child labels Part 1 through Part N, and an end marker. Keep internal ordering zero-based; convert only at the display boundary. All jump links must resolve to the same stored playable starts/ends.
- Update lesson/quest counts, completion totals, season summaries, and navigation to reflect grouped video lessons with independently tracked parts.

### 5. Repair existing output safely

- Version the changed chunking/assembly/delivery algorithms and publication hash inputs. Preserve acquisition identities and reusable retained source artifacts; do not bump the global algorithm version indiscriminately or rerun paid observation by default.
- Implement a dry-run repair that reports old/new lesson counts, part ranges, coverage gaps, overlap, durations, and ID mappings for the affected cohort.
- Rebuild from retained evidence and verified duration. Replace stale generated lessons rather than appending another set. Handle manual edits and existing learner progress through explicit mappings; do not mark newly included content complete merely because old fragments were complete.
- Materialize through existing transactional/idempotent release paths. Preserve rollback data and avoid creating a duplicate learner cohort when the user expects the existing cohort repaired. Confirm the publication identity/update strategy before applying repair.
- This planning task performs no regeneration, paid provider calls, production writes, or deployment.

### 6. Regression checks and acceptance

- One video with many observations produces exactly one parent lesson and sequential Part 1…N. Two distinct videos produce exactly two parents, including when titles match.
- Playback interval union equals the complete verified video timeline: first start 0; last end full duration; no internal gap, including 0:04–0:11. All bounds are valid and monotonic.
- Successive intervals have real 15-second overlap under the normal rule. Short-source/end cases are explicitly tested and consolidated as needed.
- Ordinary non-final parts meet the 60-second baseline without merely inflating a duration field. Test sparse observations, byte-limit splits, Unicode evidence, leading/trailing gaps, and tiny remainders.
- Exact retained evidence and checksums remain intact. Added playback context never masquerades as observed text. Missing metadata produces an explicit incomplete state.
- Parent duration equals the full source duration; part duration equals actual interval length. No blanket 3m label, no overlap double-counting, no Part 0, and no repeated parent title in child rows.
- Exercise the complete projection → persistence → mapper → questline/player path; verify links, part transitions, progress, counts, and restart/idempotent repair behavior.
- Expand existing focused tests in `text-pipeline.test.ts`, `text-assembly-acceptance.test.ts`, `text-assembly-processor.test.ts`, `cohort-metadata.test.ts`, `delivery.test.ts`, `cohortMapper.test.ts`, and the applicable creation chunking tests. Add a focused LessonRow regression and run type checking after implementation.
- Inspect the repaired cohort visually at desktop and mobile widths. Verify the actual saved/reloaded output, not just a mock.
- Update `MEMORY/cohort-builder-processing.md` with the new grouping/playback contract after implementation; leave the unrelated media-encoding directive unchanged.

## Completion condition

The affected existing cohort displays each distinct video once, with correctly numbered substantial parts, complete start-to-end playback, real successive overlap, truthful durations, working navigation, and preserved/mapped learner state. Passing unit tests alone is insufficient; the persisted cohort must meet these conditions after reload.


---
---

# Cleanup & Lean-down Plan — Composer / Client-Extraction / Plan-Chat (commits 6fb117ef..7013bb91)

Reviewed 39 files (+3813/−161). Tags: **[BUG]** defect, **[DUP]** duplicate/dead, **[LEAN]** over-engineered, **[RISK]** latent hazard.
User decisions locked in:
1. **A3 (YouTube Transcripts)**: Fetch real captions when available via `/api/import/youtube/transcript`; fall back cleanly to factual video metadata/chapters when captions are unavailable.
2. **B2 (SHA-256)**: Keep `src/shared/cohort-builder/hash.ts` zero-dependency and small; remove the redundant manual UTF-8 surrogate-pair encoder (`utf8Encode`).
3. **B6 (Legacy Import Routes)**: Delete only routes confirmed to have zero active call sites; preserve `/api/import/{notion,github,youtube/playlist}` while `src/app/(dashboard)/create-cohort/page.tsx` (`importService.ts`) remains mounted.

---

## Execution Status Snapshot (Where Previous Run Paused)

### Already Completed in Working Tree (Uncommitted, Passing `tsc --noEmit` & 25/25 Vitest)
- **[DONE] B5**: Created `src/shared/cohort-builder/source-kind.ts` (`detectSourceKind`) + `src/shared/cohort-builder/__tests__/source-kind.test.ts`.
- **[DONE] A3**: Created `src/app/api/import/youtube/transcript/route.ts` using `LiveYoutubeTranscriptProvider` + `normalizeTranscriptPayload`.
- **[DONE] A2, A3, B3**: Updated `src/client/lib/sourceExtractors/youtubeClientExtractor.ts` to use shared `formatYoutubeTimestamp`, fetch real transcripts first (~90s/2000-char windows), and fall back to factual metadata/chapters with `estimatedIntervals: true` and `limitations` (zero invented `"Core concept: Part 2"` titles).
- **[DONE] B4, C10**: Updated `src/client/lib/sourceExtractors/githubClientExtractor.ts` to use `pLimit(6)` bounded concurrency and renamed `extractGithubRepoClient` directly to `extractGithubClient`.
- **[DONE] A4, B10**: Updated `src/client/lib/sourceExtractors/pdfClientExtractor.ts` to bundle the worker via `new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()`, removed duplicate `OffscreenCanvas` branch, and threw honest error on empty/scanned PDFs. Kept `declare module 'pdfjs-dist';` in `src/types/ambient.d.ts` (required by TypeScript `bundler` resolution for `pdfjs-dist@6.4.299`).
- **[DONE] C9**: Updated `src/app/api/import/link-preview/route.ts` to strip `<script>`, `<style>`, `<noscript>`, `<svg>` blocks on server, and `src/client/lib/sourceExtractors/webClientExtractor.ts` to throw honest error when page has no readable text.
- **[DONE] C4**: Collapsed `src/client/components/global/Composer/SourceIcon.tsx` from 192 lines to 69 lines (`ICONS` record + single `<svg>` wrapper; dropped unused `variant="mono"`).
- **[DONE] B5, B12, C5**: Cleaned `LinkRows.tsx`, `AttachmentTray.tsx` (removed `file?: File` retention from React state), and `Composer/index.ts`.
- **[DONE] A1, A5 (hook side), C1, C2, C5**: Refactored `src/client/components/global/Composer/useComposerAttachments.ts` (372 -> 198 lines) with YouTube playlist fan-out (reusing batch metadata without re-fetching, cap 100), 3MB total UTF-8 text budget (`MAX_TOTAL_TEXT_BYTES`), and `useSyncedList` ref synchronization. Added `src/client/components/global/Composer/__tests__/useComposerAttachments.test.tsx`.

---

## Remaining Execution Plan (Step-by-Step Instructions for Executor)

Execute the following 6 steps sequentially. Do **not** skip any verification gate.

### Step 1 — Isomorphic Hash & Single Shared Deterministic Pipeline (`B1, B2, B11, C6`)

#### 1.1 `src/shared/cohort-builder/hash.ts` (**B2**)
- Delete the manual `utf8Encode(str: string)` function (lines 30–65).
- In `sha256(value: string | Uint8Array)`, encode strings directly with `const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;`.

#### 1.2 `src/shared/cohort-builder/client-pipeline.ts` (**B1, C6**)
- In `byteLengthUtf8(str: string)` (lines 18–37), replace the manual surrogate loop with `return new TextEncoder().encode(str).byteLength;`.
- Export `validateCoverage` and `validateChunk` (already exported) and `projectGeneratedLessons` (already exported).
- Ensure `sourceFingerprint` accepts `Pick<CohortWorkspace, 'sources'>`.

#### 1.3 `src/server/domain/cohort-builder/text-pipeline.ts` & `lesson-projection.ts` (**B1**)
- In `src/server/domain/cohort-builder/lesson-projection.ts`, replace the duplicate implementation with a direct re-export:
  ```ts
  export { projectGeneratedLessons } from '@/src/shared/cohort-builder/client-pipeline';
  ```
- In `src/server/domain/cohort-builder/text-pipeline.ts`:
  - Remove `createHash` from `'node:crypto'`.
  - Remove duplicate definitions of `MAX_UNIT_BYTES`, `MIN_VIDEO_CHUNK_MS`, `sourceFingerprint`, `pushBoundedTextChunks`, `splitSource`, `validateCoverage`, `validateChunk`, `isVideoSource`, `lessonCopy`, `buildGeneratedLessons`, and `validateGeneratedLessonCoverage`.
  - Import and re-export from `@/src/shared/cohort-builder/client-pipeline`:
    ```ts
    import { sha256 } from '@/src/shared/cohort-builder/hash';
    import {
      MAX_UNIT_BYTES,
      MIN_VIDEO_CHUNK_MS,
      sourceFingerprint,
      splitSource,
      validateCoverage,
      validateChunk,
      buildGeneratedLessons,
      validateGeneratedLessonCoverage,
      projectGeneratedLessons,
    } from '@/src/shared/cohort-builder/client-pipeline';

    export {
      MAX_UNIT_BYTES,
      MIN_VIDEO_CHUNK_MS,
      sourceFingerprint,
      splitSource,
       validateCoverage,
      validateChunk,
      buildGeneratedLessons,
      validateGeneratedLessonCoverage,
    };
    ```
  - In `computeTextStage` and `planTextStage`, replace `digest(x)` with `sha256(x)`.
  - Keep `TextStage`, `TextStageAction`, `computeTextStage`, `planTextStage`, and `planTextFailure` in `text-pipeline.ts` untouched in behavior.

#### 1.4 CSS Orphan Cleanup (**B11**)
- Inspect `src/client/components/global/Composer/AttachmentTray.module.css`: remove unused `.errorBadge` (lines 155–161) if not referenced in `AttachmentTray.tsx`.
- Inspect `src/client/components/global/Composer/LinkRows.module.css`: verify all classes are referenced in `LinkRows.tsx`.

#### 1.5 Step 1 Verification
- Run: `npx vitest run src/shared/cohort-builder/__tests__/hash.test.ts src/shared/cohort-builder/__tests__/client-pipeline.test.ts src/server/domain/cohort-builder/__tests__/text-pipeline.test.ts`

---

### Step 2 — Single-Tree Centered Layout in `CohortInteractionScreen.tsx` & `ChatPane.tsx` (`A8, B9, C3`)

#### 2.1 Why
Currently `InnerBuilderScreen` in `src/client/screens/cohortBuilder/CohortInteractionScreen.tsx` has an `if (isChatStep) { return ... }` early return (lines 75–116) that renders `<main><ChatPane /></main>`, while the split branch renders `<aside><ChatPane /></aside><div className={styles.canvas}>...</div>`. When the user transitions from `step === 'chat'` to `step === 'recommendations'` (or closes the panel back to `chat`), React unmounts and remounts `<ChatPane />`, wiping local `input` draft state and scroll position.

#### 2.2 `src/client/screens/cohortBuilder/ChatPane.tsx` (**B9**)
- Remove `isCentered?: boolean` from `ChatPaneProps` and component signature.
- Render `<div className={styles.railBody}>` (remove `${isCentered ? styles.centeredChatPane : ''}`).

#### 2.3 `src/client/screens/cohortBuilder/CohortInteractionScreen.tsx` (**A8, C3**)
- Remove the `if (isChatStep)` early-return block (lines 75–116).
- Render a **single** root `<div id="main-content" className={styles.page} data-theme={theme} data-layout={isChatStep ? 'centered' : 'split'} data-variant={stage} data-rail-collapsed={!isChatStep && collapsed} data-pane={pane}>`.
- Inside `<div id="main-content">`:
  1. Render `<nav className={styles.paneNavigation} aria-label="Builder views">` only when `!isChatStep` (`{!isChatStep && (<nav ...>...</nav>)}`).
  2. Render `<aside className={styles.rail} aria-label={isChatStep ? 'Conversational cohort planning' : 'Creation conversation'}>`:
     - Inside `<header className={styles.brandHeader} aria-label={isChatStep ? 'Plan chat header' : undefined}>`:
       - Render the `<Link className={styles.brand} href="/" aria-label="Undone home">...</Link>` once.
       - When `isChatStep`: render `<div className={styles.tools}><span className={styles.srOnly}>Rev #{state.revision}</span><ThemeToggle /><Link href="/home" className={styles.account} aria-label="Open your account">Y</Link></div>` on the right side of `.brandHeader`.
       - When `!isChatStep`: render the `<button type="button" className={styles.railToggle} ...>` collapse button.
     - Render `<ChatPane attachedEntity={attachedEntity} onClearAttachedEntity={() => setAttachedEntity(null)} connection={connection} />` in the exact same JSX position in `<aside className={styles.rail}>` regardless of `isChatStep`.
  3. Render `{!isChatStep && (<div className={styles.canvas}>...</div>)}` so the workspace canvas and toolbar only render in split mode.
  4. Keep `{showCloseModal && (...)}` modal dialog as-is.

#### 2.4 `src/client/screens/cohortBuilder/CohortBuilder.module.css` (**A8, B9**)
- Replace `.centeredChatPage`, `.centeredChatHeader`, `.centeredChatMain`, `.centeredChatPane` (lines 2766–2829) with clean `data-layout='centered'` rules on `.page` (zero `!important`):
  ```css
  .page[data-layout='centered'] {
    grid-template-columns: minmax(0, 1fr);
  }

  .page[data-layout='centered'] .rail {
    border: none;
    border-radius: 0;
    box-shadow: none;
    background: transparent;
  }

  .page[data-layout='centered'] .brandHeader {
    padding: 16px 36px;
    border-bottom: 1px solid color-mix(in srgb, var(--creation-line) 40%, transparent);
    background: color-mix(in srgb, var(--creation-paper) 80%, transparent);
    backdrop-filter: blur(8px);
  }

  .page[data-layout='centered'] .railBody {
    width: 100%;
    max-width: 860px;
    margin: 0 auto;
  }
  ```

#### 2.5 `src/client/screens/cohortBuilder/__tests__/shell.test.tsx` (**A8, Phase D**)
- Update the `'renders centered single-column chat layout when journey.step is chat (PLAN-023)'` test (lines 249–273):
  - Check `expect(document.getElementById('main-content')?.getAttribute('data-layout')).toBe('centered')`.
  - Check `expect(screen.getByRole('banner', { name: 'Plan chat header' })).toBeDefined()`.
  - Check `expect(screen.queryByRole('banner', { name: 'Workspace toolbar' })).toBeNull()`.
  - Add assertion that typing into `screen.getByLabelText('Message the cohort assistant')` while `step === 'chat'` and then rerendering with `step === 'recommendations'` preserves the exact `HTMLTextAreaElement` DOM node and its typed `.value`!
- Run: `npx vitest run src/client/screens/cohortBuilder/__tests__/shell.test.tsx`

---

### Step 3 — Intake Size Guard, `intake-draft.ts` Quota Safety & `LearningPromptBar.tsx` Cleanup (`A5, A6, A7, B8, C11, D1`)

#### 3.1 `src/app/api/cohort-builder/intake/route.ts` (**A5**)
- Line 47 currently caps the POST stream at `if (size > 850_000)` (~850 KB), whereas the client attachment budget in `useComposerAttachments.ts` is 3 MB (`3 * 1024 * 1024`).
- Raise the stream byte cap in `src/app/api/cohort-builder/intake/route.ts` line 47 from `850_000` to `3_500_000` (3.5 MB, safely under Vercel's 4.5 MB serverless body limit while accommodating the 3 MB extracted text budget).

#### 3.2 `src/client/screens/cohortBuilder/intake-draft.ts` (**A5**)
- In `saveIntakeDraft(body: CohortIntakeInput, ownerId: string | null)`:
  - Wrap `sessionStorage.setItem(key, JSON.stringify({ body: validated, ownerId, createdAt: Date.now() }))` in a `try / catch`.
  - In the `catch` block (e.g. `QuotaExceededError` when `sources` is several megabytes), retry `sessionStorage.setItem` with `sources` omitted (`const { sources: _dropped, ...lightweight } = validated;`) inside a nested `try / catch {}` so saving the draft never throws an unhandled exception or blocks `fetch('/api/cohort-builder/intake')`.

#### 3.3 `src/client/components/global/LearningPromptBar/LearningPromptBar.tsx` (**A6, A7, B8, C11**)
- **A7 (Disable submit while extracting)**:
  - Compute `const isBusy = submitting || composerAttachments.isExtracting;`.
  - On the "Plan" button (line 558): set `disabled={isBusy}` and label `<span>{composerAttachments.isExtracting ? 'Reading…' : 'Plan'}</span>`.
  - On the "Begin journey" button (line 571): set `disabled={isBusy}` and label `<span>{composerAttachments.isExtracting ? 'Reading files…' : 'Begin journey'}</span>`.
  - In `handleSubmit`: guard `if (!textToSearch.trim() || submitting || composerAttachments.isExtracting) return;`.
- **A6 (Shift+Enter keyboard shortcut for Plan mode)**:
  - On `<TextBar>`: pass `onKeyDown={(e) => { if (e.key === 'Enter' && e.shiftKey && !e.ctrlKey && !e.metaKey) { e.preventDefault(); void handleSubmit('plan'); } }}`.
- **B8 & C11 (Consolidate draft persistence & clean `handleSubmit`)**:
  - Extract small module-level helper functions in `LearningPromptBar.tsx`:
    - `persistPromptDraft(query: string, sourceText: string, showSource: boolean)`
    - `clearPromptDraft()`
    - `navigateTo(router: ReturnType<typeof useSafeRouter>, href: string)` (`if (router) router.push(href); else if (typeof window !== 'undefined') window.location.assign(href);`)
  - Use `persistPromptDraft` in both the 200ms debounce `useEffect` and `beforeunload` handler, and `clearPromptDraft` once on successful submission. Keep the existing storage keys (`sidequest_prompt_query_draft`, `sidequest_prompt_source_draft`, `sidequest_prompt_source_visible`, `undone:landing-query`) so any external consumers remain 100% compatible.
  - Keep `source` in `cohortIntakeSchema` (`src/shared/cohort-builder/intake.ts`) because `src/shared/cohort-builder/__tests__/intake.test.ts` (lines 8, 19–29) and `acceptCohortIntake` explicitly test `body.source`.

#### 3.4 `src/client/components/global/LearningPromptBar/__tests__/LearningPromptBar.test.tsx` (**Phase D1, A6, A7**)
- Mock `next/navigation` at the top of `LearningPromptBar.test.tsx`:
  ```ts
  const pushMock = vi.fn();
  vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: pushMock }),
  }));
  ```
  This eliminates the jsdom `Error: Not implemented: navigation (except hash changes)` stderr noise during test runs.
- Add unit tests in `LearningPromptBar.test.tsx` for:
  1. `Shift+Enter` in the prompt input submits in `'plan'` mode (`mode: 'plan'`).
  2. While a file or link is extracting (`isExtracting === true`), the `Plan` and `Begin journey` buttons are disabled (`disabled === true`).
- Run: `npx vitest run src/client/components/global/LearningPromptBar/__tests__/LearningPromptBar.test.tsx src/shared/cohort-builder/__tests__/intake.test.ts`

---

### Step 4 — Lean AI Tool List & Context Excerpt Budget (`C7, C8`)

#### 4.1 `src/server/domain/cohort-builder/tools.ts` (**C7**)
- Define `const ALWAYS_TOOLS = ['start_search', 'set_intent'] as const;`.
- Spread `...ALWAYS_TOOLS` into every stage in `STAGE_TOOL_NAMES` (except `processing`, which only exposes cancellation/retry tools `['cancel_text_processing', 'cancel_source_processing', 'retry_text_job']`).
- Remove `'add_pdf_source'` from `STAGE_TOOL_NAMES.chat` (PDFs are uploaded via client device composer, never invented as uploadIds in chat).
- Verify or add a test in `src/server/domain/cohort-builder/__tests__/ai-interaction-optimization.test.ts` confirming `start_search` and `set_intent` are present in `chat`, `recommendations`, `starting_point`, `discovery`, `goal_setup`, `material_input`, `ready`, and `published`, and `add_pdf_source` is not in `chat`.

#### 4.2 `src/server/domain/cohort-builder/context.ts` (**C8**)
- Currently `sourceExcerpts` slices 2,000 chars for up to 8 sources (16,000 chars / ~4k tokens) on **every** turn, even in `ready` or `published` stages when `state.chunks` (30 chunks × 500 chars) and `state.lessons` are already populated and sent in the same prompt.
- Make `sourceExcerpts` stage-aware:
  - When `state.lessons.length === 0` or `state.journey?.step` is `'chat' | 'recommendations' | 'starting_point' | 'material_input' | 'discovery' | 'goal_setup'`: include up to `2000` chars per source (`excerpt: (source.text || '').slice(0, 2000)`).
  - Once `state.lessons.length > 0` and step is `'ready' | 'published'`: include a compact 240-char summary preview (`excerpt: (source.text || '').slice(0, 240)`) since anchored `state.chunks` and `state.lessons` are already in the prompt.
- Run: `npx vitest run src/server/domain/cohort-builder/__tests__/`

---

### Step 5 — Documentation & Operational Memory (`Phase D4, D5`)

1. Create `MEMORY/composer-and-client-extraction.md`:
   - Document authoritative paths:
     - `src/shared/cohort-builder/hash.ts` (isomorphic SHA-256)
     - `src/shared/cohort-builder/source-kind.ts` (`detectSourceKind`)
     - `src/shared/cohort-builder/client-pipeline.ts` (authoritative deterministic chunking, coverage, lesson assembly, and `runDeterministicPipeline`)
     - `src/client/lib/sourceExtractors/{pdf,youtube,github,web}ClientExtractor.ts`
     - `src/app/api/import/{youtube/metadata,youtube/transcript,link-preview}/route.ts`
     - `src/client/components/global/Composer/{useComposerAttachments,LinkRows,AttachmentTray,SourceIcon}.tsx`
     - `src/client/components/global/LearningPromptBar/LearningPromptBar.tsx`
     - `src/client/screens/cohortBuilder/{CohortInteractionScreen,ChatPane}.tsx`
   - Document invariants: 3MB client extracted text budget (`3.5MB` intake route limit), playlist fan-out (up to 100 videos), real caption fetch with factual metadata fallback, bundled `pdfjs-dist` worker, single-tree `data-layout="centered" | "split"` preserving `ChatPane` mount state.
2. Add `- [composer-and-client-extraction.md](composer-and-client-extraction.md): ...` to `MEMORY/README.md`.
3. Append a `## Phase 7: Post-Implementation Cleanup & Lean-down Verification` section to `docs/audit/Composer-Chat-Audit-Ledger.md` summarizing A1–A8, B1–B12, C1–C11 resolutions.

---

### Step 6 — Full Verification, Sequential Commits, Push & Vercel Deployment

1. **Typecheck**: `npx tsc --noEmit` (must exit 0).
2. **Unit & Integration Tests**: `npx vitest run` (all suites must pass).
3. **Vercel Pre-Flight Build Gate**: `npm run verify:vercel` (must exit 0).
4. **Sequential Git Commits** (do not `git add` untracked scratch files if any; only commit tracked/intended files):
   - Commit 1: `fix(extractors): real youtube transcript proxy, factual fallback, bundled pdf worker, p-limit github`
     - Files: `src/shared/cohort-builder/source-kind.ts`, `src/shared/cohort-builder/__tests__/source-kind.test.ts`, `src/app/api/import/youtube/transcript/route.ts`, `src/app/api/import/link-preview/route.ts`, `src/client/lib/sourceExtractors/*`, `src/types/ambient.d.ts`
   - Commit 2: `fix(composer): playlist fan-out, 3MB text budget, extraction gating, lean icons and hook`
     - Files: `src/client/components/global/Composer/*`, `src/client/components/global/LearningPromptBar/*`, `src/client/screens/cohortBuilder/intake-draft.ts`, `src/app/api/cohort-builder/intake/route.ts`
   - Commit 3: `refactor(cohort-builder): deduplicate deterministic text pipeline and hash encoder`
     - Files: `src/shared/cohort-builder/hash.ts`, `src/shared/cohort-builder/client-pipeline.ts`, `src/server/domain/cohort-builder/text-pipeline.ts`, `src/server/domain/cohort-builder/lesson-projection.ts`
   - Commit 4: `refactor(builder): single-tree centered chat layout, lean AI tools and excerpt budget, docs`
     - Files: `src/client/screens/cohortBuilder/CohortInteractionScreen.tsx`, `src/client/screens/cohortBuilder/ChatPane.tsx`, `src/client/screens/cohortBuilder/CohortBuilder.module.css`, `src/client/screens/cohortBuilder/__tests__/shell.test.tsx`, `src/server/domain/cohort-builder/tools.ts`, `src/server/domain/cohort-builder/context.ts`, `src/server/domain/cohort-builder/__tests__/*`, `MEMORY/*`, `docs/audit/Composer-Chat-Audit-Ledger.md`, `PLAN.md`
5. **Push & Verify Live Deployment**:
   - `git push origin master`
   - `npx vercel ls --yes` / `npx vercel inspect <url>` until status reaches `● Ready`.

