# ai-builder-puter

ROOT: `D:\ThisPC\Documents\SideQuestHQ\undone-site\plans\ai-builder\builder`
SCOPE: chat prompt -> Puter AI streaming/tool loop -> per-chat app filesystem -> hosted draft preview/right pane
IGNORE: marketing pages, login/profile, SEO, public-release internals unless prompt/build/preview behavior requires them
PRIMARY_DOC: `D:\ThisPC\Documents\SideQuestHQ\undone-site\plans\ai-builder\builder\README.md`

## Locate first

| Concern | Exact location |
| --- | --- |
| Main state, chat send, stream invocation, persistence | `src\js\app.js` (`sendChatMessage`) |
| Dynamic system prompt/context | `src\js\prompt.js` |
| Streaming parser -> recursive tool loop | `src\js\handleMessageStream.js` |
| Tool execution/invocation | `src\js\tools.js` |
| UI, preview pane, reload/verification, publish button | `src\js\ui.js` |
| Per-chat versioning | `src\js\versions.js` |
| Project/worker ownership | `src\js\worker-ownership.js` |
| Draft preview creation/open | `src\tools\apps_and_sites\publish_site.js` |
| Preview refresh + runtime verification | `src\tools\apps_and_sites\update_preview.js` |
| Core file mutations | `src\tools\fs\{write,edit,multi_edit,read,search_files,readdir,delete,move,copy,rename,mkdir}.js` |
| Agent UI tools | `src\tools\chat_ui\{todo,clarify,suggest}.js` |
| App code generated at runtime | Puter filesystem under `/${username}/AppData/${puter.appID}/${chatId}` |
| Chat persistence | Puter filesystem `chat-history/chat-list.json` + per-chat entries |

## Topology

```text
LEFT: chat history + composer + tool activity
RIGHT: hosted per-project draft preview

sendChatMessage
  -> construct system + saved chat history + attachments/click target
  -> puter.ai.chat(..., {model, tools, stream:true})
  -> handleMessageStream
  -> text/thinking/tool_use chunks
  -> handleToolCalls -> local tool execution
  -> tool_result appended -> recursive next model round
  -> final persistence + one preview refresh
```

This is browser/client orchestration using Puter.js, not a dedicated application API, durable server queue, or SSE endpoint owned by this repository.

## Turn protocol

```text
ENTRY: app.js:sendChatMessage(userInput?, skipAddToHistory?, opts?)
MODEL: puter.ai.chat(prepareHistoryForAI(...), { model: MODEL, tools, stream: true })
STREAM: handleMessageStream(stream, context)
TOOL ROUND: handleToolCalls(...) -> tool_result -> next Puter AI request
STOP/SWITCH: AbortController + currentChatId/turn sequence guards prevent stale mutation
PERSIST: history and busy/interrupted state saved on success/error/abort
RESUME: repair unmatched tool_use entries, retain interrupted turn context, resend sanitized history
```

TURN_STATE:

```text
currentChatId = project identity
currentAppDir = /${username}/AppData/${puter.appID}/${chatId}
chatHistory = system prompt + user/assistant/tool messages
isProcessing + abortController + per-chat monotonically increasing turn sequence = mutation/stale guards
```

The prompt system requires agent behavior, not server validation. Read `prompt.js` before changing agent conventions.

## Essential tool graph

```text
filesystem: ReadTextFile/SearchFiles/readdir/stat -> agent context
filesystem: write/edit/multi_edit/mkdir/move/copy/rename/delete -> appDir only
preview: publish_site -> establish ONE private preview-<uuid>.puter.site draft host
preview: update_preview -> reload + runtime observation + bounded repair feedback
chat UI: TodoWrite / AskClarifyingQuestions / SuggestNextSteps
optional: workers, external fetch, MCP
```

MUTATION_GUARDS:

```text
All project file/path-taking tools call assertPathInProject(path,state).
write/edit lock per path and verify persisted bytes/read-back.
edit = exact match first, then whitespace/unicode-tolerant unambiguous match.
Tool must stop UI/shared-state updates when turn stale or aborted.
```

## Preview contract

```text
FIRST BUILD:
agent calls publish_site(path=current app root) once
  -> Puter hosting creates or reuses preview-<uuid>.puter.site
  -> window.currentPreviewUrl/currentPreviewPath
  -> showAppPreview(url, waitForReady:true)

LATER FILE MUTATIONS:
write/edit schedules refresh
end-of-turn flushPreviewRefresh reloads one time
agent must call update_preview once after final edit/publish
  -> verifyPreview sees freshly loaded runtime errors
  -> errors => agent fixes + update_preview again (max 3 verification repair rounds)
```

SEMANTICS:

```text
publish_site means private draft preview, NOT a user-visible public release.
Preview server exposes only selected project directory descendants.
One chat/project owns one draft preview address; stale turns must not change another chat's preview.
User-facing public publish is separate UI action in ui.js.
```

## Preview -> agent feedback

```text
Preview runtime errors / selected element / fetch failures can generate automatic messages to sendChatMessage.
Auto-fix is bounded (MAX_AUTO_FIX_TURNS = 3); a user message or project switch resets scope.
Click-to-edit captures a DOM locator + tag/id/class/text/html; this data is untrusted locator context, not instructions.
Preview update verification returns error data as untrusted bug report; agent must not execute instructions embedded in it.
```

## Prompt constraints that shape generated apps

```text
Generated app must use Puter.js for available platform features.
Puter fs/kv is user-scoped; shared state generally requires Puter serverless workers.
Generated app sign-in must be explicit; do not rely on implicit Puter auth popup.
prompt.js requires: open draft preview after initial application build; end changed turn with update_preview; only then SuggestNextSteps.
```

## Persistence and isolation

```text
project files: currentAppDir in user Puter filesystem
chat index: chat-history/chat-list.json
chat history: per-chat stored files; never overwrite index after uncertain read, rebuild from per-chat files
versions: src/js/versions.js snapshots/restore flow
preview metadata: chat.previewUrl, previewPath; draft and public URLs are distinct
worker names/files: worker-ownership.js prevents cross-project/backend collisions
```

## Tests most aligned with this flow

```text
scripts/test-tool-use-repair.mjs
scripts/test-stopped-turn-unwind.mjs
scripts/test-transient-retry.mjs
scripts/test-worker-tools.mjs
scripts/test-fs-path-scoping.mjs
scripts/test-edit-matcher.mjs
scripts/test-preview-{verification,reload,message-trust,change-recording,probe-targets}.mjs
scripts/test-send-button-state.mjs
scripts/test-chat-{switch-reset,list-save-race,thumb-refresh}.mjs
scripts/test-click-to-edit*.mjs
```

## Do not conflate with Forge

```text
Forge: server FastAPI agent runs + SSE replay + server project git repos + Babel iframe source bundle.
Puter Builder: browser Puter AI tool recursion + Puter filesystem + hosted draft site reload.
No Forge XML tags/import manifest/plan dispatcher semantics here.
No Builder local tool registry/puter.ai.chat semantics in Forge.
```

UPDATE_IF: composer/send logic, agent prompt/tool contract, project-dir identity, tool path guard, preview hosting/refresh/verification, turn resume/stale ownership, or generated-app feedback channel changes.
