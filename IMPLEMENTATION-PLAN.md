# Undone messaging, study rooms, and Centrifugo: implementation instructions

**Document date:** 20 October 2026  
**Status:** instructions for a future authorized implementation; no implementation is performed by this document  
**Architecture and audit reference:** [MEMORY-ChatnCentrifugo.md](./MEMORY-ChatnCentrifugo.md)  
**Numbering:** Phase 0 is preparation; Phases 1–13 are the thirteen sequential implementation phases requested by the user.

## 1. Read this before doing anything

This is an execution specification for a coding agent. Read the complete document and the architecture reference before editing. Do not substitute a generic WebSocket tutorial. The reference preserves the earlier audit and its uncertainty; this document supplies the ordered work, contracts, ownership, tests, and release gates.

The user has authorized creation of these planning documents. **Possession of this document is not authorization to start implementation or deploy.** When a later user requests implementation, follow the authorized scope and repository instructions. Do not provision paid services, change shared production data, or deploy merely because those actions appear below.

The original audit examined commit `bbbe77a26c59c6ebec45a8567adc4e6e20d06c0a`. Source and untracked work can change. Re-audit in Phase 0. Do not assume the preserved audit describes the current deployed release.

### 1.1 Required product behavior — do not weaken it

1. Real accounts, real memberships, real conversations, real groups, real messages, real room participants, and real activity only.
2. Clicking **Join/Enroll** is the action that enrolls the user in an eligible cohort. A successful SQL membership automatically grants access to that cohort's enabled community channels. There is no second community-membership step.
3. Public cohort visibility permits discovery; it does **not** grant chat access to a nonmember.
4. Merely visiting a cohort, viewing its landing page, or guessing a channel ID must not silently enroll someone.
5. `CohortMember` is the community entitlement. Do not introduce a duplicate community-member table or use localStorage/MongoDB preferences as permission.
6. Private/invite-only enrollment requires a real invitation or authorized administrative action. A "Join" button must not bypass this.
7. Existing cohort creators get a real creator membership. Their ownership does not disappear when they hide a cohort from Home.
8. Persistent one-to-one DMs and basic groups are required, not optional mock UI.
9. No scripted replies, fake people, fake groups, fake upload previews presented as uploaded files, invented online counts, artificial unread counts, fabricated receipts, or random activity toasts.
10. A new account with no conversations must show an empty state. A failed API must show an error/retry state. Never replace either with demo data.
11. An unavailable feature must be hidden or accurately disabled. Do not leave a control that pretends to succeed.
12. Messages, memberships, permissions, read state, and important study records remain durable in PostgreSQL.
13. Centrifugo is a transport and short recovery cache, not the message database.
14. Preserve actual existing data and IDs. Do not convert localStorage demo content into user messages.
15. Keep tests/fixtures separate from production imports. Do not remove useful test fixtures merely because production mock imports are being removed.
16. Voice/video/screenshare is a separately authorized media project. A room may work as a silent study room without pretending it contains voice capability.

### 1.2 Scope and release tiers

| Tier | Required contents | Release rule |
|---|---|---|
| Foundation | Phases 0–4 | Internal verification only; no unsupported customer-facing promises |
| Core messaging and rooms | Phases 5–8, plus safety/operational gates from 11–13 | Real cohort chat, DMs/groups, essential read state, reliable room participation and personal sessions |
| Extended features | Phases 9–10 | Uploads, push, shared sprint, search/pins and richer administration enabled only after their own gates |
| Media | Separate future plan | Do not implement by inference |

Default execution of the **full** integration follows Phases 0–13. If a later user authorizes a core-only release, explicitly defer Phases 9–10, remove their production controls, and still complete Phases 11–13 for the selected release. Never call the full integration complete when a required phase is unfinished.

## 2. Working rules for the implementing agent

### 2.1 Before changing source

- Read `AGENTS.md`, `MEMORY/README.md`, relevant memory, and current source.
- Check `directives/` and `execution/` before inventing automation; preserve the repository's established Node/TypeScript application/test conventions.
- Inspect `git status --short`. Record existing modified/untracked files and ownership. Do not reset, clean, delete, or overwrite unrelated work.
- Current planning-time work includes a modified `src/client/config/routeThemeConfig.ts`, untracked `/studyroom/[roomSlug]` routes, and untracked study-room room UI, hooks, components, data and tests. Treat these as live user/other-agent work.
- Read the current files, not just filenames or old documentation. Verify which screen/routes are actually mounted.
- Plan the phase and freeze its shared contracts before parallel editing.
- Use additive migrations. Never run `prisma migrate reset` or destructive `db push` against shared data.
- Keep production secrets out of prompts, logs, generated artifacts, URLs and public variables.

### 2.2 Sequential gates

Finish each phase's definition of done before starting dependent implementation. A later phase may conduct read-only research while waiting, but must not implement against undecided schema or interfaces.

Every phase must produce a short handoff containing:

1. Actual changed files and why.
2. Final contracts and migrations, if any.
3. Tests/commands actually executed and their results.
4. Known limitations and unresolved failures.
5. Configuration/flags required to activate the work.
6. Rollback instructions and data preservation implications.
7. A clear `PASS`, `BLOCKED`, or `DEFERRED BY USER` gate status.

Do not claim "tested" for a mocked unit test when the requirement requires real PostgreSQL or two real browser sessions. Do not mark a phase complete because the UI renders.

### 2.3 Parallel subagent operating model

Parallel agents are useful **within** phases after the lead freezes contracts. Use at most three workers plus one lead when four concurrency slots are available.

- **Lead/integrator:** owns cross-cutting contracts, schema/migrations, shared dependency files, integration decisions, final review and gate.
- **Worker A:** bounded backend/service work.
- **Worker B:** bounded frontend or infrastructure work.
- **Worker C:** independent tests, security review, or operational verification.

Worker labels below are phase-specific assignments, not permission for agents to edit the entire repository.

**Single-writer files:** `prisma/schema.prisma`, migration files, `package.json`, lockfiles, shared event/HTTP contracts, provider composition, environment registration, shared auth files. The lead edits these unless explicitly transferring ownership to exactly one worker.

**Shared existing files:** `useMessage.ts`, `messagesRepository.ts`, `communityMapping.ts`, `StudyRoomScreen.tsx`, and shared message components must have one owner at a time. Extract narrow modules before distributing work. Never have two agents rewrite the same hook concurrently.

Each worker receives:

- Exact phase objective and required behavior.
- Read-only reference paths.
- Exclusive edit paths.
- Frozen request/response/event contracts.
- Tests and observable success criteria.
- Explicit forbidden edits.
- Requirement to report contract changes to the lead before proceeding.

Workers must not independently migrate databases, install competing packages, alter lockfiles, publish branches, provision services, or deploy. The lead integrates and runs cross-boundary checks.

Use an independent reviewer after integration. It must inspect actual behavior, authorization predicates, retry paths and tests, not merely approve a summary. A reviewer finding a blocker returns the phase to implementation.

### 2.4 Suggested future module boundaries

These are proposed locations, not existing implementations. Reuse equivalent current modules where they exist.

| Area | Suggested location |
|---|---|
| Shared schemas and envelopes | `src/shared/messaging/`, `src/shared/realtime/`, `src/shared/studyroom/` |
| Messaging authorization/services | `src/server/domain/messaging/` |
| Enrollment policy/service | `src/server/domain/cohort/` |
| Study-room domain services | `src/server/domain/studyroom/` |
| SQL repositories | `src/server/infrastructure/db/postgres/repositories/` |
| Centrifugo token/API adapter | `src/server/infrastructure/realtime/` |
| Durable dispatcher | `src/server/messaging-worker.ts` |
| Client connection/provider | `src/client/providers/RealtimeProvider.tsx`, `src/client/realtime/` |
| Messaging client queries | `src/client/screens/dashboard/message/hooks/` and actual mobile counterparts |
| HTTP routes | Existing `src/app/api/community/`, `src/app/api/studyroom/`; new scoped conversation/realtime routes |
| Isolated integration harness | Existing test conventions plus dedicated messaging test directories/scripts |
| Deployment/runbooks | Repository deployment convention established in Phase 0 |

## 3. Freeze these contracts before feature work

### 3.1 Authorization matrix

Implement one reusable server policy/service and use it from HTTP routes, subscription callbacks, synchronization, search, notifications and attachment grants.

