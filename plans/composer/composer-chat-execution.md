# Composer/chat execution — verified incident and priority repair

Investigated 2026-10-31 against the affected workspace's persisted database records, using read-only transactions. No production state was changed and no model request was made. This incident repair supersedes the latency hypotheses/order in [the detailed handoff](../COMPOSER_CHAT_IMPLEMENTATION_PLAN.md). The UI work in that document remains applicable.

## What actually happened

Affected screenshot workspace: `064df82e-5fca-4b61-a6c7-6801df1b917e`.
Run: `6898be69-7ebd-4f87-86f9-05b2b49c2cb4`.

The backend did NOT spend 5–10 minutes generating this response. It failed in **8.657 seconds after message acceptance**. There is exactly one user message and no persisted assistant reply for this run.

Durable event timeline (database-side elapsed arithmetic, same event clock):

| Elapsed after message acceptance | Persisted event |
|---|---|
| 0.000 s | message.accepted |
| 0.180 s | run.changed: queued |
| 5.079 s | run.changed: running |
| 8.076 s | workspace.committed: set_intent succeeded |
| 8.657 s | run.changed: failed |

Queue-to-running was 4.899s. Running-to-terminal-failure was 3.578s. Model-call journal start-to-failure was 3.224s (includes tool work; not a pure provider latency). Do not mix JavaScript Date renderings across timestamp-with/without-timezone columns: the initial query exposed a 5h30m representation difference. The intervals above were calculated in SQL from interaction_events.createdAt, avoiding that error. No absolute timestamp/timezone inference is required for the diagnosis.

Journal evidence:

- ordinal 0 model_call: failed.
- ordinal 1 set_intent: completed; recorded input keys `["intent"]`.
- ordinal 2 edit_presentation: failed; recorded input keys `["title", "description"]`.
- Persisted error: Zod `unrecognized_keys`, keys `["type"]`, path `["presentation"]`.
- Run ended failed, lease cleared, no assistant message appended.

This explains the apparently contradictory suggestions: the AI successfully changed the intent around 8s, and the browser builds suggestions synchronously from that saved intent. Then the next tool crashed. Suggestions are not a completed conversational response, but in THIS incident their updated wording could reflect successful partial AI work. The earlier blanket explanation that suggestions require no AI should be read with this distinction.

## Root cause 1 — application injects action discriminator into presentation

File: `src/shared/cohort-builder/contracts.ts`, `planCohortAction`, edit_presentation branch.

Current code:

```ts
const { title, description, coverImage, ...presentation } = action;
```

The rest object still contains `type: 'edit_presentation'`. The next line spreads it into `next.presentation`. The workspace schema defines presentation as a strict object without a type field, so subsequent repository validation rejects the state and rolls back that tool's transaction. The prior set_intent transaction remains committed. The AI did not send an invalid presentation.type field: the journal confirms title/description only. The host injected it.

Reproduced locally against the real contracts module with a valid title-only action:

```json
{"presentation":{"type":"edit_presentation"},"valid":false,"issues":[{"code":"unrecognized_keys","keys":["type"],"path":["presentation"],"message":"Unrecognized key: \"type\""}]}
```

Removing only presentation.type from the in-memory result made the same schema validation pass. No database writes were used for this reproduction.

### Exact minimal patch

```diff
- const { title, description, coverImage, ...presentation } = action;
+ const { type: actionType, title, description, coverImage, ...presentation } = action;
+ void actionType;
```

Keep all other semantics (title/description at workspace level, coverImage null removal, existing presentation fields, release invalidation). Do not loosen the strict schema, suppress all tool errors, retry malformed state repeatedly, or change models to mask this deterministic bug.

### Regression test

Extend `src/shared/cohort-builder/__tests__/contracts.test.ts`; its existing test only checks a subset with toMatchObject and therefore misses invalid extra state. Within the existing describe, reuse base() and context:

```ts
it('presentation edits produce a schema-valid snapshot without action metadata', () => {
  const result = planCohortAction(base(), {
    type: 'edit_presentation',
    title: 'Data science',
    description: 'A deep study path',
    subtitle: 'From foundations to projects',
  }, context);
  expect(result.nextState.presentation).not.toHaveProperty('type');
  expect(() => cohortWorkspaceSchema.parse(result.nextState)).not.toThrow();
  expect(result.nextState.title).toBe('Data science');
  expect(result.nextState.description).toBe('A deep study path');
  expect(result.nextState.presentation?.subtitle).toBe('From foundations to projects');
});
```

