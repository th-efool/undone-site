# Live cohort builder cutover — 2026-10-15

User authorized shared additive migrations, activation and production deployment.

## Root causes and repair

- Production intake returned `enabled:false`; the intake fallback linked into legacy creation.
- Vercel had no hosted interaction worker. The local `npm run dev` worker did not execute in production.
- Shared Neon had only eight engine tables; source DAG/artifact/effects/operational tables were absent.
- Chat tool definitions used obsolete AI SDK `parameters`, which omitted required inputs from provider-visible schemas.
- Mounted workspace stage selection chose the first returned job rather than the earliest unfinished dependency.

`interaction-dispatch.runtime.ts` reserves one SQL wake-up and starts `interaction.workflow.ts`. Each durable step runs one bounded iteration of the existing canonical worker, then checks persisted runnable jobs under the wake-up lock. Existing run/job leases, idempotency and event acceptance remain authoritative. Accepted intake, API mutations and owned workspace reload wake execution.

Chat stays editable during acknowledgement; successful sends clear only unchanged text. Disabled/failed new intake retains input without offering the legacy creator. Existing old draft routes remain intact. The mounted workspace uses the tested stage selector; queued checklist stages display pending rather than running.

## Shared installation

`node --import tsx --import ./scripts/register-root-environment.mjs scripts/interaction-deploy.ts --apply`

Six ordered scripts committed in one transaction: engine baseline, S3 storage, S4B source constraints, S5 effects, S6 operations, hosted workflow dispatch. Existing drafts were preserved. Fixed Neon pooled startup-option incompatibility in source runtime; timeouts now use query configuration and transaction-local SQL.

Vercel project `undone`: production `INTERACTION_TEXT_DRIVER=durable`, `INTERACTION_COHORT_V2_ENABLED=1`. Connector flags remain independently gated. `.vercelignore` excludes local credentials, scratch databases and planning files from manual deployments.

## Evidence

- `npm run verify:vercel`: passed TypeScript, package distributions, Prisma generation and production build (two compiled workflows).
- Sequential builder regression: 61 files / 440 tests passed before the provider-schema follow-up.
- Provider-schema / runner / scheduling / mounted stage / canonical progress follow-up: 5 files / 76 tests passed, including required `dailyMinutes` advertised through the actual AI SDK provider boundary.
- Shared `interaction:readiness` with enabled durable configuration: INITIAL_ROLLOUT / READY.
- Initial production deployment `dpl_56hBsAp6hjt17ctrx6hXPQqva5KR`: READY and aliased to `www.undone.one`; live intake now returns `enabled:true`.
- Real authenticated landing prompt + pasted source reached `/quest/build/e9b92638-cf2d-4926-a6a8-86f775aecce8`.
- Hosted worker completed initial assistant reply and all five durable source stages; snapshot reached ready with four grounded lessons. No local polling worker was running.
- Live textarea remained writable during send; newly typed text survived acknowledgement.
- First daily-minutes tool call exposed obsolete provider schemas and failed visibly; follow-up deployment and successful live retry still pending.

No database reset, existing draft deletion, authentication bypass or fixture mode was used for live verification.
