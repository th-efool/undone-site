/** Opt-in private blob smoke. Uses only a unique temporary GridFS bucket. */
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { createCreationGridFS } from '../src/server/infrastructure/storage/creation.gridfs';
import type { CreationStorageRecord, StorageReservation } from '../src/server/infrastructure/storage/creation.contracts';

let stage = 'connection';
async function main() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');
  const client = new mongoose.mongo.MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10_000 });
  const name = `creation_smoke_${randomUUID().replaceAll('-', '')}`;
  assert.match(name, /^creation_smoke_[a-f0-9]{32}$/);
  const db = client.db();
  const collections = [`${name}.files`, `${name}.chunks`];
  let safeCleanup = false;
  try {
    await client.connect();
    stage = 'temporary bucket inspection';
    assert.equal((await db.listCollections({ name: { $in: collections } }).toArray()).length, 0);
    safeCleanup = true;
    const bucket = new mongoose.mongo.GridFSBucket(db, { bucketName: name });
    const driver = createCreationGridFS(async () => bucket);
    const reservation: StorageReservation = { id: randomUUID(), blobId: randomBytes(12).toString('hex'),
      draftId: randomUUID(), ownerId: randomUUID(), kind: 'upload', mediaType: 'text/plain',
      filename: 'smoke.txt', reservedBytes: 64, artifactType: null, schemaVersion: null, inputFingerprint: null };
    const content = Buffer.from('Private creation storage smoke');
    stage = 'blob upload';
    await driver.put(reservation, (async function* () { yield content; })());
    const record: CreationStorageRecord = { ...reservation, status: 'ready', byteLength: content.length,
      checksum: null, createdAt: new Date(), updatedAt: new Date(), completedAt: new Date(),
      referencedAt: null, publishedAt: null, readLeaseUntil: null, deletingToken: null };
    const parts = [];
    stage = 'blob read';
    for await (const part of await driver.read(record)) parts.push(part);
    assert.deepEqual(Buffer.concat(parts), content);
    stage = 'ownership checks';
    await assert.rejects(driver.read({ ...record, ownerId: randomUUID() }), { code: 'INTEGRITY' });
    await assert.rejects(driver.delete({ ...record, ownerId: randomUUID() }), { code: 'INTEGRITY' });
    stage = 'idempotent deletion';
    await driver.delete(record);
    await driver.delete(record); // lost acknowledgement retry is idempotent
    assert.equal(await db.collection(collections[0]).countDocuments(), 0);
    assert.equal(await db.collection(collections[1]).countDocuments(), 0);
  } finally {
    try {
      if (safeCleanup) for (const collection of collections) {
        try { await db.collection(collection).drop(); }
        catch (error) { if (!(error instanceof mongoose.mongo.MongoServerError) || error.code !== 26) throw error; }
      }
    } finally { await client.close(); }
  }
  console.log('Mongo smoke passed: private bytes, ownership, idempotent deletion; temporary bucket removed.');
}
main().catch(error => {
  const code = typeof error?.code === 'number' ? error.code :
    typeof error?.code === 'string' && /^[A-Z_]{1,30}$/.test(error.code) ? error.code : 'unavailable';
  console.error(`Creation storage smoke failed at ${stage}: error code ${code}; no production bucket was modified.`);
  process.exitCode = 1;
});
