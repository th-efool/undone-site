# Meta-Issue-List: Master Catalog of Overlooked Issues, Bugs & Performance Traps

This document catalogs critical overlooked bugs, architectural bottlenecks, data desynchronizations, and broken UI states across the codebase.
**Strict Mandate Followed**: No code has been modified. This list serves as an exhaustive, path-first implementation blueprint for downstream resolution.

---

## Part 1: Feed, Video Player & Exploration Subsystem

### ISSUE 1: Feed S1 VX/X Labelling Bug (Shows `V1/1, V2/2, V3/3` instead of `SX (Current Index)/(Total In Season)`)
- **DESCRIPTION**:
  In the `/play` feed viewer, the lesson badge always displays `V1/1`, `V2/2`, `V3/3`, `V4/4` where the denominator equals the numerator. It was designed to display `S{SeasonNumber} V{CurrentLessonInSeason}/{TotalLessonsInSeason}` (e.g. `S1 V2/8`). Because the backend feed delivery fails to project the season's total lesson count, the client falls back to assigning the current lesson index as the total lesson count.
- **MAIN CAUSE FILE & Description**:
  - `src/server/domain/cohort-creation/delivery-feed.ts` (lines 65–74): When querying and projecting lessons for the delivery feed, `totalLessonsInSeason` is omitted from the projected payload, or `_count: { lessons: true }` is not queried on the parent season.
  - `src/client/screens/dashboard/play/hooks/usePlayback.ts` (line 497): `totalVideos: activeItem?.totalVideos ?? (activeItem?.lessonOrder ?? 1)` defaults `totalVideos` to `activeItem.lessonOrder`, causing total videos to always equal the current video's index.
- **DEPENDENT FILES & Description**:
  - `src/shared/feed/feedEngine.ts` (line 360): Evaluates `FeedItem` metadata and expects `totalLessonsInSeason` when mapping items.
  - `src/client/screens/dashboard/play/components/LessonCard/LessonCard.tsx` (lines 27–34): Receives `lesson.totalVideos` and renders the string `V${currentVideo}/${totalVideos}`.
  - `src/client/screens/dashboard/play/PlayDesktop.tsx` (lines 142–150): Passes `lesson` model from `usePlayback` into `LessonCard`.
- **RELEVANT FILES & Description**:
  - `src/shared/feed/feedEngine.types.ts`: Defines the schema for `FeedItem` and `FeedLessonMetadata`.
  - `src/client/screens/dashboard/play/types/play.ts`: Defines `PlayLesson` interface consumed by desktop and mobile player interfaces.

---

### ISSUE 2: Chunk Completion Unexpected Feed Rewind (`completeActiveChunk` resets index to 0)
- **DESCRIPTION**:
  When a user finishes a video chunk or clicks complete, `completeActiveChunk` resets the playback index to `0` (`setCurrentIndex(0)`) and invokes `fetchChannelFeed(..., 0, ...)` from page `0`. Instead of smoothly auto-advancing the user forward to the next lesson chunk in the feed, it unexpectedly snaps and rewinds them back to the very first item in the channel feed.
- **MAIN CAUSE FILE & Description**:
  - `src/client/screens/dashboard/play/hooks/usePlayback.ts` (lines 384–398): `completeActiveChunk` explicitly executes `setCurrentIndex(0)` and re-queries `fetchChannelFeed(activeChannelRef.current, 0, searchQueryRef.current)` instead of advancing `setCurrentIndex(prev => prev + 1)` or preserving the current playlist cursor.
- **DEPENDENT FILES & Description**:
  - `src/client/screens/dashboard/play/PlayDesktop.tsx` (lines 160–180): Invokes `playback.completeActiveChunk()` upon chunk completion trigger.
  - `src/client/screens/dashboard/play/components/ReadingSurface.tsx` (lines 19–25): Calls `completeActiveChunk` when the user reaches the end of reading materials.
  - `src/client/mobile/screens/Play/PlayMobile.tsx` (lines 45–60): Mobile player triggers the same completion callback, causing mobile users to get thrown back to card 1.
- **RELEVANT FILES & Description**:
  - `src/app/api/progress/chunk/route.ts`: Endpoint recording user progress in MongoDB.
  - `src/server/domain/progress/chunkProgress.service.ts`: Backend service calculating completed chunks and progress percentages.

---

### ISSUE 3: Hardcoded Player Stats & Fake Daily Goal Percentage
- **DESCRIPTION**:
  The statistics and daily goal progress displayed in the player sidebar/toolbar are completely static and hardcoded. Every user on every channel sees `68%` daily goal reached, `3` cohorts covered, `20` chunks remaining, and `90` estimated minutes, completely decoupled from actual database progress records.
