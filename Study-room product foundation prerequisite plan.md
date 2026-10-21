# Study-room product foundation prerequisite plan

Planning only. No implementation is authorized by this document. Prepared from the repository on 2026-10-21.

## 1. Execution order and purpose

Complete this prerequisite plan before starting the remaining phases in [Study-room backend and frontend integration plan.md](<Study-room backend and frontend integration plan.md>). The earlier document is preserved verbatim as requested; this document establishes its prerequisite product behavior and clarifies overlap.

The prerequisite delivers an actual room product: create a room, find it, understand its access rules, join it, manage it, assign roles, leave it, and close it. All these operations must persist and authorize correctly over HTTP before adding the full realtime experience. It is not a frontend mockup milestone.

Basic lease correctness, role revocation, and room authorization cannot be postponed until realtime integration: they are required to make joining and management safe. Implement those foundations here once. Later integration phases verify and extend them rather than replace them.

Until the later plan enables durable chat, shared playback, and synchronized timers, hide or clearly disable those unavailable controls. Do not retain demo messages, fake participants, fabricated media queues, or successful-looking placeholder actions.

## 2. Verified starting point

- `src/client/screens/dashboard/studyroom/StudyRoomScreen.tsx`: renders static `ROOM_CATALOG` and `MOCK_ROSTERS`; no actual discovery query.
- `src/client/screens/dashboard/studyroom/data/roomCatalog.ts`: three fixed rooms; `demo-mira`, `demo-kai`, and `viewer` supply ownership.
- `src/client/screens/dashboard/studyroom/types.ts`: `RoomSlug` is the union `library | fireplace | developer-den`; `ViewerRole` is only `admin | member`; `RoomDefinition` combines mock ownership and decorative presets.
- `src/client/screens/dashboard/studyroom/components/RoomCard.tsx`: accepts `sampleCount` and `MockPeer`, labels demo studying counts, and links directly to the room stage.
- `src/app/(dashboard)/studyroom/[roomSlug]/page.tsx`: resolves static catalog entries and accepts `viewAs`; cannot resolve arbitrary newly created rooms.
- `src/app/api/studyroom/route.ts`: GET initializes defaults and returns publicly cached participant-bearing objects; POST handles old join/leave actions, not user-facing room creation.
- `prisma/schema.prisma`: StudyRoom has ID, title, thumbnail, status, count, and relations; it lacks persisted slug, description, discoverability, cohort scope, ownership metadata, and capacity.
- `RoomController` exists with a room/user composite key and a string role. Reuse it for delegated roles; do not create a competing room-admin table.
- `RoomParticipant` and `RoomLease` already exist. A participant is current presence, not durable membership, ownership, or permission to access cohort chat.
- `src/server/domain/studyroom/sprint.service.ts`: room controller checks fall back to any participant when no controllers exist. Remove that fallback before exposing management.
- `src/client/screens/dashboard/studyroom/room/components/MusicSettingsModal.tsx`: default queue and local upload presentation exist; the presence of UI is not evidence of storage or shared playback.
- `CohortMember.role` is `EXPLORER | MODERATOR | CREATOR`; application `User.role` is a separate enum. Map actual cohort roles deliberately; never interpret a global CREATOR badge as room-wide administrative permission.

Active modifications and untracked room redesign files are user work. Preserve them. Deployed database state and applied migrations remain unverified; inspect those read-only before implementation migrations.

## 3. Product decisions for the first functional release

### 3.1 Room scopes, access, and discoverability

Keep three concepts distinct:

1. Scope: standalone or attached to a specific cohort.
2. Eligibility: who may access/join, derived from that scope and restrictions.
3. Listing: whether eligible users see the room in discovery.

Recommended first release:

