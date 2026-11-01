# Repository Planning & Architectural Artifacts

This directory is the canonical location for all implementation plans, design proposals, handoff guides, and quality assessment documents across the repository.

> **CRITICAL AGENT INSTRUCTION**:
> **NEVER create loose markdown files (`*plan*.md`, `*guide*.md`, `*assessment*.md`) in the repository root.**
> All planning documents must be authored directly inside the appropriate genre subfolder below.

---

## Directory Organization by Task Genre

```
plans/
├── cohort-builder/             # Cohort creation, curriculum planning, studio stages, text pipeline, intake
├── composer/                   # Composer chat, prompt engineering, streaming turns, assistant activity
├── feed-and-home/              # Feed engine, personal feeds, channel preferences, explore, home dashboard
├── studyroom/                  # Ambient audio engine, study rooms, Web Audio, multi-presence, messaging
├── notes-sync/                 # Local-first notes engine, GitHub sync, conflict resolution, offline storage
└── architecture-and-refactor/  # Cross-cutting proposals, meta-issue fixes, latency audits, quality assessments
```

### 1. `cohort-builder/`
- **Scope**: Cohort builder studio, source attachment (PDF, web, YouTube, GitHub, text), processing pipeline, chunking, analysis, assembly, readiness checks, release states.
- **Includes**: Feature plans, intake handoff guides, state machine proposals, and manager status ledgers for the cohort creation subsystem.

### 2. `composer/`
- **Scope**: Composer chat pane, streaming assistant interactions, tool execution, client device extraction, prompt chaining, chat draft persistence.
- **Includes**: Implementation plans, execution guides, and prompt architecture documents for the composer.

### 3. `feed-and-home/`
- **Scope**: Dynamic personal feeds, channel scoring and decay, recommendation engine, home dashboard, cache boundaries, explore page.
- **Includes**: Feed algorithm plans, home page refactor guides, and channel preference architecture.

### 4. `studyroom/`
- **Scope**: Virtual study rooms, procedural Web Audio ambient engine, sound layers, multi-user presence, room slug lifecycle.
- **Includes**: Audio engine specifications, room state machines, and real-time collaboration guides.

### 5. `notes-sync/`
- **Scope**: Local-first notes, IndexedDB storage engine, GitHub sync, conflict resolution (E1–E6 contracts), reconnect lifecycles.
- **Includes**: Sync architecture plans, storage migration guides, and offline-first protocols.

### 6. `architecture-and-refactor/`
- **Scope**: Cross-cutting system refactors, meta-issue resolutions, response latency optimizations, whole-repository audits, and QA handoff guides.
- **Includes**: `IdiotCheckInQualityAssessment.md`, meta-issue execution plans, performance remediation plans, and repository-level audits.
