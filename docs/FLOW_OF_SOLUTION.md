# SideQuestHQ — End-to-End Flow of Solution Document

> **Document Type:** System Solution Flow & Operational Architecture  
> **Platform:** SideQuestHQ  
> **Version:** 2.0.0 (Production Specification)  
> **Scope:** End-to-end user journeys, technical sequence diagrams, asynchronous streaming pipelines, state machines, and fail-safe recovery protocols.

---

## 1. Solution Architecture & Paradigm

SideQuestHQ solves the problem of educational friction and tutorial abandonment by deconstructing monolithic media (2–3 hour YouTube videos, long Notion docs, complex GitHub repos) into an interactive microlearning feed.

### The Macro Solution Flow

```
[Raw Long-Form Media]
  (YouTube / GitHub / Notion)
           │
           ▼
[AI Chunking & 12D Vector Scoring]
  (Gemini 3.6 Flash / NLP Heuristics)
           │
           ▼
[Dual-Database Atomic Publishing]
  (Postgres Relational Core + MongoDB Vectors)
           │
           ▼
[Adaptive Microlearning Feed Engine]
  (Target Vectors + Anti-Fatigue + Gating)
           │
           ▼
[Distraction-Free Playback & Telemetry]
  (IFrame Eradication + Outro-Aware Auto-Completion)
           │
           ▼
[Habit Compounding & Social Accountability]
  (Progress Tracking + Study Rooms + Hall of Fame)
```

---

## 2. Primary User Journeys & Operational Workflows

---

### Journey A: The Explorer (Learner) Lifecycle

```mermaid
flowchart TD
    A[Visit Landing Page /] --> B{Authenticated?}
    B -- No --> C[Sign In via NextAuth /auth]
    B -- Yes --> D[Dashboard /home]
    C --> D
    D --> E[Browse Cohorts /explore]
    E --> F[View Cohort Overview /cohort/:id/overview]
    F --> G[Enroll in Cohort /api/cohort/:id/join]
    G --> H[Open Microlearning Player /play]
    H --> I[Consume 5-10m Chunks in Vertical Feed]
    I --> J{Watched >= 85%?}
    J -- Yes --> K[Emit Completion Telemetry /api/progress/chunk]
    J -- No --> L[Persist Timestamp Progress]
    K --> M[Advance Frontier Gating k*]
    L --> I
    M --> N[Check In to Study Room /studyroom or Notes /notes]
    N --> O[View Hall of Fame & Streak /cohort/:id/hall-of-fame]
```

#### Step-by-Step Breakdown:
1. **Entry & Discovery**:
   - User lands on `/` or enters directly into `/home`.
   - If unauthenticated, public routes (`/cohort/[id]/overview`, `/questline`) dynamically query PostgreSQL for Open Graph tags and SSR metadata, permitting unauthenticated previewing without disruptive login walls.
2. **Authentication & Session Issuance**:
   - Login via NextAuth v5 OAuth providers (Google, GitHub, Apple).
   - `@auth/prisma-adapter` creates a durable session row in the PostgreSQL `sessions` table.
3. **Cohort Discovery & Enrollment**:
   - Learner selects a Cohort from `/explore`.
   - On clicking "Join Cohort", `POST /api/cohort/[id]/join` idempotently upserts a `CohortMember` record with compound key `@@id([cohortId, userId])`.
4. **Active Microlearning Session (`/play`)**:
   - Feed engine queries candidate chunks, calculates the user's current Target Vector $V_{\text{target}}$, checks the anti-fatigue score, and streams buffered video atoms.
   - User swipes vertically through 5–10 minute chunks with distraction-free playback (YouTube overlays and recommendations stripped).
5. **Progress Telemetry & Frontier Advancement**:
   - Watch progress sends heartbeat pings to `/api/progress/chunk`.
   - Once watch time crosses the outro threshold ($T_{\text{remaining}} \leq \min(15, T_{\text{total}} \times 0.15)$), the chunk transitions to `COMPLETED`, advancing the user's sequential prerequisite frontier $k^*$.
6. **Collaboration & Reflection**:
   - Learner can drop into a live voice Study Room (`/studyroom`) or jot quick markdown notes and canvas sketches (`/notes`, `/api/workspace/canvas`).

---

### Journey B: The Creator (Curator) Ingestion Lifecycle

