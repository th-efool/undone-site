import 'server-only';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import mongoose from 'mongoose';
import { connectToMongoDB } from '../db/mongodb/client';
import { CreationStorageError, type CreationBlobDriver, type CreationStorageRecord } from './creation.contracts';

const bucketName = 'creation_private';
type Identity = Pick<CreationStorageRecord, 'blobId' | 'id' | 'ownerId' | 'draftId'>;

async function bucket() {
  const connection = await connectToMongoDB();
  const db = connection.connection.db;
  if (!db) throw new CreationStorageError('UNAVAILABLE', 'Private storage is unavailable.');
  return new mongoose.mongo.GridFSBucket(db, { bucketName });
}

async function ownedFile(store: mongoose.mongo.GridFSBucket, record: Identity) {
  if (!/^[a-f0-9]{24}$/.test(record.blobId)) throw new CreationStorageError('INTEGRITY', 'Invalid private object reference.');
  const id = new mongoose.mongo.ObjectId(record.blobId);
  const file = await store.find({ _id: id }).next();
  if (file && (file.metadata?.objectId !== record.id || file.metadata?.ownerId !== record.ownerId || file.metadata?.draftId !== record.draftId)) {
    throw new CreationStorageError('INTEGRITY', 'Private object ownership does not match.');
  }
  return { id, file };
}

export function createCreationGridFS(getBucket: () => Promise<mongoose.mongo.GridFSBucket> = bucket): CreationBlobDriver {
  return {
  async put(record, bytes, signal) {
    const store = await getBucket();
    const { id, file } = await ownedFile(store, record);
    if (file) throw new CreationStorageError('INTEGRITY', 'Private objects are immutable.');
    const output = store.openUploadStreamWithId(id, record.id, {
      metadata: { objectId: record.id, ownerId: record.ownerId, draftId: record.draftId,
        mediaType: record.mediaType, kind: record.kind, artifactType: record.artifactType,
        schemaVersion: record.schemaVersion },
    });
    try {
      await pipeline(Readable.from(bytes), output, { signal });
    } catch (error) {
      await output.abort().catch(() => undefined);
      throw error;
    }
  },
  async read(record) {
    const store = await getBucket();
    const { id, file } = await ownedFile(store, record);
    if (!file) throw new CreationStorageError('NOT_FOUND', 'Stored content was not found.');
    if (file.length !== record.byteLength) throw new CreationStorageError('INTEGRITY', 'Stored content length does not match.');
    return store.openDownloadStream(id);
  },
  async delete(record) {
    const store = await getBucket();
    const { id, file } = await ownedFile(store, record);
    try {
      // GridFS delete removes orphan chunks even if an interrupted upload has no files row.
      await store.delete(id);
    } catch (error) {
      if (!file && error instanceof mongoose.mongo.MongoRuntimeError && error.message === `File not found for id ${id}`) return;
      throw error;
    }
  },
  };
}

export const creationGridFS = createCreationGridFS();
