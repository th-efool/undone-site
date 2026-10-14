import 'server-only';
import type { ReleaseEffectRecord, ReleaseEffectStore, ReleaseReceipt } from './release';

export interface SqlQueryClient {
  query: (statement: string, parameters?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
}

/**
 * PostgreSQL implementation of ReleaseEffectStore.
 * Operates safely within an interactive transaction or pool connection.
 */
export class PostgresReleaseEffectStore implements ReleaseEffectStore {
  constructor(private readonly client: SqlQueryClient) {}

  async get(effectKey: string): Promise<ReleaseEffectRecord | null> {
    const res = await this.client.query(
      `SELECT "effectKey", "workspaceId", "contentHash", "mode", "cohortId", "state", "receipt", "createdAt", "updatedAt"
       FROM "interaction_effects"
       WHERE "effectKey" = $1`,
      [effectKey]
    );

    const row = res.rows[0];
    if (!row) return null;

    let receipt: ReleaseReceipt | undefined;
    if (row.receipt) {
      receipt = (typeof row.receipt === 'string' ? JSON.parse(row.receipt) : row.receipt) as ReleaseReceipt;
    }

    return {
      effectKey: String(row.effectKey),
      workspaceId: String(row.workspaceId),
      contentHash: String(row.contentHash),
      mode: row.mode as 'private_activation' | 'public_publish',
      cohortId: String(row.cohortId),
      state: row.state as 'pending' | 'committed' | 'failed',
      receipt,
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
      updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
    };
  }

  async recordPending(record: Omit<ReleaseEffectRecord, 'state' | 'receipt' | 'updatedAt'>): Promise<void> {
    await this.client.query(
      `INSERT INTO "interaction_effects"
       ("effectKey", "workspaceId", "contentHash", "mode", "cohortId", "state", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT ("effectKey") DO UPDATE
         SET "updatedAt" = CURRENT_TIMESTAMP
       WHERE "interaction_effects"."state" <> 'committed'`,
      [record.effectKey, record.workspaceId, record.contentHash, record.mode, record.cohortId]
    );
  }

  async commitReceipt(effectKey: string, receipt: ReleaseReceipt): Promise<void> {
    await this.client.query(
      `UPDATE "interaction_effects"
       SET "state" = 'committed',
           "receipt" = $2::jsonb,
           "updatedAt" = CURRENT_TIMESTAMP
       WHERE "effectKey" = $1`,
      [effectKey, JSON.stringify(receipt)]
    );
  }
}