```mermaid
flowchart TD
    A[Creator opens /create-cohort] --> B[Input Source URL: YouTube, GitHub, Notion]
    B --> C[Submit to Ingestion API /api/import/:source]
    C --> D[NDJSON SSE Stream: Extracting -> Parsing -> Vectorizing]
    D --> E[Gemini 3.6 Flash generates 12D Vectors & Topological Sort]
    E --> F[Review Draft Curriculum in Wizard UI]
    F --> G[Edit Lessons, Reorder Chunks, Set Covers]
    G --> H[Click 'Publish Cohort' /api/cohort/publish]
    H --> I[Postgres Transaction: Create Cohort + Seasons + Lessons]
    I --> J[MongoDB Transaction: Commit Transcripts & 12D Vectors]
    J --> K{MongoDB Success?}
    K -- Yes --> L[Commit Postgres Transaction -> Published!]
    K -- No --> M[Rollback Postgres Transaction -> Delete Draft -> Alert Creator]
```

#### Step-by-Step Breakdown:
1. **Source Ingestion**:
   - Creator pastes a YouTube Playlist URL, GitHub repository link, or Notion workspace token into the creation wizard at `/create-cohort`.
2. **Streaming Extraction Pipeline**:
   - Server-Sent Events (NDJSON) stream progress back to the UI in real time (`stage: "extracting"` $\rightarrow$ `"parsing"` $\rightarrow$ `"vectorizing"`).
   - Corsair plugins traverse directory structures, fetch captions, calculate word counts, and segment content into atomic chunks.
3. **AI Evaluation & Linear Prerequisite Graphing**:
   - `VectorScoringService` sends chunk transcripts to Google Gemini (`gemini-3.6-flash`), scoring all 12 pedagogical dimensions and classifying linearity dependencies (`is_strictly_linear`).
4. **Draft Inspection & Editing**:
   - Creator inspects generated Seasons, Lessons, and Chunks in an interactive tree view.
   - Adjusts durations, titles, requirements, and tags before committing.
5. **Dual-Database Atomic Publishing**:
   - Submits draft to `/api/cohort/publish`.
   - System orchestrates dual writes across PostgreSQL and MongoDB with rollback protection.

---

## 3. Deep-Dive Technical Sequence Flows

---

### Flow 1: Content Ingestion & AI Vectorization Pipeline

This flow details how raw YouTube playlists or GitHub repos become a structured, vector-scored curriculum.

```mermaid
sequenceDiagram
    autonumber
    actor Creator as Creator Client
    participant API as Ingestion Controller (/api/import/*)
    participant Importer as YouTube/GitHub Import Service
    participant Gemini as Google Gemini AI (3.6 Flash)
    participant Fallback as NLP Heuristic Engine
    participant Response as NDJSON Stream (SSE)

    Creator->>API: POST /api/import/youtube/playlist { playlistUrl }
    API->>Response: 200 OK (Content-Type: text/event-stream)
    API->>Importer: fetchPlaylistMetadata(playlistUrl)
    Importer-->>Response: emit { stage: "extracting", progress: 25% }
    
    Importer->>Importer: segmentIntoSemanticChunks(videos)
    Importer-->>Response: emit { stage: "parsing", progress: 50% }
    
    loop For each chunk in curriculum
        alt Gemini API Available
            Importer->>Gemini: scoreTranscript(transcript, metadata)
            Gemini-->>Importer: 12D Vector JSON { cognitive_load, linearity... }
        else API Rate Limit / Disconnected
            Importer->>Fallback: heuristicFallback(transcript, metadata)
            Fallback-->>Importer: Deterministic 12D Vector Array
        end
        Importer-->>Response: emit { stage: "vectorizing", chunkIndex: i, total: N }
    end

    Importer-->>Response: emit { stage: "completed", curriculumTree: {...} }
    Response-->>Creator: Hydrate Creator Wizard with Editable Curriculum
```

---

### Flow 2: Adaptive Feed Generation & Playback Runtime (`/play`)

This flow describes the mathematical scoring and anti-fatigue interleaving executed every time a learner requests content in the `/play` feed.

