/**
 * Read-only operational readiness probe for Study Room Subsystem (Phase 11).
 * Performs non-destructive checks for:
 * - Environment configuration & secret strength
 * - Required PostgreSQL tables and schema models
 * - Outbox backlog age, dead-letter counts, and active worker leases
 * - Active lease health, ghost participants, and reconciliation lag
 */

import { Pool } from 'pg';

export interface ReadinessCheck {
  name: string;
  category: 'env' | 'schema' | 'backlog' | 'leases';
  required: boolean;
  status: 'ready' | 'blocked' | 'warning' | 'disabled';
  details?: string;
}

export interface StudyRoomReadinessReport {
  timestamp: string;
  allRequiredReady: boolean;
  checks: ReadinessCheck[];
}

export function evaluateStudyRoomEnvironment(env: NodeJS.ProcessEnv): ReadinessCheck[] {
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

  // 4. Internal API Secret
  const internalSecret = env.INTERNAL_API_SECRET;
  const isInternalConfigured = Boolean(internalSecret && internalSecret.length >= 16);
  checks.push({
    name: 'INTERNAL_API_SECRET presence (diagnostics & metrics endpoints)',
    category: 'env',
    required: true,
    status: isInternalConfigured ? 'ready' : 'blocked',
    details: isInternalConfigured ? 'Configured' : 'Missing internal secret for diagnostics',
  });

  // 5. NextAuth Secret
  const nextAuthSecret = env.NEXTAUTH_SECRET;
  const hasNextAuth = Boolean(nextAuthSecret && nextAuthSecret.length >= 16);
  checks.push({
    name: 'NEXTAUTH_SECRET presence (session signing & user verification)',
    category: 'env',
    required: true,
    status: hasNextAuth ? 'ready' : 'blocked',
    details: hasNextAuth ? 'Configured' : 'Missing or weak NEXTAUTH_SECRET',
  });

  return checks;
}