| Actor/resource | Read | Send | Manage |
|---|---|---|---|
| Anonymous / any private messaging scope | No | No | No |
| Shared demo/guest identity | No private production messaging | No | No |
| Public-cohort visitor, not enrolled | Catalog only; no chat | No | May request valid enrollment |
| Active cohort member / enabled standard channel | Yes | Yes unless muted/restricted/read-only | Own message actions within policy |
| Creator/moderator / enabled community | Yes | Yes | Appropriate channel/moderation actions |
| Member / announcement channel | Yes | No unless authorized role | No |
| Removed/banned cohort member | No | No | No |
| Direct-conversation participant | Yes within policy | Yes unless blocked/restricted | Own preference/message actions |
| Current group member | Joined-history window | Yes unless restricted | Role-specific |
| Removed/left group member | No server history by default | No | No |
| Current room participant | Room state/chat | Room chat/status | Shared controls only with role |
| Nonparticipant / study room | Public aggregate catalog only if intended | No | Join allowed if room eligible |
| Platform administrator | Explicit audited moderation path | No automatic user impersonation | Authorized administrative actions only |

Do not use `accessibleCohortWhere` as the chat authorization rule. Retain/refine it for content discovery and enrollment eligibility. Require real membership plus publication/lifecycle/chat-enabled policy for ordinary chat access.

Add durable cohort/group restrictions where needed. Deleting a banned user's membership is not sufficient if they can immediately re-enroll in a public cohort.

Every mutation resolves the actor from server authentication. Reject or ignore client-provided author IDs, roles, membership state and publication destinations.

### 3.2 Common HTTP contract

- Strict schema validation; unknown-sensitive fields rejected.
- No body parsing before authentication where auth can be checked first.
- Enforce streaming/request-size limits, not only `Content-Length`.
- Stable error object: machine code, safe message, optional retry delay/request ID.
- Return canonical entities, IDs, revisions, server time and pagination watermarks.
- Success for a new message means SQL commit, not recipient receipt.
- Idempotency key reused with a changed payload returns conflict.
- Member-only responses default to `Cache-Control: private, no-store`.
- Cursors are opaque validated channel-scoped positions; cannot reference foreign channels.
- `401` unauthenticated, safe `404` for inaccessible resources, `409` conflict, `413` oversize, `429` rate limit, retryable `503` for unavailable dependencies.
- Cookie-authenticated mutations require CSRF/origin handling; exact origins do not replace authentication.
- Mobile uses `apiUrl` and a verified credential flow. Do not solve missing mobile cookies by accepting body user IDs.

### 3.3 Ordering and idempotency

- Give messages a monotonically allocated channel-local `messageSequence`.
- Give durable events a monotonically allocated stream-local `sequence`.
- Allocate counters inside the same transaction as the corresponding state.
- Timestamps are display metadata, not ordering authority.
- Use string serialization for bigint positions.
- Each durable event has a stable `eventId`, schema version, scope, generation, entity ID/revision and server timestamp.
- Creation retries deduplicate using `(channelId, authorId, clientRequestId)` and a payload hash.
- Client optimistic state is keyed by request ID, then reconciled to canonical server ID.
- Duplicate transport delivery must not append a second message.
- Do not treat an edit/reaction as a new unread message.
- Client updates use resulting state/revision, not unguarded counter increments.
- General mutation idempotency uses a reusable scoped request record.
- Exactly-once network delivery is not promised. Database uniqueness plus at-least-once dispatch and reconciliation supplies correct observable state.

### 3.4 Durable event recovery

1. Authenticate and authorize the current scope before reading events.
2. Establish subscription and buffer publications.
3. Fetch an authorized snapshot with a consistent application watermark.
4. Merge buffered events above the watermark.
5. On reconnect, refresh manifest/generations and attempt Centrifugo short recovery.
6. Always reconcile against the SQL application cursor.
7. If journal retention has elapsed, return `reset_required` and a fresh snapshot flow.
8. If an event arrives ahead of the next sequence, buffer within a bounded limit and fetch the gap.
9. If malformed/unknown version or buffer limit is exceeded, invalidate and resnapshot.
10. Never advance a cursor over an unaccounted gap.
11. A filtered history window must return an explicit authorized watermark so hidden prior history does not cause endless gap fetching.

Do not expose stale deleted/edited content from event payloads during HTTP sync. Prefer canonical hydration of entity references or sanitize event projections against current state. An immutable internal event log is not automatically safe for client replay.

Render recovered content only after the client's authorized reconciliation step. Broker history can briefly contain prior content; document its five-minute cache lifetime and do not promise retroactive erasure from recipients' devices.

### 3.5 Generation-based access revocation

Canonical transport names include an access generation:

- `user:{userId}:g{generation}`
- `dm:{conversationId}:g{generation}`
- `group:{conversationId}:g{generation}`
- `community:{channelId}:g{generation}`
- `room:{roomId}:g{generation}`
- `roomchat:{channelId}:g{generation}`
- `signal:{scopeType}:{scopeId}:g{generation}`

Define one authoritative effective generation per scope. If community-wide generation controls its channels, a channel event targets that effective generation rather than an unrelated independently incremented number.

Membership revocation and message creation must serialize on the relevant access scope. In one transaction: change membership/restriction, increment generation, append event and outbox. New messages committed afterward target the new generation. Reject old-generation subscription callbacks.

The dispatcher suppresses obsolete destination generations; remaining members receive user-inbox invalidations and resubscribe. Send server API unsubscriptions as cleanup, not the sole security control.

Never cache an authorized message destination before a membership transaction and publish a later-created message into that old destination.

Account-wide restriction requires more than blocking token renewal. Define a revocation workflow covering all affected private scopes and existing connections. While scope revocation is pending, pause sensitive publication to affected scopes or otherwise enforce an equivalent barrier. Do not claim immediate account-wide revocation based solely on a five-minute token lifetime.

### 3.6 Receipt semantics

- **Pending:** client has not received a durable acceptance.
- **Sent:** SQL accepted the message; may still await outbox delivery.
- **Delivered:** at least one recipient app instance acknowledged that it reconciled all visible messages through the position.
- **Read:** recipient viewed the conversation and acknowledged a rendered read-through position.
- Sender's own connection cannot acknowledge delivery for another user.
- For groups, retain individual member watermarks; distinguish "read by N" from "read by everyone."
- Read and delivery positions only advance. Validate against scope history, join boundary and latest message.
- Presence is not delivery. Opening another page is not reading.

## 4. Phase 0 — Baseline and decisions

**Goal:** give implementation a current, verified starting point and avoid damage to existing work.

**Dependencies:** later implementation authorization; no source change is required to begin read-only audit.

### Inspect

- `AGENTS.md`, `MEMORY/README.md`, `MEMORY/cache-boundaries.md`, `MEMORY/home-dashboard.md`.
- `package.json`, `package-lock.json`, `prisma/schema.prisma`, `prisma.config.ts`, existing `prisma/*.sql`.
- Existing community, cohort join/viewer, studyroom routes, messaging hooks, mobile entry points.
- Current untracked room work and `docs/plans/`.
- `docker-compose.yml`, `vercel.json`, `next.config.ts`, environment loading, worker entry points.
- Actual deployed commit, providers, regions, Node/PostgreSQL versions, migration ledger, pools and backups, when access is available.

### Sequential steps

0.1 Record current HEAD and working tree without modifying it. Identify overlapping in-progress work.  
0.2 Read the current mounted message and room screens; trace imports to their actual data sources.  
0.3 Produce a mock inventory: location, current UI use, actual replacement source, and phase responsible. Include mobile, sidebars and Home-derived enrollment.  
0.4 Map every enrollment/leave/publication path. Identify creator membership gaps and `INVITE_ONLY` inconsistencies.  
0.5 Inventory SQL schema/migration practices. Establish whether Prisma migrations are baselined; do not invent a migration history.  
0.6 Confirm production configuration without printing secret values. If unavailable, record as unresolved; local work can continue, production activation cannot.  
0.7 Confirm Centrifugo/SDK releases and configuration against official docs at implementation time. The proposed baseline is server 6.10.0 and `centrifuge` 5.7.4, not an instruction to ignore later security fixes.  
0.8 Freeze authorization, group history, read semantics, room policy, retention and initial release tier. Defaults in this document apply unless the user changes them.  
0.9 Freeze module/agent ownership and the initial contract types.  
0.10 Design isolated test databases and an integration environment that cannot accidentally target production.

### Parallel assignments

| Agent | Exclusive job | Output |
|---|---|---|
| A | Read-only enrollment/auth/schema audit | Policy gaps and migration/data risks |
| B | Read-only frontend/mobile/mock audit | Mounted component and replacement inventory |
| C | Read-only infrastructure/docs/tests audit | Versions, deployment gaps, isolated verification design |
| Lead | Resolve findings and freeze contracts | Baseline, decisions, ownership, execution gates |

No worker edits application code in this phase.

