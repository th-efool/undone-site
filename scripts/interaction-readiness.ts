/**
 * Read-only readiness and configuration probe for Interaction Builder & Canonical Cohort Builder.
 * S6A operational readiness: fail-closed validation, driver agreement, zero secret disclosure.
 * No paid model calls, writes, credentials, or secrets in output.
 */
import { Pool } from 'pg';
import { textDriver } from '../src/server/domain/cohort-builder/text-driver';
import { assertTextJobSchema } from '../src/server/domain/cohort-builder/text-schema-readiness';
import { assertSourceSchema } from '../src/server/domain/cohort-builder/source-policy';
import { assertReleaseSchema } from '../src/server/domain/cohort-builder/release-schema-readiness';

export type FailureReason =
  | 'missing'
  | 'invalid_url'
  | 'dns_not_found'
  | 'dns_timeout'
  | 'authentication_failed'
  | 'connection_failed'
  | 'schema_incomplete'
  | 'invalid_driver'
  | 'durable_driver_required'
  | 'unsupported_handler_version'
  | 'missing_provider_credentials'
  | 'rate_limit_risk'
  | 'forbidden_fixture_configuration';

export type Check = {
  name: string;
  required: boolean;
  status: 'configured' | 'ready' | 'blocked' | 'not_configured' | 'disabled';
  reason?: FailureReason;
  details?: string;
};

export function connectionFailureReason(error: unknown): FailureReason {
  const code = typeof error === 'object' && error !== null && 'code' in error ? (error as any).code : undefined;
  if (code === 'ENOTFOUND' || code === 'EAI_NONAME') return 'dns_not_found';
  if (code === 'ETIMEOUT' || code === 'EAI_AGAIN') return 'dns_timeout';
  if (code === 18 || code === '28P01') return 'authentication_failed';
  return 'connection_failed';
}

export const isSecretConfigured = (value?: string): boolean =>
  Boolean(value && value.length >= 20 && !/\[SENSITIVE\]|placeholder|changeme|^your[_-]/i.test(value));

export type RolloutProfile = 'isolated_local' | 'initial_rollout' | 'disabled_intake' | 'custom';

export function getConfigurationProfile(env: NodeJS.ProcessEnv): RolloutProfile {
  const isV2Enabled = env.INTERACTION_COHORT_V2_ENABLED === '1';
  const isDurable = (env.INTERACTION_TEXT_DRIVER ?? 'snapshot') === 'durable';
  const hasDb = Boolean(env.DATABASE_URL);
  const isLocalFixture =
    env.NODE_ENV === 'test' ||
    env.INTERACTION_LOCAL_MODEL_FIXTURE === '1' ||
    env.INTERACTION_MODEL_FIXTURE === '1' ||
    env.S3_TEST_DATABASE_URL !== undefined;

  if (isLocalFixture) return 'isolated_local';
  if (!isV2Enabled) return 'disabled_intake';
  if (isV2Enabled && isDurable && hasDb && env.INTERACTION_YOUTUBE_ENABLED !== '1' && env.INTERACTION_GITHUB_ENABLED !== '1') {
    return 'initial_rollout';
  }
  return 'custom';
}