| Room kind | Can discover | Can join | Who can create |
|---|---|---|---|
| Standalone, listed | Authenticated eligible users | Authenticated non-guest users, subject to restrictions/capacity | Eligible authenticated non-guest users within quotas |
| Standalone, unlisted | Owner/delegates in management; other users via link | Same eligibility as listed standalone rooms | Same as above |
| Cohort, listed | Enrolled users in their cohort directory; safe public-cohort teaser only if existing policy permits | Enrolled cohort users, subject to restrictions/capacity | Cohort creator or MODERATOR/CREATOR member permitted by cohort policy |
| Cohort, unlisted | Eligible users via link; owner/delegates in management | Same cohort enrollment requirement | Same cohort-authorized creators |

Unlisted means absent from general discovery, not private. Explain this in the creation form. No secret-link claim.

Private standalone invite-only rooms are deferred from this first foundation release. Do not show a private-room option until durable room admission grants, invitations, expiry, revocation, and recovery are implemented. Private cohort rooms already use cohort enrollment/invitations; do not add a second chat membership list.

Joining a public cohort room while not enrolled shows “Join cohort to enter.” That explicit action calls the existing enrollment service, then retries room eligibility. Private/invite-only cohorts use their existing authorized invitation process. A room link never bypasses it.

### 3.2 Persistent room lifecycle

Use explicit statuses:

- DRAFT: visible only to managers; no join.
- OPEN: eligible users may join; discovery follows listing policy.
- CLOSED: no new joins; current occupancy is terminated through the lifecycle service; records remain.
- ARCHIVED: hidden from normal discovery, read-only management/history according to retention policy.

Allow DRAFT -> OPEN, OPEN -> CLOSED, CLOSED -> OPEN, CLOSED -> ARCHIVED, and ARCHIVED -> CLOSED by authorized owners. Reopening an archive requires an explicit later OPEN action. Reopening never resurrects old leases.

Publishing validates owner, scope, channel, stream, and initial environment. Persistent rooms do not disappear when their owner closes a tab. No automatic host promotion on disconnect. Empty rooms remain available until explicitly closed or archived.

Do not implement hard deletion in the first UI. Archive instead; preserve messages and study records.

### 3.3 Identity and URLs

- Canonical route remains `/studyroom/[roomSlug]`.
- Database ID is the mutation identity; persisted slug is the route identity.
- Generate a unique normalized slug once with collision handling; reserve route words such as `new`, `manage`, `session`, and `roster`.
- Renaming a title does not change its URL.
- Replace the three-value RoomSlug type with a validated string contract.
- Visual presets remain static curated data. They no longer create rooms or imply participants/owners.
- Keep existing room IDs and message references during backfill. Detect conflicting historical room names before assigning slugs.

### 3.4 Proposed launch limits

Use server configuration for provisional limits: title 1–80 characters, description up to 1,000, rules up to 2,000, up to five tags of 24 characters, capacity 2–100 distinct users, default capacity 25. Initially limit a user to three OPEN standalone rooms and ten creations/day. These are product/abuse defaults, not measured server capacity guarantees; adjust from actual usage.

Validate trimmed Unicode input, finite integers, known preset IDs, and supported language codes. Use curated covers first; custom image uploads belong to the attachment pipeline, not arbitrary remote URLs.

## 4. Roles, control, and ownership

### 4.1 Roles

- Owner: one durable accountable user; owns settings, lifecycle, delegation, and transfers.
- Moderator: manages ordinary participants, reports, and room content; can control shared study settings.
- Host: controls shared scene/music/ambience and shared sprint; cannot change access, ownership, or roles.
- Participant: eligible user currently joined; personal controls and permitted chat only.
- Viewer: eligible user inspecting a safe preview; no participation or shared mutations.

Use `StudyRoom.ownerId` as the sole room ownership authority. Use existing RoomController rows for MODERATOR and HOST delegation. Reconcile legacy OWNER rows during migration; do not maintain contradictory ownership authorities.

Platform ADMIN access must use the existing trusted platform policy and produce an audit record. Cohort creator/governance roles retain the ability to manage cohort-owned rooms when a room owner disappears, but this authority must derive from actual cohort scope and membership, not from a channel having two parent scopes.

### 4.2 Capability matrix

