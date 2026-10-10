/** Opt-in SQL/installed-SDK isolation check. No Hub calls, real tokens or public migrations. */
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { createCorsair, setupCorsair } from 'corsair';
import { createCorsairDatabase } from 'corsair/db';
import { notion } from '@corsair-dev/notion';
import { creationConnectorTenant } from '../src/server/domain/cohort-creation/connectors.service';

let stage = 'configuration';
async function main() {
  const connectionString = process.env.CREATION_SMOKE_DATABASE_URL || process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!connectionString) throw new Error('A direct/session database connection is required');
  const schema = `creation_connector_smoke_${randomUUID().replaceAll('-', '')}`;
  assert.match(schema, /^creation_connector_smoke_[a-f0-9]{32}$/);
  const admin = new Pool({ connectionString, max: 1,
    connectionTimeoutMillis: 10_000, query_timeout: 15_000 });
  const pool = new Pool({ connectionString, max: 2,
    options: `-c search_path=${schema} -c timezone=UTC`, connectionTimeoutMillis: 10_000, query_timeout: 15_000 });
  const database = createCorsairDatabase(pool).db.withSchema(schema);
  let created = false;
  try {
    const sql = await readFile(new URL('../prisma/creation-connectors.sql', import.meta.url), 'utf8');
    // Replace only the fixed schema identifier in our checked-in DDL, never a supplied path/query.
    stage = 'isolated DDL';
    await admin.query(sql.replaceAll('creation_connectors', schema));
    created = true;
    const client = createCorsair({ database, kek: randomBytes(32).toString('hex'), multiTenancy: true,
      plugins: [notion({ authType: 'oauth_2' })] });
    const alice = creationConnectorTenant(randomUUID());
    const bob = creationConnectorTenant(randomUUID());
    stage = 'installed SDK provisioning';
    await setupCorsair(client, { tenantId: alice, silent: true });
    await setupCorsair(client, { tenantId: bob, silent: true });
    const aliceToken = `fixture-alice-${randomUUID()}`;
    const bobToken = `fixture-bob-${randomUUID()}`;
    stage = 'credential writes';
    await client.withTenant(alice).notion.keys.set_access_token(aliceToken);
    await client.withTenant(bob).notion.keys.set_access_token(bobToken);
    stage = 'credential isolation';
    assert.equal(await client.withTenant(alice).notion.keys.get_access_token(), aliceToken);
    assert.equal(await client.withTenant(bob).notion.keys.get_access_token(), bobToken);
    const rows = await pool.query('SELECT tenant_id, config, dek FROM corsair_accounts');
    assert.equal(rows.rowCount, 2);
    for (const row of rows.rows) {
      assert.ok(row.dek);
      assert.ok(!JSON.stringify(row).includes(aliceToken));
      assert.ok(!JSON.stringify(row).includes(bobToken));
    }
    stage = 'scoped disconnect';
    await client.manage.disconnect({ tenantId: alice, plugin: 'notion' });
    assert.equal((await pool.query('SELECT id FROM corsair_accounts WHERE tenant_id = $1', [alice])).rowCount, 0);
    assert.equal(await client.withTenant(bob).notion.keys.get_access_token(), bobToken);
    assert.equal((await pool.query('SHOW search_path')).rows[0].search_path, schema);
    console.log('Connector SQL smoke passed: installed SDK provisioning, encrypted owner isolation, scoped disconnect and isolated search path. Fixture credentials only.');
  } finally {
    await database.destroy();
    if (created) await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
    await admin.end();
  }
}
main().catch(error => {
  const message = error instanceof Error ? error.message.replaceAll(process.env.DATABASE_URL ?? '<unset>', '<database>')
    .replace(/fixture-(alice|bob)-[a-f0-9-]+/g, '<fixture-token>') : 'Unknown error';
  console.error(`Connector SQL smoke failed at ${stage}: ${message}`);
  process.exitCode = 1;
});