export function interactionConfigurationChecks(env: NodeJS.ProcessEnv): Check[] {
  const checks: Check[] = [];

  // 1. Database URL
  checks.push({
    name: 'DATABASE_URL presence (PostgreSQL)',
    required: true,
    status: env.DATABASE_URL ? 'configured' : 'blocked',
    reason: env.DATABASE_URL ? undefined : 'missing',
  });

  // 2. Text Driver Validity
  let driver: 'snapshot' | 'durable' | null = null;
  const rawDriver = env.INTERACTION_TEXT_DRIVER ?? 'snapshot';
  if (rawDriver !== 'snapshot' && rawDriver !== 'durable') {
    checks.push({
      name: 'INTERACTION_TEXT_DRIVER valid (snapshot | durable)',
      required: true,
      status: 'blocked',
      reason: 'invalid_driver',
      details: 'Must be either "snapshot" or "durable"',
    });
  } else {
    driver = rawDriver;
    checks.push({
      name: `INTERACTION_TEXT_DRIVER value (${driver})`,
      required: true,
      status: 'configured',
    });
  }

  // 3. V2 Intake and Driver Agreement
  const v2IntakeEnabled = env.INTERACTION_COHORT_V2_ENABLED === '1';
  if (v2IntakeEnabled) {
    if (driver !== 'durable') {
      checks.push({
        name: 'V2 Landing Intake driver agreement',
        required: true,
        status: 'blocked',
        reason: 'durable_driver_required',
        details: 'INTERACTION_COHORT_V2_ENABLED=1 requires INTERACTION_TEXT_DRIVER=durable',
      });
    } else {
      checks.push({
        name: 'V2 Landing Intake driver agreement (durable)',
        required: true,
        status: 'configured',
      });
    }
  } else {
    checks.push({
      name: 'V2 Landing Intake policy (disabled - fallback to legacy creator active)',
      required: false,
      status: 'disabled',
      details: 'Existing v2 workspaces remain readable and resumable',
    });
  }

  // 4. Source Connectors and Driver Agreement
  const connectorsEnabled =
    env.INTERACTION_PDF_ENABLED === '1' ||
    env.INTERACTION_WEB_ENABLED === '1' ||
    env.INTERACTION_YOUTUBE_ENABLED === '1' ||
    env.INTERACTION_GITHUB_ENABLED === '1';

  if (connectorsEnabled && driver !== 'durable') {
    checks.push({
      name: 'External Source connectors driver agreement',
      required: true,
      status: 'blocked',
      reason: 'durable_driver_required',
      details: 'Active source connectors require INTERACTION_TEXT_DRIVER=durable',
    });
  }

  // 5. Local Model Fixture Safety Check
  const isLocalFixtureRequested =
    env.INTERACTION_LOCAL_MODEL_FIXTURE === '1' || env.INTERACTION_MODEL_FIXTURE === '1';
  if (isLocalFixtureRequested) {
    let dbHost = '';
    let dbPath = '';
    try {
      if (env.DATABASE_URL) {
        const u = new URL(env.DATABASE_URL);
        dbHost = u.hostname;
        dbPath = u.pathname;
      }
    } catch {}
    const isProduction = env.NODE_ENV === 'production';
    const isLoopback = ['127.0.0.1', 'localhost'].includes(dbHost);
    const isS3TestDb = dbPath.startsWith('/s3test');

    if (isProduction || (env.DATABASE_URL && (!isLoopback || !isS3TestDb))) {
      checks.push({
        name: 'Deterministic Local Model Fixture mode',
        required: true,
        status: 'blocked',
        reason: 'forbidden_fixture_configuration',
        details: 'Local model fixture is strictly forbidden in production or against non-loopback/non-s3test database',
      });
    } else {
      checks.push({
        name: 'Deterministic Local Model Fixture mode (active)',
        required: false,
        status: 'configured',
        details: 'Local deterministic mock enabled for test/dev loopback database',
      });
    }
  }

  // 6. Model Provider Credentials (Read-only presence, no paid API calls)
  const isGeminiConfigured = isSecretConfigured(env.GEMINI_API_KEY);
  const isAnthropicConfigured = isSecretConfigured(env.ANTHROPIC_API_KEY);
  const isTestMock =
    env.NODE_ENV === 'test' ||
    env.INTERACTION_LOCAL_MODEL_FIXTURE === '1' ||
    env.INTERACTION_MODEL_FIXTURE === '1';

  checks.push({
    name: 'Google Gemini key presence (not live validation)',
    required: !isTestMock,
    status: isGeminiConfigured || isTestMock ? 'configured' : 'blocked',
    reason: isGeminiConfigured || isTestMock ? undefined : 'missing_provider_credentials',
    details: isTestMock ? 'Local test/fixture mode enabled' : undefined,
  });

  checks.push({
    name: 'Anthropic key presence (optional fallback)',
    required: false,
    status: isAnthropicConfigured ? 'configured' : 'not_configured',
  });

  // 7. Capability-Specific Configuration Checks
  // PDF
  if (env.INTERACTION_PDF_ENABLED === '1') {
    checks.push({
      name: 'PDF Source Capability (enabled)',
      required: false,
      status: 'configured',
      details: 'Requires S4B schema constraints in PostgreSQL',
    });
  } else {
    checks.push({
      name: 'PDF Source Capability (disabled)',
      required: false,
      status: 'disabled',
    });
  }

  // Web
  if (env.INTERACTION_WEB_ENABLED === '1') {
    checks.push({
      name: 'Web Source Capability (enabled)',
      required: false,
      status: 'configured',
      details: 'Requires S4B schema constraints and SSRF protections active',
    });
  } else {
    checks.push({
      name: 'Web Source Capability (disabled)',
      required: false,
      status: 'disabled',
    });
  }

  // YouTube
  if (env.INTERACTION_YOUTUBE_ENABLED === '1') {
    const hasFixture = env.INTERACTION_YOUTUBE_FIXTURE === '1' || env.INTERACTION_YOUTUBE_TEST_MOCK === '1';
    if (!hasFixture && !env.YOUTUBE_API_KEY) {
      checks.push({
        name: 'YouTube Source Capability',
        required: true,
        status: 'blocked',
        reason: 'missing_provider_credentials',
        details: 'YouTube Data API v3 requires video owner OAuth credentials; public transcripts blocked',
      });
    } else {
      checks.push({
        name: 'YouTube Source Capability (enabled)',
        required: false,
        status: hasFixture ? 'configured' : 'blocked',
        details: hasFixture ? 'Running with local test fixture' : 'Requires video owner OAuth credentials',
      });
    }
  } else {
    checks.push({
      name: 'YouTube Source Capability (disabled)',
      required: false,
      status: 'disabled',
    });
  }

  // GitHub
  if (env.INTERACTION_GITHUB_ENABLED === '1') {
    const configuredToken = env.INTERACTION_GITHUB_TOKEN ?? env.GITHUB_TOKEN;
    const hasToken = isSecretConfigured(configuredToken);
    checks.push({
      name: 'GitHub Source Capability (enabled)',
      required: false,
      status: 'configured',
      reason: hasToken ? undefined : 'rate_limit_risk',
      details: hasToken
        ? `Dedicated ${env.INTERACTION_GITHUB_TOKEN ? 'INTERACTION_GITHUB_TOKEN' : 'GITHUB_TOKEN'} configured`
        : 'Warning: Unauthenticated API limited to 60 req/hr',
    });
  } else {
    checks.push({
      name: 'GitHub Source Capability (disabled)',
      required: false,
      status: 'disabled',
    });
  }

  // 8. Learner Progress Persistence (MongoDB)
  const isMongoConfigured =
    isSecretConfigured(env.MONGODB_URI) ||
    Boolean(env.MONGODB_URI && (env.MONGODB_URI.startsWith('mongodb://') || env.MONGODB_URI.startsWith('mongodb+srv://')));
  checks.push({
    name: 'MONGODB_URI presence (for learner progress persistence)',
    required: false,
    status: isMongoConfigured ? 'configured' : 'not_configured',
    details: isMongoConfigured
      ? 'UserChunkProgress persistence enabled'
      : 'Optional for builder; required for learner progress tracking (UserChunkProgress)',
  });

  return checks;
}

