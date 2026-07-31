# Create Cohort Import Plan

## Goal

Extend the existing cohort wizard so the `Sources` step can trigger a real import pipeline, fetch YouTube playlist metadata and videos through our own API route, progressively report work back to the UI, and automatically advance the wizard to a temporary `Curriculum` summary state when importing completes.

This plan keeps the architecture established in Prompt 1:

- screen-first organization
- presentation models
- hooks orchestrate
- provider-owned wizard state
- CSS modules beside components
- no backend-shaped DTOs in the UI
- adapter layer later, not in the components

## What Already Exists

Prompt 1 already established:

- `WizardProvider` as the single source of truth for the cohort wizard
- draft state for Details and Sources
- step navigation
- screen-root composition
- mock-driven UI

This prompt should extend that system, not replace it.

## Architectural Decision

The import flow should be split into four layers:

`React UI -> ImportService -> Next.js API Route -> YouTube Data API`

Why this split:

- React components stay provider-agnostic and render state only.
- `ImportService` becomes the client-facing contract that future providers can plug into.
- API routes own request validation, error mapping, and server-side credential access.
- The YouTube API remains isolated on the server, where the secret key can be used safely.

This is the same philosophy already used in the app: the screen renders models, hooks orchestrate state, and adapters sit between UI and external systems.

## Frontend Responsibilities

The frontend should:

- keep the existing wizard draft intact
- start imports only through `WizardProvider`
- display progress cards, pipeline stages, and live events
- surface cancel/retry/error states
- render imported source and lesson previews from UI models
- move the wizard to the temporary `Curriculum` step when the import finishes

The frontend should not:

- call YouTube directly
- parse YouTube responses
- know YouTube request parameters
- own API credentials
- mirror playlist or video DTOs in components

Why:

- this keeps the UI reusable when GitHub, PDFs, websites, books, and course providers are added later
- it keeps the import experience stable even if the underlying provider changes

## Provider Responsibilities

`WizardProvider` remains the owner of wizard state. It should be extended to own the import lifecycle as well:

- import queue state
- per-source import state
- overall pipeline state
- live feed items
- imported source models
- temporary curriculum summary state
- cancel and retry actions

Why the provider should own this:

- the import is part of the wizard flow, not a separate product surface
- navigation, draft preservation, and import progress need one source of truth
- the UI already consumes wizard state from the provider, so extending it avoids prop drilling and duplicate state

The provider should still expose UI models and actions, not raw API payloads.

## Import Service

Create a dedicated client-side `ImportService`.

Responsibilities:

- accept a normalized source draft
- resolve the correct provider adapter
- call the app’s own API route
- stream progress events back to the caller
- honor `AbortController` cancellation
- normalize transport errors into typed import errors

Suggested surface:

- `importSource(...)`
- `importPlaylist(...)`
- `cancelImport(...)`
- future `registerProvider(...)` or adapter registry support

Why:

- the UI should only depend on one import contract
- future providers can be added without changing the wizard components
- cancellation logic belongs with the transport client, not inside React views

## API Layer

Create a Next.js route handler under `src/app/api/...` for YouTube imports.

The route should:

- validate the incoming request
- normalize the YouTube playlist URL
- resolve `playlistId`
- fetch playlist metadata
- fetch playlist items with pagination
- fetch video details in batches
- transform all upstream responses into internal UI models or progress events
- stream progress back to the client

Why:

- the browser never sees the YouTube API key
- server-side validation and error mapping keep the frontend simpler
- streaming lets the page feel alive instead of waiting for a single final payload

## Streaming Strategy

Use a streamed response for the import route.

Recommended shape:

- NDJSON or a similarly simple line-delimited event stream
- each event represents a pipeline update, a feed item, a stage state change, or a completed import snapshot

Why this approach:

- it works cleanly with `fetch()` and `AbortController`
- it supports progressive UI updates without websockets
- it is easy to extend with new event types later
- it keeps the transport simple enough to debug in production

The client `ImportService` should parse the stream and forward structured events to the provider.

## Data Flow

For one playlist source:

1. User presses `Continue` on `Sources`
2. `WizardProvider` asks `ImportService` to import the selected source
3. `ImportService` POSTs to our API route
4. API route validates the URL and extracts `playlistId`
5. Server calls YouTube `playlists.list` and `playlistItems.list`
6. Server paginates playlist items until completion
7. Server batches `videos.list` calls to fetch durations and metadata
8. Server streams stage updates and feed events
9. `ImportService` forwards events to `WizardProvider`
10. Provider updates source cards, overall progress, imported source models, and live feed
11. On completion, provider moves to temporary `Curriculum`

Why:

- this is the narrowest path that still feels like production behavior
- it cleanly separates ingestion, transport, and presentation

## UI Models

Do not mirror YouTube responses in the UI.

Use presentation models instead:

- `ImportedSource`
- `ImportedLesson`
- `ImportPipelineStage`
- `ImportFeedEvent`
- `ImportSourceCard`
- `ImportSummary`
- `ImportErrorViewModel`

Required imported models from the prompt:

