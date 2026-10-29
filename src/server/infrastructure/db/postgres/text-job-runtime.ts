import { Pool } from 'pg';
import type { TextArtifactSql } from '@/src/server/domain/cohort-builder/text-artifacts';
import { assertTextJobSchema, ensureJourneyStageSchema } from '@/src/server/domain/cohort-builder/text-schema-readiness';
import { runDurableTextJobTick } from '@/src/server/domain/cohort-builder/durable-text-worker';
import { recoverTextWorkspace } from '@/src/server/domain/cohort-builder/text-job-recovery';
import type { TextJobTransactionPort } from '@/src/server/domain/cohort-builder/text-job-scheduler';
import { assertSourceSchema } from '@/src/server/domain/cohort-builder/source-policy';
import {
  localSourceFixture,
  localYoutubeFixture,
  localGithubFixture,
  localDiscoveryObserverFixture,
  localVideoObservationFixture,
  localGuideAuthorFixture,
} from '@/src/server/infrastructure/ai/localSourceFixture';
import type { YoutubeTranscriptProvider } from '@/src/server/domain/cohort-builder/youtube-transcript';
import type { GithubSourceProvider } from '@/src/server/domain/cohort-builder/github-source';
import { youtubeTranscriptReadiness } from '@/src/server/domain/cohort-builder/youtube-transcript-policy';
import { LiveYoutubeTranscriptProvider } from '@/src/server/domain/cohort-builder/youtube-transcript-live';
import { githubSourceReadiness } from '@/src/server/domain/cohort-builder/github-policy';
import { LiveGithubSourceProvider } from '@/src/server/domain/cohort-builder/github-source-live';

/** Same database as canonical commits; one checked-out connection per acceptance transaction. */
export async function createTextJobRuntime(
  connectionString: string,
  workerId: string,
  leaseMs: number,
  options?: {
    youtubeTranscriptProvider?: YoutubeTranscriptProvider;
    githubSourceProvider?: GithubSourceProvider;
    sourceConcurrency?: number;
  }
) {
  const pool = new Pool({ connectionString, max: 10, connectionTimeoutMillis: 15_000,
    query_timeout: 15_000 });
  const sql: TextArtifactSql = { query: (statement, parameters) => pool.query(statement, parameters) };
  const webTransport=localSourceFixture();
  try {
    await ensureJourneyStageSchema(sql);
    await assertTextJobSchema(sql);
    const external=await sql.query(`SELECT "id" FROM "interaction_workspaces" WHERE "domainId"='cohort' AND "lifecycle"='active'
      AND EXISTS(SELECT 1 FROM jsonb_array_elements("snapshot"->'sources') source WHERE source ? 'input') LIMIT 1`,[]);
    if(process.env.INTERACTION_PDF_ENABLED==='1' || process.env.INTERACTION_WEB_ENABLED==='1' || process.env.INTERACTION_YOUTUBE_ENABLED==='1' || external.rows.length) await assertSourceSchema(sql);
  } catch (error) { await pool.end(); throw error; }
  const transaction: TextJobTransactionPort = { transaction: async work => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SET LOCAL timezone='UTC'; SET LOCAL statement_timeout='15s'; SET LOCAL lock_timeout='5s'");
      const result = await work({ query: (statement, parameters) => client.query(statement, parameters) });
      await client.query('COMMIT');
      return result;
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  } };
  let lastRecoveryTime = 0;
  const configuredConcurrency = options?.sourceConcurrency ??
    Math.max(1, Math.min(8, parseInt(process.env.SOURCE_PROCESSING_CONCURRENCY || '4', 10)));

  return {
    close: () => pool.end(),
    tick: async (overrideConcurrency?: number) => {
      const concurrency = overrideConcurrency ?? configuredConcurrency;
      const now = Date.now();
      if (now - lastRecoveryTime >= 10_000) {
        lastRecoveryTime = now;
        try {
          const candidates = await sql.query(`SELECT "id" FROM "interaction_workspaces" WHERE "domainId"='cohort'
            AND "lifecycle"='active' AND "snapshot"->'processing'->>'status' IN ('queued','failed')
            ORDER BY "updatedAt" LIMIT 20`, []);
          for (const row of candidates.rows) await recoverTextWorkspace(transaction, String(row.id));
        } catch {}
      }
      const youtubeTranscriptProvider = options?.youtubeTranscriptProvider ??
        localYoutubeFixture() ??
        (youtubeTranscriptReadiness().enabled ? new LiveYoutubeTranscriptProvider() : undefined);
      const githubSourceProvider = options?.githubSourceProvider ??
        localGithubFixture() ??
        (githubSourceReadiness().enabled ? new LiveGithubSourceProvider() : undefined);
      const videoObservationProvider = localVideoObservationFixture();
      const guideAuthor = localGuideAuthorFixture();
      const discoveryObserver = localDiscoveryObserverFixture();

      const runSingleTick = () => runDurableTextJobTick({
        sql, workerId, leaseMs, now: () => new Date(), transaction, webTransport,
        youtubeTranscriptProvider, githubSourceProvider, videoObservationProvider, guideAuthor,
        ...(discoveryObserver ? { discoveryDeps: { observer: discoveryObserver, sql } } : {}),
        loadWorkspace: async workspaceId => {
          const row = (await sql.query(`SELECT "snapshot" FROM "interaction_workspaces"
            WHERE "id" = $1 AND "lifecycle" = 'active' AND "domainId" = 'cohort'`, [workspaceId])).rows[0];
          if (!row) throw new Error('WORKSPACE_NOT_ACTIVE');
          return row.snapshot;
        },
      });

      if (concurrency <= 1) {
        return runSingleTick();
      }

      const tasks = Array.from({ length: concurrency }, () => runSingleTick());
      return Promise.all(tasks);
    },
  };
}
