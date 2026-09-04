# SideQuestHQ — Comprehensive Technical Architecture Document

> **Platform:** SideQuestHQ  
> **Version:** 2.0.0 (Production Architecture Specification)  
> **Tech Stack:** Next.js 15 (App Router, Server Components), TypeScript, PostgreSQL (Prisma ORM), MongoDB Atlas, NextAuth v5 (Database Sessions), Google Gemini AI, Capacitor Native Shell, Vanilla CSS Modules.

---

## 1. Executive System Overview

**SideQuestHQ** is a cohort-based microlearning platform engineered to deconstruct long-form, unstructured educational media (YouTube playlists, video courses, GitHub repositories, Notion docs) into bite-sized, interactive, high-retention feeds.

The system is architected around three foundational engineering pillars:
1. **Zero-Distraction Microlearning Surface (`/play`)**: A high-performance, swipe-driven vertical feed utilizing isolated media buffers (stripping all native video hosting UI/recommendations) synchronized with millisecond-accurate user progress telemetry.
2. **Pedagogical Vector Space & Adaptive Feed Engine**: A continuous 12-dimensional cognitive embedding model that ranks, gates, and anti-fatigue-interleaves educational atoms based on cognitive load, chronobiological rhythms, and prerequisite knowledge DAGs.
3. **Dual-Database Atomic Publishing Pipeline**: Relational integrity and low TTFB via PostgreSQL (`Cohort` $\rightarrow$ `Season` $\rightarrow$ `Lesson`), coupled with high-dimensional vector search and transcript indices in MongoDB Atlas.

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                             INGESTION & CURATION LAYER                           │
│  [YouTube API / Corsair]    [GitHub Repos]    [Notion Workspaces]    [Web Docs]   │
└────────────────────────┬──────────────────────────────┬──────────────────────────┘
                         │                              │
                         ▼                              ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                     AI CHUNKING & 12D VECTOR SCORING PIPELINE                    │
│    • Semantic Boundary Detection       • Gemini 3.6 Flash 12D Evaluator          │
│    • Prerequisite DAG Topo-Sort       • Heuristic Fallback Engine (Zero-Key)     │
└────────────────────────┬──────────────────────────────┬──────────────────────────┘
                         │ (Atomic Transaction)         │
                         ▼                              ▼
┌────────────────────────────────────────┐ ┌───────────────────────────────────────┐
│        RELATIONAL DATA TIER            │ │          VECTOR & TRANSCRIPT TIER     │
│          PostgreSQL / Prisma           │ │               MongoDB Atlas           │
│  • Cohorts, Seasons, Lessons           │ │  • 12D Embeddings & Vector Indices    │
│  • NextAuth Sessions & Users           │ │  • Transcript Full-Text Search        │
│  • Join Tables (StudyRoom Participants)│ │  • Atomic Rollback Integrity Guard    │
└───────────────────┬────────────────────┘ └───────────────────┬───────────────────┘
                    │                                          │
                    └───────────────────┬──────────────────────┘
                                        ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                   ADAPTIVE FEED ENGINE & DEFENSIVE MAPPER                        │
│    • Target Vector Formula (Base + User Offset + Circadian Shift)                │
│    • Cosine Similarity (70% Parent Context / 30% Atom Vector)                    │
│    • Anti-Fatigue Interleaving & Frontier-Gating: k* = min{i | !completed(c_i)}  │
│    • cohortMapper.ts (Zod Sanitization & Fallback Scaffolding)                  │
└────────────────────────┬──────────────────────────────┬──────────────────────────┘
                         │                              │
                         ▼                              ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                   CLIENT DELIVERY & RUNTIME ENVIRONMENT                          │
│  [Next.js 15 Server Components]    [Client Media Engine]    [Capacitor Native]   │
│  • Zero-JS Server Rendering       • IFrame UI Eradication  • Haptics & Audio    │
│  • Dynamic SEO / OG Generators    • Swipe Gesture Engine   • Safe Area Insets   │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Ingestion & AI Processing Pipeline

