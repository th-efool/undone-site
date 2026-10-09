import type { z } from 'zod';

export const CREATION_STORAGE_LIMITS = {
  fileBytes: 25 * 1024 * 1024,
  draftBytes: 100 * 1024 * 1024,
  incompleteAgeMs: 24 * 60 * 60 * 1000,
  unreferencedAgeMs: 7 * 24 * 60 * 60 * 1000,
  draftAgeMs: 60 * 24 * 60 * 60 * 1000,
} as const;

export interface StorageScope { ownerId: string; draftId: string }
export interface CreationObjectRef {
  id: string;
  kind: 'upload' | 'artifact';
  byteLength: number;
  checksum: string;
}
// Private server metadata. Never serialize blobId or ownerId to an HTTP response.
export interface CreationStorageRecord extends StorageScope {
  id: string; blobId: string; kind: CreationObjectRef['kind'];
  status: 'uploading' | 'ready' | 'deleting';
  mediaType: string; filename: string | null;
  byteLength: number; reservedBytes: number; checksum: string | null;
  artifactType: string | null; schemaVersion: number | null; inputFingerprint: string | null;
  createdAt: Date; updatedAt: Date; completedAt: Date | null;
  referencedAt: Date | null; readLeaseUntil: Date | null; publishedAt: Date | null; deletingToken: string | null;
}
export type StorageReservation = Pick<CreationStorageRecord,
  'id' | 'blobId' | 'ownerId' | 'draftId' | 'kind' | 'mediaType' | 'filename' |
  'reservedBytes' | 'artifactType' | 'schemaVersion' | 'inputFingerprint'>;

export class CreationStorageError extends Error {
  constructor(readonly code: 'NOT_FOUND' | 'INVALID_INPUT' | 'LIMIT_EXCEEDED' | 'INTEGRITY' | 'PROTECTED' | 'UNAVAILABLE', message: string) {
    super(message); this.name = 'CreationStorageError';
  }
}

export interface CreationStorageMetadata {
  /** Atomically authorizes the draft and reserves its aggregate byte budget. */
  reserve(input: StorageReservation, draftLimit: number): Promise<void>;
  complete(scope: StorageScope, id: string, bytes: number, checksum: string): Promise<boolean>;
  find(scope: StorageScope, id: string): Promise<CreationStorageRecord | null>;
  /** Pins before a snapshot/checkpoint references the object. Published pins never expire. */
  pin(scope: StorageScope, id: string, published: boolean): Promise<boolean>;
  protectRead(scope: StorageScope, id: string, until: Date): Promise<boolean>;
  /** Atomically checks pins/work and transitions to deleting; rejects concurrent readers' new pins. */
  claimDeletion(scope: StorageScope, id: string, token: string, before?: Date): Promise<CreationStorageRecord | null>;
  finishDeletion(scope: StorageScope, id: string, token: string): Promise<boolean>;
  candidates(now: Date, limit: number): Promise<CreationStorageRecord[]>;
  /** Reports only; expiration must first detach references in the owning draft transaction. */
  expiredDrafts(now: Date, limit: number): Promise<StorageScope[]>;
}

export interface CreationBlobDriver {
  put(record: StorageReservation, bytes: AsyncIterable<Uint8Array>, signal?: AbortSignal): Promise<void>;
  read(record: CreationStorageRecord): Promise<AsyncIterable<Uint8Array>>;
  /** Idempotent for missing/incomplete bytes; must verify metadata ownership if a file exists. */
  delete(record: Pick<CreationStorageRecord, 'blobId' | 'id' | 'ownerId' | 'draftId'>): Promise<void>;
}

export interface UploadOptions {
  mediaType: string; filename?: string; maxBytes?: number; signal?: AbortSignal;
}
export interface ArtifactOptions<T extends z.ZodType> {
  artifactType: string; schemaVersion: number; inputFingerprint: string; schema: T;
  maxBytes?: number; signal?: AbortSignal;
}
