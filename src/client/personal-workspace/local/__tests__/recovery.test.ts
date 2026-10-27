/**
 * Comprehensive Unit Tests for Offline Recovery Engine
 *
 * Conforms to requirements for local-first personal workspace recovery:
 * - Full roundtrip: create notebook, canvas note with asset -> export bundle -> clear repo -> import bundle
 * - Verification of data integrity, asset hash match, and state reconstitution
 * - Test validation rejection: corrupted asset hash, invalid bundle schema version, malformed JSON
 * - Test mode 'replace' (clears existing) vs mode 'merge' (Last-Write-Wins timestamp resolution)
 * - Test account scope validation and deterministic serialization
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { exportRecoveryBundle, importRecoveryBundle } from '../recovery';
import { PersonalWorkspaceRepository } from '../repository';
import { TabLockCoordinator } from '../database';
import type {
  WorkspaceScope,
  NotebookRecord,
  CanvasNoteRecord,
  AssetRecord,
  LocalStateExportBundle,
} from '@/src/shared/personal-workspace/contracts';
import {
  CorruptAssetIntegrityError,
  IncompatibleSchemaError,
} from '@/src/shared/personal-workspace/errors';
import {
  SYNTHETIC_PNG_BASE64,
  SYNTHETIC_ASSET_HASH,
  SYNTHETIC_ASSET_BYTES,
} from '@/src/client/screens/dashboard/notes/validation/fixtures';

describe('Offline Recovery Export & Import Engine', () => {
  const TEST_USER = 'user-recovery-engineer-01';
  const TEST_SCOPE: WorkspaceScope = { userId: TEST_USER };

  let repo: PersonalWorkspaceRepository;

  const testNotebook: NotebookRecord = {
    id: 'nb-synthetic-recovery-01',
    title: 'Systems Architecture',
    description: 'Offline recovery verification notebook',
    color: '#4f46e5',
    icon: 'cpu',
    favorite: true,
    shared: false,
    archived: false,
    collapsed: false,
    order: 0,
    createdAt: '2026-10-27T08:00:00.000Z',
    updatedAt: '2026-10-27T08:00:00.000Z',
  };

  const testAsset: AssetRecord = {
    id: 'asset-img-recovery-01',
    hash: SYNTHETIC_ASSET_HASH,
    mimeType: 'image/png',
    byteLength: SYNTHETIC_ASSET_BYTES.byteLength,
    base64Data: SYNTHETIC_PNG_BASE64,
  };

  const testCanvasNote: CanvasNoteRecord = {
    id: 'note-canvas-recovery-01',
    notebookId: testNotebook.id,
    title: 'Network Topology Diagram',
    order: 0,
    createdAt: '2026-10-27T08:05:00.000Z',
    updatedAt: '2026-10-27T08:05:00.000Z',
    contentType: 'canvas',
    canvasData: {
      elements: [
        {
          id: 'element-rect-1',
          type: 'rectangle',
          x: 40,
          y: 50,
          width: 140,
          height: 90,
        },
      ],
      appState: {
        viewBackgroundColor: '#ffffff',
      },
      assetFileIds: [testAsset.id],
      schemaVersion: 1,
      assetHashes: {
        [testAsset.id]: SYNTHETIC_ASSET_HASH,
      },
    },
  };

  beforeEach(async () => {
    TabLockCoordinator.resetAllLocks();
    repo = new PersonalWorkspaceRepository(TEST_USER, { useMemory: true });
    await repo.clearAll();
  });

  afterEach(async () => {
    await repo.clearAll();
    TabLockCoordinator.resetAllLocks();
  });

  describe('1. Full Roundtrip State Export and Reconstitution', () => {
    it('exports recovery bundle to JSON Blob with MIME type application/json', async () => {
      await repo.saveNotebookAtomic(testNotebook);
      await repo.saveCanvasNoteAtomic(testCanvasNote, [testAsset]);

      const blob = await exportRecoveryBundle(repo, TEST_SCOPE);

      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('application/json');

      const text = await blob.text();
      const bundle = JSON.parse(text) as LocalStateExportBundle;

      expect(bundle.formatVersion).toBe('1.0.0');
      expect(bundle.sourceUserId).toBe(TEST_USER);
      expect(bundle.storageName).toBe(`workspace_${TEST_USER}`);
      expect(bundle.checksum).toMatch(/^[0-9a-f]{64}$/);
      expect(bundle.committedState.notebooks).toHaveLength(1);
      expect(bundle.committedState.notes).toHaveLength(1);
      expect(bundle.committedState.assets).toHaveLength(1);
      expect(bundle.committedState.outbox.length).toBeGreaterThanOrEqual(2);
    });

    it('performs full roundtrip: export -> clear repo -> import -> reconstitute state', async () => {
      // 1. Create notebook, canvas note with asset
      await repo.saveNotebookAtomic(testNotebook);
      await repo.saveCanvasNoteAtomic(testCanvasNote, [testAsset]);

      // 2. Export recovery bundle
      const blob = await exportRecoveryBundle(repo, TEST_SCOPE);

      // 3. Clear repository completely
      await repo.clearAll();
      expect(await repo.getAllNotebooks()).toHaveLength(0);
      expect(await repo.getAllNotes()).toHaveLength(0);
      expect(await repo.getAllAssets()).toHaveLength(0);

      // 4. Import recovery bundle
      const result = await importRecoveryBundle(repo, blob);

      expect(result).toEqual({
        ok: true,
        notebooksImported: 1,
        notesImported: 1,
        assetsImported: 1,
      });

      // 5. Verify data integrity & state reconstitution
      const restoredNotebook = await repo.getNotebook<NotebookRecord>(testNotebook.id);
      expect(restoredNotebook).toBeDefined();
      expect(restoredNotebook?.id).toBe(testNotebook.id);
      expect(restoredNotebook?.title).toBe(testNotebook.title);
      expect(restoredNotebook?.color).toBe(testNotebook.color);
      expect(restoredNotebook?.favorite).toBe(testNotebook.favorite);

      const restoredNote = await repo.getNote<CanvasNoteRecord>(testCanvasNote.id);
      expect(restoredNote).toBeDefined();
      expect(restoredNote?.id).toBe(testCanvasNote.id);
      expect(restoredNote?.title).toBe(testCanvasNote.title);
      expect(restoredNote?.contentType).toBe('canvas');
      expect(restoredNote?.canvasData.elements).toEqual(testCanvasNote.canvasData.elements);
      expect(restoredNote?.canvasData.assetFileIds).toContain(testAsset.id);

      const restoredAsset = await repo.getAsset<AssetRecord>(testAsset.id);
      expect(restoredAsset).toBeDefined();
      expect(restoredAsset?.id).toBe(testAsset.id);
      expect(restoredAsset?.hash).toBe(SYNTHETIC_ASSET_HASH);
      expect(restoredAsset?.byteLength).toBe(SYNTHETIC_ASSET_BYTES.byteLength);
      expect(restoredAsset?.base64Data).toBe(SYNTHETIC_PNG_BASE64);
    });

    it('accepts recovery bundle as parsed object or JSON string', async () => {
      await repo.saveNotebookAtomic(testNotebook);
      const blob = await exportRecoveryBundle(repo, TEST_SCOPE);
      const jsonText = await blob.text();
      const parsedBundle = JSON.parse(jsonText) as LocalStateExportBundle;

      // Import via string
      await repo.clearAll();
      const resultString = await importRecoveryBundle(repo, jsonText);
      expect(resultString.notebooksImported).toBe(1);

      // Import via parsed object
      await repo.clearAll();
      const resultObject = await importRecoveryBundle(repo, parsedBundle);
      expect(resultObject.notebooksImported).toBe(1);
    });

    it('enforces scope isolation when exporting', async () => {
      await expect(
        exportRecoveryBundle(repo, { userId: 'different-user' }),
      ).rejects.toThrow('does not match repository userId');
    });
  });

  describe('2. Import Modes: Replace vs Merge (LWW)', () => {
    it('in "replace" mode, clears existing entities before importing bundle', async () => {
      // Pre-populate repo with an extra notebook that is not in the bundle
      const extraNotebook: NotebookRecord = {
        ...testNotebook,
        id: 'nb-extra-existing-only',
        title: 'Extra Pre-existing Notebook',
      };
      await repo.saveNotebookAtomic(extraNotebook);

      // Create bundle containing testNotebook only
      const tempRepo = new PersonalWorkspaceRepository(TEST_USER, { useMemory: true });
      await tempRepo.saveNotebookAtomic(testNotebook);
      const blob = await exportRecoveryBundle(tempRepo, TEST_SCOPE);
      await tempRepo.clearAll();

      // Ensure extraNotebook exists before import
      expect(await repo.getNotebook(extraNotebook.id)).toBeDefined();

      // Import in 'replace' mode
      const result = await importRecoveryBundle(repo, blob, { mode: 'replace' });
      expect(result.ok).toBe(true);
      expect(result.notebooksImported).toBe(1);

      // Extra pre-existing notebook must have been deleted
      expect(await repo.getNotebook(extraNotebook.id)).toBeNull();
      // Bundle notebook must be present
      expect(await repo.getNotebook(testNotebook.id)).toBeDefined();
    });

    it('in "merge" mode, applies Last-Write-Wins: preserves existing newer entities', async () => {
      // Create bundle with original testCanvasNote (updatedAt: 08:05:00)
      await repo.saveNotebookAtomic(testNotebook);
      await repo.saveCanvasNoteAtomic(testCanvasNote, [testAsset]);
      const blob = await exportRecoveryBundle(repo, TEST_SCOPE);

      // Update local repo note to be NEWER (updatedAt: 12:00:00)
      const newerLocalNote: CanvasNoteRecord = {
        ...testCanvasNote,
        title: 'Newer Locally Modified Title',
        updatedAt: '2026-10-27T12:00:00.000Z',
      };
      await repo.saveCanvasNoteAtomic(newerLocalNote);

      // Import bundle in 'merge' mode (default)
      const result = await importRecoveryBundle(repo, blob, { mode: 'merge' });
      expect(result.ok).toBe(true);
      // Since local note is newer, older note in bundle was not applied
      expect(result.notesImported).toBe(0);

      const currentNote = await repo.getNote<CanvasNoteRecord>(testCanvasNote.id);
      expect(currentNote?.title).toBe('Newer Locally Modified Title');
      expect(currentNote?.updatedAt).toBe('2026-10-27T12:00:00.000Z');
    });

    it('in "merge" mode, updates existing entity when incoming entity is newer', async () => {
      // Pre-populate repo with an older note
      const olderLocalNote: CanvasNoteRecord = {
        ...testCanvasNote,
        title: 'Stale Local Note',
        updatedAt: '2026-10-27T06:00:00.000Z',
      };
      await repo.saveCanvasNoteAtomic(olderLocalNote);

      // Create bundle with newer note (updatedAt: 08:05:00)
      const tempRepo = new PersonalWorkspaceRepository(TEST_USER, { useMemory: true });
      await tempRepo.saveNotebookAtomic(testNotebook);
      await tempRepo.saveCanvasNoteAtomic(testCanvasNote, [testAsset]);
      const blob = await exportRecoveryBundle(tempRepo, TEST_SCOPE);
      await tempRepo.clearAll();

      // Import in 'merge' mode
      const result = await importRecoveryBundle(repo, blob, { mode: 'merge' });
      expect(result.ok).toBe(true);
      expect(result.notesImported).toBe(1);

      const currentNote = await repo.getNote<CanvasNoteRecord>(testCanvasNote.id);
      expect(currentNote?.title).toBe(testCanvasNote.title);
      expect(currentNote?.updatedAt).toBe(testCanvasNote.updatedAt);
    });
  });

  describe('3. Validation Rejection & Tamper Detection', () => {
    it('rejects recovery bundle when asset hash does not match binary base64 data', async () => {
      await repo.saveNotebookAtomic(testNotebook);
      await repo.saveCanvasNoteAtomic(testCanvasNote, [testAsset]);

      const blob = await exportRecoveryBundle(repo, TEST_SCOPE);
      const text = await blob.text();
      const bundle = JSON.parse(text) as LocalStateExportBundle;

      // Corrupt the asset declared hash (syntactically valid 64-hex SHA-256 string, but wrong)
      bundle.committedState.assets[0].hash = '0'.repeat(64);

      await expect(importRecoveryBundle(repo, bundle)).rejects.toThrow(
        CorruptAssetIntegrityError,
      );
    });

    it('rejects recovery bundle when asset base64 data was tampered', async () => {
      await repo.saveNotebookAtomic(testNotebook);
      await repo.saveCanvasNoteAtomic(testCanvasNote, [testAsset]);

      const blob = await exportRecoveryBundle(repo, TEST_SCOPE);
      const text = await blob.text();
      const bundle = JSON.parse(text) as LocalStateExportBundle;

      // Tamper with base64 payload while keeping declared hash unchanged
      bundle.committedState.assets[0].base64Data = Buffer.from('corrupted-image-data').toString(
        'base64',
      );
      bundle.committedState.assets[0].byteLength = Buffer.from(
        'corrupted-image-data',
      ).byteLength;

      await expect(importRecoveryBundle(repo, bundle)).rejects.toThrow(
        CorruptAssetIntegrityError,
      );
    });

    it('rejects recovery bundle with invalid bundle schema version', async () => {
      await repo.saveNotebookAtomic(testNotebook);
      const blob = await exportRecoveryBundle(repo, TEST_SCOPE);
      const text = await blob.text();
      const rawObj = JSON.parse(text) as Record<string, unknown>;

      // Invalid format version (e.g. 2.0.0 instead of 1.0.0)
      rawObj.formatVersion = '2.0.0';

      await expect(importRecoveryBundle(repo, rawObj)).rejects.toThrow(
        IncompatibleSchemaError,
      );
    });

    it('rejects malformed JSON strings and blobs', async () => {
      await expect(
        importRecoveryBundle(repo, '<<<Not Valid JSON>>>'),
      ).rejects.toThrow(IncompatibleSchemaError);

      const malformedBlob = new Blob(['{ "unclosed": true, '], {
        type: 'application/json',
      });
      await expect(importRecoveryBundle(repo, malformedBlob)).rejects.toThrow(
        IncompatibleSchemaError,
      );
    });

    it('rejects null, non-object, and missing required property bundles', async () => {
      await expect(importRecoveryBundle(repo, null)).rejects.toThrow(
        IncompatibleSchemaError,
      );
      await expect(importRecoveryBundle(repo, 12345)).rejects.toThrow(
        IncompatibleSchemaError,
      );
      await expect(
        importRecoveryBundle(repo, { formatVersion: '1.0.0' }),
      ).rejects.toThrow(IncompatibleSchemaError);
    });

    it('rejects recovery bundle when bundle checksum has been tampered', async () => {
      await repo.saveNotebookAtomic(testNotebook);
      const blob = await exportRecoveryBundle(repo, TEST_SCOPE);
      const text = await blob.text();
      const bundle = JSON.parse(text) as LocalStateExportBundle;

      // Tamper with a notebook title without re-computing the bundle checksum
      bundle.committedState.notebooks[0].title = 'Tampered Notebook Title';

      await expect(importRecoveryBundle(repo, bundle)).rejects.toThrow(
        CorruptAssetIntegrityError,
      );
    });
  });
});
