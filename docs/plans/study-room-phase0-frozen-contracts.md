# Study Room Product Foundation — Phase 0: Inventory & Contract Freeze

**Status:** Completed  
**Authoritative Plan Reference:** `ai-context/Study-room product foundation prerequisite plan.md` (P0)  
**Contract Implementation Module:** `src/shared/studyroom/contracts.ts`  
**Date:** 2026-10-21  

---

## 1. Verified Inventory & Baseline Findings

### 1.1 Working Tree & Redesign Preservation
- **Preserved UI:** The full-screen reference redesign under `src/client/screens/dashboard/studyroom/` (focus timer bar, floating glass panels, scene dock, ambient synthesizer, session goals/tasks) is active and retained intact.
- **Detached Legacy API:** `/api/studyroom` GET & POST remain in place but are detached from dynamic route `/studyroom/[roomSlug]` and catalog screens.
- **Static Union Constraint:** `RoomSlug` in `src/client/screens/dashboard/studyroom/types.ts` is currently hardcoded to `'library' | 'fireplace' | 'developer-den'`. This must be replaced with dynamic slug validation while preserving the visual preset definitions.
- **Client Role Assumption:** `ViewerRole` is limited to `'admin' | 'member'`. In the prototype, `adminUserId === 'viewer'` and the `?viewAs=admin` query parameter allow client-side role override. In production, roles and capabilities must be server-computed from database state.

### 1.2 Domain Service Audits
- **Sprint Controller Fallback:** `src/server/domain/studyroom/sprint.service.ts` (lines 75–80) contains a fallback where, if a room has zero controllers, any participant is treated as a controller. This fallback is frozen for removal in P1/P2.
- **Environment Service:** `src/server/domain/studyroom/environment.service.ts` lazily creates default environment records upon GET requests. In P1/P2, environment provisioning occurs atomically upon room creation.
- **Lease Reconciliation:** `studyRoomService.reconcileExpiredLeases` exists in `studyroom.service.ts` but lacks scheduled execution in the worker loop.

---

## 2. Schema Drift & Migration Strategy

### 2.1 Database Architecture & Runner
- **Migration Mechanism:** Additive SQL migration scripts under `prisma/*.sql` accompanied by updated `prisma/schema.prisma` declarations and `prisma generate`. The project does not use `prisma/migrations`.
- **Database Client:** PostgreSQL connection pool with `@prisma/adapter-pg`.

### 2.2 Schema Drift Matrix (Current vs. P1 Target)