| Action | Owner | Moderator | Host | Participant |
|---|---|---|---|---|
| View eligible room / join | Yes, when OPEN and eligible | Yes | Yes | Yes |
| Personal tasks, timer, mute | Own only | Own only | Own only | Own only |
| Shared environment / sprint controls | Yes | Yes | Yes | No |
| Change title, description, listing, capacity | Yes | No | No | No |
| Invite/share eligible entry link | Yes | Yes | Yes | Yes |
| Remove/restrict ordinary participants | Yes | Yes | No | No |
| Moderate message content | Yes | Yes | No | No |
| Assign/revoke delegated room roles | Yes | No | No | No |
| Transfer ownership | Yes | No | No | No |
| Close/reopen/archive | Yes | No | No | No |

Moderators cannot target owners, other moderators, hosts, or inherited cohort governors; owners can revoke local delegated roles first. Platform/cohort governance overrides are separate explicit operations. Role assignment is never an access grant: a delegated user must still satisfy room/cohort eligibility.

Return server-computed capabilities such as `canJoin`, `canEditRoom`, `canControlEnvironment`, `canManageParticipants`, and `canTransferOwnership`. Components render those flags; every API independently checks them. Remove `viewAs` and `adminUserId === 'viewer'` production behavior.

Shared environment changes require a live participant lease as well as the role. Owner administrative settings may be managed outside the active room.

### 4.3 Ownership transfer and governance changes

Use a recipient-accepted transfer proposal. Validate current owner, expected room revision, recipient eligibility, and unexpired proposal again at acceptance. Transfer transactionally; old owner becomes an ordinary eligible user unless explicitly granted another role. Invitations and transfer tokens are hashed, expiring, and never logged.

An owner leaving the room retains ownership. Account deletion requires transfer, archival, or trusted administrative reassignment; do not cascade-delete the room. A cohort owner who loses cohort eligibility cannot retain room access through a local role. Cohort governance can reassign the room; freeze owner-only actions if there is no eligible owner until resolved.

## 5. Screens and flows that must be added

### Discovery at /studyroom

Preserve the existing visual style while adding:

- Create room action.
- Tabs: Discover, My cohorts, My rooms, Recent. These filter real server data, not separately seeded lists.
- Search title/description; filter by cohort, tags, language, and available capacity.
- Stable pagination and deterministic ordering, initially recently created or active count plus ID tie-breaker.
- Real title, description, scope badge, owner identity, status, and capacity on cards.
- Clear states: loading, no rooms, no matches, unavailable, full, closed, and error with retry.
- No fabricated popularity, participants, activity, or host-online badge.

Initially use authenticated HTTP snapshots. If count refresh is delayed, show its age or a refreshing state. Do not label cached results as instant realtime. Never use unfiltered counts, search suggestions, pagination totals, or avatars to reveal private cohort rooms.

### Create room

Form fields: title, description, scope/cohort, listed/unlisted, tags, language, capacity, rules, initial scene and ambience. The cohort picker lists only cohorts where creation is allowed.

Actions: Save draft, or Create and open. Neither action silently joins the creator. After publication, offer Enter room and Share link. Failed requests preserve the draft. Retrying with the same request ID returns the same room.

Create room, ownership, default environment, channel, realtime stream, audit event, and applicable journal/outbox records in one transaction. Do not permit partially created rooms to appear in discovery.

### Room preview and entry

The slug route first resolves safe metadata and access state. Show the join CTA and rules. URL prefetch, SSR, and GET requests do not create participation.

Entry outcomes: signed out -> authenticate with return URL; cohort enrollment required -> enrollment action; invitation required -> existing cohort invitation flow; restricted -> clear denied state; full -> room full; closed -> room closed; already elsewhere -> explicit switch confirmation; eligible -> Join room.

Only successful server join reveals the active participant experience. Do not fabricate the current viewer as present before it succeeds.

### Manage room

Add a manager-only settings surface at `/studyroom/[roomSlug]/manage` or an equivalent accessible drawer. Include metadata, listing/capacity, delegated roles, restrictions, transfer proposals, lifecycle controls, and paginated audit history. Display permission errors if authority changes while open.