- **MAIN CAUSE FILE & Description**:
  - `src/client/screens/dashboard/play/hooks/usePlayback.ts` (lines 484–489): Hardcodes `const dailyGoalPercent = 68;` and `const stats = { cohortsCovered: 3, chunksRemaining: 20, estimatedMinutes: 90 };` directly inside the playback hook without any network or database calculation.
- **DEPENDENT FILES & Description**:
  - `src/client/screens/dashboard/play/PlayDesktop.tsx` (lines 75–80): Passes `dailyGoalPercent` and `stats` into `PlayerToolbar`.
  - `src/client/screens/dashboard/play/components/PlayerToolbar/PlayerToolbar.tsx` (lines 80–115): Displays the fake `68%` progress ring and static counts to the user.
- **RELEVANT FILES & Description**:
  - `src/server/database/mongo/models/UserChunkProgress.ts`: MongoDB model storing actual user chunk progress.
  - `src/app/api/user/cohort-config/route.ts`: User cohort configuration route that should supply personalized goal metrics.

---

### ISSUE 4: Volatile In-Memory Player Notes & Bookmarks Lost on Navigation
- **DESCRIPTION**:
  The notes editor and bookmark toggle in the video player store text and state purely in temporary React component state. When a user switches chunks, changes channels, or reloads the browser, all notes typed during the lesson disappear instantly and are never persisted to `/api/workspace/notes` or database storage.
- **MAIN CAUSE FILE & Description**:
  - `src/client/screens/dashboard/play/hooks/usePlayback.ts` (lines 480–482 & 544): `const [notesText, setNotesText] = useState('')` and `const [bookmarked, setBookmarked] = useState(false)`. The `saveNotes` function (`lines 544-545`) only updates local React state without issuing a `POST` or `PATCH` request to the backend.
- **DEPENDENT FILES & Description**:
  - `src/client/screens/dashboard/play/components/PlayerToolbar/PlayerToolbar.tsx`: Notes drawer and bookmark buttons rely on these callbacks.
  - `src/client/screens/dashboard/play/components/PlayerToolbar/components/NotesDrawer.tsx`: Renders the notes textarea that loses all user input.
- **RELEVANT FILES & Description**:
  - `src/app/api/workspace/notes/route.ts`: Backend API route with `GET` and `PATCH` methods that already exists for saving notes but is never called by the player.
  - `src/server/infrastructure/db/mongodb/repositories/workspace.repo.ts`: MongoDB workspace repository supporting user note state.

---

### ISSUE 5: `GET /api/explore` 100% Hardcoded to Mock Repository
- **DESCRIPTION**:
  The `/explore` route completely ignores all published cohorts in the PostgreSQL database. When users browse Explore, they only see mock static items generated in memory (`exploreRepo.getExplore()`). Newly published cohorts created by users never appear in Explore.
- **MAIN CAUSE FILE & Description**:
  - `src/app/api/explore/route.ts` (lines 8–15): The route handler unconditionally delegates to `exploreRepo.getExplore()` imported from `src/server/infrastructure/db/mock/repositories/explore.repo.ts` instead of querying the Prisma `cohort` table for `isPublished: true` and `visibility: 'PUBLIC'`.
- **DEPENDENT FILES & Description**:
  - `src/client/repositories/exploreRepository.ts` (lines 5–12): Fetches `/api/explore` and returns mock data to the client.
  - `src/client/screens/dashboard/explore/hooks/useExplore.ts` (lines 15–25): Powers the entire Explore dashboard using mock data.
  - `src/client/screens/dashboard/explore/ExploreDesktop.tsx` (lines 40–90): Displays mock trending quests, mock topics, and mock study rooms.
- **RELEVANT FILES & Description**:
  - `src/server/infrastructure/db/mock/repositories/explore.repo.ts`: Static mock repository containing dummy data.
  - `src/server/infrastructure/db/postgres/repositories/cohort.repo.ts`: Real PostgreSQL cohort repository that should provide published cohorts.

---

### ISSUE 6: Missing `<Suspense>` Boundary on Explore Dynamic Import Causing Layout Shift
- **DESCRIPTION**:
  The `/explore` page dynamically imports the `Explore` client component via `next/dynamic` without wrapping it in a `<Suspense>` boundary and without providing a skeleton fallback (unlike `/play` which has `<Suspense fallback={<PlaySkeleton />}>`). This leads to layout shifts, FOUC (flash of unstyled content), and hydration flickers.
- **MAIN CAUSE FILE & Description**:
  - `src/app/(dashboard)/explore/page.tsx` (lines 4 & 23–41): `const Explore = dynamic(...)` is imported, but rendered directly as `<Explore />` without `<Suspense fallback={<ExploreSkeleton />}>`.
