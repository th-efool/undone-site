# How Undone works

A field guide to the code behind cohort creation, the AI builder, discovery, Feed, Play, Home, Notes, sign-in, and storage. Based on the working checkout on November 5, 2026 (base commit `3aab4162`). Examples use imaginary users and content. Paths start at the repository root. This describes the implementation in the checkout. Live deployment settings and provider availability need a separate check.

**If you only have ten minutes**, read [the map](#1-the-map), [one creation request](#2-create-a-quest-from-one-request), and [one completion](#7-play-one-chunk-and-follow-the-write). Those three explain how a sentence you type becomes something a learner can finish.

[Builder chat](#3-what-the-ai-builder-actually-does) · [Processing and release](#4-how-source-material-becomes-playable) · [Explore and enrollment](#5-explore-a-cohort-and-join-it) · [Feed ranking](#6-how-feed-chooses-your-next-item) · [Home](#8-how-home-calculates-your-dashboard) · [Notes](#9-notes-from-keystroke-to-github) · [Auth](#10-who-is-making-the-request) · [Database map](#11-where-the-data-lives) · [Debugging exercises](#12-learn-it-by-tracing-it)

## 1. The map

Imagine you make a course about SQL joins using one video. You chat about the audience, add the video, approve a curriculum, and publish. Tomorrow someone watches part of that video. Four different objects have existed by then.

| Object | What it represents | Who reads it |
|---|---|---|
| Workspace | The creator's editable draft, including intent, sources, lessons under construction, processing state and release information | Builder screen, interaction worker, release service |
| Published cohort | The learner-facing course, organized into seasons and lessons | Cohort pages, catalog, Home and Feed |
| Chunk | An individually addressable piece of a lesson. A video chunk can point to a playable interval within the original video | Feed ranks it. Play presents it |
| Chunk progress | A particular learner's status for that piece, with its chunk, lesson and cohort IDs | Feed selects future items. Home derives lesson completion |

That separation explains why editing a draft, seeing a published card, and getting an item in your feed are three different milestones.

```text
Creator's browser
    -> Next.js intake or interaction API -> PostgreSQL workspace, request and event records
                                               ^             |
                                               |             v
                                      interaction worker -> AI provider / source adapters
                                               |
                                       accepted draft changes
                                               |
                                      explicit release transaction
                                               v
PostgreSQL Cohort -> Season -> Lesson -> retained chunks
                                |
                     authorized catalog + learner's MongoDB settings/progress
                                v
                         ranked /api/feed items -> Play
                                                    |
                                            /api/progress/chunk
                                                    v
                                       MongoDB UserChunkProgress -> Home

Notes editor -> browser IndexedDB + pending changes -> optional GitHub repository
            -> compatibility notes API after the local save
```

**How to read the folders.** Next.js maps files in `src/app` to URLs. A `page.tsx` starts a screen. A `route.ts` handles an HTTP request. Parenthesized folders such as `(dashboard)` organize files and disappear from the URL. Square brackets such as `[workspaceId]` capture a URL value. A page can read the database on the server and pass results to a React component, as Home does. Other pages mount a client component that fetches JSON later, as Play does. This matters when looking in the browser's Network panel.

| Folder | Reason to open it |
|---|---|
| `src/client` | Find the button, screen, React hook or browser storage code. A hook such as `usePlayback` coordinates state across renders. |
| `src/app/api` | See the accepted request, session check, validation and HTTP response. |
| `src/server/domain` | Read product rules such as who may open a cohort or how a lesson counts as complete. |
| `src/server/infrastructure` | Find the concrete PostgreSQL, MongoDB, auth or AI integration. A repository wraps reads and writes to a store. |
| `src/shared` | Find types, validation schemas and algorithms reused across boundaries. The Zod schemas also check values at runtime. |
| `packages/interaction-builder` | Reusable workspace, action, event and AI-run machinery. Undone supplies the cohort-specific rules. |
| `prisma/schema.prisma`, `prisma/sql` | Relational models and additional SQL definitions. Some worker and release operations use SQL directly. |

**What runs locally.** The root package targets Node 24. `npm run dev` invokes `scripts/dev.mjs`, builds missing local package distributions, starts Next.js with webpack and launches separate creation and interaction workers. `npm run dev:bare` starts the web process alone. A worker is a process that claims saved work and executes it after the originating HTTP request. This is why a page can load while generated results are still pending. See [the launcher](../../scripts/dev.mjs) and [package scripts](../../package.json).

## 2. Create a quest from one request

Start with “Teach SQL joins to a designer” and choose **Plan**. Follow the same sentence through these five places.

1. **Entry.** `/create-cohort` and `/quest/new` redirect to `/quest/start`. The start page resolves a creation owner and renders `CohortIntakeScreen`. The feature gate requires `INTERACTION_COHORT_V2_ENABLED=1`; if an owner allowlist is configured it also checks the owner. A signed-in user can therefore see different availability across environments. [Start page](../../src/app/%28creation%29/quest/start/page.tsx) · [Gate and input schema](../../src/shared/cohort-builder/intake.ts)
2. **Compose.** The global `LearningPromptBar` restores the browser draft after mount, gathers the text, mode and attachments, and preserves a request ID for submission. Link and file handling lives under `src/client/components/global/Composer`. The intake accepts a UUID request ID, a trimmed prompt of 1–4,000 characters, a mode, and up to 100 sources. Search is the schema default. The client budgets extracted text separately from the server's 3,500,000-byte streamed request cap. [Composer](../../src/client/components/global/LearningPromptBar/LearningPromptBar.tsx) · [HTTP intake](../../src/app/api/cohort-builder/intake/route.ts)
3. **Commit.** `acceptCohortIntake` derives the workspace ID from the owner and request ID, hashes the submitted body, and takes a PostgreSQL transaction lock for that workspace. The transaction creates the initial snapshot, records the first user message and source references, schedules the relevant initial work, and saves the receipt. The same request ID and body recover the earlier response. Reusing the ID with changed content raises `IDEMPOTENCY_MISMATCH`. This makes a retry after a lost response safe. Intake requires the durable text driver. [Intake transaction](../../src/server/infrastructure/db/postgres/cohort-intake.ts)
4. **Branch.** With the journey enabled, Plan creates a snapshot at `chat` and schedules an assistant run. Search starts at `recommendations` and enqueues a journey job keyed to the intent. Both start with an empty lesson list. A recommendations job can consult the catalog and the recommendation service. Discovery has its own job keyed to intent version and generation. [Initial state](../../src/shared/cohort-builder/intake.ts) · [Journey job plan](../../src/server/domain/cohort-builder/journey-job-plan.ts)
5. **Reopen.** `/quest/build/[workspaceId]` validates the UUID, resolves the owner, loads an owner-scoped workspace, attempts a worker wake-up, then passes its snapshot and revision into `CohortInteractionScreen`. Reloading gets the saved draft. A missing workspace or another owner's ID leads to a missing-page response. The older `/quest/draft/[draftId]` entry redirects to the start screen. [Build page](../../src/app/%28creation%29/quest/build/%5BworkspaceId%5D/page.tsx)

**What happens to an attachment?** A URL tells the composer which extractor to run. PDFs use PDF.js in the browser for page text and a preview. GitHub extraction reads a bounded selection of repository files. Web extraction combines a server HTML proxy with browser parsing. YouTube uses the transcript import endpoint when captions are available. Its client fallback can supply metadata and estimated chapter intervals, which carry a different evidence quality from real timestamped captions. A scanned PDF without usable text can fail extraction. Later processing uses the source's recorded evidence and provenance to determine what can become a lesson. To investigate a bad source, inspect the extracted content before changing an AI prompt. [Extractors](../../src/client/lib/sourceExtractors) · [Attachment state](../../src/client/components/global/Composer/useComposerAttachments.ts)

## 3. What the AI builder actually does

Suppose the next message is “Add a short practice lesson about left joins.” There are two things to look for afterward. One is the assistant's reply in the transcript. The other is an actual lesson in the workspace snapshot. They have separate persistence paths.

**The HTTP side.** The browser sends the turn under `/api/interaction/v1/workspaces/{id}/messages`. The Next catch-all route delegates to `handleInteractionRequest`, which checks the origin for POSTs and supplies an owner resolver and the registered cohort domain to the package HTTP adapter. The adapter selects an explicit handler. Actions, messages, runs, proposals and events each have their own operation. A scheduled assistant run can return HTTP 202 with a run ID. A full waiting queue or an exhausted budget can return 429. [App runtime](../../src/server/interaction.runtime.ts) · [Package route table](../../packages/interaction-builder/src/adapters/http/index.ts)

**The worker side.** `runInteractionWorkerLoop` claims a queued run, loads its workspace context and selection, builds the available tools, and passes these to the package runner and model adapter. The chat adapter uses `COHORT_CHAT_MODEL` or its configured code default, allows 1,200 output tokens and a 20-second timeout, and disables SDK retries for that invocation. Worker-level recovery and provider retries are separate mechanisms. Logs named `run_claimed`, `model_started`, `model_completed` and `model_failed` let you follow the same run ID through the boundary. When there is no pending interactive run, the worker can tick background processing. [Worker](../../src/server/interaction-worker.ts) · [Model adapter](../../src/server/infrastructure/ai/interactionModel.ts) · [Runner](../../packages/interaction-builder/src/runtime/runner.ts)

**What the model can change.** The model gets selected context and named tools. For example, it can request a curriculum draft, update the audience or edit presentation fields. Cohort-specific tools turn those requests into typed actions. The registered domain uses `planCohortAction` to decide whether an action is valid and how the snapshot should change. The repository commits an action against its expected revision. If two tabs both read revision 7 and one changes the workspace, the other's revision-7 edit can be rejected. The action path carries request identity so retries can be recognized. A multi-lesson draft uses ordered `add_lesson` commits. If the third addition fails, inspect the first two committed lessons before retrying. [Context](../../src/server/domain/cohort-builder/context.ts) · [Tools](../../src/server/domain/cohort-builder/tools.ts) · [Domain rules and schemas](../../src/shared/cohort-builder/contracts.ts)

**How the browser catches up.** A snapshot is the current whole draft. Its revision identifies the version you edited. An event is an ordered record of something that happened. The events endpoint accepts a sequence cursor through `after` or `Last-Event-ID` and can return JSON or a server-sent event stream (SSE), a long-lived HTTP response. The server serializes events to the wire format consumed by the client. Separately, the activity endpoint supplies turn details for the assistant UI and supports conditional reads. A 304 means the client may reuse its earlier response. If the database has a newer revision while the screen lags, check event serialization, the last sequence received, and the snapshot after reload. [Event handlers](../../packages/interaction-builder/src/runtime/handlers.ts) · [Activity hook](../../src/client/screens/cohortBuilder/useAssistantActivity.ts)

**Why there are so many stage screens.** The journey has named steps including `chat`, `recommendations`, `starting_point`, `material_input`, `discovery`, `goal_setup`, `processing`, `ready`, `review` and `published`. These form branches. A creator bringing material, looking for material, or starting with a goal supplies different inputs. `CohortWorkspacePane` also lets you inspect saved processing stages. The stage currently displayed can therefore differ from the step the worker is executing. [Workspace pane](../../src/client/screens/cohortBuilder/CohortWorkspacePane.tsx) · [Journey contract](../../src/shared/cohort-builder/contracts.ts)

**Why a successful request can still look stuck.** Accepting work and running it are separate operations. In a database-backed environment the dispatcher can schedule a bounded worker loop after a request. On Vercel with the durable driver it also reserves a short-lived dispatch record and starts a workflow. Locally the dev launcher runs a polling worker. Follow the chain in order: request receipt → run/job status → worker claim → model/tool result → accepted revision → browser event. Each observation rules out a different cause. [Dispatcher](../../src/server/interaction-dispatch.runtime.ts)

## 4. How source material becomes playable

A user message can change a title in one turn. Turning a source into learnable content takes several jobs. The job plan is a directed acyclic graph (DAG). An arrow means that a later job depends on the output of an earlier one. Several sources can have separate chains before their results meet in assembly.

| Stage | What to look for |
|---|---|
| Acquisition | A retained input for the specific source version. This is where to start when a URL or source provider fails. |
| Extraction, when required | Usable text or observations and any trustworthy timing or location information. |
| Understanding | A per-source representation derived from the evidence and used by later stages. |
| Chunking | Bounded evidence units with identifiers and coverage that later analysis can reference. |
| Analysis | Per-unit analysis used to describe, score and project the material. |
| Assembly | The combined learner lesson projection built from accepted upstream artifacts. |

A **job** says what must run. An **artifact** is the saved result. A **lease** gives one worker temporary authority to finish a job. Acceptance checks the lease, source version and prerequisites while holding the relevant database locks. It commits the intermediate snapshot and job status together. Assembly has its own acceptance path and checks the final projection before advancing to ready. Imagine replacing the SQL video while the previous analysis is still running. The old worker can produce an answer, but that answer must pass the current graph's checks to enter the draft. [Job plan](../../src/server/domain/cohort-builder/text-job-plan.ts) · [Per-source acceptance](../../src/server/domain/cohort-builder/text-job-acceptance.ts) · [Assembly acceptance](../../src/server/domain/cohort-builder/text-assembly-acceptance.ts)

**Concrete video example.** One video can become one learner lesson containing multiple ordered parts. Timed observations are grouped toward roughly one minute, subject to evidence byte limits and the final remainder. The system tracks evidence boundaries separately from playback boundaries. Playback can bridge observation gaps and include up to 15 seconds of overlap before the next part, while the retained source text still has its original coverage. If two adjacent player items repeat a few seconds, compare these two sets of boundaries before blaming transcript duplication. [Shared pipeline](../../src/shared/cohort-builder/client-pipeline.ts) · [Metadata and timing helpers](../../src/shared/cohort-builder/cohort-metadata.ts) · [Delivery projection](../../src/shared/cohort-builder/delivery.ts)

**Release is the handoff to learners.** The workspace release endpoint calls `releaseWorkspace` for `private_activation` or `public_publish`. Inside one PostgreSQL transaction it locks the workspace, checks ownership, lifecycle and the supplied expected revision, validates readiness, and freezes the candidate. It materializes the learner records, persists the release receipt, and updates the snapshot and event sequence. A matching completed release can return the existing receipt. It also guards against downgrading an already public cohort through private activation. For a report that “Publish worked but Feed is empty,” first find the receipt's cohort ID, then inspect its published lessons and retained chunks. [Release service](../../src/server/domain/cohort-builder/release-service.ts) · [Learner record writer](../../src/server/domain/cohort-builder/delivery.adapter.ts)

## 5. Explore a cohort and join it

`/explore` is a discovery screen. `GET /api/explore` reads up to 12 published public cohorts in descending update order, selects creator and membership counts, then maps the rows into cards. The implementation blends these with starter content and can serve the starter collection when the database query returns zero rows. Seeing an Explore card by itself is therefore insufficient evidence that a matching SQL lesson exists. Successful catalog responses permit shared caching for 60 seconds and stale revalidation for 300 seconds. [Explore endpoint](../../src/app/api/explore/route.ts)

A cohort's learner-facing entry is `/cohort/[cohortId]`, with subpages including overview and questline. Three questions have distinct answers. **Published?** The course has been released for learners. **Visible to this user?** The access policy permits a creator to read their own work, public published content to be read publicly, and members to read eligible private or invite-only published cohorts. **Enrolled?** A membership links a specific user to a cohort. Signed-in users can self-enroll in public published courses. Restricted courses ordinarily require invitation. The feed additionally requires published lessons and published parent cohorts. [Cohort pages](../../src/app/%28dashboard%29/cohort/%5BcohortId%5D) · [Access policy](../../src/server/domain/cohort/cohortAccessPolicy.ts) · [Join and leave route](../../src/app/api/cohort/%5Bid%5D/join/route.ts)

## 6. How Feed chooses your next item

Feed answers “which **chunks** should this person see, in which order?” It runs in two halves. The route assembles trustworthy inputs from stores. The shared engine ranks those inputs in memory. To investigate missing content, start with the first half. To investigate odd ordering among eligible items, start with the second.

1. **Build the catalog.** `loadAuthorizedFeedCatalog` scans SQL lessons in batches of 100 by ID. It filters published lessons with chunk data under accessible published cohorts, optionally narrowing to a requested cohort or lesson. `deliveryFeedChunks` translates saved lesson data into candidate feed items and reports rejected deliveries. If all available deliveries are malformed the endpoint can return 503. A requested chunk absent from the authorized catalog can return 404. [Catalog query](../../src/server/domain/feed/feedCatalog.ts) · [Delivery reader](../../src/server/domain/cohort-creation/delivery-feed.ts)
2. **Add the learner.** The route reads authenticated progress, cohort settings and, when needed, stored channel preferences from MongoDB. It matches progress to the chunk's cohort and lesson and handles paused/hidden configurations. A failed required personal read produces 503 with `no-store`. Extra cohort/chunk vectors are optional enrichment and have a fallback to available delivery vectors. Thus a Mongo failure can have different user-visible effects depending on which read failed. [Feed route](../../src/app/api/feed/route.ts)
3. **Choose candidates.** The engine groups by lesson and sorts by chunk order. On a sequential path a “frontier” is the next unfinished, unserved piece of the lesson. Some channels and search allow candidates deeper inside the lesson. An explicit replay can bring a completed chunk back into consideration. Previously served IDs are excluded from continuation. [Engine](../../src/shared/feed/feedEngine.ts)
4. **Score.** A vector here is a list of 12 instructional characteristics such as pace, novelty and visual dependence. The engine compares the channel target with the chunk and broader material. With both vectors available the mix is 75% chunk and 25% broader material. It calculates `12 × hybridVectorScore + heuristic.score + bonus`. Bonuses account for channel fit, duration, search terms, in-progress work and explicit selection. The query matcher examines titles and content for terms. Quick favors shorter pieces; Listen penalizes high visual dependence; Build rewards practical and interactive material. [Score inputs](../../src/shared/feed/feedScoring.ts) · [Formula and channel rules](../../src/shared/feed/feedEngine.ts)
5. **Order and return.** After sorting by score the engine interleaves lessons and cohorts where alternatives exist. An eligible explicitly requested chunk is placed first. The response includes `items`, `hasMore`, daily goal progress and summary stats. The continuation protocol posts `excludeChunkIds` (up to 5,000). Changing progress or preferences can rearrange results, which is why a simple “page 2” offset could repeat or skip content. [Request contract](../../src/shared/feed/feedRequest.ts)

**Try predicting it.** Suppose lesson A has chunks A1, A2 and A3. A1 is complete. In the default linear case A2 is the next candidate. A continuation that already served A2 can advance to A3. An explicit replay of A1 can place A1 first. If the learner cannot access lesson A, the catalog excludes it before any of these scoring rules run.

## 7. Play one chunk and follow the write

`/play` mounts `Play`, which calls `usePlayback()` and passes the resulting state and commands to `PlayDesktop` or `PlayMobile`. The fallback uses an initial playback state. For a deep link the hook reads `cohort`, `lessonId` or `lesson`, `chunk`, and `q`. For example, `/play?cohort=C&lesson=L&chunk=A2` selects a specific item when those IDs exist and access permits it. [Page](../../src/app/%28dashboard%29/play/page.tsx) · [Screen switch](../../src/client/screens/dashboard/play/Play.tsx) · [Playback hook](../../src/client/screens/dashboard/play/hooks/usePlayback.ts)

**Queue state.** Each channel tracks items, current index, served chunk IDs, preferences, fetching state and errors. The hook fetches feed items, appends continuation results, and manages cancellation so a late response from a previous selection does not take over the current queue. Switching the active item selects the next media source and boundaries. If you see the wrong title and video together, inspect the active feed item first. If that object is correct but the media disagrees, inspect provider loading and seeking.

**Two clocks.** Suppose an item points to seconds 90–150 of a video. The underlying YouTube or HTML video clock reads 100 seconds ten seconds into the item. The learner timeline should read 00:10 of 01:00. The hook loads/seeks using source-absolute times and projects the visible timeline into chunk-relative time. It monitors the end boundary, including completion checks near the final half-second during playback. Changing the displayed timer alone will not change where the media stops. [Timing and completion implementation](../../src/client/screens/dashboard/play/hooks/usePlayback.ts)

**Completion round trip.**

1. The hook marks the chunk optimistically and posts its identifiers and completion data to `/api/progress/chunk`.
2. The server obtains the signed-in user and checks the lesson, cohort access and actual chunk membership against PostgreSQL. For a batch it verifies all referenced items before proceeding.
3. The progress service persists learner state in MongoDB. The browser expects a success response with the matching completed chunk. A failed or malformed acknowledgement rolls back the optimistic mark.
4. Future feed requests can exclude that completed piece. Home will count the lesson once every retained chunk in it is complete. Watching one part can therefore affect Feed before Home's percentage moves.

[Progress endpoint](../../src/app/api/progress/chunk/route.ts) · [Progress service](../../src/server/domain/progress/chunkProgress.service.ts) · [Storage model](../../src/server/database/mongo/models/UserChunkProgress.ts)

## 8. How Home calculates your dashboard

The `/home` page resolves the session server-side, redirects to sign-in if needed, and calls `loadHomeForUser` inside a Suspense boundary. Suspense lets the page show a loading skeleton while the data arrives. The initial dashboard data can arrive with the server render, so looking only for an initial browser fetch to a Home API can send you to the wrong file. [Home page](../../src/app/%28dashboard%29/home/page.tsx) · [Home service](../../src/server/domain/home/home.service.ts)

The service reads enrolled cohorts and cohorts the learner created, merges duplicates, walks seasons and lessons, and collects distinct chunk IDs. It loads MongoDB progress and per-cohort preferences, then builds active, recently completed and continue-later lists. For a retained lesson every unique chunk needs a matching completed record. Legacy lessons without retained chunks use lesson-level SQL progress. Cohort percentage is rounded completed lessons divided by total lessons, with zero for an empty course.

**Worked example.** A course has two lessons. Lesson 1 has A and B. Lesson 2 has C. Finish A alone and Home still shows 0%. Finish C and Home shows 50%. Finish B and it reaches 100%. Different-length lessons each contribute one completed lesson to the numerator. For an unexpected 50%, compare the retained chunk IDs and saved progress tuples before inspecting the dashboard animation.

**What happens when you pause a cohort.** `useHome` takes a rollback snapshot, updates the visible lists immediately, and writes to `/api/user/cohort-config`. It guards against overlapping mutations. A successful write triggers a router refresh. A failed write restores the prior state and cached choices. A pause can last indefinitely or expire at `pausedUntil`. Leaving a cohort instead calls `DELETE /api/cohort/{id}/join`, because leaving changes membership. For a cohort that keeps reappearing, first establish which action the client sent. [Home hook](../../src/client/screens/dashboard/home/hooks/useHome.ts) · [Preference endpoint](../../src/app/api/user/cohort-config/route.ts)

## 9. Notes from keystroke to GitHub

Notes has three persistence paths to keep straight: a local working copy, a compatibility API, and optional GitHub synchronization. Their success signals mean different things. A GitHub commit is evidence of remote publication. A successful local edit can precede that commit by minutes or longer.

**Follow a rename.** The Notes screen uses `useNotes` for notebook/note state and commands. The hook distinguishes content edits from view preferences so selecting a note need not generate a content save. `NotesRepository.save` first awaits `syncWithLocalWorkspace`. That step diffs records against the local workspace and requires successful receipts. Afterward it updates its memory/browser cache and PATCHes `/api/workspace/notes`. Its result separates `localSaved` from `remoteSaved`; the latter in this method refers to the compatibility API. GitHub acknowledgement is tracked by the sync coordinator. [Notes hook](../../src/client/screens/dashboard/notes/hooks/useNotes.ts) · [Save sequence](../../src/client/screens/dashboard/notes/repositories/notes.repository.ts)

**What local-first means here.** Each user has a local workspace. IndexedDB is a structured browser database that can commit changes to several stores atomically. For a canvas, the scene, required assets and pending change can be committed together. The pending change is an **outbox entry**: a durable reminder of what still needs syncing. The editor can support canvases, Kanban and Markdown records through shared contracts. Saving compares semantic content so transient canvas selection or hover state need not create a sync entry. The database has an in-memory fallback when IndexedDB is unavailable or fails. Data held only in that fallback has the lifetime of the running page. Offline editing in an already open workspace and launching the whole app offline are different capabilities. [Contracts](../../src/shared/personal-workspace/contracts.ts) · [Local database](../../src/client/personal-workspace/local/database.ts) · [Atomic repository](../../src/client/personal-workspace/local/repository.ts)

**What GitHub sync does.** The coordinator checks the connection, pulls a manifest-backed snapshot, reconciles it with local records, and publishes pending changes against an expected commit SHA. A manifest lists the records and hashes belonging to that snapshot. The server builds Git blobs for file content, a tree for paths, a commit referencing the tree, and updates the branch reference. The application checks the expected remote head and uses a non-force update. A successful acknowledgement clears the matching batch of outbox entries. The status endpoint alone cannot tell you which local edits reached the remote branch. [Coordinator](../../src/client/personal-workspace/sync/coordinator.ts) · [Publish endpoint](../../src/app/api/personal-workspace/github/publish/route.ts) · [Pull endpoint](../../src/app/api/personal-workspace/github/pull/route.ts)

**Two devices edit the same note.** Imagine both devices pulled commit X. The laptop publishes Y while the phone is offline. When the phone reconnects its expected head X is stale. It pulls again, compares the dirty local record with the prior verified base and the new remote record, and preserves divergent versions in local conflict/recovery storage. Stale-head retries are bounded. Pending changes stay queued when synchronization cannot finish. To diagnose, identify the exact note ID, pending generation, last verified commit and remote manifest entry. The current publish path has a 4 MiB JSON request boundary; a large asset can block publication even after a successful local edit. [Conflict and retry implementation](../../src/client/personal-workspace/sync/coordinator.ts) · [Local recovery](../../src/client/personal-workspace/local/recovery.ts)

**Two different GitHub connections.** GitHub sign-in identifies an Undone user. Notes GitHub App installation grants access to the selected repository. For the app path, PostgreSQL stores installation and repository identifiers and the server resolves short-lived credentials. The server-side vault and callbacks also accommodate other connection paths. When login works but notes cannot publish, trace installation, repository access and the Notes status response. [GitHub connection routes](../../src/app/api/personal-workspace/github) · [Vault](../../src/app/api/personal-workspace/github/vault.ts)

## 10. Who is making the request?

**Registration.** The register endpoint normalizes the email, derives or validates a username, checks uniqueness, and hashes the password with scrypt and a random 16-byte salt before creating the user. A successful response is 201. Credential sign-in later looks up a normalized email or case-insensitive username, derives a key from the submitted password and stored salt, and compares it in constant time. The credentials provider also contains an explicit guest-account branch. Trace that branch separately when investigating guest behavior. [Registration](../../src/app/api/auth/register/route.ts) · [Password implementation](../../src/server/infrastructure/auth/password.ts)

**Session.** The Auth.js configuration registers GitHub, Slack and Credentials and uses the Prisma adapter with a JWT session strategy. After sign-in, the JWT callback puts the user ID into `token.sub`. The session callback exposes it as `session.user.id`. The browser sends the session cookie on subsequent requests; server code calls `auth()` or the React-cached `getUser()`. Although Prisma defines a Session model, this configured flow uses JWTs. The decode cache is process-local and store connections are configured separately. [Auth configuration](../../src/server/infrastructure/auth/auth.config.ts) · [Current-user helper](../../src/server/infrastructure/auth/getUser.ts)

**Access checks.** Middleware gates selected page paths, including Home and Play. Individual routes and services still enforce their own rules. The creation owner helper resolves a session to an actual SQL user, tries email if necessary, and can upsert a missing user with an email. It returns null on database failure. That means a sign-in redirect on a builder page can originate from owner resolution even when a session cookie exists. For resource-specific failures, inspect the owner or cohort membership check after confirming identity. [Middleware matchers](../../src/middleware.ts) · [Creation owner](../../src/server/infrastructure/auth/getCreationOwner.ts)

## 11. Where the data lives

| If you want to know… | Look here first | Join or lookup to follow |
|---|---|---|
| Who signed in and how | PostgreSQL `User`, `Account`; JWT session callback | Session user ID → SQL user ID. Provider account and app user have distinct identifiers. |
| Who owns an unfinished course | PostgreSQL `InteractionWorkspace` | Workspace ID + owner ID → snapshot, revision, sequence |
| What an assistant turn did | `InteractionMessage`, `InteractionRun`, `InteractionStep`, `InteractionEvent` | Workspace ID → run ID → execution steps and events |
| Whether a repeated action was already accepted | `InteractionRequest` | Workspace + actor + operation + request ID → payload hash and receipt |
| Which processing dependency failed | `CohortTextJob`, `CohortTextJobEdge`, `CohortTextArtifact` | Workspace and job identity → prerequisite → accepted payload/version |
| Which content learners can read | PostgreSQL `Cohort`, `Season`, `Lesson`, `CohortMember` | Cohort ID → seasons → lessons → lesson's retained chunk data |
| What a learner finished | MongoDB `UserChunkProgress` | User and chunk → status. Verify the cohort and lesson IDs too. |
| Why the same course is paused for one user | MongoDB `UserCohortConfig`, `UserChannelConfig` | User → course rank, pause, schedule or channel prefs |
| Where extra scoring data comes from | MongoDB `Chunk` and `CohortTranscript` | Chunk/cohort ID → optional vectors. First verify the SQL delivery exists. |
| Which note edits are waiting | Browser IndexedDB for the user | Note ID → local record, assets, outbox and possible conflict records |
| Which note snapshot reached another device | GitHub repository and manifest | Branch head → commit → tree → manifest and record hashes |

**How the connections work.** The SQL client uses Prisma with the PostgreSQL driver adapter and a pool configured by `DATABASE_URL`. MongoDB uses its own connection helper with `MONGODB_URI`. Pool sizes are bounded, with lower defaults in serverless settings. A healthy SQL connection tells you little about the health of the personalized Mongo reads. Inspect the database required by the failing operation. Schema definitions and indexes are a better starting point than generated client files. [SQL schema](../../prisma/schema.prisma) · [PostgreSQL client](../../src/server/infrastructure/db/postgres/client.ts) · [Mongo client](../../src/server/infrastructure/db/mongodb/client.ts) · [Mongo models](../../src/server/database/mongo/models)

## 12. Learn it by tracing it

Open DevTools → Network and enable Preserve log before navigating. Use a learning account and content you control for write exercises. For each trace, write down one real identifier and carry it across the next boundary. That is faster than searching for a visible title shared by several records.

| Observation | First question to answer | Next place to inspect |
|---|---|---|
| Clicking Plan does nothing | Did the intake POST leave the browser? | Draft restoration, gate, attachment extraction, then response code/body |
| A workspace opens but the assistant is silent | Was a run queued and claimed? | Run ID, worker log, model outcome, workspace events |
| Assistant says it added a lesson but the list disagrees | Did an action commit a new revision? | Tool result, action receipt, refreshed workspace snapshot |
| Course appears on Explore but never in Play | Is it a real published course with an accessible published lesson and valid chunks? | Explore response, release receipt, SQL lesson delivery, catalog rejection |
| Feed order looks wrong | Was the chunk absent, filtered, scored low, or interleaved later? | Catalog → learner state → candidates → scores → final items |
| The video starts correctly but ends late | Are source-absolute and chunk-relative times being mixed? | Feed item's start/end, provider clock, boundary handling |
| Home progress looks too low | Which whole lesson is fully complete? | Unique retained chunk IDs and saved progress for this user |
| A note survived reload but never reached the phone | Which save succeeded? | Local record → outbox → publish acknowledgement → remote manifest → phone pull |
| Home works but creation sends you to sign-in | Can the session be resolved to a SQL creation owner? | Session user, owner resolution, database availability |

**Three short exercises.**

1. **Read a request without spending AI credits.** Open the intake schema and transaction side by side. Find the initial step for each mode, then find the two different scheduling calls. Explain why retrying the identical prompt with a *new* request ID can create a second workspace.
2. **Predict Feed and Home before running a test.** Return to the A1/A2/A3 example. Predict the first candidate for normal playback, replay and continuation. Then predict Home's percentage if those are the only chunks in the only lesson and two are complete. The answer for Home is 0%, because the lesson still has an unfinished chunk.
3. **Read a Notes save receipt.** In `NotesRepository.save`, find the return immediately after the compatibility PATCH fails. Follow the successful local step above it. Explain which component will later attempt GitHub publication. This distinguishes three meanings of “saved” using one function and its caller.

**Focused local commands** (from the repository root, after dependencies are available):

```powershell
# Read the behavior as executable examples
npx vitest run src/shared/feed/__tests__/feedEngine.test.ts
npx vitest run src/app/api/progress/chunk src/server/domain/home
npx vitest run src/app/api/cohort-builder/intake/route.test.ts
npx vitest run src/client/personal-workspace src/app/api/personal-workspace

# Verify that the interaction worker can load without a database or model call
npm run interaction:worker:check

# Locate the actual writer or reader when you know the symbol
rg -n 'acceptCohortIntake|releaseWorkspace' src
rg -n 'generateFeed|retainedLessonCompleted' src
rg -n 'syncWithLocalWorkspace|class SyncCoordinator' src
```

When reading an unfamiliar feature, start at the page, find the user action, identify which handler accepts it, and follow the persisted ID back into the next screen's read. In this app the most revealing examples are the workspace-to-cohort release, the chunk-to-lesson completion calculation, and the local-note-to-Git-commit acknowledgement.

