# cohort-creation

ROOT: `D:\ThisPC\Documents\SideQuestHQ\undone-site`
SCOPE: landing prompt → authenticated durable draft → source acquisition → processing → review → delivery
PRECEDENCE: current source/schema > `plans/cohort-creation-checkpoint.md` current checkpoint + `plans/cohort-creation-live-repair.md` newest entry > other `plans/*.md` (historical context)

## Locate first

UX REPAIR (CP1-CP5): Canonical builder at `/quest/build/[workspaceId]` completely reproduces legacy frontend design (`CreationShell`, `StartingPoint`, `ReviewWorkspace` typography, spacing, colors, illustrations, composer, source intake, processing steps, curriculum outline, evidence drawer, release panel) while preserving the canonical backend and InteractionProvider/store. Intake fallback displays clear policy/readiness messages and offers explicit link to `/quest/new?handoff=1` with retained draft input. Checkpoints 1-5 verified.

V2 S4B: `src/server/domain/cohort-builder/source-adapters.ts`, `source-evidence.ts`, durable `text-*` jobs; `src/server/infrastructure/db/postgres/cohort-pdf-upload.ts`; `src/client/screens/cohortBuilder/ExternalSources.tsx`; owned `/api/cohort-builder/workspaces/:id/pdf` and `/sources`. PDF/web flags default off, durable driver + additive S4B constraints required. Local real SQL/browser verification passed; shared rollout unauthorized. See `docs/s4b-verification.md` and `MEMORY/interaction-builder-execution.md`. V1 writer/processors remain separate; only narrow parser/transport reuse.

| Concern | Primary path(s) |
| --- | --- |
| Landing CTA | `D:\ThisPC\Documents\SideQuestHQ\undone-site\src\client\screens\landing\Hero\components\CentralInterface.tsx` |
| Auth/new/resume route | `D:\ThisPC\Documents\SideQuestHQ\undone-site\src\app\(creation)\quest\new\page.tsx`; `D:\ThisPC\Documents\SideQuestHQ\undone-site\src\app\(creation)\quest\draft\[draftId]\page.tsx` |
| Workspace/client orchestration | `D:\ThisPC\Documents\SideQuestHQ\undone-site\src\client\screens\cohortCreation\CreationExperience.tsx`; `hooks\useCreation.ts` |
| Client transport | `services\draftApi.ts`; `services\draftEvents.ts`; `services\materialApi.ts` under `src\client\screens\cohortCreation` |
| Source-of-truth schemas/state machine | `D:\ThisPC\Documents\SideQuestHQ\undone-site\src\shared\cohort-creation\contracts.ts`; `flow.ts`; `jobs.ts`; `durable.ts` |
| Draft mutation/runtime | `D:\ThisPC\Documents\SideQuestHQ\undone-site\src\server\domain\cohort-creation\draft.runtime.ts`; `draft.service.ts`; `draft.http.ts` |
| Job runner | `D:\ThisPC\Documents\SideQuestHQ\undone-site\src\server\domain\cohort-creation\durable-job.ts`; `durable-job.runner.ts` |
| Worker composition | `D:\ThisPC\Documents\SideQuestHQ\undone-site\src\server\creation-worker.ts`; `creation-execution.runtime.ts`; `creation-dispatch.runtime.ts`; `creation.workflow.ts` |
| API surface | `D:\ThisPC\Documents\SideQuestHQ\undone-site\src\app\api\cohort-creation\**\route.ts` |
| SQL models | `D:\ThisPC\Documents\SideQuestHQ\undone-site\prisma\schema.prisma`; `src\server\infrastructure\db\postgres\repositories\creation*.ts` |
| Private artifact storage | `D:\ThisPC\Documents\SideQuestHQ\undone-site\src\server\infrastructure\storage\creation.runtime.ts`; sibling `creation.*.ts` |
| Material services | `D:\ThisPC\Documents\SideQuestHQ\undone-site\src\server\domain\cohort-creation\materials\` |
| Processing/read chain | `D:\ThisPC\Documents\SideQuestHQ\undone-site\src\server\domain\cohort-creation\processing-input.ts`; `processing.runtime.ts`; `*-content.service.ts`; `understanding.service.ts`; `chunking.service.ts`; `analysis.service.ts`; `building.service.ts` |
| AI adapters/prompts | `D:\ThisPC\Documents\SideQuestHQ\undone-site\src\server\infrastructure\ai\modelRegistry.ts`; `vercelCreation*.ts`; `prompts\creation.ts` |
| Publication/access | `D:\ThisPC\Documents\SideQuestHQ\undone-site\src\server\domain\cohort-creation\publication.*`; `src\server\domain\cohort\cohortAccessPolicy.ts` |

## Entry graph

```text
CentralInterface.handleSubmit
  -> GET /api/cohort-builder/intake (server feature policy + owner)
  -> tab-local session handoff (owned/expiring; prompt/source stay out of URLs)
  -> v2 enabled: /quest/start -> authenticate -> explicit owner confirmation
     -> atomic POST /api/cohort-builder/intake -> /quest/build/<workspaceId>
  -> v2 disabled, no source: /quest/new?handoff=1 -> authenticate -> explicit confirmation
     -> existing CreationExperience(requestId, retainedPrompt)
  -> old explicit /quest/new?q links remain compatible
  -> useCreation: POST /api/cohort-creation/drafts
  -> browser URL: /quest/draft/<draftId>
  -> request_recommendations command