| Entity / Column | Current State | P1 Target State | Type & Constraints |
|---|---|---|---|
| `study_rooms.slug` | Missing (computed in JS) | **Required** | `TEXT UNIQUE NOT NULL` |
| `study_rooms.description` | Missing | **Added** | `TEXT NULL` |
| `study_rooms.owner_id` | Missing | **Required** | `TEXT NOT NULL REFERENCES users(id)` |
| `study_rooms.cohort_id` | Missing | **Added** | `TEXT NULL REFERENCES cohorts(id) ON DELETE SET NULL` |
| `study_rooms.listing` | Missing | **Required** | `TEXT NOT NULL DEFAULT 'LISTED'` (`LISTED` \| `UNLISTED`) |
| `study_rooms.status` | Plain string (`ACTIVE`) | **Normalized** | `TEXT NOT NULL DEFAULT 'OPEN'` (`DRAFT` \| `OPEN` \| `CLOSED` \| `ARCHIVED`) |
| `study_rooms.capacity` | Missing | **Required** | `INTEGER NOT NULL DEFAULT 25` (2–100) |
| `study_rooms.rules` | Missing | **Added** | `TEXT NULL` |
| `study_rooms.tags` | Missing | **Added** | `TEXT[] NOT NULL DEFAULT '{}'` |
| `study_rooms.language` | Missing | **Added** | `TEXT NOT NULL DEFAULT 'en'` |
| `study_rooms.visual_preset_id` | Missing | **Added** | `TEXT NULL` |
| `study_rooms.revision` | Missing | **Required** | `INTEGER NOT NULL DEFAULT 1` |
| `study_rooms.published_at` | Missing | **Added** | `TIMESTAMP(3) NULL` |
| `study_rooms.closed_at` | Missing | **Added** | `TIMESTAMP(3) NULL` |
| `study_rooms.archived_at` | Missing | **Added** | `TIMESTAMP(3) NULL` |
| `room_controllers.assigned_by_user_id`| Missing | **Added** | `TEXT NULL REFERENCES users(id)` |
| `room_controllers.updated_at` | Missing | **Added** | `TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `room_restrictions` table | Missing | **New Table** | `(id, study_room_id, user_id, action, reason, issued_by_user_id, expires_at, created_at, updated_at)` |
| `room_ownership_transfers` table | Missing | **New Table** | `(id, study_room_id, sender_id, recipient_id, status, expected_revision, expires_at, created_at, updated_at)` |
| `room_audit_logs` table | Missing | **New Table** | `(id, study_room_id, actor_id, action, target_user_id, client_request_id, details, created_at)` |

### 2.3 Legacy Data Reconcile & Backfill Strategy
1. **Room Slugs:** Generate unique slugs from existing room titles (`library`, `fireplace`, `developer-den`).
2. **Room Ownership:** Assign legacy rooms without designated owners to a designated platform/governance user, or mark them `CLOSED` pending administrative claim. Demo users (`demo-mira`, `demo-kai`, `viewer`) are strictly banned from database backfill.
3. **Room Status Normalization:** Map historical `'ACTIVE'` rows to `'OPEN'`.
4. **Room Controllers:** Any existing `RoomController` row with role `'OWNER'` is reconciled directly into `study_rooms.owner_id`; `RoomController.role` values are constrained to `'MODERATOR' | 'HOST'`.

---

## 3. Authoritative Governance & Role Hierarchy

```
                    ┌─────────────────────────┐
                    │      Platform ADMIN     │ (Audited emergency override)
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │ Cohort CREATOR/MODERATOR│ (For cohort-scoped rooms only)
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │        Room OWNER       │ (study_rooms.owner_id - Single Durable Authority)
                    └──────┬───────────┬──────┘
                           │           │
            ┌──────────────▼─────┐   ┌─▼──────────────────┐
            │   Room MODERATOR   │   │      Room HOST     │
            │ (Controllers table)│   │ (Controllers table)│
            └──────────────┬─────┘   └─┬──────────────────┘
                           │           │
                    ┌──────▼───────────▼──────┐
                    │     Room PARTICIPANT    │ (Active non-expired room_leases)
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │       Room VIEWER       │ (Safe metadata preview / unjoined)
                    └─────────────────────────┘
```

### 3.1 Single Authority Rule
- A study room has exactly **one** owner: `StudyRoom.ownerId`.
- Ownership is not held in `RoomController`.
- Role assignment in `RoomController` does not grant admission: all users (including moderators/hosts) must satisfy the room scope and cohort enrollment requirements.
- Owner disconnect does not promote other users or close the room.

### 3.2 Capability Matrix

| Capability | Owner | Moderator | Host | Participant | Viewer |
|---|---|---|---|---|---|
| View preview / metadata | Yes | Yes | Yes | Yes | Yes |
| Join room (acquire lease) | Yes (if OPEN) | Yes (if OPEN) | Yes (if OPEN) | Yes (if OPEN) | No |
| Personal tools (Pomodoro, tasks, personal goal) | Own only | Own only | Own only | Own only | Own only |
| Mutate shared environment (scene, music, sound) | Yes* | Yes* | Yes* | No | No |
| Control shared room sprint | Yes* | Yes* | Yes* | No | No |
| Edit room metadata, listing, capacity, rules | Yes | No | No | No | No |
| Assign / revoke MODERATOR & HOST | Yes | No | No | No | No |
| Remove ordinary participant (with cooldown) | Yes | Yes | No | No | No |
| Ban / unban ordinary participant | Yes | Yes | No | No | No |
| Initiate / cancel ownership transfer | Yes | No | No | No | No |
| Lifecycle (Publish / Close / Reopen / Archive) | Yes | No | No | No | No |

*\* Requires both the designated role AND an active live participant lease in the room.*

---

## 4. Lifecycle State Transitions

```
[Create Room]
      │
      ├── (publishImmediately = false) ──► [DRAFT] ── (PUBLISH) ──┐
      │                                                           │
      └── (publishImmediately = true)  ──────────────────────────►▼
                                                                [OPEN]
                                                                  │  ▲
                                                       (CLOSE)   │  │ (REOPEN)
                                                                  ▼  │
                                                               [CLOSED]
                                                                  │  ▲
                                                      (ARCHIVE)  │  │ (RESTORE)
                                                                  ▼  │
                                                              [ARCHIVED]
