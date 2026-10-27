import { describe, it, expect } from 'vitest';
import {
  WorkspaceScope,
  getWorkspaceDatabaseName,
  NotebookRecord,
  CanvasNoteRecord,
  KanbanNoteRecord,
  MarkdownNoteRecord,
  NoteRecord,
  AssetRecord,
  OutboxMutation,
  WorkspaceManifest,
  LocalReceipt,
  SyncSummary,
  canonicalJsonStringify,
  computeSha256,
  secureTimingSafeEqual,
  validateRawAssetSize,
  validateAssetRecord,
  validateWorkspaceAssetDependencies,
  validateNotebookRecord,
  validateNoteRecord,
  validateWorkspaceManifest,
  validateOutboxMutation,
  MAX_RAW_ASSET_DIRECT_BYTES,
  MAX_RAW_ASSET_CHUNKED_BYTES,
  PersonalWorkspaceError,
  StorageQuotaExceededError,
  LockAcquisitionTimeoutError,
  ConcurrencyConflictError,
  CorruptAssetIntegrityError,
  IncompatibleSchemaError,
  RepositoryBindingError,
  AssetSizeLimitExceededError,
  TransactionAbortError,
  isPersonalWorkspaceError,
} from '../index';

describe('Personal Workspace Contracts & Scope', () => {
  it('computes isolated database name from WorkspaceScope', () => {
    const scope: WorkspaceScope = { userId: 'usr-alice-123' };
    expect(getWorkspaceDatabaseName(scope)).toBe('workspace_usr-alice-123');

    const boundScope: WorkspaceScope = {
      userId: 'usr-bob-456',
      workspaceId: 'ws-primary',
      bindingEpoch: 2,
    };
    expect(getWorkspaceDatabaseName(boundScope)).toBe('workspace_usr-bob-456');
  });

  it('rejects empty or whitespace userId in scope', () => {
    expect(() => getWorkspaceDatabaseName({ userId: '' })).toThrow();
    expect(() => getWorkspaceDatabaseName({ userId: '   ' })).toThrow();
  });
});

describe('Canonical JSON Serialization', () => {
  it('deterministically sorts object keys lexicographically', () => {
    const objA = { z: 1, a: 2, m: { y: 10, b: 20 } };
    const objB = { m: { b: 20, y: 10 }, a: 2, z: 1 };

    const strA = canonicalJsonStringify(objA);
    const strB = canonicalJsonStringify(objB);

    expect(strA).toBe('{"a":2,"m":{"b":20,"y":10},"z":1}');
    expect(strA).toBe(strB);
    expect(computeSha256(strA)).toBe(computeSha256(strB));
  });

  it('preserves array element order while canonically sorting objects inside', () => {
    const arr = [{ b: 1, a: 2 }, { y: 3, x: 4 }];
    const serialized = canonicalJsonStringify(arr);
    expect(serialized).toBe('[{"a":2,"b":1},{"x":4,"y":3}]');
  });

  it('omits undefined properties and functions in objects, but preserves null in arrays', () => {
    const obj = {
      keep: 'yes',
      dropUndef: undefined,
      dropFunc: () => {},
      nested: {
        keepToo: 42,
        arr: [1, undefined, null, 'text'],
      },
    };

    const serialized = canonicalJsonStringify(obj);
    expect(serialized).toBe('{"keep":"yes","nested":{"arr":[1,null,null,"text"],"keepToo":42}}');
  });

  it('detects circular references and throws TypeError', () => {
    const circular: { a: number; self?: unknown } = { a: 1 };
    circular.self = circular;
    expect(() => canonicalJsonStringify(circular)).toThrow(TypeError);
  });
});

describe('Cryptographic SHA-256 and Timing-Safe Equality', () => {
  it('computes correct standard SHA-256 hash vector', () => {
    // Known test vector for "hello"
    const hash = computeSha256('hello');
    expect(hash).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
  });

  it('computes identical hashes for Buffer and Uint8Array', () => {
    const str = 'Undone Personal Workspace Durability';
    const buf = Buffer.from(str, 'utf8');
    const uint8 = new Uint8Array(buf);

    expect(computeSha256(str)).toBe(computeSha256(buf));
    expect(computeSha256(buf)).toBe(computeSha256(uint8));
  });

  it('verifies strings in constant time', () => {
    const a = 'hash-abc-12345';
    const b = 'hash-abc-12345';
    const c = 'hash-abc-99999';

    expect(secureTimingSafeEqual(a, b)).toBe(true);
    expect(secureTimingSafeEqual(a, c)).toBe(false);
    expect(secureTimingSafeEqual(a, 'short')).toBe(false);
    expect(secureTimingSafeEqual(null as unknown as string, a)).toBe(false);
  });
});