### Tests and gate

- Inventory existing test commands and determine which tests write files/databases or invoke paid services.
- Baseline targeted tests only in a safe environment; record pre-existing failures separately.
- Verify restore rehearsal design and migration baseline before any shared migration.
- **Done:** no uncertainty is disguised as a verified fact; current source paths and owners are known; no conflicting contract decisions remain.
- **Failure point:** an active room UI rewrite overlaps proposed work. Coordinate ownership, do not overwrite it.
- **Rollback:** no runtime changes.

## 5. Phase 1 — Real identity, enrollment, and chat authorization

**Goal:** make membership correct before exposing any private real-time data.

**Dependencies:** Phase 0 contracts.

### Inspect/modify later

- `src/server/infrastructure/auth/auth.config.ts`, `auth.edge.ts`, `guestAccount.ts`, `getUser.ts`, `requireUser.ts`, `auth.environment.ts`.
- `src/server/domain/cohort/cohortAccessPolicy.ts`.
- `src/app/api/cohort/[id]/join/route.ts`, viewer route.
- `src/server/infrastructure/db/postgres/repositories/cohort.repo.ts`, `creationPublication.repo.ts`.
- Community channel/message routes and `community.repo.ts`.
- `JoinCohortButton.tsx`, real community-list query and Home membership source.

### Sequential steps

1.1 Make missing production Auth.js secret fail closed in both auth configurations. Keep explicitly local test/dev configuration isolated.  
1.2 Reject shared guest identities at every private messaging admission point. Never present a shared guest as a private user.  
1.3 Add/use current account restriction checks. Distinguish authenticated from permitted-to-message.  
1.4 Implement separate discovery, enrollment and chat policy functions. Do not "fix" catalog visibility by accidentally making all public content private.  
1.5 Make cohort enrollment transactionally upsert the real `CohortMember`; return canonical membership and community destination. Creator remains `CREATOR`, not downgraded by repeat join.  
1.6 Add invitation acceptance for private/invite-only cohorts: hashed token, expiry, intended recipient, single-use acceptance, inviter permissions, revocation.  
1.7 Ensure publication paths create the creator membership and real configured channels consistently. Disabled chat creates no fake channel access.  
1.8 Backfill only legitimate missing creator membership/channel metadata using a reviewed additive migration.  
1.9 Make chat reads/writes require current membership and enabled/lifecycle state. Remove the 60-second `verifiedChannels` bypass from sensitive reads.  
1.10 Remove public embedded messages from channel metadata responses. Do not expose history through an anonymous endpoint while protecting only the dedicated message endpoint.  
1.11 Return actual communities from current SQL membership. Replace the messaging dependency on mock/default `homeRepository.getHome()`.  
1.12 After Join success, invalidate viewer/home/community queries and navigate or expose actual chats. Do not show enrolled before durable acceptance except clearly reversible pending UI.  
1.13 Leave removes access; pause preserves it. Creator hiding is a separate preference, not an ownership removal.  
1.14 MongoDB preferences are secondary effects. Until Phase 2 provides durable dispatch, use the repository's existing safe reconciliation mechanism or clearly record pending integration; do not pretend a cross-database transaction exists. Phase 2 must close this before release.

### Database and API

- Preserve `CohortMember` key and roles.
- Add invitation/restriction records needed for real private enrollment and bans.
- Keep join endpoint compatibility.
- Add real authenticated community list.
- Replace unsafe public cache headers for chat responses.

### Parallel assignments

| Agent | Exclusive job |
|---|---|
| Lead | Auth shared files, schema/migration, policy contract |
| A | Enrollment/invitation services and routes after policy freeze |
| B | Join/list UI and real-community query; no shared auth/schema edits |
| C | Independent authorization/invitation tests and security review |

### Verification

- Unit: public discovery versus chat permission; every visibility enum; creator/member/moderator; guest/restricted user.
- Real SQL integration: concurrent joins produce one membership; repeated join preserves role; invitation replay fails; Mongo failure cannot grant fake success.
- API: anonymous and public nonmember cannot read through either community endpoint.
- Browser: real Join exposes chat automatically, no second join; failed join remains unenrolled.
- Run relevant auth/cohort/community tests and typecheck.

**Done:** authenticated strangers cannot access cohort chat; enrolled users automatically can; all actual creator paths work.  
**Rollback:** disable new chat UI if needed; never restore visibility-only authorization or fallback production secrets.  
**Failure points:** old caches, anonymous metadata previews, private invitation bypass, creator role downgrade.

## 6. Phase 2 — Durable messaging foundation and dispatcher

**Goal:** make accepted state durable and delivery recoverable before wiring WebSockets.

**Dependencies:** Phase 1 authorization; migration baseline.

### Sequential steps

2.1 Lead writes additive schema/migration design for generalized `Channel` and existing `Message`.  
2.2 Add `Conversation`/participant foundation so direct/group channels use the same message model later.  
2.3 Enforce exactly one channel parent: community, conversation, or study room. Preserve existing channel IDs.  
2.4 Add message sequence, revision, client request ID/hash, reply/deletion fields as required by frozen contracts.  
2.5 Backfill message sequence deterministically by `(createdAt,id)` in bounded batches. Do not invent send times or authors.  
2.6 Add channel-user state, stream, event, delivery and request-idempotency models. Use typed owner foreign keys, not unconstrained polymorphic identifiers.  
2.7 Add indexes/uniques/checks after validating existing rows. Use reviewed online index strategy for large tables.  
2.8 Implement one transaction service for authorize → idempotency → sequence allocation → message mutation → event → outbox.  
2.9 Same key/same payload returns original accepted result. Same key/different payload conflicts.  
2.10 Implement cursor pagination, snapshot watermark and SQL event synchronization, including expired-cursor reset.  
2.11 Implement dispatcher atomic claims, bounded batches, leases, fenced ACK, retry schedule and dead-letter transition.  
2.12 Keep destination-specific acknowledgements. Publishing a conversation event does not mark its separate inbox notification delivered.  
2.13 Serialize per-stream dispatch where practical. Use bounded fair scheduling so one failing/hot stream does not starve others.  
2.14 Prevent a poison event from silently advancing an ordered stream. Quarantine with alert and force authorized snapshot reconciliation if bypass is explicitly chosen.  
2.15 Extract an interface for the transport adapter. Test with a controlled fake adapter now; integrate actual Centrifugo in Phase 3.  
2.16 Add a separately supervised messaging worker. Do not attach social chat to AI `InteractionWorkspace` or starve it behind AI jobs.  
2.17 Add worker heartbeat, graceful drain, health/readiness and bounded SQL pool.  
2.18 Route enrollment Mongo preference updates through durable retryable effects. SQL membership is authoritative even when Mongo is down.  
2.19 Define cleanup retention. Never delete pending outbox work as successful cleanup.

### Required constraints

- Unique message `(channelId,messageSequence)`.
- Unique creation `(channelId,authorId,clientRequestId)`.
- Unique event `(streamId,sequence)`.
- Unique delivery `(eventId,destination)`.
- Pending claim index on status/due/lease expiry.
- Same-channel reply reference.
- Monotonic read/delivery positions.
- Scope/access generation serialized with mutation.
- Author deletion policy reviewed; no accidental cascade destruction of other users' conversation history.

### Parallel assignments

| Agent | Exclusive job |
|---|---|
| Lead | Schema, migrations, shared transaction/event/idempotency contracts |
| A | Repositories and command/snapshot/sync services |
| B | Worker/dispatcher implementation using frozen repository interfaces |
| C | Real PostgreSQL concurrency/crash tests; independently review claim SQL |

No worker copies the existing `InteractionOutbox` select-then-update claim pattern without proving exclusive ownership.

### Verification

- Twenty identical concurrent sends create one message/event and the intended delivery rows.
- Concurrent unique sends allocate unique ordered positions.
- Two workers cannot both hold valid claims for one delivery.
- Worker dies after claim; lease expires and another worker reclaims.
- Worker publishes then dies before ACK; duplicate event renders only once in reducer test.
- SQL rollback produces neither event nor publication.
- SQL commit followed by adapter failure retains pending delivery.
- Stale worker ACK cannot acknowledge a new lease.
- Pagination with equal timestamps and deleted rows is stable.
- Snapshot plus concurrent publication has no lost event.
- Migration rehearsal preserves message IDs/counts and existing cohort functionality.

**Done:** durable mutation/recovery invariants pass against real PostgreSQL.  
**Rollback:** disable new writes/features; retain additive tables and existing data. Never drop the event journal to revert code.  
**Failure points:** transaction split, duplicate worker claims, sequence race, overlong transactions, migration baseline mismatch.

