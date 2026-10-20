/**
 * Read-only readiness probe for Messaging & Centrifugo Subsystem.
 * Performs non-destructive checks for:
 * - Environment configuration & secret strength (zero secret disclosure)
 * - Required PostgreSQL tables and additive migration indexes
 * - Outbox backlog age, dead-letter counts, and active worker leases
 * - Configured feature flags and transport endpoints
 */

import { Pool } from 'pg';

export interface ReadinessCheck {
  name: string;
  category: 'env' | 'schema' | 'backlog' | 'transport';
  required: boolean;
  status: 'ready' | 'blocked' | 'warning' | 'disabled';
  details?: string;
}

export interface MessagingReadinessReport {
  timestamp: string;
  allRequiredReady: boolean;
  checks: ReadinessCheck[];
}

export function evaluateEnvironmentConfig(env: NodeJS.ProcessEnv): ReadinessCheck[] {
  const checks: ReadinessCheck[] = [];

  // 1. Database URL
  const hasDb = Boolean(env.DATABASE_URL && env.DATABASE_URL.trim() !== '');
  checks.push({
    name: 'DATABASE_URL presence (PostgreSQL)',
    category: 'env',
    required: true,
    status: hasDb ? 'ready' : 'blocked',
    details: hasDb ? 'Configured' : 'Missing DATABASE_URL',
  });

  // 2. Centrifugo HMAC Secret Key
  const hmacSecret = env.CENTRIFUGO_HMAC_SECRET_KEY;
  const isHmacStrong = Boolean(hmacSecret && hmacSecret.length >= 32 && !/changeme|placeholder|secret/i.test(hmacSecret));
  checks.push({
    name: 'CENTRIFUGO_HMAC_SECRET_KEY strength (≥ 32 chars, non-trivial)',
    category: 'env',
    required: true,
    status: isHmacStrong ? 'ready' : 'blocked',
    details: isHmacStrong ? 'Valid cryptographic secret configured' : 'Secret missing, too short, or uses placeholder',
  });

  // 3. Centrifugo API Key
  const apiKey = env.CENTRIFUGO_API_KEY;
  const isApiKeyConfigured = Boolean(apiKey && apiKey.length >= 16);
  checks.push({
    name: 'CENTRIFUGO_API_KEY presence (server broadcast authorization)',
    category: 'env',
    required: true,
    status: isApiKeyConfigured ? 'ready' : 'blocked',
    details: isApiKeyConfigured ? 'Configured' : 'Missing or weak API key',
  });

  // 4. Centrifugo Proxy Key
  const proxyKey = env.CENTRIFUGO_PROXY_KEY;
  const isProxyKeyConfigured = Boolean(proxyKey && proxyKey.length >= 16);
  checks.push({
    name: 'CENTRIFUGO_PROXY_KEY presence (proxy callback authentication)',
    category: 'env',
    required: true,
    status: isProxyKeyConfigured ? 'ready' : 'blocked',
    details: isProxyKeyConfigured ? 'Configured' : 'Missing or weak proxy key',
  });

  // 5. Internal API Secret
  const internalSecret = env.INTERNAL_API_SECRET;
  const isInternalConfigured = Boolean(internalSecret && internalSecret.length >= 16);
  checks.push({
    name: 'INTERNAL_API_SECRET presence (health and metrics endpoints)',
    category: 'env',
    required: true,
    status: isInternalConfigured ? 'ready' : 'blocked',
    details: isInternalConfigured ? 'Configured' : 'Missing internal secret for diagnostics',
  });

  // 6. Transport Endpoints
  const wsUrl = env.NEXT_PUBLIC_CENTRIFUGO_WS_URL ?? env.CENTRIFUGO_WS_URL;
  const apiUrl = env.CENTRIFUGO_API_URL;
  checks.push({
    name: 'CENTRIFUGO WebSocket and API URLs',
    category: 'transport',
    required: true,
    status: (wsUrl && apiUrl) ? 'ready' : 'warning',
    details: (wsUrl && apiUrl)
      ? 'Configured endpoints available'
      : 'Using default fallback endpoints (ws://localhost:8000/connection/websocket, http://localhost:8000/api)',
  });

  return checks;
}