Changing listing does not change admission rules. Cohort scope is immutable after publication in the first release. Do not allow moving historical private room messages into a public scope through a dropdown.

### People and actions

Render actual owner/moderator/host badges independently from online status. Show only permitted actions against each target. Removal and restriction need real backend outcomes and explicit reasons. An owner who is offline remains owner; a room without an online host does not invent one.

Recommended moderation semantics: removal includes a short rejoin cooldown; a ban/restriction is explicit with optional expiry. Without this distinction, a kicked user could immediately rejoin and make the control ineffective. Moderator restrictions apply to ordinary room users and never mutate cohort membership silently.

### Sharing

Copy a canonical clean URL, excluding role/debug parameters. Label it Share room. For cohort rooms, explain that recipients must enroll or be invited to the cohort. Do not claim that copying a URL sends an invitation or grants access. Creating new cohort invitations must reuse the existing cohort permission policy and delivery flow.

## 6. Data contracts and migrations

Extend existing StudyRoom with: `slug`, `description`, `ownerId`, optional `cohortId`, `listing`, normalized `status`, `capacity`, `rules`, `tags`, `language`, `visualPresetId`, `revision`, publication/closure/archive timestamps. Add foreign keys and indexes matching owner/status, cohort/status/listing, and listing/status/createdAt queries. Use a unique slug index. Start with bounded parameterized search; add specialized search indexes only when query plans justify them.

Preserve RoomParticipant and RoomLease. Add a persistent per-user assignment epoch as described in the integration plan; ensure it survives leaving. Add a durable last-visited record only if existing data cannot support Recent without retaining presence rows. Recent must always recheck current access and is private to the user.

Reuse RoomController for MODERATOR/HOST with assigned-by/time metadata and supported-role validation. Prevent self-promotion or owner shadowing.

Add narrowly scoped records where needed:

- Room restriction: room/user unique key, action, expiry, reason, issuer, timestamps; checked during join, renew, reads, writes, and subscriptions.
- Ownership transfer: room, sender, recipient, expiry, status, revision; at most one pending transfer per room.
- Room audit: room, actor, action, target, request ID, safe changed fields, time. Reuse a suitable existing audit store if one covers these events; message moderation audits alone are not room-management history.

Do not add a general RoomMember table for public/cohort entitlement. CohortMember remains authoritative; RoomController is delegated authority; RoomParticipant is presence.

Migration sequence: inspect real SQL/Prisma mappings; back up and rehearse restore; add nullable columns/tables; backfill stable slugs and statuses; assign verified owners or mark legacy rooms CLOSED pending governance; repair channel/stream/environment relationships idempotently; resolve duplicates; add non-null/check/unique constraints; enable new reads; enable writes. Never backfill demo users as owners. Do not mutate previously applied migration files as a repair strategy.

Retention: archive rooms rather than cascade-delete. Expired leases are transient; messages and study records follow existing durable retention rules. Keep moderation/audit access restricted and avoid raw goal/task/message content in management logs. Set the retention duration explicitly before enabling an automated purge.

## 7. API plan

Keep existing `/api/studyroom` GET and legacy action POST compatible while refactoring them. Use a distinct create route to avoid overloading its current action contract.