describe('Physical Limits & Asset Validation', () => {
  it('enforces 3.0 MiB direct and 5.0 MiB chunked raw binary limits', () => {
    // Under direct limit (2 MiB)
    expect(() => validateRawAssetSize(2 * 1024 * 1024, false)).not.toThrow();

    // At direct limit (3.0 MiB)
    expect(() => validateRawAssetSize(MAX_RAW_ASSET_DIRECT_BYTES, false)).not.toThrow();

    // Over direct limit (3.5 MiB) without chunking flag -> throws AssetSizeLimitExceededError
    expect(() => validateRawAssetSize(3.5 * 1024 * 1024, false)).toThrow(AssetSizeLimitExceededError);

    // Over direct limit (3.5 MiB) WITH chunking flag -> passes
    expect(() => validateRawAssetSize(3.5 * 1024 * 1024, true)).not.toThrow();

    // Exactly at chunked limit ceiling (5.0 MiB) -> passes
    expect(() => validateRawAssetSize(MAX_RAW_ASSET_CHUNKED_BYTES, true)).not.toThrow();

    // Over chunked ceiling (5.5 MiB) -> throws AssetSizeLimitExceededError even when chunked
    expect(() => validateRawAssetSize(5.5 * 1024 * 1024, true)).toThrow(AssetSizeLimitExceededError);

    // Zero or negative byte length -> throws CorruptAssetIntegrityError
    expect(() => validateRawAssetSize(0)).toThrow(CorruptAssetIntegrityError);
    expect(() => validateRawAssetSize(-100)).toThrow(CorruptAssetIntegrityError);
  });

  it('validates genuine asset and catches tampered hash', () => {
    const rawData = 'test image binary content';
    const rawBytes = Buffer.from(rawData, 'utf8');
    const validHash = computeSha256(rawBytes);

    const validAsset: AssetRecord = {
      id: 'asset-img-001',
      hash: validHash,
      mimeType: 'image/png',
      byteLength: rawBytes.byteLength,
      base64Data: rawBytes.toString('base64'),
    };

    const validated = validateAssetRecord(validAsset);
    expect(validated.id).toBe('asset-img-001');

    // Tampered hash
    const corruptAsset = {
      ...validAsset,
      hash: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    };
    expect(() => validateAssetRecord(corruptAsset)).toThrow(CorruptAssetIntegrityError);

    // Tampered byteLength
    const badLengthAsset = {
      ...validAsset,
      byteLength: validAsset.byteLength + 10,
    };
    expect(() => validateAssetRecord(badLengthAsset)).toThrow(CorruptAssetIntegrityError);
  });

  it('requires every referenced canvas/kanban asset to exist in the workspace snapshot', () => {
    const hash = 'a'.repeat(64);
    const note: NoteRecord = {
      id: 'note-assets', notebookId: 'nb', title: 'Assets', contentType: 'canvas', order: 0,
      createdAt: '2026-10-27T00:00:00.000Z', updatedAt: '2026-10-27T00:00:00.000Z',
      canvasData: {
        elements: [{ id: 'image', type: 'image', assetHash: hash }],
        appState: {}, files: { image: { dataURL: `asset://${hash}` } },
        assetFileIds: ['asset-id'], assetHashes: { 'asset-id': hash },
      },
    } as NoteRecord;
    const asset: AssetRecord = {
      id: 'asset-id', hash, mimeType: 'image/png', byteLength: 1, base64Data: 'YQ==',
    };

    expect(() => validateWorkspaceAssetDependencies([note], [asset])).not.toThrow();
    expect(() => validateWorkspaceAssetDependencies([note], [])).toThrow(/asset-id|missing assets/);
  });
});

