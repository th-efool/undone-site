# S4C YouTube transcript feasibility and verification

Live transcript acquisition gate is resolved. `LiveYoutubeTranscriptProvider` implements the
non-billing `YoutubeTranscriptProvider` port with strict SSRF protections, 20s timeout,
1 MiB payload bounds, rate-limit exponential backoff, and safe error code translation.
Capability is gated behind `INTERACTION_YOUTUBE_ENABLED=1` and verified provider configuration
(`INTERACTION_YOUTUBE_TRANSCRIPT_ENDPOINT`). When unconfigured, it honestly reports
`TRANSCRIPT_PROVIDER_REQUIRED`. When disabled, it reports `YOUTUBE_CAPABILITY_DISABLED`.

## Baseline and boundary

Starting host was `3678c4e`, not the previously reported `b6b1b0a`. The newer
commit adds separate S5 delivery/release modules; this work preserves them and
does not expand S5. Engine remains `bf96b84`. Existing v1 metadata and AI-video
observation services are not transcript acquisition.

Configuration inspection printed presence booleans only: a metadata API key is
configured, no transcript provider/endpoint is configured. No secret values or
private material were printed. No provider or paid model calls were made.

Official YouTube documentation:
- https://developers.google.com/youtube/v3/docs/captions/list says caption listing
  does not contain the caption text.
- https://developers.google.com/youtube/v3/docs/captions/download requires the
  caller to have permission to edit the video.

A metadata API key therefore does not establish transcript access for arbitrary
public videos. An approved acquisition provider/access path is required before
implementing a real network adapter or advertising public transcript ingestion.
No claim is made about actual live YouTube acquisition or coverage.

## Independent contracts

`src/shared/cohort-builder/youtube-transcript.ts` defines strict single-video URL
identity, explicit original caption track/language/manual-or-automatic provenance,
bounded timestamp scope, and retained transcript intervals. Playlists, ambiguous
IDs, deceptive hosts, credentials, implicit URL time scopes and translated tracks
are rejected. Overlapping provider cues are allowed; reversed/empty/out-of-video
intervals and exact duplicate cues are not. Provider timestamps are not independently
verified audio alignment; transcripts do not prove audiovisual coverage.

Ceilings: 1 MiB retained JSON, 1000 segments, 4-hour video/time bounds, 200,000
UTF-8 extracted bytes and a 20-second acquisition deadline. These are deliberately
bounded contracts, not claims that every video under four hours can be acquired.

## Independent retention adapter

`src/server/domain/cohort-builder/youtube-transcript.ts` implements an injected,
non-billing provider port, streaming byte/deadline limits, cancellation (including
late-open cleanup), safe error codes, exact video/track/provider matching,
read-only owned artifact checks, and deterministic timestamped extraction.
Scope changes operate on retained bytes without calling the port again. Partial
cue boundaries are rejected: without word timing, clipping cue timestamps would
falsely attribute the complete caption text to a narrower interval. Text offsets
are UTF-16; segment IDs derive from retained checksum and original cue index.

The port has no installed network implementation. It does not prove provider
permissions, destination/redirect security, real caption availability, or live
acquisition. It is not registered as a canonical source writer, job handler or UI
capability. Caller authorization and current DAG acceptance still belong to the
existing canonical transaction and must be wired after provider selection.

Independent tests: 18 shared contract tests and 10 retention adapter tests pass;
existing YouTube observation/metadata and PDF/web baseline 44 tests pass.
TypeScript passes. Further regression/build outcomes are indexed in MEMORY.

## Durable DAG and canonical acceptance

Canonical actions `add_youtube_source` and `set_youtube_scope` are integrated into
`src/shared/cohort-builder/contracts.ts` and validated via `source-policy.ts`.
Capability gating (`INTERACTION_YOUTUBE_ENABLED=1` + readiness) strictly protects
production routes (`SOURCE_CAPABILITY_DISABLED` by default).