## 7. Phase 3 — Secure Centrifugo infrastructure

**Goal:** establish a validated persistent transport, initially in isolated development/staging.

**Dependencies:** Phase 2 transport adapter; approved environment access.

### Sequential steps

3.1 Reverify pinned server/SDK compatibility. Use a patch version and image digest; do not leave `:v5` or `:latest`.  
3.2 Replace hardcoded Compose example credentials with environment/secret injection. Keep public and internal listeners/routes separated at ingress.  
3.3 Define secure v6 nested configuration using official version-specific docs. Validate with the actual selected binary; do not assume unknown keys are rejected without testing.  
3.4 Configure connection JWT issuer/audience, exact origins, server API key, namespace proxies, history, presence, limits and heartbeat settings from the architecture reference.  
3.5 Disable unrestricted client publish/history/presence, anonymous/insecure access, admin and debug.  
3.6 Enable private metrics and health endpoints. Distinguish process liveness from readiness to serve broker/API traffic.  
3.7 Terminate TLS at a WebSocket-capable reverse proxy. Test certificate chain, upgrade headers and idle timeout.  
3.8 Memory engine for one node. Do not run two independent memory-engine replicas and call it HA.  
3.9 Add resource limits, restart policy, log rotation and graceful stop. Verify the image contains any tool used in its healthcheck; do not assume `curl` exists.  
3.10 Implement backend server API adapter with request timeout, safe error classification and response-body error handling. HTTP 200 can still contain an API error; parse it.  
3.11 Worker publishes with the server credential. Browser receives only public WSS URL.  
3.12 Record a future Redis/Valkey configuration and HA upgrade procedure; do not provision it unless needed/authorized.

### Configuration checklist

- Five-minute connection JWT; independent signing secret.
- Subscribe/sub-refresh proxy enabled for protected namespaces.
- Durable namespace short recovery: initially 100 events, five-minute TTL.
- No history for typing signals.
- Presence only where required; room join/leave never treated as authoritative attendance.
- Proposed subscription cap 32 and per-node user cap 10.
- Initial node/connection-rate caps are tested limits, not capacity guarantees.
- 25-second ping, 8-second pong; proxy idle timeout comfortably larger.
- 64 KiB WebSocket command limit; no binary attachment transfer through WebSocket.
- Private server API, `/metrics`, `/health`; disabled admin/debug.
- Dev/staging/prod secrets and origins separated.

### Parallel assignments

| Agent | Exclusive job |
|---|---|
| Lead | Version/config decisions, dependency/lockfile changes, secret schema |
| A | Deployment/Compose/reverse-proxy artifacts, no actual cloud provisioning |
| B | Server API adapter and adapter tests |
| C | Black-box config, endpoint exposure, origin and restart tests |

### Verification and gate

- Invalid JWT, wrong issuer/audience, unauthorized origins fail.
- Client publish is denied; private history/presence cannot be enumerated.
- Server API rejects missing/wrong key.
- Public ingress cannot access internal routes.
- Genuine SDK connection survives normal heartbeat intervals.
- Restart causes recoverable reconnect, not message loss.
- Pin validation output and image/SDK identifiers in handoff.
- **Done:** staging transport is secure and worker adapter is tested.
- **Rollback:** stop transport, keep accepted SQL messages/outbox, use authorized HTTP sync.
- **Failure points:** v5 environment names in v6, exposed API, wildcard origin, unknown config keys, healthcheck that always fails.

## 8. Phase 4 — Connection authentication, subscriptions, and client lifecycle

**Goal:** every real-time connection and subscription maps to an actual authorized user.

**Dependencies:** Phases 1–3.

### Sequential steps

4.1 Implement `POST /api/realtime/token`: session, real account status, rate budget, no-store response, short token and endpoint.  
4.2 Use a supported server-side JWT library; keep signing code server-only. Do not manually assemble insecure tokens or reuse Auth.js encrypted session tokens.  
4.3 Implement authorized subscription manifest. Server derives scope names/generations from requested actual entity IDs and current entitlement.  
4.4 Implement internal subscribe and sub-refresh callbacks. Authenticate the caller before trusting its `user` field. Validate namespace/parser/generation/current membership.  
4.5 Use documented Centrifugo callback response envelopes. Separate callback protocol denial from HTTP handler authentication failure; integration-test both.  
4.6 Configure a static callback credential that cannot be overridden by forwarded/emulated client headers.  
4.7 Do not issue subscription JWTs or enable user-limited channel shortcuts that bypass proxy authorization.  
4.8 Add client-only `RealtimeProvider` under the authenticated app shell. One owned SDK instance per logged-in app instance.  
4.9 Register SDK error and lifecycle handlers; show connected/reconnecting/degraded state.  
4.10 Use token callback for renewal; retry temporary token endpoint failures with bounded backoff, stop on expired/unauthorized application session.  
4.11 Add a subscription registry with reference counting and a bounded active scope set. Do not subscribe to every historical conversation.  
4.12 Handle logout/account switch: unsubscribe, disconnect, cancel requests, clear memory/token/cache, clear previous user's local draft namespace as policy requires.  
4.13 Strict Mode mount/unmount must not leave duplicate connections, handlers or subscriptions.  
4.14 Integrate application snapshot/delta recovery from Phase 2 with SDK transport recovery; keep the cursor systems separate.  
4.15 Add generation refresh and access-revocation handling. A denied scope removes the corresponding cached private state.  
4.16 Verify Capacitor static build authentication, credentials, approved origin, background/resume, network-change and Android WebView behavior. If not established, explicitly block mobile activation; never bypass auth.

### Parallel assignments

| Agent | Exclusive job |
|---|---|
| Lead | Auth/provider composition and shared manifest/proxy contracts |
| A | Token, manifest, callback backend routes |
| B | Provider/subscription registry/recovery lifecycle modules |
| C | Real SDK authorization tests and mobile/auth lifecycle review |

### Verification and gate

- Two real accounts connect and only subscribe to their own scopes.
- Knowing another channel's exact name does not grant access.
- Refresh with expired session fails closed.
- Token refresh/Strict Mode does not multiply connections.
- Account B cannot see A's cache or draft history.
- Removed member's old generation cannot resubscribe.
- Network disconnection/resume yields authoritative state.
- **Done:** connection/subscription security is proven against the actual server.
- **Rollback:** disable connection provider and real-time flag; retain secure HTTP APIs.
- **Failure points:** public secret bundling, callback spoofing, stale token loops, mobile missing credentials, token bypass of proxy.

## 9. Phase 5 — Real community messaging and removal of production mock data

**Goal:** actual enrolled users exchange persistent messages in actual cohort channels.

**Dependencies:** Phases 1–4.

### Sequential steps

5.1 Replace `messagesRepository.getEnrolledCohorts()` mock/Home-derived source with authenticated SQL-backed community listing.  
5.2 Make the channel list actual channel metadata; keep community ID, cohort ID and channel ID distinct in types.  
5.3 Replace `activeChannelId` shared mutable routing with explicit selected channel ID bound to each send/retry command.  
5.4 Query keys include current user and channel; abort or discard outdated fetches after selection/account changes.  
5.5 Use cursor-based history and server UTC timestamps. Format display time at render boundaries.  
5.6 Replace mock/current-user sentinel IDs with actual session user IDs and backend author projections.  
5.7 Send through the common durable command service with a stable request ID. Pending text stays pending until canonical acceptance.  
5.8 Replace optimistic message ID with returned canonical ID; reconcile publication-before-response and response-before-publication.  
5.9 Retry uses the same request ID, original channel and original payload. Editing a failed draft creates a new request ID.  
5.10 Remove "sent when no channel" behavior. Disable composer until an authorized real channel is available.  
5.11 Apply live events through tested reducers/query updates; reconcile gaps and degraded HTTP fallback.  
5.12 Add bounded pagination and scroll anchoring. New messages do not unexpectedly jump a user reading older history.  
5.13 Remove production imports of `message.mock`, `communityChat.mock`, scripted templates and mock avatars/people where they represent fake users.  
5.14 Replace `communityMapping.ts` with pure mapping of actual DTOs; no fabricated messages, roles, pins, online flags, progress, events or counts.  
5.15 Remove/hide fake "friends online", live sessions, challenges, resources, scheduled events and media cards until a real source exists.  
5.16 Real static decoration/room artwork can remain; decorative assets are not fake user activity. Distinguish the two.  
5.17 Preserve local drafts only as user/channel-scoped draft data. Do not use localStorage as accepted history. Ignore obsolete mock storage keys; do not migrate them into SQL.  
5.18 Apply the same model to actual mobile rendering. Audit mobile-specific hardcoded status text.  
5.19 Update empty, loading, denied and error states. A server error must never repopulate mock data.