| Proposed endpoint | Contract |
|---|---|
| GET /api/studyroom | Authorized paginated discovery; query, scope, filters, cursor; explicit DTO, never raw ORM objects |
| POST /api/studyroom/rooms | Create draft/open room; requestId and validated settings; 201 with ID/slug/revision |
| GET /api/studyroom/[roomSlug] | Safe preview/bootstrap, capabilities, eligibility reason, own active assignment |
| PATCH /api/studyroom/[roomSlug] | Owner settings mutation with expectedRevision; 409 on conflict |
| POST /api/studyroom/[roomSlug]/lifecycle | Publish/close/reopen/archive/restore with expectedRevision and requestId |
| POST /api/studyroom | Existing join/renew/leave actions routed through the sole lifecycle service; extend with fenced switch |
| GET /api/studyroom/roster | Authorized active users; actual role projection; private/no-store |
| GET/PUT/DELETE /api/studyroom/[roomSlug]/controllers/[userId] | Delegation read/change/revoke, owner-only writes; eligible target validation |
| POST /api/studyroom/[roomSlug]/participants/[userId]/remove | Remove with cooldown; transactional lease invalidation; target hierarchy enforcement |
| GET/POST/DELETE /api/studyroom/[roomSlug]/restrictions | Owner/moderator actions within hierarchy; expiry support |
| POST /api/studyroom/[roomSlug]/ownership-transfers | Create recipient-bound proposal |
| POST /api/studyroom/[roomSlug]/ownership-transfers/[id]/accept | Recipient accepts; all authority and revision checks repeated |
| DELETE /api/studyroom/[roomSlug]/ownership-transfers/[id] | Authorized cancellation |
| GET /api/studyroom/[roomSlug]/audit | Authorized paginated management history |

Routes are proposed implementation contracts, not claims that they already exist. Shared request/response schemas belong in a client-safe contracts module; server policy and transactions stay under `src/server/domain/studyroom/`.

Return stable machine-readable errors for room full/closed, enrollment required, restriction, stale assignment, revision conflict, quota exceeded, and missing authority. Avoid revealing private room existence to unauthorized callers. Include request IDs and retryability where useful. Never turn auth errors into empty success data.

All state-changing requests use authenticated identity from the server, origin/CSRF protections appropriate to existing session transport, rate limits, and idempotency. Role, user ID, owner ID, and cohort authority from the browser are not trusted.

## 8. Basic joining must work before realtime

Implement actual lease-aware HTTP join/renew/leave now; it is a prerequisite, not a fake temporary join.

- Lock a stable user row/assignment record for competing transitions. For capacity, lock affected room rows in deterministic order as well; specify the same lock order for join, switch, close, restriction, and sweeper.
- Enforce capacity against distinct users with live matching leases. Another tab of an already-present user does not consume a slot.
- A failed switch to a full/closed target must preserve the user's previous membership.
- Commit assignment, tab lease, epoch changes, and durable events/outbox records atomically.
- Renew every approximately 30 seconds against a 90-second lease; schedule actual cleanup and monitor it.
- Fence all delayed renew/leave calls with room, tab, and assignment epoch. A deleted membership must not reset epoch history.
- On close/ban/eligibility loss, invalidate affected leases and reject future operations. Revalidate every HTTP request; remove existing socket authority through the established revocation mechanism before claiming safety.
- Provide HTTP polling with jitter while realtime wiring is pending, for example roster refresh every 15 seconds while visible. Revalidate on focus and before sensitive actions. This refresh interval is not the lease heartbeat.
- Basic presence must survive refresh, duplicate requests, multi-tab navigation, and crashes. No optimistic fake success.

If existing realtime consumers can subscribe to these rooms, feature-gate new room subscriptions until revocation is correct or complete their authorization fix here. Do not introduce private rooms while leaving old permissive read/post/subscribe paths usable.

## 9. Ordered prerequisite phases

Each phase requires a working HTTP vertical slice where applicable; UI placeholders do not satisfy acceptance.

### P0 — Inventory and freeze contracts

Read current source and working tree; preserve ongoing redesign. Capture actual schema drift and migration runner. Record scopes, role matrix, lifecycle, history visibility, and ownership policy. Define API DTOs, errors, and file ownership.

Acceptance: no unresolved authority source or contradictory ownership model. Rollback: documentation only.

### P1 — Schema and authoritative room policy

Add/backfill room fields, controller semantics, restrictions, transfer/audit records, and persistent assignment epoch. Implement one capability/eligibility resolver used by all existing room-related APIs, including message and subscription services. Reconcile SQL mappings and legacy rows. Default ownerless legacy rooms to closed until assigned deliberately.

