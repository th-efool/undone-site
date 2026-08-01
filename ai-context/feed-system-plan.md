# Feed Microlearning System — Architecture & Implementation Plan

> The feed is the heart of SideQuestHQ's daily learning experience. It surfaces
> bite-sized **chunks** from a learner's active cohorts in a scrollable,
> TikTok / Instagram Reels–style vertical feed. Each card represents one
> chunk (3–7 min segment) of a lesson, drawn from the learner's subscribed
> cohorts and scheduled according to an algorithm that balances progress,
> variety, and spaced-repetition signals.

---

## 1. Core Concepts

| Term | Definition |
|------|-----------|
| **FeedItem** | A single card in the feed. Wraps a chunk with cohort context, progress state, and interaction affordances. |
| **Chunk** | The atomic learning unit — a timed segment of a lesson (e.g. "Part 2 of Lecture 5, 3:30–7:00"). Already exists in `LessonChunk`. |
| **Lesson** | A full video / reading / assignment. Contains 1–N chunks. |
| **Season** | An ordered group of lessons inside a cohort. |
| **Cohort** | The top-level learning journey. A learner subscribes to 1–N cohorts. |
| **FeedEngine** | Pure-function algorithm that takes learner state + cohort data → ordered `FeedItem[]`. |
| **FeedRepository** | Data-access layer that assembles inputs for the engine and persists progress. |
| **FeedProvider** | React context that exposes feed state, actions (complete, skip, bookmark), and infinite-scroll loading to UI components. |

---

## 2. Data Flow

```
┌──────────────┐    ┌──────────────────┐    ┌─────────────┐
│ cohortStore   │───▶│  feedRepository   │───▶│  feedEngine  │
│ (all cohorts) │    │ (assemble inputs) │    │ (algorithm)  │
└──────────────┘    └──────────────────┘    └──────┬──────┘
                                                    │
                                           ordered FeedItem[]
                                                    │
                                           ┌────────▼────────┐
                                           │  FeedProvider     │
                                           │ (React context)   │
                                           └────────┬────────┘
                                                    │
                                ┌───────────────────┼───────────────────┐
                                │                   │                   │
                         ┌──────▼──────┐    ┌───────▼──────┐    ┌──────▼──────┐
                         │  FeedCard    │    │ FeedToolbar  │    │ FeedSidebar │
                         │ (chunk view) │    │ (controls)   │    │ (queue)     │
                         └─────────────┘    └──────────────┘    └─────────────┘
```

---

## 3. Folder Structure

```
src/
├── client/
│   ├── components/
│   │   └── screens/
│   │       └── dashboard/
│   │           └── feed/                    # NEW — Feed screen module
│   │               ├── Feed.tsx             # Main screen component
│   │               ├── Feed.module.css
│   │               ├── index.ts
│   │               ├── models/
│   │               │   ├── feed.ts          # FeedItem, FeedState, FeedActions interfaces
│   │               │   └── index.ts
│   │               ├── components/
│   │               │   ├── FeedCard/        # Individual chunk card (thumbnail, video embed, progress)
│   │               │   ├── FeedToolbar/     # Complete / Skip / Bookmark / Notes actions
│   │               │   ├── FeedProgress/    # Daily goal ring, session stats
│   │               │   ├── FeedQueue/       # Up-next sidebar showing upcoming chunks
│   │               │   └── FeedEmpty/       # Empty state when no chunks remain
│   │               ├── hooks/
│   │               │   └── useFeed.ts       # Hook that reads FeedProvider context
│   │               ├── providers/
│   │               │   └── FeedProvider.tsx  # Context provider with state, actions, infinite scroll
│   │               └── mock/
│   │                   └── feed.mock.ts     # Static mock for development / testing
│   ├── repositories/
│   │   └── feedRepository.ts               # NEW — Assembles cohort data → engine input
│   └── mock/
│       └── cohorts/
│           ├── cohortCatalog.ts             # Existing catalog (untouched)
│           └── feedCohorts.ts               # NEW — 3 real-data cohorts for feed
│
├── shared/
│   └── feed/                                # NEW — Shared feed logic (isomorphic)
│       ├── feedEngine.ts                    # Pure algorithm: inputs → FeedItem[]
│       ├── feedEngine.types.ts              # Engine input/output types
│       ├── feedScoring.ts                   # Scoring functions (variety, recency, spaced rep)
│       └── index.ts
│
└── server/
    └── feed/                                # NEW — Future backend hook point
        └── feed.service.ts                  # Stub: will call feedEngine server-side when API exists
```

---

## 4. Type Definitions (`shared/feed/feedEngine.types.ts`)