### Parallel assignments

| Agent | Exclusive job |
|---|---|
| Lead | Own `useMessage.ts` integration and shared view-model contract |
| A | Existing community API/repository hardening and DTO projections |
| B | Assigned community components/mobile rendering and pure mapping cleanup |
| C | Mock-import audit, API/race/browser tests |

Do not give A or B independent authority to rewrite the lead-owned hook.

### Verification and gate

- Two enrolled accounts exchange messages without refresh.
- Third nonmember cannot access either list previews or message route.
- Send while switching communities/channels lands in the original selected destination.
- HTTP success followed by transport failure still survives refresh.
- Duplicate/reordered publication does not duplicate or overwrite a message.
- Empty account/community has no invented content.
- Production dependency graph no longer imports removed social fixtures.
- Search source for `mockAttachment`, `dmScripts`, `sidequest-community-messages`, fake status/count sources; inspect remaining matches individually.
- **Done:** community chat works end to end with real accounts and zero production demo fallback.
- **Rollback:** authorized HTTP history/refetch; never restore mock success or public cached history.
- **Failure points:** fixture source hidden behind mapping, stale selection closure, duplicate optimistic IDs, fake cards surviving outside timeline.

## 10. Phase 6 — Persistent direct messages and actual group conversations

**Goal:** replace mock DMs/groups with real creation, participants and durable messages.

**Dependencies:** Phase 5 integrated message model.

### Sequential steps

6.1 Implement actual user discovery with bounded search, privacy/account filtering, pagination and no email enumeration.  
6.2 Implement direct conversation creation: validate recipient exists/is allowed, reject self where unsupported, check blocks, use canonical sorted pair key.  
6.3 Create both participant records and one conversation channel atomically. Concurrent pair creation returns the same conversation.  
6.4 Group creation takes a real title and selected actual users; set owner to actor. Enforce initial cap 100.  
6.5 Use explicit invitation/acceptance for group recipients by default. An owner can see pending invites; recipients do not appear as joined participants before acceptance.  
6.6 Enforce owner/admin/member permissions for rename, invite, remove, leave and ownership transfer.  
6.7 Owner cannot leave the last-owner group without transfer or explicit archival. Serialize ownership changes.  
6.8 Persist current membership lifecycle and join-history boundary. New group members see only allowed history by default.  
6.9 List conversations from actual participant records, ordered by real last activity; return actual preview/timestamp/unread state.  
6.10 Use the existing common Channel/Message service for DM/group history and send. Do not add a second incompatible `DirectMessage` implementation.  
6.11 Replace ComposeModal's fake conversation selection with real user lookup/create flow and group creation flow.  
6.12 Replace scripted DM histories, mock resources, string-derived "Group DM" detection and fake member counts. Use `Conversation.kind`.  
6.13 Show real participant list and role data. A group with one accepted member and pending invitations must say so.  
6.14 Removal/leave changes generation and manifest, denies HTTP access and drops cached private state. Remaining members resubscribe.  
6.15 Implement block/report basics now. Block prevents new direct messages/conversations; report targets an actual authorized message.  
6.16 Add moderation audit and restriction service; do not expose internal report notes in transport events.  
6.17 Backfill no fake DMs. Existing local demo conversations simply disappear from production listings.

### Parallel assignments

| Agent | Exclusive job |
|---|---|
| Lead | Conversation/member schemas, shared APIs, `useMessage.ts` integration |
| A | Conversation/invitation/participant/block/report services and routes |
| B | ComposeModal, DM/group metadata/member components, real-user query UX |
| C | Concurrency, IDOR, membership lifecycle and multi-user E2E tests |

### Verification and gate

- Concurrent A→B and B→A direct creation creates one conversation and channel.
- Only actual participants can read/send/search.
- Group invite acceptance is persisted; replay and wrong recipient fail.
- Actual messages remain across logout/login and second device.
- Owner/admin/member privilege matrix passes.
- Removed user holding an old socket receives no newly committed content.
- Rejoining obeys the new history boundary.
- Block/report works with real records and rate limits.
- No fabricated people/groups/DM histories remain.
- **Done:** both direct and basic group messaging are genuinely persistent and authorized.
- **Rollback:** disable creation/entry flags, preserve records; never reinstate mock conversations.
- **Failure points:** duplicate pair, ownerless group, unaccepted invite treated as membership, stale socket access, block bypass.

## 11. Phase 7 — Read state, receipts, presence and message interactions

**Goal:** turn interaction controls into real state with precise semantics.

**Dependencies:** Phase 6.

### Sequential steps

7.1 Add/finish `ChannelUserState` APIs for read/delivered watermarks, pin/mute/preferences.  
7.2 Advance positions with atomic monotonic update. Reject positions outside visible scope/history.  
7.3 Define unread as visible incoming message creations after last-read position. Exclude own messages, edits, reactions and deleted content per chosen display policy. Do not subtract event sequence numbers to get unread counts.  
7.4 Synchronize own preference/read state through user inbox events. Group receipt fan-out is bounded; community individual read rosters remain off initially.  
7.5 Implement replies with same-channel target enforcement and safe deleted-parent preview.  
7.6 Implement unique reaction state and idempotent PUT/DELETE. Return resulting aggregate/revision.  
7.7 Implement edit with expected revision and author/time policy; proposed window 15 minutes. Moderator actions use explicit separate authority.  
7.8 Implement tombstone delete, attachment revocation and audit; do not just splice client array.  
7.9 Add restricted moderation operations and persistent channel/cohort bans/mutes. A ban must survive a re-enroll attempt.  
7.10 Implement typing HTTP signal with actor derived server-side, channel authorization, central budget, two-second throttle and five-second expiry. Keep signal namespace history off.  
7.11 Implement privacy-controlled presence. Use backend visibility filtering; no globally readable "all users online" channel.  
7.12 Online means a valid connected app session; it does not mean the user is viewing the chat. Coarse last seen is throttled and optional.  
7.13 Remove all static `online: true`, fake status badges and simulated typing from real-user projections.  
7.14 Ensure UI labels match sent/delivered/read semantics; recipient acknowledgements cannot be issued by sender.  
7.15 Add accessible pending/error/retry controls for each mutation; rollback optimistic changes on rejection.  
7.16 Suppress old edit/reaction events using entity revisions; on missing base message, fetch authorized canonical state.

### Parallel assignments

| Agent | Exclusive job |
|---|---|
| Lead | Receipt/unread contracts, schemas, reducer integration |
| A | Read/preference/interaction/moderation APIs |
| B | Receipt, reply, reaction, edit/delete, preference UI components |
| C | Typing/presence service and tests in isolated modules, then independent review |

If C implements service code, assign final independent review to another agent after integration.

### Verification and gate

- Reading on one device updates the other without moving positions backward.
- Sender's extra tab cannot create recipient delivery.
- Repeated reaction adds one row; removal is idempotent.
- Foreign reply target fails.
- Concurrent edits produce conflict, not silent lost update.
- Delete remains deleted after reconnect/history recovery.
- Typing expires after dropped stop signal.
- Blocked/private users are not exposed through presence.
- Mute duration and pin state survive refresh/device change.
- **Done:** every released interaction is backed by actual service/data; absent ones are hidden.
- **Rollback:** individual interaction flags off, preserve durable state and secure message access.

## 12. Phase 8 — Reliable study-room membership and focus sessions

**Goal:** actual room counts, participants and activity under crashes, races and multiple tabs.

**Dependencies:** Phases 1–7; reconcile active untracked room work first.

### Inspect/modify later

- `src/app/api/studyroom/route.ts`, `studyRoom.repo.ts`.
- Current `StudyRoomScreen.tsx`, `FocusTimerCard.tsx`.
- Current `/studyroom/[roomSlug]`, `room/`, hooks/types/data if now integrated.
- `RoomParticipant`, `StudyRoom`, lease/session models and messaging worker.

### Sequential steps

