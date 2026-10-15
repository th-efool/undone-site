/**
 * CLI script for Interaction Worker Operational Diagnostics.
 * Usage: node --import tsx scripts/worker-diagnostics.ts
 */
import { Pool } from 'pg';
import { collectWorkerDiagnostics, formatDiagnosticsReport } from '../src/server/domain/cohort-builder/worker-diagnostics';

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('Error: DATABASE_URL is not set.');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    max: 1,
    connectionTimeoutMillis: 10_000,
  });

  try {
    const report = await collectWorkerDiagnostics({
      query: (statement, params) => pool.query(statement, params),
    });
    console.log(formatDiagnosticsReport(report));
  } catch (err: any) {
    console.error('Diagnostics query failed:', err.message ?? err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

if (process.argv[1]?.endsWith('worker-diagnostics.ts') || process.argv[1]?.endsWith('worker-diagnostics.js')) {
  main().catch(() => process.exit(1));
}
