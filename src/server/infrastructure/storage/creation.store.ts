import 'server-only';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  CREATION_STORAGE_LIMITS as limits, CreationStorageError,
  type ArtifactOptions, type CreationBlobDriver, type CreationObjectRef,
  type CreationStorageMetadata, type CreationStorageRecord, type StorageScope,
  type StorageReservation, type UploadOptions,
} from './creation.contracts';

const scopeSchema = z.object({ ownerId: z.string().min(1).max(128), draftId: z.uuid() });
const artifactHeader = z.object({
  artifactType: z.string().min(1).max(128), schemaVersion: z.number().int().positive(),
  inputFingerprint: z.string().min(1).max(256),
});
const envelopeSchema = artifactHeader.extend({ value: z.unknown() }).strict();
const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
function fail(code: ConstructorParameters<typeof CreationStorageError>[0], message: string): never {
  throw new CreationStorageError(code, message);
}
function publicRef(row: CreationStorageRecord): CreationObjectRef {
  if (!row.checksum || !/^[a-f0-9]{64}$/.test(row.checksum) || !Number.isSafeInteger(row.byteLength) || row.byteLength < 1 || row.byteLength > limits.fileBytes) fail('INTEGRITY', 'The stored object is incomplete.');
  return { id: row.id, kind: row.kind, byteLength: row.byteLength, checksum: row.checksum };
}
function budget(value: number | undefined) {
  const result = value ?? limits.fileBytes;
  if (!Number.isSafeInteger(result) || result < 1 || result > limits.fileBytes) fail('INVALID_INPUT', 'Invalid storage byte limit.');
  return result;
}

/** Durable private bytes, separate from HTTP upload and parser concerns. */
export class MaterialBlobStore {
  constructor(protected readonly metadata: CreationStorageMetadata, protected readonly blobs: CreationBlobDriver) {}