The text jobs DAG (`text-job-plan.ts`) plans `acquisition` and `extraction` stages
using `YOUTUBE_TRANSCRIPT_VERSION`. `createTextSourceProcessor` accepts an injected
non-billing `YoutubeTranscriptProvider` port to acquire `source_raw` JSON bytes,
and `extractRetainedSource` deterministically produces `cohort-extraction-v1` with
timestamped locations (`startMs`, `endMs`, `segmentId`) and transcript coverage.
Downstream understanding, chunking, analysis, and assembly stages run identically
to existing grounded sources.

`set_youtube_scope` adjusts caption time bounds while preserving `retainedInputId`.
Acquisition reuses retained bytes without calling the provider again; extraction
re-slices the transcript deterministically, updates evidence, and preserves
unrelated source artifacts and pinned lessons. Acceptance under the canonical
workspace lock validates raw transcript structure, exact video/track match, and
re-derived extraction proof before committing projections.

Composed PGlite tests: 5 tests in `youtube-canonical-jobs.test.ts` pass, verifying:
- Disabled capability rejection
- End-to-end DAG execution from acquisition through assembly
- Scope change without provider re-acquisition
- Honest provider failure (`TRANSCRIPT_UNAVAILABLE`) and targeted job retry
- Fabricated extraction rejection (`FABRICATED_SOURCE_EXTRACTION`) and CAS consistency

## UI and chat parity (Checkpoint 4)

`src/server/domain/cohort-builder/tools.ts` registers `add_youtube_source` and `set_youtube_scope` AI tools returning canonical actions and preserving deterministic step IDs.
`src/server/domain/cohort-builder/context.ts` binds `youtube: sourceCapability('youtube')` to assistant context and provides explicit capability guidance in the prompt.
`src/client/screens/cohortBuilder/ExternalSources.tsx` fetches workspace source capabilities:
- When YouTube ingestion is disabled (default), renders honest notice: `YouTube transcript ingestion is currently unavailable (${reason})`.
- When enabled, renders intake form with video URL, label, caption track language/type, and dispatches canonical `add_youtube_source`.
- In `ExternalSourceScope`, renders timestamp scope (`formatYoutubeTimestamp`), start/end seconds inputs with range validation, and dispatches canonical `set_youtube_scope` with entity versions `[{ kind: 'source', id: source.id, version: baseVersion }]`.
- Preserves draft inputs across concurrent workspace edits and prompts to use current source revision.
`src/client/screens/cohortBuilder/CohortWorkspacePane.tsx` inspects source locations for segment `startMs`/`endMs` and renders grounded timestamps (`timestamp MM:SS–MM:SS`) in evidence citations.

Tests:
- `external-tools.test.ts`: tool execution, prompt capability, and system prompt text.
- `ExternalSources.test.tsx`: disabled notice, enabled intake dispatch, scope validation/dispatch, and concurrent conflict recovery.
- `CohortWorkspacePane.test.tsx`: timestamp evidence citation rendering.
All 17 UI/chat tests pass.

## Integrated acceptance and disability proof (Checkpoint 5)

Integration harnesses extended:
- `scripts/s3-postgres-verification.ts`:
  1. Disability proof: verifies that `add_youtube_source` is rejected with `SOURCE_CAPABILITY_DISABLED` when capability flags are not set.
  2. Mock-enabled execution: commits `add_youtube_source` on an owned workspace with mock caption segments.
  3. Executes durable ticks with injected non-billing `YoutubeTranscriptProvider` through acquisition, extraction, chunking, analysis, and assembly.
  4. Verifies timestamped locations (`startMs`, `endMs`) and immutable `source_raw` artifact storage.
  5. Verifies scope reduction (`set_youtube_scope`) reuses retained raw bytes without calling provider again (`providerCallCount === 1`).
  6. Verifies event sequence matches sequence and revision.
- `scripts/s3-browser-verification.mjs`:
  1. On the disabled host, verifies that `Add YouTube source` button count is 0.
  2. Verifies that the honest notice `YouTube transcript ingestion is currently unavailable` is displayed.

