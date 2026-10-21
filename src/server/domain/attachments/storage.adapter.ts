import 'server-only';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';

// Private storage directory
const STORAGE_ROOT = join(process.cwd(), '.tmp', 'chat-attachments');
const inMemoryStore = new Map<string, Buffer>();

export const chatStorageAdapter = {
  async saveObject(storageKey: string, buffer: Buffer): Promise<void> {
    inMemoryStore.set(storageKey, buffer);
    try {
      await fs.mkdir(STORAGE_ROOT, { recursive: true });
      await fs.writeFile(join(STORAGE_ROOT, storageKey), buffer);
    } catch {
      // In-memory fallback if filesystem restricted
    }
  },

  async getObject(storageKey: string): Promise<Buffer | null> {
    if (inMemoryStore.has(storageKey)) {
      return inMemoryStore.get(storageKey)!;
    }

    try {
      const buf = await fs.readFile(join(STORAGE_ROOT, storageKey));
      inMemoryStore.set(storageKey, buf);
      return buf;
    } catch {
      return null;
    }
  },

  async deleteObject(storageKey: string): Promise<void> {
    inMemoryStore.delete(storageKey);
    try {
      await fs.unlink(join(STORAGE_ROOT, storageKey));
    } catch {
      // Ignore if not on disk
    }
  },

  clearMemoryForTest(): void {
    inMemoryStore.clear();
  },
};
