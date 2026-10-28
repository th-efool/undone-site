/**
 * Canonical Serialization, Cryptographic Hashing & Payload Validation
 *
 * Implements:
 * - Deterministic JSON stringification (canonical lexicographical key ordering)
 * - Cryptographic SHA-256 content hashing (Node crypto with universal pure JS fallback)
 * - Constant-time string equality verification (timing-attack protection)
 * - Physical limit enforcement (3.0 MiB direct raw binary / 5.0 MiB chunked raw binary)
 * - Strongly-typed payload assertion and schema validation
 */

import type {
  NotebookRecord,
  NoteRecord,
  CanvasNoteData,
  KanbanNoteData,
  MarkdownNoteData,
  AssetRecord,
  OutboxMutation,
  WorkspaceManifest,
  LocalStateExportBundle,
} from './contracts';
import {
  notebookRecordSchema,
  noteRecordSchema,
  canvasNoteDataSchema,
  kanbanNoteDataSchema,
  markdownNoteDataSchema,
  assetRecordSchema,
  outboxMutationSchema,
  workspaceManifestSchema,
  localStateExportBundleSchema,
} from './contracts';
import {
  CorruptAssetIntegrityError,
  IncompatibleSchemaError,
  AssetSizeLimitExceededError,
} from './errors';

// ============================================================================
// Measured Physical Limits (Frozen in E4 / E2)
// ============================================================================

/**
 * Maximum raw binary size for individual assets on direct transport (3.0 MiB).
 * Vercel Serverless has a 4.5 MiB request ceiling; 3.0 MiB raw + 33.33% base64 reaches ~4.0 MiB.
 */
export const MAX_RAW_ASSET_DIRECT_BYTES = 3 * 1024 * 1024; // 3,145,728 bytes

/**
 * Maximum raw binary size for individual assets using chunked multi-part upload (5.0 MiB).
 */
export const MAX_RAW_ASSET_CHUNKED_BYTES = 5 * 1024 * 1024; // 5,242,880 bytes

/**
 * Maximum total staged asset volume per single Git publication commit (15.0 MiB).
 */
export const MAX_PUBLICATION_GROUP_BYTES = 15 * 1024 * 1024; // 15,728,640 bytes

/** Leave headroom under the host's 4.5 MiB serverless request-body ceiling. */
export const MAX_GITHUB_PUBLISH_BODY_BYTES = 4 * 1024 * 1024;

/**
 * Local IndexedDB database threshold before prompting bundle cleanup/export (500 MiB).
 */
export const LOCAL_STORAGE_QUOTA_BYTES = 500 * 1024 * 1024; // 524,288,000 bytes

// ============================================================================
// 1. Canonical JSON Stringification
// ============================================================================

/**
 * Serializes any JavaScript value to canonical JSON with deterministic,
 * lexicographically sorted object keys. Arrays preserve element order.
 *
 * Properties with undefined, functions, or symbol values are omitted from objects,
 * matching standard JSON.stringify behavior. Circular references throw a TypeError.
 */
export function canonicalJsonStringify(value: unknown): string {
  const activePath = new Set<unknown>();

  function serialize(val: unknown): string | undefined {
    if (val === null) return 'null';
    if (val === undefined) return undefined;

    const valType = typeof val;
    if (valType === 'number') {
      return Number.isFinite(val) ? String(val) : 'null';
    }
    if (valType === 'boolean') {
      return val ? 'true' : 'false';
    }
    if (valType === 'string') {
      return JSON.stringify(val);
    }
    if (valType === 'bigint') {
      throw new TypeError('Do not know how to serialize a BigInt to canonical JSON');
    }
    if (valType === 'symbol' || valType === 'function') {
      return undefined;
    }

    if (valType === 'object') {
      // Handle Date or objects with .toJSON()
      if (
        val !== null &&
        typeof val === 'object' &&
        'toJSON' in val &&
        typeof (val as { toJSON: () => unknown }).toJSON === 'function'
      ) {
        return serialize((val as { toJSON: () => unknown }).toJSON());
      }

      if (activePath.has(val)) {
        throw new TypeError('Converting circular structure to canonical JSON');
      }
      activePath.add(val);

      try {
        if (Array.isArray(val)) {
          const items: string[] = [];
          for (let i = 0; i < val.length; i++) {
            const itemStr = serialize(val[i]);
            items.push(itemStr === undefined ? 'null' : itemStr);
          }
          return `[${items.join(',')}]`;
        }

        // Plain object: sort keys lexicographically
        const keys = Object.keys(val as Record<string, unknown>).sort();
        const entries: string[] = [];

        for (const k of keys) {
          const v = (val as Record<string, unknown>)[k];
          const entryStr = serialize(v);
          if (entryStr !== undefined) {
            entries.push(`${JSON.stringify(k)}:${entryStr}`);
          }
        }

        return `{${entries.join(',')}}`;
      } finally {
        activePath.delete(val);
      }
    }

    return undefined;
  }

  const result = serialize(value);
  return result === undefined ? '' : result;
}

