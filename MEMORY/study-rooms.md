# Studyroom operational memory

> **Maintenance requirement for agents:** Update this file in the same change whenever you change Studyroom behavior, permissions, data ownership, realtime delivery, costs, or verification. Record the affected entry points, the new behavior, and the check that verified it. When closing an audit finding, cite its ID and the revision or test that demonstrates closure.

## Start here

At revision `3aab4162` on 2026-11-05, the audit found 14 high- and 13 medium-severity issues. All 559 focused repository tests passed, while 10 additional isolated reproductions demonstrated failures. Two authenticated browsers on a live PostgreSQL/Centrifugo stack and production billing remain unverified. Use the dated report for triggers, file/line references, evidence strength and acceptance checks. [Investigation report](../plans/studyroom/2026-11-05-studyroom-investigation.md)

## Follow a user through the system

Paths in the table use three roots: **UI** = `src/client/screens/dashboard/studyroom/`, **API** = `src/app/api/studyroom/`, **domain** = `src/server/domain/studyroom/`.

| Operation | Production entry points and boundaries |
|---|---|
| Discover and create | `src/app/(dashboard)/studyroom/page.tsx` → UI `StudyRoomScreen.tsx`, `components/CreateRoomModal.tsx` → API `route.ts` (query-backed directory), `cohorts/route.ts`, `rooms/route.ts` → domain `room-discovery.service.ts`, `room-management.service.ts`. Creation provisions the room, chat channel, room stream, environment and audit record in one transaction. The unparameterized directory GET follows a separate cached legacy path. |
| Enter, leave or switch tabs | `src/app/(dashboard)/studyroom/[roomSlug]/page.tsx` → UI `room/RoomScreen.tsx`, `hooks/useRoomOrchestration.ts` → `src/client/repositories/studyRoomRepository.ts` → bootstrap, join, renew, leave and sync → domain `studyroom.service.ts`. A participant row identifies the user's selected room. Tab leases carry expiry and assignment generation. Count distinct live users for seats. The stage uses useRoomOrchestration; useRoomLifecycle is an older hook. |
| Change room or authority | UI `components/RoomSettingsModal.tsx`, `room/components/ParticipantActionsMenu.tsx` → slug-scoped lifecycle, controllers, restrictions, participant removal, ownership-transfer and audit routes. Domain `studyroom.policy.ts` defines eligibility, capabilities, hierarchy and quotas. `room-management.service.ts` owns settings/lifecycle/bootstrap. `room-governance.service.ts` owns roles, moderation and handoff. |
| Receive peer changes | `src/client/realtime/RealtimeContext.tsx` and `subscription-registry.ts` manage the socket and channel handlers. Domain mutations write events and pending deliveries. `src/server/messaging-worker.ts` dispatches them. `src/server/domain/messaging/{manifest,proxy-auth}.service.ts` build subscriptions and authorize subscribe/refresh. Room events, room chat and the personal timer use separate streams. [Transport and worker memory](messaging-and-centrifugo.md) |
| Shared vs personal state | UI `hooks/useRoomRoster.ts`, `useRoomChat.ts`, `useRoomSprint.ts`, `useSharedEnvironment.ts` consume presence, public goals, messages, group sprint, scene and music/soundscape selection. Domain `sprint.service.ts` and `environment.service.ts` persist shared controls. Personal Pomodoro uses `usePomodoro.ts`, `session.service.ts` and the user's own stream. Personal mute and audio rendering run locally via `useAmbientPlayback.ts` and `utils/ambientEngine.ts`. The session panel also uses the unified task store. |
| Contracts, storage and operations | `src/shared/studyroom/contracts.ts` defines DTOs, roles and limits. Check `prisma/schema.prisma` and `prisma/sql/messaging/studyroom-phase1-product-foundation.sql` for persisted constraints and legacy data. Domain `studyroom-metrics.service.ts` and `studyroom-rollout.service.ts` contain operational helpers. Inspect their actual callers when assessing deployment. |

## Authority contract

An eligible signed-in user may join an open room within capacity. Cohort rooms require enrollment. A participant can chat, join a group sprint and publish their own goal. A **host** adds shared environment and sprint control while present. A **moderator** adds moderation of lower-ranked members. Cohort governance can confer moderator authority. The **owner** manages room settings, lifecycle, delegated roles and transfer proposals. Only the designated recipient accepts a transfer. Platform-admin overrides depend on trusted role propagation. Recheck the direct HTTP handler, service predicate, bootstrap capability and rendered control for each change. They diverged at the audited revision.

## Known failure paths to recheck

The IDs below refer to the dated investigation. Reproduce against the current checkout before editing.

- **Privacy and admission (H02–H05, H08, H13).** An unknown discovery tab dropped cohort scoping. Denied bootstrap returned shared state and sprint GET exposed participant identities. Invalid create scope bypassed quota checks. Unlisted first-time invitees could receive 404. Retained role/participant rows authorized some operations after departure or lease expiry.
- **Creation and management (H06, H09, M01, M07, M11, M13).** Owners could strand a draft or closed room behind the admission screen. Some handlers resolved a title-derived slug by scanning all rooms. Check duplicate titles, renames, consecutive draft creation, lost-response retries, directory pagination and legacy PUBLIC versus current LISTED rows.
- **Role changes and races (H07, H10–H11, M02, M05–M06).** Fresh join retained pre-lease capabilities. An already-open peer could miss promotion, demotion or ownership handoff. Check the target's controls and the former owner's controls. Race last-seat joins, close versus join, revision conflicts, accept versus cancel and delayed leave after re-entry.
- **Realtime and recovery (H01, H12, H14, M03–M04, M10, M12).** Cold mount could acquire a channel before client setup. A warm mount could resubscribe repeatedly. Missed events, a runtime denial, or a failed first join could leave the stage stale. Public goals used a process-local map. Test two instances, a cleared soundscape, chat during history load, and reconnect after the other client goes quiet.
- **Cost and cleanup (M08–M09).** At the audited defaults, one uninterrupted joined tab schedules 240 roster GETs and 120 renewal POSTs per hour. Room events and focus can trigger more full-roster reads. Lease TTL is 90 seconds. No runtime caller was found for reconcileExpiredLeases; the implementation scanned all rooms and emitted even for unchanged counts. Measure requests, DB work, outbox deliveries and bytes per occupied seat-hour.