```typescript
/** Represents one chunk ready for the feed */
export interface FeedChunkInput {
  chunkId: string;
  chunkTitle: string;
  chunkOrder: number;
  chunkDuration: string;        // "5m", "3m 20s"
  startSeconds: number;
  endSeconds: number;
  timestampUrl?: string;        // YouTube deep-link with &t=Xs

  lessonId: string;
  lessonTitle: string;
  lessonThumbnail: string;
  lessonVideoId?: string;
  lessonVideoUrl?: string;
  lessonOrder: number;
  lessonType: string;           // 'video' | 'reading' | 'assignment'

  seasonId: string;
  seasonTitle: string;
  seasonOrder: number;

  cohortId: string;
  cohortTitle: string;
  cohortCoverImage: string;
  cohortProvider: string;       // creator name
}

/** Learner's progress on a specific chunk */
export interface ChunkProgress {
  chunkId: string;
  status: 'not-started' | 'in-progress' | 'completed' | 'skipped';
  completedAt?: string;         // ISO timestamp
  watchedSeconds?: number;
  bookmarked?: boolean;
  notes?: string;
}

/** Per-cohort learner state */
export interface CohortLearnerState {
  cohortId: string;
  subscribedAt: string;
  lastActiveAt: string;
  dailyGoalMinutes: number;
  scheduleDays: string[];       // ['Mon', 'Wed', 'Fri']
  priority: number;             // 1 = highest
}

/** Full input to the feed engine */
export interface FeedEngineInput {
  allChunks: FeedChunkInput[];
  chunkProgress: Record<string, ChunkProgress>;
  cohortStates: CohortLearnerState[];
  currentTime: Date;
  dailyGoalMinutes: number;
  completedTodayMinutes: number;
  feedSize: number;             // how many items to return (default 20)
}

/** Single item in the generated feed */
export interface FeedItem {
  id: string;                   // unique feed-item ID
  chunk: FeedChunkInput;
  progress: ChunkProgress;
  score: number;                // algorithm score (higher = shown first)
  reason: string;               // human-readable: "Continue DSA", "New lesson", "Review"
  position: number;             // 1-indexed position in feed
}

/** Output from the feed engine */
export interface FeedEngineOutput {
  items: FeedItem[];
  totalAvailable: number;
  dailyGoalProgress: {
    current: number;
    target: number;
    percent: number;
  };
  stats: {
    cohortsCovered: number;
    chunksRemaining: number;
    estimatedMinutes: number;
  };
}
```

---

## 5. Algorithm (`shared/feed/feedEngine.ts`)

The engine is a **pure function** — no side effects, no network calls, no React.
It takes `FeedEngineInput` and returns `FeedEngineOutput`.

### Scoring Dimensions

Each eligible chunk receives a composite score from these weighted signals:

| Signal | Weight | Description |
|--------|--------|-------------|
| **Continuity** | 0.35 | Prefer the next un-started chunk in the current lesson/season. Rewards sequential progress. |
| **Cohort Priority** | 0.20 | User-assigned priority rank (from home page reordering). |
| **Recency** | 0.15 | Boost chunks from cohorts the user was active in recently. Decay over 3 days. |
| **Variety** | 0.15 | Penalize consecutive chunks from the same cohort. Interleave across cohorts. |
| **Schedule Match** | 0.10 | Boost cohorts scheduled for today's weekday. |
| **Freshness** | 0.05 | Slight boost to chunks the user has never seen (not-started over skipped). |

### Algorithm Steps

1. **Filter**: Remove completed chunks. Remove chunks from unsubscribed/paused cohorts.
2. **Identify Frontier**: For each cohort, find the "frontier" — the first incomplete chunk in sequential order.
3. **Score**: Apply scoring formula to all eligible chunks.
4. **Interleave**: Post-process to avoid >2 consecutive chunks from the same cohort.
5. **Truncate**: Return top `feedSize` items.

### Extension Points for Backend

```typescript
// The engine is designed so that in the future:
// 1. chunkProgress comes from a database instead of localStorage
// 2. cohortStates come from a user profile API
// 3. feedEngine runs server-side in an API route
// 4. FeedRepository switches from local to API calls

// Current (local):
//   feedRepository.getFeed() → calls feedEngine() locally
//
// Future (API):
//   feedRepository.getFeed() → fetch('/api/feed') → server calls feedEngine()
```

---

## 6. Repository Layer (`client/repositories/feedRepository.ts`)

```typescript
// Responsibilities:
// 1. Read active cohorts from cohortStore
// 2. Flatten all seasons → lessons → chunks into FeedChunkInput[]
// 3. Read chunk progress from localStorage (key: 'sidequest_feed_progress')
// 4. Read cohort learner states from localStorage (key: 'sidequest_cohort_states')
// 5. Call feedEngine() with assembled inputs
// 6. Persist progress updates back to localStorage

// Future swap:
// Replace localStorage reads/writes with API calls.
// The feedEngine itself stays unchanged.
```