The ingestion pipeline converts monolithic media (e.g., a 2.5-hour programming tutorial) into an interactive microlearning curriculum.

### 2.1 Multi-Source Ingestion Pipeline
* **YouTube Ingestion (`src/server/imports/youtube/`)**: Uses the YouTube Data API v3 and transcript scraping services to extract titles, video durations, captions, and segment markers.
* **Repository & Document Ingestion (`src/server/imports/github/`, `src/server/imports/notion/`)**: Orchestrated via **Corsair** plugins to traverse file trees, parse Markdown ASTs, compute word densities, and preserve hierarchical directory context.
* **NDJSON Progress Telemetry**: Ingestion APIs stream Server-Sent Events (NDJSON) back to the creator wizard across 4 distinct phases:
  $$\text{Payload} \longrightarrow \texttt{\{"stage":"extracting"\}} \longrightarrow \texttt{\{"stage":"parsing"\}} \longrightarrow \texttt{\{"stage":"vectorizing"\}} \longrightarrow \texttt{\{"stage":"completed"\}}$$

### 2.2 Pedagogical 12-Dimensional Vector Model
Every chunk is scored across a 12-dimensional continuous coordinate space ($\mathbb{R}^{12}, [0.0, 1.0]$) by `VectorScoringService` (`src/server/domain/cohort/vectorScoring.service.ts`):

```
1. cognitive_load              (0.0 = Light/Breezy        ──> 1.0 = Dense working memory/Heavy math)
2. practicality_actionability   (0.0 = Pure theory         ──> 1.0 = Direct code/CLI/Hands-on project)
3. visual_dependence           (0.0 = Audio/Podcast       ──> 1.0 = Screen-critical/IDE/Diagrams)
4. scaffolding_guidance        (0.0 = Open sandbox        ──> 1.0 = Step-by-step guided blueprint)
5. linearity_dependency        (0.0 = Standalone atom     ──> 1.0 = Strict sequential prerequisite)
6. novelty_divergence          (0.0 = Common baseline     ──> 1.0 = Esoteric/Uncharted/Serendipity)
7. abstraction_depth           (0.0 = Concrete syntax     ──> 1.0 = Meta-frameworks/Philosophy)
8. pacing_density              (0.0 = Spacious/Deliberate ──> 1.0 = Rapid-fire information density)
9. rigor_formality             (0.0 = Conversational      ──> 1.0 = Mathematical proofs/Spec)
10. interactivity_agency       (0.0 = Passive lecture     ──> 1.0 = Active exercise/Challenge)
11. breadth_scope              (0.0 = Micro single-topic  ──> 1.0 = Broad cross-domain synthesis)
12. emotional_energy           (0.0 = Calming/Meditative  ──> 1.0 = High-energy spark/Urgent)
```

### 2.3 Resilient AI Execution with Heuristic Fallback
When Gemini API tokens are exhausted or in disconnected/offline environments, the pipeline transitions to a deterministic NLP heuristic scoring engine:
* Evaluates regex token density (code keywords `const`, `function`, `import`, `def` vs. formal mathematical terms `theorem`, `matrix`, `proof`).
* Computes pacing via speech-rate words-per-minute:
  $$\text{Pacing} = \text{clamp}\left(0.2, 1.0, \frac{\text{WordCount}}{\frac{\text{Duration}_{\text{sec}}}{60} \times 150}\right)$$
* Generates an immediate $0.60$ confidence score without failing the creator's publishing flow.

---

## 3. Data Tier & Relational Integrity

### 3.1 PostgreSQL + Prisma Relational Model
The relational core guarantees strict hierarchical integrity and instant query execution without loading oversized nested JSON payloads into memory.