8.1 Move room seeding out of GET into an explicit idempotent setup task. Use stable real room identifiers/slugs and uniqueness.  
8.2 Separate public room catalog aggregates from authenticated participant detail. Do not cache private roster responses publicly.  
8.3 Replace truncated ETag with authoritative revision or full digest; retain visibility-aware fallback only as needed.  
8.4 Implement per-user serialized join/switch transaction; enforce one current selected room/user using existing uniqueness plus locking/retry.  
8.5 Increment membership generation on switch. Include generation/request ID in join/leave/lease commands.  
8.6 Add server-issued tab/device lease association bound to current user/room/generation. Client-provided session IDs are not trusted identity.  
8.7 Same-user tabs in same room count once. Explicit Leave is global; tab close releases only its lease.  
8.8 An old tab's delayed leave/heartbeat must fail or be ignored without altering a newer room membership.  
8.9 Proposed leases: renew every 30 seconds, expire after 90 seconds. Reconcile every ~15 seconds; target cleanup ≤120 seconds.  
8.10 Define background behavior explicitly. Hidden/background clients may lose liveness when suspended; UI reattaches on resume. Do not falsely claim durable online presence.  
8.11 Use Centrifugo presence snapshots as connection evidence; deduplicate by real user and verify current membership generation. Native join/leave is a hint.  
8.12 During broker outage, valid HTTP leases keep liveness from mass false eviction; distinguish unavailable presence from empty presence.  
8.13 Derive count from valid distinct-user state; retire increment/decrement-only counter authority. If maintaining a cached count, add repair and revision checks.  
8.14 Remove random 24-second activity and all `mockRosters` production imports. Render only committed activity.  
8.15 Add durable personal StudySession with start/pause/resume/complete/interrupt and versioned idempotent transitions.  
8.16 Derive display timer from server timestamp/deadline and clock offset. Do not persist per-second ticks or trust a background JavaScript decrement loop.  
8.17 Permit one active personal session per user. Completion occurs once even when two tabs finish simultaneously.  
8.18 Choose explicit interruption semantics: explicit stop/leave may interrupt; a disconnected socket alone does not prove study stopped. Long abandonment is resolved by server policy.  
8.19 Integrate useful existing local timer/audio/task work without pretending local tasks/settings are shared durable data. Label scope accurately.  
8.20 Add room chat through generalized Channel/Message. It requires current room membership. Default history is join-forward for this phase.  
8.21 If a room retains previously subscribed nonmembers, advance room access generation on leave/removal and reissue manifests. At larger room sizes, measure this churn before choosing an alternative; never omit revocation silently.

### Parallel assignments

| Agent | Exclusive job |
|---|---|
| Lead | Room policy, schema, current-work integration, global room-screen owner |
| A | Membership/lease/snapshot routes and reconciliation worker module |
| B | Assigned room UI/timer adapter modules; no overwrite of other active room work |
| C | Real PostgreSQL race tests, multi-tab browser tests, fake-clock focus tests |

### Verification and gate

- Two concurrent joins for one user settle to exactly one room.
- Two users joining same room count two; same user in two tabs counts one.
- Stale leave from old room cannot remove current membership.
- Last tab crash cleans participant within target; one-tab close does not evict another.
- Unavailable broker does not empty all rooms.
- GET performs no seeding write.
- Activity feed shows no invented users/events.
- Pause/refresh/resume restores correct personal session.
- Two simultaneous completions persist one terminal result.
- Room chat denies nonmembers and removed members.
- **Done:** room presence and session state survive real failure modes with truthful UI.
- **Rollback:** keep secure HTTP snapshot/lease flow; disable live enhancements, never restore stale counter-only or random activity behavior.

## 13. Phase 9 — Actual attachments and notification delivery

**Goal:** uploaded files and notifications are real, private, validated and preference-aware.

**Dependencies:** Phases 1–8; storage/push provisioning only if authorized.

### Sequential steps: attachments

9.1 Define a dedicated chat-storage contract. Existing creation GridFS is draft-owned and must not be reused without separate authorization/lifecycle boundaries.  
9.2 Start with images/PDFs; hide audio/video/other file controls until corresponding validation is complete.  
9.3 Reserve upload with current message-scope permission, size/media policy and per-user quota. Generate opaque storage key server-side.  
9.4 Upload directly to private quarantine storage using constrained short-lived grants. Do not proxy large bytes through normal Next message routes.  
9.5 Finalize checks actual object existence, size, checksum and detected type; client declarations are not sufficient.  
9.6 Scan before marking ready. Protect parsers/thumbnailers with time, memory and decompression limits. Strip unsafe metadata where appropriate.  
9.7 Link only ready objects owned/authorized for that message scope; enforce no cross-conversation attachment theft.  
9.8 Download grants recheck current access and deletion state. Use short signed URLs; if immediate revocation is required, use authenticated download mediation.  
9.9 Reject SVG/HTML/executable active content initially. Serve downloads with safe content type/disposition and isolated origin.  
9.10 Clean unattached/failed objects, reconcile orphan metadata and honor retention/deletion. Handle finalize retries idempotently.  
9.11 Render actual upload progress, scanning, ready, failed and retry states. A local blob preview is explicitly pending, never a persisted uploaded file.

### Sequential steps: notifications

9.12 Create durable in-app notifications with deduplication. Mentions target real current members.  
9.13 Add per-user defaults and scope mute overrides, synchronized across devices.  
9.14 Generate push through outbox after notification persistence; recheck recipient access/preferences at dispatch time.  
9.15 Require explicit user opt-in; handle denied permission as normal. Store device subscription securely and prune revoked endpoints.  
9.16 Default push body contains minimal sensitive content. Opening it refetches authorized data.  
9.17 Add browser service worker registration/lifecycle tests; do not conflict with current mobile/static deployment. Native Android push is a separate verified adapter if included.  
9.18 Retrying push must not produce duplicate logical in-app notifications. Do not claim exactly-once OS notification display.  
9.19 Coalesce high-volume community notifications; do not fan out unbounded work inside message transactions.

### Proposed initial limits

- Images/PDF: 10 MiB each; five objects/message.
- Audio later: 20 MiB; video later: 50 MiB.
- Upload quota initially 100 MiB/user/day; centrally enforced.
- No attachment bytes in Centrifugo payloads.

### Parallel assignments

| Agent | Exclusive job |
|---|---|
| Lead | Storage/notification schema, dependency/config ownership and policy |
| A | Upload/storage/finalize/download/cleanup backend |
| B | Notification/preferences/push backend in nonoverlapping modules |
| C | Attachment/notification UI and service-worker tests after contracts freeze |

Lead performs security review; use a separate reviewer before activation.

### Verification and gate

- Actual approved upload persists and can be opened on another authorized device.
- Wrong owner/scope, MIME mismatch, oversized file, malware fixture and decompression abuse fail.
- Quarantined object cannot attach/download.
- Removed participant cannot obtain a new download grant.
- Muted scope suppresses push; revoked access suppresses queued push.
- Permission denied does not break chat.
- Retries create one logical notification/object association.
- Cleanup removes only proven unreferenced objects.
- **Done:** enabled attachment/push types pass security and end-to-end checks.
- **Rollback:** disable new uploads/push; preserve authorized access to valid existing files where safe; do not orphan records.

## 14. Phase 10 — Shared focus and advanced group/community features

**Goal:** enable remaining planned controls with actual server authority.

**Dependencies:** Phases 1–9, or an explicit user-approved deferral of Phase 9.

### Sequential steps

10.1 Add RoomSprint and participants, distinct from personal StudySession.  
10.2 Define actual room controller/moderator roles. Do not trust a UI-provided `adminUserId`.  
10.3 Start/pause/resume/stop shared sprint through versioned server commands; use timestamps and deadlines.  
10.4 New joiners get authoritative sprint snapshot; missed events do not reset timers.  
10.5 Server completes sprint once; participant outcomes reflect actual membership/session evidence, not broadcast claims.  
10.6 Persist shared environment revisions only for real shared settings. Personal volume stays local.  
10.7 Validate external music/background URLs and consent/autoplay behavior; do not create an arbitrary server URL-fetch proxy.  
10.8 Complete group invitation lifecycle, role transfer, member activity with privacy controls and clear pending/accepted/removed states.  
10.9 Add authorized PostgreSQL history search with appropriate full-text index, pagination and history boundaries. Do not search all messages then filter in the browser.  
10.10 Add real message pinning and announcement write policies, with moderator audit.  
10.11 Mentions validate users and scopes and feed Phase 9 notifications when enabled.  
10.12 Replace remaining advanced UI placeholders; if no actual backend exists, hide the feature.  
10.13 Keep voice/video/screenshare controls absent unless a separate media plan is authorized.

### Parallel assignments

| Agent | Exclusive job |
|---|---|
| Lead | Schema, role policy, shared timing and event contracts |
| A | Sprint/environment backend and focused tests |
| B | Search/pins/announcements and advanced group modules |
| C | Assigned shared-focus/group UI, multi-user acceptance tests |

### Verification and gate

