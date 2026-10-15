# S6A Operator Handoff Package & Rollout Preparation

## 1. Executive Summary & S6A Completion Decision

This document is the official Operator Handoff Package for **Slice 6A: Operational Readiness and Rollout Preparation** for the canonical cohort builder (`/quest/build/[workspaceId]` and `packages/interaction-builder`).

### Scope & Decision
- **S6A Status**: **COMPLETE & VERIFIED**. All local implementation, isolated PostgreSQL verification, fail-closed configuration profiles, worker operational resilience, additive migration rehearsals, and rollback mechanisms are fully in place and verified.
- **S6 (Production Operational Gate) Status**: **PENDING OPERATOR EXECUTION**. S6A does NOT activate shared feature flags, apply production database migrations, provision cloud infrastructure, or deploy to production. Those actions require operator authorization following this handoff.

---

## 2. Repository & Artifact Baseline

| Component | Pinned Version / Commit | Notes |
|---|---|---|
| **Host Repository (`master`)** | `f82e89a` (plus handoff commit) | Clean working tree; synchronized with `origin/master` and `origin/planning` |
| **Submodule (`packages/interaction-builder`)** | `bf96b845d707b8a740384f6c818ee222b29bf69c` | Authority for reusable engine; consumed via public exports; clean working tree |
| **Visual Parity Gallery** | 48 matched screenshots | Located in `.tmp/visual-parity-gallery/` |
| **End-to-End Verification** | `s4-enabled-completed.png`, `s5-completed.png` | Located in `.tmp/s4-postgres-runtime/` and `.tmp/s5-postgres-runtime/` |

---

## 3. Capability Inventory & Production Readiness Matrix

All 10 canonical cohort builder capabilities have been audited across 5 explicit readiness levels:
- **Level A**: Code implemented
- **Level B**: Isolated deterministic tests passed
- **Level C**: Live provider tested & verified
- **Level D**: Shared environment configured
- **Level E**: Shared feature activated

| Capability | Readiness Level | Rollout Status | Prerequisites / Blockers |
|---|---|---|---|
| **1. New V2 Landing Intake** | Level B (Local Verified) | Ready for Profile 2 | Requires `INTERACTION_COHORT_V2_ENABLED='1'` and `INTERACTION_TEXT_DRIVER='durable'`. |
| **2. Existing V2 Workspace Resume** | Level B (Local Verified) | Always Active | Works regardless of `INTERACTION_COHORT_V2_ENABLED`; zero lock-out risk. |
| **3. Pasted Text Processing** | Level B (Local Verified) | Ready for Profile 2 | Core durable pipeline; 5-stage DAG execution verified. |
| **4. PDF Upload & Extraction** | Level B (Local Verified) | Ready for Profile 2 | Requires S4B schema constraints; 2MB bound; zero client execution. |
| **5. Web Extraction** | Level B (Local Verified) | Ready for Profile 2 | Requires S4B schema constraints; SSRF protections active; 200KB bound. |
| **6. YouTube Transcripts** | Level B (Fixture Only) | **DISABLED (`'0'`)** | **Hard Blocker**: Google Data API v3 `captions.download` requires video owner OAuth credentials. Public transcripts cannot be acquired without owner auth. Must remain `'0'`. |
| **7. GitHub Source Acquisition** | Level C (Live Verified) | **DISABLED (`'0'`)** | **Hard Blocker**: Unauthenticated GitHub REST API limited to 60 req/hr. Must remain `'0'` until dedicated monitored token configured. |
| **8. Assistant Runner Execution** | Level B (Local Verified) | Ready for Profile 2 | Supervised worker lifecycle; bounded FIFO queue; safe tool proposals. |
| **9. Private Learner Activation** | Level B (Local Verified) | Ready for Profile 2 | Relational cohort/lesson projection; `/play?cohort=...` delivery. |
| **10. Public Cohort Release** | Level B (Local Verified) | Ready for Profile 2 | Public publishing; `/cohort/.../overview` discovery; unpublish protection. |

---

## 4. Minimal Configuration Profiles

Three configuration profiles are formalized in `docs/s6a-configuration-profiles.md`:

### Profile 1: Isolated Local Verification (`isolated_local`)
- For local unit tests, CI test runs, and isolated rehearsal scripts.
- Uses embedded PostgreSQL (`s3test` loopback on port `15433`).
- Uses local deterministic model and provider fixtures (`INTERACTION_LOCAL_MODEL_FIXTURE=1`).

