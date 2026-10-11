# Repository guide

## Application and checks

- `src/`: application, creation domain, infrastructure and tests.
- `prisma/`: database schemas and additive creation SQL migrations.
- `scripts/`: development, deployment checks and opt-in live smoke tools.
- `npm run dev` starts the web app and creation worker together. `dev:bare` requires a separate worker.
- `npx vitest run` and `npx tsc --noEmit` exclude temporary copies and exported web output.

## Cohort creation references

- [Architecture](../plans/cohort-creation-phase-2-architecture.md): accepted architecture and contracts.
- [Current checkpoint](../plans/cohort-creation-checkpoint.md): latest status and remaining verification.
- [Deployment](../plans/cohort-creation-phase-3-deployment.md): migration order, configuration and worker operations.
- [Live repair](../plans/cohort-creation-live-repair.md): verification evidence and known environment blockers.
- [Visual validation](../plans/cohort-creation-phase-4-validation.md): completed visual checks and limitations.
- [Before/after gallery](../plans/before-after/index.html): retained screen comparisons.

Original PNG references in `plans/new cohort creation flow/` and `plans/new dashboard screens/`, landing references in `artifacts/`, and runtime assets in `public/` remain available.

## Generated files

`.tmp/`, `.next/`, `out/`, generated Prisma clients and TypeScript build caches are local generated output, not source. Keep temporary test copies out of normal test discovery. `npm run update:structure` writes a local inventory to ignored `.tmp/directory-structure.md`; builds no longer rewrite a tracked directory listing.

Completed handoffs, unused prototypes, archived unused assets and superseded previews remain pending removal because automatic approval review rejected the deletion command. Keep accepted architecture, source references and useful verification tools; do not commit environment files or credentials. The old tracked `plans/directory-structure.md` is a historical snapshot, not the current generated inventory.