```mermaid
sequenceDiagram
    autonumber
    actor Learner as Learner Client
    participant RSC as Play Screen (Next.js Server)
    participant Feed as Feed Recommendation Engine (/api/feed)
    participant DB as PostgreSQL (Prisma)
    participant Mongo as MongoDB Atlas (Vectors)
    participant Player as IFrame Media Surface

    Learner->>RSC: Navigate to /play?channel=spark
    RSC->>Feed: getAdaptiveFeed(userId, channelId, timeOfDay)
    
    Feed->>DB: Fetch user enrolled cohorts & completed chunk IDs
    DB-->>Feed: { enrolledCohorts, completedIds: [c1, c2, ...] }
    
    Feed->>Feed: 1. Calculate Target Vector: V_target = V_base + (Δ_user × 0.25) + Δ_time
    Feed->>Mongo: Query candidate chunk vectors for active cohorts
    Mongo-->>Feed: Return Candidate Vectors [V_chunk_1, V_chunk_2, ...]
    
    loop For each candidate chunk
        Feed->>Feed: 2. Context Blend: V_final = (0.30 × V_lesson) + (0.70 × V_chunk)
        Feed->>Feed: 3. Compute Cosine Similarity: S = (V_final · V_target) / norms
        Feed->>Feed: 4. Progression Gating: Filter out c_j if prerequisite c_k* is uncompleted
        Feed->>Feed: 5. Anti-Fatigue Math: If C_fatigue > Limit, penalize dense chunks
    end

    Feed->>Feed: Sort & slice top candidate chunks
    Feed-->>RSC: Return Ordered Microlearning Stream
    RSC-->>Learner: Stream Server Component HTML + Media Buffers
    Learner->>Player: Mount Distraction-Free Media Engine
```

---

### Flow 3: Media Progress Telemetry & Outro-Aware Auto-Completion

This flow illustrates continuous timestamp persistence and smart auto-completion during video playback.

```mermaid
sequenceDiagram
    autonumber
    actor Learner as Learner (Swiping Feed)
    participant Player as Client Media Engine (IFrame)
    participant API as Progress Controller (/api/progress/chunk)
    participant DB as PostgreSQL (lesson_progress)
    participant Mongo as MongoDB (user_chunk_progress)

    Player->>Player: User watches video chunk (T_watched incrementing)
    
    rect rgb(240, 240, 255)
        Note over Player,API: Periodic Heartbeat (Every 5s)
        Player->>API: POST /api/progress/chunk { chunkId, watchedSec, totalSec }
        API->>Mongo: Update UserChunkProgress { lastWatchedSec: watchedSec }
    end

    Player->>Player: Watch reaches outro window: T_remaining <= min(15, totalSec * 0.15)
    Player->>API: POST /api/progress/chunk { chunkId, status: "COMPLETED" }
    
    par PostgreSQL Relational Update
        API->>DB: Upsert LessonProgress { userId, lessonId, status: "COMPLETED" }
    and MongoDB Fast Analytics
        API->>Mongo: Mark ChunkProgress { isCompleted: true, completedAt: now() }
    end
    
    API-->>Player: 200 OK { success: true, nextFrontierChunkId: "c_next" }
    Player->>Player: Trigger haptic feedback & unlock downstream quest
```

---

### Flow 4: Dual-Database Atomic Publishing Protocol

This flow guarantees that cohorts are never published in a broken state where relational data exists in PostgreSQL but vector embeddings or transcripts are missing from MongoDB.

```mermaid
sequenceDiagram
    autonumber
    actor Creator as Creator Client
    participant API as Publish Endpoint (/api/cohort/publish)
    participant PG as PostgreSQL (Prisma Transaction)
    participant Mongo as MongoDB Atlas (Transcripts & Vectors)

    Creator->>API: POST /api/cohort/publish { cohortPayload }
    API->>PG: BEGIN TRANSACTION
    PG->>PG: Create Cohort, Seasons, Lessons, Community Channels
    
    alt Mongo Vector Commit Successful
        API->>Mongo: Insert Transcripts & 12D Vector Embeddings
        Mongo-->>API: 200 OK (Write Acknowledged)
        API->>PG: UPDATE Cohort SET isPublished = true
        API->>PG: COMMIT TRANSACTION
        API-->>Creator: 201 Created { cohortId, status: "PUBLISHED" }
    else Mongo Write Fails / Times Out
        API->>Mongo: Write Error / Socket Timeout
        API->>PG: ROLLBACK TRANSACTION (Delete draft records)
        API-->>Creator: 500 Internal Error { error: "Publish failed. Changes rolled back." }
    end
```

---

### Flow 5: Global Concurrency Enforcement in Study Rooms

This flow demonstrates how database constraints guarantee that a user cannot occupy multiple study rooms simultaneously across different tabs or devices.