## Verification

1. Run `npx vitest run studyroom` from repository root for the focused regression suite. Phase-labelled E2E tests include in-memory database doubles. The load harness at `scripts/load/studyroom-load-harness.ts` uses synthetic timings.
2. In an isolated deployment with PostgreSQL, Centrifugo and the messaging worker, use independently authenticated browser profiles. Exercise create → share → join → promote/demote → transfer → close/reopen. Compare both clients and direct API responses, including an outsider, a banned user and an expired lease.
3. Test cold load, warm navigation, tab switching, abrupt disconnect, quiet-room recovery and concurrent last-seat joins. Verify private/personal state stays scoped, then measure idle and high-churn costs. Keep release evidence with the assessed revision.

## Remediation handoff execution (applied)

[Execution guide](../plans/studyroom/IdiotHandOffGuide.md) specified remediation for all H01–H14 and M01–M13.
On 2026-11-06, `IdiotHandOffManager` executed the implementation contract:
1. **Applied 64 target files** via `.tmp/apply-studyroom-handoff.cjs` matching postimage SHA-256 hashes cleanly.
2. **Schema & Client updated**: `prisma/schema.prisma` augmented with `RoomParticipant.publicGoal`; Prisma client generated to `generated/prisma` (v7.9.1). SQL hardening script placed at `prisma/sql/messaging/studyroom-membership-hardening.sql`.
3. **Automated verification (V1)**:
   - `vitest run studyroom --maxWorkers=4`: 66 passed, 1 skipped, 561 passed tests (0 failed).
   - `vitest run src/server/domain/messaging/__tests__`: 13 passed, 112 passed tests (0 failed; test double in `phase7-persistent-room-chat.test.ts` aligned with `hasRoomAccess` lease requirement).
   - `tsc --noEmit --pretty false`: 0 type errors.
   - `npm run build`: Next.js 16.2.11 production build succeeded, 52/52 static pages generated.
4. **Pending gates (V2–V8)**:
   - Real PostgreSQL gate (V2 / `studyroom-postgres-hardening.test.ts`) and migration idempotency (V3) are guarded and require disposable local database `studyroom_handoff_test`. Remote Neon database is guarded against destructive schema pushes.
   - S4 Live gates (V4 multi-user matrix, V5 real concurrent races, V6 peer recovery) remain pending live Centrifugo, worker, and multi-user authentication fixtures.
   - S5 Monetary cost acceptance (V7) requires provider rates and an owner-approved seat-hour budget.

## QA follow-up handoff execution (applied)

[QA assessment](../plans/studyroom/IdiotCheckInQualityAssessment.md) identified QA01 (permanent SDK unsubscribe denial bypassing revocation), QA02 (truncated chat catch-up beyond 50 messages), and QA03 (stale roster responses overriding newer goals).
[QA execution guide](../plans/studyroom/IdiotHandOffGuide-QA-Corrections.md) was executed on 2026-11-06 via `sub-agent-orchestrator` and `idiot-hand-off-manager`:
1. **Applied 6 files** via `.tmp/apply-studyroom-qa.cjs` (postimages verified):
   - `src/client/realtime/subscription-registry.ts` (routes Centrifuge codes 103 and 1 via unsubscribed context to revocation).
   - `src/client/screens/dashboard/studyroom/hooks/loadChatCatchup.ts` (new helper: backwards chronological pagination via ID cursors, loop cycle detection, room departure cancellation).
   - `src/client/screens/dashboard/studyroom/hooks/useRoomChat.ts` (integrates catchup helper).
   - `src/client/screens/dashboard/studyroom/hooks/useRoomRoster.ts` (invalidation + 200ms coalesced reload on goal/roster events to prevent stale HTTP rollback).
   - `src/server/infrastructure/db/postgres/repositories/community.repo.ts` (adds id DESC secondary sort for deterministic cursor pagination).
   - `src/client/screens/dashboard/studyroom/__tests__/qa-recovery.test.tsx` (new test suite).
2. **Focused QA regressions (V1)**:
   - `vitest run src/client/screens/dashboard/studyroom/__tests__/qa-recovery.test.tsx`: 8 passed, 0 failed.
3. **Broad QA regressions & build (V2)**:
   - `vitest run studyroom --maxWorkers=4`: 67 passed, 1 skipped (569 passed, 0 failed).
   - `vitest run src/server/domain/messaging/__tests__ src/client/realtime`: 14 passed (118 passed, 0 failed).
   - `tsc --noEmit --pretty false`: 0 type errors.
   - `npm run build`: Production Next.js build clean (52/52 static pages).
4. **Remaining original release gates**:
   - V2/V3 PostgreSQL gates, V4–V6 multi-user live stack gates, and V7 monetary rate acceptance remain unchanged and pending deployment infrastructure.
