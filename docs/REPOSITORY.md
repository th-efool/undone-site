# Repository guide

## Application and checks

- `src/`: application, creation domain, infrastructure and tests.
- `prisma/`: database schemas and additive creation SQL migrations.
- `scripts/`: development, deployment checks and opt-in live smoke tools.
- `npm run dev` starts the web app and creation worker together. `dev:bare` requires a separate worker.
- `npx vitest run` and `npx tsc --noEmit` exclude temporary copies and exported web output.

## Cohort creation references

Planning, AI-generated design artifacts, archived assets, and visual validation material are maintained on the `planning` branch. Keep application and runtime assets on this branch under `src/`, `public/`, and `android/`.

## Generated files

`.tmp/`, `.next/`, `out/`, generated Prisma clients and TypeScript build caches are local generated output, not source. Keep temporary test copies out of normal test discovery. `npm run update:structure` writes a local inventory to ignored `.tmp/directory-structure.md`; builds no longer rewrite a tracked directory listing.

Keep accepted architecture, source references and useful verification tools on `planning`; do not commit environment files or credentials. The old `plans/directory-structure.md` is a historical snapshot, not the current generated inventory.