```mermaid
sequenceDiagram
    autonumber
    actor Tab1 as Browser Tab 1
    actor Tab2 as Browser Tab 2
    participant API as StudyRoom Controller (/api/studyroom)
    participant PG as PostgreSQL (room_participants)

    Tab1->>API: POST /api/studyroom/join { roomId: "room_alpha", userId: "usr_1" }
    API->>PG: INSERT INTO room_participants (userId, studyRoomId) VALUES ('usr_1', 'room_alpha')
    PG-->>API: Success (Row inserted)
    API-->>Tab1: 200 OK { joined: true, roomId: "room_alpha" }

    Note over Tab2,PG: Race Condition: User attempts concurrent join in Tab 2
    Tab2->>API: POST /api/studyroom/join { roomId: "room_beta", userId: "usr_1" }
    API->>PG: INSERT INTO room_participants (userId, studyRoomId) VALUES ('usr_1', 'room_beta')
    PG-->>API: ERROR: Unique constraint violation (userId must be unique)
    
    API->>PG: Fallback: Atomic Transfer (DELETE old participant -> INSERT new)
    PG-->>API: Old room cleared, new room joined
    API-->>Tab2: 200 OK { joined: true, roomId: "room_beta", previousRoomClosed: true }
```

---

### Flow 6: Defensive UI Mapping & Fallback Perimeter

This flow illustrates how `cohortMapper.ts` isolates client components from unexpected database variations or legacy data shapes.

```mermaid
sequenceDiagram
    autonumber
    actor Client as Next.js React Component
    participant Loader as RSC Data Loader
    participant DB as PostgreSQL (Prisma)
    participant Mapper as cohortMapper.ts
    participant Zod as Zod Sanitizer / Transformer

    Client->>Loader: Render /cohort/:id/overview
    Loader->>DB: prisma.cohort.findUnique(...)
    DB-->>Loader: Raw DB Record (May contain nulls, unparsed durations)

    Loader->>Mapper: mapDbCohortToUiCohort(rawDbRecord)
    
    Mapper->>Zod: Sanitize payload & parse duration strings to seconds
    Zod-->>Mapper: Validated Data Types
    
    alt Chunks Missing (Legacy Cohort)
        Mapper->>Mapper: Dynamically scaffold standard 5-min micro-chunks
    end
    alt Creator Avatar or Bio Missing
        Mapper->>Mapper: Inject default fallback avatars & Guide bio
    end
    alt Requirements / Outcomes Empty
        Mapper->>Mapper: Inject default structured pedagogical pillars
    end

    Mapper-->>Loader: Sanitized, Non-Null UiCohort Object
    Loader-->>Client: Render Pixel-Perfect UI (Zero Layout Shift / CLS = 0)
```

---

## 4. State Machines & Data Transition Models

---

### 4.1 Lesson Progress State Machine

```
               ┌────────────────┐
               │  NOT_STARTED   │
               └───────┬────────┘
                       │ User starts video chunk in /play
                       ▼
               ┌────────────────┐
  Heartbeat    │  IN_PROGRESS   │ ◄─── (Timestamp persisted every 5s)
  ───────────> │ (0 < T < 85%)  │
               └───────┬────────┘
                       │ T_remaining <= min(15s, T_total * 0.15)
                       ▼
               ┌────────────────┐
               │   COMPLETED    │
               └───────┬────────┘
                       │
                       ▼
       [Unlocks Next Sequential Quest (k* + 1)]
```

---

### 4.2 Cohort Lifecycle State Machine

```
 ┌─────────┐   Ingest Source    ┌────────────┐   AI Vectorization   ┌──────────────┐
 │  INIT   │ ─────────────────> │ EXTRACTING │ ───────────────────> │  VECTORIZING │
 └─────────┘                    └────────────┘                      └──────┬───────┘
                                                                           │
 ┌──────────────┐      Creator Publishes      ┌───────────┐                │
 │  PUBLISHED   │ ◄────────────────────────── │   DRAFT   │ ◄──────────────┘
 └──────┬───────┘                             └─────┬─────┘
        │                                           │
        │ MongoDB Failure                           │ Incomplete Data
        ▼                                           ▼
 ┌──────────────┐                             ┌───────────┐
 │ ROLLED_BACK  │                             │ ARCHIVED  │
 └──────────────┘                             └───────────┘
```

---

## 5. Failure Modes, Edge Cases & Self-Healing Behaviors

