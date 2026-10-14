# S4A intake and workspace verification

S4A covers landing goal + optional pasted text, authenticated confirmation,
atomic intake, stable responsive workspace, queued assistant turns, cancellation,
conflict recovery, and resume. Source connectors and release work remain later slices.

## Configuration

- `INTERACTION_COHORT_V2_ENABLED=1` enables new cohort intake; default is disabled.
- Optional `INTERACTION_COHORT_V2_OWNERS` is a comma-separated server owner allowlist.
- New v2 intake requires `INTERACTION_TEXT_DRIVER=durable` and the installed S3 schema.
- Disabling intake preserves owned v2 reads/resume and existing v1 routes.
- HTTP and supervised worker must select the same durable driver after authorized rollout.

The shared database has not been migrated or activated. See the reviewed S3 rollout
plan; separate authorization is still required. These checks use disposable loopback
PostgreSQL, signed test sessions and guarded deterministic providers, without paid calls.

## Reproduction

Install the verification-only dependencies listed in `docs/s3-verification.md`.
Start a fresh local environment for the PostgreSQL gate:

```powershell
node scripts/s3-local-environment.mjs
```

In a second shell, use the printed connection string:

```powershell
$env:S3_TEST_DATABASE_URL='<printed loopback s3test URL>'
node --conditions=react-server --import tsx scripts/s3-postgres-verification.ts
```

Stop that fixture. Use a fresh environment for the browser gate so unfinished
synthetic intake turns from the SQL gate do not consume its scripted provider turns:

```powershell
node scripts/s3-local-environment.mjs --serve --working-tree
```

In a second shell, use both printed values:

```powershell
$env:S3_TEST_DATABASE_URL='<printed loopback s3test URL>'
$env:S3_TEST_HOST_DIRECTORY='<printed detached checkout>'
node scripts/s3-browser-verification.mjs
```

The browser harness uses installed Chrome, normal Auth.js signed sessions, the actual
Next route/API/SSE, supervised worker and real PostgreSQL. It also starts a separate
local HTTP fixture with intake disabled. No production authentication is weakened.
The fixture checkout may copy current source changes when `--working-tree` is selected.
Ctrl+C stops the local environment; synthetic data and screenshots remain under `.tmp`.

## Coverage

SQL: atomic intake/rollback, concurrent and lost-response retries, mismatched payloads,
canonical events, exclusive claims, stale leases, source-edit acceptance races,
FIFO pending messages, queue ceiling, idempotent cancellation and transcript fences.

Browser: private landing/authentication return, intake acknowledgement loss/retry,
grounding/evidence, selected refinement, pins/manual edits, mobile draft preservation,
reload, source invalidation, worker restart, partial failure/targeted retry, reconnect,
two-tab conflicts, explicit editor reapplication, queued messages, lost chat
acknowledgement, Stop, disabled intake with existing resume, and v1 route compatibility.

Workspace drafts remain in mounted, identity-keyed components; they are not saved to
browser storage. Only pending landing intake is stored in tab-local session storage,
expires after one hour, binds to the confirmed owner, and is removed on logout or
identity mismatch. HTTP intake also requires the expected authenticated owner.
Legacy landing prompts use the private handoff; old explicit `q` links remain supported.

Run the repository regression/typecheck/build commands recorded in MEMORY after
stopping browser services. Component/SSR tests complement the browser and SQL gates.

## Verified results — 2026-10-14

- `node --conditions=react-server --import tsx scripts/s3-postgres-verification.ts`: exit 0 on fresh real PostgreSQL, separate connections; all S3/S4A assertions passed.
- `node scripts/s3-browser-verification.mjs`: exit 0, `BROWSER_JOURNEY_PASS`; complete authenticated journey, queue/lost-response recovery, running Stop and disabled-intake/legacy handoff passed.
- `npx vitest run --maxWorkers=2`: 188 files, 1201 tests passed; 2 existing skips.
- `npx tsc --noEmit --pretty false`: exit 0.
- `npm run verify:vercel`: exit 0, optimized production build passed. Existing middleware/pdfjs warnings remain.

Checkpoint commits: intake `5f0aa02`, responsive shell `7d6ba14`, chat retry
`7e343fe`, final integration commit titled `Finish S4A intake and workspace journey
with verified browser and SQL gates`. Concurrent package/queue/UI commits
`64b9d61`, `fedfeac`, `fe66977` were preserved. Package pointer: `f2f78b9`.

S4A is complete locally. S4 overall and shared rollout are not complete; S4B is next.
No shared migrations, paid calls, registry publication or deployment occurred.