// ============================================================================
// 2. Cryptographic SHA-256 Hashing
// ============================================================================

/**
 * Computes a lowercase 64-character hexadecimal SHA-256 hash of a string, Buffer,
 * or Uint8Array. Uses Node's native crypto when available, with a deterministic pure
 * JavaScript fallback for universal browser compatibility.
 */
export function computeSha256(data: string | Buffer | Uint8Array): string {
  let bytes: Uint8Array;
  if (typeof data === 'string') {
    bytes = new TextEncoder().encode(data);
  } else if (data instanceof Uint8Array) {
    bytes = data;
  } else {
    bytes = new Uint8Array(data);
  }

  return pureJsSha256(bytes);
}

// Pure JS SHA-256 implementation
function pureJsSha256(data: Uint8Array): string {
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const bitLen = data.length * 8;
  const newLen = (((data.length + 8) >> 6) + 1) << 6;
  const padded = new Uint8Array(newLen);
  padded.set(data);
  padded[data.length] = 0x80;

  const view = new DataView(padded.buffer);
  view.setUint32(newLen - 4, bitLen & 0xffffffff, false);
  view.setUint32(newLen - 8, Math.floor(bitLen / 0x100000000), false);

  const W = new Uint32Array(64);

  for (let i = 0; i < newLen; i += 64) {
    for (let t = 0; t < 16; t++) {
      W[t] = view.getUint32(i + t * 4, false);
    }
    for (let t = 16; t < 64; t++) {
      const s0 = ((W[t - 15] >>> 7) | (W[t - 15] << 25)) ^
                 ((W[t - 15] >>> 18) | (W[t - 15] << 14)) ^
                 (W[t - 15] >>> 3);
      const s1 = ((W[t - 2] >>> 17) | (W[t - 2] << 15)) ^
                 ((W[t - 2] >>> 19) | (W[t - 2] << 13)) ^
                 (W[t - 2] >>> 10);
      W[t] = (W[t - 16] + s0 + W[t - 7] + s1) | 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let t = 0; t < 64; t++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[t] + W[t]) | 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) | 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }

    h0 = (h0 + a) | 0;
    h1 = (h1 + b) | 0;
    h2 = (h2 + c) | 0;
    h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0;
    h5 = (h5 + f) | 0;
    h6 = (h6 + g) | 0;
    h7 = (h7 + h) | 0;
  }

  const hexParts = [h0, h1, h2, h3, h4, h5, h6, h7].map((num) =>
    (num >>> 0).toString(16).padStart(8, '0')
  );
  return hexParts.join('');
}

// ============================================================================
// 3. Constant-Time String Equality (Timing Attack Prevention)
// ============================================================================

/**
 * Compares two strings in constant time to prevent side-channel timing attacks
 * on cryptographic hashes, auth tokens, and session nonces.
 */