Also validate nextState for title-only, description-only, all presentation fields, clearing coverImage, retaining seasonTitles, and a subsequent second action on the returned state. Add a tool-to-repository integration fixture: scripted set_intent then edit_presentation then assistant text must complete with two successful commits and one assistant message. Validate the actual next state inside the fake persistence boundary if a real SQL fixture is unavailable; do not stub domain.plan or return success unconditionally.

## Root cause 2 — terminal failure can be hidden indefinitely by activity ETag

File: `src/app/api/cohort-builder/workspaces/[workspaceId]/activity/route.ts`.

The endpoint builds an ETag by base64 encoding concatenated messageId/runId/status strings then taking only 32 characters. Those characters encode only the start of the first message ID. Changing queued -> running -> failed does not change the ETag. `useAssistantActivity.ts` keeps the prior turns on 304, and ChatPane shows Thinking for a cached queued/running turn. No final assistant message arrives to break the illusion because the run actually failed.

The ETag collision was reproduced. The hook's 304 retention was verified in source. Browser network history from the original incident was not retained, so the exact historical 304 sequence is inferred rather than captured. The failed backend run itself is proven by persisted records. This distinction does not weaken the deterministic ETag defect or its required repair.

### Exact patch

Import `createHash` from `node:crypto`; keep Node runtime. Replace the truncated base64 ETag with a hash of the full response:

```ts
const payload = { turns };
const etag = `W/"${createHash('sha256')
  .update(JSON.stringify(payload))
  .digest('hex')}"`;
```

Retain conditional GET and private/no-store. Return payload in Response.json. Do not disable caching globally or increase polling frequency to solve an identity collision.

### Regression test

Exercise the real route GET with mocked Prisma/auth and one fixed valid message ID/run ID. First response running -> capture ETag. Second response failed using If-None-Match from first -> require HTTP 200, new ETag, and failed body. Third unchanged failed response with new ETag -> 304. Also test queued -> running -> completed, pending -> queued, and changes outside the first row. Hook integration: first running, next failed must remove Thinking and enable actionable error/retry UI within the existing 2s active polling interval. An unchanged 304 must still retain current state.

## Failure presentation and retry

ChatPane already has a generic failed/canceled message, but stale activity prevents it appearing. Verify it becomes visible after the ETag repair. Use a concise message such as `Your request failed. Please retry.` Do not expose raw validation JSON to the learner. Add retry of the original intent as a NEW explicit message/run after the code is fixed; do not auto-loop the already failed run or replay previously committed set_intent blindly. Preserve the user's existing workspace and successful partial intent update. No production data repair is needed for this incident.

## Execution priority — small repair first

1. Add failing snapshot-schema and route-status regression tests.
2. Exclude the action discriminator from presentation and hash the complete activity payload.
3. Verify the two-tool scripted run completes, final assistant text persists, and terminal errors no longer show Thinking.
4. Apply the requested composer/suggestion/logo UI work from the detailed handoff.
5. Run a newly authorized real prompt after deployment and measure its queue/start/first text/final timings separately. Remaining normal latency can be investigated from that evidence.

**Provider streaming, progress snapshots, journal transport extensions, model changes, and worker rewrites are NOT prerequisites to repairing this observed incident.** Treat detailed-handoff units D/E as deferred independent improvements, not root-cause fixes. Do not add their complexity to the minimal incident repair merely because they appeared in the earlier hypothesis-based plan. The roughly 5s queue/start delay is a separate optimization target and does not explain minutes of Thinking here.

Run focused tests:

```powershell
npx vitest run src/shared/cohort-builder/__tests__/contracts.test.ts
npx vitest run 'src/app/api/cohort-builder/workspaces/[workspaceId]/activity/__tests__/route.test.ts'
npx vitest run src/client/screens/cohortBuilder/__tests__/useAssistantActivity.test.ts src/client/screens/cohortBuilder/__tests__/ChatPaneTurnAndInteractive.test.tsx
npx tsc --noEmit --incremental false
```

The route test file is to be created per the handoff. Add the actual tool-to-repository test path to the executed test report. Until implementation is performed, report these as required tests, not passed tests. Investigation has run the real contract reproduction and read-only database queries only.

## File distribution

The requested `plans/` directory is ignored by `.gitignore`. This file exists for the requested local handoff, but would not automatically travel in a normal commit. The same incident addendum is linked from PLAN.md and included in the tracked-path `COMPOSER_CHAT_IMPLEMENTATION_PLAN.md`; hand that file to a remote executor too. No automatic Git staging or deployment is authorized by this documentation update.