| Subsystem / Scenario | Potential Failure | Self-Healing / Recovery Protocol |
| :--- | :--- | :--- |
| **Gemini AI Rate Limit** | `429 Too Many Requests` or missing API key during ingestion | System seamlessly falls back to `VectorScoringService.heuristicFallback()`, computing 12D vectors deterministically via regex token density and speech-rate WPM. |
| **MongoDB Network Timeout** | Serverless cold boot causes Mongo write to timeout during publish | `POST /api/cohort/publish` aborts the PostgreSQL transaction and deletes draft rows, returning HTTP 500 to prevent un-indexed orphan cohorts. |
| **User Drops at Video Outro** | User leaves video 10 seconds before completion during YouTube outro cards | The auto-completion window ($T_{\text{remaining}} \leq \min(15, T_{\text{total}} \times 0.15)$) detects outro entry and credits 100% completion automatically. |
| **Concurrent Study Room Join** | User clicks "Join Room" simultaneously across 2 browser tabs | PostgreSQL unique index `@unique([userId])` rejects the race condition with error code `P2002`; controller executes atomic transfer without data corruption. |
| **Legacy Cohort Chunk Absence** | Cohort generated prior to microlearning parser lacks `chunks` JSON | `cohortMapper.ts` detects null chunks and synthesizes 5-minute virtual chunk scaffolds, preventing client crashes or layout shifts. |
| **Offline Mobile Usage** | Device loses internet connectivity while browsing `/play` feed | `CapacitorBridge.tsx` captures network state, switches to offline fallback indicators, and queues progress telemetry in `localStorage` until reconnect. |

---

## 6. Technical Stack & File Directory Mapping

| Architectural Layer | Implementation Files & Core Modules |
| :--- | :--- |
| **Ingestion Controllers** | [`src/app/api/import/youtube/playlist/route.ts`](file:///d:/ThisPC/Documents/SideQuestHQ/sidequesthq-site/src/app/api/import/youtube/playlist/route.ts), [`src/app/api/import/github/route.ts`](file:///d:/ThisPC/Documents/SideQuestHQ/sidequesthq-site/src/app/api/import/github/route.ts), [`src/app/api/import/notion/route.ts`](file:///d:/ThisPC/Documents/SideQuestHQ/sidequesthq-site/src/app/api/import/notion/route.ts) |
| **AI & Vector Scoring** | [`src/server/domain/cohort/vectorScoring.service.ts`](file:///d:/ThisPC/Documents/SideQuestHQ/sidequesthq-site/src/server/domain/cohort/vectorScoring.service.ts), [`src/shared/curriculum/pedagogicalVector.engine.ts`](file:///d:/ThisPC/Documents/SideQuestHQ/sidequesthq-site/src/shared/curriculum/pedagogicalVector.engine.ts) |
| **Relational Database** | [`prisma/schema.prisma`](file:///d:/ThisPC/Documents/SideQuestHQ/sidequesthq-site/prisma/schema.prisma) (PostgreSQL models: `User`, `Cohort`, `Season`, `Lesson`, `RoomParticipant`) |
| **Vector & Transcript DB** | [`src/server/database/mongo/models/Chunk.ts`](file:///d:/ThisPC/Documents/SideQuestHQ/sidequesthq-site/src/server/database/mongo/models/Chunk.ts), [`src/server/database/mongo/models/CohortTranscript.ts`](file:///d:/ThisPC/Documents/SideQuestHQ/sidequesthq-site/src/server/database/mongo/models/CohortTranscript.ts) |
| **Feed Recommender** | [`src/app/api/feed/route.ts`](file:///d:/ThisPC/Documents/SideQuestHQ/sidequesthq-site/src/app/api/feed/route.ts), [`docs/feed-architecture.md`](file:///d:/ThisPC/Documents/SideQuestHQ/sidequesthq-site/docs/feed-architecture.md) |
| **Defensive Mapper** | [`src/server/infrastructure/db/postgres/mappers/cohortMapper.ts`](file:///d:/ThisPC/Documents/SideQuestHQ/sidequesthq-site/src/server/infrastructure/db/postgres/mappers/cohortMapper.ts) |
| **Security & Sessions** | [`src/server/infrastructure/auth/auth.config.ts`](file:///d:/ThisPC/Documents/SideQuestHQ/sidequesthq-site/src/server/infrastructure/auth/auth.config.ts), [`src/server/infrastructure/auth/requireUser.ts`](file:///d:/ThisPC/Documents/SideQuestHQ/sidequesthq-site/src/server/infrastructure/auth/requireUser.ts) |
| **Client Screens** | [`src/app/(dashboard)/play/page.tsx`](file:///d:/ThisPC/Documents/SideQuestHQ/sidequesthq-site/src/app/(dashboard)/play/page.tsx), [`src/app/(dashboard)/create-cohort/page.tsx`](file:///d:/ThisPC/Documents/SideQuestHQ/sidequesthq-site/src/app/(dashboard)/create-cohort/page.tsx) |
| **Native Mobile Bridge** | [`src/client/components/global/CapacitorBridge/CapacitorBridge.tsx`](file:///d:/ThisPC/Documents/SideQuestHQ/sidequesthq-site/src/client/components/global/CapacitorBridge/CapacitorBridge.tsx) |
