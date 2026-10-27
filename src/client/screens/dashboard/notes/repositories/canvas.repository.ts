import type { CanvasDocument, CanvasSceneData } from '../models/canvas.models';
import { LocalWorkspace } from '@/src/client/personal-workspace/local/facade';

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
   * Transparently migrates a legacy localStorage CanvasDocument into IndexedDB LocalWorkspace.
   */
  private async migrateLegacyDocToIndexedDB(userId: string, doc: CanvasDocument): Promise<void> {
    try {
      const workspace = LocalWorkspace.getLocalWorkspace(userId);
      const existing = await workspace.getRepository().getNote(doc.noteId);
      if (!existing) {
        let sceneObj: any;
        try {
          sceneObj = JSON.parse(doc.scene);
        } catch {
          sceneObj = { elements: [], appState: {}, files: {} };
        }
        await workspace.saveCanvasScene(doc.noteId, sceneObj);
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
    if (typeof window === 'undefined') return { ok: true, trimmed: false };

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
        const receipt = await workspace.saveCanvasScene(doc.noteId, sceneObj);

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
      } catch (idbErr) {
        console.warn('[canvas] IndexedDB save error, using localStorage fallback:', idbErr);
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

    return { ok: true, trimmed: false };
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