- **DEPENDENT FILES & Description**:
  - `src/client/screens/dashboard/explore/Explore.tsx`: Main explore root client component.
  - `src/client/components/global/Skeleton`: Exports `ExploreSkeleton`, which was implemented but never hooked up to this route.
- **RELEVANT FILES & Description**:
  - `src/app/(dashboard)/play/page.tsx`: Reference implementation that correctly uses `<Suspense fallback={<PlaySkeleton />}>`.

---

### ISSUE 7: Hardcoded Mock Content & Missing Discovery Sections in Mobile Explore
- **DESCRIPTION**:
  The mobile explore screen (`ExploreMobile.tsx`) renders a hardcoded card component (`TrendingContentCard.tsx`) with static hardcoded copy ("Your Content in a Bottle", static avatars `/mock/avatars/d.webp`) and completely omits the "People Finishing", "Recently Published", and "Study Rooms" sections present on desktop.
- **MAIN CAUSE FILE & Description**:
  - `src/client/mobile/screens/Explore/components/TrendingContentCard/TrendingContentCard.tsx` (lines 1–81): Entire component contains hardcoded JSX with static labels and mock avatar images without accepting any data props from `useExplore`.
  - `src/client/mobile/screens/Explore/ExploreMobile.tsx` (lines 37–43): Renders only `<TrendingContentCard />` inside `<section className={styles.bottomSection}>`, dropping the rest of the explore dataset.
- **DEPENDENT FILES & Description**:
  - `src/client/screens/dashboard/explore/Explore.tsx` (lines 10–15): Renders `ExploreMobile` when `useExperience() === 'mobile'`.
- **RELEVANT FILES & Description**:
  - `src/client/screens/dashboard/explore/components/PeopleFinishing/PeopleFinishing.tsx`: Missing on mobile.
  - `src/client/screens/dashboard/explore/components/RecentlyPublished/RecentlyPublished.tsx`: Missing on mobile.

---

### ISSUE 8: Unhandled YouTube IFrame API Script Load Failure & Missing Non-YouTube / HLS Video Fallback
- **DESCRIPTION**:
  The video player hook strictly assumes all video lessons are hosted on YouTube. If the YouTube IFrame API script fails to load (e.g. ad blockers, network glitch), `ytApiReady` remains permanently false with no error state reported. Furthermore, if a cohort lesson contains an HLS `.m3u8` or MP4 video URL instead of a YouTube ID, the player fails to render anything because no HTML5/HLS video player fallback exists in `PlayerSurface.tsx`.
- **MAIN CAUSE FILE & Description**:
  - `src/client/screens/dashboard/play/hooks/usePlayback.ts` (lines 89–130): Loads `https://www.youtube.com/iframe_api` via a DOM script tag without an `onerror` handler to set `hasError: true`.
  - `src/client/screens/dashboard/play/components/PlayerSurface/PlayerSurface.tsx` (lines 35–65): Directly mounts `<div id="yt-player" />` and assumes all lessons have `activeItem.lessonVideoId`. Does not support `video/mp4` or HLS stream URLs.
- **DEPENDENT FILES & Description**:
  - `src/client/screens/dashboard/play/PlayDesktop.tsx`: Screen freezes or shows blank black surface when YouTube is blocked or unavailable.
  - `src/client/screens/dashboard/play/components/CinematicStage/CinematicStage.tsx`: Renders empty canvas when video player fails to mount.
- **RELEVANT FILES & Description**:
  - `src/client/screens/landing/VideoExplainer/hooks/useHlsVideo.ts`: Working HLS video hook that demonstrates how HLS/HTML5 video is handled in the landing page, but is missing in the dashboard player.

---

## Part 2: Cohort Viewer, Questline & Curriculum Subsystem

### ISSUE 9: Completely Blank `/cohort` Index Page (Empty Page Rendering Only JSON-LD)
- **DESCRIPTION**:
  Navigating to `/cohort` renders a completely blank white screen. The page component only returns a `<script type="application/ld+json">` tag with no UI elements, no header, and no redirect to `/explore` or `/home`.
- **MAIN CAUSE FILE & Description**:
  - `src/app/(dashboard)/cohort/page.tsx` (lines 18–36): `export default function cohort()` returns only `<script type="application/ld+json" ... />` inside an empty fragment `<>...</>`. It lacks both visual markup and a `redirect('/explore')`.
- **DEPENDENT FILES & Description**:
  - Any internal link, sidebar link, or direct user navigation to `/cohort`.
  - `src/middleware.ts` (line 19): Protects `/cohort`, directing authenticated users into a blank page.