describe('Domain Payload Validators', () => {
  it('validates a NotebookRecord conforming to schema', () => {
    const validNotebook: NotebookRecord = {
      id: 'nb-test-01',
      title: 'Valid Notebook',
      color: '#4f46e5',
      icon: 'folder',
      favorite: true,
      archived: false,
      order: 0,
      createdAt: '2026-10-27T08:00:00.000Z',
      updatedAt: '2026-10-27T08:00:00.000Z',
    };

    const res = validateNotebookRecord(validNotebook);
    expect(res.id).toBe('nb-test-01');

    expect(() => validateNotebookRecord({ id: 'bad' })).toThrow(IncompatibleSchemaError);
  });

  it('validates discriminated NoteRecord variants (canvas, kanban, markdown)', () => {
    const canvasNote: CanvasNoteRecord = {
      id: 'note-c1',
      notebookId: 'nb-1',
      title: 'Canvas Note',
      order: 0,
      createdAt: '2026-10-27T08:00:00.000Z',
      updatedAt: '2026-10-27T08:00:00.000Z',
      contentType: 'canvas',
      canvasData: {
        elements: [{ id: 'rect1', type: 'rectangle' }],
        appState: { viewBackgroundColor: '#ffffff' },
      },
    };

    const kanbanNote: KanbanNoteRecord = {
      id: 'note-k1',
      notebookId: 'nb-1',
      title: 'Kanban Note',
      order: 1,
      createdAt: '2026-10-27T08:00:00.000Z',
      updatedAt: '2026-10-27T08:00:00.000Z',
      contentType: 'kanban',
      kanbanData: {
        columns: [{ id: 'col1', title: 'To Do', order: 0 }],
        cards: [{ id: 'card1', columnId: 'col1', title: 'Task 1', order: 0 }],
      },
    };

    const markdownNote: MarkdownNoteRecord = {
      id: 'note-m1',
      notebookId: 'nb-1',
      title: 'Markdown Note',
      order: 2,
      createdAt: '2026-10-27T08:00:00.000Z',
      updatedAt: '2026-10-27T08:00:00.000Z',
      contentType: 'markdown',
      markdownData: {
        markdown: '# Title\n\nContent here.',
      },
    };

    expect(validateNoteRecord(canvasNote).contentType).toBe('canvas');
    expect(validateNoteRecord(kanbanNote).contentType).toBe('kanban');
    expect(validateNoteRecord(markdownNote).contentType).toBe('markdown');

    const notesList: NoteRecord[] = [canvasNote, kanbanNote, markdownNote];
    expect(notesList).toHaveLength(3);

    // Unknown or mismatched content type throws IncompatibleSchemaError
    expect(() =>
      validateNoteRecord({
        id: 'note-invalid',
        notebookId: 'nb-1',
        title: 'Invalid',
        order: 0,
        createdAt: '2026-10-27T08:00:00.000Z',
        updatedAt: '2026-10-27T08:00:00.000Z',
        contentType: 'canvas',
        // missing canvasData
      })
    ).toThrow(IncompatibleSchemaError);
    const receipt: LocalReceipt = {
      ok: true,
      committedAt: '2026-10-27T08:00:00.000Z',
      outboxEntryId: 'mut-01',
    };
    expect(receipt.ok).toBe(true);

    const summary: SyncSummary = {
      status: 'synced',
      pendingMutations: 0,
      lastSyncedAt: '2026-10-27T08:00:00.000Z',
      conflictCount: 0,
    };
    expect(summary.status).toBe('synced');
  });

  it('validates OutboxMutation and WorkspaceManifest', () => {
    const mutation: OutboxMutation = {
      id: 'mut-01',
      clientTimestamp: '2026-10-27T08:00:00.000Z',
      mutationType: 'update',
      entityType: 'note',
      entityId: 'note-c1',
      payload: { title: 'Updated' },
      status: 'pending',
      retryCount: 0,
      generation: 1,
    };
    expect(validateOutboxMutation(mutation).id).toBe('mut-01');

    const manifest: WorkspaceManifest = {
      manifestVersion: 1,
      workspaceId: 'ws-val-01',
      notebooks: [{ id: 'nb-1', path: 'undone/notebooks/nb-1.json', hash: 'a'.repeat(64) }],
      notes: [{ id: 'n-1', path: 'undone/notes/n-1.json', hash: 'b'.repeat(64), contentType: 'canvas' }],
      assets: [{ id: 'a-1', path: 'undone/assets/hash.png', sha256: 'c'.repeat(64), gitSha: 'd'.repeat(40) }],
    };
    expect(validateWorkspaceManifest(manifest).workspaceId).toBe('ws-val-01');
  });
});

describe('Typed Error Hierarchy', () => {
  it('correctly inherits from PersonalWorkspaceError and Error', () => {
    const errors = [
      new StorageQuotaExceededError('Quota reached', { quotaBytes: 500, requestedBytes: 600 }),
      new LockAcquisitionTimeoutError('Lock busy', { lockName: 'tab-lock', timeoutMs: 3000 }),
      new ConcurrencyConflictError('Diverged', { entityId: 'note-1', expectedGeneration: 1, actualGeneration: 2 }),
      new CorruptAssetIntegrityError('Tampered', { assetId: 'asset-1' }),
      new IncompatibleSchemaError('Invalid schema', { entityId: 'nb-1' }),
      new RepositoryBindingError('Public repo', { repositoryId: 12345, reason: 'private required' }),
      new AssetSizeLimitExceededError('Too large', { byteLength: 6000000, maxBytes: 5242880, isChunked: true }),
      new TransactionAbortError('Aborted'),
    ];

    for (const err of errors) {
      expect(err instanceof Error).toBe(true);
      expect(err instanceof PersonalWorkspaceError).toBe(true);
      expect(isPersonalWorkspaceError(err)).toBe(true);
      expect(typeof err.code).toBe('string');
      expect(err.code.length).toBeGreaterThan(0);
    }

    expect(isPersonalWorkspaceError(new Error('generic'))).toBe(false);
  });
});