```
┌───────────────────────────┐
│           User            │
│  id, email, role, bio...  │
└─────────────┬─────────────┘
              │ 1:N
              ▼
┌───────────────────────────┐       1:N       ┌───────────────────────────┐
│          Cohort           │ ───────────────>│       CohortSource        │
│  id, title, difficulty... │                 │  type, url, chunking...   │
└─────────────┬─────────────┘                 └───────────────────────────┘
              │ 1:N
              ▼
┌───────────────────────────┐       1:1       ┌───────────────────────────┐
│          Season           │                 │         Community         │
│   id, title, order...     │                 │   chatEnabled, events...  │
└─────────────┬─────────────┘                 └─────────────┬─────────────┘
              │ 1:N                                         │ 1:N
              ▼                                             ▼
┌───────────────────────────┐                         ┌───────────────────────────┐
│          Lesson           │                         │          Channel          │
│ id, videoId, chunks(JSON) │                         │  id, name, communityId... │
└─────────────┬─────────────┘                         └─────────────┬─────────────┘
              │ 1:N                                                 │ 1:N
              ▼                                                     ▼
┌───────────────────────────┐                         ┌───────────────────────────┐
│      LessonProgress       │                         │          Message          │
│   status, userId, lId...  │                         │  id, content, authorId... │
└───────────────────────────┘                         └───────────────────────────┘
```

#### Key Schema Enforcements (`prisma/schema.prisma`):
* **Strict Foreign Cascades**: Deleting a `Cohort` cascades through `Season`, `Lesson`, `CohortMember`, `CohortSource`, and `Community`, preventing orphaned data.
* **Compound Primary Keys**: `LessonProgress` uses `@@id([userId, lessonId])` and `CohortMember` uses `@@id([cohortId, userId])` to eliminate duplicate enrollments or fragmented progress records.
* **Targeted Partition Queries**: Allows fetching `Season 1` (e.g. 5 lessons) with sub-10ms response times without hydrating a 500-lesson entire cohort tree.

### 3.2 Dual-Database Atomic Publishing & Rollback
To balance relational safety with high-dimensional vector capabilities:
* **PostgreSQL**: Stores relational structures (`Cohorts`, `Seasons`, `Lessons`, `Users`, `Rooms`).
* **MongoDB Atlas**: Stores high-dimensional vector embeddings (`Chunk.ts`), video transcripts (`CohortTranscript.ts`), and fast non-blocking progress telemetry (`UserChunkProgress.ts`).

#### The Atomic Rollback Protocol:
During `POST /api/cohort/publish`:
1. PostgreSQL opens a Prisma transaction, creating the draft hierarchy.
2. The server attempts to commit the vector embeddings and transcript indices to MongoDB.
3. If MongoDB write operations timeout or fail (e.g., serverless connection pooling latency), an aggressive rollback triggers:
   $$\text{Postgres Transaction Aborts} \longrightarrow \text{Draft Cohort Deleted} \longrightarrow \text{HTTP 500 Returned}$$
4. Only fully synchronized, vector-complete cohorts transition to `isPublished: true`.

---

## 4. Recommender Engine & Mathematical Model

The `/play` route operates on an adaptive feed algorithm that balances user mastery with cognitive sustainability.

```
       User Intent Vectors          Circadian Rhythm Sensor
                │                              │
                ▼                              ▼
      ┌──────────────────────────────────────────────────┐
      │     Target Vector Calculation (V_target)        │
      │  V_target = V_base + (Δ_user × W_max) + Δ_time   │
      └────────────────────────┬─────────────────────────┘
                               │
                               ▼
      ┌──────────────────────────────────────────────────┐
      │          Cosine Similarity Scoring               │
      │     Relevance = (V_final · V_target) / norms     │
      └────────────────────────┬─────────────────────────┘
                               │
                               ▼
      ┌──────────────────────────────────────────────────┐
      │           Anti-Fatigue Post-Processing           │
      │    If C_fatigue > Limit: Penalize Heavy Chunks   │
      └────────────────────────┬─────────────────────────┘
                               │
                               ▼
      ┌──────────────────────────────────────────────────┐
      │        Frontier-Gated Microlearning Stream       │
      │   k* = min { i | status(chunk_i) != COMPLETED }  │
      └──────────────────────────────────────────────────┘
```