---

## 7. React Layer (`FeedProvider.tsx`)

### State Shape

```typescript
interface FeedState {
  items: FeedItem[];
  currentIndex: number;         // which card is in view
  isLoading: boolean;
  dailyProgress: { current: number; target: number; percent: number };
  sessionStats: { chunksCompleted: number; minutesWatched: number };
}
```

### Actions

```typescript
interface FeedActions {
  completeChunk: (chunkId: string) => void;
  skipChunk: (chunkId: string) => void;
  bookmarkChunk: (chunkId: string) => void;
  addNote: (chunkId: string, note: string) => void;
  nextCard: () => void;
  previousCard: () => void;
  refreshFeed: () => void;
  loadMore: () => void;
}
```

---

## 8. UI Components

### FeedCard
- Full-width card showing:
  - YouTube video embed (iframe) or thumbnail with play button
  - Chunk title + time range ("Part 2 · 3:30 – 7:00")
  - Lesson title + season badge
  - Cohort pill (cover image + title)
  - Progress ring (chunks completed in this lesson)

### FeedToolbar
- Floating bottom toolbar:
  - ✅ Complete (marks chunk done, auto-advances)
  - ⏭ Skip (marks skipped, advances)
  - 🔖 Bookmark (toggles bookmark)
  - 📝 Notes (opens note input)
  - ⚙️ Settings (playback speed, autoplay toggle)

### FeedProgress
- Top bar or sidebar widget:
  - Daily goal ring (41/60 min)
  - Session streak counter
  - Chunks completed today

### FeedQueue
- Right sidebar (desktop) or swipe-up drawer (mobile):
  - Next 5 chunks with thumbnails
  - Cohort color-coded labels

---

## 9. Route Integration

```
src/app/(dashboard)/feed/page.tsx    # NEW route
```

Add "Feed" to the sidebar navigation between "Home" and "Explore".

---

## 10. Backend Hookup Strategy (Future)

The system is designed for a clean swap:

| Layer | Current (Local) | Future (API) |
|-------|----------------|--------------|
| **Progress Storage** | `localStorage` key `sidequest_feed_progress` | `POST /api/feed/progress` → database |
| **Cohort States** | `localStorage` key `sidequest_cohort_states` | `GET /api/user/cohort-states` → user profile |
| **Feed Generation** | `feedRepository` calls `feedEngine()` directly | `GET /api/feed?size=20` → server calls `feedEngine()` |
| **Analytics** | Console log | `POST /api/feed/analytics` → event pipeline |

The `feedRepository` is the **only file that changes** when switching to API mode.
The engine, types, provider, and UI components remain identical.

---

## 11. Feed Cohorts (Real Data)

Three cohorts will be pre-registered with **real YouTube playlist data** to power the feed:

| Cohort | Sources | Expected Lessons |
|--------|---------|-----------------|
| **DSA - Only What's Needed** | 2 YouTube playlists (Kunal Kushwaha DSA + interview prep) | ~80-100 |
| **Operating Systems** | 2 single YouTube videos (OS full courses) | 2 |
| **Networking** | 1 playlist + 2 single videos | ~30-40 |

These cohorts are registered in `src/client/mock/cohorts/feedCohorts.ts` and exported
alongside the existing `cohortCatalog`. They appear as active cohorts on `/home`.

---

## 12. Implementation Phases

### Phase 1: Foundation (Current)
- [x] Create 3 real-data cohorts from YouTube playlists
- [ ] Add `feedCohorts` to cohortCatalog export
- [ ] Wire feed cohorts into `/home` active cohorts

### Phase 2: Engine & Data Layer
- [ ] Create `shared/feed/` with types + engine + scoring
- [ ] Create `feedRepository.ts` with localStorage progress tracking
- [ ] Write unit tests for feedEngine scoring

### Phase 3: UI Components
- [ ] Create `feed/` screen module with all components
- [ ] Build FeedCard with YouTube embed + chunk metadata
- [ ] Build FeedToolbar with complete/skip/bookmark actions
- [ ] Build FeedProgress with daily goal ring
- [ ] Build FeedQueue sidebar

### Phase 4: Route & Navigation
- [ ] Add `/feed` route
- [ ] Add Feed to sidebar navigation
- [ ] Connect FeedProvider to FeedRepository

### Phase 5: Polish & Backend Prep
- [ ] Add animations and transitions
- [ ] Add keyboard shortcuts (space = complete, right = skip)
- [ ] Stub out API routes for future backend
- [ ] Add feed analytics events