- `ImportedSource`
  - `id`
  - `title`
  - `description`
  - `thumbnail`
  - `provider`
  - `creator`
  - `lessonCount`
  - `totalDuration`
  - `estimatedSeasonCount`
  - `status`
  - `lessons`
- `ImportedLesson`
  - `id`
  - `title`
  - `thumbnail`
  - `description`
  - `duration`
  - `position`
  - `provider`
  - `videoId`
  - `publishedLabel`

Why:

- Prompt 3 will consume these models directly
- the UI can stay stable if we later change providers or API payloads
- imported lessons become a reusable presentation contract, not a YouTube-specific object

## Pipeline Model

Each source import should expose a stage rail with statuses:

- `Pending`
- `Running`
- `Completed`
- `Failed`

Stages should include:

- `Queued`
- `Validating URL`
- `Connecting to YouTube`
- `Reading Playlist Metadata`
- `Fetching Playlist Videos`
- `Fetching Video Details`
- `Calculating Durations`
- `Preparing Curriculum`
- `Completed`

Why:

- the user needs to see real work, not a spinner
- this stage list maps directly to server work and can be updated incrementally
- later providers can reuse the same stage structure with different labels

## Live Feed Model

The import feed should contain progressive event entries such as:

- Connected to YouTube
- Found playlist
- Found 143 videos
- Downloading metadata
- Reading durations
- Finished page 2 of 3
- Fetched video 112
- Finished playlist

Why:

- it gives immediate feedback during long imports
- it makes the process feel active and deterministic
- it gives support/debugging value without exposing raw upstream responses

## Completion State

When importing finishes:

- provider stores the populated `ImportedSource` model
- provider updates the wizard to the temporary `Curriculum` step
- the curriculum step shows a summary page, not a generator
- step 4 remains disabled

Summary page contents:

- imported sources
- lessons imported
- estimated hours
- creator
- playlist
- continue CTA

Why:

- Prompt 3 needs a clear insertion point for curriculum generation
- the user should land on a meaningful summary rather than a dead end

## Error Handling

Handle production failures explicitly.

Expected cases:

- invalid URL
- playlist not found
- private playlist
- deleted playlist
- quota exceeded
- missing API key
- network timeout
- generic transport failure

Server responsibilities:

- map upstream failures to stable import error codes
- return helpful, frontend-safe messages
- avoid leaking raw YouTube response bodies

Frontend responsibilities:

- show readable errors
- preserve the wizard draft
- allow retrying the failed import
- allow canceling and returning to `Sources`

Why:

- import flows fail in predictable ways
- good error mapping is part of production quality, not a later polish task

## Cancellation

Cancellation should be real:

- use `AbortController` in the client
- stop the fetch stream
- stop state updates for that import
- preserve the wizard draft
- return the user to `Sources`

Why:

- long imports need a safe escape hatch
- this is a normal control for a production authoring tool

## Multiple Sources

The architecture should already support multiple sources in the queue.

For this prompt:

- YouTube playlists are fully implemented
- other providers are architecture-ready but not yet implemented

Why:

- the UI should not need to be refactored when GitHub, PDFs, websites, or course providers arrive
- source cards and overall progress should already be modeled around multiple imports

## YouTube Import Rules

Use the official YouTube Data API on the server.

Server should:

- accept playlist URLs in supported formats
- extract `playlistId`
- call `playlists.list` for playlist metadata
- call `playlistItems.list` with pagination until complete
- batch `videos.list` calls for video metadata and ISO8601 durations
- convert durations into renderable labels

Why:

- playlist metadata and item paging are the real source of truth
- duration must come from the video resource, not inferred in the client

## Extensibility for Future Providers

The import system should be built as a provider registry.

Future providers can register adapters for:

- GitHub
- PDFs
- Websites
- Articles
- Books
- Udemy
- Coursera
- edX

The UI should not change when these arrive.

Why:

- the provider contract is the stable part
- provider-specific parsing belongs in adapters and routes, not in the wizard

## Folder Structure

Only add folders that are justified today.

Likely additions:

```txt
src/client/components/screens/dashboard/createCohort/
  components/
  hooks/
  models/
  providers/
  services/

src/app/api/
  import/
    youtube/
      playlist/route.ts

src/server/
  imports/
    youtube/
      youtube-import.service.ts
      youtube-url.ts
      youtube-mapper.ts
      youtube-errors.ts
```

Why:

- the client import service belongs with the screen architecture
- the server implementation belongs under `src/server`
- the route handler stays thin and delegates work to the server layer

## Implementation Order

1. Add the plan file.
2. Extend the wizard provider with import state and actions.
3. Add the import UI models.
4. Add the client `ImportService`.
5. Add the YouTube server import service and URL parser.
6. Add the API route handler.
7. Replace the `Sources` step with the import workspace.
8. Add the curriculum summary step.
9. Verify streaming progress, cancellation, and completion navigation.

## Non-Goals

Do not implement:

- curriculum generation
- lesson/chunk generation
- backend persistence
- server actions
- AI calls
- direct YouTube calls from React
- a new global state management system

The result should be a production-style import pipeline inside the existing wizard architecture, ready for Prompt 3 to consume the imported models.