- Two devices display shared timer within one second after synchronization under normal latency.
- Unauthorized participant cannot change shared timing/environment.
- Concurrent pause/resume produces one accepted revision and one conflict where appropriate.
- Late joiner sees correct remaining time.
- Search cannot leak foreign channels or pre-join group history.
- Pins/announcements persist across devices and respect role changes.
- **Done:** each exposed advanced control has a real effect and tested permission path.
- **Rollback:** disable individual advanced features, keep data/revisions, preserve personal focus and core messaging.

## 15. Phase 11 — Failure hardening, abuse prevention and observability

**Goal:** prove behavior under faults and make production diagnosable.

**Dependencies:** selected feature phases integrated. Basic security is mandatory in earlier phases; this phase verifies and closes gaps, not postpones security.

### Sequential steps

11.1 Create a threat matrix for every route, callback and transport permission. Include direct ID substitution and nested reply/file references.  
11.2 Enforce distributed budgets. Process-local maps do not protect multiple app instances. Use SQL atomic budgets initially where acceptable; shared Redis for higher-frequency budgets when deployed.  
11.3 Enforce body, content, message, attachment, invitation and search ceilings. Start with a 4,000-character text limit plus a bounded encoded HTTP body, then measure/product-review.  
11.4 Sanitize supported rendering paths; never enable raw HTML from message content. Validate link protocols and file types.  
11.5 Test membership removal while sends, queued publications, recovery and callbacks race. Verify generation barriers, not merely unsubscribe success.  
11.6 Test account restriction across all affected scopes; block new grants immediately and complete revocation workflow before marking it fully effective.  
11.7 Inject crashes at each transactional/outbox boundary. Preserve accepted messages and original event IDs.  
11.8 Test duplicate/out-of-order/missing/corrupt events and bounded client recovery.  
11.9 Add retry jitter and finite budgets, avoid synchronized token/subscription refresh waves.  
11.10 Add structured logs with request/event IDs, scope type, revision, latency, error class. Redact bodies/tokens/signed URLs/private profile fields.  
11.11 Add metrics for connection/auth/subscription outcomes, worker liveness, oldest pending age, retries/dead letters, DB waits, room cleanup lag and scanning/push lag.  
11.12 Add dashboards and alerts with named operator ownership. Metrics endpoints remain private.  
11.13 Budget DB connections across serverless instances, workers, migrations and operations. Configure worker-specific pool size; do not assume per-process max 2 bounds the whole system.  
11.14 Document log/event/backup retention and access.  
11.15 Add CI gates: typecheck separately from Next build, focused tests, real isolated integration, security/E2E suites. Existing planning-sync workflow is not sufficient.  
11.16 Update relevant `MEMORY/` files with authoritative new entry points only after implementation actually changes them.  
11.17 Ensure feature flags are server-enforced, not merely hidden client buttons.

### Parallel assignments

| Agent | Exclusive job |
|---|---|
| Lead | Risk triage, pool budgets, shared config/CI integration |
| A | Chaos/recovery and worker reliability hardening |
| B | Metrics/logging/dashboards/runbooks |
| C | Independent adversarial API/authorization/abuse tests |

### Required fault tests

- DB commit succeeds, publish fails.
- Publish succeeds, worker ACK fails.
- Worker lease expires during slow publish.
- Permanent bad event blocks one stream, not the entire system.
- Mongo preference sync fails during enrollment.
- DB unavailable during send.
- Broker unavailable during room reconciliation.
- Multiple clients reconnect while access is revoked.
- Public-cohort nonmember accesses old metadata URL.
- Browser switches accounts with cached messages.
- Old event replay tries to restore deleted body.

### Gate and rollback

- No critical/high authorization defect remains.
- Every fault either converges to canonical state or shows a truthful recoverable error.
- Oldest pending age, dead letters and cleanup lag have working alerts.
- Proposed alert: pending age >30 seconds for five minutes; absent worker heartbeat; cleanup >120 seconds.
- **Done:** security/reliability matrix passes; operational diagnostics are actionable and private.
- **Rollback:** disable faulty feature or transport, retain SQL authority/outbox; never turn off auth/rate limits to "restore functionality."

## 16. Phase 12 — Load, capacity and cost validation

**Goal:** replace estimates with measured release limits.

**Dependencies:** Phase 11; isolated/staging load environment and authorized resource budget.

### Sequential steps

12.1 Select a release target from observed expected concurrency, not registered account count.  
12.2 Build load clients using actual Centrifuge protocol and representative authenticated subscription flow. Do not benchmark an echo server and extrapolate.  
12.3 Seed synthetic users/data only into an isolated load environment with an obvious fixture namespace and cleanup ownership. These fixtures must never appear in production.  
12.4 Run baseline 65, 650 and, if budget permits, 6,500 connections with four average subscriptions and 1.3 connections/user.  
12.5 Model 1/10/100 durable messages per second and 4/40/400 control signals per second respectively, typical 1 KiB message/200-byte signal, average eight recipients.  
12.6 Add a hot 500-subscriber channel; average fan-out is not a maximum.  
12.7 Add 2× bursts, typing, receipt, token refresh and room-lease traffic.  
12.8 Reconnect 25%, 50% and 100% of clients over 30 seconds.  
12.9 Kill a worker, restart a broker, and disrupt Redis if used under load.  
12.10 Measure CPU, memory, connection/subscription counts, fan-out bandwidth, app callback latencies, SQL connections/locks, outbox age and client convergence.  
12.11 Run two-hour stress and 24-hour soak at selected release target. Verify no unbounded memory/journal/backlog growth.  
12.12 If a single node fails targets, identify actual bottleneck before adding nodes. Fix unbounded queries, auth storms, fan-out or hot locks first.  
12.13 Before multi-node Centrifugo, deploy a shared Redis/Valkey engine in staging and verify cross-node publication/presence.  
12.14 HA requires surviving one-node failure with spare capacity and resilient shared services. Two brokers plus one fragile Redis are not full HA.  
12.15 Calculate monthly costs from actual time-weighted traffic, retained attachments, operations and bandwidth. Reverify provider prices and FX assumption.  
12.16 Publish measured capacity, chosen caps, scaling trigger, infrastructure plan and cost allowance. Do not promise free 100,000-user service.

### Parallel assignments

| Agent | Exclusive job |
|---|---|
| Lead | Load budget, environment isolation, capacity decision |
| A | SDK load harness/scenarios |
| B | SQL/worker profiling and index/query improvements |
| C | Browser responsiveness, metrics analysis and cost calculation |

Do not run paid or production load tests without explicit authorization. Load-harness fixture creation is not permission to alter real accounts.

### Proposed SLO gate

- Message acceptance p95 ≤750 ms.
- Commit-to-recipient p95 ≤1 second, p99 ≤3 seconds.
- Normal oldest pending delivery <5 seconds.
- No committed-message loss in injected failures.
- No duplicate rendered messages.
- Healthy stale-room cleanup ≤120 seconds.
- Bounded 500-event offline delta recovery ≤5 seconds or explicit progress/pagination.
- DB connection use below allocated budget with operational reserve.
- Sustained resource headroom documented; release caps chosen from measurements.

**Done:** a measured report supports selected infrastructure and limits. Unreached scenarios are marked untested, not passed.  
**Rollback:** reduce release concurrency/features or keep single tested deployment; preserve data.  
**Failure points:** low-fan-out-only tests, excluding auth traffic, fixture leakage, ignoring serverless costs, passing averages while p99 fails.

## 17. Phase 13 — Production rollout and operational handoff

**Goal:** release only verified behavior and retain a working recovery path.

**Dependencies:** all selected feature gates, Phases 11–12, explicit production authority.

### Sequential steps

13.1 Reconfirm deployed source, migrations, rollback-compatible app version and secrets.  
13.2 Take/verify backup and restore into isolation. Record actual RPO/RTO capability; do not invent a zero-loss disaster guarantee.  
13.3 Review migration SQL, expected lock duration, row counts and rollback limitations. Apply additive changes through the approved deployment process.  
13.4 Verify post-migration constraints, existing message IDs/counts, parent references, sequences, creator memberships and no duplicate direct pair.  
13.5 Deploy APIs/worker with customer-facing flags disabled. Ensure every active writer now uses transactional event creation; an old route must not bypass the outbox.  
13.6 Deploy Centrifugo and ingress configuration with verified private endpoints, approved origins, certificate and exact version.  
13.7 Run synthetic real-user enrollment, subscribe, message, removal, reconnect and room tests in designated real test accounts.  
13.8 Enable internal users and one approved cohort. Do not populate fabricated community activity to make the launch look active.  
13.9 Observe 24–48 hours, including overnight lease/session cleanup and worker restart.  
13.10 Expand by cohort/user percentage; use independent flags for community, DM/group, rooms, attachments, push and advanced features.  
13.11 Roll back immediately on authorization leak, accepted-data loss, sustained queue growth or repeated false-success UI.  
13.12 During rollback, preserve SQL records and disable affected entry points/transport. Secure HTTP sync remains the fallback.  
13.13 Verify credentials rotation in staging and schedule controlled production rotation process. No secret values in runbooks.  
13.14 Assign incident owners, alert routing, backup/retention ownership and capacity review cadence.  
13.15 Record final test results, known limitations and deferred features. Hide all deferred controls.  
13.16 Update operational memory and final release report. Stop after authorized scope; do not add media or other projects automatically.