### Profile 2: Recommended Initial Production Rollout (`initial_rollout`)
- Enables canonical v2 text intake, PDF sources, and Web sources.
- YouTube and GitHub remain strictly disabled (`'0'`).
- Strictly enforces durable driver agreement:
```bash
INTERACTION_COHORT_V2_ENABLED=1
INTERACTION_TEXT_DRIVER=durable
INTERACTION_PDF_ENABLED=1
INTERACTION_WEB_ENABLED=1
INTERACTION_YOUTUBE_ENABLED=0
INTERACTION_GITHUB_ENABLED=0
DATABASE_URL="postgresql://user:pass@host:5432/production_db?sslmode=require"
```

### Profile 3: Disabled Capabilities / Rollback Profile (`disabled_intake`)
- Safely pauses new v2 creation while keeping all existing v2 workspaces and learner deliveries readable:
```bash
INTERACTION_COHORT_V2_ENABLED=0
INTERACTION_TEXT_DRIVER=durable
```

---

## 5. Ordered Database Migration Sequence

All 4 migrations are additive and non-destructive. Apply them in this exact order:

```bash
# 1. Core interaction engine tables (8 tables + active unique index)
psql "$DATABASE_URL" -f packages/interaction-builder/migrations/001_interaction_schema.sql

# 2. Durable text pipeline (cohort_text_artifacts, cohort_text_jobs, cohort_text_job_edges)
psql "$DATABASE_URL" -f prisma/interaction-s3-storage.sql

# 3. Source constraints expansion (supports source_input, source_raw, acquisition, extraction)
psql "$DATABASE_URL" -f prisma/interaction-s4b-sources.sql

# 4. Release effect journaling (interaction_effects)
psql "$DATABASE_URL" -f prisma/interaction-s5-effects.sql
```

---

## 6. Operator Diagnostics & Verification Commands

| Command | Purpose | Expected Result |
|---|---|---|
| `npm run interaction:readiness` | Probes environment, database schema, driver agreement, and capability flags. | Reports `status: ready`, profile: `initial_rollout`, exit 0. |
| `npm run interaction:worker:diagnostics` | Read-only operational query for queue backlog, oldest jobs, lease status, and failures. | Reports zero failures, active counts without exposing user content. |
| `npm run interaction:worker:check` | Verifies worker imports and Node server condition without DB side-effects. | Reports clean validation, exit 0. |
| `npm run interaction:rehearse:rollout` | Rehearses all 11 phases of rollout and rollback on isolated disposable PostgreSQL. | `ALL S6A ADDITIVE ROLLOUT & ROLLBACK PHASES PASSED CLEANLY`, exit 0. |
| `npm run verify:vercel` | Full production build simulation (TypeScript, Prisma, distributions, webpack). | `VERIFICATION SUCCESS: Project is ready for Vercel deploy!`, exit 0. |

---

## 7. Safe Rollback / Disable Runbook

If an operational incident occurs or the operator decides to pause v2 cohort creation:

1. **Set Environment Variable**:
   ```bash
   INTERACTION_COHORT_V2_ENABLED=0
   ```
2. **Reload Web Application**:
   - New cohort creators visiting `/` or `/quest/start` see an honest notice on `/quest/start`: *"New builder intake is unavailable. Existing workspaces remain accessible."*
   - Any typed prompt is preserved in browser `sessionStorage` and rendered in a blockquote.
   - For compatible drafts without attached sources, an explicit link `<a href="/quest/new?handoff=1">Continue with existing creator</a>` is presented.
3. **Data Preservation Guarantee**:
   - All existing workspaces in `interaction_workspaces` remain **100% accessible, readable, and resumable** at `/quest/build/[workspaceId]`.
   - All released learner deliveries (`/play?cohort=...` and `/cohort/.../overview`) remain active.
   - **ZERO TABLES DROPPED; ZERO USER RECORDS DELETED**.

---

## 8. Pre-Flight Operator Checklist

Before enabling Profile 2 in a shared or staging environment, verify:
- [ ] Database backup completed before running SQL migrations.
- [ ] Migrations 1 through 4 executed in strict sequential order.
- [ ] `npm run interaction:readiness` returns exit code 0 with `initial_rollout` profile.
- [ ] `INTERACTION_TEXT_DRIVER=durable` is set on both HTTP app and background worker.
- [ ] `INTERACTION_YOUTUBE_ENABLED=0` and `INTERACTION_GITHUB_ENABLED=0` confirmed.
- [ ] Background interaction worker supervisor (`npm run interaction:worker`) started with matching binary version.
- [ ] Operator verified rollback plan (`INTERACTION_COHORT_V2_ENABLED=0`).