```

LANDING_FACTS:

- Landing prompt supports optional pasted text for flagged v2 intake; file uploads/templates remain disabled there. Add sources/attachment controls reveal text input; Plan uses the same intake.
- `src/client/screens/cohortCreation/LegacyLandingHandoff.tsx` only hands a confirmed private prompt to the existing v1 writer. It does not participate in v2 source processing.
- `MEMORY/interaction-builder-execution.md` owns the v2 canonical/DAG/worker map and local verification status. Shared v2 durable rollout remains separately authorized.
- `/create-cohort` is legacy dashboard flow; do not treat it as the landing creation path.
- Draft route requires authenticated user that exists in PostgreSQL (`getCreationOwner`), not a guest/mock identity.

## Ownership + mutable state

```text
CreationSnapshot (contracts.ts) = client/server state contract
CreationCommand (flow.ts)       = only normal draft mutation input
CreationDraft.snapshot          = PostgreSQL canonical persisted snapshot
baseRevision + CreationDraft.revision = optimistic CAS; 409 returns canonical current snapshot
inputRevision                   = invalidation boundary for source/processing dependency changes
activeRequestId                 = current durable operation identity
```

STATE:

```text
recommendations
  -> starting_point (create_own)
  -> starting_point (source selection/acquisition/discovery)
  -> processing/understanding
  -> processing/chunking
  -> processing/analysis
  -> processing/building
  -> ready
  -> review
  -> finalizing
  -> published
```

GUARDS:

```text
processing start: accepted intent + all materials ready + retained extractions/refs
chunking: complete accepted understanding
analysis: complete accepted chunks
building: complete accepted analysis
ready: complete accepted build
publication: accepted review + no orphan/proposal/current refinement + frozen snapshot hash
source/scope mutation/back_to_materials: invalidates dependent descendants; never reuse stale inputRevision
```

## Commands -> durable effects

| Command | Job/result | Important dependencies |
| --- | --- | --- |
| `request_recommendations` | intent + public cohort matches | query, requestId |
| `create_own`, `choose_starting_point` | state-only | accepted intent |
| `discover_material` | observed candidate list | accepted intent |
| `acquire_text/pdf/web` | retained source + extraction manifest | uploaded asset / URL |
| `inspect_youtube` | metadata receipt | YouTube URL |
| `select_youtube_units` | state-only selected scope | inspected metadata |
| `observe_youtube` | bounded observation artifacts | explicit selected units; NOT transcript |
| `acquire_github/notion` | scoped retained/extracted source | GitHub paths/ref; owned connector for private access |
| `author_guide` | bounded generated-guide artifact | goal-only intent |
| `understand_material` | concept receipts | ready retained material/extractions |
| `chunk_material` | grounded chunk receipts | accepted understanding receipts |
| `analyze_material` | 12D pedagogical analysis receipts | accepted chunks |
| `build_curriculum` | lesson/season build receipts | accepted analysis |
| `refine_curriculum` | bounded proposal | ready/review curriculum |
| `finalize_creation` | private activation OR public publish receipt | frozen valid review |
| cancel/back/remove/change | cancellation/invalidation | must preserve CAS/revision fences |

## Transport / async execution

```text
PATCH /api/cohort-creation/drafts/:id {baseRevision, command}
  -> DraftService validates transition
  -> CreationDraft CAS + CreationJob immutable input enqueue
  -> dispatchCreationExecution
  -> local: dispatchRecommendation / persistent creation-worker polling loop
  -> Vercel: workflow reservation/start path
  -> worker claim lease -> reserve model slot -> checkpoint/finish under fence
  -> CreationEvent persisted
  -> GET .../events?after=N (NDJSON) -> useCreation update
