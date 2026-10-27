import { describe, it, expect } from 'vitest';
import {
  FIXTURE_NOTEBOOK,
  FIXTURE_CANVAS_NOTE,
  FIXTURE_CANVAS_ASSET,
  FIXTURE_KANBAN_NOTE,
  FIXTURE_BACKUP_ONLY_CANVAS,
  FIXTURE_DIVERGENT_RECORDS,
  FIXTURE_MALFORMED_RECORD,
  FIXTURE_CORRUPT_ASSET,
  FIXTURE_NOTEBOOK_CHILD_RACE,
  computeSha256,
} from '../fixtures';

describe('V0 Synthetic Validation Fixtures', () => {
  it('validates notebook fixture integrity', () => {
    expect(FIXTURE_NOTEBOOK.id).toBe('nb-synthetic-01');
    expect(FIXTURE_NOTEBOOK.title).toBe('Systems Architecture');
    expect(FIXTURE_NOTEBOOK.favorite).toBe(true);
  });

  it('validates canvas fixture and asset cryptographic hash match', () => {
    expect(FIXTURE_CANVAS_NOTE.contentType).toBe('canvas');
    expect(FIXTURE_CANVAS_NOTE.scene.elements).toHaveLength(3);

    const assetRef = FIXTURE_CANVAS_NOTE.scene.elements.find((e) => e.type === 'image');
    expect(assetRef).toBeDefined();
    expect(assetRef?.fileId).toBe(FIXTURE_CANVAS_ASSET.id);

    // Verify declared SHA256 against reconstructed bytes
    const computedHash = computeSha256(Buffer.from(FIXTURE_CANVAS_ASSET.base64Data, 'base64'));
    expect(computedHash).toBe(FIXTURE_CANVAS_ASSET.hash);
    expect(FIXTURE_CANVAS_NOTE.scene.assetHashes[FIXTURE_CANVAS_ASSET.id]).toBe(computedHash);
  });

  it('validates kanban note structure', () => {
    expect(FIXTURE_KANBAN_NOTE.contentType).toBe('kanban');
    expect(FIXTURE_KANBAN_NOTE.kanbanColumns).toHaveLength(3);
    expect(FIXTURE_KANBAN_NOTE.kanbanCards).toHaveLength(2);
  });

  it('detects backup-only canvas payload without primary equivalent', () => {
    expect(FIXTURE_BACKUP_ONLY_CANVAS.backupKey).toContain('backup');
    const parsed = JSON.parse(FIXTURE_BACKUP_ONLY_CANVAS.rawPayload);
    expect(parsed.noteId).toBe('note-backup-only-01');
  });

  it('identifies divergent server and local records from same base', () => {
    expect(FIXTURE_DIVERGENT_RECORDS.base.id).toBe(FIXTURE_DIVERGENT_RECORDS.server.id);
    expect(FIXTURE_DIVERGENT_RECORDS.server.version).toBe(FIXTURE_DIVERGENT_RECORDS.local.version);
    expect(FIXTURE_DIVERGENT_RECORDS.server.content).not.toBe(FIXTURE_DIVERGENT_RECORDS.local.content);
  });

  it('fails integrity on corrupt/tampered asset', () => {
    expect(FIXTURE_CORRUPT_ASSET.actualHash).not.toBe(FIXTURE_CORRUPT_ASSET.declaredHash);
  });

  it('identifies orphaned child in notebook-child race', () => {
    expect(FIXTURE_NOTEBOOK_CHILD_RACE.notebook.archived).toBe(true);
    expect(FIXTURE_NOTEBOOK_CHILD_RACE.childNote.notebookId).toBe(FIXTURE_NOTEBOOK_CHILD_RACE.notebook.id);
  });
});
