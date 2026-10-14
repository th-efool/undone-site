# S3 local verification

Scope: retained pasted text only. No connectors, discovery, publishing or paid
provider calls. The authoritative reusable package remains unchanged.

## Isolated services

Install verification-only binaries outside production dependencies:

```powershell
npm install --prefix .tmp/s3-postgres-runtime --no-save --no-package-lock --no-audit --no-fund embedded-postgres@18.4.0-beta.17 playwright-core@1.63.0
node scripts/s3-local-environment.mjs --serve
```

The harness creates a fresh PostgreSQL cluster under `.tmp`, binds loopback,
generates the full schema from empty, applies additive interaction/S3 SQL, and
creates a separate detached checkout with a local-only `.env`. It never copies
the shared `.env`. Services stop on Ctrl+C; test data remains locally retained.

Copy the printed local settings into a second PowerShell session:

```powershell
$env:S3_TEST_DATABASE_URL='postgresql://s3test:s3-local-only@127.0.0.1:15433/s3test'
$env:S3_TEST_HOST_DIRECTORY='<printed detached checkout path>'
node --conditions=react-server --import tsx scripts/s3-postgres-verification.ts
node scripts/s3-browser-verification.mjs
```

The browser harness uses installed Chrome, a seeded disposable user, and the
normal signed Auth.js session. It starts the actual supervised worker and
uses the real builder route, HTTP API and SSE. The deterministic provider fixture
is explicitly enabled only for development and a loopback `s3test` database.
Production and remote-database attempts reject this fixture. No authentication
bypass is added.

The PostgreSQL script refuses remote/non-test database URLs and checks separate
connections for duplicate requests, claims, expired leases, source-edit races,
event rollback, restart and sequence consistency. The browser checks retained
source intake, chat goal, evidence, selected refinement, manual edits/pins,
reload, changed scope, worker restart, visible failure/targeted retry, reconnect,
two authenticated tabs and preservation of unsent input during conflicts.

## Regression

```powershell
npx tsc --noEmit --pretty false
npx vitest run --maxWorkers=2
```

Keep browser services stopped during the broad suite on constrained machines.
Focused source-job tests complement real PostgreSQL/browser checks.

## Shared rollout

The shared database migration remains unapplied. Authorization is still required
before installing `prisma/interaction-s3-storage.sql` there. See
`plans/interaction-builder/s3-schema-rollout.md` for the reviewed additive command.
HTTP and worker processes must use the same `INTERACTION_TEXT_DRIVER=durable`
setting after schema readiness passes. Existing workspaces with a durable marker
are excluded from snapshot workers. Missing schema or unsupported handlers fail
durable startup; HTTP mutation failure rolls back rather than losing source work.

Stage processing has a 45-second computation deadline, bounded SQL waits and a
three-attempt ceiling. Retries preserve accepted prerequisites and source artifacts.
Source text remains user-provided evidence; grounding does not independently
verify its factual accuracy. Broader pedagogical evaluations and production
rollout remain separate from this pasted-text slice.
