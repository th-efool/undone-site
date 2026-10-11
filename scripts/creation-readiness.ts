/** Read-only readiness gate. No paid model calls, writes, credentials or raw errors in output. */
import { pathToFileURL } from 'node:url';
import { Pool } from 'pg';
import mongoose from 'mongoose';
import { readCorsairConfig } from '../src/server/corsair-config';

type Check = { name: string; required: boolean; status: 'configured' | 'ready' | 'blocked' | 'not_configured' };
const secret = (value?: string) => Boolean(value && value.length >= 20 && !/\[SENSITIVE\]|placeholder|changeme|^your[_-]/i.test(value));
const httpUrl = (value?: string, originOnly = false) => {
  try { const url = new URL(value!); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password &&
    (!originOnly || url.pathname === '/') && !url.search && !url.hash; } catch { return false; }
};
export function configurationChecks(env: NodeJS.ProcessEnv): Check[] {
  const authOrigins = [env.AUTH_URL, env.NEXTAUTH_URL].filter(Boolean);
  let corsair = false;
  try { readCorsairConfig(env); corsair = true; } catch { /* Never log secret-bearing configuration. */ }
  return [
    { name: 'authentication origins', required: true, status: authOrigins.length && authOrigins.every(value => httpUrl(value)) ? 'configured' : 'blocked' },
    { name: 'authentication secret', required: true, status: secret(env.AUTH_SECRET || env.NEXTAUTH_SECRET) ? 'configured' : 'blocked' },
    { name: 'Google key presence (not live validation)', required: true, status: secret(env.GEMINI_API_KEY) ? 'configured' : 'blocked' },
    { name: 'site metadata origin', required: true, status: !env.NEXT_PUBLIC_APP_URL || httpUrl(env.NEXT_PUBLIC_APP_URL) ? 'configured' : 'blocked' },
    { name: 'YouTube key presence (video capability)', required: false, status: secret(env.YOUTUBE_API_KEY) ? 'configured' : 'not_configured' },
    { name: 'legacy Corsair configuration', required: false, status: corsair ? 'configured' : 'not_configured' },
    { name: 'private creation connectors configuration', required: false,
      status: httpUrl(env.CREATION_CONNECTOR_ORIGIN, true) && /^[a-f0-9]{64}$/i.test(env.CREATION_CORSAIR_KEK || '') &&
        !/^0+$/.test(env.CREATION_CORSAIR_KEK || '') && /^ck_(dev|prod)_/.test(env.CREATION_CORSAIR_API_KEY || '') &&
        secret(env.CREATION_CORSAIR_SIGNING_SECRET) ? 'configured' : 'not_configured' },
  ];
}

async function sqlCheck(): Promise<Check> {
  const check: Check = { name: 'SQL creation schema', required: true, status: 'blocked' };
  if (!process.env.DATABASE_URL) return check;
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1,
    connectionTimeoutMillis: 5000, query_timeout: 5000 });
  try {
    const tables = ['creation_drafts', 'creation_jobs', 'creation_events', 'creation_budgets', 'creation_storage_objects',
      'creation_conversation_entries', 'creation_publication_reservations', 'creation_publications'];
    const result = await pool.query("SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema='public' AND table_name=ANY($1::text[])", [tables]);
    const columns = await pool.query("SELECT count(*)::int AS count FROM information_schema.columns WHERE table_schema='public' AND ((table_name='creation_drafts' AND column_name IN ('expiredAt','eventSequence')) OR (table_name='cohorts' AND column_name='creationSettings'))");
    if (result.rows[0].count === tables.length && columns.rows[0].count === 3) check.status = 'ready';
  } catch { /* Redact driver errors, which can include connection details. */ }
  finally { await pool.end(); }
  return check;
}
async function mongoCheck(): Promise<Check> {
  const check: Check = { name: 'Mongo connection/ping (not blob permissions)', required: true, status: 'blocked' };
  if (!process.env.MONGODB_URI) return check;
  let client: mongoose.mongo.MongoClient | undefined;
  try {
    client = new mongoose.mongo.MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000, connectTimeoutMS: 5000, maxPoolSize: 1 });
    await client.connect();
    await client.db().command({ ping: 1 });
    check.status = 'ready';
  } catch { /* No URI, host, credentials or raw error text. */ }
  finally { await client?.close(); }
  return check;
}
async function main() {
  const checks = [...configurationChecks(process.env), ...await Promise.all([sqlCheck(), mongoCheck()])];
  for (const check of checks) console.log(JSON.stringify(check));
  const blocked = checks.filter(check => check.required && check.status === 'blocked').length;
  console.log(JSON.stringify({ corePrerequisites: blocked ? 'blocked' : 'ready_for_live_smoke', blocked,
    notVerified: ['authentication session', 'Google generation/search quota', 'blob write/read permissions', 'worker execution', 'browser journeys', 'publication/access'] }));
  process.exitCode = blocked ? 1 : 0;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => { console.error('Readiness check unavailable; details suppressed.'); process.exitCode = 1; });
}
