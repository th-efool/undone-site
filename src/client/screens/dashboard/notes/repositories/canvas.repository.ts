import type { CanvasDocument, CanvasSceneData } from '../models/canvas.models';
import { LocalWorkspace } from '@/src/client/personal-workspace/local/facade';
import { computeSha256 } from '@/src/shared/personal-workspace/serialization';
import { notesRepository } from './notes.repository';

/** Max size for a single image file added to the canvas (checked at upload time). */
export const MAX_IMAGE_FILE_BYTES = 25 * 1024 * 1024; // 25 MB per media file

/** Max size for the whole serialized scene stored in localStorage. */
const MAX_SCENE_BYTES = 10 * 1024 * 1024; // 10 MB total

export type SaveResult =
  | { ok: true; trimmed: false }
  | { ok: true; trimmed: true; droppedFileIds: string[]; reason: string }
  | { ok: false; error: string };

export class CanvasRepository {
  private activeUserId: string | null = null;

  setActiveUserId(userId: string | null): void {
    this.activeUserId = userId;
  }

  private getKey(noteId: string) {
    return `sidequesthq.canvas.${noteId}`;
  }

  /** Emergency backup key — written synchronously on every scene change, never throws. */
  private getBackupKey(noteId: string) {
    return `sidequesthq.canvas.backup.${noteId}`;
  }

  private resolveNoteMetadata(userId: string, noteId: string): { title?: string; notebookId?: string } {
    try {
      const workspaceState = LocalWorkspace.getLocalWorkspace(userId).getNotesState();
      const wsNote = workspaceState.notes.find((n) => n.id === noteId);
      if (wsNote) {
        return { title: wsNote.title, notebookId: wsNote.notebookId };
      }
      const cachedState = notesRepository.getInitialState(userId);
      const cachedNote = cachedState.notes.find((n) => n.id === noteId);
      if (cachedNote) {
        return { title: cachedNote.title, notebookId: cachedNote.notebookId };
      }
    } catch {}
    return {};
  }