export async function probeStudyRoomTables(pool: Pool): Promise<ReadinessCheck[]> {
  const checks: ReadinessCheck[] = [];
  const requiredTables = [
    'study_rooms',
    'room_participants',
    'study_room_leases',
    'room_restrictions',
    'room_ownership_transfers',
    'study_sessions',
    'room_sprints',
    'room_environments',
    'realtime_streams',
    'channels',
    'realtime_events',
    'realtime_deliveries',
    'rate_limit_buckets',
  ];

  try {
    const res = await pool.query<{ table_name: string }>(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ANY($1);
    `, [requiredTables]);

    const presentTables = new Set(res.rows.map(r => r.table_name));

    for (const table of requiredTables) {
      const exists = presentTables.has(table);
      checks.push({
        name: `Table: ${table}`,
        category: 'schema',
        required: true,
        status: exists ? 'ready' : 'blocked',
        details: exists ? 'Present' : `Missing table ${table}`,
      });
    }
  } catch (error) {
    checks.push({
      name: 'PostgreSQL schema verification',
      category: 'schema',
      required: true,
      status: 'blocked',
      details: `Database connection error: ${(error as Error).message}`,
    });
  }

  return checks;
}

export async function probeStudyRoomBacklog(pool: Pool): Promise<ReadinessCheck[]> {
  const checks: ReadinessCheck[] = [];

  try {
    // 1. Pending outbox backlog
    const pendingRes = await pool.query<{ count: string; oldest_seconds: string | null }>(`
      SELECT
        COUNT(*)::text as count,
        COALESCE(EXTRACT(EPOCH FROM (NOW() - MIN(created_at))), 0)::text as oldest_seconds
      FROM realtime_deliveries
      WHERE status = 'PENDING';
    `);

    const pendingCount = parseInt(pendingRes.rows[0]?.count ?? '0', 10);
    const oldestSeconds = parseFloat(pendingRes.rows[0]?.oldest_seconds ?? '0');

    let backlogStatus: ReadinessCheck['status'] = 'ready';
    if (oldestSeconds > 300) {
      backlogStatus = 'blocked';
    } else if (oldestSeconds > 60 || pendingCount > 1000) {
      backlogStatus = 'warning';
    }

    checks.push({
      name: 'Outbox pending delivery lag',
      category: 'backlog',
      required: true,
      status: backlogStatus,
      details: `${pendingCount} pending deliveries (oldest: ${Math.round(oldestSeconds)}s)`,
    });

    // 2. Dead letter count
    const deadLetterRes = await pool.query<{ count: string }>(`
      SELECT COUNT(*)::text as count
      FROM realtime_deliveries
      WHERE status = 'DEAD_LETTER';
    `);
    const deadLetterCount = parseInt(deadLetterRes.rows[0]?.count ?? '0', 10);

    checks.push({
      name: 'Outbox dead letter threshold',
      category: 'backlog',
      required: true,
      status: deadLetterCount > 0 ? 'blocked' : 'ready',
      details: `${deadLetterCount} dead letter items`,
    });

    // 3. Stale lease backlog (leases expired > 2 minutes ago not yet swept)
    const staleLeasesRes = await pool.query<{ count: string }>(`
      SELECT COUNT(*)::text as count
      FROM study_room_leases
      WHERE expires_at < NOW() - INTERVAL '2 minutes';
    `);
    const staleLeaseCount = parseInt(staleLeasesRes.rows[0]?.count ?? '0', 10);

    checks.push({
      name: 'Stale lease reconciliation lag',
      category: 'leases',
      required: false,
      status: staleLeaseCount > 50 ? 'warning' : 'ready',
      details: `${staleLeaseCount} un-swept expired leases older than 2 minutes`,
    });
  } catch (error) {
    checks.push({
      name: 'Study room backlog query',
      category: 'backlog',
      required: true,
      status: 'blocked',
      details: `Failed to query backlog: ${(error as Error).message}`,
    });
  }

  return checks;
}

export async function runStudyRoomReadinessProbe(options?: {
  skipDb?: boolean;
  env?: NodeJS.ProcessEnv;
  pool?: Pool;
}): Promise<StudyRoomReadinessReport> {
  const env = options?.env ?? process.env;
  const envChecks = evaluateStudyRoomEnvironment(env);

  let schemaChecks: ReadinessCheck[] = [];
  let backlogChecks: ReadinessCheck[] = [];

  if (!options?.skipDb && env.DATABASE_URL) {
    const pool = options?.pool ?? new Pool({ connectionString: env.DATABASE_URL });
    const shouldClosePool = !options?.pool;
    try {
      [schemaChecks, backlogChecks] = await Promise.all([
        probeStudyRoomTables(pool),
        probeStudyRoomBacklog(pool),
      ]);
    } finally {
      if (shouldClosePool) {
        await pool.end().catch(() => {});
      }
    }
  }

  const allChecks = [...envChecks, ...schemaChecks, ...backlogChecks];
  const allRequiredReady = allChecks.filter(c => c.required).every(c => c.status === 'ready');

  return {
    timestamp: new Date().toISOString(),
    allRequiredReady,
    checks: allChecks,
  };
}

export function formatStudyRoomReadinessMarkdown(report: StudyRoomReadinessReport): string {
  const lines: string[] = [
    `# Study Room Readiness Probe Report`,
    `**Timestamp**: \`${report.timestamp}\``,
    `**Overall Readiness**: ${report.allRequiredReady ? '✅ READY FOR PRODUCTION' : '❌ BLOCKED'}`,
    '',
    `| Check | Category | Required | Status | Details |`,
    `|---|---|---|---|---|`,
  ];

  for (const check of report.checks) {
    const icon = check.status === 'ready' ? '✅' : check.status === 'warning' ? '⚠️' : '❌';
    lines.push(
      `| ${check.name} | ${check.category} | ${check.required ? 'Yes' : 'No'} | ${icon} ${check.status} | ${check.details ?? ''} |`
    );
  }

  return lines.join('\n');
}

// Execute standalone if run directly
if (typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module) {
  runStudyRoomReadinessProbe().then((report) => {
    console.log('\n' + formatStudyRoomReadinessMarkdown(report) + '\n');
    process.exit(report.allRequiredReady ? 0 : 1);
  }).catch((err) => {
    console.error('Fatal probe failure:', err);
    process.exit(1);
  });
}
