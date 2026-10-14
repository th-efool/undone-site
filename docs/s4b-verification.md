# S4B PDF and public web sources

Local implementation adds owned PDF uploads and public HTTPS page ingestion to the
canonical cohort action/DAG/artifact/acceptance/event path. The reusable engine
submodule is unchanged. Shared schema installation and activation remain unauthorized.

## Limits and policy

- `INTERACTION_PDF_ENABLED=1` and `INTERACTION_WEB_ENABLED=1` independently enable
  new submissions; both default off. Durable driver and S4B SQL constraints are required.
- PDF: 2 MiB raw input, 200 physical pages, 200,000 UTF-8 extracted bytes, no OCR.
  Empty, encrypted, scanned or partly unreadable documents fail rather than skip pages.
  Explicit physical-page scope applies to a retained complete readable extraction.
- Web: HTTPS only, no credentials/custom ports, public pinned DNS/socket addresses,
  three redirects, 30-second acquisition, 1 MiB response, UTF-8 HTML/plain/Markdown.
  Compressed, authenticated, unsupported or oversized responses are rejected.
  HTML extraction is isolated (20 seconds/192 MiB), strips active content and loads
  no remote resources. Main-article extraction does not claim exhaustive page coverage.
- Retained SQL artifacts are owned, checksummed and immutable by application contract.
  Extracted bodies are untrusted evidence, never tool instructions. Events carry
  receipts, not document bodies. Safe job diagnostics contain no artifact bodies.
- Page-scope changes reuse retained input; explicit web refresh creates a new source
  version and fetches anew. Source Stop fences its pending work; other sources keep
  progressing. Assembly remains blocked until the stopped source is rescoped/removed.
- Parser/fetch support is intentionally narrower than all possible PDFs/HTTP pages.

## Reproduction

Use existing verification-only dependencies documented in `docs/s3-verification.md`.
Start a fresh fixture for each SQL gate (unfinished synthetic graphs affect global claims):

```powershell
node scripts/s3-local-environment.mjs
$env:S3_TEST_DATABASE_URL='<printed loopback s3test URL>'
node --conditions=react-server --import tsx scripts/s3-postgres-verification.ts
```

Stop that fixture, then start a fresh authenticated browser environment:

```powershell
node scripts/s3-local-environment.mjs --serve --working-tree
$env:S3_TEST_DATABASE_URL='<printed loopback s3test URL>'
$env:S3_TEST_HOST_DIRECTORY='<printed detached checkout>'
node --import tsx scripts/s3-browser-verification.mjs
```

The real Next route/API, signed Auth.js session, PostgreSQL, supervised worker and
SSE are used. Only providers/network responses are deterministic. The fixture
transport requires development + an explicit flag + loopback s3test database;
production URL/DNS validation is not disabled. No shared credentials or paid calls.

## Rollout (not performed)

After separate authorization and review of the S3 rollout, install
`prisma/interaction-s4b-sources.sql` using the same transactional SQL migration
workflow, before enabling either flag. It expands named artifact/stage CHECKs;
no shared migration, `db push`, reset, feature activation or deployment was performed.
HTTP and worker must use the same durable driver/schema. Old workers cannot claim
version-2 external jobs. Node source workers require installed `tsx`, parser assets
and source worker files; production build is not deployment validation.

Reviewed operator command, only after authorization and with the operator's chosen
database environment (the SQL file contains its own transaction):

```powershell
psql --set ON_ERROR_STOP=1 --file prisma/interaction-s4b-sources.sql
```

## Evidence

Final separate-connection PostgreSQL command exited 0 on a fresh loopback
fixture: canonical idempotency, concurrent claims, lease replacement, edit versus
acceptance, rollback, restart, FIFO/cancellation fences, atomic owned PDF input,
actual PDF/web extraction and assembly, and contiguous snapshot/event revisions.
The expected injected `TEST_INTAKE_ROLLBACK` diagnostic is not a failed gate.

Final full authenticated browser command exited 0 (`BROWSER_JOURNEY_PASS`):
landing/auth return, lost intake/chat/PDF acknowledgements, PDF physical-page
evidence, web acquisition failure/targeted retry, scoped retained-input reuse,
real worker restart, external-source lesson refinement through the model/tool
adapter, pins/manual edits, reload, mobile drafts, reconnect, two-tab conflicts,
assistant Stop, disabled PDF/web/new-intake policy with existing resume, and v1.
The `--s4b-only` option selects a faster subset of the same harness, not a second
implementation. Final gate used the full command above.

Engine `bf96b84` repairs generic snapshot coalescing under event bursts; package
tests: 23 files/82 tests passed. `node scripts/verify-packed-consumer.mjs` exited 0
with fresh external installation, public types/exports, model/tool roundtrip,
stale conflicts, proposals and React boundary verification. Packed checks do not
substitute for the real SQL/browser gates.

Checkpoint commits and final host regression/build results are recorded in
`MEMORY/interaction-builder-execution.md`. Initial browser runs caught timing
races in fixture waits and generic snapshot coalescing; final waits observe
canonical readiness plus the corresponding rendered revision. Cold disabled
server navigation has a bounded 120-second compile allowance. A parallel full
regression run timed out an unchanged v1 test; final regression runs alone after
fixture shutdown. No production auth or SSRF checks were weakened.

Final host checks: `npx vitest run --maxWorkers=2` passed 191 files/1223 tests
(1 file and 2 existing tests skipped); `npm run verify:vercel` exited 0 with
TypeScript, public distributions, Prisma generation and optimized production build
(43.1 seconds). `npm run interaction:worker:check` exited 0 without database/model
calls. Existing middleware/pdfjs warnings remain. All fixture services stopped.
