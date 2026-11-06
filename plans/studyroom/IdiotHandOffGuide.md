# Studyroom: implementation handoff for all 27 findings

## A. Execution contract

**Readiness: READY for local implementation; release BLOCKED until the live gates below pass.** This guide supplies exact edits for H01–H14 and M01–M13. It does not certify flawless behavior or minimum monetary cost.

Root: `D:/ThisPC/Documents/SideQuestHQ/undone-site`. Shell: PowerShell. Runtime: Node 24.14.1, npm, installed TypeScript/Prisma/Vitest. Audit baseline: `3aab416214abc6f9b31163fc9945012d191bd34a`. Handoff baseline: `95b635f76e2916f5ab8fccd6e85afdee6549d447`, branch `master`. Application source is unchanged between those commits; intervening changes are documentation. The checkout was clean before this resumed authoring. This task updates this guide and `MEMORY/study-rooms.md`; preserve them and subsequent unrelated work.

There are 64 application/test/schema file edits, no dependency/lockfile changes. The investigation is `plans/studyroom/2026-11-05-studyroom-investigation.md`; B restates every finding, so execution does not require this conversation. All implementation code is embedded here; the author's temporary copy is not a dependency.

Order: S0 preflight → S1 exact edits → S2 storage/client → S3 automated gates → S4 live gates → S5 cost/memory/report. Stop dependent steps on missing inputs, mismatched hashes, migration failure or failed checks. Report the exact step/error; do not guess replacements or relax assertions. Resume already-applied files only when their postimage hashes match. This guide is not deployment authorization.

Required inputs:

- `DATABASE_URL`: disposable PostgreSQL on localhost, database named exactly `studyroom_handoff_test`. Obtain credentials from the local provisioner; never print them or use production credentials for tests.
- S4 requires a running local app, PostgreSQL, messaging worker and Centrifugo, with independent authenticated non-guest A/B/C users, cohort creator/member/outsider and platform ADMIN fixtures. Use existing environment configuration and secret store for `CENTRIFUGO_API_KEY`, `CENTRIFUGO_TOKEN_HMAC_SECRET_KEY`, `CENTRIFUGO_PROXY_STATIC_KEY` and realtime URL settings. Never deploy compose example secrets.
- S5 monetary acceptance needs actual provider units/rates and an owner-approved seat-hour budget. Neither was supplied; engineering savings can be measured before monetary acceptance.

### Chosen invariants

An unlisted URL permits an admission attempt, not bypass of cohort membership. Eligible first-time users can enter; discovery excludes unlisted rooms. Unadmitted preview excludes environment, sprint, participants and rules. Private/cohort denial uses 404; metadata is generic.

Durable owners manage draft/closed/archived rooms without occupying a seat. Shared control requires eligible live membership even for owner/admin. HOST controls shared activity; MODERATOR additionally moderates lower ranks; owner assigns roles/transfers ownership. Trusted platform ADMIN comes from the database.

Lock order: user row, then distinct room rows sorted by ID; room-only mutations lock the room. Eligibility, revisions, current owner and transfer state are rechecked inside transactions. Each tab lease carries assignment generation; delayed leave cannot delete a newer assignment. Expired renewal requires fresh admission. Public goals and their events commit together in PostgreSQL.

Subscriptions notify; reconnect and event gaps reload authorized snapshots. Room/chat generations are independent. Shared selections converge; audio position, personal volume/mute/tasks/timer remain personal. Healthy roster fallback becomes 120 seconds, disconnected fallback 15 seconds, event refresh debounce 200ms. Renewal stays 30 seconds, TTL 90 seconds. Worker cleanup every 30 seconds processes at most 50 expired candidates, rechecks under locks and emits changes only.

## B. Requirements and acceptance map

S1 is the exact payload; S2 is storage/client. V1–V8 are defined in E. All rows remain pending release acceptance until their required checks pass.

| ID | Required behavior and supplied implementation | Steps | Required checks |
|---|---|---|---|
| H01 | Cold mount waits for connection; warm mount holds one physical subscription/channel. Provider, registry and hooks use stable dependencies and deduplicated channel lists. | S1 | V1 provider test; V4 cold/warm/reconnect counts |
| H02 | HTTP and service reject unknown discovery tabs; valid tabs retain viewer/cohort scope. | S1 | V1 catalog; V4 anonymous/outsider invalid, empty and valid tabs |
| H03 | Bootstrap excludes shared state before admission; sprint/environment GET require live access; metadata generic. | S1 | V1 authorization/routes; V4 exact denial fields for anonymous/outsider/banned/expired/closed |
| H04 | Invalid scope cannot bypass guest/daily checks; cohort creation counts daily; publish/reopen obey standalone open cap under user lock. | S1 | V1 policy; V2 quota race; V4 malformed scope/fourth publish |
| H05 | Fresh eligible user enters unlisted link; unenrolled cohort user denied; discovery excludes room. | S1 | V1 bootstrap; V4 fresh share-link journey |
| H06 | Draft publish, closed reopen and archived restore accessible from owner management/My Rooms independently of admission. | S1 | V1 shell/management; V4 lifecycle UI sequence |
| H07 | Join fetches postlease capabilities; role and transfer changes emit transactional invalidation and refresh bootstrap/roster. | S1 | V1 orchestration/governance; V4 both clients without reload |
| H08 | Retained roles cannot control after departure/kick/ban/demotion/closure. Shared live-access predicate rechecked under lock. | S1 | V1 control negatives; V2 expired host; V4 direct old-tab HTTP |
| H09 | Indexed persisted ID/slug resolver survives duplicate titles, rename and title swaps. | S1 | V1 lookup; V2 rename; V4 ID comparisons |
| H10 | Last-seat joins and lifecycle serialize; switch locks old/new rooms in order. | S1 | V2 real seat race; V5 join/close/switch |
| H11 | Same-revision edits yield one winner; transfer accept/cancel cannot both commit; locked owner/pending checks. | S1 | V2 edits/transfer; V5 repeated real races |
| H12 | First high sequence/later gaps/reconnect hydrate snapshots; independent chat generation. | S1 | V1 orchestration; V6 quiet recovery, >120 events, unequal generations |
| H13 | Stale participant rows grant no chat/sprint/search/interaction access; renewal cannot resurrect expiry; worker runs bounded cleanup. | S1 | V1 messaging/membership; V2 expiry; V4/V6 HTTP/socket denial |
| H14 | Denied state stops protected stage/subscriptions; revoked channel clears bootstrap; closure refreshes owner management. | S1 | V1 shell; V4 kick/ban/close/403 after admission |
| M01 | Retry keeps intent ID; user transaction and partial unique audit index prevent duplicate create commits. | S1,S2 | V2 simultaneous replay; V4 dropped response |
| M02 | Tab leave/beacon carry generation; deletion matches user/tab/room/generation. | S1 | V1 membership; V5 delayed A→B→A exit |
| M03 | Persist public goal; goal/event atomic, hide/switch clear consistently across instances. | S1,S2 | V1 goals; V2 persistence; V6 multi-instance restart |
| M04 | Null clears sound, old revisions ignored; failed write rolls back/refetches with error; stale room responses discarded. | S1 | V1 environment; V6 null, errors, rapid/out-of-order changes |
| M05 | Role UI uses canManageRoles, disallows peer moderation, projects inherited roles and exposes ban list/lift. | S1 | V1 roles; V4 actor matrix/unban |
| M06 | Resolve trusted ADMIN from database when caller omits role; client cannot forge override. | S1 | V1 policy; V4 admin without local authority |
| M07 | Cursor uses last returned row; availability filtered in query; Recent uses durable visit audit. | S1 | V1 discovery; V4 all-page enumeration/departed user |
| M08 | Healthy scheduled roster reads fall from 240 to 30/tab-hour; bursts coalesce; recovery remains bounded. | S1 | V7 actual workload and billing-unit measurements |
| M09 | Bounded expired-lease selection, conditional deletion and changed-only events; two workers cannot evict renewed lease. | S1 | V1 cleanup; V5 competing workers; V7 empty scan |
| M10 | History merges IDs/revisions/intents; old envelopes cannot replace new; reactions update counts/UI. | S1 | V1 chat; V6 delayed history/duplicates/reactions |
| M11 | Legacy public directory returns open standalone LISTED/PUBLIC safe DTOs; seed LISTED; migration normalizes PUBLIC. | S1,S2 | V1 catalog; V3 legacy migration; V4 cached response |
| M12 | Initial transient admission retries after 5s; protected work waits for confirmed join; async operations fenced. | S1 | V1 orchestration; V4 failed-first-request recovery |
| M13 | Successful draft resets submitting state and next create mounts fresh. | S1 | V1 form; V4 two consecutive drafts |

## C. File-change manifest

Every row is S1; schema/SQL also require S2 and tests run in S3. No deletions/renames. `generated/prisma/**` is generated in S2, never hand-edited. `MEMORY/study-rooms.md` already links this proposed handoff; S5 must add applied revision/evidence rather than treating a plan as closure.

| Path | Operation |
|---|---|
| `src/app/(dashboard)/studyroom/[roomSlug]/page.tsx` | modify |
| `src/app/api/community/channels/[channelId]/messages/route.ts` | modify |
| `src/app/api/studyroom/roster/route.ts` | modify |
| `src/app/api/studyroom/route.ts` | modify |
| `src/app/api/studyroom/[roomSlug]/environment/route.ts` | modify |
| `src/app/api/studyroom/[roomSlug]/sprint/route.ts` | modify |
| `src/app/api/studyroom/__tests__/sprint-and-environment-routes.test.ts` | modify |
| `src/client/realtime/RealtimeContext.tsx` | modify |
| `src/client/realtime/subscription-registry.ts` | modify |
| `src/client/repositories/studyRoomRepository.ts` | modify |
| `src/client/screens/dashboard/studyroom/components/CreateRoomModal.tsx` | modify |
| `src/client/screens/dashboard/studyroom/hooks/usePomodoro.ts` | modify |
| `src/client/screens/dashboard/studyroom/hooks/useRoomChat.ts` | modify |
| `src/client/screens/dashboard/studyroom/hooks/useRoomOrchestration.ts` | modify |
| `src/client/screens/dashboard/studyroom/hooks/useRoomRefresh.ts` | create |
| `src/client/screens/dashboard/studyroom/hooks/useRoomRoster.ts` | modify |
| `src/client/screens/dashboard/studyroom/hooks/useRoomSprint.ts` | modify |
| `src/client/screens/dashboard/studyroom/hooks/useSharedEnvironment.ts` | modify |
| `src/client/screens/dashboard/studyroom/room/components/ParticipantActionsMenu.tsx` | modify |
| `src/client/screens/dashboard/studyroom/room/components/ParticipantPanel.tsx` | modify |
| `src/client/screens/dashboard/studyroom/room/components/ParticipantRow.tsx` | modify |
| `src/client/screens/dashboard/studyroom/room/components/RoomBans.tsx` | create |
| `src/client/screens/dashboard/studyroom/room/components/RoomSocial.tsx` | modify |
| `src/client/screens/dashboard/studyroom/room/RoomScreen.tsx` | modify |
| `src/client/screens/dashboard/studyroom/StudyRoomScreen.tsx` | modify |
| `src/client/screens/dashboard/studyroom/__tests__/room-provider-hardening.test.tsx` | create |
| `src/client/screens/dashboard/studyroom/__tests__/RoomGovernance.test.tsx` | modify |
| `src/client/screens/dashboard/studyroom/__tests__/RoomScreen.orchestration.test.tsx` | modify |
| `src/client/screens/dashboard/studyroom/__tests__/RoomScreen.roles.test.tsx` | modify |
| `src/client/screens/dashboard/studyroom/__tests__/RoomScreen.shell.test.tsx` | modify |
| `src/client/screens/dashboard/studyroom/__tests__/usePomodoro.durable.test.tsx` | modify |
| `src/client/screens/dashboard/studyroom/__tests__/useRoomOrchestration.test.tsx` | modify |
| `src/client/screens/dashboard/studyroom/__tests__/useRoomSprint.test.tsx` | modify |
| `src/server/domain/messaging/interaction.service.ts` | modify |
| `src/server/domain/messaging/message.service.ts` | modify |
| `src/server/domain/messaging/search.service.ts` | modify |
| `src/server/domain/messaging/__tests__/username-dm-studyroom.e2e.test.ts` | modify |
| `src/server/domain/studyroom/environment.service.ts` | modify |
| `src/server/domain/studyroom/room-access.ts` | create |
| `src/server/domain/studyroom/room-change.ts` | create |
| `src/server/domain/studyroom/room-discovery.service.ts` | modify |
| `src/server/domain/studyroom/room-governance.service.ts` | modify |
| `src/server/domain/studyroom/room-management.service.ts` | modify |
| `src/server/domain/studyroom/sprint.service.ts` | modify |
| `src/server/domain/studyroom/studyroom.policy.ts` | modify |
| `src/server/domain/studyroom/studyroom.service.ts` | modify |
| `src/server/domain/studyroom/__tests__/environment.service.test.ts` | modify |
| `src/server/domain/studyroom/__tests__/phase12-e2e-scenarios.test.ts` | modify |
| `src/server/domain/studyroom/__tests__/phase2-catalog-and-identity.test.ts` | modify |
| `src/server/domain/studyroom/__tests__/phase3-authorization-and-bootstrap.test.ts` | modify |
| `src/server/domain/studyroom/__tests__/phase4-membership-leases-cleanup.test.ts` | modify |
| `src/server/domain/studyroom/__tests__/phase6-room-events-and-recovery.test.ts` | modify |
| `src/server/domain/studyroom/__tests__/room-discovery.service.test.ts` | modify |
| `src/server/domain/studyroom/__tests__/room-governance.service.test.ts` | modify |
| `src/server/domain/studyroom/__tests__/room-management.service.test.ts` | modify |
| `src/server/domain/studyroom/__tests__/sprint.service.test.ts` | modify |
| `src/server/domain/studyroom/__tests__/studyroom-lifecycle.test.ts` | modify |
| `src/server/domain/studyroom/__tests__/studyroom-postgres-hardening.test.ts` | create |
| `src/server/domain/studyroom/__tests__/studyroom.service.test.ts` | modify |
| `src/server/infrastructure/db/postgres/repositories/studyRoom.repo.ts` | modify |
| `src/server/messaging-worker.ts` | modify |
| `src/shared/studyroom/contracts.ts` | modify |
| `prisma/schema.prisma` | modify |
| `prisma/sql/messaging/studyroom-membership-hardening.sql` | create |

## D. Ordered implementation steps

### S0 — Preflight and extract

Repository-root PowerShell: inspect `git status --short`, `git rev-parse HEAD`, `node --version`, `npm --version`. Require Node 24.x and dependencies matching the lockfile. If dependencies are absent, use `npm ci`; its repository postinstall builds local packages and generates Prisma. No upgrades. Preserve unrelated changes.

The runner checks SHA-256 over UTF-8/LF text for every target before any application. Unified hunks are exact replacement blocks (removed lines are original, added lines replacement); new files include complete contents. Never hand-transcribe the patch or guess missing anchors.

```powershell
Set-Location 'D:/ThisPC/Documents/SideQuestHQ/undone-site'
$guideText = [IO.File]::ReadAllText((Join-Path (Get-Location) 'plans/studyroom/IdiotHandOffGuide.md'))
$runnerMatch = [regex]::Match($guideText, '(?s)<!-- HANDOFF_RUNNER -->\r?\n```javascript\r?\n(.*?)\r?\n```')
if (-not $runnerMatch.Success) { throw 'Missing embedded runner' }
New-Item -ItemType Directory -Force .tmp | Out-Null
[IO.File]::WriteAllText((Join-Path (Get-Location) '.tmp/apply-studyroom-handoff.cjs'), $runnerMatch.Groups[1].Value)
node .tmp/apply-studyroom-handoff.cjs --check
if ($LASTEXITCODE -ne 0) { throw 'Stop: preflight failed' }
```

Expected every target equals preimage or postimage; pending patch passes `git apply --check`. Missing/different targets block all application. Report path/mismatch and re-author dependent edits against current source; do not reset unrelated work.

### S1 — Apply supplied code

Prerequisite S0 passes. All C paths change atomically after preflight; do not deploy intermediate subsets.

```powershell
node .tmp/apply-studyroom-handoff.cjs --apply
if ($LASTEXITCODE -ne 0) { throw 'Application failed' }
node .tmp/apply-studyroom-handoff.cjs --check
if ($LASTEXITCODE -ne 0) { throw 'Postimage check failed' }
git diff --stat
```

Postcondition every target equals its after hash. Exact postimages are skipped on resume; pending preimages applied; any third state stops the operation.

### S2 — Storage before new app/worker

SQL adds nullable `RoomParticipant.publicGoal`, partial uniqueness for ROOM_CREATED actor/request, and normalizes PUBLIC to LISTED. Old process-local goals cannot be recovered; null is the correct initial value. SQL is transactional/repeatable and deletes no data.

Set `DATABASE_URL` to the disposable local database using local credentials, then guard it before writes:

```powershell
node -e 'const u=new URL(process.env.DATABASE_URL); if(!["localhost","127.0.0.1","[::1]"].includes(u.hostname)||u.pathname!=="/studyroom_handoff_test") throw Error("Wrong test database"); console.log("Disposable target accepted")'
if ($LASTEXITCODE -ne 0) { throw 'Do not run schema commands' }
npx prisma db push
if ($LASTEXITCODE -ne 0) { throw 'Disposable schema creation failed' }
npx prisma db execute --file prisma/sql/messaging/studyroom-membership-hardening.sql
if ($LASTEXITCODE -ne 0) { throw 'SQL failed' }
npx prisma generate
if ($LASTEXITCODE -ne 0) { throw 'Client generation failed' }
```

`db push` is ONLY for this disposable database. Never pass `--accept-data-loss` or use it on deployed data. Existing deployments require authorized backup/preflight, explicit SQL, generated client/build, then coordinated app/worker rollout. Drain old writers; mixed versions do not establish corrected quotas/idempotency.

Run this read-only preflight on representative existing data:

```sql
SELECT "actorId", "clientRequestId", COUNT(*)
FROM room_audit_logs
WHERE action = 'ROOM_CREATED' AND "clientRequestId" IS NOT NULL AND "actorId" IS NOT NULL
GROUP BY "actorId", "clientRequestId"
HAVING COUNT(*) > 1;
```

Expected zero rows. Duplicates BLOCK that target's migration; retain audit history and report conflicting IDs/counts. Historical disposition requires a separately reviewed data migration; do not erase records or merge rooms automatically. SQL failure rolls back this transaction. After execution verify publicGoal column, unique `room_create_intent_key` and exact predicate, and zero PUBLIC rows. Reapply SQL once: no extra records/events. Do not later use production `db push` to manage this SQL-owned partial index.

### S3 — Automated gates

Run V1–V3 and record exit codes/counts. Mocked phase E2E transactions do not establish row-lock behavior. A skipped PostgreSQL gate is not a pass. Never weaken race assertions to accommodate unsafe outcomes.

### S4 — Live gates

Run V4–V6 with app/worker/socket and independent profiles. Start app with `npm run dev`; run `npm run messaging:worker:check`, then `npm run messaging:worker` separately. Existing socket compose: `docker compose -f infra/centrifugo/docker-compose.yml up -d` once Docker/secrets/callback routing are ready. Verify callbacks reach the local app; container localhost is not host localhost. Use one memory-engine Centrifugo node; two unrelated memory-engine nodes do not share events. Two app instances may share the same socket service/DB.

Infrastructure/auth fixtures were unavailable to the author. If still missing, report S4 blocked by the specific service/fixture. Mock tests cannot replace it.

### S5 — Cost, memory and release record

Run V7–V8. Update `MEMORY/study-rooms.md` with entry points, lock/lease/recovery changes, applied revision, actual checks and unresolved IDs. Preserve its maintenance header. Keep the audit as historical evidence. Put execution evidence under `plans/studyroom/`, never root.

## E. Verification and failure handling

### V1 — Automated regression/static/build

After S2, root PowerShell:

```powershell
npx vitest run studyroom --maxWorkers=4
if ($LASTEXITCODE -ne 0) { throw 'Studyroom tests failed' }
npx vitest run src/server/domain/messaging/__tests__
if ($LASTEXITCODE -ne 0) { throw 'Messaging tests failed' }
npx tsc --noEmit --pretty false
if ($LASTEXITCODE -ne 0) { throw 'Types failed' }
npm run build
if ($LASTEXITCODE -ne 0) { throw 'Build failed' }
```

Expected zero failures/errors. With PG gate disabled the one new DB test skips; it must execute in V2. New provider tests use real provider/registry with socket driver double; new DB test uses actual Prisma. Existing fixtures now reflect transaction policy, durable goals, generation-scoped deletion and postjoin bootstrap. Passing mocks do not close live gates. Full messaging/build remain executor checks.

### V2 — Actual PostgreSQL

Prerequisites S2 disposable DB, generated client, reachable DB. One process:

```powershell
$env:STUDYROOM_PG_GATE = '1'
try {
  npx vitest run src/server/domain/studyroom/__tests__/studyroom-postgres-hardening.test.ts --maxWorkers=1 --testTimeout=60000
  if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL gate failed' }
} finally {
  Remove-Item Env:STUDYROOM_PG_GATE -ErrorAction SilentlyContinue
}
```

Expected one executed passing test, zero skipped. It creates UUID-marked users/rooms; checks identical create replay, last seat, host/outsider access, goal persistence, same-revision settings, renamed slug, accept/cancel, expiry/cleanup and concurrent quota; finally deletes its fixtures. Interruption cleanup is limited to that test's `handoff-` fixtures in the disposable DB, never broad production deletion. Timeout/deadlock is failure, not infrastructure success.

### V3 — Migration compatibility

Use a disposable clone with PUBLIC/open standalone, PUBLIC/closed, LISTED room, participant without goal and unique audit request fixtures. Apply SQL twice: column/index/predicate correct, listing normalized, counts unchanged, goals null, create replay works. Add duplicate non-null actor/request fixtures: SQL must fail atomically. Check a failed transaction leaves no partial listing/schema changes. No historical migration/backup was exercised by the author.

### V4 — Journey and direct permission matrix

Use A/B independent profiles plus C outsider, cohort and admin fixtures; desktop and narrow mobile. Record IDs/statuses/redacted field names, not credentials/private contents.

1. A saves two drafts consecutively: controls enabled, distinct intentions/rooms. Drop a successful create response then retry same form: one room/audit intent. Publish, share unlisted URL, B enters fresh. Discover omits it. A closes/reopens/archives/restores via ordinary UI without reload workaround.
2. Direct-load then dashboard navigation; count one physical subscription per channel during 60s idle and one reconnect. No early registry throw/churn.
3. B participant→host→moderator→demoted/revoked. Both clients' controls/labels converge without reload. Participant direct control fails; peer moderators cannot moderate peers/assign roles. A lists bans, bans/unbans B; B can rejoin. Check cohort inherited roles and platform ADMIN without local controller row.
4. Propose/cancel/repropose/accept transfer. Both banners update; former owner loses owner privileges. Wrong recipient and stale former-owner direct operations fail.
5. Anonymous, cohort outsider, banned/expired B, B after close: request bootstrap, roster, sprint, environment, chat history/send/search/reaction and subscribe. No protected snapshots/identities/music URLs in denial. Private denial 404, protected operations reject; metadata generic. Hiding controls is insufficient: send direct HTTP.
6. Discovery unknown/empty/all valid tabs cannot leak private cohort rows. Create TYPO scope, standalone+cohort, guest and over-quota requests: fail without records. Fourth publish/reopen fails.
7. Duplicate/renamed/swapped titles keep exact stored IDs/URLs. Multi-page available-only results return every qualifying ID once, including full first-page fixture. Recent survives departure. Cached legacy GET exposes only open standalone public cards, no presence user IDs.
8. Fail initial bootstrap/join once, restore network: retry joins; no protected child reads before admission. Kick/ban/close/auth403 after admission: active stage/chat stop, protected subscriptions detach, owner management remains available. Expired renewal cannot bypass fresh admission.

Healthy local changes must converge within 5 seconds; report observed latency. Failure must surface denial/recovery, never silent optimistic success.

### V5 — Real races beyond V2

Repeat each at least 20 times with independent PostgreSQL-backed requests:

- One remaining seat/two users: one success; distinct live users ≤ capacity.
- Join vs CLOSE: join-before-close is evicted; close-before-join denies. Final closed room has no live leases/presence. Repeat reopen with stale revision.
- Same-revision settings/environment/lifecycle: one winner, one conflict, one increment and matching event.
- Accept/cancel/two accepts: one terminal status and corresponding owner, no double revision.
- Same-user A→B→A delayed beacon: newest generation remains; concurrent switches leave one assignment and matching leases, no deadlock.
- Two cleanup workers vs renewal: renewed lease survives, expired renewal fails, no duplicate left event; empty scan writes/emits nothing; batch50 processes ≤50 candidates.

Capture committed rows/outbox sequence on failure; keep respective findings open. Synthetic load timing is not race evidence.

### V6 — Peer recovery and personal isolation

1. A changes/clears sound, scene/music, sprint start/pause/resume/stop, goal publish/hide, chat send/edit/reaction. B matches authorized snapshots; null clears old sound, volume/mute stays personal.
2. Disconnect B; A makes >120 events then goes quiet. Reconnect B: final capabilities/environment/sprint/roster/chat converge without another publication. Repeat unequal room/chat generations and proxy authorization failure; inspect actual destinations.
3. Delay history, publish live message, release history: one retained message. Duplicate/old/reaction envelopes never regress revision/counts. Quiet reconnect recovers last reaction.
4. Reject environment writes with403/409/429: visible failure and authoritative rollback. Rapid concurrent edits cannot silently diverge. Pending previous-room response cannot alter newly entered room.
5. Two app instances share DB/socket: alternate goal write/read, hide/switch/restart writer; all agree. Private goals/tasks/personal timer/mute must remain isolated.
6. Keep modified/raw subscribed socket after kick/ban/cohort removal/expiry; test protected publications before refresh. Existing transport uses subscription refresh expiry. **If publications continue after revocation, release stays BLOCKED pending server-side disconnect/unsubscribe or channel rotation.** UI denial does not prove immediate transport revocation. This property remains unestablished; do not claim it from client fixes.

### V7 — Cost

Measure baseline/patched at equal occupancy 2/10/50 independent clients: 60min quiet, then 10min chat/join/role bursts. Count endpoint requests, SQL reads/writes, outbox events/deliveries, subscriptions, bytes, CPU and convergence p50/p95/p99; record browser throttling/worker replicas.

Quiet connected scheduled target excluding mount/focus/reconnect: about ≤30 roster GETs +120 renewals/tab-hour (allow one boundary tick), versus240+120. Scheduled traffic falls360→150, ~58.3%; billing need not fall by that percentage. Cleanup has zero room writes/events when idle but up to120 candidate scans/hour/worker. Membership bursts coalesce within200ms. No per-second countdown network writes.

Cost/seat-hour = measured HTTP units×rate + DB compute/I/O/storage + socket units + worker/Redis uptime + network bytes, divided by occupied seat-hours. Include fixed costs. Use actual billing/rates and approved budget. Savings cannot sacrifice permissions or ≤5s healthy convergence. Without rates/budget report engineering measurements separately from unresolved monetary acceptance.

### V8 — Release and recovery

Review diff, production build and worker health/outbox lag/cleanup errors before an authorized canary. Deployment requires separate user instruction.

For code rollback before subsequent edits, verify exact postimages, then `git apply --reverse --check .tmp/studyroom-handoff.patch`; only if successful apply `git apply --reverse .tmp/studyroom-handoff.patch`. Stop on overlapping later work; never reset/clean. Regenerate client from restored schema. Keep additive SQL during code rollback: dropping publicGoal destroys newly persisted goals; reverting LISTED normalization can hide modern rooms. Historical restoration needs scoped backup and explicit data decision. Old code restores audited weaknesses, so keep feature restricted until corrected.

## F. Completion report contract

Report S0–S5, revision, changed paths, migration target class (no credential URL), actual counts, V1–V8 outcomes, latency/cost and every skipped/blocking check. Give per-ID evidence for all27; never equate applied patch with closed findings. Completion requires acceptance gates; missing infrastructure/budget remains explicitly incomplete.

Author validation, 2026-11-06: preimages and `git apply --check` passed. Isolated proposed-source focused suite:561 passed,0 failed,1 PostgreSQL gate skipped; generated proposed Prisma client and TypeScript no-emit passed. The final embedded payload was also applied to a disposable baseline copy: all 64 postimage hashes matched, and a second runner check correctly reported 64 already applied. The final source run again passed 561 tests with zero failures and one DB skip; the final TypeScript log was empty with exit code zero. All 27 requirement rows and all code fences were checked. Actual DB concurrency, historical migration, authenticated browser matrix, full messaging/build and billing remain unverified. Tests use doubles except opt-in PostgreSQL gate. These edits are proposed implementation, not deployed fixes.

## Embedded execution payload

Hashes normalize CRLF to LF. Do not edit manifest/patch independently. All new code and changed blocks follow, with no dependency on temporary author files.

<!-- HANDOFF_RUNNER -->
```javascript
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const root = process.cwd();
const guide = fs.readFileSync(path.join(root, 'plans/studyroom/IdiotHandOffGuide.md'), 'utf8');
const normalize = (s) => s.replace(/\r\n/g, '\n');
const hash = (s) => crypto.createHash('sha256').update(normalize(s)).digest('hex');
function block(marker, language) {
  const start = '<!-- ' + marker + ' -->\n```' + language + '\n';
  const text = normalize(guide);
  const at = text.indexOf(start);
  if (at < 0) throw Error('Missing payload ' + marker);
  const end = text.indexOf('\n```\n', at + start.length);
  if (end < 0) throw Error('Unclosed payload ' + marker);
  return text.slice(at + start.length, end);
}
const manifest = JSON.parse(block('HANDOFF_MANIFEST', 'json'));
const patch = block('HANDOFF_PATCH', 'diff') + '\n';
const pending = new Set();
const mismatches = [];
for (const entry of manifest) {
  const absolute = path.resolve(root, entry.path);
  if (!absolute.startsWith(root + path.sep)) throw Error('Out-of-root target');
  const actual = fs.existsSync(absolute) ? hash(fs.readFileSync(absolute, 'utf8')) : null;
  if (actual === entry.after) continue;
  if (actual === entry.before) pending.add(entry.path);
  else mismatches.push(entry.path);
}
if (mismatches.length) throw Error('Divergent targets; stop: ' + mismatches.join(', '));
const sections = patch.split(/(?=^diff --git )/m).filter(Boolean);
if (sections.length !== manifest.length) throw Error('Patch/manifest count mismatch');
const pendingPatch = sections.filter((s) => {
  const file = s.match(/^\+\+\+ b\/(.+)$/m)?.[1];
  if (!manifest.some((entry) => entry.path === file)) throw Error('Unknown patch target');
  return pending.has(file);
}).join('');
fs.mkdirSync('.tmp', { recursive: true });
fs.writeFileSync('.tmp/studyroom-handoff.patch', patch);
fs.writeFileSync('.tmp/studyroom-handoff-pending.patch', pendingPatch);
function git(args) {
  const result = cp.spawnSync('git', args, { encoding: 'utf8', stdio: 'inherit' });
  if (result.status !== 0) throw Error('Git failed: ' + args.join(' '));
}
if (pending.size) git(['apply', '--check', '.tmp/studyroom-handoff-pending.patch']);
const mode = process.argv[2];
if (!['--check', '--apply'].includes(mode)) throw Error('Use --check or --apply');
if (mode === '--apply' && pending.size) {
  git(['apply', '.tmp/studyroom-handoff-pending.patch']);
  for (const entry of manifest) {
    if (!fs.existsSync(entry.path) || hash(fs.readFileSync(entry.path, 'utf8')) !== entry.after) {
      throw Error('Postimage mismatch: ' + entry.path);
    }
  }
}
console.log(mode === '--apply' ? 'All postimages verified' : `Preflight passed: ${pending.size} pending, ${manifest.length - pending.size} already applied`);
```

<!-- HANDOFF_MANIFEST -->
```json
[
  {
    "path": "src/app/(dashboard)/studyroom/[roomSlug]/page.tsx",
    "operation": "modify",
    "before": "3ca2a9d30477b45e48839bb1f96f09c1da88f4b5d62c1874676cdd0ee4610590",
    "after": "a9993054b81bab4b16e3398e6b0c5d4223799319930a2ea4256020216335986d"
  },
  {
    "path": "src/app/api/community/channels/[channelId]/messages/route.ts",
    "operation": "modify",
    "before": "61877e45ef68339b672305607e4e55a788d59c7a0a2372f3d3644408940644ac",
    "after": "78927e5add3c817d0b24c03bf76bc441ff9e2905979504acdee0fd81fec7c3eb"
  },
  {
    "path": "src/app/api/studyroom/roster/route.ts",
    "operation": "modify",
    "before": "83801d10f6dcc926e4fd5740f7a86cb36fb3d903c2b3874d44083d07bf3f1b3f",
    "after": "88a37205780a256c2a443c261783143f8209bbc7c7d2a548922ee887cbaaeca1"
  },
  {
    "path": "src/app/api/studyroom/route.ts",
    "operation": "modify",
    "before": "b43da32c7e534ed39cfde540cc1251239a19f3b01b0dd83baf54a58004e77abc",
    "after": "f14c97ac08b1f79ac9d0d6cadb4cbc63d14b09a5a72eefedb261b46bd2bffe2c"
  },
  {
    "path": "src/app/api/studyroom/[roomSlug]/environment/route.ts",
    "operation": "modify",
    "before": "c40c34ce8d0984478792314fbb409f84b5766d0946175db350f2e9312d71e797",
    "after": "2813e3bbe85ed897d6930fadb360b005627ddc01591e47a852d72bf30a9db333"
  },
  {
    "path": "src/app/api/studyroom/[roomSlug]/sprint/route.ts",
    "operation": "modify",
    "before": "ca6001e84e8a786ff225f527a00886e11c5b9199452df6d9ff39dfd90c982d11",
    "after": "1fc9e9777b992a01fa6299a878336aa3d17916b34fa7d743f1a747e52d336b00"
  },
  {
    "path": "src/app/api/studyroom/__tests__/sprint-and-environment-routes.test.ts",
    "operation": "modify",
    "before": "8cdb8782a9d2df4d779aafffcc366b700415aa69fa07f1d478c56a055e19c9e3",
    "after": "cfe41f07b61a15ade2c7bd41a7da1bf96225c4a8ada011510d45be9d042d2eb4"
  },
  {
    "path": "src/client/realtime/RealtimeContext.tsx",
    "operation": "modify",
    "before": "781b99ee88930cbfee0c2c411331df1c6f6057caaab6f72fc37cbb92e5bd8921",
    "after": "a9e436e3f19275b13046c8ff4f33fee7b105ef157b7314ebc133819a08d4b519"
  },
  {
    "path": "src/client/realtime/subscription-registry.ts",
    "operation": "modify",
    "before": "1139a78dbb0572ee1ea9f7db727a48d5136131f4ccde8b5818da4601e2a4b6bd",
    "after": "4759c70959fdeaca5c550628ecf17af45844d8f7e1fc40b316bce3b99ecdc67f"
  },
  {
    "path": "src/client/repositories/studyRoomRepository.ts",
    "operation": "modify",
    "before": "29311b5ce4229b16344e2a5f05e420932fc438118bc9dcb760721be648845494",
    "after": "dba2e8cbd8a6407007d8116ac83669dbfc6b3a592050173a64f493061468bc0b"
  },
  {
    "path": "src/client/screens/dashboard/studyroom/components/CreateRoomModal.tsx",
    "operation": "modify",
    "before": "adec5df7832ae7757ac0c0444785aa41cae74e59a2f96faa513d2850774a4907",
    "after": "0faab8e061e208d618ce548af32679c0c3b2c10786c23e6f772eccde3c1b5177"
  },
  {
    "path": "src/client/screens/dashboard/studyroom/hooks/usePomodoro.ts",
    "operation": "modify",
    "before": "0c442ab69e0105ef5252f5d5f36dc05e38cbc1f2b283149b7cca1e53cfbae0f6",
    "after": "9ff3ac0546733f4e3ea257d2ea49f4085817180dfe2fd16953ce26d884c48d4c"
  },
  {
    "path": "src/client/screens/dashboard/studyroom/hooks/useRoomChat.ts",
    "operation": "modify",
    "before": "1638dbef885566e27f955a350b5d445a6280c914d0a4ca4a284b4202ba454e95",
    "after": "9c9caf8b680ac5d65f1caad0f24e95a7f7874aa5b143bb9432af37e6fb3e0bf5"
  },
  {
    "path": "src/client/screens/dashboard/studyroom/hooks/useRoomOrchestration.ts",
    "operation": "modify",
    "before": "3565c7f6a72aa2ec79477ceb664659ffb667f265078bd135970f0ec6c34e7170",
    "after": "04d8c915acbe7c8e025e63f82e585405796bf5332a03844dfa045c24e455b83f"
  },
  {
    "path": "src/client/screens/dashboard/studyroom/hooks/useRoomRefresh.ts",
    "operation": "create",
    "before": null,
    "after": "4a24e74ad4b34a5c9d89efcd3d0de2cb32769e07bcc72737ff53891866c54c4c"
  },
  {
    "path": "src/client/screens/dashboard/studyroom/hooks/useRoomRoster.ts",
    "operation": "modify",
    "before": "6fddabe93731e6a59fbd89270bfcb761e084d520ad8bc8490b03fb64ce95f249",
    "after": "36939a1458b0526356c53d9049583d34eed86c3e32d26d3010dd74da67af16e3"
  },
  {
    "path": "src/client/screens/dashboard/studyroom/hooks/useRoomSprint.ts",
    "operation": "modify",
    "before": "baacd03e970594f68ffab98d7278d76fce05a96ec72ce46826ffe11a1300cb51",
    "after": "ee0ac271f0be3c3818d30efa68ee77ea3554d60ab4da3ee026bfa969126d5202"
  },
  {
    "path": "src/client/screens/dashboard/studyroom/hooks/useSharedEnvironment.ts",
    "operation": "modify",
    "before": "6cb20ee711c68126f01a213bd201295e7b4c38c838f0bf190b40c20a33b15b14",
    "after": "a982343f611afe3a9542c02e3e87ce0bae728d8f86f46db0d4b26296e9fe5819"
  },
  {
    "path": "src/client/screens/dashboard/studyroom/room/components/ParticipantActionsMenu.tsx",
    "operation": "modify",
    "before": "baf488f36ce30fd69ec10a42cc96b5172d5bc4caf66d98667f9ea1317af3f446",
    "after": "f002467d18dd54b267377543eefac0ed5f36c1c329dcdf19687c87116ad1b35f"
  },
  {
    "path": "src/client/screens/dashboard/studyroom/room/components/ParticipantPanel.tsx",
    "operation": "modify",
    "before": "9c50cc80bd43f9a2a832f1d2844a15b8f85ec9f42727af9ffdbf679ed7d0bb49",
    "after": "55c86c9aeeb4987ddf69b52d81b6c5362838cd4f4db2c9d96dcf97cdea7e6946"
  },
  {
    "path": "src/client/screens/dashboard/studyroom/room/components/ParticipantRow.tsx",
    "operation": "modify",
    "before": "4559e9f67fda59d33b2be692cffc2d5733c2d4d89435c1c94a0d73e282161a58",
    "after": "eb14fb8ce233ba7812c2c5de0ffd2eed4afa65faee8245d638f622968d1597cf"
  },
  {
    "path": "src/client/screens/dashboard/studyroom/room/components/RoomBans.tsx",
    "operation": "create",
    "before": null,
    "after": "f0cbd6dbe627460c037ea3e4f9abf1b0b7836664ecad0a202dde75307fd66215"
  },
  {
    "path": "src/client/screens/dashboard/studyroom/room/components/RoomSocial.tsx",
    "operation": "modify",
    "before": "afd4c4a05ff0eeee12ca6c6545b365aba5addb1bf8b242c69ab8b76fd648c9e5",
    "after": "1a0e782b0c625ad160e78542a1824f46e6bb6921caae4d58e6c5399673c0fbf3"
  },
  {
    "path": "src/client/screens/dashboard/studyroom/room/RoomScreen.tsx",
    "operation": "modify",
    "before": "870d85cd5e28c5a42a81c4109eab55b57683124a8dc67dad584f4449c7659b1e",
    "after": "a4e8575ac0ab823f988027ee169bef2189c816a084f0dc2db921eced54ce3fb6"
  },
  {
    "path": "src/client/screens/dashboard/studyroom/StudyRoomScreen.tsx",
    "operation": "modify",
    "before": "83df399738dfcbcfa637b689345eba848a840fd15ac28f4f14475b4bfa5f6b0b",
    "after": "1ccbdaab358c9fdfcae42356379f25ba71709bd0a5ccd9cf5f3184c3c10f1b9e"
  },
  {
    "path": "src/client/screens/dashboard/studyroom/__tests__/room-provider-hardening.test.tsx",
    "operation": "create",
    "before": null,
    "after": "a82a6456a084795b5c5f1f3e758ed3cd5523788fee4efee0149ea873abca1e98"
  },
  {
    "path": "src/client/screens/dashboard/studyroom/__tests__/RoomGovernance.test.tsx",
    "operation": "modify",
    "before": "bd7bb5562b237728aeb79d6e510ae766b6c4314adfb5872c2141c31308d51f5a",
    "after": "d11a570a612c30e2e6725ff1937bc042417259332b6babb5699691915ea82feb"
  },
  {
    "path": "src/client/screens/dashboard/studyroom/__tests__/RoomScreen.orchestration.test.tsx",
    "operation": "modify",
    "before": "e09bb4dfcea373678823d826c3d175d24f46a2e4a370881b7e7440a7379f5603",
    "after": "9dcb5044fbffa07c80d293e551431b7fc4c3be666ef0c982b0a07adad66ae15a"
  },
  {
    "path": "src/client/screens/dashboard/studyroom/__tests__/RoomScreen.roles.test.tsx",
    "operation": "modify",
    "before": "413617617f69d68735b4e27fae1d39941375ca0267d6654ac4ce476b20456778",
    "after": "a78dc00f720a1091149f1f69b24780a2c60e690c3f510d022d63dd44d7008aea"
  },
  {
    "path": "src/client/screens/dashboard/studyroom/__tests__/RoomScreen.shell.test.tsx",
    "operation": "modify",
    "before": "d323a6d66b67cf3cc2d714f3d28eff8ecc8f2b92b7e6bf60d8f25452aeb2c262",
    "after": "d517abb45a84433e0c4614f37d8dadec1ed87ed19914eef0e8bd8ff538183a05"
  },
  {
    "path": "src/client/screens/dashboard/studyroom/__tests__/usePomodoro.durable.test.tsx",
    "operation": "modify",
    "before": "566e56039a8d1d41d8036f897fbbb6cacf4a50bc0d55eef85e280e9a175b800a",
    "after": "c8b5190c6d7f71028866a3355ab90d69ae6025d8495741fc2802829a486476e3"
  },
  {
    "path": "src/client/screens/dashboard/studyroom/__tests__/useRoomOrchestration.test.tsx",
    "operation": "modify",
    "before": "e27fd133ccb17fbe8d2e32be97fa014b273c41a9341d078fa389128cebdfc232",
    "after": "c8b0e09b95bbf9126639a4e290002935ab0624a5ad8e677fd9f6d901a15601e2"
  },
  {
    "path": "src/client/screens/dashboard/studyroom/__tests__/useRoomSprint.test.tsx",
    "operation": "modify",
    "before": "dd058b861ce7c2b5f123d2c2055fcb90462b3511ef7d237ba31d4cb9be9d28ac",
    "after": "5158ef8d1cf4d08a0d29998172aae4cc04e046c5c243d6983839a5904372cd59"
  },
  {
    "path": "src/server/domain/messaging/interaction.service.ts",
    "operation": "modify",
    "before": "a74aed79f65cfc8e30c7955a631f98db6095a049d361299e3c8d13c880986662",
    "after": "0497a248d6e36fccf6c3177167afce594106db7c0c6e9572956105728aa07743"
  },
  {
    "path": "src/server/domain/messaging/message.service.ts",
    "operation": "modify",
    "before": "f230e78a13c770f241a62c2058f4f4a669ab091a735bb10fc9253a31b29d6690",
    "after": "40bb2984f7005c49bf7f1ce06ed9a07d7802fd4be90bbb9f5f10f6ee2142b342"
  },
  {
    "path": "src/server/domain/messaging/search.service.ts",
    "operation": "modify",
    "before": "ddb1773ab8b535d319b7daac68492b10567502984334160a8048d161b0739a0e",
    "after": "a347617f06884bcdc84f56c669f4f5fa22b6cd86fa4d61fe5680ad2c71063f4a"
  },
  {
    "path": "src/server/domain/messaging/__tests__/username-dm-studyroom.e2e.test.ts",
    "operation": "modify",
    "before": "b8c3cd8f739fbe14a9e8fdaf79816ad88caa8797ba2b9c8cc45946166b69a25a",
    "after": "b64d105f8e02d8b33aa5a71546f6a996625728683a509ad52a151b5be8744f6a"
  },
  {
    "path": "src/server/domain/studyroom/environment.service.ts",
    "operation": "modify",
    "before": "e898ca3f509eea78ca6630015364f788bd758901eff3d416ce94c4e249327db5",
    "after": "67332418e5d58b762282a2a67ae1a2ecca7823bf7bb3de3c111a920bc2374263"
  },
  {
    "path": "src/server/domain/studyroom/room-access.ts",
    "operation": "create",
    "before": null,
    "after": "96208a00b8fb592d49b22f24b62c5c27124f86c952ac3ed890a1066c9fa3a03a"
  },
  {
    "path": "src/server/domain/studyroom/room-change.ts",
    "operation": "create",
    "before": null,
    "after": "164587cc23ebe8738efd808974992fa7f3afbbb463ab11fefa62bf74ab65023b"
  },
  {
    "path": "src/server/domain/studyroom/room-discovery.service.ts",
    "operation": "modify",
    "before": "00a8445e55982f78b5306341b98fc7c40d05483d34f6ee44f7e1ce4e8f8f1fe9",
    "after": "84cc6bffb50dcd48e16d1c1aff1299c38d4dd40a006f8b847c8e7a9743988a64"
  },
  {
    "path": "src/server/domain/studyroom/room-governance.service.ts",
    "operation": "modify",
    "before": "3bfe54fabc14e0fd1da0c6369cb670cd62a35b96d66c28e18bcdb436b9571caf",
    "after": "efabf0963040e7d3a005fad1f4d6ff6ed03d81146beb941f2fd6b321f55693e7"
  },
  {
    "path": "src/server/domain/studyroom/room-management.service.ts",
    "operation": "modify",
    "before": "6508d1f43c436e80d2df7a202519cfcd97f311c15b70f23c54fa022c24c805e5",
    "after": "2e89547918ff34dacc61af306e24c01c7bd2b952a6c801c2b2cb2c42e17f6fc7"
  },
  {
    "path": "src/server/domain/studyroom/sprint.service.ts",
    "operation": "modify",
    "before": "c09fcb38aa499b3c134d494ca7030fe0f668f6b8867469ba8cd4a6a3b63864c5",
    "after": "55d0b43e5d9724b40584c690778f0a779faf53122e05496707e393c9febc6d78"
  },
  {
    "path": "src/server/domain/studyroom/studyroom.policy.ts",
    "operation": "modify",
    "before": "7b54d4e0726e77490c98b453c759500ed1dadbb353efa077c73c9349901d6707",
    "after": "d499f8d847d8b6b46ae4fbe0baa88803079844f7dfb4589d40dbc9bf22171c45"
  },
  {
    "path": "src/server/domain/studyroom/studyroom.service.ts",
    "operation": "modify",
    "before": "47aba644990d866878576634b33d78c8d253ac795a01c35f3a291bb185a73d34",
    "after": "615821f26b99366fbc4c1d247ce77567fc63e024550943cb19482fd14618f030"
  },
  {
    "path": "src/server/domain/studyroom/__tests__/environment.service.test.ts",
    "operation": "modify",
    "before": "b205ef27198acb56803195227067d90810354c5edfdf6d002b42235a2728cda0",
    "after": "04baec4745955e5eb10ea8a3fcdec27cbef2c90513b7e7e07b340275e956f59b"
  },
  {
    "path": "src/server/domain/studyroom/__tests__/phase12-e2e-scenarios.test.ts",
    "operation": "modify",
    "before": "6432e16fcd068e30f5db352d22b52e48c310f287b7be4f10168fb0e20578d4f2",
    "after": "45e5e86d524f65a2435e25ddeda11a20edd681db848a4991e2703b7fc89bec64"
  },
  {
    "path": "src/server/domain/studyroom/__tests__/phase2-catalog-and-identity.test.ts",
    "operation": "modify",
    "before": "b75cc06473aaa4b7c8c66833e440bd755f50db4066ab1e0e916562b06a63ac48",
    "after": "cfe400ad6923401c772ab30b3badaa26e939f3f2b81814711f698bc6b14db300"
  },
  {
    "path": "src/server/domain/studyroom/__tests__/phase3-authorization-and-bootstrap.test.ts",
    "operation": "modify",
    "before": "ba47f9118177df70db3eb0e336d0a303ae968838b0da19101b5ad206195d3773",
    "after": "bd7064f75e171e68e099e0b51431d5452df507abdc0db7d6e01c342f450d4356"
  },
  {
    "path": "src/server/domain/studyroom/__tests__/phase4-membership-leases-cleanup.test.ts",
    "operation": "modify",
    "before": "bce0513cf3ac147dbf07eb1e685745cf6e423a73437f1ff7a4ca3b007c3e2192",
    "after": "96c5cee86e6a712549f61b42a88f8162ce975cbfb746621be7f862c9fa7572d4"
  },
  {
    "path": "src/server/domain/studyroom/__tests__/phase6-room-events-and-recovery.test.ts",
    "operation": "modify",
    "before": "c26656b610e5f30cf42d95044b14f0f4d1744fa7cb67784fd3548df1a291c77f",
    "after": "a15bd401e7d93db7f0a0a6f24392eb596f802d4e898e4931ad030458b7c3b673"
  },
  {
    "path": "src/server/domain/studyroom/__tests__/room-discovery.service.test.ts",
    "operation": "modify",
    "before": "6abef6b0da7f61a9702790932d14d168dcaab2d8667c2629e9e8c95299baa8fc",
    "after": "20a0e1842099bdf588ec1b06299fe7cae264c2dff44427a52611c046b302df53"
  },
  {
    "path": "src/server/domain/studyroom/__tests__/room-governance.service.test.ts",
    "operation": "modify",
    "before": "8902896fedd656f135728f8ddd14b87ea53b5de0ccf125db3f2a2c16f44972f0",
    "after": "d4498781c6c21822021c12461cf6c41928da097c4a2522924279bb554c7e66ee"
  },
  {
    "path": "src/server/domain/studyroom/__tests__/room-management.service.test.ts",
    "operation": "modify",
    "before": "7be289a34ca5e858619c67f71db0c762491127ad31cc2369743241288d7d721d",
    "after": "6c61f79a8260f2467c6d08ef0b6bfe476bc35b64642d4abe20cb59dd7db3c5c0"
  },
  {
    "path": "src/server/domain/studyroom/__tests__/sprint.service.test.ts",
    "operation": "modify",
    "before": "99c6e2241bba6b5870de49e33378b73846440efc2b539946e1157ad61389ba65",
    "after": "751d63b930a2465995a1a441b761c5a56e0d828fb520f3342d12b30293d0c1ec"
  },
  {
    "path": "src/server/domain/studyroom/__tests__/studyroom-lifecycle.test.ts",
    "operation": "modify",
    "before": "f28722326d714129adb3231d6a1af1e346c0dfacee6bea53c1121ec8eb523fd8",
    "after": "43dc4bd43a27ea45a7d8a86acf3f6746f982116ac57621bda550a99cbcb525d3"
  },
  {
    "path": "src/server/domain/studyroom/__tests__/studyroom-postgres-hardening.test.ts",
    "operation": "create",
    "before": null,
    "after": "e51fd50e89dd863ebda27e45da2c8282df6ca97e36b5f6256ac5648df326be4c"
  },
  {
    "path": "src/server/domain/studyroom/__tests__/studyroom.service.test.ts",
    "operation": "modify",
    "before": "777c865ed08b71a8616f7131587b38fc05dab6682eb1861fb436aab69b983916",
    "after": "63559f5326cfdd96cad152e2c1eb3d66bc394c2ff5d25a7d0aac0573dfdb2613"
  },
  {
    "path": "src/server/infrastructure/db/postgres/repositories/studyRoom.repo.ts",
    "operation": "modify",
    "before": "3c63200480a6b110fdc19ec0a7e673bed21f7fa929de80247d91631b967df08c",
    "after": "1166d5b1e126ba21273c8999f73bac8c0c0976a5b5e25f88acfe52838d6b84c4"
  },
  {
    "path": "src/server/messaging-worker.ts",
    "operation": "modify",
    "before": "61fa59c7867e4b2d98f7e3c5b273bc7357c1b17bc31863d256a7995367a4ce62",
    "after": "e8f39aa91f30a136b5dbac32bee6516e9d307ae743d3308c5e7ba5049895092d"
  },
  {
    "path": "src/shared/studyroom/contracts.ts",
    "operation": "modify",
    "before": "4ef81dbf5b9166daeef76ec8f53ef7d296b8eb859e3592bf6054d3a494576232",
    "after": "1020602185631855d0720d4088941dcca63598b3559e4c58cb9cc5112cf70e95"
  },
  {
    "path": "prisma/schema.prisma",
    "operation": "modify",
    "before": "9646d1b7aa688b090164f33b760cd0ec198df7c1dba2eb7dfb1097789a3669ab",
    "after": "f068b6cf2cae9d833a40e6b4af55325ec9e7ba84c786f263ee39fc9994ae7457"
  },
  {
    "path": "prisma/sql/messaging/studyroom-membership-hardening.sql",
    "operation": "create",
    "before": null,
    "after": "321e48bd30cc0164f214e9526faf68ab9d37a068fb0585862ad0bfad86db6547"
  }
]
```

<!-- HANDOFF_PATCH -->
```diff
diff --git a/src/app/(dashboard)/studyroom/[roomSlug]/page.tsx b/src/app/(dashboard)/studyroom/[roomSlug]/page.tsx
--- a/src/app/(dashboard)/studyroom/[roomSlug]/page.tsx
+++ b/src/app/(dashboard)/studyroom/[roomSlug]/page.tsx
@@ -1,44 +1,30 @@
 import { notFound } from 'next/navigation';
 import type { Metadata } from 'next';
 import { prisma } from '@/src/server/infrastructure/db/postgres/client';
 import RoomScreen from '@/src/client/screens/dashboard/studyroom/room/RoomScreen';
 import { getRoomBySlug } from '@/src/client/screens/dashboard/studyroom/data/roomCatalog';
 
-export async function generateMetadata({
-  params,
-}: {
-  params: Promise<{ roomSlug: string }>;
-}): Promise<Metadata> {
-  const { roomSlug } = await params;
-  const dbRoom = await prisma.studyRoom.findFirst({
-    where: { OR: [{ slug: roomSlug }, { id: roomSlug }] },
-    select: { title: true },
-  });
-  const catalogRoom = getRoomBySlug(roomSlug);
-  const title = dbRoom?.title || catalogRoom?.title || 'Study Room';
-  return {
-    title: `${title} | Study Room`,
-    description: 'A shared focus room on Undone.',
-  };
-}
+export const metadata: Metadata = {
+  title: 'Study Room | Undone',
+  description: 'A shared focus room on Undone.',
+};
 
 export default async function StudyRoomPage({
   params,
 }: {
   params: Promise<{ roomSlug: string }>;
 }) {
   const { roomSlug } = await params;
 
   // 1. Check database for existing room
   const dbRoom = await prisma.studyRoom.findFirst({
     where: {
       OR: [{ slug: roomSlug }, { id: roomSlug }],
-      status: { not: 'ARCHIVED' },
     },
     select: { id: true, slug: true, title: true, status: true },
   });
 
   // 2. Fallback to default catalog rooms
   const catalogRoom = getRoomBySlug(roomSlug);
 
   if (!dbRoom && !catalogRoom) {
diff --git a/src/app/api/community/channels/[channelId]/messages/route.ts b/src/app/api/community/channels/[channelId]/messages/route.ts
--- a/src/app/api/community/channels/[channelId]/messages/route.ts
+++ b/src/app/api/community/channels/[channelId]/messages/route.ts
@@ -1,8 +1,9 @@
+import { hasRoomAccess } from '@/src/server/domain/studyroom/room-access';
 import { NextResponse } from 'next/server';
 import { communityRepo } from '@/src/server/infrastructure/db/postgres/repositories/community.repo';
 import { getUser } from '@/src/server/infrastructure/auth/getUser';
 import { prisma } from '@/src/server/infrastructure/db/postgres/client';
 import { compactPayload } from '@/src/shared/lib/compactPayload';
 import { isSharedGuestAccount } from '@/src/server/infrastructure/auth/guestAccount';
 import { messageService } from '@/src/server/domain/messaging/message.service';
 import {
@@ -200,37 +201,18 @@ export async function GET(
         if (!membership) {
           return NextResponse.json(
             { error: 'Cohort enrollment required to view messages' },
             { status: 403 }
           );
         }
       }
 
-      const activeLease = await prisma.roomLease.findFirst({
-        where: {
-          studyRoomId: channel.studyRoom.id,
-          userId: user.id,
-          expiresAt: { gt: new Date() },
-        },
-      });
-
-      if (!activeLease) {
-        const participant = await prisma.roomParticipant.findFirst({
-          where: {
-            studyRoomId: channel.studyRoom.id,
-            userId: user.id,
-          },
-        });
-        if (!participant) {
-          return NextResponse.json(
-            { error: 'Not an active participant in this study room' },
-            { status: 403 }
-          );
-        }
+      if (!(await hasRoomAccess(channel.studyRoom.id,user.id))) {
+        return NextResponse.json({ error: 'Active room lease required' }, { status: 403 });
       }
     } else {
       return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
     }
 
     const url = new URL(req.url);
     const limit = parseInt(url.searchParams.get('limit') || '50', 10);
     const before = url.searchParams.get('before') || undefined;
diff --git a/src/app/api/studyroom/roster/route.ts b/src/app/api/studyroom/roster/route.ts
--- a/src/app/api/studyroom/roster/route.ts
+++ b/src/app/api/studyroom/roster/route.ts
@@ -1,8 +1,9 @@
+import { StudyRoomError } from '@/src/shared/studyroom/contracts';
 import { NextRequest, NextResponse } from 'next/server';
 import { getUser } from '@/src/server/infrastructure/auth/getUser';
 import { isSharedGuestAccount } from '@/src/server/infrastructure/auth/guestAccount';
 import { studyRoomService } from '@/src/server/domain/studyroom/studyroom.service';
 
 export const dynamic = 'force-dynamic';
 
 export async function GET(req: NextRequest) {
@@ -26,12 +27,13 @@ export async function GET(req: NextRequest) {
     }
 
     const roster = await studyRoomService.getRoomRoster(roomId, user.id);
     return NextResponse.json(roster, {
       status: 200,
       headers: { 'Cache-Control': 'private, no-store' },
     });
   } catch (error) {
+    if (error instanceof StudyRoomError) return NextResponse.json(error.toJSON(),{status:error.status});
     console.error('Failed to get room roster:', error);
     return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
   }
 }
diff --git a/src/app/api/studyroom/route.ts b/src/app/api/studyroom/route.ts
--- a/src/app/api/studyroom/route.ts
+++ b/src/app/api/studyroom/route.ts
@@ -28,16 +28,19 @@ export async function GET(req?: Request): Promise<Response> {
         url.searchParams.has('cohortId') ||
         url.searchParams.has('cursor') ||
         url.searchParams.has('availableOnly') ||
         url.searchParams.get('format') === 'v2';
 
       if (hasDiscoveryQuery) {
         const user = await getUser();
         const tab = (url.searchParams.get('tab') || 'discover') as DiscoveryTab;
+        if (!['discover', 'cohorts', 'my-rooms', 'recent'].includes(tab)) {
+          return NextResponse.json({ error: 'Unknown discovery tab' }, { status: 400 });
+        }
         const queryText = url.searchParams.get('query') || undefined;
         const cohortId = url.searchParams.get('cohortId') || undefined;
         const tag = url.searchParams.get('tag') || undefined;
         const language = url.searchParams.get('language') || undefined;
         const availableOnly = url.searchParams.get('availableOnly') === 'true';
         const cursor = url.searchParams.get('cursor') || undefined;
         const limitParam = url.searchParams.get('limit');
         const limit = limitParam ? parseInt(limitParam, 10) : 12;
@@ -103,27 +106,21 @@ export async function GET(req?: Request): Promise<Response> {
         await studyRoomRepo.seedRooms();
       }
       studyRoomCache.roomsSeeded = true;
     }
 
     // Fetch public standalone rooms only (prevent leaking unlisted or private cohort rooms into public cache)
     const rooms = await prisma.studyRoom.findMany({
       where: {
-        listing: 'PUBLIC',
+        listing: { in: ['LISTED','PUBLIC'] },
+        status: 'OPEN',
         cohortId: null,
       },
-      include: {
-        participants: {
-          select: {
-            id: true,
-            userId: true,
-          },
-        },
-      },
+      select: {id:true,slug:true,title:true,thumbnail:true,status:true,onlineCount:true},
       orderBy: {
         createdAt: 'asc',
       },
     });
 
     const payload = rooms ?? [];
     const etag = `W/"${createHash('sha256')
       .update(JSON.stringify(payload))
diff --git a/src/app/api/studyroom/[roomSlug]/environment/route.ts b/src/app/api/studyroom/[roomSlug]/environment/route.ts
--- a/src/app/api/studyroom/[roomSlug]/environment/route.ts
+++ b/src/app/api/studyroom/[roomSlug]/environment/route.ts
@@ -1,8 +1,9 @@
+import { hasRoomAccess } from '@/src/server/domain/studyroom/room-access';
 import { NextRequest, NextResponse } from 'next/server';
 import { getUser } from '@/src/server/infrastructure/auth/getUser';
 import { isSharedGuestAccount } from '@/src/server/infrastructure/auth/guestAccount';
 import { sprintService } from '@/src/server/domain/studyroom/sprint.service';
 import { environmentService } from '@/src/server/domain/studyroom/environment.service';
 import { rateLimiterService } from '@/src/server/domain/messaging/rate-limiter.service';
 import { studyRoomMetricsService } from '@/src/server/domain/studyroom/studyroom-metrics.service';
 import { validateMutationOrigin, parseJsonWithLimit } from '@/src/app/api/studyroom/security';
@@ -30,16 +31,20 @@ export async function GET(
     }
 
     const { roomSlug } = await params;
     const room = await sprintService.resolveRoom(roomSlug);
     if (!room) {
       return NextResponse.json({ error: 'Study room not found' }, { status: 404 });
     }
 
+    if (!(await hasRoomAccess(room.id, user.id))) {
+      return NextResponse.json({ error: 'Active room membership required' }, { status: 403 });
+    }
+
     const env = await environmentService.getRoomEnvironment(room.id);
     return NextResponse.json(env, {
       status: 200,
       headers: { 'Cache-Control': 'private, no-store' },
     });
   } catch (error) {
     console.error('Failed to get room environment:', error);
     return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
diff --git a/src/app/api/studyroom/[roomSlug]/sprint/route.ts b/src/app/api/studyroom/[roomSlug]/sprint/route.ts
--- a/src/app/api/studyroom/[roomSlug]/sprint/route.ts
+++ b/src/app/api/studyroom/[roomSlug]/sprint/route.ts
@@ -1,8 +1,9 @@
+import { hasRoomAccess } from '@/src/server/domain/studyroom/room-access';
 import { NextRequest, NextResponse } from 'next/server';
 import { getUser } from '@/src/server/infrastructure/auth/getUser';
 import { isSharedGuestAccount } from '@/src/server/infrastructure/auth/guestAccount';
 import { sprintService } from '@/src/server/domain/studyroom/sprint.service';
 import {
   MessagingConflictError,
   MessagingForbiddenError,
   MessagingNotFoundError,
@@ -25,16 +26,20 @@ export async function GET(
     }
 
     const { roomSlug } = await params;
     const room = await sprintService.resolveRoom(roomSlug);
     if (!room) {
       return NextResponse.json({ error: 'Study room not found' }, { status: 404 });
     }
 
+    if (!(await hasRoomAccess(room.id, user.id))) {
+      return NextResponse.json({ error: 'Active room membership required' }, { status: 403 });
+    }
+
     const sprint = await sprintService.getCurrentRoomSprint(room.id);
     return NextResponse.json({ sprint }, {
       status: 200,
       headers: { 'Cache-Control': 'private, no-store' },
     });
   } catch (error) {
     console.error('Failed to get current sprint:', error);
     return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
diff --git a/src/app/api/studyroom/__tests__/sprint-and-environment-routes.test.ts b/src/app/api/studyroom/__tests__/sprint-and-environment-routes.test.ts
--- a/src/app/api/studyroom/__tests__/sprint-and-environment-routes.test.ts
+++ b/src/app/api/studyroom/__tests__/sprint-and-environment-routes.test.ts
@@ -1,12 +1,13 @@
 /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
 import { describe, it, expect, vi, beforeEach } from 'vitest';
 import { NextRequest } from 'next/server';
 
+vi.mock('@/src/server/domain/studyroom/room-access',()=>({hasRoomAccess:vi.fn(async()=>true)}));
 vi.mock('server-only', () => ({}));
 
 vi.mock('@/src/server/domain/messaging/rate-limiter.service', () => ({
   rateLimiterService: {
     checkRoomControlRateLimit: vi.fn().mockResolvedValue({
       allowed: true,
       limit: 30,
       remaining: 29,
diff --git a/src/client/realtime/RealtimeContext.tsx b/src/client/realtime/RealtimeContext.tsx
--- a/src/client/realtime/RealtimeContext.tsx
+++ b/src/client/realtime/RealtimeContext.tsx
@@ -47,17 +47,19 @@ export function RealtimeProvider({
         console.warn(`[Realtime] Subscription access revoked for channel: ${channel}`);
         updateActiveChannels();
       },
     });
   }
 
   const updateActiveChannels = useCallback(() => {
     if (registryRef.current) {
-      setActiveChannels(registryRef.current.getActiveChannels());
+      const next = registryRef.current.getActiveChannels();
+      setActiveChannels(previous => previous.length === next.length &&
+        previous.every((channel, index) => channel === next[index]) ? previous : next);
     }
   }, []);
 
   const fetchToken = useCallback(async (): Promise<string> => {
     const res = await fetch('/api/realtime/token', {
       method: 'POST',
       headers: {
         'Content-Type': 'application/json',
diff --git a/src/client/realtime/subscription-registry.ts b/src/client/realtime/subscription-registry.ts
--- a/src/client/realtime/subscription-registry.ts
+++ b/src/client/realtime/subscription-registry.ts
@@ -108,16 +108,17 @@ export class SubscriptionRegistry {
     const { sub, channel } = entry;
 
     sub.on('subscribing', () => {
       entry.status = 'subscribing';
     });
 
     sub.on('subscribed', (_ctx: SubscribedContext) => {
       entry.status = 'subscribed';
+      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('studyroom:resync',{detail:channel}));
     });
 
     sub.on('unsubscribed', (_ctx: UnsubscribedContext) => {
       entry.status = 'unsubscribed';
     });
 
     sub.on('publication', (ctx: PublicationContext) => {
       const payload = ctx.data;
@@ -131,16 +132,17 @@ export class SubscriptionRegistry {
       }
     });
 
     sub.on('error', (ctx: SubscriptionErrorContext) => {
       entry.status = 'error';
       entry.lastError = ctx.error?.message || 'Subscription error';
 
       if (ctx.error?.code === 103) {
+        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('studyroom:revoked',{detail:channel}));
         // Access revoked or expired
         if (this.onRevocation) {
           this.onRevocation(channel);
         }
       }
     });
   }
 
diff --git a/src/client/repositories/studyRoomRepository.ts b/src/client/repositories/studyRoomRepository.ts
--- a/src/client/repositories/studyRoomRepository.ts
+++ b/src/client/repositories/studyRoomRepository.ts
@@ -74,16 +74,17 @@ export interface RoomSyncResponse {
   serverTime: string;
 }
 
 export interface ApiHttpError extends Error {
   status?: number;
 }
 
 export interface RoomChatMessageDTO {
+  reactions?: {emoji:string;count:number}[];
   id: string;
   content: string;
   channelId: string;
   authorId: string;
   messageSequence: number;
   clientRequestId: string | null;
   replyToId: string | null;
   revision: number;
@@ -202,21 +203,21 @@ export const studyRoomRepository = {
 
     if (!res.ok) {
       return { success: false };
     }
 
     return res.json();
   },
 
-  async leaveRoom(roomId?: string, tabId?: string, global = false): Promise<{ success: boolean; left: boolean }> {
+  async leaveRoom(roomId?: string, tabId?: string, global = false, generation?: number): Promise<{ success: boolean; left: boolean }> {
     const res = await fetch('/api/studyroom', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
-      body: JSON.stringify({ action: 'leave', roomId, tabId, global }),
+      body: JSON.stringify({ action: 'leave', roomId, tabId, global, generation }),
     });
 
     if (!res.ok) {
       const err = await res.json().catch(() => ({}));
       throw new Error(err.error || `Failed to leave room: ${res.statusText}`);
     }
 
     return res.json();
diff --git a/src/client/screens/dashboard/studyroom/components/CreateRoomModal.tsx b/src/client/screens/dashboard/studyroom/components/CreateRoomModal.tsx
--- a/src/client/screens/dashboard/studyroom/components/CreateRoomModal.tsx
+++ b/src/client/screens/dashboard/studyroom/components/CreateRoomModal.tsx
@@ -11,16 +11,17 @@ import styles from './CreateRoomModal.module.css';
 export interface CreateRoomModalProps {
   isOpen: boolean;
   onClose: () => void;
   onRoomCreated?: (room: { id: string; slug: string; title: string }) => void;
 }
 
 export function CreateRoomModal({ isOpen, onClose, onRoomCreated }: CreateRoomModalProps) {
   const router = useRouter();
+  const request = React.useRef<{intent:string; id:string} | null>(null);
 
   const [title, setTitle] = useState('');
   const [description, setDescription] = useState('');
   const [scopeKind, setScopeKind] = useState<RoomScopeKind>('STANDALONE');
   const [cohortId, setCohortId] = useState('');
   const [listing, setListing] = useState<RoomListing>('LISTED');
   const [capacity, setCapacity] = useState<number>(STUDY_ROOM_LIMITS.CAPACITY_DEFAULT);
   const [tagsInput, setTagsInput] = useState('');
@@ -63,20 +64,19 @@ export function CreateRoomModal({ isOpen, onClose, onRoomCreated }: CreateRoomMo
     }
 
     const tags = tagsInput
       .split(',')
       .map((t) => t.trim().replace(/^#/, ''))
       .filter(Boolean)
       .slice(0, STUDY_ROOM_LIMITS.TAGS_MAX_COUNT);
 
-    const requestId =
-      typeof crypto !== 'undefined' && crypto.randomUUID
-        ? crypto.randomUUID()
-        : 'req-' + Math.random().toString(36).slice(2);
+    const intent = JSON.stringify([cleanTitle,description,scopeKind,cohortId,listing,capacity,tags,language,visualPresetId,publishImmediately]);
+    if (request.current?.intent !== intent) request.current = {intent,id:crypto.randomUUID()};
+    const requestId = request.current.id;
 
     setIsSubmitting(true);
 
     try {
       const res = await fetch('/api/studyroom/rooms', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
@@ -97,16 +97,18 @@ export function CreateRoomModal({ isOpen, onClose, onRoomCreated }: CreateRoomMo
       const data = await res.json();
 
       if (!res.ok) {
         setErrorMessage(data.error || 'Failed to create room.');
         setIsSubmitting(false);
         return;
       }
 
+      request.current = null;
+      setIsSubmitting(false);
       onClose();
       if (onRoomCreated) {
         onRoomCreated(data);
       }
 
       if (publishImmediately && data.slug) {
         router.push(`/studyroom/${data.slug}`);
       }
diff --git a/src/client/screens/dashboard/studyroom/hooks/usePomodoro.ts b/src/client/screens/dashboard/studyroom/hooks/usePomodoro.ts
--- a/src/client/screens/dashboard/studyroom/hooks/usePomodoro.ts
+++ b/src/client/screens/dashboard/studyroom/hooks/usePomodoro.ts
@@ -56,16 +56,17 @@ export interface UsePomodoroReturn {
 export function usePomodoro(
   roomTitle: string = 'Study Room',
   initialSettings?: Partial<PomodoroSettings>,
   roomId?: string | null
 ): UsePomodoroReturn {
   const { data: session } = useSafeSession();
   const userId = session?.user?.id;
   const realtime = useSafeRealtime();
+  const subscribe = realtime?.status === 'connected' ? realtime.subscribe : undefined;
 
   const [state, dispatch] = useReducer(
     pomodoroReducer,
     undefined,
     () => {
       const data = pomodoroStorageAdapter.getPomodoroData();
       return createInitialPomodoroState(
         { ...data.settings, ...initialSettings },
@@ -149,35 +150,35 @@ export function usePomodoro(
     return () => {
       ignore = true;
       isMountedRef.current = false;
     };
   }, [syncFromServer]);
 
   // 2. Realtime subscription to user channel for cross-device sync
   useEffect(() => {
-    if (!userId || typeof realtime?.subscribe !== 'function') return;
+    if (!userId || typeof subscribe !== 'function') return;
 
     const userChannel = `user:${userId}:g1`;
-    const unsubscribe = realtime.subscribe(userChannel, (data: unknown) => {
+    const unsubscribe = subscribe(userChannel, (data: unknown) => {
       const envelope = data as {
         type?: string;
         payload?: StudySessionDTO;
         session?: StudySessionDTO;
       };
       const incoming = envelope?.payload || envelope?.session;
       if (envelope?.type === 'study.session.updated' && incoming) {
         syncFromServer(incoming);
       }
     });
 
     return () => {
       unsubscribe();
     };
-  }, [userId, realtime, syncFromServer]);
+  }, [userId, subscribe, syncFromServer]);
 
   // 3. Sleeping tab / tab wake-up handling (visibilitychange & focus)
   useEffect(() => {
     const handleWake = () => {
       if (typeof document !== 'undefined' && !document.hidden) {
         const cur = serverSessionRef.current;
         if (cur && cur.status === 'ACTIVE' && cur.deadline) {
           const adjustedDeadlineMs =
diff --git a/src/client/screens/dashboard/studyroom/hooks/useRoomChat.ts b/src/client/screens/dashboard/studyroom/hooks/useRoomChat.ts
--- a/src/client/screens/dashboard/studyroom/hooks/useRoomChat.ts
+++ b/src/client/screens/dashboard/studyroom/hooks/useRoomChat.ts
@@ -1,12 +1,13 @@
 'use client';
 
 import { useState, useEffect, useCallback, useRef } from 'react';
 import { useSession } from 'next-auth/react';
+import { useRoomRefresh } from './useRoomRefresh';
 import { useRealtime } from '@/src/client/realtime';
 import {
   studyRoomRepository,
   type RoomChatMessageDTO,
 } from '@/src/client/repositories/studyRoomRepository';
 
 export interface OptimisticChatMessage extends RoomChatMessageDTO {
   deliveryStatus: 'pending' | 'sent' | 'failed';
@@ -38,44 +39,50 @@ function useSafeRealtime() {
 
 export function useRoomChat({
   channelId,
   streamGeneration = 1,
   enabled = true,
 }: UseRoomChatOptions): UseRoomChatResult {
   const { data: session } = useSession();
   const realtime = useSafeRealtime();
+  const subscribe = realtime?.status === 'connected' ? realtime.subscribe : undefined;
   const [messages, setMessages] = useState<OptimisticChatMessage[]>([]);
   const [isLoading, setIsLoading] = useState(false);
   const [error, setError] = useState<string | null>(null);
 
+  const channelRef = useRef(channelId);
+  useEffect(() => { channelRef.current=channelId; setMessages([]); }, [channelId]);
   const isMountedRef = useRef(true);
 
   const currentUserId = session?.user?.id;
   const currentUserName = session?.user?.name || 'You';
   const currentUserImage = session?.user?.image || null;
 
   // 1. Fetch persistent history
   const fetchHistory = useCallback(async () => {
     if (!channelId || !enabled) {
       setMessages([]);
       return;
     }
 
     setIsLoading(true);
     try {
       const history = await studyRoomRepository.getChannelMessages(channelId, 50);
-      if (isMountedRef.current) {
+      if (isMountedRef.current && channelRef.current === channelId) {
         setMessages((prev) => {
-          const pending = prev.filter((m) => m.deliveryStatus === 'pending');
-          const canonical = history.map((m) => ({
-            ...m,
-            deliveryStatus: 'sent' as const,
-          }));
-          return [...canonical, ...pending];
+          const merged = new Map<string, OptimisticChatMessage>();
+          for (const message of history) merged.set(message.id,{...message, deliveryStatus:'sent'});
+          const intents = new Set(history.map(m=>m.clientRequestId).filter(Boolean));
+          for (const m of prev) {
+            if (m.channelId !== channelId || (m.deliveryStatus !== 'sent' && m.clientRequestId && intents.has(m.clientRequestId))) continue;
+            const stored = merged.get(m.id);
+            if (!stored || m.revision > stored.revision) merged.set(m.id,m);
+          }
+          return [...merged.values()].sort((a,b)=>(a.messageSequence < 0 ? Infinity : a.messageSequence) - (b.messageSequence < 0 ? Infinity : b.messageSequence));
         });
         setError(null);
       }
     } catch (err: unknown) {
       if (isMountedRef.current) {
         setError(err instanceof Error ? err.message : 'Failed to load chat history');
       }
     } finally {
@@ -94,61 +101,71 @@ export function useRoomChat({
     });
 
     return () => {
       ignore = true;
       isMountedRef.current = false;
     };
   }, [fetchHistory]);
 
+  useRoomRefresh(enabled ? `roomchat:${channelId}:g${streamGeneration}` : undefined, fetchHistory);
+
   // 2. Realtime subscription to roomchat stream
   useEffect(() => {
-    if (!channelId || !enabled || typeof realtime?.subscribe !== 'function') return;
+    if (!channelId || !enabled || typeof subscribe !== 'function') return;
 
     const channelName = `roomchat:${channelId}:g${streamGeneration}`;
-    const unsubscribe = realtime.subscribe(channelName, (data: unknown) => {
+    const unsubscribe = subscribe(channelName, (data: unknown) => {
       const envelope = data as {
         type?: string;
         payload?: RoomChatMessageDTO;
         message?: RoomChatMessageDTO;
       };
 
+      if (envelope.type === 'message.reaction_updated') {
+        const reaction = (data as {payload:{messageId:string;revision:number;reactions: {emoji:string;count:number}[]}}).payload;
+        if (reaction) setMessages(prev=>prev.map(m=>m.id===reaction.messageId && reaction.revision>=m.revision ?
+          {...m,revision:reaction.revision,reactions:reaction.reactions} : m));
+        return;
+      }
       const incoming = envelope?.payload || envelope?.message;
       if (!incoming || !incoming.id) return;
 
       setMessages((prev) => {
         // If matches a pending optimistic message by clientRequestId
         if (incoming.clientRequestId) {
           const optIdx = prev.findIndex(
             (m) => m.clientRequestId === incoming.clientRequestId
           );
           if (optIdx !== -1) {
+            if (prev[optIdx].revision > incoming.revision) return prev;
             const next = [...prev];
             next[optIdx] = { ...incoming, deliveryStatus: 'sent' };
             return next;
           }
         }
 
         // Check if already in list by id
         const existingIdx = prev.findIndex((m) => m.id === incoming.id);
         if (existingIdx !== -1) {
           const next = [...prev];
+          if (next[existingIdx].revision > incoming.revision) return prev;
           next[existingIdx] = { ...incoming, deliveryStatus: 'sent' };
           return next;
         }
 
         // Append new incoming message
         return [...prev, { ...incoming, deliveryStatus: 'sent' }];
       });
     });
 
     return () => {
       unsubscribe();
     };
-  }, [channelId, streamGeneration, enabled, realtime]);
+  }, [channelId, streamGeneration, enabled, subscribe]);
 
   // 3. Optimistic Send
   const sendMessage = useCallback(
     async (content: string) => {
       const trimmed = content.trim();
       if (!trimmed || !channelId) return;
 
       const clientRequestId =
diff --git a/src/client/screens/dashboard/studyroom/hooks/useRoomOrchestration.ts b/src/client/screens/dashboard/studyroom/hooks/useRoomOrchestration.ts
--- a/src/client/screens/dashboard/studyroom/hooks/useRoomOrchestration.ts
+++ b/src/client/screens/dashboard/studyroom/hooks/useRoomOrchestration.ts
@@ -3,16 +3,17 @@
 import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
 import { useSession } from 'next-auth/react';
 import type { RoomSlug, Viewer, ViewerRole, RoomDefinition, BackgroundId } from '../types';
 import type { RoomBootstrapResponse } from '@/src/shared/studyroom/contracts';
 import { STUDY_ROOM_LIMITS } from '@/src/shared/studyroom/contracts';
 import { getRoomBySlug } from '../data/roomCatalog';
 import { deriveViewer } from '../utils/deriveParticipants';
 import { studyRoomRepository } from '@/src/client/repositories/studyRoomRepository';
+import { useRoomRefresh } from './useRoomRefresh';
 import { useRealtime } from '@/src/client/realtime';
 
 export type RoomOrchestrationState =
   | 'loading'
   | 'eligible'
   | 'joining'
   | 'joined'
   | 'reconnecting'
@@ -125,16 +126,18 @@ export function useRoomOrchestration({
   useEffect(() => {
     bootstrapRef.current = bootstrap;
   }, [bootstrap]);
 
   const initializeRoom = useCallback(async () => {
     if (!enabled || !roomSlug) return;
 
     const currentRunId = ++runIdRef.current;
+    generationRef.current=null;
+    setGeneration(null);
     void Promise.resolve().then(() => {
       if (currentRunId === runIdRef.current) {
         setState('loading');
         setError(null);
       }
     });
 
     try {
@@ -172,16 +175,25 @@ export function useRoomOrchestration({
       // 3. Join Room with stable tabId
       setState('joining');
       const currentTabId = getTabId();
       const actualRoomId = bootstrapData.room?.id || roomSlug;
 
       const joinResult = await studyRoomRepository.joinRoom(actualRoomId, currentTabId);
       if (currentRunId !== runIdRef.current) return;
 
+      generationRef.current = joinResult.generation;
+      const joinedBootstrap = await studyRoomRepository.getBootstrap(roomSlug);
+      if (currentRunId !== runIdRef.current) return;
+      if (!joinedBootstrap.viewer.isJoined || !joinedBootstrap.capabilities.canJoin) {
+        setState('denied');
+        return;
+      }
+      bootstrapRef.current = joinedBootstrap;
+      setBootstrap(joinedBootstrap);
       setGeneration(joinResult.generation);
       generationRef.current = joinResult.generation;
       setState('joined');
 
       // 4. Refresh Realtime Subscription Manifest after assignment change
       if (typeof realtimeRef.current?.refreshManifest === 'function') {
         void Promise.resolve(realtimeRef.current.refreshManifest()).catch(() => {});
       }
@@ -205,17 +217,19 @@ export function useRoomOrchestration({
     if (!enabled || !roomSlug) return;
 
     // eslint-disable-next-line react-hooks/set-state-in-effect
     void initializeRoom();
 
     const handleBeforeUnload = () => {
       const currentTabId = getTabId();
       const activeRoomId = bootstrapRef.current?.room?.id || roomSlug;
+      if (generationRef.current === null) return;
       const payload = JSON.stringify({
+        generation: generationRef.current,
         action: 'leave',
         roomId: activeRoomId,
         tabId: currentTabId,
       });
 
       if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
         const blob = new Blob([payload], { type: 'application/json' });
         navigator.sendBeacon('/api/studyroom', blob);
@@ -236,20 +250,26 @@ export function useRoomOrchestration({
     const currentRunRef = runIdRef;
     return () => {
       currentRunRef.current++;
       if (typeof window !== 'undefined') {
         window.removeEventListener('beforeunload', handleBeforeUnload);
       }
       const currentTabId = getTabId();
       const activeRoomId = bootstrapRef.current?.room?.id || roomSlug;
-      void studyRoomRepository.leaveRoom(activeRoomId, currentTabId, false).catch(() => {});
+      void studyRoomRepository.leaveRoom(activeRoomId, currentTabId, false, generationRef.current ?? undefined).catch(() => {});
     };
   }, [initializeRoom, roomSlug, enabled]);
 
+  useEffect(() => {
+    if (state !== 'reconnecting' || generation !== null) return;
+    const timer = setTimeout(() => { void initializeRoom(); }, 5000);
+    return () => clearTimeout(timer);
+  }, [state,generation,initializeRoom]);
+
   // Periodic Lease Renewal Loop
   useEffect(() => {
     if (state !== 'joined' && state !== 'reconnecting') return;
     const currentRunId = runIdRef.current;
 
     const interval = setInterval(async () => {
       const currentGen = generationRef.current;
       if (currentGen === null) return;
@@ -307,26 +327,44 @@ export function useRoomOrchestration({
   useEffect(() => {
     if (state === 'joined' && realtime?.status === 'unauthorized') {
       // eslint-disable-next-line react-hooks/set-state-in-effect
       setState('denied');
       setError('Realtime authorization revoked');
     }
   }, [state, realtime?.status]);
 
+  const refreshBootstrap = useCallback(async () => {
+    if (!roomSlug) return;
+    const run = runIdRef.current;
+    try {
+      const data = await studyRoomRepository.getBootstrap(roomSlug);
+      if (run !== runIdRef.current) return;
+      if (!data.viewer.isJoined || !data.capabilities.canJoin) setState('denied');
+      setBootstrap(data);
+      bootstrapRef.current = data;
+
+    } catch (cause) {
+      if (run === runIdRef.current && [401,403,404].includes((cause as {status:number}).status)) { setBootstrap(null); bootstrapRef.current=null; setState('denied'); }
+    }
+  }, [roomSlug]);
+
   // Realtime room events and cursor catchup
   const cursorRef = useRef<number>(0);
-  const isCatchingUpRef = useRef<boolean>(false);
+
 
   const applyRoomEvent = useCallback(
     (event: { type?: string; payload?: Record<string, unknown> }) => {
       if (!event || !event.type) return;
       const payload = event.payload || {};
 
       switch (event.type) {
+        case 'room.governance.changed':
+          void refreshBootstrap();
+          break;
         case 'room.participant.left': {
           const currentUserId = bootstrapRef.current?.viewer?.userId;
           if (payload.userId && currentUserId && payload.userId === currentUserId) {
             if (payload.reason === 'KICKED' || payload.reason === 'BANNED') {
               setState('denied');
               setError(
                 payload.reason === 'BANNED'
                   ? 'You have been banned from this room'
@@ -341,16 +379,17 @@ export function useRoomOrchestration({
           }
           break;
         }
         case 'room.lifecycle.changed': {
           const status = String(payload.status || '').toUpperCase();
           if (status === 'CLOSED' || status === 'ARCHIVED') {
             setState('denied');
             setError('This room has been closed');
+            void refreshBootstrap();
           }
           break;
         }
         case 'room.roster.changed': {
           if (typeof payload.onlineCount === 'number') {
             setBootstrap((prev) =>
               prev
                 ? {
@@ -364,69 +403,37 @@ export function useRoomOrchestration({
             );
           }
           break;
         }
         default:
           break;
       }
     },
-    []
+    [refreshBootstrap]
   );
 
-  const catchUpSync = useCallback(async () => {
-    if (isCatchingUpRef.current || !roomSlug) return;
-    isCatchingUpRef.current = true;
-    try {
-      const syncRes = await studyRoomRepository.syncRoomEvents(roomSlug, {
-        clientSequence: cursorRef.current,
-      });
-
-      if (syncRes.mode === 'SNAPSHOT') {
-        cursorRef.current = syncRes.currentSequence;
-        if (syncRes.room?.status === 'CLOSED' || syncRes.room?.status === 'ARCHIVED') {
-          setState('denied');
-          setError('This room has been closed');
-        }
-        if (syncRes.roster) {
-          setBootstrap((prev) =>
-            prev
-              ? {
-                  ...prev,
-                  room: {
-                    ...prev.room,
-                    onlineCount: syncRes.roster!.length,
-                  },
-                }
-              : null
-          );
-        }
-      } else if (syncRes.mode === 'DELTA' && syncRes.events) {
-        for (const evt of syncRes.events) {
-          applyRoomEvent(evt as { type?: string; payload?: Record<string, unknown> });
-          cursorRef.current = Math.max(cursorRef.current, evt.sequence);
-        }
-      }
-    } catch (err: unknown) {
-      const errorObj = err as { status?: number; message?: string };
-      if (errorObj?.status === 403 || errorObj?.status === 401) {
-        setState('denied');
-        setError('Access revoked');
-      }
-    } finally {
-      isCatchingUpRef.current = false;
-    }
-  }, [roomSlug, applyRoomEvent]);
+  const roomChannel = bootstrap?.room.id ? `room:${bootstrap.room.id}:g${bootstrap.room.streamGeneration ?? 1}` : undefined;
+  useRoomRefresh(state === 'joined' ? roomChannel : undefined, refreshBootstrap);
+  useEffect(() => {
+    const revoked = (event:Event) => {
+      if ((event as CustomEvent<string>).detail !== roomChannel) return;
+      setBootstrap(null); bootstrapRef.current=null; setState('denied'); setError('Access revoked');
+    };
+    window.addEventListener('studyroom:revoked',revoked);
+    return () => window.removeEventListener('studyroom:revoked',revoked);
+  },[roomChannel]);
+  useEffect(() => { cursorRef.current = 0; }, [roomChannel]);
 
   // Subscribe to room stream channel
   useEffect(() => {
     if (
       state !== 'joined' ||
       !bootstrap?.room?.id ||
-      typeof realtimeRef.current?.subscribe !== 'function'
+      realtime?.status !== 'connected' || typeof realtimeRef.current?.subscribe !== 'function'
     ) {
       return;
     }
 
     const roomId = bootstrap.room.id;
     const streamGen = bootstrap.room.streamGeneration ?? 1;
     const roomChannel = `room:${roomId}:g${streamGen}`;
 
@@ -435,53 +442,38 @@ export function useRoomOrchestration({
         eventId?: string;
         sequence?: number;
         type?: string;
         payload?: Record<string, unknown>;
       };
 
       if (typeof envelope?.sequence === 'number') {
         const incomingSeq = envelope.sequence;
-        if (cursorRef.current > 0 && incomingSeq > cursorRef.current + 1) {
-          // Gap detected - catch up through sync endpoint
-          void catchUpSync();
-        } else {
-          cursorRef.current = Math.max(cursorRef.current, incomingSeq);
-          applyRoomEvent(envelope);
+        if (incomingSeq <= cursorRef.current) return;
+        if (incomingSeq !== cursorRef.current + 1) {
+          window.dispatchEvent(new CustomEvent('studyroom:resync',{detail:roomChannel}));
         }
+        cursorRef.current = incomingSeq;
+        applyRoomEvent(envelope);
       } else {
         applyRoomEvent(envelope);
       }
     });
 
     return () => {
       unsubscribe();
     };
-  }, [state, bootstrap?.room?.id, bootstrap?.room?.streamGeneration, applyRoomEvent, catchUpSync]);
-
-  const refreshBootstrap = useCallback(async () => {
-    if (!roomSlug) return;
-    try {
-      const data = await studyRoomRepository.getBootstrap(roomSlug);
-      setBootstrap(data);
-      bootstrapRef.current = data;
-      if (typeof realtimeRef.current?.refreshManifest === 'function') {
-        void Promise.resolve(realtimeRef.current.refreshManifest()).catch(() => {});
-      }
-    } catch {
-      // Best effort
-    }
-  }, [roomSlug]);
+  }, [state, bootstrap?.room?.id, bootstrap?.room?.streamGeneration, applyRoomEvent, realtime?.status]);
 
   const leave = useCallback(
     async (global = false) => {
       const currentTabId = getTabId();
       const activeRoomId = bootstrapRef.current?.room?.id || roomSlug;
       try {
-        await studyRoomRepository.leaveRoom(activeRoomId, currentTabId, global);
+        await studyRoomRepository.leaveRoom(activeRoomId, currentTabId, global, generationRef.current ?? undefined);
       } catch {
         // Silently catch leave network errors on exit
       } finally {
         setState('unavailable');
         setGeneration(null);
         generationRef.current = null;
       }
     },
diff --git a/src/client/screens/dashboard/studyroom/hooks/useRoomRefresh.ts b/src/client/screens/dashboard/studyroom/hooks/useRoomRefresh.ts
new file mode 100644
--- /dev/null
+++ b/src/client/screens/dashboard/studyroom/hooks/useRoomRefresh.ts
@@ -0,0 +1,12 @@
+import { useEffect } from 'react';
+
+export function useRoomRefresh(channel: string | undefined, refresh: () => void) {
+  useEffect(() => {
+    if (!channel) return;
+    const listener = (event: Event) => {
+      if ((event as CustomEvent<string>).detail === channel) refresh();
+    };
+    window.addEventListener('studyroom:resync',listener);
+    return () => window.removeEventListener('studyroom:resync',listener);
+  },[channel,refresh]);
+}
diff --git a/src/client/screens/dashboard/studyroom/hooks/useRoomRoster.ts b/src/client/screens/dashboard/studyroom/hooks/useRoomRoster.ts
--- a/src/client/screens/dashboard/studyroom/hooks/useRoomRoster.ts
+++ b/src/client/screens/dashboard/studyroom/hooks/useRoomRoster.ts
@@ -1,13 +1,14 @@
 'use client';
 
 import { useState, useEffect, useCallback, useRef } from 'react';
 import type { RoomRosterMemberDTO } from '@/src/shared/studyroom/contracts';
 import { STUDY_ROOM_LIMITS } from '@/src/shared/studyroom/contracts';
+import { useRoomRefresh } from './useRoomRefresh';
 import { useRealtime } from '@/src/client/realtime';
 
 export interface UseRoomRosterOptions {
   roomId: string;
   enabled?: boolean;
   streamGeneration?: number;
 }
 
@@ -32,27 +33,30 @@ export function useRoomRoster({
   streamGeneration = 1,
 }: UseRoomRosterOptions): UseRoomRosterResult {
   const [roster, setRoster] = useState<RoomRosterMemberDTO[]>([]);
   const [isLoading, setIsLoading] = useState(false);
   const [error, setError] = useState<string | null>(null);
 
   const isMountedRef = useRef(true);
   const realtime = useSafeRealtime();
+  const subscribe = realtime?.status === 'connected' ? realtime.subscribe : undefined;
 
+  const requestVersion = useRef(0);
   const fetchRoster = useCallback(async () => {
     if (!roomId || !enabled) return;
 
     try {
+      const version = ++requestVersion.current;
       const res = await fetch(`/api/studyroom/roster?roomId=${encodeURIComponent(roomId)}`);
       if (!res.ok) {
         throw new Error(`Failed to load roster (${res.status})`);
       }
       const data: unknown = await res.json();
-      if (isMountedRef.current) {
+      if (isMountedRef.current && requestVersion.current === version) {
         let members: RoomRosterMemberDTO[] = [];
         if (Array.isArray(data)) {
           members = data;
         } else if (data && typeof data === 'object') {
           if ('members' in data && Array.isArray((data as { members: unknown }).members)) {
             members = (data as { members: RoomRosterMemberDTO[] }).members;
           } else if ('roster' in data && Array.isArray((data as { roster: unknown }).roster)) {
             members = (data as { roster: RoomRosterMemberDTO[] }).roster;
@@ -78,61 +82,66 @@ export function useRoomRoster({
       setIsLoading(true);
       await fetchRoster().finally(() => {
         if (isMountedRef.current && !ignore) setIsLoading(false);
       });
     });
 
     const interval = setInterval(() => {
       void fetchRoster();
-    }, STUDY_ROOM_LIMITS.ROSTER_POLL_INTERVAL_MS);
+    }, subscribe ? 120_000 : STUDY_ROOM_LIMITS.ROSTER_POLL_INTERVAL_MS);
 
     const onFocus = () => {
       void fetchRoster();
     };
     window.addEventListener('focus', onFocus);
 
     return () => {
       ignore = true;
       isMountedRef.current = false;
       clearInterval(interval);
       window.removeEventListener('focus', onFocus);
     };
-  }, [enabled, roomId, fetchRoster]);
+  }, [enabled, roomId, fetchRoster, subscribe]);
+
+  useRoomRefresh(enabled ? `room:${roomId}:g${streamGeneration}` : undefined, fetchRoster);
 
   // Realtime subscription for immediate roster changes
   useEffect(() => {
-    if (!enabled || !roomId || typeof realtime?.subscribe !== 'function') return;
+    if (!enabled || !roomId || typeof subscribe !== 'function') return;
 
     const roomChannel = `room:${roomId}:g${streamGeneration}`;
-    const unsubscribe = realtime.subscribe(roomChannel, (data: unknown) => {
+    let timer: ReturnType<typeof setTimeout> | undefined;
+    const unsubscribe = subscribe(roomChannel, (data: unknown) => {
       const envelope = data as {
         type?: string;
         payload?: { userId?: string; publicGoal?: string | null };
       };
       if (
+        envelope?.type === 'room.governance.changed' ||
         envelope?.type === 'room.roster.changed' ||
         envelope?.type === 'room.participant.joined' ||
         envelope?.type === 'room.participant.left'
       ) {
-        void fetchRoster();
+        if (!timer) timer = setTimeout(() => { timer = undefined; void fetchRoster(); },200);
       } else if (envelope?.type === 'room.participant.updated' && envelope.payload?.userId) {
         const { userId, publicGoal } = envelope.payload;
         setRoster((prev) =>
           prev.map((m) =>
             m.userId === userId ? { ...m, publicGoal: publicGoal ?? null } : m
           )
         );
       }
     });
 
     return () => {
+      clearTimeout(timer);
       unsubscribe();
     };
-  }, [enabled, roomId, streamGeneration, realtime, fetchRoster]);
+  }, [enabled, roomId, streamGeneration, subscribe, fetchRoster]);
 
   return {
     roster,
     isLoading,
     error,
     refresh: fetchRoster,
   };
 }
diff --git a/src/client/screens/dashboard/studyroom/hooks/useRoomSprint.ts b/src/client/screens/dashboard/studyroom/hooks/useRoomSprint.ts
--- a/src/client/screens/dashboard/studyroom/hooks/useRoomSprint.ts
+++ b/src/client/screens/dashboard/studyroom/hooks/useRoomSprint.ts
@@ -1,12 +1,13 @@
 'use client';
 
 import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
 import { useSession } from 'next-auth/react';
+import { useRoomRefresh } from './useRoomRefresh';
 import { useRealtime } from '@/src/client/realtime';
 import type { RoomSprintBootstrapDTO } from '@/src/shared/studyroom/contracts';
 import {
   studyRoomRepository,
   type RoomSprintSnapshotDTO,
 } from '@/src/client/repositories/studyRoomRepository';
 
 export interface UseRoomSprintOptions {
@@ -69,16 +70,17 @@ function toSprintSnapshot(
     participants: [],
   };
 }
 
 export function useRoomSprint(options?: UseRoomSprintOptions): UseRoomSprintReturn {
   const { data: session } = useSession();
   const currentUserId = session?.user?.id;
   const realtime = useSafeRealtime();
+  const subscribe = realtime?.status === 'connected' ? realtime.subscribe : undefined;
 
   const [sprint, setSprint] = useState<RoomSprintSnapshotDTO | null>(() =>
     toSprintSnapshot(options?.initialSprint)
   );
   const [prevInitialSprint, setPrevInitialSprint] = useState<
     RoomSprintSnapshotDTO | RoomSprintBootstrapDTO | null | undefined
   >(options?.initialSprint);
   if (options?.initialSprint !== prevInitialSprint) {
@@ -108,16 +110,17 @@ export function useRoomSprint(options?: UseRoomSprintOptions): UseRoomSprintRetu
 
   // Fetch current sprint from server
   const fetchSprint = useCallback(async () => {
     if (!roomSlug || !enabled) return;
     setIsLoading(true);
     setError(null);
     try {
       const res = await studyRoomRepository.getRoomSprint(roomSlug);
+      if (res.sprint && sprintRef.current?.id === res.sprint.id && sprintRef.current.revision > res.sprint.revision) return;
       setSprint(res.sprint);
       if (res.sprint) {
         setRemainingSeconds(res.sprint.remainingSeconds);
       }
     } catch (err: unknown) {
       const msg = err instanceof Error ? err.message : String(err);
       setError(msg || 'Failed to load group sprint');
     } finally {
@@ -126,34 +129,37 @@ export function useRoomSprint(options?: UseRoomSprintOptions): UseRoomSprintRetu
   }, [roomSlug, enabled]);
 
   // Initial load
   useEffect(() => {
     // eslint-disable-next-line react-hooks/set-state-in-effect
     void fetchSprint();
   }, [fetchSprint]);
 
+  useRoomRefresh(enabled ? `room:${roomId}:g${streamGeneration}` : undefined, fetchSprint);
+
   // Realtime subscription to room.sprint.updated
   useEffect(() => {
-    if (!enabled || !roomId || typeof realtime?.subscribe !== 'function') return;
+    if (!enabled || !roomId || typeof subscribe !== 'function') return;
 
     const channel = `room:${roomId}:g${streamGeneration}`;
-    const unsubscribe = realtime.subscribe(channel, (data: unknown) => {
+    const unsubscribe = subscribe(channel, (data: unknown) => {
       const envelope = data as { type?: string; payload?: RoomSprintSnapshotDTO };
       if (envelope?.type === 'room.sprint.updated' && envelope.payload) {
+        if (sprintRef.current?.id === envelope.payload.id && sprintRef.current.revision > envelope.payload.revision) return;
         setSprint(envelope.payload);
         setRemainingSeconds(envelope.payload.remainingSeconds);
         setActionError(null);
       }
     });
 
     return () => {
       unsubscribe();
     };
-  }, [enabled, roomId, streamGeneration, realtime]);
+  }, [enabled, roomId, streamGeneration, subscribe]);
 
   // Live countdown timer for ACTIVE sprints
   useEffect(() => {
     if (!sprint || sprint.status !== 'ACTIVE' || !sprint.deadline) {
       return;
     }
 
     const deadlineMs = new Date(sprint.deadline).getTime();
diff --git a/src/client/screens/dashboard/studyroom/hooks/useSharedEnvironment.ts b/src/client/screens/dashboard/studyroom/hooks/useSharedEnvironment.ts
--- a/src/client/screens/dashboard/studyroom/hooks/useSharedEnvironment.ts
+++ b/src/client/screens/dashboard/studyroom/hooks/useSharedEnvironment.ts
@@ -1,9 +1,10 @@
 import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
+import { useRoomRefresh } from './useRoomRefresh';
 import { useRealtime } from '@/src/client/realtime';
 import {
   studyRoomRepository,
   type RoomEnvironmentSnapshotDTO,
 } from '@/src/client/repositories/studyRoomRepository';
 import { parseMusicUrl } from '../utils/parseMusicUrl';
 import type {
   AmbientPresetId,
@@ -37,57 +38,63 @@ function useSafeRealtime() {
 
 export function useSharedEnvironment(
   initialEnvironment: SharedRoomEnvironment,
   adminUserId: string,
   options?: UseSharedEnvironmentOptions
 ): UseSharedEnvironmentReturn {
   const [environment, setEnvironment] = useState<SharedRoomEnvironment>(initialEnvironment);
   const [revision, setRevision] = useState<number>(1);
+  const confirmed = useRef(initialEnvironment);
   const revisionRef = useRef<number>(1);
   const optionsRef = useRef(options);
   const realtime = useSafeRealtime();
+  const subscribe = realtime?.status === 'connected' ? realtime.subscribe : undefined;
 
   useEffect(() => {
     optionsRef.current = options;
   }, [options]);
 
   const applyServerSnapshot = useCallback((data: RoomEnvironmentSnapshotDTO) => {
+    if (data.revision < revisionRef.current) return;
     setRevision(data.revision);
     revisionRef.current = data.revision;
 
     const parsedMusic = data.musicStreamUrl ? parseMusicUrl(data.musicStreamUrl) : null;
     const nextMusic = parsedMusic && parsedMusic.ok ? parsedMusic.source : null;
 
-    setEnvironment((prev) => ({
+    const prev = confirmed.current;
+    confirmed.current = {
       ...prev,
       backgroundId: (data.sceneId as BackgroundId) || prev.backgroundId,
       music: nextMusic !== undefined ? nextMusic : prev.music,
       ambience: {
         ...prev.ambience,
-        presetId: (data.soundscapeId as AmbientPresetId) || prev.ambience.presetId,
+        presetId: (data.soundscapeId as AmbientPresetId | null) ?? null,
       },
       updatedAt: data.updatedAt ? new Date(data.updatedAt).getTime() : prev.updatedAt,
       updatedByUserId: data.updatedByUserId || prev.updatedByUserId,
-    }));
+    };
+    setEnvironment(local => ({...confirmed.current,ambience:{...confirmed.current.ambience,volume:local.ambience.volume,isPlaying:confirmed.current.ambience.presetId !== null && local.ambience.isPlaying}}));
   }, []);
 
   const reloadEnvironment = useCallback(async () => {
     const slug = optionsRef.current?.roomSlug;
     if (!slug) return;
     try {
       const data = await studyRoomRepository.getRoomEnvironment(slug);
-      applyServerSnapshot(data);
+      if (optionsRef.current?.roomSlug === slug) applyServerSnapshot(data);
     } catch {
       // Fall back gracefully to local state
     }
   }, [applyServerSnapshot]);
 
   // Initial load from server environment service if roomSlug provided
   useEffect(() => {
+    revisionRef.current = 0;
     const slug = options?.roomSlug;
     if (!slug) return;
 
     let ignore = false;
     void studyRoomRepository
       .getRoomEnvironment(slug)
       .then((data) => {
         if (!ignore && data) {
@@ -98,60 +105,61 @@ export function useSharedEnvironment(
         // Fall back gracefully to catalog preset
       });
 
     return () => {
       ignore = true;
     };
   }, [options?.roomSlug, applyServerSnapshot]);
 
+  useRoomRefresh(options?.roomId ? `room:${options.roomId}:g${options.streamGeneration ?? 1}` : undefined, reloadEnvironment);
+
   // Realtime subscription for room.environment.updated events
   useEffect(() => {
     const roomId = options?.roomId;
     const streamGeneration = options?.streamGeneration ?? 1;
-    if (!roomId || typeof realtime?.subscribe !== 'function') return;
+    if (!roomId || typeof subscribe !== 'function') return;
 
     const channel = `room:${roomId}:g${streamGeneration}`;
-    const unsubscribe = realtime.subscribe(channel, (data: unknown) => {
+    const unsubscribe = subscribe(channel, (data: unknown) => {
       const envelope = data as { type?: string; payload?: RoomEnvironmentSnapshotDTO };
       if (envelope?.type === 'room.environment.updated' && envelope.payload) {
         applyServerSnapshot(envelope.payload);
       }
     });
 
     return () => {
       unsubscribe();
     };
-  }, [options?.roomId, options?.streamGeneration, realtime, applyServerSnapshot]);
+  }, [options?.roomId, options?.streamGeneration, subscribe, applyServerSnapshot]);
 
   const persistServerEnvironment = useCallback(
     async (patch: {
       sceneId?: string;
       soundscapeId?: string | null;
       musicStreamUrl?: string | null;
     }) => {
       const slug = optionsRef.current?.roomSlug;
       const canControl = optionsRef.current?.canControlEnvironment;
       if (!slug || !canControl) return;
 
       try {
         const updated = await studyRoomRepository.updateRoomEnvironment(slug, {
           ...patch,
           expectedRevision: revisionRef.current,
         });
-        setRevision(updated.revision);
-        revisionRef.current = updated.revision;
-      } catch (err: unknown) {
-        if ((err as { status?: number })?.status === 409) {
-          // 409 Conflict: Reload authoritative environment from server to realign local state
-          await reloadEnvironment();
-        }
+        if (optionsRef.current?.roomSlug === slug) applyServerSnapshot(updated);
+      } catch {
+        if (optionsRef.current?.roomSlug !== slug) return;
+        setEnvironment(confirmed.current);
+        await reloadEnvironment();
+        window.dispatchEvent(new Event('studyroom:environment-error'));
       }
     },
-    [reloadEnvironment]
+    [reloadEnvironment,applyServerSnapshot]
   );
 
   const actions: SharedEnvironmentActions = useMemo(
     () => ({
       setBackground(id: BackgroundId) {
         setEnvironment((prev) => {
           if (prev.backgroundId === id) return prev;
           return {
diff --git a/src/client/screens/dashboard/studyroom/room/components/ParticipantActionsMenu.tsx b/src/client/screens/dashboard/studyroom/room/components/ParticipantActionsMenu.tsx
--- a/src/client/screens/dashboard/studyroom/room/components/ParticipantActionsMenu.tsx
+++ b/src/client/screens/dashboard/studyroom/room/components/ParticipantActionsMenu.tsx
@@ -6,27 +6,29 @@ import type { RoomRole } from '@/src/shared/studyroom/contracts';
 import styles from './ParticipantActionsMenu.module.css';
 
 export interface ParticipantActionsMenuProps {
   roomSlug: string;
   targetUserId: string;
   targetName: string;
   targetRole?: RoomRole;
   viewerRole?: RoomRole;
+  canManageRoles?: boolean;
   canManageParticipants: boolean;
   onActionSuccess?: (message: string) => void;
   onActionError?: (error: string) => void;
   onRosterMutated?: () => void;
 }
 
 export function ParticipantActionsMenu({
   roomSlug,
   targetUserId,
   targetName,
   targetRole,
+  canManageRoles = false,
   canManageParticipants,
   onActionSuccess,
   onActionError,
   onRosterMutated,
 }: ParticipantActionsMenuProps) {
   const [isOpen, setIsOpen] = useState(false);
   const [loadingAction, setLoadingAction] = useState<string | null>(null);
   const menuRef = useRef<HTMLDivElement>(null);
@@ -123,17 +125,17 @@ export function ParticipantActionsMenu({
     } catch (err: unknown) {
       onActionError?.(err instanceof Error ? err.message : 'Failed to ban user');
     } finally {
       setLoadingAction(null);
       setIsOpen(false);
     }
   }, [roomSlug, targetUserId, targetName, onActionSuccess, onActionError, onRosterMutated]);
 
-  if (!canManageParticipants || targetRole === 'OWNER') {
+  if (!canManageParticipants || targetRole === 'OWNER' || (!canManageRoles && targetRole === 'MODERATOR')) {
     return null;
   }
 
   return (
     <div className={styles.menuContainer} ref={menuRef}>
       <button
         type="button"
         className={styles.triggerBtn}
@@ -142,17 +144,17 @@ export function ParticipantActionsMenu({
         aria-expanded={isOpen}
         onClick={() => setIsOpen((prev) => !prev)}
       >
         <MoreVertical size={14} />
       </button>
 
       {isOpen && (
         <div className={styles.dropdown} role="menu">
-          <button
+          {canManageRoles && <button
             type="button"
             role="menuitem"
             className={styles.menuItem}
             onClick={() => void toggleHostRole()}
             disabled={Boolean(loadingAction)}
           >
             {isHost ? (
               <>
@@ -160,17 +162,17 @@ export function ParticipantActionsMenu({
                 <span>Revoke Host</span>
               </>
             ) : (
               <>
                 <Crown size={13} aria-hidden="true" />
                 <span>Make Host</span>
               </>
             )}
-          </button>
+          </button>}
 
           <button
             type="button"
             role="menuitem"
             className={`${styles.menuItem} ${styles.dangerItem}`}
             onClick={() => void removeUser()}
             disabled={Boolean(loadingAction)}
           >
diff --git a/src/client/screens/dashboard/studyroom/room/components/ParticipantPanel.tsx b/src/client/screens/dashboard/studyroom/room/components/ParticipantPanel.tsx
--- a/src/client/screens/dashboard/studyroom/room/components/ParticipantPanel.tsx
+++ b/src/client/screens/dashboard/studyroom/room/components/ParticipantPanel.tsx
@@ -5,25 +5,27 @@ import type { RoomParticipantView } from '../../types';
 import ParticipantRow from './ParticipantRow';
 import DemoDataNote from './DemoDataNote';
 import styles from './ParticipantPanel.module.css';
 
 export interface ParticipantPanelProps {
   participants: RoomParticipantView[];
   now: number;
   roomSlug?: string;
+  canManageRoles?: boolean;
   canManageParticipants?: boolean;
   onNotify?: (text: string) => void;
   onRosterMutated?: () => void;
 }
 
 export function ParticipantPanel({
   participants,
   now,
   roomSlug,
+  canManageRoles = false,
   canManageParticipants = false,
   onNotify,
   onRosterMutated,
 }: ParticipantPanelProps) {
   const sortedParticipants = useMemo(() => {
     return [...participants].sort((a, b) => {
       // 1. Current user first
       if (a.isCurrentUser) return -1;
@@ -44,16 +46,17 @@ export function ParticipantPanel({
     <div className={styles.panel}>
       <ul className={styles.list} aria-label="Room participants">
         {sortedParticipants.map((participant) => (
           <ParticipantRow
             key={participant.userId}
             participant={participant}
             now={now}
             roomSlug={roomSlug}
+            canManageRoles={canManageRoles}
             canManageParticipants={canManageParticipants}
             onNotify={onNotify}
             onRosterMutated={onRosterMutated}
           />
         ))}
       </ul>
 
       {isAlone && (
diff --git a/src/client/screens/dashboard/studyroom/room/components/ParticipantRow.tsx b/src/client/screens/dashboard/studyroom/room/components/ParticipantRow.tsx
--- a/src/client/screens/dashboard/studyroom/room/components/ParticipantRow.tsx
+++ b/src/client/screens/dashboard/studyroom/room/components/ParticipantRow.tsx
@@ -7,25 +7,27 @@ import { ParticipantAvatar } from '../../components/ParticipantAvatar';
 import { formatElapsed } from '../../utils/formatTime';
 import ParticipantActionsMenu from './ParticipantActionsMenu';
 import styles from './ParticipantPanel.module.css';
 
 export interface ParticipantRowProps {
   participant: RoomParticipantView;
   now: number;
   roomSlug?: string;
+  canManageRoles?: boolean;
   canManageParticipants?: boolean;
   onNotify?: (text: string) => void;
   onRosterMutated?: () => void;
 }
 
 export function ParticipantRow({
   participant,
   now,
   roomSlug,
+  canManageRoles = false,
   canManageParticipants = false,
   onNotify,
   onRosterMutated,
 }: ParticipantRowProps) {
   const displayName = participant.displayName?.trim() || 'Guest';
   const elapsedMs = now - participant.joinedAt;
   const elapsedText = formatElapsed(elapsedMs);
 
@@ -81,16 +83,17 @@ export function ParticipantRow({
         <span className={styles.elapsed}>{elapsedText}</span>
 
         {canManageParticipants && roomSlug && !participant.isCurrentUser && !isOwner && (
           <ParticipantActionsMenu
             roomSlug={roomSlug}
             targetUserId={participant.userId}
             targetName={displayName}
             targetRole={participant.role}
+            canManageRoles={canManageRoles}
             canManageParticipants={canManageParticipants}
             onActionSuccess={(msg) => onNotify?.(msg)}
             onActionError={(err) => onNotify?.(`Error: ${err}`)}
             onRosterMutated={onRosterMutated}
           />
         )}
       </div>
 
diff --git a/src/client/screens/dashboard/studyroom/room/components/RoomBans.tsx b/src/client/screens/dashboard/studyroom/room/components/RoomBans.tsx
new file mode 100644
--- /dev/null
+++ b/src/client/screens/dashboard/studyroom/room/components/RoomBans.tsx
@@ -0,0 +1,29 @@
+'use client';
+import React, {useState} from 'react';
+import type { RoomRestrictionDTO } from '@/src/shared/studyroom/contracts';
+
+export function RoomBans({slug}:{slug:string}) {
+  const [rows,setRows]=useState<RoomRestrictionDTO[]>([]);
+  const [message,setMessage]=useState('');
+  const [open,setOpen]=useState(false);
+  const base='/api/studyroom/'+encodeURIComponent(slug)+'/restrictions';
+  async function load() {
+    try {
+      const res=await fetch(base,{cache:'no-store'});
+      if(!res.ok) throw Error('Unable to read restrictions');
+      const data:{restrictions:RoomRestrictionDTO[]}=await res.json();
+      setRows(data.restrictions.filter(r=>r.action==='BAN' && (!r.expiresAt || Date.parse(r.expiresAt)>Date.now())));
+      setMessage('');
+    } catch { setRows([]);setMessage('Unable to read restrictions.'); }
+  }
+  async function lift(id:string) {
+    try {
+      const res=await fetch(base+'/'+encodeURIComponent(id),{method:'DELETE'});
+      if(!res.ok) throw Error();
+      await load();
+    } catch {setMessage('Unable to lift this ban.');}
+  }
+  return <div><button type="button" aria-expanded={open} onClick={()=>{setOpen(!open);if(!open)void load();}}>Room bans</button>
+    {open && <div>{rows.map(r=><p key={r.id}>{r.userName} <button type="button" onClick={()=>void lift(r.userId)}>Lift ban</button></p>)}
+    <p role="status">{message || (!rows.length ? 'No active bans.' : '')}</p></div>}</div>;
+}
diff --git a/src/client/screens/dashboard/studyroom/room/components/RoomSocial.tsx b/src/client/screens/dashboard/studyroom/room/components/RoomSocial.tsx
--- a/src/client/screens/dashboard/studyroom/room/components/RoomSocial.tsx
+++ b/src/client/screens/dashboard/studyroom/room/components/RoomSocial.tsx
@@ -1,14 +1,15 @@
 'use client';
 
 import React, { useState } from 'react';
 import { Crown, MoreHorizontal, Send, Smile, UserPlus } from 'lucide-react';
 import type { RoomParticipantView, Viewer } from '../../types';
 import { ParticipantAvatar } from '../../components/ParticipantAvatar';
+import { RoomBans } from './RoomBans';
 import ParticipantActionsMenu from './ParticipantActionsMenu';
 import { useRoomChat } from '../../hooks/useRoomChat';
 import styles from './RoomSocial.module.css';
 
 interface Props {
   participants: RoomParticipantView[];
   viewer: Viewer;
   onOpenPeople: (trigger: HTMLElement) => void;
@@ -94,16 +95,17 @@ export default function RoomSocial({
               aria-label="View all participants"
               title="View all participants"
               onClick={(e) => onOpenPeople(e.currentTarget)}
             >
               <MoreHorizontal size={18} />
             </button>
           </header>
 
+          {canManageParticipants && roomSlug && <RoomBans slug={roomSlug} />}
           <ul className={styles.roster}>
             {sortedParticipants.slice(0, 3).map((person) => {
               const isOwner = person.role === 'OWNER';
               const isMod = person.role === 'MODERATOR';
               const isHost = person.role === 'HOST' || (person.isAdmin && !person.role && !isOwner);
               const isCurrent = person.isCurrentUser;
               const nameDisplay = isCurrent ? 'You' : person.displayName;
 
@@ -138,16 +140,17 @@ export default function RoomSocial({
                     </p>
                   </div>
                   {canManageParticipants && roomSlug && !isCurrent && !isOwner && (
                     <ParticipantActionsMenu
                       roomSlug={roomSlug}
                       targetUserId={person.userId}
                       targetName={person.displayName}
                       targetRole={person.role}
+                      canManageRoles={viewer.capabilities?.canManageRoles}
                       canManageParticipants={canManageParticipants}
                       onActionSuccess={(msg) => onNotify(msg)}
                       onActionError={(err) => onNotify(`Error: ${err}`)}
                       onRosterMutated={onRosterMutated}
                     />
                   )}
                 </li>
               );
@@ -213,16 +216,17 @@ export default function RoomSocial({
                     <div className={styles.messageMeta}>
                       <strong className={styles.senderName}>{senderName}</strong>
                       <time className={styles.messageTime}>{timeDisplay}</time>
                       {msg.deliveryStatus === 'pending' && (
                         <span className={styles.statusPending}>(sending...)</span>
                       )}
                     </div>
                     <p className={styles.messageBody}>{msg.content}</p>
+                    {msg.reactions?.map(r => <span key={r.emoji}>{r.emoji} {r.count} </span>)}
                     {msg.deliveryStatus === 'failed' && (
                       <div className={styles.statusFailed}>
                         <span>Failed to send</span>
                         {msg.clientRequestId && (
                           <button
                             type="button"
                             className={styles.retryBtn}
                             onClick={() => void retryMessage(msg.clientRequestId!)}
diff --git a/src/client/screens/dashboard/studyroom/room/RoomScreen.tsx b/src/client/screens/dashboard/studyroom/room/RoomScreen.tsx
--- a/src/client/screens/dashboard/studyroom/room/RoomScreen.tsx
+++ b/src/client/screens/dashboard/studyroom/room/RoomScreen.tsx
@@ -90,21 +90,24 @@ export function RoomScreen({ roomSlug, viewAsOverride }: RoomScreenProps) {
   const eligibilityReason = roomBootstrap?.capabilities?.eligibilityReason;
   const isDenied =
     orchestrationState === 'denied' ||
     (Boolean(roomBootstrap) &&
       !roomBootstrap?.capabilities?.canJoin &&
       !roomBootstrap?.viewer?.isJoined);
 
   const canParticipate =
-    orchestrationState === 'joined' ||
-    orchestrationState === 'reconnecting' ||
-    orchestrationState === 'joining';
+    orchestrationState === 'joined';
 
   const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
+  useEffect(() => {
+    const warn = () => setToast({id:Date.now(),text:'Room change could not be saved. Check your connection and retry.'});
+    window.addEventListener('studyroom:environment-error',warn);
+    return () => window.removeEventListener('studyroom:environment-error',warn);
+  },[]);
   const [settingsModalOpen, setSettingsModalOpen] = useState(false);
   const [isAcceptingTransfer, setIsAcceptingTransfer] = useState(false);
 
   const handleAcceptTransfer = async (transferId: string) => {
     setIsAcceptingTransfer(true);
     try {
       const res = await fetch(`/api/studyroom/${roomSlug}/ownership-transfers/${transferId}/accept`, {
         method: 'POST',
@@ -127,19 +130,19 @@ export function RoomScreen({ roomSlug, viewAsOverride }: RoomScreenProps) {
     enabled: canParticipate,
     streamGeneration: roomBootstrap?.room?.streamGeneration,
   });
 
   const canControlEnv = viewer.capabilities?.canControlEnvironment ?? (viewer.role === 'admin');
 
   // Shared room state (admin/controller controls mutations, persisted to environment service)
   const env = useSharedEnvironment(room.defaultEnvironment, viewer.userId, {
-    roomSlug,
+    roomSlug: canParticipate ? roomSlug : undefined,
     canControlEnvironment: canControlEnv,
-    roomId: roomBootstrap?.room?.id || roomSlug,
+    roomId: canParticipate ? roomBootstrap?.room?.id : undefined,
     streamGeneration: roomBootstrap?.room?.streamGeneration,
   });
 
   // Shared room sprint (active group sprint distinct from personal pomodoro)
   const canControlSprint = viewer.capabilities?.canControlEnvironment ?? (viewer.role === 'admin');
   const roomSprint = useRoomSprint({
     roomSlug,
     roomId: roomBootstrap?.room?.id || roomSlug,
@@ -284,16 +287,17 @@ export function RoomScreen({ roomSlug, viewAsOverride }: RoomScreenProps) {
 
   const renderPanelContent = () => {
     switch (activePanel) {
       case 'session':
         return <SessionPanel goal={goal} tasks={tasks} onClose={closePanel} />;
       case 'people':
         return (
           <ParticipantPanel
+            canManageRoles={viewer.capabilities?.canManageRoles}
             participants={participants}
             now={now}
             roomSlug={roomSlug}
             canManageParticipants={viewer.capabilities?.canManageParticipants ?? (viewer.role === 'admin')}
             onNotify={(text) => setToast({ id: Date.now(), text })}
             onRosterMutated={() => void refreshRoster()}
           />
         );
@@ -333,17 +337,17 @@ export function RoomScreen({ roomSlug, viewAsOverride }: RoomScreenProps) {
         return 'Room Info';
       case 'timer':
         return 'Timer Settings';
       default:
         return '';
     }
   };
 
-  if (orchestrationState === 'loading') {
+  if (['loading','joining','reconnecting'].includes(orchestrationState)) {
     return (
       <main className={styles.deniedContainer} aria-busy="true" data-testid="room-loading-stage">
         <div className={styles.deniedCard}>
           <div className={`${styles.deniedIconWrap} ${styles.deniedIconWrapWarning}`}>
             <Clock size={28} />
           </div>
           <h2 className={styles.deniedTitle}>Connecting to Study Room...</h2>
           <p className={styles.deniedText}>Verifying seat allocation and setting up your workspace.</p>
@@ -404,17 +408,23 @@ export function RoomScreen({ roomSlug, viewAsOverride }: RoomScreenProps) {
               Browse Study Rooms
             </button>
           </div>
         </div>
       </main>
     );
   }
 
-  if (isDenied && eligibilityReason && eligibilityReason !== 'ELIGIBLE') {
+  if (isDenied && roomBootstrap?.capabilities.canEditRoom &&
+      ['DRAFT','CLOSED','ARCHIVED'].includes(roomBootstrap.room.status)) {
+    return <RoomSettingsModal isOpen isOwner room={roomBootstrap.room}
+      onClose={() => router.push('/studyroom')} onUpdated={() => void rejoin()} />;
+  }
+
+  if (isDenied) {
     let title = 'Access Restricted';
     let text = 'You do not currently have access to this study room.';
     let icon = <Lock size={28} />;
     let isWarning = false;
 
     if (eligibilityReason === 'ROOM_FULL') {
       title = 'Study Room is Full';
       text = 'This room has reached its maximum seat capacity. Please wait for an open seat or browse other rooms.';
@@ -547,18 +557,18 @@ export function RoomScreen({ roomSlug, viewAsOverride }: RoomScreenProps) {
             viewer={viewer}
             onOpenPeople={(trigger) => togglePanel('people', trigger)}
             onNotify={(text) => setToast({ id: Date.now(), text })}
             showPeople={true}
             roomSlug={roomSlug}
             canManageParticipants={viewer.capabilities?.canManageParticipants ?? (viewer.role === 'admin')}
             onRosterMutated={() => void refreshRoster()}
             cohortTitle={roomBootstrap?.room?.cohortId ? 'Cohort' : null}
-            channelId={roomBootstrap?.channelId}
-            streamGeneration={roomBootstrap?.room?.streamGeneration}
+            channelId={canParticipate ? roomBootstrap?.channelId : null}
+            streamGeneration={roomBootstrap?.chatGeneration}
           />
         </div>
       </div>
 
       {/* 4. Bottom Dock: Ambience Audio Player & Scene / Color Picker (shown when admin toggles Customize room) */}
       {customizeDockOpen && (
         <footer id="room-background-dock" className={styles.dockContainer}>
           <SceneDock
diff --git a/src/client/screens/dashboard/studyroom/StudyRoomScreen.tsx b/src/client/screens/dashboard/studyroom/StudyRoomScreen.tsx
--- a/src/client/screens/dashboard/studyroom/StudyRoomScreen.tsx
+++ b/src/client/screens/dashboard/studyroom/StudyRoomScreen.tsx
@@ -308,18 +308,18 @@ export function StudyRoomScreen({ initialRooms }: StudyRoomScreenProps) {
                 {isLoading ? 'Loading more...' : 'Load more rooms'}
               </button>
             </div>
           )}
         </>
       )}
 
       {/* Create Room Modal */}
-      <CreateRoomModal
+      {isCreateModalOpen && <CreateRoomModal
         isOpen={isCreateModalOpen}
         onClose={() => setIsCreateModalOpen(false)}
         onRoomCreated={handleRoomCreated}
-      />
+      />}
     </div>
   );
 }
 
 export default StudyRoomScreen;
diff --git a/src/client/screens/dashboard/studyroom/__tests__/room-provider-hardening.test.tsx b/src/client/screens/dashboard/studyroom/__tests__/room-provider-hardening.test.tsx
new file mode 100644
--- /dev/null
+++ b/src/client/screens/dashboard/studyroom/__tests__/room-provider-hardening.test.tsx
@@ -0,0 +1,24 @@
+/** @vitest-environment jsdom */
+import React from 'react';
+import {act,cleanup,render} from '@testing-library/react';
+import {afterEach,expect,it,vi} from 'vitest';
+import {RealtimeProvider} from '@/src/client/realtime';
+import {useSharedEnvironment} from '../hooks/useSharedEnvironment';
+const driver=vi.hoisted(()=>({creates:0}));
+vi.mock('centrifuge',()=>({Centrifuge:class {
+  handlers=new Map<string,(ctx:unknown)=>void>();
+  on(name:string,callback:(ctx:unknown)=>void){this.handlers.set(name,callback);}
+  connect(){this.handlers.get('connected')?.({client:'test'});}
+  disconnect(){} removeSubscription(){}
+  newSubscription(){driver.creates++; return {on(){},subscribe(){},unsubscribe(){},removeAllListeners(){}};}
+}, UnauthorizedError:Error}));
+vi.mock('@/src/client/repositories/studyRoomRepository',()=>({studyRoomRepository:{getRoomEnvironment:()=>new Promise(()=>{})}}));
+function Room(){useSharedEnvironment({backgroundId:'library',music:null,ambience:{presetId:null,volume:0,isPlaying:false},updatedAt:0,updatedByUserId:'x'},'x',{roomSlug:'room',roomId:'room'});return null;}
+afterEach(()=>{cleanup();driver.creates=0;});
+it.each([true,false])('keeps one subscription with cold mount=%s',async cold=>{
+  const ui=(show:boolean)=><RealtimeProvider userId="x">{show?<Room/>:null}</RealtimeProvider>;
+  const view=render(ui(cold));
+  if(!cold) view.rerender(ui(true));
+  await act(async()=>{});
+  expect(driver.creates).toBe(1);
+});
diff --git a/src/client/screens/dashboard/studyroom/__tests__/RoomGovernance.test.tsx b/src/client/screens/dashboard/studyroom/__tests__/RoomGovernance.test.tsx
--- a/src/client/screens/dashboard/studyroom/__tests__/RoomGovernance.test.tsx
+++ b/src/client/screens/dashboard/studyroom/__tests__/RoomGovernance.test.tsx
@@ -92,16 +92,17 @@ describe('Phase 5: Roles, Governance & Sharing UI', () => {
 
     it('does not render for the OWNER', () => {
       const { container } = render(
         <ParticipantActionsMenu
           roomSlug="dev-room"
           targetUserId="owner-1"
           targetName="Owner Bob"
           targetRole="OWNER"
+          canManageRoles={true}
           canManageParticipants={true}
         />
       );
       expect(container.firstChild).toBeNull();
     });
 
     it('opens dropdown and allows promoting a participant to Host', async () => {
       const fetchMock = vi.fn().mockResolvedValue({
@@ -113,16 +114,17 @@ describe('Phase 5: Roles, Governance & Sharing UI', () => {
       const onSuccess = vi.fn();
 
       render(
         <ParticipantActionsMenu
           roomSlug="dev-room"
           targetUserId="peer-1"
           targetName="Alice"
           targetRole="PARTICIPANT"
+          canManageRoles={true}
           canManageParticipants={true}
           onActionSuccess={onSuccess}
         />
       );
 
       const trigger = screen.getByRole('button', { name: /moderation actions for alice/i });
       fireEvent.click(trigger);
 
@@ -151,16 +153,17 @@ describe('Phase 5: Roles, Governance & Sharing UI', () => {
       const onSuccess = vi.fn();
 
       render(
         <ParticipantActionsMenu
           roomSlug="dev-room"
           targetUserId="peer-2"
           targetName="Charlie"
           targetRole="PARTICIPANT"
+          canManageRoles={true}
           canManageParticipants={true}
           onActionSuccess={onSuccess}
         />
       );
 
       fireEvent.click(screen.getByRole('button', { name: /moderation actions for charlie/i }));
 
       const kickBtn = screen.getByRole('menuitem', { name: /remove \(kick\)/i });
@@ -287,17 +290,17 @@ describe('Phase 5: Roles, Governance & Sharing UI', () => {
           });
         }
         if (url.includes('/api/studyroom/fireplace')) {
           return Promise.resolve({
             ok: true,
             json: async () => ({
               room: { id: 'room-fp', slug: 'fireplace', title: 'Fireplace Room', capacity: 20 },
               capabilities: { canJoin: true, canEditRoom: false, canManageParticipants: false },
-              userRole: 'PARTICIPANT',
+              viewer:{userId:'user-viewer',role:'PARTICIPANT',isJoined:true},
               pendingTransfer: {
                 id: 'transfer-99',
                 recipientId: 'user-viewer',
                 status: 'PENDING',
               },
             }),
           });
         }
diff --git a/src/client/screens/dashboard/studyroom/__tests__/RoomScreen.orchestration.test.tsx b/src/client/screens/dashboard/studyroom/__tests__/RoomScreen.orchestration.test.tsx
--- a/src/client/screens/dashboard/studyroom/__tests__/RoomScreen.orchestration.test.tsx
+++ b/src/client/screens/dashboard/studyroom/__tests__/RoomScreen.orchestration.test.tsx
@@ -52,17 +52,17 @@ describe('RoomScreen orchestration stages (Phase 5)', () => {
 
     expect(screen.getByTestId('room-loading-stage')).toBeTruthy();
     expect(screen.getByText('Connecting to Study Room...')).toBeTruthy();
   });
 
   it('renders switched_elsewhere stage when lease renewal reports stale_generation', async () => {
     vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
 
-    vi.spyOn(studyRoomRepository, 'getBootstrap').mockResolvedValueOnce({
+    vi.spyOn(studyRoomRepository, 'getBootstrap').mockResolvedValue({
       room: {
         id: 'room-1',
         slug: 'fireplace',
         title: 'Fireplace Room',
         status: 'OPEN',
         capacity: 25,
         onlineCount: 2,
         ownerId: 'host-1',
diff --git a/src/client/screens/dashboard/studyroom/__tests__/RoomScreen.roles.test.tsx b/src/client/screens/dashboard/studyroom/__tests__/RoomScreen.roles.test.tsx
--- a/src/client/screens/dashboard/studyroom/__tests__/RoomScreen.roles.test.tsx
+++ b/src/client/screens/dashboard/studyroom/__tests__/RoomScreen.roles.test.tsx
@@ -1,12 +1,13 @@
 /** @vitest-environment jsdom */
 import React from 'react';
 import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
 import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
+import { studyRoomRepository } from '@/src/client/repositories/studyRoomRepository';
 import { RoomScreen } from '../room/RoomScreen';
 
 vi.mock('next/navigation', () => ({
   useRouter: () => ({
     push: vi.fn(),
     replace: vi.fn(),
     prefetch: vi.fn(),
     back: vi.fn(),
@@ -17,16 +18,23 @@ vi.mock('next-auth/react', () => ({
   useSession: () => ({
     data: {
       user: { id: 'test-viewer', name: 'Test Viewer', image: null },
     },
     status: 'authenticated',
   }),
 }));
 
+function fixtureRoom(slug:string, role:'admin'|'member') {
+  vi.mocked(studyRoomRepository.getBootstrap).mockResolvedValue({
+    room:{id:'r',slug,title:'Library'},viewer:{isJoined:true,userId:'test-viewer',role:role==='admin'?'OWNER':'PARTICIPANT'},
+    capabilities:{canJoin:true,canManageParticipants:role==='admin',canControlEnvironment:role==='admin',canEditRoom:role==='admin'}
+  } as Awaited<ReturnType<typeof studyRoomRepository.getBootstrap>>);
+  return <RoomScreen roomSlug={slug} />;
+}
 class MockAudioContext {
   currentTime = 0;
   sampleRate = 44100;
   state: 'suspended' | 'running' = 'running';
   destination = { connect: vi.fn(), disconnect: vi.fn() };
 
   createGain() {
     return {
@@ -96,31 +104,35 @@ class MockAudioContext {
   });
 }
 
 describe('RoomScreen role-dependent environment controls and dock persistence', () => {
   const originalAudioContext = window.AudioContext;
 
   beforeEach(() => {
     vi.clearAllMocks();
+    vi.spyOn(studyRoomRepository,'getBootstrap').mockResolvedValue({
+      room:{id:'r',slug:'library',title:'Library'},viewer:{isJoined:true,userId:'test-viewer'}
+    } as Awaited<ReturnType<typeof studyRoomRepository.getBootstrap>>);
+    vi.spyOn(studyRoomRepository,'joinRoom').mockResolvedValue({success:true,generation:1} as Awaited<ReturnType<typeof studyRoomRepository.joinRoom>>);
     window.AudioContext = MockAudioContext as unknown as typeof AudioContext;
   });
 
   afterEach(() => {
     cleanup();
     if (originalAudioContext) {
       window.AudioContext = originalAudioContext;
     } else {
       delete (window as unknown as { AudioContext?: unknown }).AudioContext;
     }
   });
 
   it('renders read-only Room Info for member without customization options', async () => {
     await act(async () => {
-      render(<RoomScreen roomSlug="library" viewAsOverride="member" />);
+      render(fixtureRoom('library','member'));
     });
 
     // 1. Top bar button shows "Room info", not "Customize room"
     expect(screen.getByRole('button', { name: 'Room information' })).toBeTruthy();
     expect(screen.queryByRole('button', { name: 'Customize room environment' })).toBeNull();
 
     // 2. Open room panel
     const infoBtn = screen.getByRole('button', { name: 'Room information' });
@@ -133,17 +145,17 @@ describe('RoomScreen role-dependent environment controls and dock persistence',
     // 4. Assert absence of "Set room music" and interactive inputs
     expect(screen.queryByRole('button', { name: 'Set room music' })).toBeNull();
     expect(screen.queryByRole('radiogroup')).toBeNull();
     expect(screen.queryByRole('slider')).toBeNull();
   });
 
   it('toggles bottom background customization dock when admin clicks Customize room', async () => {
     await act(async () => {
-      render(<RoomScreen roomSlug="library" viewAsOverride="admin" />);
+      render(fixtureRoom('library','admin'));
     });
 
     // 1. Initially bottom dock is closed
     expect(screen.queryByLabelText('Room backgrounds')).toBeNull();
 
     // 2. Top bar button shows "Customize room environment"
     const customizeBtn = screen.getByRole('button', { name: 'Customize room environment' });
     expect(customizeBtn).toBeTruthy();
@@ -157,17 +169,17 @@ describe('RoomScreen role-dependent environment controls and dock persistence',
 
     // 5. Clicking close button hides the dock again
     fireEvent.click(screen.getByRole('button', { name: 'Close background picker' }));
     expect(screen.queryByLabelText('Room backgrounds')).toBeNull();
   });
 
   it('persists the music player dock iframe across panel open/close transitions', async () => {
     await act(async () => {
-      render(<RoomScreen roomSlug="library" viewAsOverride="admin" />);
+      render(fixtureRoom('library','admin'));
     });
 
     // 1. Open Music modal from the timer widget and set a music source
     const musicBtn = screen.getByRole('button', { name: 'Room music' });
     fireEvent.click(musicBtn);
 
     const musicInput = screen.getByPlaceholderText('Paste a YouTube, Spotify, or playlist link');
     fireEvent.change(musicInput, { target: { value: 'https://www.youtube.com/watch?v=jfKfPfyJRdk' } });
diff --git a/src/client/screens/dashboard/studyroom/__tests__/RoomScreen.shell.test.tsx b/src/client/screens/dashboard/studyroom/__tests__/RoomScreen.shell.test.tsx
--- a/src/client/screens/dashboard/studyroom/__tests__/RoomScreen.shell.test.tsx
+++ b/src/client/screens/dashboard/studyroom/__tests__/RoomScreen.shell.test.tsx
@@ -1,12 +1,13 @@
 /** @vitest-environment jsdom */
 import React from 'react';
 import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
 import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
+import { studyRoomRepository } from '@/src/client/repositories/studyRoomRepository';
 import { RoomScreen } from '../room/RoomScreen';
 
 const pushSpy = vi.fn();
 
 vi.mock('next/navigation', () => ({
   useRouter: () => ({
     push: pushSpy,
     replace: vi.fn(),
@@ -19,16 +20,23 @@ vi.mock('next-auth/react', () => ({
   useSession: () => ({
     data: {
       user: { id: 'test-viewer', name: 'Test Viewer', image: null },
     },
     status: 'authenticated',
   }),
 }));
 
+function fixtureRoom(slug:string, role:'admin'|'member') {
+  vi.mocked(studyRoomRepository.getBootstrap).mockResolvedValue({
+    room:{id:'r',slug,title:'Library'},viewer:{isJoined:true,userId:'test-viewer',role:role==='admin'?'OWNER':'PARTICIPANT'},
+    capabilities:{canJoin:true,canManageParticipants:role==='admin',canControlEnvironment:role==='admin',canEditRoom:role==='admin'}
+  } as Awaited<ReturnType<typeof studyRoomRepository.getBootstrap>>);
+  return <RoomScreen roomSlug={slug} />;
+}
 class MockAudioContext {
   currentTime = 0;
   sampleRate = 44100;
   state: 'suspended' | 'running' = 'running';
   destination = { connect: vi.fn(), disconnect: vi.fn() };
 
   createGain() {
     return {
@@ -98,16 +106,20 @@ class MockAudioContext {
   });
 }
 
 describe('RoomScreen shell component', () => {
   const originalAudioContext = window.AudioContext;
 
   beforeEach(() => {
     vi.clearAllMocks();
+    vi.spyOn(studyRoomRepository,'getBootstrap').mockResolvedValue({
+      room:{id:'r',slug:'library',title:'Library'},viewer:{isJoined:true,userId:'test-viewer'}
+    } as Awaited<ReturnType<typeof studyRoomRepository.getBootstrap>>);
+    vi.spyOn(studyRoomRepository,'joinRoom').mockResolvedValue({success:true,generation:1} as Awaited<ReturnType<typeof studyRoomRepository.joinRoom>>);
     if (typeof window !== 'undefined' && window.localStorage) {
       window.localStorage.clear();
     }
     window.AudioContext = MockAudioContext as unknown as typeof AudioContext;
   });
 
   afterEach(() => {
     cleanup();
@@ -115,54 +127,52 @@ describe('RoomScreen shell component', () => {
       window.AudioContext = originalAudioContext;
     } else {
       delete (window as unknown as { AudioContext?: unknown }).AudioContext;
     }
   });
 
   it('renders room title, atmosphere, and default sound chip', async () => {
     await act(async () => {
-      render(<RoomScreen roomSlug="library" viewAsOverride="admin" />);
+      render(fixtureRoom('library','admin'));
     });
 
     expect(screen.getByRole('heading', { level: 1, name: 'Library' })).toBeTruthy();
     expect(screen.getByText('Silent study & focus')).toBeTruthy();
 
     // Clicking customize room opens the dock with current sound preset
     fireEvent.click(screen.getByRole('button', { name: 'Customize room environment' }));
     expect(screen.getByText('Rain · playing')).toBeTruthy();
   });
 
   it('shows "Customize room" for admin and "Room info" for member via viewAsOverride', async () => {
     let unmountFn!: () => void;
 
     await act(async () => {
-      const { unmount } = render(
-        <RoomScreen roomSlug="library" viewAsOverride="admin" />
-      );
+      const { unmount } = render(fixtureRoom('library','admin'));
       unmountFn = unmount;
     });
 
     expect(screen.getByRole('button', { name: 'Customize room environment' })).toBeTruthy();
     expect(screen.getByText("You're the host")).toBeTruthy();
 
     unmountFn();
 
     await act(async () => {
-      render(<RoomScreen roomSlug="library" viewAsOverride="member" />);
+      render(fixtureRoom('library','member'));
     });
 
     expect(screen.getByRole('button', { name: 'Room information' })).toBeTruthy();
     expect(screen.queryByText("You're the host")).toBeNull();
     expect(screen.getByText('Host: Mira')).toBeTruthy();
   });
 
   it('switches panels such that only one panel is open at any time', async () => {
     await act(async () => {
-      render(<RoomScreen roomSlug="library" />);
+      render(fixtureRoom('library','member'));
     });
 
     // Initially no dialog panel is open
     expect(screen.queryByRole('dialog')).toBeNull();
 
     // 1. Open Session panel
     const sessionBtn = screen.getByRole('button', { name: 'Personal tasks and session goal' });
     fireEvent.click(sessionBtn);
@@ -180,17 +190,17 @@ describe('RoomScreen shell component', () => {
     // 3. Clicking People again toggles it closed
     fireEvent.click(peopleBtn);
     expect(screen.queryByRole('dialog')).toBeNull();
   });
 
   it('closes open panel when Escape key is pressed', async () => {
     let containerElem!: HTMLElement;
     await act(async () => {
-      const { container } = render(<RoomScreen roomSlug="library" />);
+      const { container } = render(fixtureRoom('library','member'));
       containerElem = container;
     });
 
     const sessionBtn = screen.getByRole('button', { name: 'Personal tasks and session goal' });
     fireEvent.click(sessionBtn);
 
     expect(screen.getByRole('dialog')).toBeTruthy();
 
@@ -199,17 +209,17 @@ describe('RoomScreen shell component', () => {
 
     fireEvent.keyDown(stage!, { key: 'Escape', code: 'Escape' });
 
     expect(screen.queryByRole('dialog')).toBeNull();
   });
 
   it('persists session tasks and goal draft across panel close and reopen', async () => {
     await act(async () => {
-      render(<RoomScreen roomSlug="library" />);
+      render(fixtureRoom('library','member'));
     });
 
     // 1. Open Session panel
     const sessionBtn = screen.getByRole('button', { name: 'Personal tasks and session goal' });
     fireEvent.click(sessionBtn);
 
     // 2. Type a goal draft and add a task
     const goalInput = screen.getByLabelText("What's your goal for this session?") as HTMLInputElement;
@@ -232,17 +242,17 @@ describe('RoomScreen shell component', () => {
     // 5. Verify goal draft and added task are preserved
     const reopenedGoalInput = screen.getByLabelText("What's your goal for this session?") as HTMLInputElement;
     expect(reopenedGoalInput.value).toBe('Write Chapter 1');
     expect(screen.getByText('Draft outline')).toBeTruthy();
   });
 
   it('enforces privacy invariant: goal text is hidden in People panel when Private, visible when Visible to room', async () => {
     await act(async () => {
-      render(<RoomScreen roomSlug="library" />);
+      render(fixtureRoom('library','member'));
     });
 
     const sessionBtn = screen.getByRole('button', { name: 'Personal tasks and session goal' });
     const peopleBtn = screen.getByRole('button', { name: /People, \d+ studying now/ });
 
     // 1. Open Session panel, enter goal "Secret plan", commit it (private by default)
     fireEvent.click(sessionBtn);
     const goalInput = screen.getByLabelText("What's your goal for this session?");
@@ -269,17 +279,17 @@ describe('RoomScreen shell component', () => {
 
     // 6. Open People panel: "Secret plan" must be GONE
     fireEvent.click(peopleBtn);
     expect(screen.queryByText('Secret plan')).toBeNull();
   });
 
   it('navigates immediately on Leave when no personal state exists', async () => {
     await act(async () => {
-      render(<RoomScreen roomSlug="library" />);
+      render(fixtureRoom('library','member'));
     });
 
     const leaveBtn = screen.getByRole('button', { name: 'Leave room' });
     fireEvent.click(leaveBtn);
 
     expect(pushSpy).toHaveBeenCalledWith('/studyroom');
     expect(screen.queryByText('Leave this room?')).toBeNull();
   });
diff --git a/src/client/screens/dashboard/studyroom/__tests__/usePomodoro.durable.test.tsx b/src/client/screens/dashboard/studyroom/__tests__/usePomodoro.durable.test.tsx
--- a/src/client/screens/dashboard/studyroom/__tests__/usePomodoro.durable.test.tsx
+++ b/src/client/screens/dashboard/studyroom/__tests__/usePomodoro.durable.test.tsx
@@ -4,16 +4,17 @@ import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
 import { usePomodoro } from '../hooks/usePomodoro';
 import { studyRoomRepository, type StudySessionDTO } from '@/src/client/repositories/studyRoomRepository';
 import { pomodoroStorageAdapter } from '@/src/client/repositories/pomodoroStorageAdapter';
 
 let mockRealtimeCallback: ((data: unknown) => void) | null = null;
 
 vi.mock('@/src/client/realtime', () => ({
   useRealtime: () => ({
+    status: 'connected',
     subscribe: vi.fn((_channel: string, cb: (data: unknown) => void) => {
       mockRealtimeCallback = cb;
       return () => {
         mockRealtimeCallback = null;
       };
     }),
   }),
 }));
diff --git a/src/client/screens/dashboard/studyroom/__tests__/useRoomOrchestration.test.tsx b/src/client/screens/dashboard/studyroom/__tests__/useRoomOrchestration.test.tsx
--- a/src/client/screens/dashboard/studyroom/__tests__/useRoomOrchestration.test.tsx
+++ b/src/client/screens/dashboard/studyroom/__tests__/useRoomOrchestration.test.tsx
@@ -44,32 +44,32 @@ describe('useRoomOrchestration hook (Phase 5)', () => {
     const tab1 = getTabId();
     expect(tab1).toMatch(/^tab-/);
     const tab2 = getTabId();
     expect(tab2).toBe(tab1);
     expect(window.sessionStorage.getItem('studyroom_tab_id')).toBe(tab1);
   });
 
   it('starts in loading and reaches joined state upon valid bootstrap and join', async () => {
-    vi.spyOn(studyRoomRepository, 'getBootstrap').mockResolvedValueOnce({
+    vi.spyOn(studyRoomRepository, 'getBootstrap').mockResolvedValue({
       room: {
         id: 'room-1',
         slug: 'lofi-cafe',
         title: 'Lo-Fi Cafe',
         description: 'Cozy study spot',
         status: 'OPEN',
         capacity: 25,
         onlineCount: 2,
         ownerId: 'host-1',
         ownerName: 'Host',
         createdAt: new Date().toISOString(),
       },
       viewer: {
         userId: 'test-user-1',
-        isJoined: false,
+        isJoined: true,
         role: 'MEMBER',
       },
       capabilities: {
         canJoin: true,
         canControlEnvironment: false,
         canManageParticipants: false,
         canEditRoom: false,
         canTransferOwnership: false,
@@ -105,17 +105,17 @@ describe('useRoomOrchestration hook (Phase 5)', () => {
     expect(result.current.generation).toBe(42);
     expect(result.current.bootstrap?.room?.id).toBe('room-1');
     expect(result.current.roomDefinition.title).toBe('Lo-Fi Cafe');
     expect(result.current.viewer.userId).toBe('test-user-1');
     expect(result.current.error).toBeNull();
   });
 
   it('transitions to denied when capabilities.canJoin is false', async () => {
-    vi.spyOn(studyRoomRepository, 'getBootstrap').mockResolvedValueOnce({
+    vi.spyOn(studyRoomRepository, 'getBootstrap').mockResolvedValue({
       room: {
         id: 'room-full',
         slug: 'full-room',
         title: 'Full Room',
         status: 'OPEN',
         capacity: 25,
         onlineCount: 25,
         ownerId: 'host-1',
@@ -165,17 +165,17 @@ describe('useRoomOrchestration hook (Phase 5)', () => {
 
     expect(result.current.state).toBe('unavailable');
     expect(result.current.error).toBe('Room not found');
   });
 
   it('detects 409 stale_generation on renewal and switches to switched_elsewhere', async () => {
     vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
 
-    vi.spyOn(studyRoomRepository, 'getBootstrap').mockResolvedValueOnce({
+    vi.spyOn(studyRoomRepository, 'getBootstrap').mockResolvedValue({
       room: {
         id: 'room-active',
         slug: 'active-room',
         title: 'Active Room',
         status: 'OPEN',
         capacity: 25,
         onlineCount: 1,
         ownerId: 'host-1',
@@ -234,17 +234,17 @@ describe('useRoomOrchestration hook (Phase 5)', () => {
       vi.advanceTimersByTime(30000);
       await Promise.resolve();
     });
 
     expect(result.current.state).toBe('switched_elsewhere');
   });
 
   it('leave(false) calls leaveRoom with global=false and cleans up state', async () => {
-    vi.spyOn(studyRoomRepository, 'getBootstrap').mockResolvedValueOnce({
+    vi.spyOn(studyRoomRepository, 'getBootstrap').mockResolvedValue({
       room: { id: 'room-1', slug: 'room-1', title: 'Room 1', status: 'OPEN', capacity: 25, onlineCount: 1, ownerId: 'h-1', createdAt: '' },
       viewer: { userId: 'u-1', isJoined: true },
       capabilities: { canJoin: true, canControlEnvironment: false, canManageParticipants: false, canEditRoom: false, canTransferOwnership: false, canDeleteRoom: false, isOwner: false },
     } as any);
 
     vi.spyOn(studyRoomRepository, 'joinRoom').mockResolvedValueOnce({
       success: true,
       roomId: 'room-1',
@@ -267,23 +267,23 @@ describe('useRoomOrchestration hook (Phase 5)', () => {
     });
 
     expect(result.current.state).toBe('joined');
 
     await act(async () => {
       await result.current.leave(false);
     });
 
-    expect(leaveSpy).toHaveBeenCalledWith('room-1', expect.any(String), false);
+    expect(leaveSpy).toHaveBeenCalledWith('room-1', expect.any(String), false, 1);
     expect(result.current.state).toBe('unavailable');
     expect(result.current.generation).toBeNull();
   });
 
   it('leave(true) calls leaveRoom with global=true', async () => {
-    vi.spyOn(studyRoomRepository, 'getBootstrap').mockResolvedValueOnce({
+    vi.spyOn(studyRoomRepository, 'getBootstrap').mockResolvedValue({
       room: { id: 'room-2', slug: 'room-2', title: 'Room 2', status: 'OPEN', capacity: 25, onlineCount: 1, ownerId: 'h-1', createdAt: '' },
       viewer: { userId: 'u-1', isJoined: true },
       capabilities: { canJoin: true, canControlEnvironment: false, canManageParticipants: false, canEditRoom: false, canTransferOwnership: false, canDeleteRoom: false, isOwner: false },
     } as any);
 
     vi.spyOn(studyRoomRepository, 'joinRoom').mockResolvedValueOnce({
       success: true,
       roomId: 'room-2',
@@ -304,21 +304,21 @@ describe('useRoomOrchestration hook (Phase 5)', () => {
     await act(async () => {
       await Promise.resolve();
     });
 
     await act(async () => {
       await result.current.leave(true);
     });
 
-    expect(leaveSpy).toHaveBeenCalledWith('room-2', expect.any(String), true);
+    expect(leaveSpy).toHaveBeenCalledWith('room-2', expect.any(String), true, 2);
   });
 
   it('refreshBootstrap fetches updated room and calls realtime.refreshManifest()', async () => {
-    vi.spyOn(studyRoomRepository, 'getBootstrap').mockResolvedValueOnce({
+    vi.spyOn(studyRoomRepository, 'getBootstrap').mockResolvedValue({
       room: { id: 'room-3', slug: 'room-3', title: 'Room 3', status: 'OPEN', capacity: 25, onlineCount: 1, ownerId: 'h-1', createdAt: '' },
       viewer: { userId: 'u-1', isJoined: true },
       capabilities: { canJoin: true, canControlEnvironment: false, canManageParticipants: false, canEditRoom: false, canTransferOwnership: false, canDeleteRoom: false, isOwner: false },
     } as any);
 
     vi.spyOn(studyRoomRepository, 'joinRoom').mockResolvedValueOnce({
       success: true,
       roomId: 'room-3',
@@ -330,33 +330,33 @@ describe('useRoomOrchestration hook (Phase 5)', () => {
     const { result } = renderHook(() =>
       useRoomOrchestration({ roomSlug: 'room-3' })
     );
 
     await act(async () => {
       await Promise.resolve();
     });
 
-    vi.spyOn(studyRoomRepository, 'getBootstrap').mockResolvedValueOnce({
+    vi.spyOn(studyRoomRepository, 'getBootstrap').mockResolvedValue({
       room: { id: 'room-3', slug: 'room-3', title: 'Updated Title', status: 'OPEN', capacity: 25, onlineCount: 1, ownerId: 'h-1', createdAt: '' },
       viewer: { userId: 'u-1', isJoined: true },
       capabilities: { canJoin: true, canControlEnvironment: false, canManageParticipants: false, canEditRoom: false, canTransferOwnership: false, canDeleteRoom: false, isOwner: false },
     } as any);
 
     await act(async () => {
       await result.current.refreshBootstrap();
     });
 
     expect(mockRefreshManifest).toHaveBeenCalled();
   });
 
   it('subscribes to room realtime channel and handles room.participant.left KICKED', async () => {
-    vi.spyOn(studyRoomRepository, 'getBootstrap').mockResolvedValueOnce({
+    vi.spyOn(studyRoomRepository, 'getBootstrap').mockResolvedValue({
       room: { id: 'room-kick', slug: 'room-kick', title: 'Room Kick', status: 'OPEN', capacity: 25, onlineCount: 2, ownerId: 'h-1', createdAt: '', streamGeneration: 2 },
-      viewer: { userId: 'test-user-1', isJoined: false, role: 'MEMBER' },
+      viewer: { userId: 'test-user-1', isJoined: true, role: 'MEMBER' },
       capabilities: { canJoin: true, canControlEnvironment: false, canManageParticipants: false, canEditRoom: false, canTransferOwnership: false, canDeleteRoom: false, isOwner: false },
     } as any);
 
     vi.spyOn(studyRoomRepository, 'joinRoom').mockResolvedValueOnce({
       success: true,
       roomId: 'room-kick',
       generation: 1,
       isSwitch: false,
@@ -380,40 +380,33 @@ describe('useRoomOrchestration hook (Phase 5)', () => {
         type: 'room.participant.left',
         payload: { userId: 'test-user-1', reason: 'KICKED' },
       });
     });
 
     expect(result.current.state).toBe('denied');
   });
 
-  it('handles gap in sequence numbers by calling syncRoomEvents catchup', async () => {
-    vi.spyOn(studyRoomRepository, 'getBootstrap').mockResolvedValueOnce({
+  it('handles gap in sequence numbers by refreshing the authoritative snapshot', async () => {
+    vi.spyOn(studyRoomRepository, 'getBootstrap').mockResolvedValue({
       room: { id: 'room-sync', slug: 'room-sync', title: 'Room Sync', status: 'OPEN', capacity: 25, onlineCount: 2, ownerId: 'h-1', createdAt: '', streamGeneration: 1 },
-      viewer: { userId: 'test-user-1', isJoined: false, role: 'MEMBER' },
+      viewer: { userId: 'test-user-1', isJoined: true, role: 'MEMBER' },
       capabilities: { canJoin: true, canControlEnvironment: false, canManageParticipants: false, canEditRoom: false, canTransferOwnership: false, canDeleteRoom: false, isOwner: false },
     } as any);
 
     vi.spyOn(studyRoomRepository, 'joinRoom').mockResolvedValueOnce({
       success: true,
       roomId: 'room-sync',
       generation: 1,
       isSwitch: false,
       lease: { leaseId: 'l-s', tabId: getTabId(), expiresAt: '' },
     });
 
-    const syncSpy = vi.spyOn(studyRoomRepository, 'syncRoomEvents').mockResolvedValueOnce({
-      mode: 'DELTA',
-      roomId: 'room-sync',
-      streamId: 's-1',
-      currentSequence: 10,
-      generation: 1,
-      events: [],
-      serverTime: new Date().toISOString(),
-    });
+    const syncSpy = vi.fn();
+    window.addEventListener('studyroom:resync',syncSpy);
 
     const { result } = renderHook(() =>
       useRoomOrchestration({ roomSlug: 'room-sync' })
     );
 
     await act(async () => {
       await Promise.resolve();
     });
@@ -435,11 +428,12 @@ describe('useRoomOrchestration hook (Phase 5)', () => {
     await act(async () => {
       lastPublicationHandler?.({
         sequence: 5,
         type: 'room.roster.changed',
         payload: { onlineCount: 4 },
       });
     });
 
-    expect(syncSpy).toHaveBeenCalledWith('room-sync', { clientSequence: 1 });
+    expect(syncSpy).toHaveBeenCalledTimes(1);
+    window.removeEventListener('studyroom:resync',syncSpy);
   });
 });
diff --git a/src/client/screens/dashboard/studyroom/__tests__/useRoomSprint.test.tsx b/src/client/screens/dashboard/studyroom/__tests__/useRoomSprint.test.tsx
--- a/src/client/screens/dashboard/studyroom/__tests__/useRoomSprint.test.tsx
+++ b/src/client/screens/dashboard/studyroom/__tests__/useRoomSprint.test.tsx
@@ -10,17 +10,17 @@ vi.mock('next-auth/react', () => ({
   useSession: () => ({
     data: { user: { id: 'user-1', name: 'Alice' } },
     status: 'authenticated',
   }),
 }));
 
 vi.mock('@/src/client/realtime', () => ({
   useRealtime: vi.fn(() => ({
-    subscribe: mockSubscribe,
+    status:'connected',subscribe: mockSubscribe,
   })),
 }));
 
 vi.mock('@/src/client/repositories/studyRoomRepository', () => ({
   studyRoomRepository: {
     getRoomSprint: vi.fn(),
     startRoomSprint: vi.fn(),
     pauseRoomSprint: vi.fn(),
diff --git a/src/server/domain/messaging/interaction.service.ts b/src/server/domain/messaging/interaction.service.ts
--- a/src/server/domain/messaging/interaction.service.ts
+++ b/src/server/domain/messaging/interaction.service.ts
@@ -1,8 +1,9 @@
+import { hasRoomAccess } from '@/src/server/domain/studyroom/room-access';
 import 'server-only';
 import { randomUUID } from 'node:crypto';
 import { prisma } from '@/src/server/infrastructure/db/postgres/client';
 import {
   type CanonicalMessagePayload,
   type ReactionSummary,
   type UpdateReadWatermarkInput,
   type UpdateChannelPreferencesInput,
@@ -90,20 +91,17 @@ export const interactionService = {
         }
       }
     } else if (channel.conversation) {
       const isParticipant = channel.conversation.participants.some((p) => p.userId === userId);
       if (!isParticipant) {
         throw new MessagingForbiddenError('Not an active participant in this conversation');
       }
     } else if (channel.studyRoom) {
-      const participant = await prisma.roomParticipant.findUnique({
-        where: { userId },
-      });
-      if (!participant || participant.studyRoomId !== channel.studyRoom.id) {
+      if (!(await hasRoomAccess(channel.studyRoom.id,userId))) {
         throw new MessagingForbiddenError('Not an active participant in this study room');
       }
     }
 
     return channel;
   },
 
   /**
diff --git a/src/server/domain/messaging/message.service.ts b/src/server/domain/messaging/message.service.ts
--- a/src/server/domain/messaging/message.service.ts
+++ b/src/server/domain/messaging/message.service.ts
@@ -1,8 +1,9 @@
+import { hasRoomAccess } from '@/src/server/domain/studyroom/room-access';
 import { prisma } from '@/src/server/infrastructure/db/postgres/client';
 import { isSharedGuestAccount } from '@/src/server/infrastructure/auth/guestAccount';
 import { messagingRepo } from '@/src/server/infrastructure/db/postgres/repositories/messaging.repo';
 import { notificationService } from '../notifications/notification.service';
 import { sanitizeMessageContent } from './sanitizer';
 import {
   type SendMessageInput,
   type SendMessageResult,
@@ -90,35 +91,17 @@ export const messageService = {
             },
           },
         });
         if (!membership) {
           throw new MessagingForbiddenError('Cohort enrollment required to chat in this room');
         }
       }
 
-      const activeLease = await prisma.roomLease.findFirst({
-        where: {
-          studyRoomId: channel.studyRoom.id,
-          userId: authorId,
-          expiresAt: { gt: new Date() },
-        },
-      });
-
-      if (!activeLease) {
-        const participant = await prisma.roomParticipant.findFirst({
-          where: {
-            studyRoomId: channel.studyRoom.id,
-            userId: authorId,
-          },
-        });
-        if (!participant) {
-          throw new MessagingForbiddenError('Not an active participant in this study room');
-        }
-      }
+      if (!(await hasRoomAccess(channel.studyRoom.id,authorId))) throw new MessagingForbiddenError('Active room lease required');
     } else {
       throw new MessagingForbiddenError('Channel does not have a valid parent context');
     }
 
     // 4. Validate replyTo belongs to the same channel if specified
     if (replyToId) {
       const parentMessage = await prisma.message.findUnique({
         where: { id: replyToId },
@@ -171,20 +154,17 @@ export const messageService = {
               });
               hasAccess = Boolean(m);
             }
           } else if (channel.conversation) {
             hasAccess = channel.conversation.participants.some(
               (p) => p.userId === u.id && p.leftAt === null
             );
           } else if (channel.studyRoom) {
-            const p = await prisma.roomParticipant.findFirst({
-              where: { studyRoomId: channel.studyRoom.id, userId: u.id },
-            });
-            hasAccess = Boolean(p);
+            hasAccess = await hasRoomAccess(channel.studyRoom.id,u.id);
           }
 
           if (hasAccess) {
             const scopeType: 'channel' | 'conversation' | 'studyroom' = channel.community
               ? 'channel'
               : channel.conversation
               ? 'conversation'
               : 'studyroom';
diff --git a/src/server/domain/messaging/search.service.ts b/src/server/domain/messaging/search.service.ts
--- a/src/server/domain/messaging/search.service.ts
+++ b/src/server/domain/messaging/search.service.ts
@@ -1,8 +1,9 @@
+import { hasRoomAccess } from '@/src/server/domain/studyroom/room-access';
 import 'server-only';
 import { prisma } from '@/src/server/infrastructure/db/postgres/client';
 import { MessagingForbiddenError, MessagingNotFoundError } from './contracts';
 
 export interface SearchMessageResult {
   id: string;
   channelId: string;
   channelName: string;
@@ -95,20 +96,17 @@ export const searchService = {
         }
       } else if (channel.conversation) {
         const participant = channel.conversation.participants[0];
         if (!participant) {
           throw new MessagingForbiddenError('Not an active participant in this conversation');
         }
         minSequence = participant.historyVisibleFromSequence;
       } else if (channel.studyRoom) {
-        const participant = await prisma.roomParticipant.findFirst({
-          where: { studyRoomId: channel.studyRoom.id, userId },
-        });
-        if (!participant) {
+        if (!(await hasRoomAccess(channel.studyRoom.id,userId))) {
           throw new MessagingForbiddenError('Not an active participant in this study room');
         }
       } else {
         throw new MessagingForbiddenError('Channel does not have a valid parent context');
       }
 
       const rows = await prisma.message.findMany({
         where: {
@@ -204,20 +202,20 @@ export const searchService = {
           minSequence: p.historyVisibleFromSequence,
         });
       }
     }
 
     // C. Current Study Room
     const currentStudyRoom = await prisma.roomParticipant.findFirst({
       where: { userId },
-      select: { room: { select: { channel: { select: { id: true } } } } },
+      select: { studyRoomId: true, room: { select: { channel: { select: { id: true } } } } },
     });
 
-    if (currentStudyRoom?.room?.channel) {
+    if (currentStudyRoom?.room?.channel && await hasRoomAccess(currentStudyRoom.studyRoomId,userId)) {
       authorizedFilters.push({
         channelId: currentStudyRoom.room.channel.id,
         minSequence: 0,
       });
     }
 
     if (authorizedFilters.length === 0) {
       return { messages: [], nextCursor: null };
diff --git a/src/server/domain/messaging/__tests__/username-dm-studyroom.e2e.test.ts b/src/server/domain/messaging/__tests__/username-dm-studyroom.e2e.test.ts
--- a/src/server/domain/messaging/__tests__/username-dm-studyroom.e2e.test.ts
+++ b/src/server/domain/messaging/__tests__/username-dm-studyroom.e2e.test.ts
@@ -1,11 +1,16 @@
 /* eslint-disable @typescript-eslint/no-explicit-any */
 import { describe, it, expect, vi, beforeEach } from 'vitest';
 
+// Database doubles execute serially. The PostgreSQL gate covers real lock interleavings.
+vi.mock('@/src/server/domain/studyroom/room-access', async (load) => ({
+  ...await load<typeof import('@/src/server/domain/studyroom/room-access')>(),
+  lockRooms: vi.fn(), lockUser: vi.fn(),
+}));
 vi.mock('server-only', () => ({}));
 
 // In-memory relational database state for multi-user integration testing
 let users: any[] = [];
 let rooms: any[] = [];
 let participants: any[] = [];
 let leases: any[] = [];
 let conversations: any[] = [];
@@ -76,16 +81,17 @@ vi.mock('@/src/server/infrastructure/db/postgres/client', () => {
           return u;
         }),
       },
       userBlock: {
         findMany: vi.fn(async () => userBlocks),
         findFirst: vi.fn(async () => null),
       },
       studyRoom: {
+      findUniqueOrThrow: async ({where}:any)=>prisma.studyRoom.findUnique({where}),
         create: vi.fn(async ({ data }: any) => {
           const newRoom = {
             id: `room-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
             slug: data.slug || 'alpha-study-room',
             title: data.title,
             name: data.title,
             description: data.description || '',
             ownerId: data.ownerId,
@@ -142,16 +148,17 @@ vi.mock('@/src/server/infrastructure/db/postgres/client', () => {
           let p = participants.find((x) => x.userId === where.userId);
           if (p) {
             Object.assign(p, update);
           } else {
             p = {
               id: `part-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
               studyRoomId: create.studyRoomId,
               userId: create.userId,
+              publicGoal:create.publicGoal,
               role: create.role || 'STUDENT',
               joinedAt: new Date(),
               user: users.find((u) => u.id === create.userId),
             };
             participants.push(p);
           }
           return p;
         }),
diff --git a/src/server/domain/studyroom/environment.service.ts b/src/server/domain/studyroom/environment.service.ts
--- a/src/server/domain/studyroom/environment.service.ts
+++ b/src/server/domain/studyroom/environment.service.ts
@@ -1,9 +1,10 @@
 import 'server-only';
+import { hasRoomAccess, lockRooms } from './room-access';
 import { randomUUID } from 'crypto';
 import type { Prisma } from '@/generated/prisma/client';
 import { prisma } from '@/src/server/infrastructure/db/postgres/client';
 import {
   type RoomEnvironmentSnapshot,
   type UpdateEnvironmentInput,
 } from './sprint.contracts';
 import { sprintService } from './sprint.service';
@@ -186,16 +187,18 @@ export const environmentService = {
       }
       if (!ALLOWED_SCENES.has(trimmed)) {
         throw new MessagingValidationError(`Scene '${trimmed}' is not authorized.`);
       }
       validatedSceneId = trimmed;
     }
 
     return await prisma.$transaction(async (tx) => {
+      await lockRooms(tx, [roomId]);
+      if (!(await hasRoomAccess(roomId,userId,true,tx))) throw new MessagingForbiddenError('Control revoked');
       const room = await tx.studyRoom.findUnique({
         where: { id: roomId },
       });
       if (!room) {
         throw new MessagingNotFoundError('Study room not found');
       }
 
       const current = await tx.roomEnvironment.findUnique({
diff --git a/src/server/domain/studyroom/room-access.ts b/src/server/domain/studyroom/room-access.ts
new file mode 100644
--- /dev/null
+++ b/src/server/domain/studyroom/room-access.ts
@@ -0,0 +1,27 @@
+import 'server-only';
+import type { Prisma } from '@/generated/prisma/client';
+import { prisma } from '@/src/server/infrastructure/db/postgres/client';
+import { studyroomPolicy } from './studyroom.policy';
+
+export async function lockUser(tx: Prisma.TransactionClient, id: string) {
+  await tx.$queryRaw`SELECT id FROM users WHERE id = ${id} FOR UPDATE`;
+}
+
+export async function lockRooms(tx: Prisma.TransactionClient, ids: string[]) {
+  for (const id of [...new Set(ids)].sort()) {
+    await tx.$queryRaw`SELECT id FROM study_rooms WHERE id = ${id} FOR UPDATE`;
+  }
+}
+
+export async function hasRoomAccess(roomId: string, userId: string, control = false, client: Prisma.TransactionClient = prisma) {
+  const room = await client.studyRoom.findUnique({ where: { id: roomId } });
+  if (!room) return false;
+  const lease = await client.roomLease.findFirst({
+    where: { studyRoomId: roomId, userId, expiresAt: { gt: new Date() } },
+    select: { id: true },
+  });
+  if (!lease) return false;
+  if (!control) return (await studyroomPolicy.resolveRoomEligibility(room,userId,true,client)).eligible;
+  const capabilities = await studyroomPolicy.evaluateCapabilities(room, userId, undefined, true,client);
+  return capabilities.canJoin && (!control || capabilities.canControlEnvironment);
+}
diff --git a/src/server/domain/studyroom/room-change.ts b/src/server/domain/studyroom/room-change.ts
new file mode 100644
--- /dev/null
+++ b/src/server/domain/studyroom/room-change.ts
@@ -0,0 +1,11 @@
+import { randomUUID } from 'node:crypto';
+import type { Prisma } from '@/generated/prisma/client';
+
+export async function emitRoomChange(tx: Prisma.TransactionClient, roomId: string, type: string, payload: Prisma.InputJsonObject) {
+  const stream = await tx.realtimeStream.upsert({where:{studyRoomId:roomId},
+    create:{studyRoomId:roomId,generation:1,eventCounter:1},update:{eventCounter:{increment:1}}});
+  const eventId = randomUUID();
+  await tx.realtimeEvent.create({data:{eventId,streamId:stream.id,sequence:stream.eventCounter,
+    generation:stream.generation,schemaVersion:1,type,payload}});
+  await tx.realtimeDelivery.create({data:{eventId,destination:`room:${roomId}:g${stream.generation}`,status:'PENDING'}});
+}
diff --git a/src/server/domain/studyroom/room-discovery.service.ts b/src/server/domain/studyroom/room-discovery.service.ts
--- a/src/server/domain/studyroom/room-discovery.service.ts
+++ b/src/server/domain/studyroom/room-discovery.service.ts
@@ -24,16 +24,19 @@ export const roomDiscoveryService = {
       cohortId,
       tag,
       language,
       availableOnly = false,
       cursor,
       limit = 12,
     } = query;
 
+    if (!['discover', 'cohorts', 'my-rooms', 'recent'].includes(tab)) {
+      return { rooms: [], nextCursor: null, totalEstimatedCount: 0 };
+    }
     const safeLimit = Math.min(Math.max(limit, 1), 50);
 
     // 1. Resolve user's accessible cohort IDs
     let userCohortIds: string[] = [];
     if (userId) {
       const memberships =
         (await prisma.cohortMember.findMany({
           where: { userId },
@@ -44,18 +47,16 @@ export const roomDiscoveryService = {
 
     // 2. Build Where Clauses based on Tab and Visibility
     const whereConditions: Prisma.StudyRoomWhereInput[] = [];
 
     // Exclude archived rooms from general discovery
     if (tab !== 'my-rooms') {
       whereConditions.push({ status: 'OPEN' });
       whereConditions.push({ listing: 'LISTED' });
-    } else {
-      whereConditions.push({ status: { not: 'ARCHIVED' } });
     }
 
     // Tab-specific scoping
     if (tab === 'discover') {
       if (userCohortIds.length > 0) {
         whereConditions.push({
           OR: [
             { cohortId: null },
@@ -80,33 +81,19 @@ export const roomDiscoveryService = {
           { controllers: { some: { userId } } },
         ],
       });
     } else if (tab === 'recent') {
       if (!userId) {
         return { rooms: [], nextCursor: null, totalEstimatedCount: 0 };
       }
 
-      // Find rooms where user has had leases or participant presence
-      const recentPresence = await prisma.roomParticipant.findMany({
-        where: { userId },
-        select: { studyRoomId: true },
-        take: 50,
-      });
-
-      const recentLeases = await prisma.roomLease.findMany({
-        where: { userId },
-        select: { studyRoomId: true },
-        take: 50,
-      });
-
-      const recentRoomIds = Array.from(
-        new Set([...recentPresence.map((p) => p.studyRoomId), ...recentLeases.map((l) => l.studyRoomId)])
-      );
-
+      const visits = await prisma.roomAuditLog.findMany({where:{actorId:userId,action:{in:['ROOM_JOIN','ROOM_SWITCH']}},
+        orderBy:{createdAt:'desc'},distinct:['studyRoomId'],take:50,select:{studyRoomId:true}});
+      const recentRoomIds = visits.map(visit => visit.studyRoomId);
       if (recentRoomIds.length === 0) {
         return { rooms: [], nextCursor: null, totalEstimatedCount: 0 };
       }
 
       whereConditions.push({ id: { in: recentRoomIds } });
       if (userCohortIds.length > 0) {
         whereConditions.push({
           OR: [
@@ -150,43 +137,43 @@ export const roomDiscoveryService = {
       whereConditions.push({ tags: { has: tag.trim() } });
     }
 
     // 6. Language Filter
     if (language && language.trim()) {
       whereConditions.push({ language: language.trim().toLowerCase() });
     }
 
+    if (availableOnly) whereConditions.push({onlineCount:{lt:prisma.studyRoom.fields.capacity}});
     const where = whereConditions.length > 0 ? { AND: whereConditions } : {};
 
     // 7. Query Database with deterministic ordering
     const rooms = await prisma.studyRoom.findMany({
       where,
       take: safeLimit + 1,
       skip: cursor ? 1 : 0,
       cursor: cursor ? { id: cursor } : undefined,
       orderBy: [
-        { onlineCount: 'desc' },
         { createdAt: 'desc' },
         { id: 'asc' },
       ],
       include: {
         owner: {
           select: { id: true, name: true, username: true, image: true },
         },
         cohort: {
           select: { id: true, title: true },
         },
       },
     });
 
     let nextCursor: string | null = null;
     if (rooms.length > safeLimit) {
-      const nextItem = rooms.pop();
-      nextCursor = nextItem?.id || null;
+      rooms.pop();
+      nextCursor = rooms.at(-1)?.id || null;
     }
 
     // 8. Transform to Safe DTO
     let results: StudyRoomCardDTO[] = rooms.map((r) => ({
       id: r.id,
       slug: r.slug || r.id,
       title: r.title,
       description: r.description,
diff --git a/src/server/domain/studyroom/room-governance.service.ts b/src/server/domain/studyroom/room-governance.service.ts
--- a/src/server/domain/studyroom/room-governance.service.ts
+++ b/src/server/domain/studyroom/room-governance.service.ts
@@ -1,9 +1,11 @@
 import 'server-only';
+import { lockRooms, lockUser } from './room-access';
+import { emitRoomChange } from './room-change';
 import { randomUUID } from 'crypto';
 import { prisma } from '@/src/server/infrastructure/db/postgres/client';
 import { studyroomPolicy, type RoomEntity } from './studyroom.policy';
 import {
   type DelegatedRoomRole,
   type RoomControllerDTO,
   type RoomRestrictionDTO,
   type OwnershipTransferDTO,
@@ -100,16 +102,20 @@ export const roomGovernanceService = {
         where: { cohortId_userId: { cohortId: room.cohortId, userId: targetUserId } },
       });
       if (!membership) {
         throw new RoomValidationError('Target user is not enrolled in the cohort');
       }
     }
 
     await prisma.$transaction(async (tx) => {
+      await lockRooms(tx,[roomId]);
+      const locked = await tx.studyRoom.findUniqueOrThrow({where:{id:roomId}});
+      if (locked.ownerId !== room.ownerId) throw new RoomConflictError();
+      await emitRoomChange(tx,roomId,'room.governance.changed',{roomId});
       await tx.roomController.upsert({
         where: {
           studyRoomId_userId: {
             studyRoomId: roomId,
             userId: targetUserId,
           },
         },
         create: {
@@ -150,16 +156,20 @@ export const roomGovernanceService = {
     }
 
     const roleRes = await studyroomPolicy.resolveUserRoomRole(room as unknown as RoomEntity, actorUserId);
     if (!roleRes.isOwner && !roleRes.isPlatformAdmin) {
       throw new RoomForbiddenError('Only room owner can revoke delegated roles');
     }
 
     await prisma.$transaction(async (tx) => {
+      await lockRooms(tx,[roomId]);
+      const locked = await tx.studyRoom.findUniqueOrThrow({where:{id:roomId}});
+      if (locked.ownerId !== room.ownerId) throw new RoomConflictError();
+      await emitRoomChange(tx,roomId,'room.governance.changed',{roomId});
       await tx.roomController.deleteMany({
         where: {
           studyRoomId: roomId,
           userId: targetUserId,
         },
       });
 
       await tx.roomAuditLog.create({
@@ -188,22 +198,28 @@ export const roomGovernanceService = {
 
     if (!room) {
       throw new RoomNotFoundError();
     }
 
     const actorRoleRes = await studyroomPolicy.resolveUserRoomRole(room as unknown as RoomEntity, actorUserId);
     const targetRoleRes = await studyroomPolicy.resolveUserRoomRole(room as unknown as RoomEntity, targetUserId);
 
-    studyroomPolicy.assertTargetHierarchy(actorRoleRes.role, targetRoleRes.role);
+    studyroomPolicy.assertTargetHierarchy(actorRoleRes.isPlatformAdmin ? 'OWNER' : actorRoleRes.role, targetRoleRes.role);
 
     const now = new Date();
     const cooldownExpiresAt = new Date(now.getTime() + STUDY_ROOM_LIMITS.KICK_COOLDOWN_MS);
 
     await prisma.$transaction(async (tx) => {
+      await lockUser(tx,targetUserId);
+      await lockRooms(tx,[roomId]);
+      const currentRoom = await tx.studyRoom.findUniqueOrThrow({where:{id:roomId}});
+      const currentActor = await studyroomPolicy.resolveUserRoomRole(currentRoom,actorUserId,undefined,tx);
+      const currentTarget = await studyroomPolicy.resolveUserRoomRole(currentRoom,targetUserId,undefined,tx);
+      studyroomPolicy.assertTargetHierarchy(currentActor.isPlatformAdmin ? 'OWNER' : currentActor.role,currentTarget.role);
       // 1. Invalidate active leases and participant presence
       await tx.roomLease.deleteMany({
         where: { studyRoomId: roomId, userId: targetUserId },
       });
       await tx.roomParticipant.deleteMany({
         where: { studyRoomId: roomId, userId: targetUserId },
       });
 
@@ -315,22 +331,28 @@ export const roomGovernanceService = {
 
     if (!room) {
       throw new RoomNotFoundError();
     }
 
     const actorRoleRes = await studyroomPolicy.resolveUserRoomRole(room as unknown as RoomEntity, actorUserId);
     const targetRoleRes = await studyroomPolicy.resolveUserRoomRole(room as unknown as RoomEntity, targetUserId);
 
-    studyroomPolicy.assertTargetHierarchy(actorRoleRes.role, targetRoleRes.role);
+    studyroomPolicy.assertTargetHierarchy(actorRoleRes.isPlatformAdmin ? 'OWNER' : actorRoleRes.role, targetRoleRes.role);
 
     const now = new Date();
     const expiresAt = durationMinutes ? new Date(now.getTime() + durationMinutes * 60 * 1000) : null;
 
     await prisma.$transaction(async (tx) => {
+      await lockUser(tx,targetUserId);
+      await lockRooms(tx,[roomId]);
+      const currentRoom = await tx.studyRoom.findUniqueOrThrow({where:{id:roomId}});
+      const currentActor = await studyroomPolicy.resolveUserRoomRole(currentRoom,actorUserId,undefined,tx);
+      const currentTarget = await studyroomPolicy.resolveUserRoomRole(currentRoom,targetUserId,undefined,tx);
+      studyroomPolicy.assertTargetHierarchy(currentActor.isPlatformAdmin ? 'OWNER' : currentActor.role,currentTarget.role);
       // 1. Invalidate leases and presence
       await tx.roomLease.deleteMany({
         where: { studyRoomId: roomId, userId: targetUserId },
       });
       await tx.roomParticipant.deleteMany({
         where: { studyRoomId: roomId, userId: targetUserId },
       });
 
@@ -547,16 +569,20 @@ export const roomGovernanceService = {
         throw new RoomValidationError('Recipient must be enrolled in the cohort');
       }
     }
 
     const now = new Date();
     const expiresAt = new Date(now.getTime() + STUDY_ROOM_LIMITS.TRANSFER_EXPIRY_MS);
 
     const transfer = await prisma.$transaction(async (tx) => {
+      await lockRooms(tx,[roomId]);
+      const locked = await tx.studyRoom.findUniqueOrThrow({where:{id:roomId}});
+      if (locked.ownerId !== actorUserId || locked.revision !== expectedRevision) throw new RoomConflictError();
+      await emitRoomChange(tx,roomId,'room.governance.changed',{roomId});
       // Cancel any prior pending transfer for this room
       await tx.roomOwnershipTransfer.updateMany({
         where: {
           studyRoomId: roomId,
           status: 'PENDING',
         },
         data: {
           status: 'CANCELLED',
@@ -629,18 +655,18 @@ export const roomGovernanceService = {
     }
 
     if (transfer.status !== 'PENDING') {
       throw new RoomValidationError(`Transfer proposal is ${transfer.status}`);
     }
 
     const now = new Date();
     if (transfer.expiresAt <= now) {
-      await prisma.roomOwnershipTransfer.update({
-        where: { id: transferId },
+      await prisma.roomOwnershipTransfer.updateMany({
+        where: { id: transferId, status: 'PENDING' },
         data: { status: 'EXPIRED' },
       });
       throw new RoomConflictError('Transfer proposal has expired');
     }
 
     if (room.revision !== transfer.expectedRevision) {
       throw new RoomConflictError('Room revision changed since transfer was proposed');
     }
@@ -651,16 +677,21 @@ export const roomGovernanceService = {
         where: { cohortId_userId: { cohortId: room.cohortId, userId: recipientUserId } },
       });
       if (!membership) {
         throw new RoomForbiddenError('Recipient is no longer enrolled in the cohort');
       }
     }
 
     await prisma.$transaction(async (tx) => {
+      await lockRooms(tx,[roomId]);
+      const locked = await tx.studyRoom.findUniqueOrThrow({where:{id:roomId}});
+      const pending = await tx.roomOwnershipTransfer.findUnique({where:{id:transferId}});
+      if (locked.ownerId !== transfer.senderId || locked.revision !== transfer.expectedRevision || pending?.status !== 'PENDING' || pending.expiresAt <= new Date()) throw new RoomConflictError();
+      await emitRoomChange(tx,roomId,'room.governance.changed',{roomId});
       // 1. Swap owner and increment revision
       await tx.studyRoom.update({
         where: { id: roomId },
         data: {
           ownerId: recipientUserId,
           revision: { increment: 1 },
         },
       });
@@ -712,16 +743,21 @@ export const roomGovernanceService = {
       throw new RoomForbiddenError('Unauthorized to cancel this transfer proposal');
     }
 
     if (transfer.status !== 'PENDING') {
       throw new RoomValidationError(`Cannot cancel transfer with status ${transfer.status}`);
     }
 
     await prisma.$transaction(async (tx) => {
+      await lockRooms(tx,[roomId]);
+      const locked = await tx.studyRoom.findUniqueOrThrow({where:{id:roomId}});
+      const pending = await tx.roomOwnershipTransfer.findUnique({where:{id:transferId}});
+      if (pending?.status !== 'PENDING' || ![pending.senderId,pending.recipientId,locked.ownerId].includes(actorUserId)) throw new RoomConflictError();
+      await emitRoomChange(tx,roomId,'room.governance.changed',{roomId});
       await tx.roomOwnershipTransfer.update({
         where: { id: transferId },
         data: { status: 'CANCELLED' },
       });
 
       await tx.roomAuditLog.create({
         data: {
           studyRoomId: roomId,
diff --git a/src/server/domain/studyroom/room-management.service.ts b/src/server/domain/studyroom/room-management.service.ts
--- a/src/server/domain/studyroom/room-management.service.ts
+++ b/src/server/domain/studyroom/room-management.service.ts
@@ -1,9 +1,10 @@
 import 'server-only';
+import { lockRooms, lockUser } from './room-access';
 import { randomUUID } from 'crypto';
 import { prisma } from '@/src/server/infrastructure/db/postgres/client';
 import { studyroomPolicy, type RoomEntity } from './studyroom.policy';
 import {
   type CreateRoomInput,
   type CreateRoomResponse,
   type UpdateRoomSettingsInput,
   type UpdateRoomSettingsResponse,
@@ -47,227 +48,233 @@ export const roomManagementService = {
       tags = [],
       language = 'en',
       visualPresetId,
       initialSceneId = 'lofi-cafe',
       initialAmbiencePresetId = null,
       publishImmediately = false,
     } = input;
 
-    // 1. Idempotency Check: if requestId was already processed, return existing room
-    if (requestId) {
-      const existingAudit = await prisma.roomAuditLog.findFirst({
-        where: {
-          clientRequestId: requestId,
-          actorId: userId,
-          action: 'ROOM_CREATED',
-        },
-        include: {
-          room: {
-            select: {
-              id: true,
-              slug: true,
-              title: true,
-              status: true,
-              revision: true,
+    return prisma.$transaction(async tx => {
+      await lockUser(tx, userId);
+      // 1. Idempotency Check: if requestId was already processed, return existing room
+      if (requestId) {
+        const existingAudit = await tx.roomAuditLog.findFirst({
+          where: {
+            clientRequestId: requestId,
+            actorId: userId,
+            action: 'ROOM_CREATED',
+          },
+          include: {
+            room: {
+              select: {
+                id: true,
+                slug: true,
+                title: true,
+                status: true,
+                revision: true,
+              },
             },
           },
-        },
-      });
+        });
 
-      if (existingAudit?.room) {
-        return {
-          id: existingAudit.room.id,
-          slug: existingAudit.room.slug || existingAudit.room.id,
-          title: existingAudit.room.title,
-          status: existingAudit.room.status as RoomStatus,
-          revision: existingAudit.room.revision,
-          isIdempotentReplay: true,
-        };
+        if (existingAudit?.room) {
+          return {
+            id: existingAudit.room.id,
+            slug: existingAudit.room.slug || existingAudit.room.id,
+            title: existingAudit.room.title,
+            status: existingAudit.room.status as RoomStatus,
+            revision: existingAudit.room.revision,
+            isIdempotentReplay: true,
+          };
+        }
       }
-    }
-
-    // 2. Validate Inputs
-    const cleanTitle = (title || '').trim();
-    if (
-      cleanTitle.length < STUDY_ROOM_LIMITS.TITLE_MIN_LENGTH ||
-      cleanTitle.length > STUDY_ROOM_LIMITS.TITLE_MAX_LENGTH
-    ) {
-      throw new RoomValidationError(
-        `Title must be between ${STUDY_ROOM_LIMITS.TITLE_MIN_LENGTH} and ${STUDY_ROOM_LIMITS.TITLE_MAX_LENGTH} characters`
-      );
-    }
 
-    if (description && description.length > STUDY_ROOM_LIMITS.DESCRIPTION_MAX_LENGTH) {
-      throw new RoomValidationError(
-        `Description cannot exceed ${STUDY_ROOM_LIMITS.DESCRIPTION_MAX_LENGTH} characters`
-      );
-    }
-
-    if (rules && rules.length > STUDY_ROOM_LIMITS.RULES_MAX_LENGTH) {
-      throw new RoomValidationError(
-        `Rules cannot exceed ${STUDY_ROOM_LIMITS.RULES_MAX_LENGTH} characters`
-      );
-    }
-
-    if (tags.length > STUDY_ROOM_LIMITS.TAGS_MAX_COUNT) {
-      throw new RoomValidationError(
-        `Maximum ${STUDY_ROOM_LIMITS.TAGS_MAX_COUNT} tags allowed`
-      );
-    }
-
-    for (const tag of tags) {
-      if (tag.length > STUDY_ROOM_LIMITS.TAG_MAX_LENGTH) {
+      // 2. Validate Inputs
+      const cleanTitle = (title || '').trim();
+      if (
+        cleanTitle.length < STUDY_ROOM_LIMITS.TITLE_MIN_LENGTH ||
+        cleanTitle.length > STUDY_ROOM_LIMITS.TITLE_MAX_LENGTH
+      ) {
         throw new RoomValidationError(
-          `Tag length cannot exceed ${STUDY_ROOM_LIMITS.TAG_MAX_LENGTH} characters`
+          `Title must be between ${STUDY_ROOM_LIMITS.TITLE_MIN_LENGTH} and ${STUDY_ROOM_LIMITS.TITLE_MAX_LENGTH} characters`
         );
       }
-    }
 
-    if (capacity < STUDY_ROOM_LIMITS.CAPACITY_MIN || capacity > STUDY_ROOM_LIMITS.CAPACITY_MAX) {
-      throw new RoomValidationError(
-        `Capacity must be between ${STUDY_ROOM_LIMITS.CAPACITY_MIN} and ${STUDY_ROOM_LIMITS.CAPACITY_MAX}`
-      );
-    }
-
-    // 3. Quota and Scope Checks
-    const effectiveScopeKind = scopeKind || (cohortId ? 'COHORT' : 'STANDALONE');
-    if (effectiveScopeKind === 'STANDALONE') {
-      await studyroomPolicy.assertCreationQuota(userId);
-    } else if (effectiveScopeKind === 'COHORT') {
-      if (!cohortId) {
-        throw new RoomValidationError('Cohort ID is required for cohort-scoped room');
+      if (description && description.length > STUDY_ROOM_LIMITS.DESCRIPTION_MAX_LENGTH) {
+        throw new RoomValidationError(
+          `Description cannot exceed ${STUDY_ROOM_LIMITS.DESCRIPTION_MAX_LENGTH} characters`
+        );
       }
 
-      const cohort = await prisma.cohort.findUnique({
-        where: { id: cohortId },
-        select: { creatorId: true },
-      });
+      if (rules && rules.length > STUDY_ROOM_LIMITS.RULES_MAX_LENGTH) {
+        throw new RoomValidationError(
+          `Rules cannot exceed ${STUDY_ROOM_LIMITS.RULES_MAX_LENGTH} characters`
+        );
+      }
 
-      if (!cohort) {
-        throw new RoomValidationError('Cohort not found');
+      if (tags.length > STUDY_ROOM_LIMITS.TAGS_MAX_COUNT) {
+        throw new RoomValidationError(
+          `Maximum ${STUDY_ROOM_LIMITS.TAGS_MAX_COUNT} tags allowed`
+        );
       }
 
-      const membership = await prisma.cohortMember.findUnique({
-        where: { cohortId_userId: { cohortId, userId } },
-        select: { role: true },
-      });
+      for (const tag of tags) {
+        if (tag.length > STUDY_ROOM_LIMITS.TAG_MAX_LENGTH) {
+          throw new RoomValidationError(
+            `Tag length cannot exceed ${STUDY_ROOM_LIMITS.TAG_MAX_LENGTH} characters`
+          );
+        }
+      }
 
-      const isAuthorized =
-        cohort.creatorId === userId ||
-        (membership && (membership.role === 'CREATOR' || membership.role === 'MODERATOR'));
+      if (capacity < STUDY_ROOM_LIMITS.CAPACITY_MIN || capacity > STUDY_ROOM_LIMITS.CAPACITY_MAX) {
+        throw new RoomValidationError(
+          `Capacity must be between ${STUDY_ROOM_LIMITS.CAPACITY_MIN} and ${STUDY_ROOM_LIMITS.CAPACITY_MAX}`
+        );
+      }
 
-      if (!isAuthorized) {
-        throw new RoomForbiddenError('Only cohort creator or moderator can create cohort rooms');
+      // 3. Quota and Scope Checks
+      const effectiveScopeKind = scopeKind || (cohortId ? 'COHORT' : 'STANDALONE');
+      if (!['STANDALONE','COHORT'].includes(effectiveScopeKind) ||
+          (effectiveScopeKind === 'STANDALONE' && cohortId)) {
+        throw new RoomValidationError('Invalid room scope');
       }
-    }
+      await studyroomPolicy.assertCreationQuota(userId, effectiveScopeKind === 'STANDALONE' && publishImmediately, tx);
+      if (effectiveScopeKind === 'COHORT') {
+        if (!cohortId) {
+          throw new RoomValidationError('Cohort ID is required for cohort-scoped room');
+        }
 
-    // 4. Generate Slug with Collision Handling
-    const baseSlug = sanitizeSlug(cleanTitle) || 'study-room';
-    studyroomPolicy.validateRoomSlug(baseSlug);
+        const cohort = await tx.cohort.findUnique({
+          where: { id: cohortId },
+          select: { creatorId: true },
+        });
 
-    let targetSlug = baseSlug;
-    let collisionCount = 0;
-    while (collisionCount < 10) {
-      const existing = await prisma.studyRoom.findUnique({
-        where: { slug: targetSlug },
-        select: { id: true },
-      });
-      if (!existing) break;
-      collisionCount++;
-      targetSlug = `${baseSlug}-${Math.floor(1000 + Math.random() * 9000)}`;
-    }
+        if (!cohort) {
+          throw new RoomValidationError('Cohort not found');
+        }
 
-    if (collisionCount >= 10) {
-      throw new RoomConflictError('Could not allocate unique room slug; please try a different title');
-    }
+        const membership = await tx.cohortMember.findUnique({
+          where: { cohortId_userId: { cohortId, userId } },
+          select: { role: true },
+        });
 
-    const initialStatus = publishImmediately ? 'OPEN' : 'DRAFT';
-    const now = new Date();
+        const isAuthorized =
+          cohort.creatorId === userId ||
+          (membership && (membership.role === 'CREATOR' || membership.role === 'MODERATOR'));
 
-    // 5. Atomic Transaction: Room, Channel, RealtimeStream, RoomEnvironment, AuditLog
-    const room = await prisma.$transaction(async (tx) => {
-      const createdRoom = await tx.studyRoom.create({
-        data: {
-          title: cleanTitle,
-          slug: targetSlug,
-          description: description?.trim() || null,
-          thumbnail: visualPresetId ? `/images/studyrooms/scenes/${visualPresetId}.webp` : '/images/studyrooms/scenes/library.webp',
-          ownerId: userId,
-          cohortId: scopeKind === 'COHORT' ? cohortId : null,
-          listing,
-          capacity,
-          rules: rules?.trim() || null,
-          tags,
-          language,
-          visualPresetId: visualPresetId || null,
-          status: initialStatus,
-          revision: 1,
-          publishedAt: publishImmediately ? now : null,
-          onlineCount: 0,
-        },
-      });
+        if (!isAuthorized) {
+          throw new RoomForbiddenError('Only cohort creator or moderator can create cohort rooms');
+        }
+      }
 
-      // Chat Channel
-      await tx.channel.create({
-        data: {
-          name: createdRoom.title,
-          studyRoomId: createdRoom.id,
-          messageCounter: 0,
-        },
-      });
+      // 4. Generate Slug with Collision Handling
+      const baseSlug = sanitizeSlug(cleanTitle) || 'study-room';
+      studyroomPolicy.validateRoomSlug(baseSlug);
 
-      // Event Stream
-      await tx.realtimeStream.create({
-        data: {
-          studyRoomId: createdRoom.id,
-          generation: 1,
-          eventCounter: 0,
-        },
-      });
+      let targetSlug = baseSlug;
+      let collisionCount = 0;
+      while (collisionCount < 10) {
+        const existing = await tx.studyRoom.findUnique({
+          where: { slug: targetSlug },
+          select: { id: true },
+        });
+        if (!existing) break;
+        collisionCount++;
+        targetSlug = `${baseSlug}-${Math.floor(1000 + Math.random() * 9000)}`;
+      }
 
-      // Shared Environment
-      await tx.roomEnvironment.create({
-        data: {
-          studyRoomId: createdRoom.id,
-          sceneId: initialSceneId,
-          soundscapeId: initialAmbiencePresetId,
-          revision: 1,
-          updatedByUserId: userId,
-        },
-      });
+      if (collisionCount >= 10) {
+        throw new RoomConflictError('Could not allocate unique room slug; please try a different title');
+      }
 
-      // Durable Audit Log
-      await tx.roomAuditLog.create({
-        data: {
-          studyRoomId: createdRoom.id,
-          actorId: userId,
-          action: 'ROOM_CREATED',
-          clientRequestId: requestId || null,
-          details: {
+      const initialStatus = publishImmediately ? 'OPEN' : 'DRAFT';
+      const now = new Date();
+
+      // 5. Atomic Transaction: Room, Channel, RealtimeStream, RoomEnvironment, AuditLog
+      const room = await (async () => {
+        const createdRoom = await tx.studyRoom.create({
+          data: {
             title: cleanTitle,
             slug: targetSlug,
-            scopeKind,
-            cohortId: scopeKind === 'COHORT' ? cohortId : null,
-            status: initialStatus,
+            description: description?.trim() || null,
+            thumbnail: visualPresetId ? `/images/studyrooms/scenes/${visualPresetId}.webp` : '/images/studyrooms/scenes/library.webp',
+            ownerId: userId,
+            cohortId: effectiveScopeKind === 'COHORT' ? cohortId : null,
+            listing,
             capacity,
+            rules: rules?.trim() || null,
+            tags,
+            language,
+            visualPresetId: visualPresetId || null,
+            status: initialStatus,
+            revision: 1,
+            publishedAt: publishImmediately ? now : null,
+            onlineCount: 0,
           },
-        },
-      });
+        });
 
-      return createdRoom;
-    });
+        // Chat Channel
+        await tx.channel.create({
+          data: {
+            name: createdRoom.title,
+            studyRoomId: createdRoom.id,
+            messageCounter: 0,
+          },
+        });
 
-    return {
-      id: room.id,
-      slug: room.slug || room.id,
-      title: room.title,
-      status: room.status as RoomStatus,
-      revision: room.revision,
-    };
+        // Event Stream
+        await tx.realtimeStream.create({
+          data: {
+            studyRoomId: createdRoom.id,
+            generation: 1,
+            eventCounter: 0,
+          },
+        });
+
+        // Shared Environment
+        await tx.roomEnvironment.create({
+          data: {
+            studyRoomId: createdRoom.id,
+            sceneId: initialSceneId,
+            soundscapeId: initialAmbiencePresetId,
+            revision: 1,
+            updatedByUserId: userId,
+          },
+        });
+
+        // Durable Audit Log
+        await tx.roomAuditLog.create({
+          data: {
+            studyRoomId: createdRoom.id,
+            actorId: userId,
+            action: 'ROOM_CREATED',
+            clientRequestId: requestId || null,
+            details: {
+              title: cleanTitle,
+              slug: targetSlug,
+              scopeKind,
+              cohortId: effectiveScopeKind === 'COHORT' ? cohortId : null,
+              status: initialStatus,
+              capacity,
+            },
+          },
+        });
+
+        return createdRoom;
+      })();
+
+      return {
+        id: room.id,
+        slug: room.slug || room.id,
+        title: room.title,
+        status: room.status as RoomStatus,
+        revision: room.revision,
+      };
+    });
   },
 
   /**
    * Updates room metadata with expectedRevision concurrency protection.
    */
   async updateRoomSettings(
     roomSlugOrId: string,
     input: UpdateRoomSettingsInput,
@@ -306,16 +313,19 @@ export const roomManagementService = {
     if (title !== undefined) {
       const clean = title.trim();
       if (clean.length < STUDY_ROOM_LIMITS.TITLE_MIN_LENGTH || clean.length > STUDY_ROOM_LIMITS.TITLE_MAX_LENGTH) {
         throw new RoomValidationError(`Title must be between ${STUDY_ROOM_LIMITS.TITLE_MIN_LENGTH} and ${STUDY_ROOM_LIMITS.TITLE_MAX_LENGTH} characters`);
       }
     }
 
     const updated = await prisma.$transaction(async (tx) => {
+      await lockRooms(tx, [room.id]);
+      const current = await tx.studyRoom.findUniqueOrThrow({ where: { id: room.id } });
+      if (current.revision !== expectedRevision || current.ownerId !== room.ownerId) throw new RoomConflictError();
       const res = await tx.studyRoom.update({
         where: { id: room.id },
         data: {
           title: title !== undefined ? title.trim() : undefined,
           description: description !== undefined ? (description ? description.trim() : null) : undefined,
           listing: listing !== undefined ? listing : undefined,
           capacity: capacity !== undefined ? capacity : undefined,
           rules: rules !== undefined ? (rules ? rules.trim() : null) : undefined,
@@ -425,16 +435,24 @@ export const roomManagementService = {
         archivedAt = null;
         break;
 
       default:
         throw new RoomValidationError(`Invalid lifecycle action: ${action}`);
     }
 
     const result = await prisma.$transaction(async (tx) => {
+      if (room.ownerId) await lockUser(tx, room.ownerId);
+      await lockRooms(tx, [room.id]);
+      const current = await tx.studyRoom.findUniqueOrThrow({ where: { id: room.id } });
+      if (current.revision !== expectedRevision || current.ownerId !== room.ownerId) throw new RoomConflictError();
+      if (nextStatus === 'OPEN' && !room.cohortId && room.ownerId) {
+        const count = await tx.studyRoom.count({ where: { ownerId: room.ownerId, cohortId: null, status: 'OPEN' } });
+        if (count >= STUDY_ROOM_LIMITS.MAX_OPEN_STANDALONE_PER_USER) throw new RoomConflictError('Open room limit reached');
+      }
       // If closing room, evict all active leases and participant presence records
       if (action === 'CLOSE') {
         await tx.roomLease.deleteMany({
           where: { studyRoomId: room.id },
         });
         await tx.roomParticipant.deleteMany({
           where: { studyRoomId: room.id },
         });
@@ -535,27 +553,22 @@ export const roomManagementService = {
       include: {
         owner: {
           select: { id: true, name: true, username: true },
         },
         cohort: {
           select: { id: true, title: true, visibility: true },
         },
         channel: {
-          select: { id: true },
+          select: { id: true, realtimeStream:{select:{generation:true}} },
         },
         realtimeStream: {
           select: { generation: true },
         },
-        environment: true,
-        sprints: {
-          where: { status: { in: ['ACTIVE', 'PAUSED'] } },
-          orderBy: { startedAt: 'desc' },
-          take: 1,
-        },
+
       },
     });
 
     if (!room) {
       throw new RoomNotFoundError();
     }
 
     // Active lease check for viewer
@@ -574,22 +587,21 @@ export const roomManagementService = {
     const roleRes = await studyroomPolicy.resolveUserRoomRole(room as unknown as RoomEntity, userId);
     const capabilities = await studyroomPolicy.evaluateCapabilities(
       room as unknown as RoomEntity,
       userId,
       null,
       Boolean(activeLease)
     );
 
-    // Unlisted room isolation check: if unlisted and user is not owner/controller/active participant, throw 404
-    if (room.listing === 'UNLISTED') {
-      const isManager = roleRes.isOwner || roleRes.isPlatformAdmin || roleRes.role === 'MODERATOR';
-      if (!isManager && !activeLease) {
-        throw new RoomNotFoundError();
-      }
+    const admitted = Boolean(activeLease) && capabilities.canJoin;
+    const managing = capabilities.canEditRoom;
+    if (!managing && !capabilities.canJoin &&
+        (room.listing === 'UNLISTED' || room.cohortId || room.status !== 'OPEN')) {
+      throw new RoomNotFoundError();
     }
 
     // Pending ownership transfer check for recipient
     let pendingTransfer: OwnershipTransferDTO | null = null;
     if (userId && prisma.roomOwnershipTransfer?.findFirst) {
       const transfer = await prisma.roomOwnershipTransfer.findFirst({
         where: {
           studyRoomId: room.id,
@@ -630,54 +642,58 @@ export const roomManagementService = {
         id: string;
         status: string;
         targetDurationSeconds: number;
         elapsedSeconds: number;
         revision: number;
         deadline?: Date | string | null;
       }>;
     }
-    const related = room as unknown as BootstrapRelations;
+    const shared = admitted ? await prisma.studyRoom.findUnique({where:{id:room.id},select:{
+      environment:true,sprints:{where:{status:{in:['ACTIVE','PAUSED']}},orderBy:{startedAt:'desc'},take:1}
+    }}) : null;
+    const related: BootstrapRelations = {channel:room.channel,environment:shared?.environment,sprints:shared?.sprints};
 
     return {
       room: {
         id: room.id,
         slug: room.slug || room.id,
         title: room.title,
         description: room.description,
         thumbnail: room.thumbnail,
         visualPresetId: room.visualPresetId,
         status: room.status as RoomStatus,
         listing: room.listing as RoomListing,
         scopeKind: room.cohortId ? 'COHORT' : 'STANDALONE',
         cohortId: room.cohortId,
         cohortTitle: room.cohort?.title || null,
         capacity: room.capacity,
         onlineCount: room.onlineCount,
-        rules: room.rules,
+        rules: admitted || managing ? room.rules : null,
         tags: room.tags,
         language: room.language,
         revision: room.revision,
         streamGeneration: (room as unknown as { realtimeStream?: { generation?: number } | null })?.realtimeStream?.generation ?? 1,
         ownerId: room.ownerId || '',
         ownerName: room.owner?.name || null,
         ownerUsername: room.owner?.username || null,
         createdAt: room.createdAt.toISOString(),
       },
       viewer: {
         userId,
         role: roleRes.role,
-        isJoined: Boolean(activeLease),
+        isJoined: admitted,
         leaseExpiresAt: activeLease?.expiresAt.toISOString() || null,
         generation: activeLease?.generation || null,
       },
       capabilities,
       pendingTransfer,
-      channelId: capabilities.canJoin ? related.channel?.id ?? null : null,
-      environment: related.environment
+      chatGeneration: room.channel?.realtimeStream?.generation ?? room.realtimeStream?.generation ?? 1,
+      channelId: admitted ? related.channel?.id ?? null : null,
+      environment: !admitted ? null : related.environment
         ? {
             sceneId: related.environment.sceneId || 'lofi-cafe',
             soundscapeId: related.environment.soundscapeId || null,
             musicPresetId: related.environment.musicPresetId || null,
             musicStreamUrl: related.environment.musicStreamUrl || null,
             revision: related.environment.revision || 1,
             updatedAt: related.environment.updatedAt
               ? new Date(related.environment.updatedAt).toISOString()
@@ -686,17 +702,17 @@ export const roomManagementService = {
         : {
             sceneId: room.visualPresetId || 'lofi-cafe',
             soundscapeId: null,
             musicPresetId: null,
             musicStreamUrl: null,
             revision: 1,
             updatedAt: room.createdAt ? new Date(room.createdAt).toISOString() : new Date().toISOString(),
           },
-      sprint: related.sprints?.[0]
+      sprint: admitted && related.sprints?.[0]
         ? {
             id: related.sprints[0].id,
             status: related.sprints[0].status,
             targetDurationSeconds: related.sprints[0].targetDurationSeconds,
             elapsedSeconds: related.sprints[0].elapsedSeconds,
             remainingSeconds: Math.max(
               0,
               related.sprints[0].targetDurationSeconds - related.sprints[0].elapsedSeconds
diff --git a/src/server/domain/studyroom/sprint.service.ts b/src/server/domain/studyroom/sprint.service.ts
--- a/src/server/domain/studyroom/sprint.service.ts
+++ b/src/server/domain/studyroom/sprint.service.ts
@@ -1,13 +1,13 @@
 import 'server-only';
 import { randomUUID } from 'crypto';
 import type { Prisma } from '@/generated/prisma/client';
 import { prisma } from '@/src/server/infrastructure/db/postgres/client';
-import { isSharedGuestAccount } from '@/src/server/infrastructure/auth/guestAccount';
+import { hasRoomAccess, lockRooms } from './room-access';
 import {
   type RoomSprintSnapshot,
   type StartSprintInput,
   type ControlSprintInput,
   type SprintStatus,
 } from './sprint.contracts';
 import { MessagingConflictError, MessagingForbiddenError, MessagingNotFoundError } from '../messaging/contracts';
 
@@ -56,105 +56,26 @@ async function emitSprintOutboxEvent(
   }
 }
 
 export const sprintService = {
   /**
    * Resolves a room by ID or slug.
    */
   async resolveRoom(roomSlugOrId: string) {
-    let room = await prisma.studyRoom.findUnique({
-      where: { id: roomSlugOrId },
+    return prisma.studyRoom.findFirst({
+      where: { OR: [{ id: roomSlugOrId }, { slug: roomSlugOrId }] },
     });
-
-    if (!room) {
-      const rooms = await prisma.studyRoom.findMany();
-      room = rooms.find(
-        (r) =>
-          r.id === roomSlugOrId ||
-          r.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') === roomSlugOrId.toLowerCase()
-      ) ?? null;
-    }
-
-    return room;
   },
 
   /**
    * Evaluates if a user has controller/moderator authority in a study room.
    */
   async isRoomController(roomId: string, userId: string): Promise<boolean> {
-    if (prisma.user?.findUnique) {
-      const user = await prisma.user.findUnique({
-        where: { id: userId },
-        select: { email: true, username: true },
-      });
-      if (isSharedGuestAccount(user)) {
-        return false;
-      }
-    }
-
-    // 1. Direct RoomController role check
-    const controller = await prisma.roomController.findUnique({
-      where: {
-        studyRoomId_userId: {
-          studyRoomId: roomId,
-          userId,
-        },
-      },
-    });
-
-    if (controller && ['OWNER', 'MODERATOR', 'HOST'].includes(controller.role)) {
-      return true;
-    }
-
-    // 2. Direct room owner check
-    const room = await prisma.studyRoom.findUnique({
-      where: { id: roomId },
-      select: { ownerId: true, cohortId: true },
-    });
-
-    if (room?.ownerId && room.ownerId === userId) {
-      return true;
-    }
-
-    // 3. Cohort governance check
-    if (room?.cohortId) {
-      const cohort = await prisma.cohort.findUnique({
-        where: { id: room.cohortId },
-        select: { creatorId: true },
-      });
-      if (cohort?.creatorId === userId) {
-        return true;
-      }
-      const membership = await prisma.cohortMember.findUnique({
-        where: { cohortId_userId: { cohortId: room.cohortId, userId } },
-        select: { role: true },
-      });
-      if (membership && (membership.role === 'CREATOR' || membership.role === 'MODERATOR')) {
-        return true;
-      }
-    } else {
-      const channel = await prisma.channel.findFirst({
-        where: { studyRoomId: roomId },
-        include: {
-          community: {
-            include: {
-              cohort: { select: { creatorId: true } },
-            },
-          },
-        },
-      });
-
-      if (channel?.community?.cohort?.creatorId === userId) {
-        return true;
-      }
-    }
-
-    // Insecure fallback to any participant when 0 controllers exist is explicitly REMOVED.
-    return false;
+    return hasRoomAccess(roomId, userId, true);
   },
 
   /**
    * Starts a shared room sprint atomically.
    */
   async startSprint(input: StartSprintInput): Promise<RoomSprintSnapshot> {
     const { userId, roomId, title } = input;
     const targetDurationSeconds = Math.max(
@@ -173,16 +94,18 @@ export const sprintService = {
     if (!room) {
       throw new MessagingNotFoundError('Study room not found');
     }
 
     const now = new Date();
     const deadline = new Date(now.getTime() + targetDurationSeconds * 1000);
 
     return await prisma.$transaction(async (tx) => {
+      await lockRooms(tx,[roomId]);
+      if (!(await hasRoomAccess(roomId,userId,true,tx))) throw new MessagingForbiddenError('Control revoked');
       // Check if an ACTIVE or PAUSED sprint already exists INSIDE transaction
       const existing = await tx.roomSprint.findFirst({
         where: {
           studyRoomId: roomId,
           status: { in: ['ACTIVE', 'PAUSED'] },
         },
       });
 
@@ -259,21 +182,17 @@ export const sprintService = {
       throw new MessagingNotFoundError('Sprint not found');
     }
 
     if (!['ACTIVE', 'PAUSED'].includes(sprint.status)) {
       throw new MessagingConflictError('Cannot join a sprint that has ended');
     }
 
     // User must be an active participant in this study room
-    const participant = await prisma.roomParticipant.findFirst({
-      where: { studyRoomId: sprint.studyRoomId, userId },
-    });
-
-    if (!participant) {
+    if (!(await hasRoomAccess(sprint.studyRoomId, userId))) {
       throw new MessagingForbiddenError('You must join the study room before participating in its sprint');
     }
 
     return await prisma.$transaction(async (tx) => {
       await tx.roomSprintParticipant.upsert({
         where: {
           sprintId_userId: {
             sprintId,
@@ -351,17 +270,20 @@ export const sprintService = {
       const sprint = await tx.roomSprint.findUnique({
         where: { id: sprintId },
       });
 
       if (!sprint) {
         throw new MessagingNotFoundError('Sprint not found');
       }
 
-      const isController = await this.isRoomController(sprint.studyRoomId, userId);
+      await lockRooms(tx,[sprint.studyRoomId]);
+      const latest = await tx.roomSprint.findUniqueOrThrow({where:{id:sprintId}});
+      if (latest.revision !== sprint.revision) throw new MessagingConflictError('Sprint revision conflict');
+      const isController = await hasRoomAccess(sprint.studyRoomId,userId,true,tx);
       if (!isController) {
         throw new MessagingForbiddenError('Only room controllers can pause the sprint');
       }
 
       if (sprint.revision !== expectedRevision) {
         throw new MessagingConflictError('Sprint revision conflict; please refresh sprint status');
       }
 
@@ -401,17 +323,20 @@ export const sprintService = {
       const sprint = await tx.roomSprint.findUnique({
         where: { id: sprintId },
       });
 
       if (!sprint) {
         throw new MessagingNotFoundError('Sprint not found');
       }
 
-      const isController = await this.isRoomController(sprint.studyRoomId, userId);
+      await lockRooms(tx,[sprint.studyRoomId]);
+      const latest = await tx.roomSprint.findUniqueOrThrow({where:{id:sprintId}});
+      if (latest.revision !== sprint.revision) throw new MessagingConflictError('Sprint revision conflict');
+      const isController = await hasRoomAccess(sprint.studyRoomId,userId,true,tx);
       if (!isController) {
         throw new MessagingForbiddenError('Only room controllers can resume the sprint');
       }
 
       if (sprint.revision !== expectedRevision) {
         throw new MessagingConflictError('Sprint revision conflict; please refresh sprint status');
       }
 
@@ -455,17 +380,20 @@ export const sprintService = {
       const sprint = await tx.roomSprint.findUnique({
         where: { id: sprintId },
       });
 
       if (!sprint) {
         throw new MessagingNotFoundError('Sprint not found');
       }
 
-      const isController = await this.isRoomController(sprint.studyRoomId, userId);
+      await lockRooms(tx,[sprint.studyRoomId]);
+      const latest = await tx.roomSprint.findUniqueOrThrow({where:{id:sprintId}});
+      if (latest.revision !== sprint.revision) throw new MessagingConflictError('Sprint revision conflict');
+      const isController = await hasRoomAccess(sprint.studyRoomId,userId,true,tx);
       if (!isController) {
         throw new MessagingForbiddenError('Only room controllers can stop the sprint');
       }
 
       if (sprint.revision !== expectedRevision) {
         throw new MessagingConflictError('Sprint revision conflict; please refresh sprint status');
       }
 
diff --git a/src/server/domain/studyroom/studyroom.policy.ts b/src/server/domain/studyroom/studyroom.policy.ts
--- a/src/server/domain/studyroom/studyroom.policy.ts
+++ b/src/server/domain/studyroom/studyroom.policy.ts
@@ -1,8 +1,9 @@
+import type { Prisma } from '@/generated/prisma/client';
 import 'server-only';
 import { prisma } from '@/src/server/infrastructure/db/postgres/client';
 import { isSharedGuestAccount } from '@/src/server/infrastructure/auth/guestAccount';
 import {
   type RoomRole,
   type RoomCapabilities,
   type RoomEligibilityReason,
   STUDY_ROOM_LIMITS,
@@ -58,34 +59,36 @@ export const studyroomPolicy = {
   },
 
   /**
    * Resolves the user's authoritative role within a room.
    */
   async resolveUserRoomRole(
     room: RoomEntity,
     userId: string | null,
-    platformRole?: string | null
+    platformRole?: string | null,
+    client: Prisma.TransactionClient = prisma
   ): Promise<ResolvedRoomRole> {
-    const isPlatformAdmin = platformRole === 'ADMIN';
+    let isPlatformAdmin = platformRole === 'ADMIN';
 
     if (!userId) {
       return {
         role: 'VIEWER',
         isOwner: false,
         isPlatformAdmin: false,
         isCohortGovernor: false,
       };
     }
 
-    if (prisma.user?.findUnique) {
-      const userRecord = await prisma.user.findUnique({
+    if (client.user?.findUnique) {
+      const userRecord = await client.user.findUnique({
         where: { id: userId },
-        select: { email: true, username: true },
+        select: { email: true, username: true, role: true },
       });
+      isPlatformAdmin = isPlatformAdmin || userRecord?.role === 'ADMIN';
       if (isSharedGuestAccount(userRecord)) {
         return {
           role: 'VIEWER',
           isOwner: false,
           isPlatformAdmin: false,
           isCohortGovernor: false,
         };
       }
@@ -99,42 +102,42 @@ export const studyroomPolicy = {
         isPlatformAdmin,
         isCohortGovernor: false,
       };
     }
 
     // 2. Cohort Governance Check (if room is attached to a cohort)
     let isCohortGovernor = false;
     if (room.cohortId) {
-      const cohort = await prisma.cohort.findUnique({
+      const cohort = await client.cohort.findUnique({
         where: { id: room.cohortId },
         select: { creatorId: true },
       });
 
       if (cohort?.creatorId === userId) {
         isCohortGovernor = true;
       } else {
-        const membership = await prisma.cohortMember.findUnique({
+        const membership = await client.cohortMember.findUnique({
           where: {
             cohortId_userId: {
               cohortId: room.cohortId,
               userId,
             },
           },
           select: { role: true },
         });
 
         if (membership && (membership.role === 'CREATOR' || membership.role === 'MODERATOR')) {
           isCohortGovernor = true;
         }
       }
     }
 
     // 3. Delegated RoomController Check
-    const controller = await prisma.roomController.findUnique({
+    const controller = await client.roomController.findUnique({
       where: {
         studyRoomId_userId: {
           studyRoomId: room.id,
           userId,
         },
       },
       select: { role: true },
     });
@@ -163,17 +166,17 @@ export const studyroomPolicy = {
         role: 'MODERATOR',
         isOwner: false,
         isPlatformAdmin,
         isCohortGovernor,
       };
     }
 
     // 4. Participant vs Viewer check
-    const activeLease = await prisma.roomLease.findFirst({
+    const activeLease = await client.roomLease.findFirst({
       where: {
         studyRoomId: room.id,
         userId,
         expiresAt: { gt: new Date() },
       },
     });
 
     return {
@@ -185,29 +188,30 @@ export const studyroomPolicy = {
   },
 
   /**
    * Resolves room eligibility: evaluates if user can join, view, or what restriction blocks them.
    */
   async resolveRoomEligibility(
     room: RoomEntity,
     userId: string | null,
-    hasActiveLease = false
+    hasActiveLease = false,
+    client: Prisma.TransactionClient = prisma
   ): Promise<{
     eligible: boolean;
     reason: RoomEligibilityReason;
     details?: Record<string, unknown>;
   }> {
     if (!userId) {
       return { eligible: false, reason: 'NOT_AUTHENTICATED' };
     }
 
     // Deny shared guest accounts
-    if (prisma.user?.findUnique) {
-      const userRecord = await prisma.user.findUnique({
+    if (client.user?.findUnique) {
+      const userRecord = await client.user.findUnique({
         where: { id: userId },
         select: { email: true, username: true },
       });
       if (isSharedGuestAccount(userRecord)) {
         return { eligible: false, reason: 'GUEST_RESTRICTED' };
       }
     }
 
@@ -232,17 +236,17 @@ export const studyroomPolicy = {
       };
       cohortMember?: {
         findUnique: (args: {
           where: { cohortId_userId: { cohortId: string; userId: string } };
           include?: { cohort: { select: { title: boolean } } };
         }) => Promise<{ cohort: { title: string } } | null>;
       };
     };
-    const db = prisma as unknown as PolicyPrismaClient;
+    const db = client as unknown as PolicyPrismaClient;
 
     const restriction = db.roomRestriction?.findUnique
       ? await db.roomRestriction.findUnique({
           where: {
             studyRoomId_userId: {
               studyRoomId: room.id,
               userId,
             },
@@ -290,17 +294,17 @@ export const studyroomPolicy = {
           reason: 'ENROLLMENT_REQUIRED',
           details: { cohortId: room.cohortId },
         };
       }
     }
 
     // 4. Capacity Check (if not already inside)
     if (!hasActiveLease) {
-      const activeDistinctUsers = await prisma.roomLease.groupBy({
+      const activeDistinctUsers = await client.roomLease.groupBy({
         by: ['userId'],
         where: {
           studyRoomId: room.id,
           expiresAt: { gt: now },
         },
       });
 
       const capacity = room.capacity ?? STUDY_ROOM_LIMITS.CAPACITY_MAX;
@@ -318,20 +322,21 @@ export const studyroomPolicy = {
 
   /**
    * Computes the complete capability matrix for a room and viewer.
    */
   async evaluateCapabilities(
     room: RoomEntity,
     userId: string | null,
     platformRole?: string | null,
-    hasActiveLease = false
+    hasActiveLease = false,
+    client: Prisma.TransactionClient = prisma
   ): Promise<RoomCapabilities> {
-    const roleResolution = await this.resolveUserRoomRole(room, userId, platformRole);
-    const eligibility = await this.resolveRoomEligibility(room, userId, hasActiveLease);
+    const roleResolution = await this.resolveUserRoomRole(room, userId, platformRole,client);
+    const eligibility = await this.resolveRoomEligibility(room, userId, hasActiveLease,client);
 
     const isOwner = roleResolution.isOwner || roleResolution.isPlatformAdmin;
     const isManager = isOwner || roleResolution.role === 'MODERATOR';
 
     // Environment and Sprint control require live active lease in addition to role
     const canControlEnvironment =
       (isOwner || roleResolution.role === 'MODERATOR' || roleResolution.role === 'HOST') &&
       hasActiveLease;
@@ -419,45 +424,45 @@ export const studyroomPolicy = {
     if (hierarchyRank[actorRole] <= hierarchyRank[targetRole]) {
       throw new RoomForbiddenError(`A ${actorRole} cannot take action against a ${targetRole}`);
     }
   },
 
   /**
    * Enforces room creation quotas.
    */
-  async assertCreationQuota(userId: string): Promise<void> {
-    if (prisma.user?.findUnique) {
-      const userRecord = await prisma.user.findUnique({
+  async assertCreationQuota(userId: string, opening = true, db: Pick<typeof prisma, 'user' | 'studyRoom'> = prisma): Promise<void> {
+    if (db.user?.findUnique) {
+      const userRecord = await db.user.findUnique({
         where: { id: userId },
         select: { email: true, username: true },
       });
       if (isSharedGuestAccount(userRecord)) {
         throw new RoomForbiddenError('Guest accounts cannot create study rooms');
       }
     }
 
     // 1. Max open standalone rooms limit
-    const openStandaloneCount = await prisma.studyRoom.count({
+    const openStandaloneCount = await db.studyRoom.count({
       where: {
         ownerId: userId,
         cohortId: null,
         status: 'OPEN',
       },
     });
 
-    if (openStandaloneCount >= STUDY_ROOM_LIMITS.MAX_OPEN_STANDALONE_PER_USER) {
+    if (opening && openStandaloneCount >= STUDY_ROOM_LIMITS.MAX_OPEN_STANDALONE_PER_USER) {
       throw new RoomQuotaExceededError(
         `You have reached the limit of ${STUDY_ROOM_LIMITS.MAX_OPEN_STANDALONE_PER_USER} open standalone study rooms`
       );
     }
 
     // 2. Daily creation limit (past 24 hours)
     const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
-    const recentCreationsCount = await prisma.studyRoom.count({
+    const recentCreationsCount = await db.studyRoom.count({
       where: {
         ownerId: userId,
         createdAt: { gte: oneDayAgo },
       },
     });
 
     if (recentCreationsCount >= STUDY_ROOM_LIMITS.MAX_CREATIONS_PER_DAY_PER_USER) {
       throw new RoomQuotaExceededError(
diff --git a/src/server/domain/studyroom/studyroom.service.ts b/src/server/domain/studyroom/studyroom.service.ts
--- a/src/server/domain/studyroom/studyroom.service.ts
+++ b/src/server/domain/studyroom/studyroom.service.ts
@@ -1,9 +1,11 @@
 import 'server-only';
+import { emitRoomChange } from './room-change';
+import { lockRooms, lockUser, hasRoomAccess } from './room-access';
 import { createHash, randomUUID } from 'node:crypto';
 import { prisma } from '@/src/server/infrastructure/db/postgres/client';
 import { studyroomPolicy, type RoomEntity } from './studyroom.policy';
 import {
   type RoomRole,
   RoomNotFoundError,
   RoomForbiddenError,
   RoomQuotaExceededError,
@@ -35,17 +37,17 @@ export interface RoomCatalogItem {
   id: string;
   title: string;
   thumbnail: string;
   status: string;
   onlineCount: number;
   slug?: string;
 }
 
-export const participantGoalsRegistry = new Map<string, string>();
+
 
 export interface RoomRosterMember {
   id: string;
   userId: string;
   name: string;
   username: string;
   image: string;
   role?: RoomRole;
@@ -188,36 +190,28 @@ export const studyRoomService = {
     const now = new Date();
 
     const room = await findRoomByIdOrSlug(prisma.studyRoom, roomId);
     if (!room) {
       throw new RoomNotFoundError('Study room not found');
     }
     const actualRoomId = room.id;
 
-    if (_userId && studyroomPolicy && typeof studyroomPolicy.resolveRoomEligibility === 'function') {
-      const eligibility = await studyroomPolicy.resolveRoomEligibility(
-        room as unknown as RoomEntity,
-        _userId,
-        false
-      );
-      if (!eligibility.eligible && eligibility.reason !== 'ROOM_FULL') {
-        throw new RoomForbiddenError('Not authorized to view room roster');
-      }
-    }
+    if (_userId && !(await hasRoomAccess(actualRoomId,_userId))) throw new RoomForbiddenError('Active room membership required');
 
     // Query active participants who have at least one non-expired lease
     const participants = await prisma.roomParticipant.findMany({
       where: { studyRoomId: actualRoomId },
       include: {
         user: {
           select: {
             id: true,
             name: true,
             username: true,
+            role: true,
             image: true,
           },
         },
       },
       orderBy: { joinedAt: 'asc' },
     });
 
     const userIds = participants.map((p) => p.userId);
@@ -247,41 +241,48 @@ export const studyRoomService = {
 
     let controllers: Array<{ userId: string; role: string }> = [];
     if (prismaWithController.roomController?.findMany) {
       controllers = await prismaWithController.roomController.findMany({
         where: { studyRoomId: actualRoomId },
         select: { userId: true, role: true },
       });
     }
+    const cohort = room.cohortId ? await prisma.cohort.findUnique({where:{id:room.cohortId},select:{creatorId:true}}) : null;
+    const governors = room.cohortId ? await prisma.cohortMember.findMany({where:{cohortId:room.cohortId,userId:{in:userIds},role:{in:['CREATOR','MODERATOR']}},select:{userId:true}}) : [];
+    const inherited = new Set([cohort?.creatorId,...governors.map(member=>member.userId)]);
     const controllerMap = new Map<string, RoomRole>(
       controllers.map((c) => [c.userId, c.role as RoomRole])
     );
 
     // Only return participants with active leases or recently joined
     return participants
       .filter((p) => (leaseCountMap.get(p.userId) ?? 0) > 0)
       .map((p) => {
         let role: RoomRole = 'PARTICIPANT';
         if (room?.ownerId && p.user.id === room.ownerId) {
           role = 'OWNER';
+        } else if (p.user.role === 'ADMIN' && !controllerMap.has(p.user.id)) {
+          role = 'MODERATOR';
+        } else if (inherited.has(p.user.id) && !controllerMap.has(p.user.id)) {
+          role = 'MODERATOR';
         } else if (controllerMap.has(p.user.id)) {
           role = controllerMap.get(p.user.id)!;
         }
 
         return {
           id: p.id,
           userId: p.user.id,
           name: p.user.name || p.user.username || 'Peer',
           username: p.user.username || '',
           image: p.user.image || '/undone-logo.svg',
           role,
           joinedAt: p.joinedAt.toISOString(),
           tabCount: leaseCountMap.get(p.userId) ?? 1,
-          publicGoal: participantGoalsRegistry.get(`${actualRoomId}:${p.user.id}`) ?? null,
+          publicGoal: p.publicGoal ?? null,
         };
       });
   },
 
   /**
    * Serialized per-user room join or switch.
    * Enforces at most one selected room per user globally.
    * Multiple tabs in the same room count as 1 distinct user towards onlineCount.
@@ -329,38 +330,42 @@ export const studyRoomService = {
                 new Date(Date.now() + LEASE_DURATION_MS).toISOString(),
             },
           };
         }
       }
     }
 
     return prisma.$transaction(async (tx) => {
+      await lockUser(tx, userId);
       // 1. Verify target room exists
-      const targetRoom = await findRoomByIdOrSlug(tx.studyRoom, roomId);
+      let targetRoom = await findRoomByIdOrSlug(tx.studyRoom, roomId);
       if (!targetRoom) {
         throw new RoomNotFoundError('Study room not found');
       }
 
       const now = new Date();
       const expiresAt = new Date(now.getTime() + LEASE_DURATION_MS);
 
       // 2. Check user's current room membership
       const currentParticipant = await tx.roomParticipant.findUnique({
         where: { userId },
       });
 
-      const isAlreadyInTarget = currentParticipant?.studyRoomId === targetRoom.id;
+      await lockRooms(tx, [targetRoom.id, ...(currentParticipant ? [currentParticipant.studyRoomId] : [])]);
+      targetRoom = await tx.studyRoom.findUniqueOrThrow({ where: { id: targetRoom.id } });
+      const isAlreadyInTarget = currentParticipant?.studyRoomId === targetRoom.id &&
+        Boolean(await tx.roomLease.findFirst({ where: { userId, studyRoomId: targetRoom.id, expiresAt: { gt: new Date() } } }));
 
       // 3. Eligibility & Capacity Check
       if (studyroomPolicy && typeof studyroomPolicy.resolveRoomEligibility === 'function') {
         const eligibility = await studyroomPolicy.resolveRoomEligibility(
           targetRoom as unknown as RoomEntity,
           userId,
-          isAlreadyInTarget
+          isAlreadyInTarget, tx
         );
         if (!eligibility.eligible) {
           if (eligibility.reason === 'ROOM_FULL') {
             throw new RoomQuotaExceededError('Room is at full capacity');
           }
           if (eligibility.reason === 'ROOM_CLOSED') {
             throw new RoomForbiddenError('Room is closed');
           }
@@ -426,21 +431,16 @@ export const studyRoomService = {
           // Same room: retain generation, record new/renewed tab lease
           generation = currentParticipant.generation;
         } else {
           // Different room: switch rooms! Increment generation and evict old room
           isSwitch = true;
           generation = Math.max(currentParticipant.generation, maxHistoricalGen) + 1;
           const oldRoomId = currentParticipant.studyRoomId;
 
-          // Deterministic lock order on switch: sort room IDs to prevent deadlocks
-          const [firstRoomId, secondRoomId] = [targetRoom.id, oldRoomId].sort();
-          await tx.studyRoom.findUnique({ where: { id: firstRoomId } });
-          await tx.studyRoom.findUnique({ where: { id: secondRoomId } });
-
           // Delete leases for the old room
           await tx.roomLease.deleteMany({
             where: { userId, studyRoomId: oldRoomId },
           });
 
           // Delete old participant row
           await tx.roomParticipant.delete({
             where: { userId },
@@ -507,21 +507,23 @@ export const studyRoomService = {
       }
 
       // 4. Upsert RoomParticipant with current generation
       await tx.roomParticipant.upsert({
         where: { userId },
         create: {
           userId,
           studyRoomId: targetRoom.id,
+          publicGoal: params.publicGoal?.trim().slice(0,80) || null,
           generation,
           joinedAt: now,
         },
         update: {
           studyRoomId: targetRoom.id,
+          publicGoal: params.publicGoal?.trim().slice(0,80) || (isAlreadyInTarget ? undefined : null),
           generation,
           updatedAt: now,
         },
       });
 
       // 5. Upsert RoomLease for this tab
       const lease = await tx.roomLease.upsert({
         where: {
@@ -629,20 +631,16 @@ export const studyRoomService = {
               leaseId: lease.id,
               tabId,
               expiresAt: lease.expiresAt.toISOString(),
             },
           },
         });
       }
 
-      if (typeof params.publicGoal === 'string' && params.publicGoal.trim().length > 0) {
-        participantGoalsRegistry.set(`${targetRoom.id}:${userId}`, params.publicGoal.trim().slice(0, 80));
-      }
-
       return {
         success: true,
         roomId: targetRoom.id,
         slug: targetRoom.slug || targetRoom.id,
         generation,
         isSwitch,
         lease: {
           leaseId: lease.id,
@@ -663,68 +661,58 @@ export const studyRoomService = {
     generation: number;
   }): Promise<RenewLeaseResult> {
     const { userId, roomId, tabId, generation } = params;
 
     return prisma.$transaction(async (tx) => {
       const targetRoom = await findRoomByIdOrSlug(tx.studyRoom, roomId);
       const actualRoomId = targetRoom?.id || roomId;
 
+      await lockUser(tx,userId);
+      await lockRooms(tx,[actualRoomId]);
       const participant = await tx.roomParticipant.findUnique({
         where: { userId },
       });
 
       if (!participant || participant.studyRoomId !== actualRoomId) {
         return { success: false, reason: 'not_in_room' };
       }
 
       // Stale generation check: reject delayed heartbeats from previous rooms
       if (participant.generation !== generation) {
         return { success: false, reason: 'stale_generation' };
       }
 
       const now = new Date();
       const expiresAt = new Date(now.getTime() + LEASE_DURATION_MS);
 
-      const lease = await tx.roomLease.upsert({
-        where: {
-          userId_tabId: {
-            userId,
-            tabId,
-          },
-        },
-        create: {
-          userId,
-          studyRoomId: actualRoomId,
-          generation,
-          tabId,
-          expiresAt,
-        },
-        update: {
-          expiresAt,
-          updatedAt: now,
-        },
+      if (!targetRoom || !(await studyroomPolicy.resolveRoomEligibility(targetRoom,userId,true,tx)).eligible) return { success: false, reason: 'not_in_room' };
+      const renewed = await tx.roomLease.updateMany({
+        where: { userId, tabId, studyRoomId: actualRoomId, generation, expiresAt: { gt: now } },
+        data: { expiresAt },
       });
+      if (!renewed.count) return { success: false, reason: 'not_in_room' };
 
       return {
         success: true,
-        expiresAt: (lease?.expiresAt ? new Date(lease.expiresAt) : expiresAt).toISOString(),
+        expiresAt: expiresAt.toISOString(),
       };
     });
   },
 
   /**
    * Leave room operation with epoch and room fencing.
    * If global: removes user from participant list and revokes all leases.
    * If tab close: removes only that tab's lease; if other tabs remain, user stays in room.
    */
   async leaveRoom(params: LeaveRoomParams): Promise<LeaveRoomResult> {
     const { userId, tabId, generation, global = false } = params;
 
     return prisma.$transaction(async (tx) => {
+      await lockUser(tx, userId);
       const participant = await tx.roomParticipant.findUnique({
         where: { userId },
       });
 
       if (!participant) {
         return { success: true, left: true, remainingLeases: 0 };
       }
 
@@ -737,16 +725,18 @@ export const studyRoomService = {
       if (params.roomId) {
         const room = await findRoomByIdOrSlug(tx.studyRoom, params.roomId);
         if (room && room.id !== participant.studyRoomId) {
           return { success: true, left: false, remainingLeases: 0 };
         }
       }
 
       const roomId = participant.studyRoomId;
+      await lockRooms(tx, [roomId]);
+      if (tabId && typeof generation !== 'number') return { success: true, left: false, remainingLeases: 0 };
       const now = new Date();
       let left = false;
       let remainingLeases = 0;
 
       if (global || !tabId) {
         // Explicit global leave: delete all leases and the participant row
         await tx.roomLease.deleteMany({
           where: { userId, studyRoomId: roomId },
@@ -756,17 +746,17 @@ export const studyRoomService = {
           where: { userId },
         });
 
         left = true;
         remainingLeases = 0;
       } else {
         // Single tab closed: remove only that tab's lease
         await tx.roomLease.deleteMany({
-          where: { userId, tabId },
+          where: { userId, tabId, studyRoomId: roomId, generation },
         });
 
         // Count remaining active leases for this user in this room
         remainingLeases = await tx.roomLease.count({
           where: {
             userId,
             studyRoomId: roomId,
             expiresAt: { gt: now },
@@ -834,19 +824,17 @@ export const studyRoomService = {
                 destination: `room:${roomId}:g${stream.generation}`,
                 status: 'PENDING',
               },
             });
           }
         }
       }
 
-      if (left) {
-        participantGoalsRegistry.delete(`${roomId}:${userId}`);
-      }
+
 
       return {
         success: true,
         left,
         remainingLeases,
       };
     });
   },
@@ -887,25 +875,27 @@ export const studyRoomService = {
       throw new RoomForbiddenError('Must have an active lease in this room to update public goal');
     }
 
     const cleanedGoal =
       typeof publicGoal === 'string' && publicGoal.trim().length > 0
         ? publicGoal.trim().slice(0, 80)
         : null;
 
-    const registryKey = `${actualRoomId}:${userId}`;
-    if (cleanedGoal) {
-      participantGoalsRegistry.set(registryKey, cleanedGoal);
-    } else {
-      participantGoalsRegistry.delete(registryKey);
-    }
-
-    // Emit outbox event: room.participant.updated
-    await prisma.$transaction(async (tx) => {
+    await prisma.$transaction(async tx => {
+      await lockUser(tx, userId);
+      await lockRooms(tx, [actualRoomId]);
+      const lease = await tx.roomLease.findFirst({ where: { userId, tabId, generation, studyRoomId: actualRoomId, expiresAt: { gt: new Date() } } });
+      if (!lease) throw new RoomForbiddenError('Room assignment expired');
+      const changed = await tx.roomParticipant.updateMany({
+        where: { userId, studyRoomId: actualRoomId, generation,
+          ...(cleanedGoal === null ? { publicGoal: { not: null } } : { OR: [{publicGoal:null},{publicGoal:{not:cleanedGoal}}] }) },
+        data: { publicGoal: cleanedGoal },
+      });
+      if (!changed.count) return;
       if (tx.realtimeStream?.findUnique && tx.realtimeEvent?.create) {
         let stream = await tx.realtimeStream.findUnique({
           where: { studyRoomId: actualRoomId },
         });
         if (stream) {
           if (tx.realtimeStream?.update) {
             stream = await tx.realtimeStream.update({
               where: { id: stream.id },
@@ -957,170 +947,46 @@ export const studyRoomService = {
     gracePeriodMs?: number;
   }): Promise<{
     evictedLeasesCount: number;
     evictedParticipantsCount: number;
     updatedRoomsCount: number;
     durationMs: number;
   }> {
     const startTime = Date.now();
-    const gracePeriodMs = options?.gracePeriodMs ?? 5000;
-    const cutoff = new Date(Date.now() - gracePeriodMs);
-
-    return prisma.$transaction(async (tx) => {
-      // 1. Delete expired leases past the grace cutoff
-      const deleteResult = await tx.roomLease.deleteMany({
-        where: {
-          expiresAt: { lte: cutoff },
-        },
+    const cutoff = new Date(Date.now() - (options?.gracePeriodMs ?? 5000));
+    const candidates = await prisma.roomLease.findMany({ where: { expiresAt: { lte: cutoff } },
+      take: Math.max(1,Math.min(100, options?.batchSize ?? 50)), orderBy: {expiresAt:'asc'} });
+    let evictedLeasesCount = 0;
+    let evictedParticipantsCount = 0;
+    const rooms = new Set<string>();
+    for (const candidate of candidates) {
+      const result = await prisma.$transaction(async tx => {
+        await lockUser(tx, candidate.userId);
+        await lockRooms(tx, [candidate.studyRoomId]);
+        const removed = await tx.roomLease.deleteMany({ where: { id: candidate.id, expiresAt: {lte:cutoff} } });
+        if (!removed.count) return null;
+        const remaining = await tx.roomLease.count({where:{userId:candidate.userId, studyRoomId:candidate.studyRoomId, expiresAt:{gt:new Date()}}});
+        if (remaining) return { evicted:0, changed:false };
+        const people = await tx.roomParticipant.deleteMany({where:{userId:candidate.userId, studyRoomId:candidate.studyRoomId, generation:candidate.generation}});
+        const live = await tx.roomLease.groupBy({by:['userId'],where:{studyRoomId:candidate.studyRoomId, expiresAt:{gt:new Date()}}});
+        const updated = await tx.studyRoom.updateMany({where:{id:candidate.studyRoomId,onlineCount:{not:live.length}},data:{onlineCount:live.length}});
+        if (people.count) await emitRoomChange(tx,candidate.studyRoomId,'room.participant.left',{userId:candidate.userId,reason:'LEASE_EXPIRED',onlineCount:live.length});
+        else if (updated.count) await emitRoomChange(tx,candidate.studyRoomId,'room.roster.changed',{onlineCount:live.length});
+        return { evicted:people.count, changed:Boolean(updated.count) };
       });
-
-      // 2. Find all participants who now have zero active leases
-      const allParticipants =
-        (await tx.roomParticipant.findMany({
-          select: { id: true, userId: true, studyRoomId: true },
-        })) || [];
-
-      const activeLeases =
-        (await tx.roomLease.findMany({
-          where: { expiresAt: { gt: cutoff } },
-          select: { userId: true, studyRoomId: true },
-        })) || [];
-
-      const activeUserRoomSet = new Set(
-        activeLeases.map((l) => `${l.userId}:${l.studyRoomId}`)
-      );
-      const ghostParticipants = allParticipants.filter(
-        (p) => !activeUserRoomSet.has(`${p.userId}:${p.studyRoomId}`)
-      );
-
-      if (ghostParticipants.length > 0) {
-        for (const p of ghostParticipants) {
-          participantGoalsRegistry.delete(`${p.studyRoomId}:${p.userId}`);
-        }
-
-        await tx.roomParticipant.deleteMany({
-          where: {
-            id: { in: ghostParticipants.map((p) => p.id) },
-          },
-        });
-
-        // Emit outbox events for ghost participants evicted
-        if (tx.realtimeStream?.findUnique && tx.realtimeEvent?.create && tx.realtimeDelivery?.create) {
-          for (const p of ghostParticipants) {
-            let stream = await tx.realtimeStream.findUnique({
-              where: { studyRoomId: p.studyRoomId },
-            });
-            if (stream) {
-              if (tx.realtimeStream?.update) {
-                stream = await tx.realtimeStream.update({
-                  where: { id: stream.id },
-                  data: { eventCounter: { increment: 1 } },
-                });
-              }
-              const leftEventId = randomUUID();
-              await tx.realtimeEvent.create({
-                data: {
-                  streamId: stream.id,
-                  sequence: stream.eventCounter,
-                  eventId: leftEventId,
-                  schemaVersion: 1,
-                  type: 'room.participant.left',
-                  generation: stream.generation,
-                  entityId: p.userId,
-                  payload: {
-                    userId: p.userId,
-                    roomId: p.studyRoomId,
-                    reason: 'LEASE_EXPIRED',
-                    occurredAt: new Date().toISOString(),
-                  },
-                },
-              });
-              await tx.realtimeDelivery.create({
-                data: {
-                  eventId: leftEventId,
-                  destination: `room:${p.studyRoomId}:g${stream.generation}`,
-                  status: 'PENDING',
-                },
-              });
-            }
-          }
-        }
-      }
-
-      // 3. Recalculate and repair onlineCount for all rooms
-      const allRooms = (await tx.studyRoom.findMany({ select: { id: true } })) || [];
-      let updatedRoomsCount = 0;
-
-      for (const room of allRooms) {
-        const activeUsers =
-          (await tx.roomLease.groupBy({
-            by: ['userId'],
-            where: {
-              studyRoomId: room.id,
-              expiresAt: { gt: cutoff },
-            },
-          })) || [];
-
-        await tx.studyRoom.update({
-          where: { id: room.id },
-          data: { onlineCount: activeUsers.length },
-        });
-        updatedRoomsCount++;
-
-        // Emit room.roster.changed
-        if (tx.realtimeStream?.findUnique && tx.realtimeEvent?.create && tx.realtimeDelivery?.create) {
-          let stream = await tx.realtimeStream.findUnique({
-            where: { studyRoomId: room.id },
-          });
-          if (stream) {
-            if (tx.realtimeStream?.update) {
-              stream = await tx.realtimeStream.update({
-                where: { id: stream.id },
-                data: { eventCounter: { increment: 1 } },
-              });
-            }
-            const rosterEventId = randomUUID();
-            await tx.realtimeEvent.create({
-              data: {
-                streamId: stream.id,
-                sequence: stream.eventCounter,
-                eventId: rosterEventId,
-                schemaVersion: 1,
-                type: 'room.roster.changed',
-                generation: stream.generation,
-                entityId: room.id,
-                payload: {
-                  roomId: room.id,
-                  onlineCount: activeUsers.length,
-                  occurredAt: new Date().toISOString(),
-                },
-              },
-            });
-            await tx.realtimeDelivery.create({
-              data: {
-                eventId: rosterEventId,
-                destination: `room:${room.id}:g${stream.generation}`,
-                status: 'PENDING',
-              },
-            });
-          }
-        }
+      if (result) {
+        evictedLeasesCount++;
+        evictedParticipantsCount += result.evicted;
+        if (result.changed) rooms.add(candidate.studyRoomId);
       }
-
-      const durationMs = Date.now() - startTime;
-      studyRoomMetricsService.recordReconciliation(deleteResult.count, durationMs);
-
-      return {
-        evictedLeasesCount: deleteResult.count,
-        evictedParticipantsCount: ghostParticipants.length,
-        updatedRoomsCount,
-        durationMs,
-      };
-    });
+    }
+    const durationMs = Date.now()-startTime;
+    studyRoomMetricsService.recordReconciliation(evictedLeasesCount,durationMs);
+    return {evictedLeasesCount,evictedParticipantsCount,updatedRoomsCount:rooms.size,durationMs};
   },
 
   /**
    * Synchronize room events delta or return snapshot if client cursor has drifted.
    */
   async syncRoomEvents(params: {
     roomIdOrSlug: string;
     userId: string;
diff --git a/src/server/domain/studyroom/__tests__/environment.service.test.ts b/src/server/domain/studyroom/__tests__/environment.service.test.ts
--- a/src/server/domain/studyroom/__tests__/environment.service.test.ts
+++ b/src/server/domain/studyroom/__tests__/environment.service.test.ts
@@ -1,25 +1,36 @@
 import { describe, it, expect, vi, beforeEach } from 'vitest';
 
+// Database doubles execute serially. The PostgreSQL gate covers real lock interleavings.
+vi.mock('@/src/server/domain/studyroom/room-access', async (load) => ({
+  ...await load<typeof import('@/src/server/domain/studyroom/room-access')>(),
+  lockRooms: vi.fn(), lockUser: vi.fn(), hasRoomAccess: vi.fn(async()=>true),
+}));
 vi.mock('server-only', () => ({}));
 
 import { environmentService, validateExternalStreamUrl } from '../environment.service';
 import { sprintService } from '../sprint.service';
 import { prisma } from '@/src/server/infrastructure/db/postgres/client';
 import {
   MessagingConflictError,
   MessagingForbiddenError,
   MessagingNotFoundError,
   MessagingValidationError,
 } from '../../messaging/contracts';
 
 const { mockPrisma } = vi.hoisted(() => {
   const mock: any = {
     studyRoom: {
+      findUniqueOrThrow: vi.fn(async () => {
+      const model = prisma.studyRoom;
+      const recent = [model.findUnique,model.findFirst].flatMap(fn => vi.isMockFunction(fn) ? fn.mock.results.slice(-1) : []);
+      for (const call of recent) { const room = await call.value; if (room) return room; }
+      throw Error('Missing room fixture');
+    }),
       findUnique: vi.fn(),
     },
     roomEnvironment: {
       findUnique: vi.fn(),
       create: vi.fn(),
       update: vi.fn(),
       upsert: vi.fn(),
     },
diff --git a/src/server/domain/studyroom/__tests__/phase12-e2e-scenarios.test.ts b/src/server/domain/studyroom/__tests__/phase12-e2e-scenarios.test.ts
--- a/src/server/domain/studyroom/__tests__/phase12-e2e-scenarios.test.ts
+++ b/src/server/domain/studyroom/__tests__/phase12-e2e-scenarios.test.ts
@@ -1,24 +1,30 @@
 /* eslint-disable @typescript-eslint/no-explicit-any */
 import { describe, it, expect, vi, beforeEach } from 'vitest';
 
+// Database doubles execute serially. The PostgreSQL gate covers real lock interleavings.
+vi.mock('@/src/server/domain/studyroom/room-access', async (load) => ({
+  ...await load<typeof import('@/src/server/domain/studyroom/room-access')>(),
+  lockRooms: vi.fn(), lockUser: vi.fn(),
+}));
 vi.mock('server-only', () => ({}));
 
 // Mock database state tracking
 let mockRooms: any[] = [];
 let mockParticipants: any[] = [];
 let mockLeases: any[] = [];
 let mockCohortMembers: any[] = [];
 let mockDeliveries: any[] = [];
 
 vi.mock('@/src/server/infrastructure/db/postgres/client', () => {
   return {
     prisma: {
       studyRoom: {
+              findUniqueOrThrow: vi.fn(async ({where}:any)=>mockRooms.find(r=>r.id===where.id)),
         findUnique: vi.fn(async ({ where }: any) => {
           if (where.id) return mockRooms.find((r) => r.id === where.id) ?? null;
           if (where.slug) return mockRooms.find((r) => r.slug === where.slug) ?? null;
           return null;
         }),
         findFirst: vi.fn(async ({ where }: any) => {
           if (where?.OR) {
             for (const cond of where.OR) {
@@ -155,30 +161,19 @@ vi.mock('@/src/server/infrastructure/db/postgres/client', () => {
           }
           const l = { id: `lease-${mockLeases.length + 1}`, ...create };
           mockLeases.push(l);
           return l;
         }),
         deleteMany: vi.fn(async ({ where }: any) => {
           let count = 0;
           mockLeases = mockLeases.filter((l) => {
-            if (where?.tabId && l.tabId === where.tabId) {
-              count++;
-              return false;
-            }
-            if (where?.userId && where?.studyRoomId && l.userId === where.userId && l.studyRoomId === where.studyRoomId) {
-              count++;
-              return false;
-            }
-            if (where?.expiresAt?.lte && l.expiresAt <= where.expiresAt.lte) {
-              count++;
-              return false;
-            }
-            return true;
-          });
+ const match = (!where?.tabId || l.tabId === where.tabId) && (!where?.userId || l.userId === where.userId) && (!where?.studyRoomId || l.studyRoomId === where.studyRoomId) && (where?.generation === undefined || l.generation === where.generation) && (!where?.expiresAt?.lte || l.expiresAt <= where.expiresAt.lte);
+ if(match) count++; return !match;
+});
           return { count };
         }),
       },
       cohortMember: {
         findUnique: vi.fn(async ({ where }: any) => {
           return (
             mockCohortMembers.find(
               (m) => m.cohortId === where.cohortId_userId.cohortId && m.userId === where.cohortId_userId.userId
@@ -205,16 +200,22 @@ vi.mock('@/src/server/infrastructure/db/postgres/client', () => {
           mockDeliveries.push(data);
           return data;
         }),
       },
       $transaction: vi.fn(async (cb: any) => {
         if (typeof cb === 'function') {
           return cb({
             studyRoom: {
+              updateMany:vi.fn(async ({where,data}:any)=>{
+                const row=mockRooms.find(r=>r.id===where.id && r.onlineCount!==where.onlineCount.not);
+                if(row) Object.assign(row,data);
+                return {count:row?1:0};
+              }),
+              findUniqueOrThrow: vi.fn(async ({where}:any)=>mockRooms.find(r=>r.id===where.id)),
               findUnique: vi.fn(async ({ where }: any) => {
                 if (where.id) return mockRooms.find((r) => r.id === where.id) ?? null;
                 if (where.slug) return mockRooms.find((r) => r.slug === where.slug) ?? null;
                 return null;
               }),
               findFirst: vi.fn(async ({ where }: any) => {
                 if (where?.OR) {
                   for (const cond of where.OR) {
@@ -236,16 +237,21 @@ vi.mock('@/src/server/infrastructure/db/postgres/client', () => {
               findMany: vi.fn(async () => mockRooms),
               update: vi.fn(async ({ where, data }: any) => {
                 const room = mockRooms.find((r) => r.id === where.id);
                 if (room) Object.assign(room, data);
                 return room;
               }),
             },
             roomParticipant: {
+              updateMany:vi.fn(async ({where,data}:any)=>{
+                const row=mockParticipants.find(p=>p.userId===where.userId && p.studyRoomId===where.studyRoomId && p.generation===where.generation);
+                if(row) Object.assign(row,data);
+                return {count:row?1:0};
+              }),
               findUnique: vi.fn(async ({ where }: any) => {
                 if (where.userId) return mockParticipants.find((p) => p.userId === where.userId) ?? null;
                 if (where.studyRoomId_userId) {
                   return (
                     mockParticipants.find(
                       (p) => p.studyRoomId === where.studyRoomId_userId.studyRoomId && p.userId === where.studyRoomId_userId.userId
                     ) ?? null
                   );
@@ -279,16 +285,21 @@ vi.mock('@/src/server/infrastructure/db/postgres/client', () => {
                 mockParticipants.push(p);
                 return p;
               }),
               delete: vi.fn(async ({ where }: any) => {
                 const idx = mockParticipants.findIndex((p) => p.id === where.id);
                 if (idx >= 0) mockParticipants.splice(idx, 1);
               }),
               deleteMany: vi.fn(async ({ where }: any) => {
+                if(where.userId){
+                  const old=mockParticipants.length;
+                  mockParticipants=mockParticipants.filter(p=>!(p.userId===where.userId && p.studyRoomId===where.studyRoomId && p.generation===where.generation));
+                  return {count:old-mockParticipants.length};
+                }
                 if (where?.id?.in) {
                   mockParticipants = mockParticipants.filter((p) => !where.id.in.includes(p.id));
                 }
               }),
             },
             roomLease: {
               groupBy: vi.fn(async ({ where }: any) => {
                 let filtered = mockLeases;
@@ -342,41 +353,31 @@ vi.mock('@/src/server/infrastructure/db/postgres/client', () => {
                 }
                 const l = { id: `lease-${mockLeases.length + 1}`, ...create };
                 mockLeases.push(l);
                 return l;
               }),
               deleteMany: vi.fn(async ({ where }: any) => {
                 let count = 0;
                 mockLeases = mockLeases.filter((l) => {
-                  if (where?.tabId && l.tabId === where.tabId) {
-                    count++;
-                    return false;
-                  }
-                  if (where?.userId && where?.studyRoomId && l.userId === where.userId && l.studyRoomId === where.studyRoomId) {
-                    count++;
-                    return false;
-                  }
-                  if (where?.expiresAt?.lte && l.expiresAt <= where.expiresAt.lte) {
-                    count++;
-                    return false;
-                  }
-                  return true;
-                });
+ const match = (!where?.tabId || l.tabId === where.tabId) && (!where?.userId || l.userId === where.userId) && (!where?.studyRoomId || l.studyRoomId === where.studyRoomId) && (where?.generation === undefined || l.generation === where.generation) && (!where?.expiresAt?.lte || l.expiresAt <= where.expiresAt.lte);
+ if(match) count++; return !match;
+});
                 return { count };
               }),
             },
             roomAuditLog: {
               findFirst: vi.fn(async () => null),
               create: vi.fn(async () => ({})),
             },
             channel: {
               findFirst: vi.fn(async () => ({ id: 'ch-1', studyRoomId: 'room-1' })),
             },
             realtimeStream: {
+              upsert:vi.fn(async()=>({id:'stream',eventCounter:2,generation:1})),
               findUnique: vi.fn(async () => ({ id: 'stream-1', generation: 1, eventCounter: 1 })),
               update: vi.fn(async ({ data }: any) => ({ id: 'stream-1', generation: 1, eventCounter: 2, ...data })),
             },
             realtimeEvent: {
               create: vi.fn(async ({ data }: any) => data),
             },
             realtimeDelivery: {
               create: vi.fn(async ({ data }: any) => {
@@ -424,16 +425,17 @@ describe('Phase 12 Section 9 Required End-to-End Scenarios', () => {
     mockParticipants = [];
     mockLeases = [];
     mockCohortMembers = [];
     mockDeliveries = [];
   });
 
   describe('ROOM Lifecycle & Multi-User Presence (ROOM-01 to ROOM-10)', () => {
     it('ROOM-01: opens a database room by slug without static-only dependency', async () => {
+      await studyRoomService.joinRoom({roomId:'library',userId:'user-viewer',tabId:'viewer'});
       const room = await studyRoomService.getRoomRoster('library', 'user-viewer');
       expect(room).toBeDefined();
       expect(Array.isArray(room)).toBe(true);
     });
 
     it('ROOM-02: two accounts join; both see each other and onlineCount becomes 2', async () => {
       const join1 = await studyRoomService.joinRoom({
         userId: 'user-alice',
@@ -480,16 +482,17 @@ describe('Phase 12 Section 9 Required End-to-End Scenarios', () => {
       });
       await studyRoomService.joinRoom({
         userId: 'user-alice',
         roomId: 'room-1',
         tabId: 'tab-alice-2',
       });
 
       const leaveRes = await studyRoomService.leaveRoom({
+        generation:1,
         userId: 'user-alice',
         roomId: 'room-1',
         tabId: 'tab-alice-1',
         global: false,
       });
 
       expect(leaveRes.left).toBe(false);
       expect(mockParticipants).toHaveLength(1);
@@ -652,16 +655,17 @@ describe('Phase 12 Section 9 Required End-to-End Scenarios', () => {
     it('PRIV-01 & PRIV-02: private goal is never published; public goal revoked on switch to private', async () => {
       await studyRoomService.joinRoom({
         userId: 'user-alice',
         roomId: 'room-1',
         tabId: 'tab-1',
         publicGoal: 'Learn Rust',
       });
 
+      await studyRoomService.joinRoom({roomId:'room-1',userId:'user-bob',tabId:'bob'});
       let roster = await studyRoomService.getRoomRoster('room-1', 'user-bob');
       expect(roster.find((p) => p.userId === 'user-alice')?.publicGoal).toBe('Learn Rust');
 
       // User switches goal to private (publicGoal: null)
       await studyRoomService.updateParticipantGoal({
         userId: 'user-alice',
         roomId: 'room-1',
         tabId: 'tab-1',
@@ -679,13 +683,13 @@ describe('Phase 12 Section 9 Required End-to-End Scenarios', () => {
           throw new Error('Database connection failed');
         },
       };
 
       await expect(mockFailingService.joinRoom()).rejects.toThrow('Database connection failed');
     });
 
     it('UI-01: empty room returns empty roster without fabricated mock participants', async () => {
-      const roster = await studyRoomService.getRoomRoster('room-1', 'user-anyone');
+      const roster = await studyRoomService.getRoomRoster('room-1');
       expect(roster).toHaveLength(0);
     });
   });
 });
diff --git a/src/server/domain/studyroom/__tests__/phase2-catalog-and-identity.test.ts b/src/server/domain/studyroom/__tests__/phase2-catalog-and-identity.test.ts
--- a/src/server/domain/studyroom/__tests__/phase2-catalog-and-identity.test.ts
+++ b/src/server/domain/studyroom/__tests__/phase2-catalog-and-identity.test.ts
@@ -1,23 +1,34 @@
 /* eslint-disable @typescript-eslint/no-explicit-any */
 import { describe, it, expect, vi, beforeEach } from 'vitest';
 
+// Database doubles execute serially. The PostgreSQL gate covers real lock interleavings.
+vi.mock('@/src/server/domain/studyroom/room-access', async (load) => ({
+  ...await load<typeof import('@/src/server/domain/studyroom/room-access')>(),
+  lockRooms: vi.fn(), lockUser: vi.fn(), hasRoomAccess: vi.fn(async()=>true),
+}));
 vi.mock('server-only', () => ({}));
 
 import { prisma } from '@/src/server/infrastructure/db/postgres/client';
 import { roomManagementService } from '../room-management.service';
 import { roomDiscoveryService } from '../room-discovery.service';
 import { environmentService } from '../environment.service';
 import { sprintService } from '../sprint.service';
 import { RoomNotFoundError } from '@/src/shared/studyroom/contracts';
 
 vi.mock('@/src/server/infrastructure/db/postgres/client', () => ({
   prisma: {
     studyRoom: {
+      findUniqueOrThrow: vi.fn(async () => {
+      const model = prisma.studyRoom;
+      const recent = [model.findUnique,model.findFirst].flatMap(fn => vi.isMockFunction(fn) ? fn.mock.results.slice(-1) : []);
+      for (const call of recent) { const room = await call.value; if (room) return room; }
+      throw Error('Missing room fixture');
+    }),
       findUnique: vi.fn(),
       findFirst: vi.fn(),
       findMany: vi.fn(),
       create: vi.fn(),
       update: vi.fn(),
       count: vi.fn(),
     },
     roomEnvironment: {
diff --git a/src/server/domain/studyroom/__tests__/phase3-authorization-and-bootstrap.test.ts b/src/server/domain/studyroom/__tests__/phase3-authorization-and-bootstrap.test.ts
--- a/src/server/domain/studyroom/__tests__/phase3-authorization-and-bootstrap.test.ts
+++ b/src/server/domain/studyroom/__tests__/phase3-authorization-and-bootstrap.test.ts
@@ -1,11 +1,16 @@
 /* eslint-disable @typescript-eslint/no-explicit-any */
 import { describe, it, expect, vi, beforeEach } from 'vitest';
 
+// Database doubles execute serially. The PostgreSQL gate covers real lock interleavings.
+vi.mock('@/src/server/domain/studyroom/room-access', async (load) => ({
+  ...await load<typeof import('@/src/server/domain/studyroom/room-access')>(),
+  lockRooms: vi.fn(), lockUser: vi.fn(),
+}));
 vi.mock('server-only', () => ({}));
 
 import { prisma } from '@/src/server/infrastructure/db/postgres/client';
 import { isSharedGuestAccount } from '@/src/server/infrastructure/auth/guestAccount';
 import { studyroomPolicy } from '../studyroom.policy';
 import { studyRoomService } from '../studyroom.service';
 import { roomManagementService } from '../room-management.service';
 import { messageService } from '@/src/server/domain/messaging/message.service';
@@ -23,16 +28,22 @@ vi.mock('@/src/server/infrastructure/auth/guestAccount', () => ({
 }));
 
 vi.mock('@/src/server/infrastructure/db/postgres/client', () => ({
   prisma: {
     user: {
       findUnique: vi.fn(),
     },
     studyRoom: {
+      findUniqueOrThrow: vi.fn(async () => {
+      const model = prisma.studyRoom;
+      const recent = [model.findUnique,model.findFirst].flatMap(fn => vi.isMockFunction(fn) ? fn.mock.results.slice(-1) : []);
+      for (const call of recent) { const room = await call.value; if (room) return room; }
+      throw Error('Missing room fixture');
+    }),
       findFirst: vi.fn(),
       findUnique: vi.fn(),
       findMany: vi.fn(),
       update: vi.fn(),
       count: vi.fn(),
     },
     roomParticipant: {
       findUnique: vi.fn(),
@@ -390,17 +401,18 @@ describe('Integration Phase 3: Unified Room Authorization and Bootstrap', () =>
             targetDurationSeconds: 1500,
             elapsedSeconds: 300,
             revision: 1,
             deadline: new Date('2026-10-21T01:25:00.000Z'),
           },
         ],
       } as any);
 
-      vi.mocked(prisma.roomLease.findFirst).mockResolvedValue(null);
+      vi.mocked(prisma.roomLease.findFirst).mockResolvedValue({expiresAt:new Date(Date.now()+90000),generation:1} as any);
+      vi.mocked(prisma.studyRoom.findUnique).mockImplementation((async()=>await vi.mocked(prisma.studyRoom.findFirst).mock.results.at(-1)?.value) as any);
       vi.mocked(prisma.roomLease.groupBy).mockResolvedValue([]);
       vi.mocked(prisma.user.findUnique).mockResolvedValue({
         id: 'user-1',
         email: 'user@example.com',
       } as any);
       vi.mocked(isSharedGuestAccount).mockReturnValue(false);
 
       const bootstrap = await roomManagementService.getRoomBootstrap('library', 'user-1');
@@ -434,26 +446,22 @@ describe('Integration Phase 3: Unified Room Authorization and Bootstrap', () =>
       vi.mocked(prisma.roomLease.findFirst).mockResolvedValue(null);
       vi.mocked(prisma.cohortMember.findUnique).mockResolvedValue(null); // Not enrolled
       vi.mocked(prisma.user.findUnique).mockResolvedValue({
         id: 'user-outsider',
         email: 'outsider@example.com',
       } as any);
       vi.mocked(isSharedGuestAccount).mockReturnValue(false);
 
-      const bootstrap = await roomManagementService.getRoomBootstrap('private-cohort-room', 'user-outsider');
-
-      expect(bootstrap.capabilities.canJoin).toBe(false);
-      expect(bootstrap.capabilities.eligibilityReason).toBe('ENROLLMENT_REQUIRED');
-      // Chat channel ID is strictly withheld from non-members
-      expect(bootstrap.channelId).toBeNull();
+      await expect(roomManagementService.getRoomBootstrap('private-cohort-room','user-outsider')).rejects.toThrow(RoomNotFoundError);
     });
 
-    it('unlisted rooms throw RoomNotFoundError (404) for unauthorized users', async () => {
+    it('eligible direct-link visitors see only a preview before joining', async () => {
       vi.mocked(prisma.studyRoom.findFirst).mockResolvedValue({
+        createdAt:new Date(),
         id: 'room-secret',
         slug: 'secret-unlisted-room',
         title: 'Secret Room',
         status: 'OPEN',
         listing: 'UNLISTED',
         ownerId: 'owner-1',
         cohortId: null,
       } as any);
@@ -461,14 +469,12 @@ describe('Integration Phase 3: Unified Room Authorization and Bootstrap', () =>
       vi.mocked(prisma.roomLease.findFirst).mockResolvedValue(null);
       vi.mocked(prisma.roomController.findUnique).mockResolvedValue(null);
       vi.mocked(prisma.user.findUnique).mockResolvedValue({
         id: 'user-curious',
         email: 'curious@example.com',
       } as any);
       vi.mocked(isSharedGuestAccount).mockReturnValue(false);
 
-      await expect(
-        roomManagementService.getRoomBootstrap('secret-unlisted-room', 'user-curious')
-      ).rejects.toThrow(RoomNotFoundError);
+      expect((await roomManagementService.getRoomBootstrap('secret-unlisted-room','user-curious')).channelId).toBeNull();
     });
   });
 });
diff --git a/src/server/domain/studyroom/__tests__/phase4-membership-leases-cleanup.test.ts b/src/server/domain/studyroom/__tests__/phase4-membership-leases-cleanup.test.ts
--- a/src/server/domain/studyroom/__tests__/phase4-membership-leases-cleanup.test.ts
+++ b/src/server/domain/studyroom/__tests__/phase4-membership-leases-cleanup.test.ts
@@ -1,48 +1,63 @@
 /* eslint-disable @typescript-eslint/no-explicit-any */
 import { describe, expect, it, vi, beforeEach } from 'vitest';
 import { studyRoomService } from '../studyroom.service';
 import { prisma } from '@/src/server/infrastructure/db/postgres/client';
 
+// Database doubles execute serially. The PostgreSQL gate covers real lock interleavings.
+vi.mock('@/src/server/domain/studyroom/room-access', async (load) => ({
+  ...await load<typeof import('@/src/server/domain/studyroom/room-access')>(),
+  lockRooms: vi.fn(), lockUser: vi.fn(),
+}));
 vi.mock('server-only', () => ({}));
 
 vi.mock('@/src/server/domain/studyroom/studyroom.policy', () => ({
   studyroomPolicy: {
     resolveRoomEligibility: vi.fn().mockResolvedValue({ eligible: true, reason: 'ELIGIBLE' }),
     validateRoomSlug: vi.fn((slug: string) => slug),
   },
 }));
 
 vi.mock('@/src/server/infrastructure/db/postgres/client', () => {
   const mockStudyRoom = {
+    updateMany:vi.fn(async()=>({count:1})),
+    findUniqueOrThrow: vi.fn(async () => {
+      const model = prisma.studyRoom;
+      const recent = [model.findUnique,model.findFirst].flatMap(fn => vi.isMockFunction(fn) ? fn.mock.results.slice(-1) : []);
+      for (const call of recent) { const room = await call.value; if (room) return room; }
+      throw Error('Missing room fixture');
+    }),
     findUnique: vi.fn(),
     findFirst: vi.fn(),
     findMany: vi.fn(),
     update: vi.fn(),
   };
 
   const mockRoomParticipant = {
+    updateMany:vi.fn(async()=>({count:1})),
     findUnique: vi.fn(),
     findMany: vi.fn(),
     upsert: vi.fn(),
     delete: vi.fn(),
     deleteMany: vi.fn(),
   };
 
   const mockRoomLease = {
+    updateMany:vi.fn(async()=>({count:1})),
     findFirst: vi.fn(),
     findMany: vi.fn(),
     upsert: vi.fn(),
     deleteMany: vi.fn(),
     count: vi.fn(),
     groupBy: vi.fn(),
   };
 
   const mockRealtimeStream = {
+    upsert:vi.fn(async()=>({id:'s',eventCounter:1,generation:1})),
     findUnique: vi.fn(),
     create: vi.fn(),
     update: vi.fn(),
   };
 
   const mockRealtimeEvent = {
     create: vi.fn(),
   };
@@ -351,48 +366,24 @@ describe('Phase 4: Membership, Leases, and Cleanup Robustness', () => {
           }),
         })
       );
     });
   });
 
   describe('Reconciliation Sweep with Grace Period Buffer', () => {
     it('sweeps only expired leases past the safety grace buffer and returns duration metrics', async () => {
-      vi.mocked(prisma.roomLease.deleteMany).mockResolvedValue({ count: 3 } as any);
-      vi.mocked(prisma.roomParticipant.findMany).mockResolvedValue([
-        { id: 'part-dead', userId: 'user-expired', studyRoomId: 'room-1' },
-        { id: 'part-alive', userId: 'user-active', studyRoomId: 'room-1' },
-      ] as any);
-
-      vi.mocked(prisma.roomLease.findMany).mockResolvedValue([
-        { userId: 'user-active', studyRoomId: 'room-1' },
-      ] as any);
-
-      vi.mocked(prisma.studyRoom.findMany).mockResolvedValue([{ id: 'room-1' }] as any);
-      vi.mocked(prisma.roomLease.groupBy).mockResolvedValue([{ userId: 'user-active' } as any]);
-
-      const result = await studyRoomService.reconcileExpiredLeases({
-        gracePeriodMs: 5000,
-      });
-
-      expect(result.evictedLeasesCount).toBe(3);
-      expect(result.evictedParticipantsCount).toBe(1);
-      expect(result.updatedRoomsCount).toBe(1);
-      expect(typeof result.durationMs).toBe('number');
+      const candidate = {id:'expired',userId:'ghost',studyRoomId:'room-1',generation:3};
+      vi.mocked(prisma.roomLease.findMany).mockResolvedValueOnce([candidate] as any);
+      vi.mocked(prisma.roomLease.deleteMany).mockResolvedValueOnce({count:1});
+      vi.mocked(prisma.roomLease.count).mockResolvedValueOnce(0);
+      vi.mocked(prisma.roomParticipant.deleteMany).mockResolvedValueOnce({count:1});
+      vi.mocked(prisma.roomLease.groupBy).mockResolvedValueOnce([{userId:'alive'}] as any);
+      const result = await studyRoomService.reconcileExpiredLeases({batchSize:10,gracePeriodMs:5000});
+      expect(result).toMatchObject({evictedLeasesCount:1,evictedParticipantsCount:1,updatedRoomsCount:1});
       expect(result.durationMs).toBeGreaterThanOrEqual(0);
-
-      // Verify cutoff applied with grace buffer
-      expect(prisma.roomLease.deleteMany).toHaveBeenCalledWith(
-        expect.objectContaining({
-          where: {
-            expiresAt: expect.objectContaining({
-              lte: expect.any(Date),
-            }),
-          },
-        })
-      );
-      // Ghost participant was deleted
-      expect(prisma.roomParticipant.deleteMany).toHaveBeenCalledWith({
-        where: { id: { in: ['part-dead'] } },
-      });
+      expect(prisma.roomLease.findMany).toHaveBeenCalledWith(expect.objectContaining({take:10,where:{expiresAt:{lte:expect.any(Date)}}}));
+      expect(prisma.roomLease.deleteMany).toHaveBeenCalledWith({where:{id:'expired',expiresAt:{lte:expect.any(Date)}}});
+      expect(prisma.roomParticipant.deleteMany).toHaveBeenCalledWith({where:{userId:'ghost',studyRoomId:'room-1',generation:3}});
+      expect(prisma.studyRoom.updateMany).toHaveBeenCalledWith({where:{id:'room-1',onlineCount:{not:1}},data:{onlineCount:1}});
     });
   });
 });
diff --git a/src/server/domain/studyroom/__tests__/phase6-room-events-and-recovery.test.ts b/src/server/domain/studyroom/__tests__/phase6-room-events-and-recovery.test.ts
--- a/src/server/domain/studyroom/__tests__/phase6-room-events-and-recovery.test.ts
+++ b/src/server/domain/studyroom/__tests__/phase6-room-events-and-recovery.test.ts
@@ -2,16 +2,21 @@
 import { describe, expect, it, vi, beforeEach } from 'vitest';
 import { studyRoomService } from '../studyroom.service';
 import { roomGovernanceService } from '../room-governance.service';
 import { roomManagementService } from '../room-management.service';
 import { proxyAuthService } from '@/src/server/domain/messaging/proxy-auth.service';
 import { studyroomPolicy } from '@/src/server/domain/studyroom/studyroom.policy';
 import { prisma } from '@/src/server/infrastructure/db/postgres/client';
 
+// Database doubles execute serially. The PostgreSQL gate covers real lock interleavings.
+vi.mock('@/src/server/domain/studyroom/room-access', async (load) => ({
+  ...await load<typeof import('@/src/server/domain/studyroom/room-access')>(),
+  lockRooms: vi.fn(), lockUser: vi.fn(),
+}));
 vi.mock('server-only', () => ({}));
 
 vi.mock('@/src/server/domain/studyroom/studyroom.policy', () => ({
   studyroomPolicy: {
     resolveRoomEligibility: vi.fn().mockResolvedValue({ eligible: true, reason: 'ELIGIBLE' }),
     resolveUserRoomRole: vi.fn().mockResolvedValue({ role: 'PARTICIPANT', isOwner: false }),
     evaluateCapabilities: vi.fn().mockResolvedValue({
       canJoin: true,
@@ -24,45 +29,54 @@ vi.mock('@/src/server/domain/studyroom/studyroom.policy', () => ({
     }),
     validateRoomSlug: vi.fn((slug: string) => slug),
     assertTargetHierarchy: vi.fn(),
   },
 }));
 
 vi.mock('@/src/server/infrastructure/db/postgres/client', () => {
   const mockStudyRoom = {
+    updateMany:vi.fn(async()=>({count:1})),
+    findUniqueOrThrow: vi.fn(async () => {
+      const model = prisma.studyRoom;
+      const recent = [model.findUnique,model.findFirst].flatMap(fn => vi.isMockFunction(fn) ? fn.mock.results.slice(-1) : []);
+      for (const call of recent) { const room = await call.value; if (room) return room; }
+      throw Error('Missing room fixture');
+    }),
     findUnique: vi.fn(),
     findFirst: vi.fn(),
     findMany: vi.fn(),
     update: vi.fn(),
   };
 
   const mockRoomParticipant = {
+    updateMany:vi.fn(async()=>({count:1})),
     findUnique: vi.fn(),
     findFirst: vi.fn(),
     findMany: vi.fn().mockResolvedValue([]),
     upsert: vi.fn(),
     delete: vi.fn(),
     deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
   };
 
   const mockRoomLease = {
+    updateMany:vi.fn(async()=>({count:1})),
     findFirst: vi.fn(),
     findMany: vi.fn().mockResolvedValue([]),
     upsert: vi.fn(),
     deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
     count: vi.fn().mockResolvedValue(0),
     groupBy: vi.fn().mockResolvedValue([]),
   };
 
   const mockRealtimeStream = {
+    upsert:vi.fn(async()=>({id:'s',eventCounter:1,generation:1})),
     findUnique: vi.fn(),
     create: vi.fn(),
     update: vi.fn(),
-    upsert: vi.fn(),
   };
 
   const mockRealtimeEvent = {
     create: vi.fn(),
     findMany: vi.fn().mockResolvedValue([]),
   };
 
   const mockRealtimeDelivery = {
@@ -130,16 +144,17 @@ vi.mock('@/src/server/infrastructure/db/postgres/client', () => {
 
 describe('Phase 6: Room Events and Recovery', () => {
   beforeEach(() => {
     vi.clearAllMocks();
   });
 
   describe('studyRoomService.syncRoomEvents', () => {
     it('returns SNAPSHOT when clientSequence is not provided or 0', async () => {
+      vi.mocked(prisma.studyRoom.findUnique).mockImplementation((async()=>await vi.mocked(prisma.studyRoom.findFirst).mock.results.at(-1)?.value) as any);
       vi.mocked(prisma.studyRoom.findFirst).mockResolvedValue({
         id: 'room-1',
         slug: 'room-one',
         title: 'Room One',
         status: 'OPEN',
         ownerId: 'owner-1',
       } as any);
 
@@ -177,16 +192,17 @@ describe('Phase 6: Room Events and Recovery', () => {
       expect(result.mode).toBe('SNAPSHOT');
       expect(result.roomId).toBe('room-1');
       expect(result.generation).toBe(2);
       expect(result.currentSequence).toBe(45);
       expect(result.roster).toHaveLength(1);
     });
 
     it('returns SNAPSHOT when sequence gap exceeds maxDeltaGap (150)', async () => {
+      vi.mocked(prisma.studyRoom.findUnique).mockImplementation((async()=>await vi.mocked(prisma.studyRoom.findFirst).mock.results.at(-1)?.value) as any);
       vi.mocked(prisma.studyRoom.findFirst).mockResolvedValue({
         id: 'room-1',
         slug: 'room-one',
         title: 'Room One',
         status: 'OPEN',
         ownerId: 'owner-1',
       } as any);
 
@@ -213,16 +229,17 @@ describe('Phase 6: Room Events and Recovery', () => {
         clientSequence: 50, // 250 - 50 = 200 > 150
       });
 
       expect(result.mode).toBe('SNAPSHOT');
       expect(result.currentSequence).toBe(250);
     });
 
     it('returns DELTA with events when clientSequence is within catchup window', async () => {
+      vi.mocked(prisma.studyRoom.findUnique).mockImplementation((async()=>await vi.mocked(prisma.studyRoom.findFirst).mock.results.at(-1)?.value) as any);
       vi.mocked(prisma.studyRoom.findFirst).mockResolvedValue({
         id: 'room-1',
         slug: 'room-one',
         title: 'Room One',
         status: 'OPEN',
         ownerId: 'owner-1',
       } as any);
 
@@ -345,69 +362,49 @@ describe('Phase 6: Room Events and Recovery', () => {
         email: 'user1@test.com',
         username: 'user1',
       } as any);
 
       vi.mocked(prisma.channel.findUnique).mockResolvedValueOnce({
         id: 'chan-1',
         studyRoomId: 'room-1',
         realtimeStream: { generation: 2 },
-        studyRoom: { status: 'OPEN' },
+        studyRoom: {
+      findUniqueOrThrow: vi.fn(async () => {
+      const model = prisma.studyRoom;
+      const recent = [model.findUnique,model.findFirst].flatMap(fn => vi.isMockFunction(fn) ? fn.mock.results.slice(-1) : []);
+      for (const call of recent) { const room = await call.value; if (room) return room; }
+      throw Error('Missing room fixture');
+    }), status: 'OPEN' },
       } as any);
 
       const result = await proxyAuthService.authorizeSubscription('user-1', 'roomchat:chan-1:g1');
 
       expect(result.allowed).toBe(false);
       expect(result.code).toBe(103);
     });
   });
 
   describe('Outbox event publishing on room mutations', () => {
     it('reconcileExpiredLeases emits room.participant.left with LEASE_EXPIRED to outbox', async () => {
-      vi.mocked(prisma.roomParticipant.findMany).mockResolvedValueOnce([
-        {
-          id: 'p-1',
-          userId: 'user-expired',
-          studyRoomId: 'room-1',
-        },
-      ] as any);
-
-      // Active leases is empty -> user-expired is recognized as ghost participant
-      vi.mocked(prisma.roomLease.findMany).mockResolvedValueOnce([]);
-
-      vi.mocked(prisma.roomLease.deleteMany).mockResolvedValueOnce({ count: 1 });
-      vi.mocked(prisma.roomParticipant.deleteMany).mockResolvedValueOnce({ count: 1 });
-      vi.mocked(prisma.studyRoom.findUnique).mockResolvedValueOnce({ id: 'room-1', slug: 'room-1' } as any);
-
-      vi.mocked(prisma.realtimeStream.findUnique).mockResolvedValueOnce({
-        id: 'stream-1',
-        studyRoomId: 'room-1',
-        generation: 1,
-        eventCounter: 10,
-      } as any);
-
-      vi.mocked(prisma.realtimeStream.update).mockResolvedValueOnce({
-        id: 'stream-1',
-        studyRoomId: 'room-1',
-        generation: 1,
-        eventCounter: 11,
-      } as any);
-
-      const result = await studyRoomService.reconcileExpiredLeases({ batchSize: 10 });
-      expect(result.evictedParticipantsCount).toBe(1);
-
-      // Verify realtimeDelivery.create was called for room.participant.left
-      expect(prisma.realtimeDelivery.create).toHaveBeenCalledWith(
-        expect.objectContaining({
-          data: expect.objectContaining({
-            destination: 'room:room-1:g1',
-            status: 'PENDING',
-          }),
-        })
-      );
+      const candidate = {id:'expired',userId:'ghost',studyRoomId:'room-1',generation:3};
+      vi.mocked(prisma.roomLease.findMany).mockResolvedValueOnce([candidate] as any);
+      vi.mocked(prisma.roomLease.deleteMany).mockResolvedValueOnce({count:1});
+      vi.mocked(prisma.roomLease.count).mockResolvedValueOnce(0);
+      vi.mocked(prisma.roomParticipant.deleteMany).mockResolvedValueOnce({count:1});
+      vi.mocked(prisma.roomLease.groupBy).mockResolvedValueOnce([{userId:'alive'}] as any);
+      const result = await studyRoomService.reconcileExpiredLeases({batchSize:10,gracePeriodMs:5000});
+      expect(result).toMatchObject({evictedLeasesCount:1,evictedParticipantsCount:1,updatedRoomsCount:1});
+      expect(result.durationMs).toBeGreaterThanOrEqual(0);
+      expect(prisma.roomLease.findMany).toHaveBeenCalledWith(expect.objectContaining({take:10,where:{expiresAt:{lte:expect.any(Date)}}}));
+      expect(prisma.roomLease.deleteMany).toHaveBeenCalledWith({where:{id:'expired',expiresAt:{lte:expect.any(Date)}}});
+      expect(prisma.roomParticipant.deleteMany).toHaveBeenCalledWith({where:{userId:'ghost',studyRoomId:'room-1',generation:3}});
+      expect(prisma.studyRoom.updateMany).toHaveBeenCalledWith({where:{id:'room-1',onlineCount:{not:1}},data:{onlineCount:1}});
+      expect(prisma.realtimeEvent.create).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({type:'room.participant.left',payload:expect.objectContaining({reason:'LEASE_EXPIRED'})})}));
+      expect(prisma.realtimeDelivery.create).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({destination:'room:room-1:g1'})}));
     });
 
     it('roomGovernanceService.removeParticipant emits room.participant.left with KICKED to outbox', async () => {
       vi.mocked(studyroomPolicy.resolveUserRoomRole).mockResolvedValueOnce({
         role: 'HOST',
         isOwner: true,
       } as any);
       vi.mocked(studyroomPolicy.resolveUserRoomRole).mockResolvedValueOnce({
diff --git a/src/server/domain/studyroom/__tests__/room-discovery.service.test.ts b/src/server/domain/studyroom/__tests__/room-discovery.service.test.ts
--- a/src/server/domain/studyroom/__tests__/room-discovery.service.test.ts
+++ b/src/server/domain/studyroom/__tests__/room-discovery.service.test.ts
@@ -10,16 +10,17 @@ vi.mock('@/src/server/infrastructure/db/postgres/client', () => ({
     cohortMember: {
       findMany: vi.fn(),
     },
     cohort: {
       findFirst: vi.fn(),
       findMany: vi.fn(),
     },
     studyRoom: {
+      fields:{capacity:{_ref:'capacity'}},
       findMany: vi.fn(),
     },
     roomParticipant: {
       findMany: vi.fn(),
     },
     roomLease: {
       findMany: vi.fn(),
     },
@@ -163,17 +164,16 @@ describe('roomDiscoveryService', () => {
       ] as any);
 
       const result = await roomDiscoveryService.discoverRooms({ tab: 'my-rooms' }, 'user-me');
 
       expect(prisma.studyRoom.findMany).toHaveBeenCalledWith(
         expect.objectContaining({
           where: {
             AND: [
-              { status: { not: 'ARCHIVED' } },
               {
                 OR: [
                   { ownerId: 'user-me' },
                   { controllers: { some: { userId: 'user-me' } } },
                 ],
               },
             ],
           },
diff --git a/src/server/domain/studyroom/__tests__/room-governance.service.test.ts b/src/server/domain/studyroom/__tests__/room-governance.service.test.ts
--- a/src/server/domain/studyroom/__tests__/room-governance.service.test.ts
+++ b/src/server/domain/studyroom/__tests__/room-governance.service.test.ts
@@ -1,24 +1,35 @@
 import { describe, it, expect, vi, beforeEach } from 'vitest';
 
+// Database doubles execute serially. The PostgreSQL gate covers real lock interleavings.
+vi.mock('@/src/server/domain/studyroom/room-access', async (load) => ({
+  ...await load<typeof import('@/src/server/domain/studyroom/room-access')>(),
+  lockRooms: vi.fn(), lockUser: vi.fn(),
+}));
 vi.mock('server-only', () => ({}));
 
 import { roomGovernanceService } from '../room-governance.service';
 import { prisma } from '@/src/server/infrastructure/db/postgres/client';
 import {
   RoomNotFoundError,
   RoomForbiddenError,
   RoomConflictError,
   RoomValidationError,
 } from '@/src/shared/studyroom/contracts';
 
 vi.mock('@/src/server/infrastructure/db/postgres/client', () => ({
   prisma: {
     studyRoom: {
+      findUniqueOrThrow: vi.fn(async () => {
+      const model = prisma.studyRoom;
+      const recent = [model.findUnique,model.findFirst].flatMap(fn => vi.isMockFunction(fn) ? fn.mock.results.slice(-1) : []);
+      for (const call of recent) { const room = await call.value; if (room) return room; }
+      throw Error('Missing room fixture');
+    }),
       findUnique: vi.fn(),
       update: vi.fn(),
     },
     user: {
       findUnique: vi.fn(),
     },
     cohortMember: {
       findUnique: vi.fn(),
@@ -45,16 +56,18 @@ vi.mock('@/src/server/infrastructure/db/postgres/client', () => ({
     },
     roomParticipant: {
       deleteMany: vi.fn(),
     },
     roomAuditLog: {
       create: vi.fn(),
       findMany: vi.fn(),
     },
+    realtimeStream:{upsert:vi.fn(async()=>({id:'stream',generation:1,eventCounter:1}))},
+    realtimeEvent:{create:vi.fn()},realtimeDelivery:{create:vi.fn()},
     $transaction: vi.fn(async (cb: (tx: any) => Promise<any>) => {
       return cb(prisma);
     }),
   },
 }));
 
 vi.mock('../studyroom.policy', () => ({
   studyroomPolicy: {
@@ -346,16 +359,17 @@ describe('roomGovernanceService', () => {
       } as any);
 
       await expect(
         roomGovernanceService.acceptOwnershipTransfer('room-1', 'transfer-1', 'user-recipient')
       ).rejects.toThrow(RoomConflictError);
     });
 
     it('cancels pending transfer if called by sender, recipient, or owner', async () => {
+      vi.mocked(prisma.studyRoom.findUniqueOrThrow).mockResolvedValueOnce({ownerId:'owner-1'} as any);
       vi.mocked(prisma.roomOwnershipTransfer.findUnique).mockResolvedValue({
         id: 'transfer-1',
         studyRoomId: 'room-1',
         senderId: 'user-owner',
         recipientId: 'user-recipient',
         status: 'PENDING',
         room: { ownerId: 'user-owner' },
       } as any);
diff --git a/src/server/domain/studyroom/__tests__/room-management.service.test.ts b/src/server/domain/studyroom/__tests__/room-management.service.test.ts
--- a/src/server/domain/studyroom/__tests__/room-management.service.test.ts
+++ b/src/server/domain/studyroom/__tests__/room-management.service.test.ts
@@ -1,24 +1,35 @@
 import { describe, it, expect, vi, beforeEach } from 'vitest';
 
+// Database doubles execute serially. The PostgreSQL gate covers real lock interleavings.
+vi.mock('@/src/server/domain/studyroom/room-access', async (load) => ({
+  ...await load<typeof import('@/src/server/domain/studyroom/room-access')>(),
+  lockRooms: vi.fn(), lockUser: vi.fn(),
+}));
 vi.mock('server-only', () => ({}));
 
 import { roomManagementService } from '../room-management.service';
 import { prisma } from '@/src/server/infrastructure/db/postgres/client';
 import {
   RoomNotFoundError,
   RoomForbiddenError,
   RoomConflictError,
   RoomValidationError,
 } from '@/src/shared/studyroom/contracts';
 
 vi.mock('@/src/server/infrastructure/db/postgres/client', () => ({
   prisma: {
     studyRoom: {
+      findUniqueOrThrow: vi.fn(async () => {
+      const model = prisma.studyRoom;
+      const recent = [model.findUnique,model.findFirst].flatMap(fn => vi.isMockFunction(fn) ? fn.mock.results.slice(-1) : []);
+      for (const call of recent) { const room = await call.value; if (room) return room; }
+      throw Error('Missing room fixture');
+    }),
       findUnique: vi.fn(),
       findFirst: vi.fn(),
       create: vi.fn(),
       update: vi.fn(),
       count: vi.fn().mockResolvedValue(0),
     },
     user: {
       findUnique: vi.fn(),
diff --git a/src/server/domain/studyroom/__tests__/sprint.service.test.ts b/src/server/domain/studyroom/__tests__/sprint.service.test.ts
--- a/src/server/domain/studyroom/__tests__/sprint.service.test.ts
+++ b/src/server/domain/studyroom/__tests__/sprint.service.test.ts
@@ -1,23 +1,36 @@
 import { describe, it, expect, vi, beforeEach } from 'vitest';
 
+// Database doubles execute serially. The PostgreSQL gate covers real lock interleavings.
+vi.mock('@/src/server/domain/studyroom/room-access', async (load) => ({
+  ...await load<typeof import('@/src/server/domain/studyroom/room-access')>(),
+  lockRooms: vi.fn(), lockUser: vi.fn(), hasRoomAccess: vi.fn(async()=>true),
+}));
 vi.mock('server-only', () => ({}));
 
+import { hasRoomAccess } from '../room-access';
 import { sprintService } from '../sprint.service';
 import { prisma } from '@/src/server/infrastructure/db/postgres/client';
 import { MessagingConflictError, MessagingForbiddenError, MessagingNotFoundError } from '../../messaging/contracts';
 
 vi.mock('@/src/server/infrastructure/db/postgres/client', () => ({
   prisma: {
     studyRoom: {
+      findUniqueOrThrow: vi.fn(async () => {
+      const model = prisma.studyRoom;
+      const recent = [model.findUnique,model.findFirst].flatMap(fn => vi.isMockFunction(fn) ? fn.mock.results.slice(-1) : []);
+      for (const call of recent) { const room = await call.value; if (room) return room; }
+      throw Error('Missing room fixture');
+    }),
       findUnique: vi.fn(),
       findMany: vi.fn(),
     },
     roomSprint: {
+      findUniqueOrThrow: vi.fn(async()=>await vi.mocked(prisma.roomSprint.findUnique).mock.results.at(-1)?.value),
       create: vi.fn(),
       findUnique: vi.fn(),
       findFirst: vi.fn(),
       update: vi.fn(),
     },
     roomSprintParticipant: {
       create: vi.fn(),
       findUnique: vi.fn(),
@@ -126,16 +139,17 @@ describe('sprintService', () => {
             userId: 'controller-1',
             status: 'JOINED',
           }),
         })
       );
     });
 
     it('rejects startSprint if user is not room controller and controllers exist', async () => {
+      vi.mocked(hasRoomAccess).mockResolvedValueOnce(false);
       vi.mocked(prisma.roomController.findUnique).mockResolvedValueOnce(null);
       vi.mocked(prisma.channel.findFirst).mockResolvedValueOnce(null);
       vi.mocked(prisma.roomController.count).mockResolvedValueOnce(2);
 
       await expect(
         sprintService.startSprint({
           userId: 'intruder-1',
           roomId: 'room-1',
@@ -326,16 +340,17 @@ describe('sprintService', () => {
 
     it('rejects joinSprint if user is not in the study room', async () => {
       vi.mocked(prisma.roomSprint.findUnique).mockResolvedValueOnce({
         id: 'sprint-1',
         studyRoomId: 'room-1',
         status: 'ACTIVE',
       } as any);
 
+      vi.mocked(hasRoomAccess).mockResolvedValueOnce(false);
       vi.mocked(prisma.roomParticipant.findFirst).mockResolvedValueOnce(null);
 
       await expect(sprintService.joinSprint('outsider', 'sprint-1')).rejects.toThrow(
         MessagingForbiddenError
       );
     });
   });
 
diff --git a/src/server/domain/studyroom/__tests__/studyroom-lifecycle.test.ts b/src/server/domain/studyroom/__tests__/studyroom-lifecycle.test.ts
--- a/src/server/domain/studyroom/__tests__/studyroom-lifecycle.test.ts
+++ b/src/server/domain/studyroom/__tests__/studyroom-lifecycle.test.ts
@@ -3,42 +3,57 @@ import { studyRoomService } from '../studyroom.service';
 import { prisma } from '@/src/server/infrastructure/db/postgres/client';
 import { studyroomPolicy } from '../studyroom.policy';
 import {
   RoomNotFoundError,
   RoomForbiddenError,
   RoomQuotaExceededError,
 } from '@/src/shared/studyroom/contracts';
 
+// Database doubles execute serially. The PostgreSQL gate covers real lock interleavings.
+vi.mock('@/src/server/domain/studyroom/room-access', async (load) => ({
+  ...await load<typeof import('@/src/server/domain/studyroom/room-access')>(),
+  lockRooms: vi.fn(), lockUser: vi.fn(),
+}));
 vi.mock('server-only', () => ({}));
 
 vi.mock('@/src/server/domain/studyroom/studyroom.policy', () => ({
   studyroomPolicy: {
     resolveRoomEligibility: vi.fn(),
   },
 }));
 
 vi.mock('@/src/server/infrastructure/db/postgres/client', () => {
   const mockStudyRoom = {
+    updateMany:vi.fn(async()=>({count:1})),
+    findUniqueOrThrow: vi.fn(async () => {
+      const model = prisma.studyRoom;
+      const recent = [model.findUnique,model.findFirst].flatMap(fn => vi.isMockFunction(fn) ? fn.mock.results.slice(-1) : []);
+      for (const call of recent) { const room = await call.value; if (room) return room; }
+      throw Error('Missing room fixture');
+    }),
     findUnique: vi.fn(),
     findFirst: vi.fn(),
     update: vi.fn(),
     findMany: vi.fn(),
   };
 
   const mockRoomParticipant = {
+    updateMany:vi.fn(async()=>({count:1})),
     findUnique: vi.fn(),
     findFirst: vi.fn(),
     findMany: vi.fn(),
     upsert: vi.fn(),
     delete: vi.fn(),
     deleteMany: vi.fn(),
   };
 
   const mockRoomLease = {
+    findFirst:vi.fn(async()=>null),
+    updateMany:vi.fn(async()=>({count:1})),
     findMany: vi.fn(),
     upsert: vi.fn(),
     deleteMany: vi.fn(),
     count: vi.fn(),
     groupBy: vi.fn(),
   };
 
   const mockRoomController = {
@@ -46,25 +61,27 @@ vi.mock('@/src/server/infrastructure/db/postgres/client', () => {
   };
 
   const mockTransaction = vi.fn(async (cb: (tx: any) => Promise<any>) =>
     cb({
       studyRoom: mockStudyRoom,
       roomParticipant: mockRoomParticipant,
       roomLease: mockRoomLease,
       roomController: mockRoomController,
+      realtimeStream:{upsert:vi.fn(async()=>({id:'s',eventCounter:1,generation:1}))},realtimeEvent:{create:vi.fn()},realtimeDelivery:{create:vi.fn()},
     })
   );
 
   return {
     prisma: {
       studyRoom: mockStudyRoom,
       roomParticipant: mockRoomParticipant,
       roomLease: mockRoomLease,
       roomController: mockRoomController,
+      realtimeStream:{upsert:vi.fn(async()=>({id:'s',eventCounter:1,generation:1}))},realtimeEvent:{create:vi.fn()},realtimeDelivery:{create:vi.fn()},
       $transaction: mockTransaction,
     },
   };
 });
 
 describe('Phase 4: Study Room Lifecycle, Lease Fencing & Multi-Tab Presence', () => {
   beforeEach(() => {
     vi.clearAllMocks();
@@ -285,16 +302,18 @@ describe('Phase 4: Study Room Lifecycle, Lease Fencing & Multi-Tab Presence', ()
         where: { id: 'room-old' },
         data: { onlineCount: 0 },
       });
     });
   });
 
   describe('renewLease', () => {
     it('renews active lease by extending expiresAt when generation matches', async () => {
+      vi.mocked(prisma.studyRoom.findUnique).mockResolvedValue({id:'room-1'} as any);
+      vi.mocked(studyroomPolicy.resolveRoomEligibility).mockResolvedValueOnce({eligible:true,reason:'ELIGIBLE'});
       vi.mocked(prisma.studyRoom.findUnique).mockResolvedValueOnce({
         id: 'room-1',
       } as any);
 
       vi.mocked(prisma.roomParticipant.findUnique).mockResolvedValueOnce({
         userId: 'user-1',
         studyRoomId: 'room-1',
         generation: 1,
@@ -309,17 +328,18 @@ describe('Phase 4: Study Room Lifecycle, Lease Fencing & Multi-Tab Presence', ()
       const result = await studyRoomService.renewLease({
         userId: 'user-1',
         roomId: 'room-1',
         tabId: 'tab-1',
         generation: 1,
       });
 
       expect(result.success).toBe(true);
-      expect(result.expiresAt).toBe(newExpiresAt.toISOString());
+      expect(Date.parse(result.expiresAt!)).toBeGreaterThan(Date.now()+85000);
+      expect(prisma.roomLease.updateMany).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({expiresAt:{gt:expect.any(Date)}})}));
     });
 
     it('rejects stale generation renewal from an old room session', async () => {
       vi.mocked(prisma.studyRoom.findUnique).mockResolvedValueOnce({
         id: 'room-1',
       } as any);
 
       // Current participant generation is 2 (switched room)
@@ -359,49 +379,53 @@ describe('Phase 4: Study Room Lifecycle, Lease Fencing & Multi-Tab Presence', ()
       expect(result.success).toBe(false);
       expect(result.reason).toBe('not_in_room');
     });
   });
 
   describe('leaveRoom', () => {
     it('closing tab 1 when tab 2 is open: deletes tab 1 lease, user remains in room', async () => {
       vi.mocked(prisma.roomParticipant.findUnique).mockResolvedValueOnce({
+        generation: 1,
         userId: 'user-1',
         studyRoomId: 'room-1',
       } as any);
 
       // Remaining active leases = 1 (tab 2 still open)
       vi.mocked(prisma.roomLease.count).mockResolvedValueOnce(1);
       vi.mocked(prisma.roomLease.groupBy).mockResolvedValueOnce([{ userId: 'user-1' }] as any);
 
       const result = await studyRoomService.leaveRoom({
+        generation:1,
         userId: 'user-1',
         roomId: 'room-1',
         tabId: 'tab-1',
       });
 
       expect(result.success).toBe(true);
       expect(result.left).toBe(false);
       expect(result.remainingLeases).toBe(1);
 
       // Participant row should NOT be deleted
       expect(prisma.roomParticipant.delete).not.toHaveBeenCalled();
     });
 
     it('closing last active tab: deletes participant row and decrements room occupancy', async () => {
       vi.mocked(prisma.roomParticipant.findUnique).mockResolvedValueOnce({
+        generation: 1,
         userId: 'user-1',
         studyRoomId: 'room-1',
       } as any);
 
       // Remaining active leases = 0
       vi.mocked(prisma.roomLease.count).mockResolvedValueOnce(0);
       vi.mocked(prisma.roomLease.groupBy).mockResolvedValueOnce([]);
 
       const result = await studyRoomService.leaveRoom({
+        generation:1,
         userId: 'user-1',
         roomId: 'room-1',
         tabId: 'tab-1',
       });
 
       expect(result.success).toBe(true);
       expect(result.left).toBe(true);
       expect(result.remainingLeases).toBe(0);
@@ -439,33 +463,24 @@ describe('Phase 4: Study Room Lifecycle, Lease Fencing & Multi-Tab Presence', ()
       expect(prisma.roomParticipant.delete).toHaveBeenCalledWith({
         where: { userId: 'user-1' },
       });
     });
   });
 
   describe('reconcileExpiredLeases', () => {
     it('prunes expired leases and evicts ghost participants', async () => {
-      vi.mocked(prisma.roomLease.deleteMany).mockResolvedValueOnce({ count: 5 } as any);
-      vi.mocked(prisma.roomParticipant.findMany).mockResolvedValueOnce([
-        { id: 'p-1', userId: 'user-ghost', studyRoomId: 'room-1' },
-        { id: 'p-2', userId: 'user-active', studyRoomId: 'room-1' },
-      ] as any);
-      vi.mocked(prisma.roomLease.findMany).mockResolvedValueOnce([
-        { userId: 'user-active', studyRoomId: 'room-1' },
-      ] as any);
-      vi.mocked(prisma.studyRoom.findMany).mockResolvedValueOnce([{ id: 'room-1' }] as any);
-      vi.mocked(prisma.roomLease.groupBy).mockResolvedValueOnce([{ userId: 'user-active' }] as any);
-
-      const result = await studyRoomService.reconcileExpiredLeases();
-
-      expect(result.evictedLeasesCount).toBe(5);
-      expect(result.evictedParticipantsCount).toBe(1);
-      expect(prisma.roomParticipant.deleteMany).toHaveBeenCalledWith({
-        where: { id: { in: ['p-1'] } },
-      });
-      expect(prisma.studyRoom.update).toHaveBeenCalledWith({
-        where: { id: 'room-1' },
-        data: { onlineCount: 1 },
-      });
+      const candidate = {id:'expired',userId:'ghost',studyRoomId:'room-1',generation:3};
+      vi.mocked(prisma.roomLease.findMany).mockResolvedValueOnce([candidate] as any);
+      vi.mocked(prisma.roomLease.deleteMany).mockResolvedValueOnce({count:1});
+      vi.mocked(prisma.roomLease.count).mockResolvedValueOnce(0);
+      vi.mocked(prisma.roomParticipant.deleteMany).mockResolvedValueOnce({count:1});
+      vi.mocked(prisma.roomLease.groupBy).mockResolvedValueOnce([{userId:'alive'}] as any);
+      const result = await studyRoomService.reconcileExpiredLeases({batchSize:10,gracePeriodMs:5000});
+      expect(result).toMatchObject({evictedLeasesCount:1,evictedParticipantsCount:1,updatedRoomsCount:1});
+      expect(result.durationMs).toBeGreaterThanOrEqual(0);
+      expect(prisma.roomLease.findMany).toHaveBeenCalledWith(expect.objectContaining({take:10,where:{expiresAt:{lte:expect.any(Date)}}}));
+      expect(prisma.roomLease.deleteMany).toHaveBeenCalledWith({where:{id:'expired',expiresAt:{lte:expect.any(Date)}}});
+      expect(prisma.roomParticipant.deleteMany).toHaveBeenCalledWith({where:{userId:'ghost',studyRoomId:'room-1',generation:3}});
+      expect(prisma.studyRoom.updateMany).toHaveBeenCalledWith({where:{id:'room-1',onlineCount:{not:1}},data:{onlineCount:1}});
     });
   });
 });
diff --git a/src/server/domain/studyroom/__tests__/studyroom-postgres-hardening.test.ts b/src/server/domain/studyroom/__tests__/studyroom-postgres-hardening.test.ts
new file mode 100644
--- /dev/null
+++ b/src/server/domain/studyroom/__tests__/studyroom-postgres-hardening.test.ts
@@ -0,0 +1,55 @@
+import { randomUUID } from 'node:crypto';
+import { describe, expect, it, vi } from 'vitest';
+import { prisma } from '@/src/server/infrastructure/db/postgres/client';
+import { roomManagementService as management } from '../room-management.service';
+import { roomGovernanceService as governance } from '../room-governance.service';
+import { studyRoomService as rooms } from '../studyroom.service';
+import { sprintService } from '../sprint.service';
+import { hasRoomAccess } from '../room-access';
+
+vi.mock('server-only',()=>({}));
+describe.runIf(process.env.STUDYROOM_PG_GATE === '1')('Studyroom PostgreSQL release gate',()=>{
+  it('serializes slot, quota, revision and transfer races and fences old assignments',async()=>{
+    const url = new URL(process.env.DATABASE_URL || '');
+    if (!['localhost','127.0.0.1','[::1]'].includes(url.hostname) || url.pathname !== '/studyroom_handoff_test') {
+      throw Error('Use a disposable loopback database named studyroom_handoff_test');
+    }
+    const marker = 'handoff-'+randomUUID();
+    const ids = ['owner','a','b','c'].map(role=>marker+'-'+role);
+    const [owner,a,b,c]=ids;
+    await prisma.user.createMany({data:ids.map(id=>({id,name:id}))});
+    try {
+      const intent={title:marker,requestId:marker,scopeKind:'STANDALONE' as const,publishImmediately:true,capacity:2};
+      const [one,two]=await Promise.all([management.createRoom(intent,owner),management.createRoom(intent,owner)]);
+      expect(two.id).toBe(one.id);
+      const host=await rooms.joinRoom({roomId:one.id,userId:owner,tabId:'host'});
+      const seats=await Promise.allSettled([a,b].map(userId=>rooms.joinRoom({roomId:one.id,userId,tabId:'tab'})));
+      expect(seats.filter(r=>r.status==='fulfilled')).toHaveLength(1);
+      const guest=seats[0].status==='fulfilled'?a:b;
+      const outsider=guest===a?b:a;
+      await governance.setController(one.id,guest,'HOST',owner);
+      expect(await hasRoomAccess(one.id,guest,true)).toBe(true);
+      expect(await hasRoomAccess(one.id,outsider)).toBe(false);
+      await rooms.updateParticipantGoal({roomId:one.id,userId:owner,tabId:'host',generation:host.generation,publicGoal:'Review'});
+      expect((await rooms.getRoomRoster(one.id,guest)).find(p=>p.userId===owner)?.publicGoal).toBe('Review');
+      const edits=await Promise.allSettled(['first','second'].map(title=>management.updateRoomSettings(one.slug,{title,expectedRevision:1},owner)));
+      expect(edits.filter(r=>r.status==='fulfilled')).toHaveLength(1);
+      expect((await sprintService.resolveRoom(one.slug))?.id).toBe(one.id);
+      const offer=await governance.proposeOwnershipTransfer(one.id,c,2,owner);
+      const handoff=await Promise.allSettled([governance.acceptOwnershipTransfer(one.id,offer.id,c),governance.cancelOwnershipTransfer(one.id,offer.id,owner)]);
+      expect(handoff.filter(r=>r.status==='fulfilled')).toHaveLength(1);
+      const transfer=await prisma.roomOwnershipTransfer.findUniqueOrThrow({where:{id:offer.id}});
+      expect((await prisma.studyRoom.findUniqueOrThrow({where:{id:one.id}})).ownerId).toBe(transfer.status==='ACCEPTED'?c:owner);
+      await prisma.roomLease.updateMany({where:{studyRoomId:one.id,userId:guest},data:{expiresAt:new Date(0)}});
+      expect(await hasRoomAccess(one.id,guest,true)).toBe(false);
+      expect((await rooms.renewLease({roomId:one.id,userId:guest,tabId:'tab',generation:1})).success).toBe(false);
+      await rooms.reconcileExpiredLeases();
+      expect(await prisma.roomParticipant.findUnique({where:{userId:guest}})).toBeNull();
+      const quota=await Promise.allSettled(Array.from({length:4},(_,index)=>management.createRoom({...intent,title:marker+'-'+index,requestId:marker+'-'+index},outsider)));
+      expect(quota.filter(r=>r.status==='fulfilled')).toHaveLength(3);
+    } finally {
+      await prisma.studyRoom.deleteMany({where:{ownerId:{in:ids}}});
+      await prisma.user.deleteMany({where:{id:{in:ids}}});
+    }
+  });
+});
diff --git a/src/server/domain/studyroom/__tests__/studyroom.service.test.ts b/src/server/domain/studyroom/__tests__/studyroom.service.test.ts
--- a/src/server/domain/studyroom/__tests__/studyroom.service.test.ts
+++ b/src/server/domain/studyroom/__tests__/studyroom.service.test.ts
@@ -1,49 +1,64 @@
 /* eslint-disable @typescript-eslint/no-explicit-any */
 import { describe, expect, it, vi, beforeEach } from 'vitest';
 import { studyRoomService } from '../studyroom.service';
 import { prisma } from '@/src/server/infrastructure/db/postgres/client';
 
+// Database doubles execute serially. The PostgreSQL gate covers real lock interleavings.
+vi.mock('@/src/server/domain/studyroom/room-access', async (load) => ({
+  ...await load<typeof import('@/src/server/domain/studyroom/room-access')>(),
+  lockRooms: vi.fn(), lockUser: vi.fn(),
+}));
 vi.mock('server-only', () => ({}));
 
 vi.mock('@/src/server/domain/studyroom/studyroom.policy', () => ({
   studyroomPolicy: {
     resolveRoomEligibility: vi.fn().mockResolvedValue({ eligible: true, reason: 'ELIGIBLE' }),
     validateRoomSlug: vi.fn((slug: string) => slug),
   },
 }));
 
 vi.mock('@/src/server/infrastructure/db/postgres/client', () => {
   const mockStudyRoom = {
+    updateMany:vi.fn(async()=>({count:1})),
+    findUniqueOrThrow: vi.fn(async () => {
+      const model = prisma.studyRoom;
+      const recent = [model.findUnique,model.findFirst].flatMap(fn => vi.isMockFunction(fn) ? fn.mock.results.slice(-1) : []);
+      for (const call of recent) { const room = await call.value; if (room) return room; }
+      throw Error('Missing room fixture');
+    }),
     count: vi.fn(),
     findMany: vi.fn(),
     findUnique: vi.fn(),
     create: vi.fn(),
     update: vi.fn(),
   };
 
   const mockChannel = {
     create: vi.fn(),
   };
 
   const mockRealtimeStream = {
+    upsert:vi.fn(async()=>({id:'s',eventCounter:1,generation:1})),
     create: vi.fn(),
   };
 
   const mockRoomParticipant = {
+    updateMany:vi.fn(async()=>({count:1})),
     findMany: vi.fn(),
     findUnique: vi.fn(),
     create: vi.fn(),
     upsert: vi.fn(),
     delete: vi.fn(),
     deleteMany: vi.fn(),
   };
 
   const mockRoomLease = {
+    updateMany:vi.fn(async()=>({count:1})),
     findMany: vi.fn(),
     findFirst: vi.fn(),
     findUnique: vi.fn(),
     upsert: vi.fn(),
     deleteMany: vi.fn(),
     count: vi.fn(),
     groupBy: vi.fn(),
   };
@@ -58,30 +73,34 @@ vi.mock('@/src/server/infrastructure/db/postgres/client', () => {
   };
 
   const mockTransaction = vi.fn(async (callback) => {
     if (typeof callback === 'function') {
       return callback({
         studyRoom: mockStudyRoom,
         channel: mockChannel,
         realtimeStream: mockRealtimeStream,
+        realtimeEvent: { create: vi.fn() },
+        realtimeDelivery: { create: vi.fn() },
         roomParticipant: mockRoomParticipant,
         roomLease: mockRoomLease,
         roomRestriction: mockRoomRestriction,
         cohortMember: mockCohortMember,
       });
     }
     return Promise.all(callback);
   });
 
   return {
     prisma: {
       studyRoom: mockStudyRoom,
       channel: mockChannel,
       realtimeStream: mockRealtimeStream,
+        realtimeEvent: { create: vi.fn() },
+        realtimeDelivery: { create: vi.fn() },
       roomParticipant: mockRoomParticipant,
       roomLease: mockRoomLease,
       roomRestriction: mockRoomRestriction,
       cohortMember: mockCohortMember,
       $transaction: mockTransaction,
     },
   };
 });
@@ -284,16 +303,17 @@ describe('Phase 8: Study Room Membership & Lease Domain Service', () => {
       expect(prisma.studyRoom.update).toHaveBeenCalledWith(
         expect.objectContaining({ where: { id: 'room-new' }, data: { onlineCount: 1 } })
       );
     });
   });
 
   describe('renewLease & Stale Generation Rejection', () => {
     it('renews lease when generation matches', async () => {
+      vi.mocked(prisma.studyRoom.findUnique).mockResolvedValue({id:'room-1'} as any);
       vi.mocked(prisma.roomParticipant.findUnique).mockResolvedValueOnce({
         userId: 'user-1',
         studyRoomId: 'room-1',
         generation: 3,
       } as any);
 
       const newExpiry = new Date(Date.now() + 90000);
       vi.mocked(prisma.roomLease.upsert).mockResolvedValueOnce({
@@ -303,17 +323,18 @@ describe('Phase 8: Study Room Membership & Lease Domain Service', () => {
       const result = await studyRoomService.renewLease({
         userId: 'user-1',
         roomId: 'room-1',
         tabId: 'tab-alpha',
         generation: 3,
       });
 
       expect(result.success).toBe(true);
-      expect(result.expiresAt).toBe(newExpiry.toISOString());
+      expect(Date.parse(result.expiresAt!)).toBeGreaterThan(Date.now()+85000);
+      expect(prisma.roomLease.updateMany).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({expiresAt:{gt:expect.any(Date)}})}));
     });
 
     it('rejects stale generation without modifying room membership', async () => {
       // Participant is now in generation 4 (e.g. switched rooms)
       vi.mocked(prisma.roomParticipant.findUnique).mockResolvedValueOnce({
         userId: 'user-1',
         studyRoomId: 'room-1',
         generation: 4,
@@ -359,84 +380,72 @@ describe('Phase 8: Study Room Membership & Lease Domain Service', () => {
         expect.objectContaining({
           where: { userId: 'user-1' },
         })
       );
     });
 
     it('closing one tab does not evict user when other tabs remain', async () => {
       vi.mocked(prisma.roomParticipant.findUnique).mockResolvedValueOnce({
+        generation: 1,
         userId: 'user-1',
         studyRoomId: 'room-1',
       } as any);
 
       // 1 other active lease remains
       vi.mocked(prisma.roomLease.count).mockResolvedValueOnce(1);
       vi.mocked(prisma.roomLease.groupBy).mockResolvedValueOnce([{ userId: 'user-1' } as any]);
 
       const result = await studyRoomService.leaveRoom({
+        generation:1,
         userId: 'user-1',
         roomId: 'room-1',
         tabId: 'tab-closed',
         global: false,
       });
 
       expect(result.success).toBe(true);
       expect(result.left).toBe(false); // User still in room
       expect(result.remainingLeases).toBe(1);
       // Only that tab's lease was deleted
       expect(prisma.roomLease.deleteMany).toHaveBeenCalledWith({
-        where: { userId: 'user-1', tabId: 'tab-closed' },
+        where: { userId: 'user-1', tabId: 'tab-closed',studyRoomId:'room-1',generation:1 },
       });
       // Participant row was NOT deleted
       expect(prisma.roomParticipant.delete).not.toHaveBeenCalled();
     });
   });
 
   describe('reconcileExpiredLeases', () => {
     it('evicts expired leases and ghost participants without active leases', async () => {
-      vi.mocked(prisma.roomLease.deleteMany).mockResolvedValueOnce({ count: 5 } as any);
-      vi.mocked(prisma.roomParticipant.findMany).mockResolvedValueOnce([
-        { id: 'p-ghost', userId: 'user-dead', studyRoomId: 'room-1' },
-        { id: 'p-alive', userId: 'user-active', studyRoomId: 'room-1' },
-      ] as any);
-
-      // Only user-active has an unexpired lease
-      vi.mocked(prisma.roomLease.findMany).mockResolvedValueOnce([
-        { userId: 'user-active', studyRoomId: 'room-1' },
-      ] as any);
-
-      vi.mocked(prisma.studyRoom.findMany).mockResolvedValueOnce([{ id: 'room-1' }] as any);
-      vi.mocked(prisma.roomLease.groupBy).mockResolvedValueOnce([{ userId: 'user-active' } as any]);
-
-      const result = await studyRoomService.reconcileExpiredLeases();
-
-      expect(result.evictedLeasesCount).toBe(5);
-      expect(result.evictedParticipantsCount).toBe(1); // p-ghost removed
-      expect(prisma.roomParticipant.deleteMany).toHaveBeenCalledWith({
-        where: { id: { in: ['p-ghost'] } },
-      });
-      expect(prisma.studyRoom.update).toHaveBeenCalledWith(
-        expect.objectContaining({
-          where: { id: 'room-1' },
-          data: { onlineCount: 1 },
-        })
-      );
+      const candidate = {id:'expired',userId:'ghost',studyRoomId:'room-1',generation:3};
+      vi.mocked(prisma.roomLease.findMany).mockResolvedValueOnce([candidate] as any);
+      vi.mocked(prisma.roomLease.deleteMany).mockResolvedValueOnce({count:1});
+      vi.mocked(prisma.roomLease.count).mockResolvedValueOnce(0);
+      vi.mocked(prisma.roomParticipant.deleteMany).mockResolvedValueOnce({count:1});
+      vi.mocked(prisma.roomLease.groupBy).mockResolvedValueOnce([{userId:'alive'}] as any);
+      const result = await studyRoomService.reconcileExpiredLeases({batchSize:10,gracePeriodMs:5000});
+      expect(result).toMatchObject({evictedLeasesCount:1,evictedParticipantsCount:1,updatedRoomsCount:1});
+      expect(result.durationMs).toBeGreaterThanOrEqual(0);
+      expect(prisma.roomLease.findMany).toHaveBeenCalledWith(expect.objectContaining({take:10,where:{expiresAt:{lte:expect.any(Date)}}}));
+      expect(prisma.roomLease.deleteMany).toHaveBeenCalledWith({where:{id:'expired',expiresAt:{lte:expect.any(Date)}}});
+      expect(prisma.roomParticipant.deleteMany).toHaveBeenCalledWith({where:{userId:'ghost',studyRoomId:'room-1',generation:3}});
+      expect(prisma.studyRoom.updateMany).toHaveBeenCalledWith({where:{id:'room-1',onlineCount:{not:1}},data:{onlineCount:1}});
     });
   });
 
   describe('updateParticipantGoal & Roster Projection (Phase 10)', () => {
     it('successfully updates publicGoal for an active lease and projects it in roster', async () => {
       vi.mocked(prisma.studyRoom.findUnique).mockResolvedValueOnce({
         id: 'room-1',
         slug: 'fireplace',
         ownerId: 'owner-1',
       } as any);
 
-      vi.mocked(prisma.roomLease.findFirst).mockResolvedValueOnce({
+      vi.mocked(prisma.roomLease.findFirst).mockResolvedValue({
         id: 'lease-1',
         userId: 'user-1',
         studyRoomId: 'room-1',
         tabId: 'tab-1',
         generation: 1,
         expiresAt: new Date(Date.now() + 60_000),
       } as any);
 
@@ -458,17 +467,17 @@ describe('Phase 8: Study Room Membership & Lease Domain Service', () => {
       } as any);
 
       vi.mocked(prisma.roomLease.findMany).mockResolvedValueOnce([
         { userId: 'user-1' },
       ] as any);
 
       vi.mocked(prisma.roomParticipant.findMany).mockResolvedValueOnce([
         {
-          id: 'p-1',
+          id: 'p-1',publicGoal:'Finish LeetCode Problem 42',
           userId: 'user-1',
           joinedAt: new Date(),
           user: { id: 'user-1', name: 'User 1', username: 'u1', image: null },
         },
       ] as any);
 
       const roster = await studyRoomService.getRoomRoster('room-1');
       expect(roster.length).toBe(1);
@@ -477,17 +486,17 @@ describe('Phase 8: Study Room Membership & Lease Domain Service', () => {
 
     it('clears publicGoal when empty or null is passed', async () => {
       vi.mocked(prisma.studyRoom.findUnique).mockResolvedValueOnce({
         id: 'room-1',
         slug: 'fireplace',
         ownerId: 'owner-1',
       } as any);
 
-      vi.mocked(prisma.roomLease.findFirst).mockResolvedValueOnce({
+      vi.mocked(prisma.roomLease.findFirst).mockResolvedValue({
         id: 'lease-1',
         userId: 'user-1',
         studyRoomId: 'room-1',
         tabId: 'tab-1',
         generation: 1,
         expiresAt: new Date(Date.now() + 60_000),
       } as any);
 
@@ -504,17 +513,17 @@ describe('Phase 8: Study Room Membership & Lease Domain Service', () => {
     });
 
     it('rejects goal update when no active lease matches', async () => {
       vi.mocked(prisma.studyRoom.findUnique).mockResolvedValueOnce({
         id: 'room-1',
       } as any);
 
       // No lease found
-      vi.mocked(prisma.roomLease.findFirst).mockResolvedValueOnce(null);
+      vi.mocked(prisma.roomLease.findFirst).mockResolvedValue(null);
 
       await expect(
         studyRoomService.updateParticipantGoal({
           userId: 'user-imposter',
           roomId: 'room-1',
           tabId: 'tab-1',
           generation: 1,
           publicGoal: 'Unauthorized Goal',
diff --git a/src/server/infrastructure/db/postgres/repositories/studyRoom.repo.ts b/src/server/infrastructure/db/postgres/repositories/studyRoom.repo.ts
--- a/src/server/infrastructure/db/postgres/repositories/studyRoom.repo.ts
+++ b/src/server/infrastructure/db/postgres/repositories/studyRoom.repo.ts
@@ -21,19 +21,19 @@ export const studyRoomRepo = {
       },
     });
   },
   seedRooms: async () => {
     const count = await prisma.studyRoom.count();
     if (count === 0) {
       await prisma.studyRoom.createMany({
         data: [
-          { title: 'Fireplace', slug: 'fireplace', thumbnail: '/rooms/fireplace.jpg', status: 'OPEN', listing: 'PUBLIC', visualPresetId: 'cozy-fireplace' },
-          { title: 'Library', slug: 'library', thumbnail: '/rooms/library.jpg', status: 'OPEN', listing: 'PUBLIC', visualPresetId: 'library' },
-          { title: 'Developer Den', slug: 'developer-den', thumbnail: '/rooms/dev-den.jpg', status: 'OPEN', listing: 'PUBLIC', visualPresetId: 'night-sky' },
+          { title: 'Fireplace', slug: 'fireplace', thumbnail: '/rooms/fireplace.jpg', status: 'OPEN', listing: 'LISTED', visualPresetId: 'cozy-fireplace' },
+          { title: 'Library', slug: 'library', thumbnail: '/rooms/library.jpg', status: 'OPEN', listing: 'LISTED', visualPresetId: 'library' },
+          { title: 'Developer Den', slug: 'developer-den', thumbnail: '/rooms/dev-den.jpg', status: 'OPEN', listing: 'LISTED', visualPresetId: 'night-sky' },
         ],
       });
     }
   },
 
   incrementOnlineCount: async (studyRoomId: string) => {
     return await prisma.studyRoom.update({
       where: { id: studyRoomId },
diff --git a/src/server/messaging-worker.ts b/src/server/messaging-worker.ts
--- a/src/server/messaging-worker.ts
+++ b/src/server/messaging-worker.ts
@@ -1,9 +1,10 @@
 import 'server-only';
+import { studyRoomService } from './domain/studyroom/studyroom.service';
 import { randomUUID } from 'node:crypto';
 import { prisma } from './infrastructure/db/postgres/client';
 import { MessagingOutboxDispatcher } from './infrastructure/realtime/dispatcher';
 import { defaultRealtimeTransport, type RealtimeTransport } from './infrastructure/realtime/transport';
 
 export interface MessagingWorkerOptions {
   workerId?: string;
   pollIntervalMs?: number;
@@ -26,28 +27,33 @@ export async function runMessagingWorkerLoop(
   const transport = options.transport ?? defaultRealtimeTransport;
 
   const dispatcher = new MessagingOutboxDispatcher({
     workerId,
     batchSize,
     leaseDurationMs,
   });
 
+  let nextRoomCleanup = Date.now() + 30_000;
   let lastHeartbeat = Date.now();
   console.log(`[messaging-worker] Started worker ${workerId}`);
 
   let iterations = 0;
   while (!signal.aborted && (options.maxIterations === undefined || iterations++ < options.maxIterations)) {
     try {
       const now = Date.now();
       if (now - lastHeartbeat >= heartbeatIntervalMs) {
         console.log(`[messaging-worker] Heartbeat: ${workerId} active at ${new Date().toISOString()}`);
         lastHeartbeat = now;
       }
 
+      if (now >= nextRoomCleanup) {
+        nextRoomCleanup = now + 30_000;
+        await studyRoomService.reconcileExpiredLeases({batchSize:50});
+      }
       const result = await dispatcher.dispatchBatch(transport, { batchSize });
 
       if (result.claimedCount > 0) {
         // More pending work may be waiting; yield shortly without full idle poll
         await new Promise(resolve => setTimeout(resolve, 50));
         continue;
       }
 
diff --git a/src/shared/studyroom/contracts.ts b/src/shared/studyroom/contracts.ts
--- a/src/shared/studyroom/contracts.ts
+++ b/src/shared/studyroom/contracts.ts
@@ -253,16 +253,17 @@ export interface RoomBootstrapResponse {
   viewer: {
     userId: string | null;
     role: RoomRole;
     isJoined: boolean;
     leaseExpiresAt: string | null;
     generation: number | null;
   };
   capabilities: RoomCapabilities;
+  chatGeneration?: number;
   pendingTransfer?: OwnershipTransferDTO | null;
   channelId?: string | null;
   environment?: RoomEnvironmentBootstrapDTO | null;
   sprint?: RoomSprintBootstrapDTO | null;
   serverTime?: string;
 }
 
 /* ─────────────────────────────────────────────────────────────────
diff --git a/prisma/schema.prisma b/prisma/schema.prisma
--- a/prisma/schema.prisma
+++ b/prisma/schema.prisma
@@ -850,16 +850,17 @@ model StudyRoom {
 
   @@index([ownerId, status])
   @@index([cohortId, status, listing])
   @@index([listing, status, createdAt])
   @@map("study_rooms")
 }
 
 model RoomParticipant {
+  publicGoal  String?
   id          String    @id @default(cuid())
   userId      String    @unique
   studyRoomId String
   generation  Int       @default(1)
 
   user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
   room      StudyRoom @relation(fields: [studyRoomId], references: [id], onDelete: Cascade)
   joinedAt  DateTime  @default(now())
@@ -1329,11 +1330,8 @@ model MessageModerationAudit {
 model RateLimitBucket {
   key       String   @id
   count     Int      @default(0)
   expiresAt DateTime
 
   @@index([expiresAt])
   @@map("rate_limit_buckets")
 }
-
-
-
diff --git a/prisma/sql/messaging/studyroom-membership-hardening.sql b/prisma/sql/messaging/studyroom-membership-hardening.sql
new file mode 100644
--- /dev/null
+++ b/prisma/sql/messaging/studyroom-membership-hardening.sql
@@ -0,0 +1,5 @@
+BEGIN;
+ALTER TABLE room_participants ADD COLUMN IF NOT EXISTS "publicGoal" text;
+CREATE UNIQUE INDEX IF NOT EXISTS room_create_intent_key ON room_audit_logs ("actorId","clientRequestId") WHERE action='ROOM_CREATED' AND "clientRequestId" IS NOT NULL;
+UPDATE study_rooms SET listing='LISTED' WHERE listing='PUBLIC';
+COMMIT;
```

End of complete handoff.

