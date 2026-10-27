/**
 * Synthetic Test Fixtures for Local-First GitHub Sync Pre-Implementation Validation (V0)
 *
 * Implements requirement 4 from pre-plan Section 3 (V0):
 * - One notebook
 * - Small canvas with text/shapes and at least one embedded image
 * - Small kanban note
 * - Backup-only canvas (localStorage recovery pattern)
 * - Divergent server/local records
 * - Malformed record
 * - Missing/corrupt asset
 * - Notebook-child race
 */

import crypto from 'node:crypto';

export interface ValidationNotebook {
  id: string;
  title: string;
  description: string;
  color: string;
  icon?: string;
  favorite: boolean;
  shared: boolean;
  archived: boolean;
  collapsed: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface ValidationAsset {
  id: string;
  hash: string; // SHA-256 of binary bytes
  mimeType: string;
  byteLength: number;
  base64Data: string;
}

export interface ValidationCanvasNote {
  id: string;
  notebookId: string;
  title: string;
  ownerId: string | null;
  permission: 'owner' | 'editor' | 'viewer';
  tags: string[];
  favorite: boolean;
  shared: boolean;
  archived: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
  contentType: 'canvas';
  scene: {
    schemaVersion: number;
    elements: Array<{
      id: string;
      type: 'rectangle' | 'ellipse' | 'text' | 'image' | 'arrow';
      x: number;
      y: number;
      width: number;
      height: number;
      text?: string;
      fileId?: string;
    }>;
    appState: {
      viewBackgroundColor: string;
      theme: 'light' | 'dark';
    };
    assetHashes: Record<string, string>; // fileId -> sha256
  };
}

export interface ValidationKanbanNote {
  id: string;
  notebookId: string;
  title: string;
  ownerId: string | null;
  permission: 'owner' | 'editor' | 'viewer';
  tags: string[];
  favorite: boolean;
  shared: boolean;
  archived: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
  contentType: 'kanban';
  kanbanColumns: Array<{ id: string; label: string }>;
  kanbanCards: Array<{
    id: string;
    columnId: string;
    title: string;
    description?: string;
    order: number;
  }>;
}

// 1x1 transparent PNG data URI
export const SYNTHETIC_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

export function computeSha256(data: string | Buffer): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Constant-time string comparison preventing side-channel timing attacks
 * on authentication state tokens and cryptographic checksum verifications.
 */
export function secureTimingSafeEqual(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export const SYNTHETIC_ASSET_BYTES = Buffer.from(SYNTHETIC_PNG_BASE64, 'base64');
export const SYNTHETIC_ASSET_HASH = computeSha256(SYNTHETIC_ASSET_BYTES);

// Fixture 1: Standard Notebook
export const FIXTURE_NOTEBOOK: ValidationNotebook = {
  id: 'nb-synthetic-01',
  title: 'Systems Architecture',
  description: 'Local-first sync validation notebook',
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

// Fixture 2: Small Canvas with text/shapes and embedded image
export const FIXTURE_CANVAS_ASSET: ValidationAsset = {
  id: 'asset-img-01',
  hash: SYNTHETIC_ASSET_HASH,
  mimeType: 'image/png',
  byteLength: SYNTHETIC_ASSET_BYTES.byteLength,
  base64Data: SYNTHETIC_PNG_BASE64,
};

export const FIXTURE_CANVAS_NOTE: ValidationCanvasNote = {
  id: 'note-canvas-01',
  notebookId: 'nb-synthetic-01',
  title: 'Network Topology Diagram',
  ownerId: 'user-val-01',
  permission: 'owner',
  tags: ['architecture', 'sync'],
  favorite: false,
  shared: false,
  archived: false,
  order: 0,
  createdAt: '2026-10-27T08:05:00.000Z',
  updatedAt: '2026-10-27T08:05:00.000Z',
  contentType: 'canvas',
  scene: {
    schemaVersion: 1,
    elements: [
      {
        id: 'elem-rect-1',
        type: 'rectangle',
        x: 100,
        y: 100,
        width: 200,
        height: 120,
      },
      {
        id: 'elem-text-1',
        type: 'text',
        x: 120,
        y: 140,
        width: 160,
        height: 30,
        text: 'Local IndexedDB',
      },
      {
        id: 'elem-img-1',
        type: 'image',
        x: 350,
        y: 100,
        width: 64,
        height: 64,
        fileId: 'asset-img-01',
      },
    ],
    appState: {
      viewBackgroundColor: '#ffffff',
      theme: 'light',
    },
    assetHashes: {
      'asset-img-01': SYNTHETIC_ASSET_HASH,
    },
  },
};

// Fixture 3: Small Kanban Note
export const FIXTURE_KANBAN_NOTE: ValidationKanbanNote = {
  id: 'note-kanban-01',
  notebookId: 'nb-synthetic-01',
  title: 'Sync Sprint Board',
  ownerId: 'user-val-01',
  permission: 'owner',
  tags: ['tasks', 'release-1'],
  favorite: false,
  shared: false,
  archived: false,
  order: 1,
  createdAt: '2026-10-27T08:10:00.000Z',
  updatedAt: '2026-10-27T08:10:00.000Z',
  contentType: 'kanban',
  kanbanColumns: [
    { id: 'col-todo', label: 'To Do' },
    { id: 'col-doing', label: 'In Progress' },
    { id: 'col-done', label: 'Done' },
  ],
  kanbanCards: [
    {
      id: 'card-1',
      columnId: 'col-doing',
      title: 'IndexedDB durability prototype',
      description: 'Implement atomic outbox transaction',
      order: 0,
    },
    {
      id: 'card-2',
      columnId: 'col-todo',
      title: 'REST publication adapter',
      description: 'Tree creation and commit advancement',
      order: 1,
    },
  ],
};

// Fixture 4: Backup-only Canvas (simulating legacy emergency localStorage backup)
export const FIXTURE_BACKUP_ONLY_CANVAS = {
  noteId: 'note-backup-only-01',
  backupKey: 'sidequesthq.canvas.backup.note-backup-only-01',
  primaryKey: 'sidequesthq.canvas.note-backup-only-01',
  rawPayload: JSON.stringify({
    noteId: 'note-backup-only-01',
    scene: JSON.stringify({
      elements: [{ id: 'elem-b1', type: 'rectangle', x: 50, y: 50, width: 80, height: 80 }],
      appState: { viewBackgroundColor: '#ffffff' },
      files: {},
    }),
    schemaVersion: 1,
    savedAt: '2026-10-26T22:00:00.000Z',
  }),
};

// Fixture 5: Divergent Server/Local Records
export const FIXTURE_DIVERGENT_RECORDS = {
  base: {
    id: 'note-divergent-01',
    title: 'Shared Design Spec',
    version: 1,
    content: 'Initial specification text',
    updatedAt: '2026-10-27T07:00:00.000Z',
  },
  server: {
    id: 'note-divergent-01',
    title: 'Shared Design Spec (Remote Edit)',
    version: 2,
    content: 'Initial specification text\nRemote added note on auth limits.',
    updatedAt: '2026-10-27T07:15:00.000Z',
  },
  local: {
    id: 'note-divergent-01',
    title: 'Shared Design Spec (Local Edit)',
    version: 2, // locally bumped concurrently
    content: 'Initial specification text\nLocal added diagram instructions.',
    updatedAt: '2026-10-27T07:20:00.000Z',
  },
};

// Fixture 6: Malformed Record (corrupt JSON / missing mandatory fields)
export const FIXTURE_MALFORMED_RECORD = {
  corruptJson: '{"id": "note-broken", "title": "Truncated note...',
  missingFields: {
    id: 'note-invalid-schema',
    // missing title, notebookId, contentType
    createdAt: 'invalid-date-stamp',
  },
};

// Fixture 7: Missing / Corrupt Asset
export const FIXTURE_CORRUPT_ASSET = {
  declaredHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', // sha256 of empty string
  corruptBytes: Buffer.from('non-matching-binary-payload-data'),
  actualHash: computeSha256(Buffer.from('non-matching-binary-payload-data')),
};

// Fixture 8: Notebook-child Race
// A note referencing a parent notebook that was concurrently removed or archived
export const FIXTURE_NOTEBOOK_CHILD_RACE = {
  notebook: {
    id: 'nb-race-target',
    title: 'Pending Notebook',
    archived: true, // Server marked archived or deleted
    updatedAt: '2026-10-27T07:30:00.000Z',
  },
  childNote: {
    id: 'note-child-race-01',
    notebookId: 'nb-race-target',
    title: 'Child note added during deletion race',
    updatedAt: '2026-10-27T07:31:00.000Z',
  },
};
