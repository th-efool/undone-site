import { Writable } from 'node:stream';
import mongoose from 'mongoose';
import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('../../db/mongodb/client', () => ({ connectToMongoDB: vi.fn() }));
import { createCreationGridFS } from '../creation.gridfs';
import type { CreationStorageRecord } from '../creation.contracts';

const record: CreationStorageRecord = {
  id: '10000000-0000-4000-8000-000000000001', blobId: '100000000000000000000001',
  ownerId: 'owner', draftId: '20000000-0000-4000-8000-000000000001', kind: 'upload', status: 'ready',
  mediaType: 'text/plain', filename: 'test.txt', byteLength: 5, reservedBytes: 20, checksum: 'a'.repeat(64),
  artifactType: null, schemaVersion: null, inputFingerprint: null, createdAt: new Date(), updatedAt: new Date(),
  completedAt: new Date(), referencedAt: null, readLeaseUntil: null, publishedAt: null, deletingToken: null,
};

function fixture(file: mongoose.mongo.GridFSFile | null = null) {
  // Never connect: actual driver deletion code runs against mocked collection operations.
  const client = new mongoose.mongo.MongoClient('mongodb://localhost:27017');
  const bucket = new mongoose.mongo.GridFSBucket(client.db('storage_test'));
  const internals = (bucket as unknown as { s: { _filesCollection: mongoose.mongo.Collection; _chunksCollection: mongoose.mongo.Collection } }).s;
  const deleteFile = vi.spyOn(internals._filesCollection, 'deleteOne').mockResolvedValue({ acknowledged: true, deletedCount: file ? 1 : 0 });
  const deleteChunks = vi.spyOn(internals._chunksCollection, 'deleteMany').mockResolvedValue({ acknowledged: true, deletedCount: 3 });
  vi.spyOn(bucket, 'find').mockReturnValue({ next: async () => file } as ReturnType<typeof bucket.find>);
  return { bucket, deleteFile, deleteChunks, driver: createCreationGridFS(async () => bucket) };
}
function file(ownerId = record.ownerId): mongoose.mongo.GridFSFile {
  return { _id: new mongoose.mongo.ObjectId(record.blobId), length: 5, chunkSize: 255 * 1024, uploadDate: new Date(), filename: record.id,
    metadata: { objectId: record.id, ownerId, draftId: record.draftId } };
}

describe('GridFS private storage boundary', () => {
  it('uses actual GridFS delete to clear orphan chunks without a completed files row', async () => {
    const f = fixture(); await f.driver.delete(record);
    expect(f.deleteFile).toHaveBeenCalledOnce();
    expect(f.deleteChunks).toHaveBeenCalledWith({ files_id: new mongoose.mongo.ObjectId(record.blobId) }, expect.any(Object));
  });
  it('propagates orphan-chunk deletion failure for later reconciliation', async () => {
    const f = fixture(); f.deleteChunks.mockRejectedValueOnce(new Error('offline'));
    await expect(f.driver.delete(record)).rejects.toThrow('offline');
  });
  it('refuses another owners GridFS file even with a valid object ID', async () => {
    const f = fixture(file('different-owner'));
    await expect(f.driver.delete(record)).rejects.toMatchObject({ code: 'INTEGRITY' });
    await expect(f.driver.read(record)).rejects.toMatchObject({ code: 'INTEGRITY' });
    expect(f.deleteFile).not.toHaveBeenCalled(); expect(f.deleteChunks).not.toHaveBeenCalled();
  });
  it('rejects overwrite of an existing immutable object', async () => {
    const f = fixture(file()); async function* bytes() { yield Buffer.from('hello'); }
    await expect(f.driver.put(record, bytes())).rejects.toMatchObject({ code: 'INTEGRITY' });
  });
  it('aborts partial GridFS upload when the source fails', async () => {
    const f = fixture(); const output = Object.assign(new Writable({ write(_data, _encoding, done) { done(); } }), { abort: vi.fn(async () => undefined) });
    vi.spyOn(f.bucket, 'openUploadStreamWithId').mockReturnValue(output as unknown as ReturnType<typeof f.bucket.openUploadStreamWithId>);
    async function* bytes() { yield Buffer.from('hello'); throw new Error('source interrupted'); }
    await expect(f.driver.put(record, bytes())).rejects.toThrow('source interrupted');
    expect(output.abort).toHaveBeenCalledOnce();
  });
  it('rejects a mismatched length before opening a download stream', async () => {
    const f = fixture({ ...file(), length: 999 });
    const read = vi.spyOn(f.bucket, 'openDownloadStream');
    await expect(f.driver.read(record)).rejects.toMatchObject({ code: 'INTEGRITY' });
    expect(read).not.toHaveBeenCalled();
  });
});