- **RELEVANT FILES & Description**:
  - `src/app/(dashboard)/cohort/[cohortId]/page.tsx`: Sub-route that correctly implements redirects to `/overview`.

---

### ISSUE 10: Hardcoded Fake Rating (5.0), Fake Hall of Fame Champion ("Sia"), and Static Daily Goal
- **DESCRIPTION**:
  Every single cohort viewed in the application displays identical fake metrics: a rating of `5.0` (with 128 fake reviews), a static daily goal of `'30 mins/day'`, and a hardcoded Hall of Fame champion named `"Sia"` with avatar `/mock/avatars/sia.avif`, regardless of the cohort's actual content or author.
- **MAIN CAUSE FILE & Description**:
  - `src/server/infrastructure/db/postgres/mappers/cohortMapper.ts` (lines 79, 84, 89–93, 209–218): Unconditionally hardcodes `rating: 5`, `ratingCount: '128 reviews'`, `dailyGoal: '30 mins/day'`, and the entire `hallOfFame` object with winner `"Sia"` (`points: '4,850 XP'`).
- **DEPENDENT FILES & Description**:
  - `src/app/(dashboard)/cohort/[cohortId]/layout.tsx` (lines 54–60): Ingests the mapped cohort and passes it down to all cohort tab screens.
  - `src/client/screens/cohort/tabs/overview/Overview.tsx`: Displays the hardcoded metrics.
  - `src/client/screens/cohort/tabs/hallOfFame/components/HallOfFamePage/HallOfFamePage.tsx`: Displays the fake champion "Sia".
- **RELEVANT FILES & Description**:
  - `src/client/screens/cohort/models/cohort.ts`: Defines `CohortOverview` and `HallOfFameData` types.

---

### ISSUE 11: Dead UI Buttons & Broken Interactions in Cohort Overview & Events Tabs
- **DESCRIPTION**:
  Multiple primary action buttons across the Cohort view are completely non-interactive dead buttons with no `onClick` handlers:
  1. "View My Activity" button in the overview expedition progress card.
  2. "Quest Guide" creator contact / follow button (`creator.ctaLabel`).
  3. "View Full Calendar" button in the cohort events tab.
- **MAIN CAUSE FILE & Description**:
  - `src/client/screens/cohort/tabs/overview/components/ExpeditionProgressCard/ExpeditionProgressCard.tsx` (lines 33–38): `<button className={styles.button} type="button">View My Activity</button>` has no `onClick` attribute.
  - `src/client/screens/cohort/tabs/overview/components/QuestGuideCard/QuestGuideCard.tsx` (lines 32–37): `<button className={styles.button} type="button">{creator.ctaLabel}</button>` has no `onClick` attribute.
  - `src/client/screens/cohort/tabs/events/components/EventsPage/EventsPage.tsx` (lines 16–18): `<button className={styles.load}>View Full Calendar <span>→</span></button>` has no `onClick` attribute.
- **DEPENDENT FILES & Description**:
  - `src/client/screens/cohort/tabs/overview/Overview.tsx`: Parents the dead buttons in overview.
  - `src/client/screens/cohort/tabs/events/Events.tsx`: Parents the dead calendar button.
- **RELEVANT FILES & Description**:
  - `src/client/screens/cohort/tabs/events/components/CalendarSync/CalendarSync.tsx`: Companion calendar sync component.

---

### ISSUE 12: Empty State Deficiency & Phantom "Load More" in Cohort Archives
- **DESCRIPTION**:
  When a newly published or standard cohort has no archive field notes or community mind maps, the Archives tab renders an empty container paired with a misleading "Load More⌄" button instead of an informative empty state informing the user that no archives have been shared yet.
- **MAIN CAUSE FILE & Description**:
  - `src/client/screens/cohort/tabs/archives/components/ArchiveFeed/ArchiveFeed.tsx` (lines 6–17): Unconditionally maps `items.map(...)` without checking `items.length === 0`.
  - `src/client/screens/cohort/tabs/archives/components/ArchivesPage/ArchivesPage.tsx` (line 22): Always renders `<button className={styles.load}>Load More⌄</button>` even when `archives.items` is an empty array.
- **DEPENDENT FILES & Description**:
  - `src/client/screens/cohort/tabs/archives/Archives.tsx`: Main archives tab container.
  - `src/app/(dashboard)/cohort/[cohortId]/archives/page.tsx`: Archives route.
- **RELEVANT FILES & Description**:
  - `src/server/infrastructure/db/postgres/mappers/cohortMapper.ts` (lines 135–150): Mappers initializing empty archive items.

---