export function secureTimingSafeEqual(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;

  // Constant-time fallback using bitwise XOR over UTF-8 byte representation
  const encoder = new TextEncoder();
  const bytesA = encoder.encode(a);
  const bytesB = encoder.encode(b);
  if (bytesA.length !== bytesB.length) return false;

  let diff = 0;
  for (let i = 0; i < bytesA.length; i++) {
    diff |= bytesA[i] ^ bytesB[i];
  }
  return diff === 0;
}

// ============================================================================
// 4. Size Limits & Asset Integrity Validation
// ============================================================================

/**
 * Asserts that an asset's raw unencoded binary size respects host envelopes.
 * Throws CorruptAssetIntegrityError or AssetSizeLimitExceededError if violated.
 */
export function validateRawAssetSize(byteLength: number, isChunked = false): void {
  if (typeof byteLength !== 'number' || !Number.isInteger(byteLength) || byteLength <= 0) {
    throw new CorruptAssetIntegrityError('Asset byteLength must be a positive non-zero integer');
  }

  const maxAllowed = isChunked ? MAX_RAW_ASSET_CHUNKED_BYTES : MAX_RAW_ASSET_DIRECT_BYTES;
  if (byteLength > maxAllowed) {
    throw new AssetSizeLimitExceededError(
      `Asset size of ${byteLength} bytes exceeds ${isChunked ? 'chunked maximum ceiling (5.0 MiB)' : 'direct envelope limit (3.0 MiB)'}`,
      {
        byteLength,
        maxBytes: maxAllowed,
        isChunked,
      }
    );
  }
}

/**
 * Asserts that an asset record conforms to schema, respects size limits,
 * and matches its cryptographic SHA-256 hash when decoded from base64.
 */
export function validateAssetRecord(
  data: unknown,
  options?: { isChunked?: boolean; verifyHash?: boolean }
): AssetRecord {
  if (!data || typeof data !== 'object') {
    throw new IncompatibleSchemaError('Asset record must be a non-null object');
  }

  const parseResult = assetRecordSchema.safeParse(data);
  if (!parseResult.success) {
    throw new IncompatibleSchemaError('Asset record does not conform to asset schema', {
      validationErrors: parseResult.error.issues,
    });
  }

  const record = parseResult.data;
  validateRawAssetSize(record.byteLength, options?.isChunked);

  // Verify hash against decoded base64 data if requested (default true)
  if (options?.verifyHash !== false) {
    let decodedBytes: Buffer | Uint8Array;
    try {
      if (typeof Buffer !== 'undefined') {
        decodedBytes = Buffer.from(record.base64Data, 'base64');
      } else {
        const binStr = atob(record.base64Data);
        decodedBytes = new Uint8Array(binStr.length);
        for (let i = 0; i < binStr.length; i++) {
          decodedBytes[i] = binStr.charCodeAt(i);
        }
      }
    } catch (err) {
      throw new CorruptAssetIntegrityError('Failed to decode base64 asset payload', {
        assetId: record.id,
        cause: err,
      });
    }

    if (decodedBytes.byteLength !== record.byteLength) {
      throw new CorruptAssetIntegrityError(
        `Asset decoded byteLength (${decodedBytes.byteLength}) does not match declared byteLength (${record.byteLength})`,
        {
          assetId: record.id,
        }
      );
    }

    const computedHash = computeSha256(decodedBytes);
    if (!secureTimingSafeEqual(computedHash, record.hash)) {
      throw new CorruptAssetIntegrityError(
        `Asset SHA-256 mismatch: declared=${record.hash}, computed=${computedHash}`,
        {
          assetId: record.id,
          expectedHash: record.hash,
          actualHash: computedHash,
        }
      );
    }
  }

  return record;
}