### 4.1 Target Vector Calculation
The ideal target vector $V_{\text{target}}$ is dynamically synthesized:
$$V_{\text{target}} = \text{clamp}\Big(0.0, 1.0, \; V_{\text{base}} + (\Delta_{\text{user}} \times W_{\text{max}}) + \Delta_{\text{time}}\Big)$$
* $V_{\text{base}}$: Baseline vector of the active Channel (e.g., *Spark* favors high novelty, low density).
* $\Delta_{\text{user}}$: User preference modifier bounded by $W_{\text{max}} = 0.25$ to prevent filter bubble collapse.
* $\Delta_{\text{time}}$: Circadian vector adjusting cognitive load down during late-night hours.

### 4.2 Cosine Similarity with Parent Context Blending
To prevent contextual drift when isolating a single 2-minute snippet from a 1-hour lecture:
$$V_{\text{final}} = (V_{\text{lesson}} \times 0.30) + (V_{\text{chunk}} \times 0.70)$$
$$\text{Similarity}(V_{\text{final}}, V_{\text{target}}) = \frac{V_{\text{final}} \cdot V_{\text{target}}}{\|V_{\text{final}}\| \times \|V_{\text{target}}\|}$$

### 4.3 Anti-Fatigue Interleaving & Gating
1. **Progression Frontier Gating**: Enforces linear continuity for strict prerequisites:
   $$k^* = \min \{ i \mid \text{status}(c_i) \neq \text{COMPLETED} \}$$
   Chunks $c_j$ where $j > k^*$ are filtered out until $c_{k^*}$ is mastered.
2. **Anti-Fatigue Penalty**: Moving average of cognitive load ($C_{\text{fatigue}}$) tracks mental strain. When $C_{\text{fatigue}} > \theta_{\text{threshold}}$, high-density chunks receive an exponential score penalty:
   $$\text{Final Score} = \text{Similarity Score} - P_{\text{penalty}} \quad \forall \; V_{\text{density}} > 0.70$$
   This automatically interleaves "palate-cleanser" chunks (intuition building, visual recaps).

### 4.4 Telemetry & Outro-Aware Auto-Completion
$$\text{Mark Completed} \iff T_{\text{remaining}} \leq \min(15, \; T_{\text{total}} \times 0.15)$$
This formula grants full completion credit when users stop at outro cards, while mathematically preventing skipping exploits on short 30-second clips.

---

## 5. Security & Authentication Architecture

SideQuestHQ enforces zero-trust, server-side verified sessions via **NextAuth v5 (Auth.js)**:

```
┌────────────────┐      HTTPS Bearer Cookie      ┌─────────────────────────┐
│ Browser Client │ ────────────────────────────> │  Next.js Server (RSC)   │
└────────────────┘                               └────────────┬────────────┘
                                                              │
                                                              ▼
                                                 ┌─────────────────────────┐
                                                 │ requireUser() Wrapper   │
                                                 └────────────┬────────────┘
                                                              │ Session Token Lookup
                                                              ▼
                                                 ┌─────────────────────────┐
                                                 │   PostgreSQL Session    │
                                                 │  (sessions join users)  │
                                                 └─────────────────────────┘
```

* **Database-Backed Sessions**: Rather than insecure, stateless client JWTs that cannot be revoked, session tokens are persisted in PostgreSQL via `@auth/prisma-adapter`.
* **Instant Revocation (`requireUser.ts`)**: Server Components and API routes validate incoming cookies directly against active database sessions. Revoked or banned accounts are severed immediately on the next server render.
* **Role-Based Access Control (RBAC)**: Enforced via `UserRole` (`EXPLORER`, `CREATOR`, `ADMIN`). Creator endpoints (`/api/cohort/publish`, `/api/curriculum/generate`) strictly require `role >= CREATOR`.

---

## 6. Global Real-Time Collaboration & Concurrency

### 6.1 Concurrency-Safe Study Rooms
SideQuestHQ provides drop-in virtual focus rooms with database-level concurrency guarantees (`src/server/database/` & `prisma/schema.prisma`):

```prisma
model RoomParticipant {
  id          String    @id @default(cuid())
  userId      String    @unique
  studyRoomId String
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  room        StudyRoom @relation(fields: [studyRoomId], references: [id], onDelete: Cascade)
  joinedAt    DateTime  @default(now())

  @@index([studyRoomId])
  @@map("room_participants")
}
```