### ISSUE 13: Questline Season & Lesson Indexing Desynchronization (0-based vs 1-based)
- **DESCRIPTION**:
  In `Questline.tsx` and `LessonRow.tsx`, lesson links construct URLs using 0-based indices or DB IDs (`?lesson=${lesson.id}` or `lessonOrder`), whereas the feed player parses lessons expecting 1-based sequential indices. Furthermore, clicking a lesson in Season 2 can pass an out-of-bounds index to `/play`, causing the feed engine to fail to highlight the chosen lesson.
- **MAIN CAUSE FILE & Description**:
  - `src/client/screens/cohort/tabs/questline/components/LessonRow/LessonRow.tsx` (lines 24–38): Generates navigation href `/play?cohort=${cohortId}&lesson=${lesson.order}` where `lesson.order` can be 0-based while `/play` expects 1-based indexes.
  - `src/server/domain/cohort-creation/delivery-feed.ts` (lines 45–55): Lessons are indexed starting at 0 in some pipelines and 1 in others.
- **DEPENDENT FILES & Description**:
  - `src/client/screens/dashboard/play/hooks/usePlayback.ts` (lines 180–210): Parses `lesson` query parameter from URL and attempts to match against `item.lessonOrder`.
  - `src/client/screens/cohort/tabs/questline/Questline.tsx`: Questline curriculum tree.
- **RELEVANT FILES & Description**:
  - `src/shared/feed/feedEngine.ts`: Logic that filters and orders feed items based on target lesson parameters.

---

## Part 3: Community, Study Room & Workspace Subsystem

### ISSUE 14: Messaging Subsystem Disconnected from Database (Relies on `localStorage` & Mocks)
- **DESCRIPTION**:
  The entire social messaging and community chat feature (`useMessage.ts`) is completely decoupled from the PostgreSQL database. It writes messages to client `localStorage` keys (`sidequest-community-messages`, `sidequest-dm-messages`) and loads from static template mocks (`communityMapping.ts`). It completely ignores the backend API route `POST /api/community/channels/[channelId]/messages`, meaning messages never persist across devices or users.
- **MAIN CAUSE FILE & Description**:
  - `src/client/screens/dashboard/message/hooks/useMessage.ts` (lines 33–37 & 789–820): Loads initial state from `localStorage.getItem(STORAGE_KEY_COMMUNITY_MESSAGES)` and uses `messagesRepository.getEnrolledCohorts()` which returns mock data from `homeRepository.getHome()`. Does not make HTTP requests to `/api/community/**`.
- **DEPENDENT FILES & Description**:
  - `src/client/screens/dashboard/message/components/CommunityChat/CommunityChat.tsx`: Chat window where sent messages are only saved locally.
  - `src/client/screens/dashboard/message/components/DMConversation/DMConversation.tsx`: DM chat window disconnected from real accounts.
  - `src/client/screens/dashboard/message/Message.tsx`: Main message screen.
- **RELEVANT FILES & Description**:
  - `src/app/api/community/channels/[channelId]/messages/route.ts`: Real PostgreSQL message API route that is completely bypassed.
  - `prisma/schema.prisma` (lines 535–565): Defines `Community`, `Channel`, and `Message` models.

---

### ISSUE 15: Dead Action Buttons in Messaging Screen
- **DESCRIPTION**:
  Several prominent controls in the Community and Message interfaces are dead buttons with missing click handlers:
  1. "Mark all as read" in the recent messages center list.
  2. "See all" in the Friends Online sidebar list.
  3. Channel category tabs in `ChannelTabs.tsx` do not switch the active channel.
- **MAIN CAUSE FILE & Description**:
  - `src/client/screens/dashboard/message/components/Center/RecentMessages/RecentMessages.tsx` (line 13): `<button type="button" className={styles.markRead}>Mark all as read</button>` has no `onClick` handler.
  - `src/client/screens/dashboard/message/components/RightSidebar/FriendsOnline/FriendsOnline.tsx` (line 12): `<button type="button" className={styles.seeAll}>See all</button>` has no `onClick` handler.
  - `src/client/screens/dashboard/message/components/CommunityChat/components/ChannelTabs/ChannelTabs.tsx` (line 12): Channel tab buttons do not trigger channel selection changes.
- **DEPENDENT FILES & Description**:
  - `src/client/screens/dashboard/message/components/Center/Center.tsx`: Center panel of message screen.
  - `src/client/screens/dashboard/message/components/RightSidebar/RightSidebar.tsx`: Right sidebar of message screen.
- **RELEVANT FILES & Description**:
  - `src/client/screens/dashboard/message/models/message.ts`: Types for conversations, channels, and friends online.

---

