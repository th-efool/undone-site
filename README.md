# Undone

Undone is a modern microlearning and structured curiosity platform that transforms long-form internet resources (YouTube playlists, video lectures, articles, and code repositories) into adaptive, bite-sized learning feeds.

Instead of forcing learners to manage courses, plan calendars, or reconstruct where they left off, Undone absorbs the coordination overhead of self-directed education. Material is decomposed into modular units, scored across a continuous 12-dimensional cognitive vector space, and served through a distraction-free, adaptive stream.

---

## Architecture and Technical Documentation

For in-depth architectural breakdowns, database schemas, and mathematical formulations, consult the documentation in `docs/`:

- [Product Philosophy and Specification](./docs/PRODUCT_DESCRIPTION.md): Product rationale, problem definition, learner archetypes, and structured curiosity principles.
- [Core Architecture and System Design](./docs/ARCHITECTURE.md): Client-server boundaries, App Router layout, NextAuth v5 session flow, and atomic dual-database publishing.
- [Pedagogical Vector Engine and Feed Architecture](./docs/feed-architecture.md): Mathematical definitions, 12D cognitive vectors, progression frontier gating, and anti-fatigue scheduling.
- [Relational Curriculum Schema](./docs/prisma-schema-cohort.md): Prisma PostgreSQL models for Cohorts, Seasons, Lessons, and Chunks.
- [Global Study Rooms and Concurrency](./docs/study-rooms-schema.md): Database constraints, join tables, and single-presence concurrency guarantees.
- [Android Shell and Capacitor Integration](./docs/ANDROID.md): Native mobile wrapper, deep linking, static export pipeline, and Google Play release workflow.

---

## Core Capabilities

### 1. Multi-Source Ingestion Engine
Ingest learning materials directly from YouTube playlists, standalone videos, GitHub repositories, and Notion workspaces.
- Streaming telemetry: Real-time NDJSON / Server-Sent Events stream progress states (`extracting`, `parsing`, `vectorizing`, `completed`).
- Semantic chunking: AI-driven linguistic and topical segmentation partitions long-form video transcripts into 60-to-240 second self-contained micro-lessons.
- Relational mapping: Ingested trees are mapped into structured seasons and lessons, preserving narrative sequence and author context.

### 2. Adaptive Microlearning Stream (`/play`)
A media playback engine designed for high-retention, interstitial learning.
- Interface eradication: Strips standard video player clutter and distraction surfaces via programmatic IFrame management.
- Continuous gesture navigation: Synchronized scroll, arrow keys, and touch gestures automatically pause previous chunks and buffer upcoming modules.
- Context retention: Micro-timestamps preserve exact progress so learners resume instantly across devices.

### 3. Pedagogical Vector Space and Recommendation
Candidate learning chunks are evaluated across a 12-dimensional continuous vector space:
- Cognitive dimensions: Novelty, Scope, Depth, Rigor, Density, Abstraction.
- Structural dimensions: Pacing, Guidance, Constraint, Continuity, Connectivity, Format.
- Frontier-chunk gating: Curricula enforce prerequisite sequencing ensuring foundational concepts precede advanced applications.
- Anti-fatigue interleaving: Dynamic pacing avoids cognitive exhaustion by balancing dense theoretical chunks with applied modules.

### 4. Cohorts and Collaborative Learning
Shared learning tracks organized around topics, tools, or goals.
- Questlines (`/cohort/[id]/questline`): Granular curriculum mapping with visual completion tracking.
- Accountability: Cohort-level milestones and progress visibility without competitive stress.
- Dual publishing safety: Publishing transactions write across PostgreSQL and MongoDB with automatic rollback if secondary indexing fails.

### 5. Virtual Study Rooms (`/studyroom`)
Persistent drop-in focus spaces for co-studying and silent productivity.
- Source of truth: PostgreSQL enforces global presence through unique database constraints on participant IDs, preventing duplicate active sessions.
- Room telemetry: Real-time participant counters and live status indicators.

### 6. Personal Workspace and Canvas (`/notes`)
An integrated knowledge capture environment:
- Rich notebook hierarchy: Categorized notebooks and searchable note blocks.
- Visual canvas: Integrated Excalidraw whiteboarding engine with dark mode styling.
- Kanban task board: Integrated progress tracking for active projects and learning targets.

---

## Technical Stack

### Frontend & Application Layer
- Framework: Next.js 15 (App Router, React Server Components)
- UI Library: React 19
- Styling: Vanilla CSS Modules, CSS Variables, Tailwind CSS
- State Management: Redux Toolkit, TanStack Query (React Query)
- Motion & Interactions: Framer Motion
- Visual Workspace: Excalidraw, SVAR Kanban
- Mobile Shell: Capacitor 8 (Android runtime)

### Backend & Data Infrastructure
- Relational Database: PostgreSQL managed with Prisma ORM 7
- Vector & Document Store: MongoDB Atlas (transcripts, embeddings, chunk metadata)
- Authentication: NextAuth v5 (Auth.js) with Prisma adapter and database sessions
- AI & Vectorization: Google Gemini API via `@google/generative-ai`
- Multi-Source Connectors: Corsair integration toolkit (GitHub, Notion)
- Asynchronous Processing: Standalone worker process (`src/server/worker.ts`)

---

## System Architecture