### Parallel assignments

| Agent | Exclusive job |
|---|---|
| Lead/operator | Sole migration/deployment/flag executor; go/no-go authority |
| A | Read-only migration/data integrity verification |
| B | Real-user smoke/E2E verification |
| C | Metrics/alerts/rollback observation and runbook review |

Only one operator changes production state. Other agents report findings; they must not independently rotate secrets, migrate or roll back.

### Runbooks that must exist

1. Outbox backlog and dead-letter recovery.
2. Centrifugo unavailable: HTTP fallback and reconciliation.
3. PostgreSQL unavailable: fail closed, preserve drafts.
4. Worker restart/lease recovery.
5. Room reconciliation failure and count repair.
6. Account/cohort/group emergency revocation.
7. HMAC signing key, API key and callback credential rotation.
8. Attachment quarantine/abuse incident.
9. Database backup restoration and data-integrity verification.
10. Application rollback with additive schema preserved.
11. Redis/node failover if multi-node is deployed.
12. Cost/usage incident and controlled admission limits.

### Gate

- Canary remains healthy for 24–48 hours.
- No fake production data or nonfunctional success controls.
- Real enrollment/chat/group/room acceptance tests pass after deployment.
- Existing users/messages are preserved.
- Alerts and rollback are rehearsed.
- Operator ownership and measured capacity are documented.
- **Done:** approved release scope is operationally supported, not merely deployed.

## 18. Verification commands and test inventory

### 18.1 Existing repository commands to verify during implementation

Run from repository root only after understanding side effects and using the correct environment:

```text
npx tsc --noEmit
npm run lint
npx vitest run src/server/domain/cohort/__tests__
npx vitest run src/server/infrastructure/auth/__tests__
npx vitest run src/app/api/community
npx vitest run src/app/api/studyroom/__tests__
npx vitest run src/client/screens/dashboard/studyroom/__tests__
npm run verify:vercel
npm run build
```

Build/typecheck can create output; these commands are for the future implementation, not evidence they ran during planning. `npm run build` does not replace typecheck because the audited Next configuration ignores TypeScript build errors.

Do not silently install tools through `npx` if they are absent. The implementing lead owns explicit dependency changes.

### 18.2 New scripts to create during authorized implementation

Suggested script names; **not currently guaranteed to exist**:

| Script | Responsibility | Phase |
|---|---|---|
| `test:messaging:unit` | Contracts, policies, reducers, idempotency logic | 1–2 |
| `test:messaging:integration` | Disposable real PostgreSQL plus command/outbox concurrency | 2 |
| `test:realtime:integration` | Actual pinned Centrifugo/SDK authorization/recovery | 3–4 |
| `test:messaging:e2e` | Multiple authenticated browser contexts/devices/tabs | 5–8 |
| `test:messaging:chaos` | Deliberate worker/network/DB fault matrix | 11 |
| `test:messaging:load` | Actual protocol load with explicit environment/budget | 12 |
| `messaging:worker` | Supervised worker entry point using root environment convention | 2 |
| `messaging:readiness` | Non-destructive schema/config/worker/backlog checks | 11 |

Integration scripts must require explicit isolated database configuration and reject known production hostnames/project identifiers. Do not default to root production `DATABASE_URL`. Clearly separate local fixture credentials from production secrets.

### 18.3 Required test IDs

Track these in the final implementation report so no major behavior disappears between phases.

| ID | Acceptance |
|---|---|
| AUTH-01 | Missing production secret fails closed |
| AUTH-02 | Shared guest cannot enter private messaging |
| AUTH-03 | Account switch clears prior user's private state |
| ENR-01 | Explicit Join produces one real membership and immediate chat access |
| ENR-02 | Public nonmember discovers cohort but cannot read/write/subscribe |
| ENR-03 | Invitation expired/replayed/wrong-recipient requests fail |
| ENR-04 | Creator role survives idempotent enrollment; pause is not leave |
| MSG-01 | Two users exchange persisted canonical messages |
| MSG-02 | Retry identical request creates one record |
| MSG-03 | Same request ID with different payload conflicts |
| MSG-04 | Channel switching cannot misroute send/retry |
| MSG-05 | Pagination stable under concurrent insert/delete |
| DM-01 | Concurrent direct creation yields one pair |
| GRP-01 | Actual invitation/acceptance/roles persist |
| GRP-02 | Removal denies old token/socket and new HTTP access |
| GRP-03 | Ownership transfer/last owner invariant |
| INT-01 | Delivered/read watermarks are recipient-owned and monotonic |
| INT-02 | Replies cannot target foreign channels |
| INT-03 | Reactions idempotent, edits revisioned, deletions remain tombstoned |
| INT-04 | Mute/pin preferences synchronize across devices |
| INT-05 | Typing expires and presence respects privacy |
| RT-01 | Invalid token/origin/namespace/callback denied |
| RT-02 | Membership generation prevents post-removal new content |
| RT-03 | SDK refresh/reconnect/Strict Mode has no connection leak |
| RT-04 | Reconnect beyond broker TTL recovers from SQL |
| DUR-01 | Commit success + publication failure eventually converges |
| DUR-02 | Publication success + ACK failure does not duplicate display |
| DUR-03 | Two workers and stale ACK fencing are correct |
| DUR-04 | Missing/out-of-order events reconcile without stale overwrite |
| ROOM-01 | One selected room/user under concurrent joins |
| ROOM-02 | Two tabs count once; closing one retains other |
| ROOM-03 | Stale leave cannot affect newer membership |
| ROOM-04 | Crash cleanup ≤120 seconds with healthy dependencies |
| ROOM-05 | Broker outage is not interpreted as everyone leaving |
| FOC-01 | Personal start/pause/resume/complete persists once |
| FOC-02 | Shared sprint role/revision/timer consistency, when enabled |
| FILE-01 | Real scanned upload, private download, invalid type/size rejection |
| FILE-02 | Cross-scope object attach and removed-user grants denied |
| NOT-01 | Real notification deduplication and mute/access enforcement |
| MOCK-01 | Empty account contains zero fake social content |
| MOCK-02 | API failure shows error, never demo fallback |
| MOB-01 | Real authenticated mobile connection and background/resume |
| OPS-01 | Private API/metrics and key-rotation procedure |
| OPS-02 | Restore/rollback preserves valid message history |
| LOAD-01 | Selected concurrency meets measured SLOs and pool budget |

## 19. Completion checklist for the implementing lead

- [ ] Later implementation authorization and release scope are explicit.
- [ ] All existing user changes were preserved or coordinated.
- [ ] Phase 0 facts were refreshed; deployed state was not inferred from README.
- [ ] Real enrollment is the single community-chat entitlement.
- [ ] No visibility-only chat authorization remains in HTTP, sync, files or callbacks.
- [ ] No duplicate community-membership model exists.
- [ ] Real DMs/groups and participants are persisted.
- [ ] No production mock conversation, roster, count, receipt, upload or activity remains.
- [ ] Unsupported UI controls are absent or truthfully disabled.
- [ ] SQL transactions include durable events and outbox.
- [ ] Dispatcher claims/fencing/retries pass actual PostgreSQL tests.
- [ ] Client optimistic IDs, duplicate events and missed events reconcile correctly.
- [ ] Membership/account revocation covers existing connections.
- [ ] Study-room races, multi-tab behavior and crash cleanup pass.
- [ ] Personal focus records are durable; shared features are explicitly scoped.
- [ ] Attachments/push/advanced features are fully gated or explicitly deferred.
- [ ] Mobile is verified or kept disabled with a clear limitation.
- [ ] Typecheck, integration, E2E, security, chaos and load evidence is recorded.
- [ ] Schema changes are additive and restoration is rehearsed.
- [ ] Secrets, origins, internal routes and operational metrics are secure.
- [ ] Capacity/cost claims are measured or clearly labeled estimates.
- [ ] Canary, rollback and operator ownership are complete.
- [ ] Relevant repository memory reflects actual final implementation.
- [ ] Final report states exact completed/deferred phases and remaining risks.

**Stop after the authorized scope. Never replace missing backend behavior with fake success to satisfy a visual demo or test.**
