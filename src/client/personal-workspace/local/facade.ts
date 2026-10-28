/**
 * Production LocalWorkspace Facade
 *
 * Implements Section 4.2 of `plans/undone-local-first-github-sync.md`:
 * - High-level local-first workspace interface
 * - Single entry point for notebooks, canvas notes, binary image assets, and outbox mutations
 * - Guarantees atomic local commits before emitting "Saved on this device"
 * - Maintains crash-safe live editor buffers for uncommitted keystrokes/drawings
 * - Manages subscriptions and synchronizes domain NotesStateEntity for dashboard UI
 */

import type {
  WorkspaceScope,
  NotebookRecord,
  NoteRecord,
  CanvasNoteRecord,
  KanbanNoteRecord,
  CanvasNoteData,
  AssetRecord,
  ScheduleTaskRecord,
  OutboxMutation,
  LocalReceipt,
  SyncSummary,
  SyncStatus,
  LocalStateExportBundle,
} from '@/src/shared/personal-workspace/contracts';
import {
  workspaceScopeSchema,
  scheduleTaskRecordSchema,
} from '@/src/shared/personal-workspace/contracts';
import {
  computeSha256,
  normalizeNotebookRecord,
  normalizeNoteRecord,
  validateAssetRecord,
  validateNotebookRecord,
  validateNoteRecord,
} from '@/src/shared/personal-workspace/serialization';
import type {
  NotesStateEntity,
  NotebookEntity,
  NoteDocument,
  NotesSort,
  NotesFilter,
  Permission,
} from '@/src/client/screens/dashboard/notes/models/notes.models';
import {
  PersonalWorkspaceRepository,
  sanitizeCanvasAppStateForStorage,
  type PersonalWorkspaceRepoOptions,
  type MutationType,
  type EntityType,
  type ImportBundleResult,
} from './repository';

// ============================================================================
// Workspace Snapshot & Command Contracts
// ============================================================================

export interface WorkspaceSnapshot {
  scope: WorkspaceScope;
  notebooks: NotebookRecord[];
  notes: NoteRecord[];
  assets: AssetRecord[];
  pendingOutbox: OutboxMutation[];
  generation: number;
  notesState: NotesStateEntity;
}

export type WorkspaceCommand =
  | {
      type: 'save_notebook';
      notebook: NotebookRecord;
      mutationType?: 'create' | 'update';
    }
  | {
      type: 'save_canvas_note';
      note: CanvasNoteRecord;
      assets?: AssetRecord[];
      mutationType?: 'create' | 'update';
    }
  | {
      type: 'save_kanban_note';
      note: KanbanNoteRecord;
      mutationType?: 'create' | 'update';
    }
  | {
      type: 'save_note';
      note: NoteRecord;
      assets?: AssetRecord[];
      mutationType?: 'create' | 'update';
    }
  | {
      type: 'save_canvas_scene';
      noteId: string;
      scene: {
        elements: unknown[];
        appState: unknown;
        files?: Record<string, unknown>;
      };
      title?: string;
      notebookId?: string;
    }
  | {
      type: 'delete_entity';
      entityType: 'notebook' | 'note' | 'asset' | 'schedule';
      entityId: string;
    }
  | {
      type: 'save_asset';
      asset: AssetRecord;
    }
  | {
      type: 'save_schedule_task';
      task: ScheduleTaskRecord;
      mutationType?: 'create' | 'update';
    }
  | {
      type: 'delete_schedule_task';
      taskId: string;
    };

export interface LocalWorkspaceOptions extends PersonalWorkspaceRepoOptions {
  initialSort?: NotesSort;
  initialFilter?: NotesFilter;
}

// ============================================================================
// Asset Extraction Utility
// ============================================================================

/**
 * Extracts and cryptographically validates AssetRecords from Excalidraw-compatible
 * scene files (data URLs, raw base64, or existing asset records).
 */
