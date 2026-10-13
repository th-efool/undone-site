# ai-builder-forge

ROOT: `D:\ThisPC\Documents\SideQuestHQ\undone-site\plans\ai-builder\Forge`
SCOPE: prompt/chat -> agent run -> validated React file mutations -> right-pane browser preview
IGNORE: auth, billing, team, custom-domain, broad publishing implementation unless prompt/build/preview change requires them
PRIMARY_DOC: `D:\ThisPC\Documents\SideQuestHQ\undone-site\plans\ai-builder\Forge\docs\ARCHITECTURE.md`

## Locate first

| Concern | Exact location |
| --- | --- |
| Full builder screen / prompt send / SSE effects | `apps\web\app\projects\[id]\page.tsx` |
| Event reducer contract | `apps\web\lib\chat-stream.ts` |
| SSE parser | `apps\web\lib\sse.ts` |
| Chat pane | `apps\web\components\builder\ResizableChatPanel.tsx` |
| Preview pane / iframe message bridge | `apps\web\components\builder\PreviewPane.tsx` |
| Preview lifecycle/soft refresh | `apps\web\components\builder\usePreviewControl.ts` |
| API message entry / replay / plan actions | `apps\api\app\routers\chats.py` |
| Agent orchestration | `apps\api\app\services\orchestration\dispatcher.py` |
| Context selection | `apps\api\app\services\orchestration\context.py` |
| LLM stream + continuation | `apps\api\app\services\llm.py` |
| Agent tag contract/parser | `apps\api\app\prompts\system.py`; `apps\api\app\services\tags.py` |
| Mutation validation/apply/history snapshot | `apps\api\app\services\apply_writes.py`; `edit_apply.py` |
| Preview shell/API | `apps\api\app\services\preview_babel.py` |
| Shared preview runtime | `apps\api\runtime\packages.json`; `public\runner.js`; `public\bridge.js`; `transform.mjs`; `topo.mjs`; `rewrite.mjs`; `resolve.mjs` |
| Persistent records | `apps\api\app\models.py` |

## Topology

```text
LEFT: ProjectPage composer/chat/activity/plan/files
RIGHT: PreviewPane iframe (browser Babel/ESM runner)

POST message -> chats.py
  -> classify_and_route
  -> Message + AgentRun(running)
  -> branch: image | clarify | single-pass | plan
  -> dispatcher task loop
  -> LLM text stream + <forge-write/edit/delete> operations
  -> apply_writes validates + mutates project repo
  -> SSE file_write + preview_refresh + done
  -> ProjectPage reduceStreamEvent -> debounced preview source re-post
```

NO_SERVER_BUILD_FOR_PREVIEW. Generated project source is transformed inside iframe with Babel. There is no generated `node_modules`, Vite server, or per-project dev server.

## Prompt/run protocol

```text
UI send:
POST /projects/{projectId}/chats/{chatId}/messages

Run recovery:
GET  /projects/{projectId}/chats/{chatId}/runs/active
GET  /projects/{projectId}/chats/{chatId}/runs/{runId}/events?after=<cursor>

Human gates:
POST .../runs/{runId}/clarify
POST .../runs/{runId}/confirm-plan
POST .../runs/{runId}/cancel
```

SSE_EVENT_TYPES:

```text
user_message  route  step  plan  plan_task  token  thinking  clarify
file_write    file_delete  preview_refresh  warning  error  done
```

CLIENT_RULES:

```text
chat-stream.ts is pure reducer: event -> {state,effects}.
ProjectPage performs effects.
file_write/delete only record operations; preview_refresh is the task-boundary refresh trigger.
clarify releases composer; plan.needs_confirm releases composer until explicit confirmation.
active runs are background tasks; browser/SSE disconnect must reconnect/replay, not terminate work.
```

## Agent mutation contract

```text
<forge-write path="src/App.tsx">FULL_FILE</forge-write>
<forge-edit path="src/App.tsx">SEARCH/REPLACE_HUNK</forge-edit>
<forge-delete path="src/Old.tsx"></forge-delete>
```

WRITE_PIPELINE:

```text
model output -> tags.py parse -> apply_writes.py
  -> project git snapshot
  -> import manifest allowlist validation (tree-sitter; regex fallback)
  -> protected brand guard: DESIGN.md, public/logo.* unless explicit brand request
  -> edit_apply: exact then whitespace-tolerant unambiguous match
  -> write project repo
```

CONTEXT_PIPELINE:

```text
context.py selects relevance + forced paths + plan-declared files/directories
then includes system prompt, AI_RULES.md, locked DESIGN.md, images/dimensions,
starter excerpt on young build, skeletons, selected bodies (max ~160k chars).
Do not assume agent explicitly requested all read files.
```

FIRST_BLANK_BUILD:

```text
brand_charter -> DESIGN.md palette/font/imagery direction -> first generated WebP images -> task execution
plans >= 4 tasks and scaffolds pause for user confirmation.
```

## Preview contract

```text
ProjectPage/usePreviewControl -> ensure/start runner -> PreviewPane iframe
PreviewPane GET /projects/{id}/files => {files, entry}
PreviewPane postMessage({type:"forge:render", files, entry}, exact iframe origin)
runner.js -> Babel TSX/React transform -> manifest import validation -> topo sort
          -> resolve/rewrite imports to blob URLs -> import(entry blob)
```

PREVIEW_RULES:

```text
packages.json = one manifest for preview import map + server import allowlist + Monaco types.
Do not make import map mutable after iframe load; extra deps are injected at runner shell creation.
Origin pinning is required both parent->iframe and iframe->parent; never "*".
During busy/streaming PreviewPane suppresses blocking error overlay because intermediate files may be inconsistent.
Soft refresh re-posts source to existing runner; avoid iframe remount/restart per file write.
```

## State/data

```text
Postgres: User -> Project -> Chat -> Message -> AgentRun
Generated workspace: data/projects/{projectId}, each its own private git repository
Event replay/cancel/claim: Valkey/Redis (24h); in-process mirror fallback when unavailable
Run resume fields: AgentRun status, plan, clarify answers, cursor_task_index
```

## Important boundaries

```text
LLM transport: httpx to OpenAI-compatible /chat/completions; no vendor SDK.
Output cutoff/open tags: llm.py continuation; unresolved cutoff is reported, never silently discarded.
Agent cannot freely import: manifest enforcement applies before write and at runner.
CSS ownership: src/index.css foundation; src/styles/<page>.css page-scoped.
Preview and publishing share the same runtime resolver; do not create divergent package/import behavior.
```

## Verification targets

```text
Prompt/send/replay: apps/web/lib/chat-stream.test.ts, lib/sse.test.ts
Preview: apps/web/lib/preview-state.test.ts, components/builder/*Preview*.test.tsx
Runtime: apps/api/runtime/tests/{transform,extra-imports,publish}.test.mjs
API/agent: apps/api/tests/ + targeted router/orchestration tests
```

UPDATE_IF: message route/SSE event contract, tag protocol, write validator, context policy, runner message schema/import resolver, preview lifecycle, project storage, or plan/clarify semantics change.
