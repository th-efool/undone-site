import type { CanvasDocument } from '../models/canvas.models';

export class CanvasRepository {
  private getKey(noteId: string) {
    return `sidequesthq.canvas.${noteId}`;
  }

  async load(noteId: string): Promise<CanvasDocument | null> {
    if (typeof window === 'undefined') return null;
    const saved = window.localStorage.getItem(this.getKey(noteId));
    if (!saved) return null;
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to parse CanvasDocument', e);
      return null;
    }
  }

  async save(doc: CanvasDocument): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      const data = JSON.stringify(doc);
      if (data.length > 2 * 1024 * 1024) {
        throw new Error('StorageExceededError: Serialized scene exceeds 2MB limit.');
      }
      window.localStorage.setItem(this.getKey(doc.noteId), data);
    } catch (e) {
      console.error('Failed to save CanvasDocument', e);
      throw e;
    }
  }
}

export const canvasRepository = new CanvasRepository();
