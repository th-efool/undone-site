/**
 * Shared Authoritative Contracts for Personal Workspace Persistence
 *
 * Implements frozen contracts from:
 * - Evidence Artifact E4: `plans/local-first-github-sync-validation/contracts.md`
 * - Authoritative JSON Schemas: `plans/local-first-github-sync-validation/schemas/`
 *   (notebook.json, note.json, asset.json, manifest.json, bundle.json)
 * - Domain compatibility with: `src/client/screens/dashboard/notes/models/notes.models.ts`
 */

import { z } from 'zod';

// ============================================================================
// 1. Workspace Identity & Scope
// ============================================================================

export interface WorkspaceScope {
  userId: string;
  workspaceId?: string;
  bindingEpoch?: number;
}

export const workspaceScopeSchema = z.object({
  userId: z.string().min(1, 'userId is required'),
  workspaceId: z.string().min(1).optional(),
  bindingEpoch: z.number().int().nonnegative().optional(),
});

/**
 * Returns the scoped IndexedDB database name according to E4 account isolation rules.
 * Throws an error if userId is missing or empty.
 */
export function getWorkspaceDatabaseName(scope: WorkspaceScope): string {
  if (!scope.userId || typeof scope.userId !== 'string' || scope.userId.trim() === '') {
    throw new Error('WorkspaceScope userId must be a non-empty string');
  }
  return `workspace_${scope.userId.trim()}`;
}

// ============================================================================
// 2. Notebook Records
// ============================================================================

export interface NotebookRecord {
  id: string;
  title: string;
  description?: string;
  color: string;
  icon?: string;
  favorite: boolean;
  shared?: boolean;
  archived: boolean;
  collapsed?: boolean;
  order: number;
  createdAt?: string;
  updatedAt?: string;
}

