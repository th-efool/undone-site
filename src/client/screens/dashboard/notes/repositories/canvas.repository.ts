import type { CanvasDocument, CanvasSceneData } from '../models/canvas.models';

/** Max size for a single image file added to the canvas (checked at upload time). */
export const MAX_IMAGE_FILE_BYTES = 5 * 1024 * 1024; // 5 MB per image

/** Max size for the whole serialized scene stored in localStorage. */
const MAX_SCENE_BYTES = 10 * 1024 * 1024; // 10 MB total

export type SaveResult =
  | { ok: true; trimmed: false }
  | { ok: true; trimmed: true; droppedFileIds: string[]; reason: string }
  | { ok: false; error: string };

export class CanvasRepository {
  private getKey(noteId: string) {
    return `sidequesthq.canvas.${noteId}`;
  }

  /** Emergency backup key — written synchronously on every scene change, never throws. */
  private getBackupKey(noteId: string) {
    return `sidequesthq.canvas.backup.${noteId}`;
  }

  async load(noteId: string): Promise<CanvasDocument | null> {
    if (typeof window === 'undefined') return null;

    // Try primary key first
    const saved = window.localStorage.getItem(this.getKey(noteId));
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse CanvasDocument (primary)', e);
      }
    }

    // Fall back to emergency backup key
    const backup = window.localStorage.getItem(this.getBackupKey(noteId));
    if (backup) {
      try {
        console.warn('[canvas] Loaded from emergency backup for note', noteId);
        return JSON.parse(backup);
      } catch (e) {
        console.error('Failed to parse CanvasDocument (backup)', e);
      }
    }

    return null;
  }

  /**
   * Save a canvas document. Tries full save first. If the serialized payload
   * exceeds MAX_SCENE_BYTES it falls back to a PARTIAL save:
   *   1. All elements are always kept (drawings, shapes, text, etc.)
   *   2. Image files are sorted largest-first and stripped one-by-one until the
   *      scene fits. The caller gets back the list of dropped file IDs.
   *   3. If even stripping all files still doesn't fit, returns ok:false.
   */
  async save(doc: CanvasDocument): Promise<SaveResult> {
    if (typeof window === 'undefined') return { ok: true, trimmed: false };

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

    // Partial save: strip oversized image files until it fits
    console.warn('[canvas] Scene exceeds limit — attempting partial save');

    let scene: CanvasSceneData;
    try {
      scene = JSON.parse(doc.scene);
    } catch {
      return { ok: false, error: 'Could not parse scene for partial save' };
    }

    const files = { ...(scene.files || {}) } as Record<string, { dataURL?: string; [k: string]: unknown }>;
    const droppedFileIds: string[] = [];

    // Sort file entries largest-first so we drop the biggest offenders first
    const fileEntries = Object.entries(files).sort(
      ([, a], [, b]) => (b.dataURL?.length ?? 0) - (a.dataURL?.length ?? 0)
    );

    for (const [fileId] of fileEntries) {
      delete files[fileId];
      droppedFileIds.push(fileId);

      const trimmedScene: CanvasSceneData = { ...scene, files };
      const trimmedDoc: CanvasDocument = { ...doc, scene: JSON.stringify(trimmedScene) };
      const trimmedData = JSON.stringify(trimmedDoc);

      if (trimmedData.length <= MAX_SCENE_BYTES) {
        try {
          window.localStorage.setItem(this.getKey(doc.noteId), trimmedData);
          window.localStorage.setItem(this.getBackupKey(doc.noteId), trimmedData);
          const reason = `${droppedFileIds.length} large image(s) were too big to store and were excluded. All drawings and shapes are saved.`;
          console.warn('[canvas] Partial save succeeded. Dropped file IDs:', droppedFileIds);
          return { ok: true, trimmed: true, droppedFileIds, reason };
        } catch (e) {
          return { ok: false, error: e instanceof Error ? e.message : 'localStorage write failed' };
        }
      }
    }

    return { ok: false, error: 'Scene is too large to save even after stripping all images. Try splitting into multiple notes.' };
  }

  /**
   * Synchronous emergency backup — writes immediately to a separate localStorage key.
   * NEVER throws. Called on every scene change so data survives if the debounced
   * save hasn't fired and the user switches notes.
   */
  saveImmediate(noteId: string, scene: CanvasSceneData, schemaVersion: number): void {
    if (typeof window === 'undefined') return;
    try {
      const doc: CanvasDocument = {
        noteId,
        scene: JSON.stringify(scene),
        schemaVersion,
        savedAt: new Date().toISOString(),
      };
      const data = JSON.stringify(doc);
      if (data.length > MAX_SCENE_BYTES) {
        console.warn('[canvas] saveImmediate: scene exceeds limit but saving emergency backup anyway');
      }
      window.localStorage.setItem(this.getBackupKey(noteId), data);
    } catch (e) {
      // Last resort: strip all image files and save elements-only backup
      try {
        const files = { ...(scene.files || {}) } as Record<string, unknown>;
        const trimmedScene: CanvasSceneData = { ...scene, files: {} };
        const fallbackDoc: CanvasDocument = {
          noteId,
          scene: JSON.stringify(trimmedScene),
          schemaVersion,
          savedAt: new Date().toISOString(),
        };
        window.localStorage.setItem(this.getBackupKey(noteId), JSON.stringify(fallbackDoc));
        console.warn('[canvas] saveImmediate: saved elements-only backup (images stripped due to storage pressure). Dropped files:', Object.keys(files).length);
      } catch (e2) {
        console.error('[canvas] saveImmediate failed completely (localStorage full?)', e2);
      }
    }
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