### ISSUE 16: Kanban Board Event Listener Memory Leak & Mobile Double Execution
- **DESCRIPTION**:
  The `NotesKanban` component in `packages/notes-board` suffers from an uncleaned event listener leak. The `ColIdInjector` effect runs on every single render without a dependency array, attaching duplicate event listeners to the DOM. Additionally, registering both `click` and `touchend` causes double execution and accidental card opens on mobile devices.
- **MAIN CAUSE FILE & Description**:
  - `packages/notes-board/src/NotesKanban/NotesKanban.tsx` (lines 308–336):
    ```tsx
    useEffect(() => {
      // Missing dependency array: executes on every single component render!
      const handlePointer = (e: MouseEvent | TouchEvent) => { ... };
      document.addEventListener('click', handlePointer);
      document.addEventListener('touchend', handlePointer);
    });
    ```
- **DEPENDENT FILES & Description**:
  - `packages/notes-board/src/NotesKanban/NotesKanban.tsx`: Kanban workspace component.
  - `src/client/screens/dashboard/notes/components/NotesWorkspace.tsx`: Host component rendering the notes board.
- **RELEVANT FILES & Description**:
  - `src/app/(dashboard)/notes/page.tsx`: Notes page route.

---

### ISSUE 17: Study Room Seed-On-Read & Concurrency Race Condition in Join Logic
- **DESCRIPTION**:
  The study room API executes a database seed routine (`seedRooms()`) on every single `GET /api/studyroom` request, triggering redundant database insertions if rooms are empty. When users join a room via `POST`, the endpoint performs 6 non-transactional read-then-write Prisma queries, resulting in participant count desynchronization and race conditions under concurrent joins.
- **MAIN CAUSE FILE & Description**:
  - `src/app/api/studyroom/route.ts` (lines 6–73): `GET` calls `seedRooms()` whenever room count is 0 without atomic locking. `POST` join flow runs `findUnique`, `deleteMany`, `create`, `count`, and `update` across multiple queries outside a `$transaction`.
  - `src/server/infrastructure/db/postgres/repositories/studyRoom.repo.ts` (lines 24–35): Repository lacks isolation for concurrent participants joining simultaneously.
- **DEPENDENT FILES & Description**:
  - `src/client/screens/dashboard/studyroom/StudyRoomScreen.tsx`: Client screen displaying active rooms and participant counts.
  - `src/client/screens/dashboard/explore/components/StudyRooms/StudyRooms.tsx`: Explore widget showing live study room counts.
- **RELEVANT FILES & Description**:
  - `prisma/schema.prisma` (lines 569–595): `StudyRoom` and `RoomParticipant` models.

---

### ISSUE 18: Unstyled Plain-Text Loading State in Notes Workspace
- **DESCRIPTION**:
  When navigating to `/notes`, users encounter an unstyled, raw HTML `<div>Loading...</div>` text flash instead of a themed skeleton loader matching the rest of the application.
- **MAIN CAUSE FILE & Description**:
  - `src/app/(dashboard)/notes/page.tsx` (line 38): Implements `<Suspense fallback={<div>Loading...</div>}>` rather than utilizing the application's dedicated design system skeleton components.
- **DEPENDENT FILES & Description**:
  - `src/client/screens/dashboard/notes/Notes.tsx`: Dynamic client component loaded inside the fallback.
- **RELEVANT FILES & Description**:
  - `src/client/components/global/Skeleton`: Repository of designed skeleton loaders.

---

## Part 4: Backend Architecture, Worker Latency & Silent Traps

### ISSUE 19: Per-Request Catalog DDL & Advisory Lock Inside Intake Transactions
- **DESCRIPTION**:
  Every single cohort intake request (`POST /api/cohort-builder/intake`) acquires an advisory transaction lock and performs 6+ catalog inspection queries (`information_schema.tables`, `pg_constraint`, `pg_get_constraintdef`) followed by dynamic DDL (`ensureJourneyStageSchema` and `assertTextJobSchema`). This adds **+30ms to 150ms of artificial latency** to every user request and creates severe lock contention under concurrent traffic.
- **MAIN CAUSE FILE & Description**:
  - `src/server/infrastructure/db/postgres/cohort-intake.ts` (lines 27–28): Inside `prisma.$transaction(async tx => ...)`, it calls `ensureJourneyStageSchema(sql)` and `assertTextJobSchema(sql)`.
  - `src/server/domain/cohort-builder/text-schema-readiness.ts` (lines 3–103): Runs catalog introspection queries against PostgreSQL system tables on every request instead of relying on standard migration scripts (`prisma migrate`).