/** Collects content-addressed asset IDs/hashes referenced anywhere in a workspace note. */
export function collectReferencedAssetIds(value: unknown): Set<string> {
  const references = new Set<string>();
  const visit = (current: unknown, key = '') => {
    if (typeof current === 'string') {
      const match = /^asset:\/\/([0-9a-f]{64})$/.exec(current);
      if (match) references.add(match[1]);
      if (key === 'assetHash' && current) references.add(current);
      return;
    }
    if (Array.isArray(current)) {
      if (key === 'assetFileIds') current.forEach((id) => { if (typeof id === 'string' && id) references.add(id); });
      else current.forEach((item) => visit(item));
      return;
    }
    if (!current || typeof current !== 'object') return;
    if ((current as Record<string, unknown>).isDeleted === true) return;
    for (const [childKey, child] of Object.entries(current)) {
      if (childKey === 'assetHashes' && child && typeof child === 'object' && !Array.isArray(child)) {
        for (const [id, hash] of Object.entries(child)) {
          references.add(id);
          if (typeof hash === 'string' && hash) references.add(hash);
        }
      } else {
        visit(child, childKey);
      }
    }
  };
  visit(value);
  return references;
}

/** Rejects snapshots whose canvas/kanban references cannot be restored from the asset set. */
export function validateWorkspaceAssetDependencies(
  notes: readonly NoteRecord[],
  assets: readonly AssetRecord[],
): void {
  const available = new Set(assets.flatMap((asset) => [asset.id, asset.hash]));
  const missing = new Set<string>();
  for (const note of notes) {
    for (const reference of collectReferencedAssetIds(note)) {
      if (!available.has(reference)) missing.add(reference);
    }
  }
  if (missing.size) {
    throw new IncompatibleSchemaError(
      `Workspace notes reference missing assets: ${Array.from(missing).join(', ')}`,
      { validationErrors: { missingAssetIds: Array.from(missing) } },
    );
  }
}

// ============================================================================
// 5. Payload Validators
// ============================================================================

export function validateNotebookRecord(data: unknown): NotebookRecord {
  if (!data || typeof data !== 'object') {
    throw new IncompatibleSchemaError('Notebook record must be a non-null object');
  }
  const result = notebookRecordSchema.safeParse(data);
  if (!result.success) {
    throw new IncompatibleSchemaError('Notebook payload does not conform to notebook schema', {
      validationErrors: result.error.issues,
    });
  }
  return result.data;
}

export function validateCanvasNoteData(data: unknown): CanvasNoteData {
  if (!data || typeof data !== 'object') {
    throw new IncompatibleSchemaError('CanvasNoteData must be a non-null object');
  }
  const result = canvasNoteDataSchema.safeParse(data);
  if (!result.success) {
    throw new IncompatibleSchemaError('Canvas note payload does not conform to canvasData schema', {
      validationErrors: result.error.issues,
    });
  }
  return result.data;
}

export function validateKanbanNoteData(data: unknown): KanbanNoteData {
  if (!data || typeof data !== 'object') {
    throw new IncompatibleSchemaError('KanbanNoteData must be a non-null object');
  }
  const result = kanbanNoteDataSchema.safeParse(data);
  if (!result.success) {
    throw new IncompatibleSchemaError('Kanban note payload does not conform to kanbanData schema', {
      validationErrors: result.error.issues,
    });
  }
  return result.data;
}

export function validateMarkdownNoteData(data: unknown): MarkdownNoteData {
  if (!data || typeof data !== 'object') {
    throw new IncompatibleSchemaError('MarkdownNoteData must be a non-null object');
  }
  const result = markdownNoteDataSchema.safeParse(data);
  if (!result.success) {
    throw new IncompatibleSchemaError('Markdown note payload does not conform to markdownData schema', {
      validationErrors: result.error.issues,
    });
  }
  return result.data;
}

export function validateNoteRecord(data: unknown): NoteRecord {
  if (!data || typeof data !== 'object') {
    throw new IncompatibleSchemaError('Note record must be a non-null object');
  }
  const result = noteRecordSchema.safeParse(data);
  if (!result.success) {
    throw new IncompatibleSchemaError('Note record does not conform to note schema', {
      validationErrors: result.error.issues,
    });
  }
  return result.data;
}

/**
 * Coerces recoverable field anomalies (empty title, float/negative order, null optional fields)
 * before validating a NotebookRecord so local saves do not fail on benign user input.
 */
