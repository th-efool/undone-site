/**
 * Offline Recovery Engine for Personal Workspace
 *
 * Implements:
 * - Deterministic JSON export of local-first workspace state (notebooks, notes, assets, outbox)
 * - Cryptographic SHA-256 payload integrity verification
 * - Strictly typed validation against `localStateExportBundleSchema`
 * - Asset binary byte integrity and SHA-256 hash enforcement
 * - Atomic IndexedDB transaction restore supporting 'merge' (LWW) and 'replace' modes
 */

import type {
  WorkspaceScope,
  NotebookRecord,
  NoteRecord,
  AssetRecord,
  OutboxMutation,
  UnsavedEditorBuffer,
  LocalStateExportBundle,
  CommittedWorkspaceState,
} from '@/src/shared/personal-workspace/contracts';
import {
  workspaceScopeSchema,
  localStateExportBundleSchema,
  getWorkspaceDatabaseName,
} from '@/src/shared/personal-workspace/contracts';
import {
  computeSha256,
  canonicalJsonStringify,
  secureTimingSafeEqual,
  validateAssetRecord,
} from '@/src/shared/personal-workspace/serialization';
import {
  CorruptAssetIntegrityError,
  IncompatibleSchemaError,
} from '@/src/shared/personal-workspace/errors';
import type { PersonalWorkspaceRepository } from './repository';

export interface RecoveryImportOptions {
  mode?: 'merge' | 'replace';
  verifyBundleChecksum?: boolean;
}

export interface RecoveryImportResult {
  ok: true;
  notebooksImported: number;
  notesImported: number;
  assetsImported: number;
}

/**
 * Exports an offline recovery bundle containing all committed state and outbox mutations.
 * Returns a JSON Blob with MIME type `application/json` and deterministic lexicographical serialization.
 */
export async function exportRecoveryBundle(
  repo: PersonalWorkspaceRepository,
  scope: WorkspaceScope,
): Promise<Blob> {
  const validScope = workspaceScopeSchema.parse(scope);
  if (validScope.userId !== repo.userId) {
    throw new Error(
      `Scope userId "${validScope.userId}" does not match repository userId "${repo.userId}"`,
    );
  }

  const storageName = getWorkspaceDatabaseName(validScope);

  const [notebooks, notes, assets, outbox, unsavedBuffers] = await repo
    .getDatabase()
    .runTransaction(
      ['notebooks', 'notes', 'assets', 'outbox', 'editor_buffers'],
      'readonly',
      (ctx) => [
        ctx.getAll<NotebookRecord>('notebooks'),
        ctx.getAll<NoteRecord>('notes'),
        ctx.getAll<AssetRecord>('assets'),
        ctx.getAll<OutboxMutation>('outbox'),
        ctx.getAll<UnsavedEditorBuffer>('editor_buffers'),
      ],
    );

  const committedState: CommittedWorkspaceState = {
    notebooks,
    notes,
    assets,
    outbox,
  };

  const payloadToHash = {
    formatVersion: '1.0.0' as const,
    exportedAt: new Date().toISOString(),
    sourceUserId: validScope.userId,
    storageName,
    committedState,
    ...(unsavedBuffers.length > 0 ? { unsavedBuffers } : {}),
  };

  const canonicalPayload = canonicalJsonStringify(payloadToHash);
  const checksum = computeSha256(canonicalPayload);

  const rawBundle = {
    ...payloadToHash,
    checksum,
  };

  const bundle = localStateExportBundleSchema.parse(rawBundle) as LocalStateExportBundle;
  const serialized = canonicalJsonStringify(bundle);

  return new Blob([serialized], { type: 'application/json' });
}

/**
 * Imports an offline recovery bundle into the workspace repository.
 * Validates bundle schema, verifies asset SHA-256 hashes, and commits atomically.
 */
