/** Isolated verification helper: one real configured durable tick, no assistant/provider call. */
import { createTextJobRuntime } from '../src/server/infrastructure/db/postgres/text-job-runtime';
async function main() {
  const url = new URL(process.env.S3_TEST_DATABASE_URL ?? '');
  if (!['127.0.0.1','localhost'].includes(url.hostname) || !url.pathname.startsWith('/s3test')) throw new Error('ISOLATED_TEST_DATABASE_REQUIRED');
  const runtime = await createTextJobRuntime(url.toString(), 's3-isolated-once', 60_000);
  try { console.log(JSON.stringify(await runtime.tick())); } finally { await runtime.close(); }
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