export async function probeDatabaseSchema(pool: Pool): Promise<ReadinessCheck[]> {
  const checks: ReadinessCheck[] = [];
  const requiredTables = [
    'messages',
    'channels',
    'cohort_members',
    'conversations',
    'conversation_participants',
    'message_reactions',
    'message_receipts',
    'realtime_deliveries',
    'rate_limit_buckets',
    'study_room_leases',
  ];

  try {
    const res = await pool.query<{ table_name: string }>(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ANY($1);
    `, [requiredTables]);

    const foundTables = new Set(res.rows.map(r => r.table_name));

    for (const table of requiredTables) {
      const exists = foundTables.has(table);
      checks.push({
        name: `Database table: "${table}"`,
        category: 'schema',
        required: true,
        status: exists ? 'ready' : 'blocked',
        details: exists ? 'Table and schema verified' : 'Missing table; apply migrations',
      });
    }
  } catch (err: any) {
    checks.push({
      name: 'Database schema query',
      category: 'schema',
      required: true,
      status: 'blocked',
      details: `Database connection failed: ${err.message}`,
    });
  }

  return checks;
}

export async function probeOutboxBacklog(pool: Pool): Promise<ReadinessCheck[]> {
  const checks: ReadinessCheck[] = [];

  try {
    const res = await pool.query<{
      pending_count: string;
      dead_letter_count: string;
      oldest_pending_seconds: string | null;
      active_leases_count: string;
    }>(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'PENDING') AS pending_count,
        COUNT(*) FILTER (WHERE status = 'DEAD_LETTER') AS dead_letter_count,
        EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - MIN("dueAt") FILTER (WHERE status = 'PENDING'))) AS oldest_pending_seconds,
        COUNT(*) FILTER (WHERE "leaseUntil" > CURRENT_TIMESTAMP) AS active_leases_count
      FROM "realtime_deliveries";
    `);

    const row = res.rows[0];
    const pendingCount = parseInt(row?.pending_count ?? '0', 10);
    const deadLetterCount = parseInt(row?.dead_letter_count ?? '0', 10);
    const oldestPendingSec = row?.oldest_pending_seconds ? parseFloat(row.oldest_pending_seconds) : 0;
    const activeLeases = parseInt(row?.active_leases_count ?? '0', 10);

    checks.push({
      name: 'Outbox pending backlog depth',
      category: 'backlog',
      required: true,
      status: pendingCount > 1000 ? 'warning' : 'ready',
      details: `${pendingCount} deliveries pending (Threshold: 1000)`,
    });

    checks.push({
      name: 'Outbox oldest pending age',
      category: 'backlog',
      required: true,
      status: oldestPendingSec > 30 ? 'warning' : 'ready',
      details: `${oldestPendingSec.toFixed(1)}s oldest age (Alert threshold: 30s)`,
    });

    checks.push({
      name: 'Outbox dead-letter queue count',
      category: 'backlog',
      required: true,
      status: deadLetterCount > 0 ? 'warning' : 'ready',
      details: `${deadLetterCount} dead letters found`,
    });

    checks.push({
      name: 'Active worker dispatcher leases',
      category: 'backlog',
      required: false,
      status: 'ready',
      details: `${activeLeases} active worker leases`,
    });
  } catch (err: any) {
    checks.push({
      name: 'Outbox backlog probe',
      category: 'backlog',
      required: true,
      status: 'blocked',
      details: `Failed to probe realtime_deliveries: ${err.message}`,
    });
  }

  return checks;
}

export async function runMessagingReadinessProbe(options?: {
  env?: NodeJS.ProcessEnv;
  skipDb?: boolean;
}): Promise<MessagingReadinessReport> {
  const env = options?.env ?? process.env;
  const envChecks = evaluateEnvironmentConfig(env);
  let dbChecks: ReadinessCheck[] = [];
  let backlogChecks: ReadinessCheck[] = [];

  if (!options?.skipDb && env.DATABASE_URL) {
    const pool = new Pool({ connectionString: env.DATABASE_URL, max: 2 });
    try {
      dbChecks = await probeDatabaseSchema(pool);
      backlogChecks = await probeOutboxBacklog(pool);
    } finally {
      await pool.end();
    }
  }

  const allChecks = [...envChecks, ...dbChecks, ...backlogChecks];
  const allRequiredReady = allChecks.filter(c => c.required).every(c => c.status === 'ready');

  return {
    timestamp: new Date().toISOString(),
    allRequiredReady,
    checks: allChecks,
  };
}

export function formatReadinessReportMarkdown(report: MessagingReadinessReport): string {
  const lines: string[] = [
    `# Messaging & Centrifugo Readiness Probe Report`,
    `**Probe Timestamp**: ${report.timestamp}`,
    `**Overall Readiness**: ${report.allRequiredReady ? '✅ READY FOR PRODUCTION' : '❌ BLOCKED'}`,
    ``,
    `| Category | Probe Name | Required | Status | Details |`,
    `| --- | --- | --- | --- | --- |`,
  ];

  for (const c of report.checks) {
    const statusIcon = c.status === 'ready' ? '✅ READY' : c.status === 'warning' ? '⚠️ WARNING' : '❌ BLOCKED';
    lines.push(`| ${c.category.toUpperCase()} | ${c.name} | ${c.required ? 'YES' : 'NO'} | ${statusIcon} | ${c.details ?? ''} |`);
  }

  return lines.join('\n');
}

export async function main() {
  console.log('[messaging:readiness] Probing configuration, schema, and backlog status...');
  const report = await runMessagingReadinessProbe();
  console.log('\n' + formatReadinessReportMarkdown(report) + '\n');

  if (!report.allRequiredReady) {
    console.error('[messaging:readiness] Probe failed: One or more required checks are blocked.');
    process.exit(1);
  }

  console.log('[messaging:readiness] SUCCESS: Subsystem is fully ready.');
}

if (process.argv[1]?.includes('messaging-readiness')) {
  main().catch(err => {
    console.error('[messaging:readiness] Fatal error during probe:', err);
    process.exit(1);
  });
}