- **DEPENDENT FILES & Description**:
  - `src/app/api/cohort-builder/intake/route.ts` (line 32): Main intake endpoint called when a user submits a prompt on the landing page or creator.
  - `src/client/screens/landing/Hero/components/CentralInterface.tsx`: User interface blocked by the delayed intake response.
- **RELEVANT FILES & Description**:
  - `prisma/migrations/**`: Directory where database schema should be managed deterministically.

---

### ISSUE 20: Non-Existent Gemini Model ID & Latency Degradation in Vector Scoring
- **DESCRIPTION**:
  The cohort vectorization workflow hardcodes an invalid model ID `'gemini-3.8-flash'`. Every call to this service fails with an HTTP 404 error from Google AI, incurring a 500ms to 3,000ms timeout/error cycle before silently degrading to a naive keyword-counting fallback.
- **MAIN CAUSE FILE & Description**:
  - `src/server/domain/cohort/vectorScoring.service.ts` (lines 51 & 139–143):
    ```ts
    const model = google('gemini-3.8-flash'); // Invalid model name; does not exist in Gemini API!
    ```
    The catch block catches the error and silently falls back to basic regex term frequency, degrading pedagogical scoring quality without alerting developers.
- **DEPENDENT FILES & Description**:
  - `src/app/api/cohort/publish/route.ts`: Publishing a cohort runs this workflow, suffering latency penalties.
  - `src/server/infrastructure/workflows/cohortVectorizationWorkflow.ts`: Workflow responsible for embedding curriculum chunks.
- **RELEVANT FILES & Description**:
  - `src/server/infrastructure/ai/modelRegistry.ts`: Central model registry that defines valid models (`DEFAULT_COHORT_MODEL = 'gemini-3.1-flash-lite'`), which was bypassed here.

---

### ISSUE 21: N+1 Storage Cascades & Multi-DB Roundtrips During Draft & Content Ingestion
- **DESCRIPTION**:
  Reading creation artifacts executes an extreme N+1 cascade across both PostgreSQL and MongoDB GridFS. Each call to `ref() + getJSON()` performs 4 PostgreSQL queries, 2 MongoDB queries, and 2 synchronous SHA-256 integrity calculations. For a draft with 20 partitions, reading the draft triggers **over 240 sequential roundtrips**, adding 800ms to 2,500ms of backend latency.
- **MAIN CAUSE FILE & Description**:
  - `src/server/infrastructure/storage/creation.store.ts` (lines 86–121 & 165–177): `getJSON` verifies scope, reads metadata, updates reference timestamp, verifies checksum, downloads bytes from GridFS, and then parses and re-hashes the payload on every single partition call.
  - `src/server/infrastructure/storage/creation.gridfs.ts` (lines 18–26): `ownedFile()` performs a lookup on MongoDB for every single object read.
- **DEPENDENT FILES & Description**:
  - `src/server/domain/cohort-creation/analysis-content.service.ts`: Suffers cascading delay when loading analysis preview.
  - `src/server/domain/cohort-creation/building-content.service.ts`: Suffers cascading delay when generating curriculum.
  - `src/server/domain/cohort-creation/chunking-content.service.ts`: Suffers cascading delay during chunk verification.
- **RELEVANT FILES & Description**:
  - `src/server/infrastructure/storage/creation.contracts.ts`: Storage limits and record contracts.

---

### ISSUE 22: Unbounded Channel Messages Fetch Without Pagination
- **DESCRIPTION**:
  The community repository query for channel messages loads the complete message history with no `take` limit, and eagerly fetches all columns of the `User` author model. As community channels grow, this will cause memory spikes, slow queries, and eventual OOM crashes.
- **MAIN CAUSE FILE & Description**:
  - `src/server/infrastructure/db/postgres/repositories/community.repo.ts` (lines 4–19):
    ```ts
    prisma.message.findMany({
      where: { channelId },
      include: { author: true }, // Eagerly loads entire User record including sensitive/unneeded fields
      orderBy: { createdAt: 'asc' },
      // OMITTED: take, skip, or cursor pagination!
    });
    ```
- **DEPENDENT FILES & Description**:
  - `src/app/api/community/channels/[channelId]/messages/route.ts` (lines 10–25): Endpoint returning unbounded message lists.
- **RELEVANT FILES & Description**:
  - `prisma/schema.prisma`: Schema defining `Message` and `User` relations.

---

### ISSUE 23: Per-Request DDL Constraint Checks in Source Management
- **DESCRIPTION**:
  Every request to list sources, upload a PDF, or commit an action in the cohort builder runs `assertSourceSchema(sql)`, querying PostgreSQL's `pg_constraint` catalog table inside open `FOR UPDATE` transactions, artificially serializing workspace operations.