```

- **Optimistic Locking Invariant:** Every lifecycle mutation requires `expectedRevision` matching current `study_rooms.revision`. A mismatch yields `409 ROOM_REVISION_CONFLICT`.
- **Termination on Close:** When a room transitions `OPEN -> CLOSED`, all active leases in `room_leases` for that room are deleted, and `room_participants` rows for that room are removed.
- **Reopen Clean Slate:** Transitioning `CLOSED -> OPEN` increments `revision` and starts with an empty roster. Historical leases are never resurrected.

---

## 5. Scope, Eligibility & Discovery Matrix

| Scope Kind | Listing Policy | Discovery Visibility | Admission & Join Eligibility | Creator Authorization |
|---|---|---|---|---|
| **STANDALONE** | `LISTED` | Authenticated non-guest users in general directory | Authenticated non-guest users up to `capacity` | Authenticated users within daily quota (max 3 OPEN rooms, 10 creations/day) |
| **STANDALONE** | `UNLISTED` | Hidden from general directory; visible to owner & controllers in "My rooms" | Authenticated users via canonical direct URL | Same as above |
| **COHORT** | `LISTED` | Enrolled cohort members in cohort directory; non-members see preview only if cohort is `PUBLIC` | Enrolled cohort members only (non-enrolled receive `ENROLLMENT_REQUIRED`) | Cohort creator or cohort `CREATOR` / `MODERATOR` member |
| **COHORT** | `UNLISTED` | Hidden from general directory; visible in cohort management | Enrolled cohort members via canonical direct URL | Same cohort-authorized creators |

---

## 6. Authoritative API Contracts & Error Codes

All types and errors are exported from `src/shared/studyroom/contracts.ts`.

### 6.1 Endpoints
1. `GET /api/studyroom`: Discovery directory with tabs (`discover`, `cohorts`, `my-rooms`, `recent`), filters, search, and keyset cursor pagination.
2. `POST /api/studyroom/rooms`: Idempotent room creation (returns 201 with `id`, `slug`, `revision`).
3. `GET /api/studyroom/[roomSlug]`: Safe preview/bootstrap endpoint returning room metadata, user presence, and server-computed capabilities.
4. `PATCH /api/studyroom/[roomSlug]`: Settings update with `expectedRevision`.
5. `POST /api/studyroom/[roomSlug]/lifecycle`: Transitions room state with `expectedRevision`.
6. `POST /api/studyroom`: Lease-fenced `join`, `renew`, and `leave` operations with generation checking.
7. `GET /api/studyroom/roster`: Live roster of active users with non-expired leases. `Cache-Control: private, no-store`.
8. `GET/PUT/DELETE /api/studyroom/[roomSlug]/controllers/[userId]`: Read, assign, and revoke delegated `MODERATOR` and `HOST` roles.
9. `POST /api/studyroom/[roomSlug]/participants/[userId]/remove`: Remove user with 2-minute cooldown.
10. `GET/POST/DELETE /api/studyroom/[roomSlug]/restrictions`: Ban and restriction management.
11. `POST /api/studyroom/[roomSlug]/ownership-transfers`: Create recipient-bound transfer proposal.
12. `POST /api/studyroom/[roomSlug]/ownership-transfers/[id]/accept`: Recipient accepts transfer.
13. `DELETE /api/studyroom/[roomSlug]/ownership-transfers/[id]`: Cancel transfer.
14. `GET /api/studyroom/[roomSlug]/audit`: Paginated audit log of management actions.

### 6.2 Standard Error Catalog

| Error Code | HTTP Status | Meaning |
|---|---|---|
| `ROOM_NOT_FOUND` | 404 | Room does not exist or unauthorized unlisted query |
| `ROOM_CLOSED` | 409 | Room is currently closed |
| `ROOM_FULL` | 409 | Distinct users with active leases reached room capacity |
| `ENROLLMENT_REQUIRED` | 403 | Cohort membership required to enter cohort-scoped room |
| `USER_BANNED` | 403 | User is actively banned from room |
| `USER_KICKED_COOLDOWN`| 403 | User was recently removed and must wait for cooldown expiry |
| `ROOM_REVISION_CONFLICT`| 409 | `expectedRevision` does not match database revision |
| `ROOM_QUOTA_EXCEEDED` | 429 | Exceeded max open rooms (3) or daily creation limit (10) |
| `ROOM_FORBIDDEN` | 403 | Insufficient permission for requested action |
| `ROOM_UNAUTHORIZED` | 401 | User must authenticate |
| `ROOM_STALE_GENERATION`| 409 | Lease heartbeat rejected due to prior room switch |
| `ROOM_INVALID_INPUT` | 400 | Validation failed on parameters or body |
| `ROOM_SLUG_COLLISION` | 409 | Slug collision could not be resolved |
| `TRANSFER_INVALID` | 400 | Invalid recipient or room transfer state |
| `TRANSFER_EXPIRED` | 409 | Transfer proposal has expired |
| `TARGET_HIERARCHY_VIOLATION` | 403 | Moderator cannot remove owner or another moderator |

---

## 7. File Ownership & System Boundaries

```
src/
├── shared/
│   └── studyroom/
│       └── contracts.ts           <-- Sole authoritative source for DTOs & errors
├── server/
│   └── domain/
│       └── studyroom/
│           ├── studyroom.policy.ts       <-- Central capability & eligibility evaluator
│           ├── studyroom.service.ts      <-- Discovery, creation, settings, lifecycle & leases
│           ├── room-controllers.service.ts <-- Delegation & transfer proposals
│           ├── room-restrictions.service.ts <-- Kicks, cooldowns & bans
│           ├── room-audit.service.ts     <-- Audit logging
│           ├── environment.service.ts    <-- Hardened environment mutations (policy-checked)
│           └── sprint.service.ts         <-- Hardened sprint controls (fallback removed)
├── app/
│   ├── (dashboard)/
│   │   └── studyroom/
│   │       ├── page.tsx                  <-- Query-backed discovery page
│   │       └── [roomSlug]/
│   │           ├── page.tsx              <-- Dynamic room stage (DB-resolved)
│   │           └── manage/page.tsx       <-- Manager settings surface
│   └── api/
│       └── studyroom/                    <-- HTTP route handlers adhering to contracts
└── client/
    └── screens/
        └── dashboard/
            └── studyroom/                <-- UI components consuming frozen contracts
```

---

## 8. Phase 0 Gate Acceptance Verification

- [x] Current source and working tree inspected; ongoing redesign preserved.
- [x] Schema drift identified and additive DDL migration plan documented for P1.
- [x] Scopes, role hierarchy, capability matrix, and lifecycle state transitions recorded.
- [x] Authoritative ownership policy defined: single `StudyRoom.ownerId`, delegation via `RoomController`, no contradictory authority sources.
- [x] Client-safe contracts module implemented at `src/shared/studyroom/contracts.ts`.
- [x] Full error catalog with stable machine-readable codes defined.
- [x] File ownership boundaries established.
- [x] All 39 test files (283 unit tests) pass without regression.
- [x] Rollback scope: documentation and shared contracts only.
