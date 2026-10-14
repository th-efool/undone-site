# S4C YouTube transcript feasibility and verification

S4C is incomplete. There is no configured/approved transcript acquisition
provider. Live intake is disabled, even if an environment flag is supplied.
The owned source-capability route reports `youtube: false` with
`TRANSCRIPT_PROVIDER_REQUIRED`. No YouTube source writer, paid observation
fallback, scraping workaround, or public capability advertisement was added.

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

## Outstanding gates (still open)

Select an authorized provider/access path and establish its network/security,
quota/cost, track availability and actual live acquisition conformance first.
Then integrate canonical actions/DAG/worker, UI/chat, owned timestamp evidence,
and extend the real SQL/browser harness. Existing S4B evidence does not prove S4C.
Do not claim completion from contract or deterministic normalization tests.

No shared migration/activation, deployment, registry publication or next slice
has been performed. See `plans/interaction-builder/s4c-checkpoints.md` and
`MEMORY/interaction-builder-execution.md` for resumable status and exact results.