- **MAIN CAUSE FILE & Description**:
  - `src/server/domain/cohort-builder/source-policy.ts` (lines 13–19 & 29): Executes `pg_get_constraintdef` queries inside the interactive database transaction on every source-related action.
- **DEPENDENT FILES & Description**:
  - `src/app/api/cohort-builder/workspaces/[workspaceId]/sources/route.ts`: Source listing route.
  - `src/server/infrastructure/db/postgres/cohort-pdf-upload.ts`: PDF upload handler.
  - `src/server/infrastructure/db/postgres/repositories/interaction.repo.ts` (line 435): Action commit handler.
- **RELEVANT FILES & Description**:
  - `src/server/domain/cohort-builder/workspace-export.ts`: Workspace serialization utilities.

---

## Part 5: AI Interaction & Cohort Creation Subsystem

### ISSUE 24: Unformatted Raw Markdown & Lack of Chat Sanitization in Cohort Builder
- **DESCRIPTION**:
  In the cohort builder chat pane (`ChatPane.tsx`), assistant responses are rendered as unformatted plain text. Markdown headings, bullet points, bold text, and code snippets generated by the AI are displayed raw without markdown parsing. The UI also lacks modern streaming indicators and displays confusing technical messages like "message queued".
- **MAIN CAUSE FILE & Description**:
  - `src/client/screens/cohortBuilder/ChatPane.tsx` (lines 140–210): Renders message content inside a plain `<div>` or `<p>` without a markdown parser (e.g. `react-markdown`) or syntax highlighter. Displays raw status strings like `"queued"` and `"running"` directly to the user.
- **DEPENDENT FILES & Description**:
  - `src/client/screens/cohortBuilder/CohortInteractionScreen.tsx`: Host screen for the interaction builder.
  - `src/client/screens/cohortBuilder/CohortWorkspacePane.tsx`: Adjacent workspace pane that fails to update in response to chat instructions.
- **RELEVANT FILES & Description**:
  - `src/client/screens/cohortBuilder/CohortBuilder.module.css`: CSS styling for the chat pane.

---

### ISSUE 25: AI Intake Error Transparency & Unstyled Source Text Input
- **DESCRIPTION**:
  On the landing page hero (`CentralInterface.tsx`), when a user pastes external source material or encounters an intake error, the interface displays an unstyled HTML `<textarea>` and raw error strings without proper validation feedback or guidance.
- **MAIN CAUSE FILE & Description**:
  - `src/client/screens/landing/Hero/components/CentralInterface.tsx` (lines 236–241): Renders an inline unstyled `<textarea aria-label="Paste source text" ... style={{ width: '100%', minHeight: 120 }} />` and `<p role="alert">{intakeError}</p>` lacking design tokens, animations, or clear remediation steps.
- **DEPENDENT FILES & Description**:
  - `src/client/screens/landing/Hero/Hero.tsx`: Landing page hero wrapper.
- **RELEVANT FILES & Description**:
  - `src/client/screens/cohortBuilder/intake-draft.ts`: Client-side intake draft persistence.

---

### ISSUE 26: Incoherent Intermediate Logs & Pipeline Premature Jumps in Cohort Creation
- **DESCRIPTION**:
  During the cohort generation workflow, the UI displays raw, incoherent technical log messages to the user during Step 1 (Understanding Step). After this step, the UI abruptly jumps straight to the completion page, completely bypassing the user-facing visualizations for Step 2 (Chunking) and Step 3 (Understanding Each Piece / Vector Scoring), and uses the raw user prompt as the cohort title.
- **MAIN CAUSE FILE & Description**:
  - `src/client/screens/cohortCreation/components/UnderstandingProgress.tsx` (lines 40–90): Dumps unparsed raw backend event logs directly into the user viewport.
  - `src/server/domain/cohort-creation/building-content.service.ts` (lines 57–59): Sets cohort description to `state.result.intent.rawQuery` and title to the raw topic without creating a synthesized editorial title/description during Step 1.
  - `src/client/screens/cohortCreation/hooks/useCreation.ts` (lines 110–165): Fails to pause and render intermediate visual review stages for Chunking and Piece Scoring, auto-transitioning directly from understanding to build completion.
- **DEPENDENT FILES & Description**:
  - `src/app/(creation)/quest/draft/[draftId]/page.tsx`: Route hosting the 4-step creation journey.
  - `src/client/screens/cohortCreation/components/StartingWorkspace.tsx`: Multi-step wizard wrapper.
- **RELEVANT FILES & Description**:
  - `docs/FLOW_OF_SOLUTION.md`: Architecture specification defining the intended 4-step creation experience.