  getLegacyStorageInventory(): Array<{
    noteId: string;
    hasPrimary: boolean;
    hasBackup: boolean;
    primaryHash: string | null;
    backupHash: string | null;
    differs: boolean;
  }> {
    if (typeof window === 'undefined') return [];
    const noteIds = new Set<string>();
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (key?.startsWith('sidequesthq.canvas.backup.')) noteIds.add(key.slice('sidequesthq.canvas.backup.'.length));
      else if (key?.startsWith('sidequesthq.canvas.')) noteIds.add(key.slice('sidequesthq.canvas.'.length));
    }
    return Array.from(noteIds, (noteId) => {
      const readHash = (key: string) => {
        const raw = window.localStorage.getItem(key);
        if (!raw) return null;
        try {
          return computeSha256(JSON.stringify(JSON.parse(raw)));
        } catch {
          return 'invalid';
        }
      };
      const primaryHash = readHash(this.getKey(noteId));
      const backupHash = readHash(this.getBackupKey(noteId));
      return {
        noteId,
        hasPrimary: primaryHash !== null,
        hasBackup: backupHash !== null,
        primaryHash,
        backupHash,
        differs: primaryHash !== null && backupHash !== null && primaryHash !== backupHash,
      };
    });
  }

  private getEffectiveUserId(): string {
    if (this.activeUserId) return this.activeUserId;
    if (typeof window !== 'undefined' && (window as any).__UNDONE_ACTIVE_USER_ID__) {
      return (window as any).__UNDONE_ACTIVE_USER_ID__;
    }
    return 'local-user';
  }

  async load(noteId: string): Promise<CanvasDocument | null> {
    if (typeof window === 'undefined') return null;

    const userId = this.getEffectiveUserId();

    // 1. First priority: Load from account-scoped LocalWorkspace (IndexedDB)
    if (userId) {
      try {
        const workspace = LocalWorkspace.getLocalWorkspace(userId);
        const note = await workspace.getRepository().getNote(noteId);
        if (note && note.contentType === 'canvas') {
          const rawCanvasData = (note as any).canvasData;
          if (rawCanvasData) {
            const files = { ...(rawCanvasData.files || {}) };

            // Rehydrate any content-addressable `asset://${hash}` references
            for (const [fileId, fileObj] of Object.entries(files)) {
              const f = fileObj as { dataURL?: string; assetHash?: string; [k: string]: unknown };
              if (f.dataURL && f.dataURL.startsWith('asset://')) {
                const hash = f.dataURL.replace(/^asset:\/\//, '');
                const asset = await workspace.getRepository().getAsset(hash);
                if (asset) {
                  files[fileId] = {
                    ...f,
                    dataURL: `data:${asset.mimeType};base64,${asset.base64Data}`,
                  };
                }
              }
            }

            const rehydratedScene: CanvasSceneData = {
              elements: rawCanvasData.elements || [],
              appState: rawCanvasData.appState || {},
              files,
            };

            return {
              noteId,
              scene: JSON.stringify(rehydratedScene),
              schemaVersion: rawCanvasData.schemaVersion || 1,
              savedAt: note.updatedAt,
            };
          }
        }
      } catch (err) {
        console.warn('[canvas] IndexedDB retrieval error, falling back to localStorage:', err);
      }
    }

    // 2. Fall back to primary legacy localStorage key
    const saved = window.localStorage.getItem(this.getKey(noteId));
    if (saved) {
      try {
        const doc = JSON.parse(saved);
        if (userId) {
          this.migrateLegacyDocToIndexedDB(userId, doc).catch(() => {});
        }
        return doc;
      } catch (e) {
        console.error('Failed to parse CanvasDocument (primary)', e);
      }
    }

    // 3. Fall back to emergency backup key
    const backup = window.localStorage.getItem(this.getBackupKey(noteId));
    if (backup) {
      try {
        console.warn('[canvas] Loaded from emergency backup for note', noteId);
        const doc = JSON.parse(backup);
        if (userId) {
          this.migrateLegacyDocToIndexedDB(userId, doc).catch(() => {});
        }
        return doc;
      } catch (e) {
        console.error('Failed to parse CanvasDocument (backup)', e);
      }
    }

    return null;
  }

  /**
   * Transparently migrates a legacy localStorage CanvasDocument into IndexedDB LocalWorkspace
   * only when note metadata is known, avoiding orphan "Untitled Note" / "default-notebook" writes.
   */
  private async migrateLegacyDocToIndexedDB(userId: string, doc: CanvasDocument): Promise<void> {
    try {
      const workspace = LocalWorkspace.getLocalWorkspace(userId);
      const existing = await workspace.getRepository().getNote(doc.noteId);
      if (!existing) {
        const meta = this.resolveNoteMetadata(userId, doc.noteId);
        if (!meta.title && !meta.notebookId) {
          // Wait for notesRepository migration to import the note with its real notebook & title
          return;
        }
        let sceneObj: any;
        try {
          sceneObj = JSON.parse(doc.scene);
        } catch {
          sceneObj = { elements: [], appState: {}, files: {} };
        }
        await workspace.saveCanvasScene(doc.noteId, sceneObj, meta);
      }
    } catch (e) {
      console.warn('[canvas] Legacy migration notice:', e);
    }
  }

  /**
   * Save a canvas document.
   * Directs to LocalWorkspace IndexedDB (up to 500 MB capacity, ZERO image stripping!).
   * Also maintains a safe, synchronous localStorage emergency backup without image bloat.
   */
  async save(doc: CanvasDocument): Promise<SaveResult> {
    if (typeof window === 'undefined') {
      return { ok: false, error: 'Canvas cannot be persisted during server rendering' };
    }

    const userId = this.getEffectiveUserId();

    if (userId) {
      try {
        let sceneObj: any;
        try {
          sceneObj = JSON.parse(doc.scene);
        } catch {
          sceneObj = { elements: [], appState: {}, files: {} };
        }

        const workspace = LocalWorkspace.getLocalWorkspace(userId);
        const meta = this.resolveNoteMetadata(userId, doc.noteId);
        const receipt = await workspace.saveCanvasScene(doc.noteId, sceneObj, meta);

        if (receipt.ok) {
          // Maintain a lightweight, non-bloated emergency backup in localStorage
          try {
            const strippedFiles: Record<string, unknown> = {};
            const sceneCopy = { ...sceneObj, files: strippedFiles };
            const backupDoc = { ...doc, scene: JSON.stringify(sceneCopy) };
            window.localStorage.setItem(this.getBackupKey(doc.noteId), JSON.stringify(backupDoc));
          } catch {}

          return { ok: true, trimmed: false };
        }
        return { ok: false, error: receipt.error || 'Canvas could not be committed to local storage' };
      } catch (idbErr) {
        return {
          ok: false,
          error: idbErr instanceof Error ? idbErr.message : 'IndexedDB save failed',
        };
      }
    }

    // Fallback if no user is authenticated: save to localStorage
    const fullData = JSON.stringify(doc);

    if (fullData.length <= MAX_SCENE_BYTES) {
      try {
        window.localStorage.setItem(this.getKey(doc.noteId), fullData);
        window.localStorage.setItem(this.getBackupKey(doc.noteId), fullData);
        return { ok: true, trimmed: false };
      } catch (e) {
        const error = e instanceof Error ? e.message : 'localStorage write failed';
        console.error('[canvas] save failed:', e);
        return { ok: false, error };
      }
    }

    return { ok: false, error: 'Canvas exceeds the local storage limit and was not saved' };
  }

  /**
   * Synchronous emergency backup — writes immediately to a separate localStorage key
   * and updates live in-memory editor buffer in LocalWorkspace.
   * NEVER throws.
   */
  saveImmediate(noteId: string, scene: CanvasSceneData, schemaVersion: number): void {
    if (typeof window === 'undefined') return;

    const userId = this.getEffectiveUserId();
    if (userId) {
      try {
        const workspace = LocalWorkspace.getLocalWorkspace(userId);
        workspace.updateCanvasEditorBuffer(noteId, scene);
      } catch {}
    }

    try {
      const doc: CanvasDocument = {
        noteId,
        scene: JSON.stringify(scene),
        schemaVersion,
        savedAt: new Date().toISOString(),
      };
      window.localStorage.setItem(this.getBackupKey(noteId), JSON.stringify(doc));
    } catch {}
  }

  /** Remove emergency backup after a successful primary save (cleanup). */
  clearBackup(noteId: string): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.removeItem(this.getBackupKey(noteId));
    } catch {
      // ignore
    }
  }
}

export const canvasRepository = new CanvasRepository();