Acceptance: new and migrated records resolve correctly; denied users cannot read/write through legacy endpoints. Rollback: disable new writes; keep additive schema and hardened authorization.

### P2 — Creation and management backend

Implement idempotent atomic room creation, settings updates, publication/lifecycle, delegation, transfer, restrictions, and audit. Enforce quotas and target hierarchy. Add channel/stream/environment provisioning without fake content.

Acceptance: authenticated creator creates a real room; retries yield one room; invalid scope/role changes fail; lifecycle transitions preserve history. Rollback: disable creation/management mutation flags, retain records.

### P3 — Discovery and creation UI

Replace static directory with real query-backed tabs/search/filter/pagination. Build creation form and manager settings. Change RoomCard and RoomDefinition DTOs to dynamic IDs/slugs and real data. Keep styling, backgrounds, responsive behavior, and accessibility. Reserve static catalog for visual presets only.

Acceptance: newly created room is discoverable to eligible users and reloads on another device; private cohort rooms never appear to outsiders. Rollback: disable new discovery exposure; do not restore mocks as production data.

### P4 — Slug entry, join, switch, leave, and cleanup

Connect actual dynamic route and the existing room stage to preview/eligibility and fenced HTTP lifecycle. Wire scheduler, capacity locking, multi-tab leases, and real roster. Add honest full/closed/denied states and return-to-room navigation. Hide unsupported chat/media controls pending the integration plan.

Acceptance: three real accounts can create/find/join a room; a fourth cannot exceed capacity; two tabs count once; stale leave cannot remove a new assignment; crash cleanup <=120 seconds under healthy infrastructure. Rollback: disable entry; keep maintenance active.

### P5 — Roles, governance, and sharing UI

Render actual roles and capabilities. Add people actions, role assignment/revocation, ownership transfer acceptance, close/reopen/archive controls, and management audit. Share clean canonical links and reuse cohort enrollment/invitations. Test role changes while another tab has settings open. Persist initial shared configuration through the existing environment service; never claim realtime synchronization yet.

Acceptance: owner promotes a host; host can perform only allowed actions; revocation immediately blocks subsequent server mutations; ownership survives disconnect; ineligible cohorts cannot be bypassed. Rollback: freeze management UI while preserving authority checks.

### P6 — Integrated prerequisite release gate

Run real PostgreSQL/API/browser tests; verify migration and rollback rehearsal; remove production mock imports and no-op successes across the exposed room-management flow. Confirm public caches contain no private participant data. Verify existing subscription paths cannot bypass authorization. Record which original integration phases are satisfied and which remain.

Acceptance: all gate items below pass. This is permission to begin the later integration work, not a claim that synchronized chat/timers/media are finished.

## 10. Parallel implementation assignments

After P0, use non-overlapping ownership:

- Agent A: Prisma/SQL, transactions, lifecycle and ownership invariants. Sole migration owner.
- Agent B: discovery, create/manage forms, cards, route presentation; uses agreed DTOs.
- Agent C: authorization and negative/integration tests; reviews every API capability check.
- Integrator: shared contracts, existing room-stage wiring, source merge, real browser acceptance, and phase gates.

P1 precedes production writes. Agent B may build forms against typed test fixtures while backend work proceeds, but fixtures must stay in tests and no production fallback mock is allowed. P4 starts only after join/assignment contracts stabilize. Agents do not edit the same schema or RoomScreen concurrently. Completion of an agent task is not a substitute for integrated acceptance.

## 11. Tests and measurable acceptance