export function normalizeNotebookRecord(data: unknown): NotebookRecord {
  if (!data || typeof data !== 'object') {
    return validateNotebookRecord(data);
  }
  const raw = { ...(data as Record<string, unknown>) };
  const now = new Date().toISOString();
  if (typeof raw.title !== 'string' || raw.title.trim() === '') {
    raw.title = 'Untitled Notebook';
  }
  if (typeof raw.order === 'number' && Number.isFinite(raw.order)) {
    raw.order = Math.max(0, Math.floor(raw.order));
  } else if (raw.order === undefined || raw.order === null) {
    raw.order = 0;
  }
  if (typeof raw.createdAt !== 'string' || raw.createdAt.trim() === '') {
    raw.createdAt = now;
  }
  if (typeof raw.updatedAt !== 'string' || raw.updatedAt.trim() === '') {
    raw.updatedAt = raw.createdAt;
  }
  if (raw.description === null) delete raw.description;
  if (raw.color === null) delete raw.color;
  if (raw.icon === null) delete raw.icon;
  return validateNotebookRecord(raw);
}

/**
 * Coerces recoverable field anomalies (empty title, float/negative order, null optional fields)
 * before validating a NoteRecord so local saves do not fail on benign user input.
 */
export function normalizeNoteRecord(data: unknown): NoteRecord {
  if (!data || typeof data !== 'object') {
    return validateNoteRecord(data);
  }
  const raw = { ...(data as Record<string, unknown>) };
  const now = new Date().toISOString();
  if (typeof raw.title !== 'string' || raw.title.trim() === '') {
    raw.title = 'Untitled Note';
  }
  if (typeof raw.order === 'number' && Number.isFinite(raw.order)) {
    raw.order = Math.max(0, Math.floor(raw.order));
  } else if (raw.order === undefined || raw.order === null) {
    raw.order = 0;
  }
  if (typeof raw.createdAt !== 'string' || raw.createdAt.trim() === '') {
    raw.createdAt = now;
  }
  if (typeof raw.updatedAt !== 'string' || raw.updatedAt.trim() === '') {
    raw.updatedAt = raw.createdAt;
  }
  if (!Array.isArray(raw.tags)) {
    raw.tags = [];
  }
  if (typeof raw.favorite !== 'boolean') raw.favorite = false;
  if (typeof raw.shared !== 'boolean') raw.shared = false;
  if (typeof raw.archived !== 'boolean') raw.archived = false;
  if (raw.ownerId === undefined) raw.ownerId = null;
  if (raw.permission !== 'owner' && raw.permission !== 'editor' && raw.permission !== 'viewer') {
    raw.permission = 'owner';
  }
  return validateNoteRecord(raw);
}

export function validateWorkspaceManifest(data: unknown): WorkspaceManifest {
  if (!data || typeof data !== 'object') {
    throw new IncompatibleSchemaError('Workspace manifest must be a non-null object');
  }
  const result = workspaceManifestSchema.safeParse(data);
  if (!result.success) {
    throw new IncompatibleSchemaError('Workspace manifest does not conform to manifest schema', {
      validationErrors: result.error.issues,
    });
  }
  return result.data;
}

export function validateOutboxMutation(data: unknown): OutboxMutation {
  if (!data || typeof data !== 'object') {
    throw new IncompatibleSchemaError('Outbox mutation must be a non-null object');
  }
  const result = outboxMutationSchema.safeParse(data);
  if (!result.success) {
    throw new IncompatibleSchemaError('Outbox mutation does not conform to outbox schema', {
      validationErrors: result.error.issues,
    });
  }
  return result.data;
}

export function validateLocalStateExportBundle(data: unknown): LocalStateExportBundle {
  if (!data || typeof data !== 'object') {
    throw new IncompatibleSchemaError('Recovery bundle must be a non-null object');
  }
  const result = localStateExportBundleSchema.safeParse(data);
  if (!result.success) {
    throw new IncompatibleSchemaError('Recovery bundle does not conform to localStateExportBundleSchema', {
      validationErrors: result.error.issues,
    });
  }
  return result.data as LocalStateExportBundle;
}