  protected async write(scope: StorageScope, input: AsyncIterable<Uint8Array>, options: UploadOptions,
    artifact?: { artifactType: string; schemaVersion: number; inputFingerprint: string }) {
    scopeSchema.parse(scope);
    const maxBytes = budget(options.maxBytes);
    if (!/^[\w!#$&^.+-]+\/[\w!#$&^.+-]+$/.test(options.mediaType)) fail('INVALID_INPUT', 'Invalid media type.');
    if (options.filename && (options.filename.length > 255 || /[/\\]/.test(options.filename) || [...options.filename].some(char => char.charCodeAt(0) < 32))) fail('INVALID_INPUT', 'Invalid filename.');
    options.signal?.throwIfAborted();
    const record: StorageReservation = {
      ...scope, id: randomUUID(), blobId: randomBytes(12).toString('hex'),
      kind: artifact ? 'artifact' : 'upload', mediaType: options.mediaType,
      filename: options.filename ?? null, reservedBytes: maxBytes,
      artifactType: artifact?.artifactType ?? null, schemaVersion: artifact?.schemaVersion ?? null,
      inputFingerprint: artifact?.inputFingerprint ?? null,
    };
    await this.metadata.reserve(record, limits.draftBytes);
    let length = 0;
    const hash = createHash('sha256');
    const signal = options.signal;
    async function* checked() {
      for await (const chunk of input) {
        signal?.throwIfAborted();
        if (!(chunk instanceof Uint8Array)) fail('INVALID_INPUT', 'Storage accepts binary chunks only.');
        length += chunk.byteLength;
        if (length > maxBytes) fail('LIMIT_EXCEEDED', 'The file exceeds the allowed size.');
        hash.update(chunk);
        yield chunk;
      }
      signal?.throwIfAborted();
      if (!length) fail('INVALID_INPUT', 'Empty files are not supported.');
    }
    try {
      await this.blobs.put(record, checked(), signal);
      signal?.throwIfAborted();
      const checksum = hash.digest('hex');
      if (!await this.metadata.complete(scope, record.id, length, checksum)) fail('UNAVAILABLE', 'The upload could not be finalized.');
      return { id: record.id, kind: record.kind, byteLength: length, checksum } satisfies CreationObjectRef;
    } catch (error) {
      // Keep the SQL reservation if cleanup fails. Reconciliation can locate partial GridFS chunks.
      // A completion acknowledgement can be lost after SQL commits: never delete a ready object.
      const stored = await this.metadata.find(scope, record.id).catch(() => null);
      if (stored?.status === 'uploading') {
        await this.blobs.delete(stored).catch(() => undefined);
      }
      throw error;
    }
  }

  putStream(scope: StorageScope, input: AsyncIterable<Uint8Array>, options: UploadOptions) {
    return this.write(scope, input, options);
  }

  protected async record(scope: StorageScope, id: string) {
    scopeSchema.parse(scope);
    const row = await this.metadata.find(scope, id);
    if (!row || row.status !== 'ready') fail('NOT_FOUND', 'Stored content was not found.');
    return row;
  }

  async ref(scope: StorageScope, id: string) {
    return publicRef(await this.record(scope, id));
  }

  async readStream(scope: StorageScope, id: string, signal?: AbortSignal) {
    signal?.throwIfAborted();
    scopeSchema.parse(scope);
    // Reads protect bytes temporarily; only accepted artifact references create durable pins.
    const deadline = Date.now() + 60_000;
    signal = AbortSignal.any([signal ?? new AbortController().signal, AbortSignal.timeout(60_000)]);
    if (!await this.metadata.protectRead(scope, id, new Date(deadline + 30_000))) fail('NOT_FOUND', 'Stored content was not found.');
    const row = await this.record(scope, id);
    const ref = publicRef(row);
    const bytes = await this.blobs.read(row);
    async function* verified() {
      let length = 0;
      const hash = createHash('sha256');
      for await (const chunk of bytes) {
        signal?.throwIfAborted();
        if (Date.now() >= deadline) throw new DOMException('Content read deadline elapsed', 'TimeoutError');
        length += chunk.byteLength;
        if (length > row.byteLength) fail('INTEGRITY', 'Stored content failed its integrity check.');
        hash.update(chunk); yield chunk;
      }
      signal?.throwIfAborted();
      if (length !== row.byteLength || hash.digest('hex') !== row.checksum) fail('INTEGRITY', 'Stored content failed its integrity check.');
    }
    return { ref, mediaType: row.mediaType, stream: verified() };
  }

  async pin(scope: StorageScope, id: string, options: { published?: boolean } = {}) {
    scopeSchema.parse(scope);
    if (!await this.metadata.pin(scope, id, options.published === true)) fail('NOT_FOUND', 'Stored content cannot be referenced.');
  }

  async drop(scope: StorageScope, id: string) {
    scopeSchema.parse(scope);
    const token = randomUUID();
    const claimed = await this.metadata.claimDeletion(scope, id, token);
    if (!claimed) fail('PROTECTED', 'Stored content is referenced, busy, or unavailable.');
    await this.blobs.delete(claimed);
    if (!await this.metadata.finishDeletion(scope, id, token)) fail('UNAVAILABLE', 'Storage cleanup must be retried.');
  }
}

export class CreationArtifactRepository extends MaterialBlobStore {
  /** Owned immutable header only. Callers still validate body identity against accepted application state. */
  async describeArtifact(scope: StorageScope, id: string) {
    const row = await this.record(scope, id);
    if (row.kind !== 'artifact') fail('INTEGRITY', 'Expected a retained artifact.');
    const header = artifactHeader.parse({ artifactType: row.artifactType, schemaVersion: row.schemaVersion, inputFingerprint: row.inputFingerprint });
    return { ...header, ref: publicRef(row) };
  }

  async putJSON<T extends z.ZodType>(scope: StorageScope, value: z.input<T>, options: ArtifactOptions<T>) {
    const header = artifactHeader.parse(options);
    const validated = options.schema.parse(value);
    const serialized = JSON.stringify({ ...header, value: validated });
    if (!serialized) fail('INVALID_INPUT', 'Artifact is not JSON serializable.');
    const bytes = Buffer.from(serialized, 'utf8');
    if (bytes.length > budget(options.maxBytes)) fail('LIMIT_EXCEEDED', 'The artifact exceeds the allowed size.');
    // Round-trip validation forbids Date/coercion/undefined output from silently changing the stored contract.
    options.schema.parse(JSON.parse(serialized).value);
    async function* source() { yield bytes; }
    return this.write(scope, source(), { mediaType: 'application/json', maxBytes: bytes.length, signal: options.signal }, header);
  }

  async getJSON<T extends z.ZodType>(scope: StorageScope, id: string, options: ArtifactOptions<T>): Promise<z.output<T>> {
    const expected = artifactHeader.parse(options);
    const row = await this.record(scope, id);
    if (row.kind !== 'artifact' || row.artifactType !== expected.artifactType || row.schemaVersion !== expected.schemaVersion || row.inputFingerprint !== expected.inputFingerprint) {
      fail('INTEGRITY', 'The artifact contract does not match.');
    }
    if (row.byteLength > budget(options.maxBytes)) fail('LIMIT_EXCEEDED', 'The artifact exceeds the read limit.');
    const { stream } = await this.readStream(scope, id, options.signal);
    const pieces: Uint8Array[] = [];
    for await (const piece of stream) pieces.push(piece);
    const bytes = Buffer.concat(pieces);
    if (sha256(bytes) !== row.checksum) fail('INTEGRITY', 'Stored content failed its integrity check.');
    try {
      const envelope = envelopeSchema.parse(JSON.parse(bytes.toString('utf8')));
      if (envelope.artifactType !== expected.artifactType || envelope.schemaVersion !== expected.schemaVersion || envelope.inputFingerprint !== expected.inputFingerprint) fail('INTEGRITY', 'The artifact envelope does not match.');
      return options.schema.parse(envelope.value);
    } catch { fail('INTEGRITY', 'Stored artifact failed schema validation.'); }
  }
}

export async function reconcileCreationStorage(metadata: CreationStorageMetadata, blobs: CreationBlobDriver,
  options: { now?: Date; limit?: number } = {}) {
  const now = options.now ?? new Date();
  if (!Number.isFinite(now.getTime()) || (options.limit !== undefined && !Number.isSafeInteger(options.limit))) fail('INVALID_INPUT', 'Invalid cleanup bounds.');
  const limit = Math.min(100, Math.max(1, options.limit ?? 50));
  const removed: string[] = []; const failed: string[] = [];
  for (const candidate of await metadata.candidates(now, limit)) {
    const token = randomUUID();
    const cutoff = new Date(now.getTime() - (candidate.status === 'uploading' ? limits.incompleteAgeMs : limits.unreferencedAgeMs));
    try {
      const claimed = await metadata.claimDeletion(candidate, candidate.id, token, cutoff);
      if (!claimed) continue;
      await blobs.delete(claimed);
      if (await metadata.finishDeletion(claimed, claimed.id, token)) removed.push(claimed.id);
      else failed.push(claimed.id);
    } catch { failed.push(candidate.id); }
  }
  return { removed, failed, expiredDrafts: await metadata.expiredDrafts(now, limit) };
}