export function extractAssetsFromSceneFiles(files?: Record<string, unknown>): AssetRecord[] {
  if (!files || typeof files !== 'object') return [];
  const assets: AssetRecord[] = [];

  for (const [key, file] of Object.entries(files)) {
    if (!file || typeof file !== 'object') continue;
    const fileObj = file as Record<string, unknown>;

    const fileId = (typeof fileObj.id === 'string' ? fileObj.id : undefined) || key;
    let base64Data = '';
    let mimeType = (typeof fileObj.mimeType === 'string' ? fileObj.mimeType : undefined) || 'image/png';

    if (typeof fileObj.base64Data === 'string') {
      base64Data = fileObj.base64Data;
    } else if (typeof fileObj.dataURL === 'string') {
      const match = fileObj.dataURL.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        mimeType = match[1];
        base64Data = match[2];
      } else {
        base64Data = fileObj.dataURL;
      }
    }

    if (!base64Data) continue;

    let byteLength = typeof fileObj.byteLength === 'number' ? fileObj.byteLength : 0;
    let decodedBytes: Buffer | Uint8Array;

    if (typeof Buffer !== 'undefined') {
      decodedBytes = Buffer.from(base64Data, 'base64');
      byteLength = decodedBytes.byteLength;
    } else {
      const binStr = atob(base64Data);
      byteLength = binStr.length;
      decodedBytes = new Uint8Array(byteLength);
      for (let i = 0; i < byteLength; i++) {
        decodedBytes[i] = binStr.charCodeAt(i);
      }
    }

    const computedHash = computeSha256(decodedBytes);

    const assetRecord: AssetRecord = {
      id: fileId,
      hash: typeof fileObj.hash === 'string' && fileObj.hash.length === 64 ? fileObj.hash : computedHash,
      mimeType,
      byteLength,
      base64Data,
    };

    // If caller provided a hash that diverged, prefer computed cryptographic hash
    if (fileObj.hash && fileObj.hash !== computedHash) {
      console.warn(
        `[LocalWorkspace] Provided asset hash ${fileObj.hash} did not match computed ${computedHash}. Using computed SHA-256.`
      );
      assetRecord.hash = computedHash;
    }

    validateAssetRecord(assetRecord, { isChunked: true });
    assets.push(assetRecord);
  }

  return assets;
}

// ============================================================================
// Production LocalWorkspace Facade
// ============================================================================

export class LocalWorkspace {
  readonly userId: string;
  private repo: PersonalWorkspaceRepository;
  private scope: WorkspaceScope | null = null;
  private listeners = new Set<() => void>();
  private isSaving = false;
  private lastError: Error | null = null;
  private lastSyncedAt: string | null = null;
  private activeNotebookId: string | null = null;
  private activeNoteId: string | null = null;
  private notebookSort: NotesSort = 'manual';
  private noteSort: NotesSort = 'manual';
  private filter: NotesFilter = 'all';
  private generation = 0;
  private isOpen = false;
  private cachedNotesState: NotesStateEntity;
  private unsubscribeSaveSuccess: (() => void) | null = null;
  private unsubscribeSaveError: (() => void) | null = null;
  private unsubscribeRemoteSnapshot: (() => void) | null = null;

  private static instances = new Map<string, LocalWorkspace>();

  constructor(userId: string, options: LocalWorkspaceOptions = {}) {
    if (!userId || userId.trim() === '') {
      throw new Error('User ID is required for account-scoped LocalWorkspace');
    }
    this.userId = userId.trim();
    this.repo = new PersonalWorkspaceRepository(this.userId, options);
    if (options.initialSort) {
      this.notebookSort = options.initialSort;
      this.noteSort = options.initialSort;
    }
    if (options.initialFilter) {
      this.filter = options.initialFilter;
    }

    this.cachedNotesState = {
      notebooks: [],
      notes: [],
      selectedNotebookId: null,
      selectedNoteId: null,
      notebookSort: this.notebookSort,
      noteSort: this.noteSort,
      filter: this.filter,
    };
  }