```
                    +------------------------------------+
                    |        Client Layer (Web / Mobile) |
                    |  Next.js 15 App Router / Capacitor |
                    +-----------------+------------------+
                                      |
                      HTTP / SSE / Dynamic RSC
                                      |
                                      v
+------------------------------------------------------------------------+
|                          Next.js Server (Node.js)                      |
|                                                                        |
|  +--------------------+  +--------------------+  +-------------------+ |
|  | Auth Layer         |  | Ingestion Wizard   |  | Feed & Play Engine| |
|  | NextAuth v5        |  | Corsair Importers  |  | 12D Vector Math   | |
|  +---------+----------+  +---------+----------+  +---------+---------+ |
+------------|-----------------------|-----------------------|-----------+
             |                       |                       |
             v                       v                       v
+------------------------+  +--------------------------------------------+
|  PostgreSQL (Prisma)   |  |              MongoDB Atlas                 |
|  - Users & Sessions    |  |  - 12D Pedagogical Vectors                 |
|  - Cohorts & Seasons   |  |  - Video Transcripts & Subtitles           |
|  - Lessons & Progress  |  |  - Search Indices                          |
|  - Room Participants   |  +--------------------------------------------+
+------------------------+
```

---

## Directory Structure

```
.
|-- android/                  # Native Capacitor Android studio project
|-- docs/                     # Technical specifications and architecture guides
|   |-- ANDROID.md            # Mobile build and release documentation
|   |-- ARCHITECTURE.md       # Core engine and database boundaries
|   |-- feed-architecture.md  # 12D vector recommendation formulas
|   |-- prisma-schema-cohort.md
|   |-- PRODUCT_DESCRIPTION.md
|   `-- study-rooms-schema.md
|-- prisma/                   # Prisma schema and database seeds
|   |-- schema.prisma
|   `-- seed.ts
|-- public/                   # Static assets, logos, and manifest
|-- scripts/                  # Build, dev, and mobile automation scripts
`-- src/
    |-- app/                  # Next.js App Router (pages and API routes)
    |   |-- (dashboard)/      # Authenticated routes (home, play, cohort, etc.)
    |   |-- (landing)/        # Public landing experience
    |   `-- api/              # Ingestion, feed, workspace, and auth endpoints
    |-- client/               # React client components, hooks, and repositories
    |   |-- components/       # Design system and layout primitives
    |   |-- mobile/           # Mobile-specific views
    |   |-- repositories/     # Client-side data fetching and caching
    |   `-- screens/          # Feature screen implementations
    |-- server/               # Backend business logic and database access
    |   |-- domain/           # Chunking, vector scoring, and curriculum services
    |   |-- infrastructure/   # Prisma clients, Mongo connection, auth config
    |   `-- worker.ts         # Asynchronous vectorization background worker
    `-- shared/               # Shared domain constants, types, and math engines
        |-- api/              # URL builders and API contracts
        `-- curriculum/       # 12D pedagogical vector definitions and formulas
```

---

## Getting Started

### Prerequisites
- Node.js 18.x or later
- npm or pnpm
- PostgreSQL 14+ instance
- MongoDB 6+ instance (required for vector embeddings and transcripts)
- Google Gemini API key (for chunking and pedagogical scoring)

### 1. Clone Repository
```bash
git clone https://github.com/th-efool/undone-site.git
cd undone-site
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Create a `.env.local` file in the project root:

```env
# Next.js & Server
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development

# Authentication (NextAuth v5)
AUTH_SECRET=your-random-32-char-secret-key-here
NEXTAUTH_SECRET=your-random-32-char-secret-key-here
AUTH_URL=http://localhost:3000
NEXTAUTH_URL=http://localhost:3000

# Databases
DATABASE_URL="postgresql://user:password@localhost:5432/undone?schema=public"
MONGODB_URI="mongodb://localhost:27017/undone"

# AI & Processing
GEMINI_API_KEY=your-gemini-api-key

# OAuth Providers (Optional for local guest dev)
AUTH_GITHUB_ID=
AUTH_GITHUB_SECRET=
```

### 4. Database Setup
Generate the Prisma client, push migrations, and seed initial development data:

```bash
# Generate Prisma Client
npx prisma generate

# Apply schema to database
npx prisma db push

# Optional: Seed initial cohorts, users, and rooms
npm run prisma:seed
```

### 5. Start Development Server
```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) in your browser.

---

## Background Worker

To run content ingestion and vector processing asynchronously outside the web process:

```bash
# Build worker bundle
npm run build:worker

# Run worker process
npm run start:worker
```

---

## Native Mobile App (Android / Capacitor)

The Android application wraps the statically exported Next.js client within a high-performance native Capacitor shell.

### 1. Build and Sync Mobile Assets
```bash
npm run mobile:build
npm run mobile:sync
```

### 2. Open in Android Studio
```bash
npm run mobile:open
```

### 3. Generate Signed Release AAB
Ensure release keystore credentials are configured in your environment or `keystore.properties`:

```bash
npm run mobile:release:aab
```

Outputs the signed production bundle to:
`android/app/build/outputs/bundle/release/app-release.aab`

For additional details on mobile configuration and deep link routing, review [docs/ANDROID.md](./docs/ANDROID.md).

---

## Quality Assurance & Verification

```bash
# Run ESLint validation
npm run lint

# Build full production web bundle
npm run build
```

---

## License

This project is licensed under the MIT License. See [LICENSE](./LICENSE) for details.