export const notebookRecordSchema = z.object({
  id: z.string().min(1, 'Notebook id is required'),
  title: z.string().min(1, 'Notebook title must be at least 1 character').max(200, 'Notebook title cannot exceed 200 characters'),
  description: z.string().max(1000, 'Notebook description cannot exceed 1000 characters').optional(),
  color: z.string().min(1, 'Notebook color is required'),
  icon: z.string().optional(),
  favorite: z.boolean(),
  shared: z.boolean().optional(),
  archived: z.boolean(),
  collapsed: z.boolean().optional(),
  order: z.number().int().min(0, 'Notebook order must be a non-negative integer'),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

// ============================================================================
// 3. Note Content Payloads & Records (Discriminated Union)
// ============================================================================

export type NoteContentType = 'canvas' | 'kanban' | 'markdown';
export type NotePermission = 'viewer' | 'editor' | 'owner';

export interface CanvasNoteData {
  elements: Array<Record<string, unknown>>;
  appState: Record<string, unknown>;
  assetFileIds?: string[];
  schemaVersion?: number;
  assetHashes?: Record<string, string>;
}

export const canvasNoteDataSchema = z.object({
  elements: z.array(z.record(z.string(), z.unknown())),
  appState: z.record(z.string(), z.unknown()),
  assetFileIds: z.array(z.string()).optional(),
  schemaVersion: z.number().int().optional(),
  assetHashes: z.record(z.string(), z.string()).optional(),
});

export interface KanbanColumn {
  id: string;
  title: string;
  order: number;
}

export const kanbanColumnSchema = z.object({
  id: z.string().min(1, 'Column id is required'),
  title: z.string(),
  order: z.number().int(),
});

export interface KanbanCard {
  id: string;
  columnId: string;
  title: string;
  description?: string;
  order: number;
}

export const kanbanCardSchema = z.object({
  id: z.string().min(1, 'Card id is required'),
  columnId: z.string().min(1, 'Card columnId is required'),
  title: z.string(),
  description: z.string().optional(),
  order: z.number().int(),
});

export interface KanbanNoteData {
  columns: KanbanColumn[];
  cards: KanbanCard[];
}

export const kanbanNoteDataSchema = z.object({
  columns: z.array(kanbanColumnSchema),
  cards: z.array(kanbanCardSchema),
});

export interface MarkdownNoteData {
  markdown: string;
}

export const markdownNoteDataSchema = z.object({
  markdown: z.string(),
});

export interface BaseNoteRecord {
  id: string;
  notebookId: string;
  title: string;
  order: number;
  createdAt: string;
  updatedAt: string;
  ownerId?: string | null;
  permission?: NotePermission;
  tags?: string[];
  favorite?: boolean;
  shared?: boolean;
  archived?: boolean;
}

const baseNoteRecordSchemaFields = {
  id: z.string().min(1, 'Note id is required'),
  notebookId: z.string().min(1, 'notebookId is required'),
  title: z.string().min(1, 'Note title must be at least 1 character').max(200, 'Note title cannot exceed 200 characters'),
  order: z.number().int().min(0, 'Note order must be a non-negative integer'),
  createdAt: z.string(),
  updatedAt: z.string(),
  ownerId: z.string().nullable().optional(),
  permission: z.enum(['viewer', 'editor', 'owner']).optional(),
  tags: z.array(z.string()).optional(),
  favorite: z.boolean().optional(),
  shared: z.boolean().optional(),
  archived: z.boolean().optional(),
};

export interface CanvasNoteRecord extends BaseNoteRecord {
  contentType: 'canvas';
  canvasData: CanvasNoteData;
}

export const canvasNoteRecordSchema = z.object({
  ...baseNoteRecordSchemaFields,
  contentType: z.literal('canvas'),
  canvasData: canvasNoteDataSchema,
});

export interface KanbanNoteRecord extends BaseNoteRecord {
  contentType: 'kanban';
  kanbanData: KanbanNoteData;
}

export const kanbanNoteRecordSchema = z.object({
  ...baseNoteRecordSchemaFields,
  contentType: z.literal('kanban'),
  kanbanData: kanbanNoteDataSchema,
});

export interface MarkdownNoteRecord extends BaseNoteRecord {
  contentType: 'markdown';
  markdownData: MarkdownNoteData;
}

export const markdownNoteRecordSchema = z.object({
  ...baseNoteRecordSchemaFields,
  contentType: z.literal('markdown'),
  markdownData: markdownNoteDataSchema,
});

export type NoteRecord = CanvasNoteRecord | KanbanNoteRecord | MarkdownNoteRecord;

export const noteRecordSchema = z.discriminatedUnion('contentType', [
  canvasNoteRecordSchema,
  kanbanNoteRecordSchema,
  markdownNoteRecordSchema,
]);

// ============================================================================
// 4. Asset Records & Constraints
// ============================================================================

export type AssetMimeType =
  | 'image/png'
  | 'image/jpeg'
  | 'image/svg+xml'
  | 'image/webp'
  | 'image/gif'
  | 'application/octet-stream'
  | (string & {});

export interface AssetRecord {
  id: string;
  hash: string; // Cryptographic SHA-256 of decoded raw binary payload
  mimeType: AssetMimeType;
  byteLength: number;
  base64Data: string;
}

export const assetRecordSchema = z.object({
  id: z.string().min(1, 'Asset id is required'),
  hash: z.string().regex(/^[0-9a-f]{64}$/, 'hash must be a 64-character lowercase hexadecimal SHA-256 string'),
  mimeType: z.string().min(1, 'mimeType is required'),
  byteLength: z.number().int().min(1, 'byteLength must be at least 1 byte').max(5 * 1024 * 1024, 'byteLength cannot exceed 5 MiB ceiling'),
  base64Data: z.string().min(1, 'base64Data is required'),
});

// ============================================================================
// 5. Outbox Mutations & Atomic Generations
// ============================================================================

export type OutboxMutationType = 'create' | 'update' | 'delete';
export type OutboxEntityType = 'notebook' | 'note' | 'asset';
export type OutboxMutationStatus = 'pending' | 'in_flight' | 'acknowledged' | 'failed';

export interface OutboxMutation {
  id: string;
  clientTimestamp: string;
  mutationType: OutboxMutationType;
  entityType: OutboxEntityType;
  entityId: string;
  payload: unknown;
  baseVersion?: number | string | null;
  status: OutboxMutationStatus;
  retryCount: number;
  generation: number;
  error?: string;
}

export const outboxMutationSchema = z.object({
  id: z.string().min(1, 'Outbox mutation id is required'),
  clientTimestamp: z.string().min(1, 'clientTimestamp is required'),
  mutationType: z.enum(['create', 'update', 'delete']),
  entityType: z.enum(['notebook', 'note', 'asset']),
  entityId: z.string().min(1, 'entityId is required'),
  payload: z.unknown(),
  baseVersion: z.union([z.number(), z.string()]).nullable().optional(),
  status: z.enum(['pending', 'in_flight', 'acknowledged', 'failed']),
  retryCount: z.number().int().min(0),
  generation: z.number().int().min(0),
  error: z.string().optional(),
});

// Alias for backwards compatibility with validation harness
export type OutboxEntry = OutboxMutation;

// ============================================================================
// 6. Remote Git Repository Layout & Manifest
// ============================================================================

export interface ManifestNotebookEntry {
  id: string;
  path: string; // e.g. "undone/notebooks/nb-synthetic-01.json"
  hash: string; // SHA-256 of canonical JSON payload
}

export const manifestNotebookEntrySchema = z.object({
  id: z.string().min(1),
  path: z.string().min(1),
  hash: z.string().regex(/^[0-9a-f]{64}$/),
});

export interface ManifestNoteEntry {
  id: string;
  path: string; // e.g. "undone/notes/note-canvas-01.json"
  hash: string; // SHA-256 of canonical JSON payload
  contentType: NoteContentType;
}

export const manifestNoteEntrySchema = z.object({
  id: z.string().min(1),
  path: z.string().min(1),
  hash: z.string().regex(/^[0-9a-f]{64}$/),
  contentType: z.enum(['canvas', 'kanban', 'markdown']),
});

export interface ManifestCanvasEntry {
  noteId: string;
  path: string;
  hash: string;
}

export const manifestCanvasEntrySchema = z.object({
  noteId: z.string().min(1),
  path: z.string().min(1),
  hash: z.string().regex(/^[0-9a-f]{64}$/),
});

export interface ManifestAssetEntry {
  id: string;
  path: string; // e.g. "undone/assets/<sha256>.png"
  sha256: string; // SHA-256 of raw decoded binary bytes
  gitSha: string; // Git object SHA-1 ("blob <len>\0<bytes>")
  mimeType?: string;
}

export const manifestAssetEntrySchema = z.object({
  id: z.string().min(1),
  path: z.string().min(1),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  gitSha: z.string().regex(/^[0-9a-f]{40}$/),
  mimeType: z.string().optional(),
});

export interface WorkspaceManifest {
  manifestVersion: 1;
  workspaceId: string;
  notebooks: ManifestNotebookEntry[];
  notes: ManifestNoteEntry[];
  canvases?: ManifestCanvasEntry[];
  assets: ManifestAssetEntry[];
}

export const workspaceManifestSchema = z.object({
  manifestVersion: z.literal(1),
  workspaceId: z.string().min(1),
  notebooks: z.array(manifestNotebookEntrySchema),
  notes: z.array(manifestNoteEntrySchema),
  canvases: z.array(manifestCanvasEntrySchema).optional(),
  assets: z.array(manifestAssetEntrySchema),
});

// ============================================================================
// 7. Receipts, Summaries & Local State Bundles
// ============================================================================

export interface LocalReceipt {
  ok: boolean;
  committedAt: string | null;
  outboxEntryId: string | null;
  error?: string;
}

export const localReceiptSchema = z.object({
  ok: z.boolean(),
  committedAt: z.string().nullable(),
  outboxEntryId: z.string().nullable(),
  error: z.string().optional(),
});

export type LocalSaveResult = LocalReceipt;

export type SyncStatus =
  | 'idle'
  | 'saving_locally'
  | 'saved_locally'
  | 'queued'
  | 'syncing'
  | 'synced'
  | 'offline'
  | 'conflict'
  | 'reconnect_required'
  | 'reconnecting'
  | 'error';

export interface SyncSummary {
  status: SyncStatus;
  pendingMutations: number;
  lastSyncedAt: string | null;
  conflictCount: number;
  errorMessage?: string;
}

export const syncSummarySchema = z.object({
  status: z.enum([
    'idle',
    'saving_locally',
    'saved_locally',
    'queued',
    'syncing',
    'synced',
    'offline',
    'conflict',
    'reconnect_required',
    'reconnecting',
    'error',
  ]),
  pendingMutations: z.number().int().min(0),
  lastSyncedAt: z.string().nullable(),
  conflictCount: z.number().int().min(0),
  errorMessage: z.string().optional(),
});

export interface UnsavedEditorBuffer {
  noteId: string;
  contentType: NoteContentType;
  bufferPayload: unknown;
  lastKeystrokeAt: string;
  isDirty: boolean;
  schemaVersion: number;
  recoveredFromBuffer?: boolean;
}

export const unsavedEditorBufferSchema = z.object({
  noteId: z.string().min(1, 'noteId is required'),
  contentType: z.enum(['canvas', 'kanban', 'markdown']),
  bufferPayload: z.unknown(),
  lastKeystrokeAt: z.string().min(1, 'lastKeystrokeAt is required'),
  isDirty: z.boolean(),
  schemaVersion: z.number().int(),
  recoveredFromBuffer: z.boolean().optional(),
});

export interface CommittedWorkspaceState {
  notebooks: NotebookRecord[];
  notes: NoteRecord[];
  assets: AssetRecord[];
  outbox: OutboxMutation[];
  conflicts?: unknown[];
  metadata?: unknown[];
}

export const committedWorkspaceStateSchema = z.object({
  notebooks: z.array(notebookRecordSchema),
  notes: z.array(noteRecordSchema),
  assets: z.array(assetRecordSchema),
  outbox: z.array(outboxMutationSchema),
  conflicts: z.array(z.unknown()).optional(),
  metadata: z.array(z.unknown()).optional(),
});

export interface LocalStateExportBundle {
  formatVersion: '1.0.0';
  exportedAt: string;
  sourceUserId: string;
  storageName: string;
  committedState: CommittedWorkspaceState;
  unsavedBuffers?: UnsavedEditorBuffer[];
  checksum: string; // SHA-256 of canonical bundle payload without checksum field
}

export const localStateExportBundleSchema = z.object({
  formatVersion: z.literal('1.0.0'),
  exportedAt: z.string().min(1, 'exportedAt is required'),
  sourceUserId: z.string().min(1, 'sourceUserId is required'),
  storageName: z.string().min(1, 'storageName is required'),
  committedState: committedWorkspaceStateSchema,
  unsavedBuffers: z.array(unsavedEditorBufferSchema).optional(),
  checksum: z.string().regex(/^[0-9a-f]{64}$/, 'checksum must be a 64-character lowercase hexadecimal SHA-256 string'),
});