* **Database Unique Constraint**: `@unique` on `userId` in `RoomParticipant` guarantees at the database level that a user can exist in **at most one room across the entire platform**.
* **Zero Race Conditions**: If a user double-clicks "Join Room" across split browser windows, PostgreSQL rejects the second transaction with a unique key violation (`P2002`), maintaining synchronized state.

---

## 7. Defensive UI Mapping & Data Integrity

To prevent runtime errors, layout shifts, or null reference crashes from malformed external data or AI generation artifacts:

```
┌────────────────────────┐      Raw DB Return      ┌─────────────────────────┐
│   PostgreSQL / Mongo   │ ──────────────────────> │    cohortMapper.ts      │
└────────────────────────┘                         └────────────┬────────────┘
                                                                │
                                    ┌───────────────────────────┴───────────────────────────┐
                                    ▼                                                       ▼
                       [Defensive Sanity Defaults]                             [Data Shape Transformation]
                       • Recalculate 5-min micro-chunks                        • Map DB Enums to UI States
                       • Fallback avatar assets                                • Format timestamp strings
                       • Default learning outcomes                             • Calculate total quests/hours
                                    │                                                       │
                                    └───────────────────────────┬───────────────────────────┘
                                                                ▼
                                                   ┌─────────────────────────┐
                                                   │  Pixel-Perfect React UI │
                                                   │ (Zero Layout Shift/CLS) │
                                                   └─────────────────────────┘
```

* **`cohortMapper.ts`**: Sanitizes every raw database object before exposing it to client components.
* **Algorithmic Fallbacks**: If legacy cohorts lack granular semantic chunks, the mapper dynamically generates 5-minute virtual micro-chunks on the fly.
* **Deterministic Transformation**: Converts string-based duration markers (`"12:45"`) into integer second values (`765`) using Zod schemas, ensuring time math remains mathematically consistent across all client calculations.

---

## 8. Client Delivery & Native Mobile Shell

### 8.1 Next.js 15 App Router Partitioning
* **React Server Components (RSC)**: Renders static cohort metadata, exploration directories, and SEO markup on the server. Keeps JavaScript bundle sizes under 80kB first-load JS.
* **Interactive Client Islands**: Media player decoders, vertical gesture engines, and the Multi-Step Ingestion Form run in isolated client components (`'use client'`).
* **Dynamic OpenGraph & Edge SEO**: Routes like `/cohort/[id]/overview` bypass auth middleware, executing dynamic `generateMetadata` to build rich Twitter/OpenGraph previews for unauthenticated social sharing.

### 8.2 Capacitor Native Bridge
The platform operates simultaneously as a progressive web application and a native mobile application (iOS/Android):
* **`CapacitorBridge.tsx`**: Detects native platform runtime and injects native hardware integrations (Haptics, StatusBar control, native video buffer optimization).
* **Safe Area Architecture**: Native notch and home bar insets (`env(safe-area-inset-top)`) are mapped to CSS custom properties (`--sat`, `--sab`), guaranteeing edge-to-edge immersion in the `/play` feed.

---

## 9. Architectural Verification & Quality Matrix

| Architectural Subsystem | Target SLA / Metric | Validation Mechanism |
| :--- | :--- | :--- |
| **Relational Query Latency** | $< 15\text{ms}$ TTFB | Prisma index optimization & targeted partition selection |
| **Media Player Feed Switch** | $< 100\text{ms}$ buffer latency | IFrame background pre-buffering + scroll debouncing |
| **Study Room Concurrency** | Zero duplicate participants | PostgreSQL `@unique([userId])` constraint validation |
| **Dual DB Consistency** | 100% vector-synchronized cohorts | Atomic rollback transaction wrapper during publish |
| **First Load JS Bundle** | $< 85\text{kB}$ gzipped | Strict Server Component / Client Boundary isolation |
| **Defensive Null Safety** | 0% unhandled null crashes | `cohortMapper.ts` fallback perimeter + Zod validation |