export async function importRecoveryBundle(
  repo: PersonalWorkspaceRepository,
  bundle: unknown,
  options?: RecoveryImportOptions,
): Promise<RecoveryImportResult> {
  let rawData: unknown = bundle;

  if (bundle instanceof Blob) {
    let text: string;
    try {
      text = await bundle.text();
    } catch (err) {
      throw new IncompatibleSchemaError(
        `Failed to read recovery bundle Blob: ${err instanceof Error ? err.message : String(err)}`,
        { cause: err },
      );
    }
    try {
      rawData = JSON.parse(text);
    } catch (err) {
      throw new IncompatibleSchemaError(
        `Malformed JSON in recovery bundle Blob: ${err instanceof Error ? err.message : String(err)}`,
        { cause: err },
      );
    }
  } else if (typeof bundle === 'string') {
    try {
      rawData = JSON.parse(bundle);
    } catch (err) {
      throw new IncompatibleSchemaError(
        `Malformed JSON in recovery bundle string: ${err instanceof Error ? err.message : String(err)}`,
        { cause: err },
      );
    }
  }

  if (!rawData || typeof rawData !== 'object') {
    throw new IncompatibleSchemaError('Recovery bundle payload must be a non-null object');
  }

  const parseResult = localStateExportBundleSchema.safeParse(rawData);
  if (!parseResult.success) {
    const issues = parseResult.error.issues;
    const versionIssue = issues.find((issue) => issue.path.includes('formatVersion'));
    if (versionIssue) {
      const actualVersion = (rawData as Record<string, unknown>).formatVersion;
      throw new IncompatibleSchemaError(
        `Invalid bundle schema version: expected "1.0.0", received ${typeof actualVersion === 'string' ? `"${actualVersion}"` : String(actualVersion)}`,
        {
          expectedVersion: '1.0.0',
          actualVersion: typeof actualVersion === 'string' ? actualVersion : undefined,
          validationErrors: issues,
        },
      );
    }
    throw new IncompatibleSchemaError(
      `Recovery bundle does not conform to localStateExportBundleSchema: ${issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
      {
        validationErrors: issues,
      },
    );
  }

  const validBundle = parseResult.data as LocalStateExportBundle;

  // Verifies asset SHA-256 checksums: for any asset record, its base64 data must match its declared hash.
  for (const asset of validBundle.committedState.assets) {
    try {
      validateAssetRecord(asset, { verifyHash: true });
    } catch (err) {
      if (err instanceof CorruptAssetIntegrityError) {
        throw err;
      }
      throw new CorruptAssetIntegrityError(
        `Asset checksum verification failed for asset "${asset.id}": ${err instanceof Error ? err.message : String(err)}`,
        {
          assetId: asset.id,
          cause: err,
        },
      );
    }
  }

  // Verifies recovery bundle payload checksum
  if (options?.verifyBundleChecksum !== false) {
    const { checksum, ...payload } = validBundle;
    const computedHash = computeSha256(canonicalJsonStringify(payload));
    const computedStandardHash = computeSha256(JSON.stringify(payload));

    if (
      !secureTimingSafeEqual(computedHash, checksum) &&
      !secureTimingSafeEqual(computedStandardHash, checksum)
    ) {
      throw new CorruptAssetIntegrityError(
        `Recovery bundle checksum mismatch: expected ${checksum}, computed ${computedHash}`,
        {
          expectedHash: checksum,
          actualHash: computedHash,
        },
      );
    }
  }

  const mode = options?.mode ?? 'merge';

  const result = await repo.getDatabase().runTransaction(
    ['notebooks', 'notes', 'assets', 'outbox', 'editor_buffers'],
    'readwrite',
    (ctx) => {
      let notebooksImported = 0;
      let notesImported = 0;
      let assetsImported = 0;

      if (mode === 'replace') {
        const existingNotebooks = ctx.getAll<NotebookRecord>('notebooks');
        for (const nb of existingNotebooks) {
          ctx.delete('notebooks', nb.id);
        }
        const existingNotes = ctx.getAll<NoteRecord>('notes');
        for (const n of existingNotes) {
          ctx.delete('notes', n.id);
        }
        const existingAssets = ctx.getAll<AssetRecord>('assets');
        for (const a of existingAssets) {
          ctx.delete('assets', a.id);
        }
        const existingOutbox = ctx.getAll<OutboxMutation>('outbox');
        for (const o of existingOutbox) {
          ctx.delete('outbox', o.id);
        }
        const existingBuffers = ctx.getAll<UnsavedEditorBuffer>('editor_buffers');
        for (const b of existingBuffers) {
          ctx.delete('editor_buffers', b.noteId);
        }

        for (const nb of validBundle.committedState.notebooks) {
          ctx.put('notebooks', nb.id, nb);
          notebooksImported++;
        }

        for (const note of validBundle.committedState.notes) {
          ctx.put('notes', note.id, note);
          notesImported++;
        }

        for (const asset of validBundle.committedState.assets) {
          ctx.put('assets', asset.id, asset);
          assetsImported++;
        }
      } else {
        // 'merge' mode: updates or inserts based on updatedAt / LWW timestamp
        for (const nb of validBundle.committedState.notebooks) {
          const existing = ctx.get<NotebookRecord>('notebooks', nb.id);
          if (!existing) {
            ctx.put('notebooks', nb.id, nb);
            notebooksImported++;
          } else {
            const incomingTime = nb.updatedAt ?? nb.createdAt ?? '';
            const existingTime = existing.updatedAt ?? existing.createdAt ?? '';
            if (incomingTime >= existingTime) {
              ctx.put('notebooks', nb.id, nb);
              notebooksImported++;
            }
          }
        }

        for (const note of validBundle.committedState.notes) {
          const existing = ctx.get<NoteRecord>('notes', note.id);
          if (!existing) {
            ctx.put('notes', note.id, note);
            notesImported++;
          } else {
            const incomingTime = note.updatedAt || note.createdAt || '';
            const existingTime = existing.updatedAt || existing.createdAt || '';
            if (incomingTime >= existingTime) {
              ctx.put('notes', note.id, note);
              notesImported++;
            }
          }
        }

        for (const asset of validBundle.committedState.assets) {
          ctx.put('assets', asset.id, asset);
          assetsImported++;
        }
      }

      if (validBundle.committedState.outbox) {
        for (const mutation of validBundle.committedState.outbox) {
          ctx.put('outbox', mutation.id, mutation);
        }
      }

      if (validBundle.unsavedBuffers) {
        for (const buffer of validBundle.unsavedBuffers) {
          ctx.put('editor_buffers', buffer.noteId, buffer);
        }
      }

      return {
        ok: true as const,
        notebooksImported,
        notesImported,
        assetsImported,
      };
    },
  );

  try {
    repo.getLockCoordinator()?.broadcast({
      type: 'WORKSPACE_MUTATED',
      tabId: repo.getLockCoordinator().tabId,
      entityType: 'notebook',
      entityId: 'recovery-import',
    });
  } catch {
    // Non-fatal if broadcast fails in non-browser or test context
  }

  return result;
}