  /**
   * Singleton / instance factory per user ID
   */
  public static getLocalWorkspace(userId: string, options?: LocalWorkspaceOptions): LocalWorkspace {
    if (!userId || userId.trim() === '') {
      throw new Error('User ID is required for getLocalWorkspace');
    }
    const cleanId = userId.trim();
    let instance = LocalWorkspace.instances.get(cleanId);
    if (!instance) {
      instance = new LocalWorkspace(cleanId, options);
      LocalWorkspace.instances.set(cleanId, instance);
    }
    return instance;
  }

  /**
   * Resets all cached workspace instances (used for isolation testing)
   */
  public static resetAllInstances(): void {
    LocalWorkspace.instances.clear();
  }

  getRepository(): PersonalWorkspaceRepository {
    return this.repo;
  }

  getGeneration(): number {
    return this.generation;
  }

  /**
   * Opens the local workspace under the given scope.
   * Loads notebooks, notes, assets, and pending outbox mutations from IndexedDB.
   */
  async open(scope: WorkspaceScope): Promise<WorkspaceSnapshot> {
    const parsedScope = workspaceScopeSchema.parse(scope);
    if (parsedScope.userId !== this.userId) {
      throw new Error(
        `Scope userId "${parsedScope.userId}" does not match workspace userId "${this.userId}"`
      );
    }
    this.scope = parsedScope;
    await this.repo.initialize();

    // Hook repository save events to notify subscribers
    if (!this.unsubscribeSaveSuccess) {
      this.unsubscribeSaveSuccess = this.repo.onSaveSuccess(() => this.refreshAndNotify());
    }
    if (!this.unsubscribeRemoteSnapshot) {
      this.unsubscribeRemoteSnapshot = this.repo.onRemoteSnapshotApplied(() => this.refreshAndNotify());
    }
    if (!this.unsubscribeSaveError) {
      this.unsubscribeSaveError = this.repo.onSaveError((errEvent) => {
        this.lastError = errEvent.error;
        this.notifySubscribers();
      });
    }

    // Subscribe to cross-tab broadcast notifications
    const channel = this.repo.getLockCoordinator().getChannel();
    if (channel) {
      channel.onmessage = (event) => {
        if (event.data?.type === 'WORKSPACE_MUTATED') {
          this.refreshAndNotify();
        }
      };
    }

    await this.refreshStateFromRepo();

    const [notebooks, notes, assets, pendingOutbox] = await Promise.all([
      this.repo.getAllNotebooks<NotebookRecord>(),
      this.repo.getAllNotes<NoteRecord>(),
      this.repo.getAllAssets<AssetRecord>(),
      this.repo.getPendingOutbox() as Promise<OutboxMutation[]>,
    ]);

    this.isOpen = true;
    this.notifySubscribers();

    return {
      scope: this.scope,
      notebooks,
      notes,
      assets,
      pendingOutbox,
      generation: this.generation,
      notesState: this.getNotesState(),
    };
  }

