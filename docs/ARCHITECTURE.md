# SideQuestHQ Architecture

SideQuestHQ is a cohort-based microlearning platform built to transform long-form internet content (YouTube playlists, articles, etc.) into interactive, high-retention, TikTok-style learning feeds.

This document outlines the core technical architecture, data modeling, and engineering decisions that power the platform. It is designed to be a substantial, concise guide for reviewers and technical judges.

---

## 1. The Core Engine: Content Ingestion to Microlearning Feed

The primary technical challenge of SideQuestHQ is bridging the gap between flat media (e.g., a 2-hour YouTube video) and interactive microlearning (5-minute chunked quests).

### The Ingestion Pipeline (Cohort Creation Wizard & Multi-Source Importers)
When a creator imports content:
1. **Multi-Source Ingestion**: The system ingests content across YouTube Playlists/Videos, GitHub Repositories, and Notion Workspaces (orchestrated via Corsair integration plugins).
2. **Streaming Progress & Metadata Extraction**: Server-Sent Events (NDJSON streams) provide real-time stage telemetry (`extracting`, `parsing`, `vectorizing`, `completed`) while extracting hierarchical file trees, word counts, and metadata.
3. **Curriculum Generation**: Raw media and documents are transformed into structured JSON curricula comprising **Seasons**, **Lessons**, and **Semantic Chunks**.
4. **Dual-Database Persistence**: The curriculum is atomically persisted into PostgreSQL (relational structure) and MongoDB Atlas (12D pedagogical vectors and transcript search indices).

### The Delivery Surface (TikTok-Style Feed)
The `/play` route serves the chunked curriculum using a custom-built, distraction-free media engine.
- **IFrame Eradication**: We strip away the native YouTube UI using the YouTube IFrame API, exposing only raw video buffers.
- **Scroll Synchronization**: The vertical scrolling feed is deeply integrated with media state. Swiping to the next chunk instantly pauses the previous video and buffers the next.
- **Progress Tracking**: Timestamp-based completion events (`&t=234s`) are emitted to the backend to persist user progress locally and globally.

---

## 2. Data Modeling & Relational Integrity (Prisma)

Instead of storing curricula as flat JSON blobs (which breaks down at scale and prevents efficient querying), we use a strict relational model backed by PostgreSQL and Prisma ORM.

### The Curriculum Hierarchy
- **Cohort**: The top-level learning journey (e.g., "Fullstack React Developer").
- **Season**: A logical grouping of content (e.g., "The React Foundations").
- **Lesson (Quest)**: The atomic unit of learning (e.g., "Understanding useEffect").

This schema allows us to perform targeted queries. For example, we can load just "Season 1" without loading the entire 500-lesson Cohort into memory, significantly reducing time-to-first-byte (TTFB).

### Global Study Rooms (Join Tables & Concurrency)
We support global "Study Rooms" where users can drop in for focused voice sessions.
- We use a **Join Table** (`RoomParticipant`) to enforce that a user can only be in one room globally.
- A **Unique Constraint** (`@unique` on `userId`) at the database level guarantees this logic, preventing race conditions if a user clicks "Join" simultaneously across multiple tabs.

---

## 3. Security & Authentication (NextAuth v5)

SideQuestHQ relies on robust, persistent authentication to track learning progress accurately.

- **NextAuth v5 (Auth.js)**: Handles the OAuth flow (GitHub, Apple, Google).
- **Database Sessions**: Unlike traditional JWTs stored in cookies (which can be lost or hard to revoke), we use the `@auth/prisma-adapter` to store active sessions directly in PostgreSQL. 
- **Server-Side Enforcement**: Protected routes and API endpoints verify the session directly against the database using a custom `requireUser()` wrapper, ensuring that revoked users are instantly locked out.

---

## 4. Client-Server Architecture (Next.js App Router)

We leverage the Next.js App Router to split the workload optimally between the server and the client.

