/**
 * Read-only readiness check for Interaction Builder (S1 + S2 durability).
 * No paid model calls, writes, credentials, or secrets in output.
 */
import { Pool } from 'pg';
import { textDriver } from '../src/server/domain/cohort-builder/text-driver';
import { assertTextJobSchema } from '../src/server/domain/cohort-builder/text-schema-readiness';

type FailureReason = 'missing' | 'invalid_url' | 'dns_not_found' | 'dns_timeout' | 'authentication_failed' | 'connection_failed' | 'schema_incomplete';
type Check = { name: string; required: boolean; status: 'configured' | 'ready' | 'blocked' | 'not_configured'; reason?: FailureReason };

function connectionFailureReason(error: unknown): FailureReason {
  const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined;
  if (code === 'ENOTFOUND' || code === 'EAI_NONAME') return 'dns_not_found';
  if (code === 'ETIMEOUT' || code === 'EAI_AGAIN') return 'dns_timeout';
  if (code === 18 || code === '28P01') return 'authentication_failed';
  return 'connection_failed';
}

const isSecretConfigured = (value?: string) =>
  Boolean(value && value.length >= 20 && !/\[SENSITIVE\]|placeholder|changeme|^your[_-]/i.test(value));

export function interactionConfigurationChecks(env: NodeJS.ProcessEnv): Check[] {
  return [
    {
      name: 'DATABASE_URL presence (PostgreSQL)',
      required: true,
      status: env.DATABASE_URL ? 'configured' : 'blocked',
      reason: env.DATABASE_URL ? undefined : 'missing',
    },
    {
      name: 'Google Gemini key presence (not live validation)',
      required: true,
      status: isSecretConfigured(env.GEMINI_API_KEY) ? 'configured' : 'blocked',
      reason: isSecretConfigured(env.GEMINI_API_KEY) ? undefined : 'missing',
    },
    {
      name: 'Anthropic key presence (optional fallback)',
      required: false,
      status: isSecretConfigured(env.ANTHROPIC_API_KEY) ? 'configured' : 'not_configured',
    },
  ];
}

export async function interactionSqlCheck(): Promise<Check> {
  const check: Check = { name: 'PostgreSQL interaction schema (8 tables + indexes)', required: true, status: 'blocked' };
  if (!process.env.DATABASE_URL) return { ...check, reason: 'missing' };

  for (let attempt = 1; attempt <= 3; attempt++) {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 1,
      connectionTimeoutMillis: 15000,
      query_timeout: 15000,
    });

    try {
      const requiredTables = [
        'interaction_workspaces',
        'interaction_requests',
        'interaction_events',
        'interaction_messages',
        'interaction_outbox',
        'interaction_runs',
        'interaction_steps',
        'interaction_proposals',
      ];

      const tableRes = await pool.query<{ count: number }>(
        "SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema='public' AND table_name=ANY($1::text[])",
        [requiredTables]
      );

      const indexRes = await pool.query<{ count: number }>(
        "SELECT count(*)::int AS count FROM pg_indexes WHERE schemaname='public' AND tablename='interaction_runs' AND indexname='interaction_runs_active_unique_idx'"
      );

      if (tableRes.rows[0].count === requiredTables.length && indexRes.rows[0].count === 1) {
        if (textDriver() === 'durable') {
          check.name = 'PostgreSQL interaction + S3 durable text schema';
          await assertTextJobSchema({ query: (statement, parameters) => pool.query(statement, parameters) });
        }
        check.status = 'ready';
        check.reason = undefined;
      } else {
        check.reason = 'schema_incomplete';
      }
      await pool.end();
      break;
    } catch (error) {
      check.reason = connectionFailureReason(error);
      await pool.end().catch(() => {});
      if (attempt < 3 && check.reason === 'connection_failed') {
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
    }
  }

  return check;
}

async function main() {
  console.log('--- Interaction Builder Readiness Probe ---');
  const envChecks = interactionConfigurationChecks(process.env);
  const sql = await interactionSqlCheck();

  const allChecks = [...envChecks, sql];
  let allOk = true;

  for (const c of allChecks) {
    const mark = c.status === 'ready' || c.status === 'configured' ? '✓' : c.required ? '✗' : '○';
    const reasonText = c.reason ? ` (${c.reason})` : '';
    console.log(`${mark} [${c.status}] ${c.name}${reasonText}`);
    if (c.required && c.status === 'blocked') {
      allOk = false;
    }
  }

  if (!allOk) {
    console.log('\nResult: BLOCKED (one or more required checks failed)');
    process.exitCode = 1;
  } else {
    console.log('\nResult: READY (all required durability checks passed)');
  }
}

if (process.argv[1]?.endsWith('interaction-readiness.ts') || process.argv[1]?.endsWith('interaction-readiness.js')) {
  void main().catch(err => {
    console.error('Fatal probe error:', err instanceof Error ? err.message : 'Unknown');
    process.exitCode = 1;
  });
}