| Case | Expected evidence |
|---|---|
| Create and reload | A new room ID/slug exists in PostgreSQL and opens outside the creator's browser |
| Duplicate create | Repeated requestId produces one room/channel/stream/environment |
| Arbitrary slug | A new name outside the original three works; title rename preserves URL |
| Discovery isolation | Search, totals, cursors, direct URLs, and cache do not reveal private cohort rooms |
| Enrollment | Public cohort enrollment enables its rooms without a second chat join policy |
| Direct entry | GET/prefetch creates no participation; Join creates a real lease |
| Capacity race | Two users compete for the last slot; one succeeds, the other receives room-full |
| Failed switch | Full/closed target leaves previous membership intact |
| Multi-tab | Same user in two tabs occupies one slot; closing one does not evict the other |
| Stale operation | Old renew/leave cannot resurrect or delete newer assignment |
| Role boundaries | Host cannot promote, ban, archive, or transfer; forged role fields fail |
| Revocation | Demoted host's next mutation fails; private socket access is revoked where enabled |
| Transfer | Only named eligible recipient can accept once; old owner loses owner authority |
| Ownership persistence | Owner disconnect does not promote another user or delete room |
| Cohort removal | Local host/moderator row does not preserve access after enrollment removal |
| Close/archive | New joins stop, leases invalidate, content survives, reopen does not revive old leases |
| No fake features | Empty room has no peers/messages/queue; unavailable actions do not announce success |
| Schema integrity | Fresh database and a migrated existing database both support the same contracts |

Use existing Vitest patterns plus real PostgreSQL tests for transactions/constraints. Mocked Prisma tests cannot prove locking or capacity correctness. Add multi-context browser tests for the actual routes. Run later: `npx prisma validate`, targeted `npx vitest run`, `npx tsc --noEmit --incremental false`, scoped ESLint, and the repository's established build command. Record pre-existing failures separately. Browser test setup and exact command must be documented if newly added. No verification commands were run as part of writing this plan.

## 12. Handoff to the preserved integration plan

| Earlier integration phase | Treatment after prerequisites |
|---|---|
| 1 Baseline | Recheck only facts changed since P0; retain evidence |
| 2 Stable identity/catalog | Verify completed P1–P3 behavior; do not create another catalog or migration |
| 3 Authorization/bootstrap | Reuse and extend P1/P4 policy for richer snapshots and subscriptions |
| 4 Leases/cleanup | Verify P4 invariants; add any remaining realtime event/recovery behavior |
| 5 Room-screen connection | Reuse P4 orchestration and extend to chat/focus/environment subscriptions |
| 6 Events/recovery | Implement remaining Centrifugo subscriptions, cursor recovery, and failure behavior |
| 7 Persistent room chat | Implement fully with the established room/cohort policy |
| 8 Personal focus | Implement durable timer/history behavior |
| 9 Shared sprint/environment | Reuse role/settings contracts; add real synchronized experience |
| 10 Goals/tasks/activity | Implement real persistence and privacy projections |
| 11–13 Hardening/load/rollout | Re-run against complete integrated system; prerequisite tests alone do not satisfy them |

No duplicated room service, role registry, membership authority, or parallel client provider may be introduced during handoff. The earlier document remains verbatim; this table controls sequencing and overlap.

## 13. Gate before starting remaining integration phases

- [ ] Create, save draft, publish, edit, close, reopen, and archive operate on actual records.
- [ ] New arbitrary rooms open by stable URL; demo slugs are no longer the only valid rooms.
- [ ] Discovery/search/filter/pagination obey scope and enrollment policy.
- [ ] Ownership and delegated roles are real, persisted, and server-enforced.
- [ ] Role changes and ownership transfer work across separate accounts.
- [ ] Join/switch/leave/renew/capacity/cleanup work under concurrency.
- [ ] Existing room-related read/write/subscription endpoints cannot bypass the new policy.
- [ ] No fake people, counts, chat, media queues, owner labels, or success toasts are exposed as functionality.
- [ ] Current room redesign and unrelated user edits are preserved.
- [ ] Schema drift is resolved through safe additive/backfill migrations.
- [ ] Real multi-user browser and database tests pass with evidence.
- [ ] Completed prerequisite work is mapped to the original phases without duplicate implementation.

Deferred from this prerequisite: persistent chat UI, shared focus synchronization, task/goal cloud sync, custom media uploads, realtime reliability/load rollout, standalone private invitation-based rooms, voice/video, scheduled/recurring room events, and advanced recommendations. Those features must be implemented in their assigned subsequent scope before being presented as functional.