```

ROUTES:

```text
POST /api/cohort-creation/drafts                         create
GET|PATCH /api/cohort-creation/drafts/:draftId           snapshot / command
POST /api/cohort-creation/drafts/:draftId/uploads        private upload; returns asset ref
GET /api/cohort-creation/drafts/:draftId/events          NDJSON replay/heartbeat/reset snapshot
GET /api/cohort-creation/drafts/:draftId/{understanding,chunks,analysis,review}
GET|POST|DELETE /api/cohort-creation/drafts/:draftId/connectors
GET|POST /api/cohort-creation/connector-delivery
POST /api/cohort-creation/recommendations                separate route; NOT landing draft flow
```

EVENT_RULES:

```text
observer is read-only; browser disconnect != cancellation
validate draftId, inputRevision, event sequence, 1MiB frames
on gap/network/protocol failure: canonical GET reload + bounded reconnect
job queue/recovery UI notices reflect saved job state, not browser work
```

## Persistence graph

```text
PostgreSQL
  users -> creation_drafts(snapshot, revision, eventSequence)
        -> creation_jobs(input, fingerprint, lease, deadline, checkpoint)
        -> creation_events(envelope, sequence)
        -> creation_budgets
        -> creation_storage_objects(metadata/auth/pins)

Mongo GridFS bucket creation_private
  raw uploads/sources + immutable typed artifacts/receipts

Publication transaction
  reviewed build + retained delivery artifacts
  -> Cohort + CohortSource + Season + Lesson + Community + CohortMember
  -> publication receipt / stable cohort identity
```

STORAGE_RULES:

```text
SQL metadata authorizes owner/draft/type/fingerprint/pin lifecycle.
GridFS holds body only. External refs are opaque id/kind/length/checksum.
Read retained artifacts through owner-scoped repositories only.
Retention worker: startup + ~10 min; protect active jobs/read leases/published pins.
```

## Material + processing graph

```text
source -> retained source/extraction artifact -> normalizeProcessingInput
       -> ProcessingPartition (exact ordered anchored segments, max 24KiB UTF-8)
       -> understanding receipts
       -> chunk receipts (exact contiguous coverage)
       -> analysis receipts (canonical 12 dimensions)
       -> build receipts (lesson/season/source mapping)
       -> ready/review/publication
```

SOURCE_LIMITS:

```text
max sources: 20
max selected units: 100
processing partition byte cap: 24 KiB
over-limit: fail; never silently truncate
```

SOURCE_SEMANTICS:

```text
markdown/pdf: upload -> retain -> parse/extract
web: controlled fetch -> retain response -> extract; restart does not refetch mutable URL
youtube: inspect -> explicit select -> AI observation; no transcript/exhaustive-coverage claim
github: explicit ref/path scope; public API or user-owned private connector
notion: explicitly selected connected page; recovery reads retained data
generated guide: goal-only AI source; non-exhaustive labeling required
```

MODEL_RULES:

```text
new flow model factory: src/server/infrastructure/ai/modelRegistry.ts:createCohortModel
adapters: Vercel AI SDK structured output; bounded context/output/deadline; no unlimited retry
reserve model budget before model call; accepted prefixes/checkpoints reused after restart
derive IDs/anchors/durations in application; never trust model-supplied persisted identity/source text
```

## Delivery / access

```text
ready -> open_review OR private activation
private_activation complete -> CreationExperience pushes /play?cohort=<cohortId>
public_publish is explicit; no public->private downgrade through creation finalization
read policy: published PUBLIC = readable; PRIVATE = creator/member; unpublished legacy preview = creator
apply access policy before cohort data, join, community, or progress read/write
```

## Runtime + verification

```text
required: DATABASE_URL, MONGODB_URI, GEMINI_API_KEY, auth configuration, YOUTUBE_API_KEY
optional connectors: CREATION_CONNECTOR_ORIGIN, CREATION_CORSAIR_KEK, CREATION_CORSAIR_API_KEY, CREATION_CORSAIR_SIGNING_SECRET
worker: npm run creation:worker
checks: npm run creation:readiness | creation:worker:check | creation:sql:smoke | creation:storage:smoke | creation:material:smoke
dev: npm run dev starts creation worker; npm run dev:bare does not
```

DO_NOT_ASSUME_VERIFIED:

```text
production worker supervision, Mongo reachability/permission, production connector config,
every authenticated browser journey, long/multi-video throughput, provider edge outputs,
private connector flow, cross-store publication race behavior.
```

## Update trigger

Update this file if any of: landing entry, route/API shape, state/command schema, source type/limits, worker dispatch, storage ownership, processing prerequisite, publication/access contract, required environment, or known deployment boundary changes.