- **Server Components (RSC)**: Used for data-heavy operations like rendering the initial Cohort Overview or fetching the Curriculum tree. This keeps the bundle size small and leverages server-side caching.
- **Client Components**: Used strictly where interactivity is required—such as the media playback engine, gesture controls in the TikTok feed, and the multi-step React Hook Form in the Cohort Wizard.
- **Native Mobile Bridge (Capacitor)**: The web shell is designed to be seamlessly wrapped by Capacitor for iOS/Android deployment, allowing us to push web updates instantly while maintaining native performance for video decoding.

---

## 5. Atomic Dual-Database Publishing & SEO Routing

To support advanced AI capabilities alongside robust relational data, we utilize a dual-database architecture:
- **PostgreSQL**: Manages the strict relational hierarchy (Cohorts, Seasons, Lessons) and access control.
- **MongoDB**: Stores massive, unstructured vector embeddings and video transcripts used for AI semantic search and Q&A.

### The Publishing Guarantee
Publishing a cohort writes to both databases. To prevent orphan states (where a cohort exists in Postgres but lacks AI capabilities in Mongo), the publishing pipeline employs an **atomic rollback**. If the MongoDB transcript save fails or times out (e.g., due to a Vercel cold boot), the Postgres transaction is aggressively rolled back and the cohort is deleted, guaranteeing that only fully operational cohorts ever reach production.

### SEO-Driven Dynamic Routing
Public visibility is a cornerstone of the platform. We bypass Next.js middleware for public routes (`/cohort/[id]/overview`, `/questline`, etc.) to gracefully degrade for unauthenticated users instead of forcing a redirect. The Next.js `generateMetadata` dynamically queries Postgres to build accurate, SEO-ranked Open Graph (OG) tags for every cohort, ensuring deep linking and social sharing are flawless from day one.

---

## 6. End-to-End Data Integrity & UI Mapping

To maintain strict boundaries between raw database models (PostgreSQL/Prisma) and complex frontend React states, we employ a defensive API validation and deterministic mapping layer (`cohortMapper.ts`).

- **Uncompromised Curriculum Persistence**: When the AI wizard generates detailed learning trajectories (including hyper-specific lesson durations, semantic chunks, and custom thumbnails), our backend guarantees 1:1 persistence. Custom Zod schemas sanitize the payload, dedicated `parseDurationToSeconds` transformers handle string-to-integer duration safety, and Prisma persists the exact arrays into Postgres JSON columns.
- **Graceful Algorithmic Fallbacks**: The mapper acts as a defensive perimeter. If optional relational data (like missing semantic chunks from an older cohort, or missing creator avatars) is not present in the database, the mapper guarantees the UI receives robust fallback scaffolding—such as dynamically recalculating standard 5-minute micro-chunks—rather than rendering broken layouts or causing null reference crashes.

---

## 7. Pedagogical Vector Space & Adaptive Feed Engine

The media playback and discovery engine (`/play`) serves micro-learning units through a 12-dimensional continuous cognitive vector space.

- **12D Pedagogical Embeddings**: Chunks are scored along cognitive and structural axes (Novelty, Scope, Depth, Rigor, Density, Pacing, Guidance, Abstraction, Continuity, etc.).
- **Hybrid 70/30 Context Matching**: Evaluates candidate chunks using a composite of macro-lesson intent (70%) and atomic micro-chunk relevance (30%) against target channel vectors and user preferences.
- **Progression Gating & Anti-Fatigue Interleaving**: Linear curricula enforce strict frontier-chunk sequencing ($k^* = \min \{ i \mid \text{status}(c_i) \neq \text{completed} \}$), while an anti-fatigue scheduler dynamically prevents cohort clustering and caps cognitive overload.
- **Detailed Specification**: See [docs/feed-architecture.md](./feed-architecture.md) for full mathematical definitions, target vector equations, and telemetry auto-completion thresholds.
