# S4D Grounded GitHub Repository and File Ingestion Verification

S4D provides bounded, grounded ingestion of public GitHub repository files into
the cohort builder curriculum workspace with line-anchored provenance.
Live intake is disabled by default unless `INTERACTION_GITHUB_ENABLED === '1'` is set.
The workspace source capability endpoint reports `github: false` with
`GITHUB_CAPABILITY_DISABLED` by default. No private repository access, OAuth tokens,
git clone daemons, binary blobs, lockfiles, or paid API calls were introduced.

## Baseline and Boundary

Starting host was `9de32ce`, engine remains `bf96b84` (`packages/interaction-builder`).
S3, S4A, S4B, and S4C local journeys remain preserved and passing. S5 delivery models
remain intact and unchanged.

Scope and constraints:
- Public individual GitHub repositories only (`https://github.com/{owner}/{repo}`).
- Strict public URL validation (rejects credentials, query parameters, hashes, ports, traversal).
- Explicit ref: git branch, tag, or 40-char commit SHA (default `main`).
- Strict file paths: relative POSIX paths, no leading slashes, no `..`, supported extensions (`.md`, `.mdx`, `.txt`, `.ts`, `.tsx`, `.js`, `.jsx`, `.py`, `.json`, `.yaml`, `.yml`, `.go`, `.rs`, `.rb`, `.java`, `.c`, `.cpp`, `.h`, `.css`, `.html`).
- Hard limits: max 25 files, max 500 KB per file, max 2 MB total retained JSON, 200,000 UTF-8 extracted bytes, 15-second deadline.
- Explicit exclusions: binary files, compressed archives, images, media, lockfiles (`package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, etc.), git clone daemons, directory spidering over quota, private repositories, and OAuth tokens.

## Checkpoint 1 — Contracts, Bounded Scope, and Policy

Implemented in commit `c3100d5`:
- `src/shared/cohort-builder/github-source.ts`:
  - `singleGithubRepo`: URL parser enforcing `https://github.com/{owner}/{repo}` with alphanumeric/hyphen/period/underscore naming.
  - `githubRepoUrlSchema`: Zod schema transforming to canonical GitHub URL.
  - `githubRefSchema`: validates branch, tag, or 40-hex commit ref.
  - `isValidGithubFilePath`: path validator disallowing leading slashes, directory traversal (`..`), disallowed lockfiles and binary extensions.
  - `githubPathsSchema`: array of 1–25 unique sanitized file paths.
  - `retainedGithubSourceSchema`: immutable retained JSON format `github-source-v1` containing repo identity, ref, resolved 40-char commit SHA, and array of `{ path, content, size, checksum }`.
- `src/shared/cohort-builder/contracts.ts`:
  - Added `{ kind: 'github', repoUrl, ref, commitSha?, paths?: string[] }` to `sourceInputSchema`.
  - Added `filePath?`, `startLine?`, `endLine?` to `cohortSourceSchema.locations`.
  - Added `'selected_files'` to `provenance.scope`, plus `repoUrl?`, `commitSha?`, `ref?`, `fileCount?`.
  - Added `add_github_source` and `set_github_scope` to `cohortActionSchema`.
  - `planCohortAction` queues acquisition on `add_github_source` and reuses retained raw artifact on `set_github_scope` without re-fetch.
- `src/server/domain/cohort-builder/github-policy.ts`:
  - Capability gating: `githubSourceReadiness()` checks `INTERACTION_GITHUB_ENABLED === '1'`. Defaults to disabled (`GITHUB_CAPABILITY_DISABLED`).
- `src/server/domain/cohort-builder/source-policy.ts`:
  - Integrated `github` into `sourceCapability` and `validateSourceAction`.
- Tests: 19 unit tests in `src/shared/cohort-builder/__tests__/github-source.test.ts` pass.

## Checkpoint 2 — Retention and Line-Anchored Extraction

Implemented in commit `6a258f7`:
- `src/server/domain/cohort-builder/github-source.ts`:
  - Injected non-billing `GithubSourceProvider` port:
    - `resolveRef(repo: {owner: string; repo: string}, ref: string, signal: AbortSignal): Promise<{commitSha: string}>`
    - `fetchFiles(repo: {owner: string; repo: string}, commitSha: string, paths: string[], signal: AbortSignal): Promise<Array<{path: string; content: Uint8Array}>>`
  - Bounded size limits, 15s deadline/timeout, SSRF protection, binary file detection (`BINARY_FILE_REJECTED`).
  - `extractGithubSource`: validates raw checksum and commit SHA, concatenates selected files with clear document boundaries, and computes exact UTF-16 character offsets and line-number ranges (`filePath`, `startLine`, `endLine`) for each passage.
  - `acquireGithubSource`: acquires files via provider port, verifies commit SHA, and returns `source_raw` bytes.
  - `readOwnedGithubSource`: validates workspace ownership and artifact checksum.
- `src/server/domain/cohort-builder/source-adapters.ts`:
  - Updated `extractRetainedSource` to handle `source.input.kind === 'github'` and derive cache keys using `GITHUB_SOURCE_VERSION`.
- Tests: 11 tests in `src/server/domain/cohort-builder/__tests__/github-source.test.ts` and 13 tests in `source-adapters.test.ts` pass.

## Checkpoint 3 — Durable DAG and Canonical Acceptance

Implemented in commit `579da8c`:
- `src/server/domain/cohort-builder/text-job-plan.ts`:
  - Supports `github` source kind in DAG generation (acquisition -> extraction -> understanding -> chunking -> analysis -> assembly) with version `GITHUB_SOURCE_VERSION`.
- `src/server/domain/cohort-builder/text-source-processor.ts`:
  - Injects `GithubSourceProvider` port, executes acquisition, writes immutable `source_raw` artifact, and executes extraction with line-anchored locations.
- `src/server/domain/cohort-builder/durable-text-worker.ts`:
  - Accepts and forwards `githubSourceProvider`.
- `src/server/domain/cohort-builder/text-job-acceptance.ts`:
  - Validates GitHub repo owner, repo name, ref, and re-derives extraction proof under workspace lock before projection.
- Tests: 5 composed PGlite tests in `src/server/domain/cohort-builder/__tests__/github-canonical-jobs.test.ts` pass:
  - Disability gating rejects GitHub action when disabled.
  - Complete DAG runs from `add_github_source` through acquisition, extraction, chunking, analysis, and assembly.
  - Scope updates (`set_github_scope`) re-slice retained raw bytes without calling provider again.
  - Honest failed state and targeted retry.
  - Rejection of fabricated extractions under CAS consistency.

## Checkpoint 4 — UI and Chat Parity

Implemented in commit `3a1e911`:
- `src/server/domain/cohort-builder/tools.ts`:
  - Registered `add_github_source` and `set_github_scope` AI tools returning canonical actions and preserving deterministic step IDs.
- `src/server/domain/cohort-builder/context.ts`:
  - Bound `github: sourceCapability('github')` to assistant context and provided explicit capability guidance in prompt.
- `src/app/api/cohort-builder/workspaces/[workspaceId]/sources/route.ts`:
  - Exposes `github: ready && sourceCapability('github')` and `githubUnavailableReason`.
- `src/client/screens/cohortBuilder/ExternalSources.tsx`:
  - Honest disabled notice: `GitHub repository ingestion is currently unavailable (${reason})`.
  - Intake form with repo URL, title, branch/ref, and comma/newline-separated file paths (max 25 files).
  - `ExternalSourceScope`: displays current file paths, input to modify file scope with range validation, and dispatches canonical `set_github_scope` with entity versions `[{ kind: 'source', id: source.id, version: baseVersion }]`.
  - Conflict recovery: retains user draft file selection across concurrent workspace changes with button to reapply.
- `src/client/screens/cohortBuilder/CohortWorkspacePane.tsx`:
  - Evidence citations inspect `source.locations` for `filePath`, `startLine`, `endLine` and render exact citations: `{filePath}#L{startLine}-L{endLine}`.
  - Displays repository provenance: `{repoUrl}@{commitSha}`.
- Tests:
  - `external-tools.test.ts`: tool execution, prompt capability, and system prompt text.
  - `ExternalSources.test.tsx`: disabled notice, intake dispatch, file scope validation/dispatch, and concurrent conflict recovery.
  - `CohortWorkspacePane.test.tsx`: line-anchored file citation rendering.

## Checkpoint 5 — Integrated Acceptance and Verification

Integration harnesses extended:
- `scripts/s3-postgres-verification.ts`:
  1. Disability proof: verifies that `add_github_source` is rejected with `SOURCE_CAPABILITY_DISABLED` when capability flags are not set.
  2. Mock-enabled execution: commits `add_github_source` on an owned workspace with mock repo files.
  3. Executes durable ticks with injected non-billing `GithubSourceProvider` through acquisition, extraction, chunking, analysis, and assembly.
  4. Verifies line-anchored locations (`filePath`, `startLine`, `endLine`) and immutable `source_raw` artifact storage.
  5. Verifies scope reduction (`set_github_scope`) reuses retained raw bytes without calling provider again (`providerCallCount === 1`).
  6. Verifies event sequence matches sequence and revision.
- `scripts/s3-browser-verification.mjs`:
  1. On the disabled host, verifies that `Add GitHub source` button count is 0.
  2. Verifies that the honest notice `GitHub repository ingestion is currently unavailable` is displayed.

Verification outcomes:
- `npx vitest run`: 41 test files passed (240 tests passed, 0 failures across server, shared, and client test suites).
- `npx tsc --noEmit`: exited 0 with no errors.
- `npm run interaction:worker:check`: exited 0 with valid imports.
- `node scripts/verify-packed-consumer.mjs`: exited 0; packed tarball installation, types, and execution verified in an isolated temp environment.
- `npm run verify:vercel`: exited 0 (pre-push hook builds and verifies optimized Next.js production build).
- Test ports `3107/3108/15433/15434` remain clean and released.

## Outstanding Gates (Still Open)

Live GitHub acquisition is gated behind `INTERACTION_GITHUB_ENABLED === '1'` (default disabled, reporting `GITHUB_CAPABILITY_DISABLED`).
Public REST raw-fetch or authenticated provider connectivity, rate limits, and egress security boundaries must be reviewed and configured before enabling production intake.
Shared schema installation, durable driver activation in production, and S5 delivery release remain unauthorized.