  /**
   * Subscribes to local workspace state changes.
   * Returns an unsubscribe function.
   */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifySubscribers(): void {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch (err) {
        console.error('[LocalWorkspace] subscriber listener threw:', err);
      }
    }
  }

  private refreshAndNotify(): void {
    void this.refreshStateFromRepo()
      .then(() => this.notifySubscribers())
      .catch((err: unknown) => {
        this.lastError = err instanceof Error ? err : new Error(String(err));
        this.notifySubscribers();
      });
  }

  /**
   * Returns the current domain-compatible NotesStateEntity.
   * Synchronous and always available for React renders.
   */
  getNotesState(): NotesStateEntity {
    return structuredClone(this.cachedNotesState);
  }

  /**
   * Applies a command to the workspace with optional generation checking.
   */
  async apply(command: WorkspaceCommand, expectedGeneration?: number): Promise<LocalReceipt> {
    if (expectedGeneration !== undefined && expectedGeneration !== this.generation) {
      return {
        ok: false,
        committedAt: null,
        outboxEntryId: null,
        error: `Generation mismatch: expected ${expectedGeneration}, current is ${this.generation}`,
      };
    }

    switch (command.type) {
      case 'save_notebook':
        return this.saveNotebook(command.notebook);

      case 'save_canvas_scene':
        return this.saveCanvasScene(command.noteId, command.scene, {
          title: command.title,
          notebookId: command.notebookId,
        });

      case 'save_canvas_note': {
        const normalizedNote = normalizeNoteRecord(command.note) as CanvasNoteRecord;
        const existing = await this.repo.getNote(normalizedNote.id);
        const mutType = command.mutationType || (existing ? 'update' : 'create');
        this.isSaving = true;
        this.notifySubscribers();
        try {
          const res = await this.repo.saveCanvasNoteAtomic(normalizedNote, command.assets || [], mutType);
          if (res.ok) {
            this.generation++;
            await this.refreshStateFromRepo();
            this.lastError = null;
          } else {
            this.lastError = new Error(res.error || 'Failed to save canvas note');
          }
          return res;
        } finally {
          this.isSaving = false;
          this.notifySubscribers();
        }
      }

      case 'save_kanban_note': {
        const normalizedNote = normalizeNoteRecord(command.note);
        const existing = await this.repo.getNote(normalizedNote.id);
        const mutType = command.mutationType || (existing ? 'update' : 'create');
        this.isSaving = true;
        this.notifySubscribers();
        try {
          const res = await this.repo.saveKanbanNoteAtomic(normalizedNote, mutType);
          if (res.ok) {
            this.generation++;
            await this.refreshStateFromRepo();
            this.lastError = null;
          } else {
            this.lastError = new Error(res.error || 'Failed to save kanban note');
          }
          return res;
        } finally {
          this.isSaving = false;
          this.notifySubscribers();
        }
      }

      case 'save_note': {
        if (command.note.contentType === 'canvas') {
          return this.apply({
            type: 'save_canvas_note',
            note: command.note,
            assets: command.assets,
            mutationType: command.mutationType,
          });
        }
        if (command.note.contentType === 'kanban') {
          return this.apply({
            type: 'save_kanban_note',
            note: command.note,
            mutationType: command.mutationType,
          });
        }
        // Markdown or other notes
        const normalizedNote = normalizeNoteRecord(command.note);
        const existing = await this.repo.getNote(normalizedNote.id);
        const mutType = command.mutationType || (existing ? 'update' : 'create');
        this.isSaving = true;
        this.notifySubscribers();
        try {
          const res = await this.repo.saveKanbanNoteAtomic(normalizedNote, mutType);
          if (res.ok) {
            this.generation++;
            await this.refreshStateFromRepo();
            this.lastError = null;
          } else {
            this.lastError = new Error(res.error || 'Failed to save note');
          }
          return res;
        } finally {
          this.isSaving = false;
          this.notifySubscribers();
        }
      }

      case 'delete_entity':
        return this.deleteEntity(command.entityType, command.entityId);

      case 'save_schedule_task':
        return this.saveScheduleTask(command.task);

      case 'delete_schedule_task':
        return this.deleteScheduleTask(command.taskId);

      case 'save_asset': {
        validateAssetRecord(command.asset);
        await this.repo.saveAsset(command.asset);
        return {
          ok: true,
          committedAt: new Date().toISOString(),
          outboxEntryId: null,
        };
      }

      default: {
        const exhaustiveCheck: never = command;
        throw new Error(`Unhandled workspace command: ${JSON.stringify(exhaustiveCheck)}`);
      }
    }
  }

  /**
   * Atomically saves or updates a notebook record and writes to outbox.
   */
  async saveNotebook(notebook: NotebookRecord): Promise<LocalReceipt> {
    const validated = normalizeNotebookRecord(notebook);
    const existing = await this.repo.getNotebook(validated.id);
    const mutationType: MutationType = existing ? 'update' : 'create';

    this.isSaving = true;
    this.notifySubscribers();
    try {
      const receipt = await this.repo.saveNotebookAtomic(validated, mutationType);
      if (receipt.ok) {
        this.generation++;
        await this.refreshStateFromRepo();
        this.lastError = null;
      } else {
        this.lastError = new Error(receipt.error || 'Failed to save notebook');
      }
      return receipt;
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.lastError = err instanceof Error ? err : new Error(errorMsg);
      return { ok: false, committedAt: null, outboxEntryId: null, error: errorMsg };
    } finally {
      this.isSaving = false;
      this.notifySubscribers();
    }
  }

  /**
   * Atomically saves an Excalidraw canvas scene, all extracted binary assets,
   * and corresponding outbox mutation records in one transaction.
   */
  async saveCanvasScene(
    noteId: string,
    scene: {
      elements: unknown[];
      appState: unknown;
      files?: Record<string, unknown>;
    },
    meta?: { title?: string; notebookId?: string }
  ): Promise<LocalReceipt> {
    if (!noteId || noteId.trim() === '') {
      throw new Error('noteId is required to save canvas scene');
    }

    const rawElements = Array.isArray(scene.elements)
      ? (scene.elements as Array<Record<string, unknown>>)
      : [];
    const deletedFileIds = new Set<string>();
    const activeFileIds = new Set<string>();
    for (const el of rawElements) {
      if (el && typeof el === 'object' && typeof el.fileId === 'string' && el.fileId) {
        if (el.isDeleted === true) {
          deletedFileIds.add(el.fileId);
        } else {
          activeFileIds.add(el.fileId);
        }
      }
    }

    const filteredFiles =
      scene.files && typeof scene.files === 'object'
        ? Object.fromEntries(
            Object.entries(scene.files).filter(
              ([fileId]) => !deletedFileIds.has(fileId) || activeFileIds.has(fileId)
            )
          )
        : scene.files;

    const assets = extractAssetsFromSceneFiles(filteredFiles);
    const assetHashes: Record<string, string> = {};
    const assetFileIds: string[] = [];

    for (const asset of assets) {
      assetHashes[asset.id] = asset.hash;
      assetFileIds.push(asset.id);
    }

    const existingNote = await this.repo.getNote<NoteRecord>(noteId);
    const mutationType: MutationType = existingNote ? 'update' : 'create';
    const now = new Date().toISOString();

    const canvasData: CanvasNoteData = {
      elements: rawElements,
      appState: sanitizeCanvasAppStateForStorage(scene.appState),
      assetFileIds,
      assetHashes,
      schemaVersion: 1,
    };

    const targetNotebookId =
      meta?.notebookId ||
      existingNote?.notebookId ||
      this.activeNotebookId ||
      this.cachedNotesState.notebooks[0]?.id ||
      'default-notebook';

    const noteRecord = normalizeNoteRecord({
      id: noteId,
      notebookId: targetNotebookId,
      title: meta?.title || existingNote?.title || 'Untitled Note',
      order: existingNote?.order ?? 0,
      createdAt: existingNote?.createdAt || now,
      updatedAt: now,
      ownerId: existingNote?.ownerId ?? null,
      permission: existingNote?.permission || 'owner',
      tags: existingNote?.tags || [],
      favorite: existingNote?.favorite ?? false,
      shared: existingNote?.shared ?? false,
      archived: existingNote?.archived ?? false,
      contentType: 'canvas',
      canvasData,
    }) as CanvasNoteRecord;

    this.isSaving = true;
    this.notifySubscribers();
    try {
      const receipt = await this.repo.saveCanvasNoteAtomic(noteRecord, assets, mutationType);
      if (receipt.ok) {
        this.generation++;
        await this.refreshStateFromRepo();
        this.lastError = null;
      } else {
        this.lastError = new Error(receipt.error || 'Failed to save canvas note');
      }
      return receipt;
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.lastError = err instanceof Error ? err : new Error(errorMsg);
      return { ok: false, committedAt: null, outboxEntryId: null, error: errorMsg };
    } finally {
      this.isSaving = false;
      this.notifySubscribers();
    }
  }

  /**
   * Updates the live in-memory editor buffer for typing/drawing without disk latency.
   * Discarded automatically once a committed save transaction succeeds.
   */
  updateCanvasEditorBuffer(noteId: string, scene: unknown): void {
    this.repo.updateEditorBuffer(noteId, scene, 'canvas', 1);
    this.notifySubscribers();
  }

  /**
   * Atomically deletes an entity and queues outbox deletion.
   * If deleting a notebook, also cascades deletion to its child notes.
   */
  async deleteEntity(
    entityType: 'notebook' | 'note' | 'asset' | 'schedule',
    entityId: string,
  ): Promise<LocalReceipt> {
    this.isSaving = true;
    this.notifySubscribers();
    try {
      if (entityType === 'notebook') {
        const allNotes = await this.repo.getAllNotes<NoteRecord>();
        const childNotes = allNotes.filter((n) => n.notebookId === entityId);
        for (const child of childNotes) {
          await this.repo.deleteEntityAtomic('note', child.id);
        }
      }

      const receipt = await this.repo.deleteEntityAtomic(entityType as EntityType, entityId);
      if (receipt.ok) {
        this.generation++;
        await this.refreshStateFromRepo();
        this.lastError = null;
      } else {
        this.lastError = new Error(receipt.error || 'Failed to delete entity');
      }
      return receipt;
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.lastError = err instanceof Error ? err : new Error(errorMsg);
      return { ok: false, committedAt: null, outboxEntryId: null, error: errorMsg };
    } finally {
      this.isSaving = false;
      this.notifySubscribers();
    }
  }

  /**
   * Atomically saves or updates a schedule / reminder task.
   */
  async saveScheduleTask(task: ScheduleTaskRecord): Promise<LocalReceipt> {
    const validated = scheduleTaskRecordSchema.parse(task);
    const existing = await this.repo.getScheduleTask(validated.id);
    const mutationType: MutationType = existing ? 'update' : 'create';

    this.isSaving = true;
    this.notifySubscribers();
    try {
      const receipt = await this.repo.saveScheduleTaskAtomic(validated, mutationType);
      if (receipt.ok) {
        this.generation++;
        await this.refreshStateFromRepo();
        this.lastError = null;
      } else {
        this.lastError = new Error(receipt.error || 'Failed to save schedule task');
      }
      return receipt;
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.lastError = err instanceof Error ? err : new Error(errorMsg);
      return { ok: false, committedAt: null, outboxEntryId: null, error: errorMsg };
    } finally {
      this.isSaving = false;
      this.notifySubscribers();
    }
  }

  /**
   * Atomically deletes a schedule / reminder task.
   */
  async deleteScheduleTask(taskId: string): Promise<LocalReceipt> {
    return this.deleteEntity('schedule', taskId);
  }

  /**
   * Retrieves all schedule / reminder tasks for this account.
   */
  async getScheduleTasks(): Promise<ScheduleTaskRecord[]> {
    return this.repo.getAllScheduleTasks();
  }

  /**
   * Returns current sync summary indicating outbox depth and local/remote status.
   */
  async getSyncSummary(): Promise<SyncSummary> {
    const pending = await this.repo.getPendingOutbox();
    let conflictCount = 0;

    try {
      const conflicts = await this.repo.getDatabase().runTransaction(['conflicts'], 'readonly', (ctx) => {
        return ctx.getAll<{ needsUserAction?: boolean }>('conflicts');
      });
      conflictCount = conflicts.filter((conflict) => conflict.needsUserAction === true).length;
    } catch {
      conflictCount = 0;
    }

    let status: SyncStatus = 'idle';
    if (this.isSaving) {
      status = 'saving_locally';
    } else if (this.lastError) {
      status = 'error';
    } else if (conflictCount > 0) {
      status = 'conflict';
    } else if (pending.length > 0) {
      status = 'queued';
    } else if (this.isOpen) {
      status = 'synced';
    }

    return {
      status,
      pendingMutations: pending.length,
      lastSyncedAt: this.lastSyncedAt,
      conflictCount,
      errorMessage: this.lastError?.message,
    };
  }

  /**
   * Exports an encrypted or raw recovery bundle as a Blob.
   * Conforms to local bundle schema with canonical SHA-256 checksum.
   */
  async exportRecoveryBundle(): Promise<Blob> {
    const bundle = (await this.repo.exportLocalStateBundle(true)) as unknown as LocalStateExportBundle;
    const json = JSON.stringify(bundle, null, 2);
    return new Blob([json], { type: 'application/json' });
  }

  /**
   * Imports a recovery bundle into this workspace.
   */
  async importRecoveryBundle(
    bundleOrBlob: LocalStateExportBundle | Blob
  ): Promise<ImportBundleResult> {
    let bundle: LocalStateExportBundle;
    if (bundleOrBlob instanceof Blob) {
      const text = await bundleOrBlob.text();
      bundle = JSON.parse(text) as LocalStateExportBundle;
    } else {
      bundle = bundleOrBlob;
    }

    const normalizedBundle = {
      ...bundle,
      unsavedBuffers: bundle.unsavedBuffers ?? [],
    };
    const result = await this.repo.importLocalStateBundle(normalizedBundle);
    await this.refreshStateFromRepo();
    this.notifySubscribers();
    return result;
  }

  // ==========================================================================
  // UI Preferences (Cleanly separated from durable storage per Section 4.2)
  // ==========================================================================

  setSelectedNotebook(notebookId: string | null): void {
    this.activeNotebookId = notebookId;
    this.cachedNotesState.selectedNotebookId = notebookId;
    this.notifySubscribers();
  }

  setSelectedNote(noteId: string | null): void {
    this.activeNoteId = noteId;
    this.cachedNotesState.selectedNoteId = noteId;
    this.notifySubscribers();
  }

  setNotebookSort(sort: NotesSort): void {
    this.notebookSort = sort;
    this.cachedNotesState.notebookSort = sort;
    this.notifySubscribers();
  }

  setNoteSort(sort: NotesSort): void {
    this.noteSort = sort;
    this.cachedNotesState.noteSort = sort;
    this.notifySubscribers();
  }

  setFilter(filter: NotesFilter): void {
    this.filter = filter;
    this.cachedNotesState.filter = filter;
    this.notifySubscribers();
  }

  /**
   * Closes the workspace and unbinds all active listeners and locks.
   */
  async close(): Promise<void> {
    this.listeners.clear();
    if (this.unsubscribeSaveSuccess) {
      this.unsubscribeSaveSuccess();
      this.unsubscribeSaveSuccess = null;
    }
    if (this.unsubscribeSaveError) {
      this.unsubscribeSaveError();
      this.unsubscribeSaveError = null;
    }
    if (this.unsubscribeRemoteSnapshot) {
      this.unsubscribeRemoteSnapshot();
      this.unsubscribeRemoteSnapshot = null;
    }
    await this.repo.getDatabase().close();
    this.isOpen = false;
    LocalWorkspace.instances.delete(this.userId);
  }

  // ==========================================================================
  // Internal State Refresh
  // ==========================================================================

  private async refreshStateFromRepo(): Promise<void> {
    const [notebooks, notes] = await Promise.all([
      this.repo.getAllNotebooks<NotebookRecord>(),
      this.repo.getAllNotes<NoteRecord>(),
    ]);

    const notebookEntities: NotebookEntity[] = notebooks.map((nb) => ({
      id: nb.id,
      title: nb.title,
      description: nb.description ?? '',
      color: nb.color,
      icon: nb.icon,
      favorite: Boolean(nb.favorite),
      shared: Boolean(nb.shared),
      archived: Boolean(nb.archived),
      collapsed: Boolean(nb.collapsed),
      createdAt: nb.createdAt ?? new Date().toISOString(),
      updatedAt: nb.updatedAt ?? nb.createdAt ?? new Date().toISOString(),
      order: nb.order ?? 0,
    }));

    const noteDocuments: NoteDocument[] = notes.map((note) => {
      const rawNote = note as unknown as Record<string, unknown>;
      const base: NoteDocument = {
        id: note.id,
        notebookId: note.notebookId,
        title: note.title,
        ownerId: note.ownerId ?? null,
        permission: (note.permission as Permission) ?? 'owner',
        sharedWith: Array.isArray(rawNote.sharedWith) ? (rawNote.sharedWith as NoteDocument['sharedWith']) : [],
        publicLink: typeof rawNote.publicLink === 'boolean' ? rawNote.publicLink : false,
        tags: note.tags ?? [],
        favorite: Boolean(note.favorite),
        shared: Boolean(note.shared),
        archived: Boolean(note.archived),
        order: note.order ?? 0,
        createdAt: note.createdAt,
        updatedAt: note.updatedAt,
        contentType: note.contentType === 'kanban' ? 'kanban' : 'canvas',
        linkedConceptIds: Array.isArray(rawNote.linkedConceptIds) ? (rawNote.linkedConceptIds as string[]) : [],
        linkedResourceIds: Array.isArray(rawNote.linkedResourceIds) ? (rawNote.linkedResourceIds as string[]) : [],
        learningPathId: typeof rawNote.learningPathId === 'string' ? rawNote.learningPathId : null,
        revision: typeof rawNote.revision === 'number' ? rawNote.revision : null,
      };

      if (note.contentType === 'kanban' && note.kanbanData) {
        base.kanbanColumns = note.kanbanData.columns.map((c) => ({ id: c.id, label: c.title }));
        base.kanbanCards = note.kanbanData.cards;
      }

      return base;
    });

    const validNotebookId =
      this.activeNotebookId && notebookEntities.some((n) => n.id === this.activeNotebookId)
        ? this.activeNotebookId
        : notebookEntities[0]?.id ?? null;

    const validNoteId =
      this.activeNoteId && noteDocuments.some((n) => n.id === this.activeNoteId)
        ? this.activeNoteId
        : (noteDocuments.find((n) => n.notebookId === validNotebookId)?.id ?? null);

    this.activeNotebookId = validNotebookId;
    this.activeNoteId = validNoteId;

    this.cachedNotesState = {
      notebooks: notebookEntities,
      notes: noteDocuments,
      selectedNotebookId: validNotebookId,
      selectedNoteId: validNoteId,
      notebookSort: this.notebookSort,
      noteSort: this.noteSort,
      filter: this.filter,
    };

    // Calculate maximum generation from outbox
    const outbox = await this.repo.getPendingOutbox();
    let maxGen = this.generation;
    for (const entry of outbox) {
      if (entry.generation > maxGen) {
        maxGen = entry.generation;
      }
    }
    this.generation = maxGen;
  }
}

/**
 * Top-level factory function for obtaining LocalWorkspace instance.
 */
export function getLocalWorkspace(userId: string, options?: LocalWorkspaceOptions): LocalWorkspace {
  return LocalWorkspace.getLocalWorkspace(userId, options);
}