export async function interactionSqlCheck(): Promise<Check> {
  const check: Check = {
    name: 'PostgreSQL interaction schema (8 tables + indexes)',
    required: true,
    status: 'blocked',
  };
  if (!process.env.DATABASE_URL) return { ...check, reason: 'missing' };

  for (let attempt = 1; attempt <= 3; attempt++) {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 1,
      connectionTimeoutMillis: 15_000,
      query_timeout: 15_000,
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
        let isDurable = false;
        try {
          isDurable = textDriver() === 'durable';
        } catch {
          check.status = 'blocked';
          check.reason = 'invalid_driver';
          await pool.end();
          return check;
        }

        if (isDurable) {
          check.name = 'PostgreSQL interaction + S3 durable text schema';
          try {
            await assertTextJobSchema({ query: (statement, parameters) => pool.query(statement, parameters) });
          } catch (schemaErr: any) {
            check.status = 'blocked';
            check.reason = schemaErr.message === 'S3_HANDLER_VERSION_UNSUPPORTED'
              ? 'unsupported_handler_version'
              : 'schema_incomplete';
            check.details = schemaErr.message;
            await pool.end();
            return check;
          }

          if (
            process.env.INTERACTION_PDF_ENABLED === '1' ||
            process.env.INTERACTION_WEB_ENABLED === '1' ||
            process.env.INTERACTION_YOUTUBE_ENABLED === '1' ||
            process.env.INTERACTION_GITHUB_ENABLED === '1'
          ) {
            check.name = 'PostgreSQL interaction + S3/S4B durable source schema';
            try {
              await assertSourceSchema({ query: (statement, parameters) => pool.query(statement, parameters) });
            } catch (sourceSchemaErr: any) {
              check.status = 'blocked';
              check.reason = 'schema_incomplete';
              check.details = sourceSchemaErr.message;
              await pool.end();
              return check;
            }
          }

          check.name = 'PostgreSQL interaction + S3 durable + S5 release effects schema';
          try {
            await assertReleaseSchema({ query: (statement, parameters) => pool.query(statement, parameters) });
          } catch (releaseErr: any) {
            check.status = 'blocked';
            check.reason = 'schema_incomplete';
            check.details = releaseErr.message;
            await pool.end();
            return check;
          }

          let activeWorkerDetails = '';
          try {
            const activeLeaseRes = await pool.query<{ count: number }>(
              `SELECT count(*)::int AS count FROM "cohort_text_jobs" WHERE "status" = 'running' AND "leaseUntil" > CURRENT_TIMESTAMP`
            );
            const activeCount = Number(activeLeaseRes.rows[0]?.count ?? 0);
            activeWorkerDetails = activeCount > 0
              ? `Active worker leases detected (${activeCount} running)`
              : 'No active worker leases (start background worker with `npm run interaction:worker`)';
          } catch {
            activeWorkerDetails = 'Worker lease status unavailable';
          }
          check.details = activeWorkerDetails;
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

export async function main() {
  console.log('=== Interaction Builder & Cohort Builder Operational Readiness Probe ===\n');

  const profile = getConfigurationProfile(process.env);
  console.log(`Detected Configuration Profile: [${profile.toUpperCase()}]`);

  const envChecks = interactionConfigurationChecks(process.env);
  const sql = await interactionSqlCheck();

  const allChecks = [...envChecks, sql];
  let allOk = true;

  console.log('\n--- Configuration & Driver Agreement Checks ---');
  for (const c of allChecks) {
    const mark = c.status === 'ready' || c.status === 'configured' ? '✓' : c.status === 'disabled' ? '○' : c.required ? '✗' : '!';
    const reasonText = c.reason ? ` (${c.reason})` : '';
    const detailsText = c.details ? ` - ${c.details}` : '';
    console.log(`${mark} [${c.status.toUpperCase()}] ${c.name}${reasonText}${detailsText}`);
    if (c.required && c.status === 'blocked') {
      allOk = false;
    }
  }

  console.log('\n-----------------------------------------------');
  if (!allOk) {
    console.log('Result: BLOCKED (one or more required operational checks failed)');
    process.exitCode = 1;
  } else {
    console.log('Result: READY (all required operational readiness checks passed)');
  }
}

if (process.argv[1]?.endsWith('interaction-readiness.ts') || process.argv[1]?.endsWith('interaction-readiness.js')) {
  void main().catch(err => {
    console.error('Fatal probe error:', err instanceof Error ? err.message : 'Unknown');
    process.exitCode = 1;
  });
}