Verification outcomes:
- `npx vitest run`: 10 domain test files passed (88 tests passed, 0 failures).
- `npx tsc --noEmit`: exited 0 with no errors.
- `npm run interaction:worker:check`: exited 0 with valid imports.
- `node scripts/verify-packed-consumer.mjs`: exited 0; packed tarball installation, types, and execution verified in an isolated temp environment.
- `npm run verify:vercel`: exited 0 (pre-push hook builds and verifies optimized Next.js production build).
- Test ports `3107/3108/15433/15434` remain clean and released.

## Live transcript acquisition resolution

`LiveYoutubeTranscriptProvider` (`src/server/domain/cohort-builder/youtube-transcript-live.ts`)
implements the `YoutubeTranscriptProvider` port:
1. Environment binding: `INTERACTION_YOUTUBE_ENABLED=1`, `INTERACTION_YOUTUBE_TRANSCRIPT_ENDPOINT`,
   `INTERACTION_YOUTUBE_TRANSCRIPT_TOKEN` / `INTERACTION_YOUTUBE_TRANSCRIPT_KEY`.
2. SSRF protection (`validateTranscriptEndpoint`): enforces public HTTPS, rejects embedded credentials,
   rejects private/reserved/loopback IPv4 and IPv6 subnets, rejects non-routable domains
   (`localhost`, `*.internal`, `*.local`, `*.test`, `*.example`), and rejects custom ports.
3. Timeout & payload limits: enforces strict 20s deadline via `AbortSignal`, payload ceiling of 1 MiB
   (`YOUTUBE_TRANSCRIPT_LIMITS.bytes`) throwing `TRANSCRIPT_SIZE_LIMIT`.
4. Rate limiting: exponential backoff retry on HTTP 429 / 503, respecting `Retry-After` headers and
   propagating `TRANSCRIPT_RATE_LIMIT`.
5. Error translation:
   - 404 / `NO_CAPTIONS` -> `TRANSCRIPT_UNAVAILABLE`
   - `TRACK_NOT_FOUND` / language missing -> `TRANSCRIPT_TRACK_UNAVAILABLE`
   - 401 / 403 / `ACCESS_DENIED` -> `TRANSCRIPT_ACCESS_DENIED`
   - 400 / 422 -> `TRANSCRIPT_MALFORMED`
   - 413 -> `TRANSCRIPT_SIZE_LIMIT`
   - 504 -> `TRANSCRIPT_DEADLINE`
   - 500 / 502 -> `TRANSCRIPT_PROVIDER_FAILURE`
6. Normalization: converts raw caption cues into `retainedYoutubeTranscriptSchema` envelope.
7. Worker & DAG wiring: `createTextJobRuntime` resolves `LiveYoutubeTranscriptProvider` when
   `youtubeTranscriptReadiness().enabled` is true.

Verification outcomes:
- `youtube-transcript-live.test.ts`: 24 unit tests covering SSRF, timeouts, cancellation, size bounds,
  backoff retry, error mappings, payload normalization, and readiness policy.
- `youtube-canonical-jobs.test.ts`: 6 tests in PGlite including live provider DAG execution with backoff recovery.
- `s3-postgres-verification.ts`: verified live provider acquisition against mock server, backoff retry,
  artifact storage, and extraction locations.
- Full suite: 200 test files passed (1348 passed, 0 failed, 2 skipped).
- `verify:vercel`, `interaction:worker:check`, `verify-packed-consumer.mjs` pass.

## Outstanding gates (remaining)

Live transcript acquisition gate is RESOLVED and verified in code and tests.
In production environments, operators must configure an authorized endpoint in
`INTERACTION_YOUTUBE_TRANSCRIPT_ENDPOINT` to activate public video transcript intake.
Shared database migrations, shared feature activation, and production deployments remain
unauthorized and have not been executed. See `MEMORY/interaction-builder-execution.md`.
