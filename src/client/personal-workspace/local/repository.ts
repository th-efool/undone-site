/**
 * Production Personal Workspace Local Repository
 *
 * Promoted from `LocalWorkspaceRepository` prototype into production.
 * Implements local-first durability, atomic outbox transactions,
 * failure/quota recovery, cross-tab lock coordination, and live editor buffer management.
 *
 * Conforms to Evidence Artifact E4 (Frozen Local-First & GitHub Sync Contracts).
 */

import {
  PersonalWorkspaceDatabase,
  TabLockCoordinator,
  computeSha256,
  secureTimingSafeEqual,
} from './database';
import type {
  StoreName,
  EntityType,
  MutationType,
  OutboxEntry,
  UnsavedEditorBuffer,
  SaveSuccessEvent,
  SaveErrorEvent,
  SaveResult,
  CommittedWorkspaceState,
  LocalStateExportBundle,
  PersonalWorkspaceDatabaseOptions,
} from './database';
import type {
  NotebookRecord,
  NoteRecord,
  CanvasNoteRecord,
  KanbanNoteRecord,
  AssetRecord,
  ScheduleTaskRecord,
} from '@/src/shared/personal-workspace/contracts';
import {
  extractAssetsFromCanvasScene,
  extractAssetsFromKanbanCards,
} from '@/src/shared/personal-workspace/media';

export type {
  StoreName,
  EntityType,
  MutationType,
  OutboxEntry,
  UnsavedEditorBuffer,
  SaveSuccessEvent,
  SaveErrorEvent,
  SaveResult,
  CommittedWorkspaceState,
  LocalStateExportBundle,
};

export {
  PersonalWorkspaceDatabase,
  TabLockCoordinator,
  computeSha256,
  secureTimingSafeEqual,
  FROZEN_OFFLINE_CAPABILITY_PROMISES,
  TransactionAbortError,
  QuotaExceededError,
  LockAcquisitionTimeoutError,
} from './database';

export interface PersonalWorkspaceRepoOptions extends PersonalWorkspaceDatabaseOptions {
  tabId?: string;
}

export interface ImportBundleResult {
  importedCounts: {
    notebooks: number;
    notes: number;
    assets: number;
    schedules?: number;
    outbox: number;
    buffers: number;
    conflicts: number;
  };
}

export class PersonalWorkspaceRepository {
  readonly userId: string;
  readonly storageName: string;
  private engine: PersonalWorkspaceDatabase;
  private lockCoordinator: TabLockCoordinator;
  private saveSuccessListeners: Array<(event: SaveSuccessEvent) => void> = [];
  private saveErrorListeners: Array<(event: SaveErrorEvent) => void> = [];
  private memoryEditorBuffers = new Map<string, UnsavedEditorBuffer>();
  private currentGeneration = 0;

  constructor(userId: string, options: PersonalWorkspaceRepoOptions = {}) {
    if (!userId || userId.trim() === '') {
      throw new Error('User ID is required for account-scoped repository');
    }
    this.userId = userId;
    this.storageName = `workspace_${userId}`;
    this.engine = new PersonalWorkspaceDatabase(this.storageName, options);
    this.lockCoordinator = new TabLockCoordinator(this.storageName, options.tabId);
  }

  getLockCoordinator(): TabLockCoordinator {
    return this.lockCoordinator;
  }

  getDatabase(): PersonalWorkspaceDatabase {
    return this.engine;
  }

  async initialize(): Promise<void> {
    await this.engine.initialize();
  }

  onSaveSuccess(callback: (event: SaveSuccessEvent) => void): () => void {
    this.saveSuccessListeners.push(callback);
    return () => {
      this.saveSuccessListeners = this.saveSuccessListeners.filter((cb) => cb !== callback);
    };
  }

  onSaveError(callback: (event: SaveErrorEvent) => void): () => void {
    this.saveErrorListeners.push(callback);
    return () => {
      this.saveErrorListeners = this.saveErrorListeners.filter((cb) => cb !== callback);
    };
  }

  // Simulation controls for quota and failure injection testing
  setSimulateFailure(fail: boolean, error?: Error): void {
    this.engine.setSimulateFailure(fail, error);
  }

  setSimulateQuotaExceeded(fail: boolean): void {
    this.engine.setSimulateQuotaExceeded(fail);
  }

  setQuotaBytes(bytes: number): void {
    this.engine.setQuotaBytes(bytes);
  }

  // ==========================================================================
  // Atomic Outbox Operations
  // ==========================================================================

  /**
   * Atomically saves a notebook and queues a corresponding outbox mutation.
   * If transaction fails or aborts, neither the notebook nor the outbox entry is written,
   * and save success is NEVER emitted.
   */
  async saveNotebookAtomic<T extends { id: string } = NotebookRecord>(
    notebook: T,
    mutationType: MutationType = 'create',
  ): Promise<SaveResult> {
    const timestamp = new Date().toISOString();
    const outboxId = `outbox-nb-${notebook.id}-${Date.now()}`;
    const outboxEntry: OutboxEntry = {
      id: outboxId,
      clientTimestamp: timestamp,
      mutationType,
      entityType: 'notebook',
      entityId: notebook.id,
      payload: structuredClone(notebook),
      status: 'pending',
      retryCount: 0,
      generation: ++this.currentGeneration,
    };

    try {
      await this.engine.runTransaction(
        ['notebooks', 'outbox'],
        'readwrite',
        (ctx) => {
          ctx.put('notebooks', notebook.id, notebook);
          ctx.put('outbox', outboxId, outboxEntry);
        },
      );

      // EMIT SAVE SUCCESS ONLY AFTER SUCCESSFUL COMMIT
      const event: SaveSuccessEvent = {
        entityType: 'notebook',
        entityId: notebook.id,
        outboxId,
        timestamp,
      };
      for (const listener of this.saveSuccessListeners) {
        try {
          listener(event);
        } catch {}
      }

      this.lockCoordinator.broadcast({
        type: 'WORKSPACE_MUTATED',
        tabId: this.lockCoordinator.tabId,
        entityType: 'notebook',
        entityId: notebook.id,
      });

      return {
        ok: true,
        committedAt: timestamp,
        outboxEntryId: outboxId,
      };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      const errorEvent: SaveErrorEvent = {
        entityType: 'notebook',
        entityId: notebook.id,
        error,
        rolledBack: true,
      };
      for (const listener of this.saveErrorListeners) {
        try {
          listener(errorEvent);
        } catch {}
      }

      return {
        ok: false,
        committedAt: null,
        outboxEntryId: null,
        error: error.message,
      };
    }
  }

  /**
   * Atomically saves a canvas note, all referenced assets, and outbox mutations.
   * Commits in one transaction across `notes`, `assets`, `outbox`, and `editor_buffers`.
   */
  async saveCanvasNoteAtomic<
    TNote extends { id: string } = CanvasNoteRecord,
    TAsset extends { id: string } = AssetRecord,
  >(
    note: TNote,
    assets: TAsset[] = [],
    mutationType: MutationType = 'create',
  ): Promise<SaveResult> {
    const timestamp = new Date().toISOString();
    const outboxId = `outbox-canvas-${note.id}-${Date.now()}`;

    const effectiveAssets: TAsset[] = [...assets];
    let noteToSave = note;

    const rawNote = note as Record<string, any>;
    if (rawNote?.canvasData && (rawNote.canvasData.elements || rawNote.canvasData.files)) {
      const { sanitizedScene, extractedAssets } = extractAssetsFromCanvasScene({
        elements: rawNote.canvasData.elements,
        files: rawNote.canvasData.files,
      });

      if (extractedAssets.length > 0) {
        for (const ea of extractedAssets) {
          if (!effectiveAssets.some((a) => a.id === ea.id || (a as any).hash === ea.hash)) {
            effectiveAssets.push(ea as unknown as TAsset);
          }
        }
        noteToSave = {
          ...note,
          canvasData: {
            ...rawNote.canvasData,
            elements: sanitizedScene.elements,
            files: sanitizedScene.files,
          },
        };
      }
    }

    const noteOutboxEntry: OutboxEntry = {
      id: outboxId,
      clientTimestamp: timestamp,
      mutationType,
      entityType: 'note',
      entityId: noteToSave.id,
      payload: structuredClone(noteToSave),
      status: 'pending',
      retryCount: 0,
      generation: ++this.currentGeneration,
    };

    try {
      await this.engine.runTransaction(
        ['notes', 'assets', 'outbox', 'editor_buffers'],
        'readwrite',
        (ctx) => {
          ctx.put('notes', noteToSave.id, noteToSave);

          for (const asset of effectiveAssets) {
            ctx.put('assets', asset.id, asset);
            const assetOutboxId = `outbox-asset-${asset.id}-${Date.now()}`;
            const assetEntry: OutboxEntry = {
              id: assetOutboxId,
              clientTimestamp: timestamp,
              mutationType: 'create',
              entityType: 'asset',
              entityId: asset.id,
              payload: structuredClone(asset),
              status: 'pending',
              retryCount: 0,
              generation: ++this.currentGeneration,
            };
            ctx.put('outbox', assetOutboxId, assetEntry);
          }

          ctx.put('outbox', outboxId, noteOutboxEntry);
          ctx.delete('editor_buffers', noteToSave.id);
        },
      );

      this.memoryEditorBuffers.delete(noteToSave.id);

      const event: SaveSuccessEvent = {
        entityType: 'note',
        entityId: noteToSave.id,
        outboxId,
        timestamp,
      };
      for (const listener of this.saveSuccessListeners) {
        try {
          listener(event);
        } catch {}
      }

      this.lockCoordinator.broadcast({
        type: 'WORKSPACE_MUTATED',
        tabId: this.lockCoordinator.tabId,
        entityType: 'note',
        entityId: noteToSave.id,
      });

      return {
        ok: true,
        committedAt: timestamp,
        outboxEntryId: outboxId,
      };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      const errorEvent: SaveErrorEvent = {
        entityType: 'note',
        entityId: note.id,
        error,
        rolledBack: true,
      };
      for (const listener of this.saveErrorListeners) {
        try {
          listener(errorEvent);
        } catch {}
      }

      return {
        ok: false,
        committedAt: null,
        outboxEntryId: null,
        error: error.message,
      };
    }
  }

  /**
   * Atomically saves a kanban note and queues outbox mutation.
   * Extracts any embedded card covers/attachments to assets store.
   */
  async saveKanbanNoteAtomic<T extends { id: string } = KanbanNoteRecord>(
    note: T,
    mutationType: MutationType = 'create',
  ): Promise<SaveResult> {
    const timestamp = new Date().toISOString();
    const outboxId = `outbox-kanban-${note.id}-${Date.now()}`;

    const rawNote = note as Record<string, any>;
    let noteToSave = note;
    const extractedAssetsToSave: AssetRecord[] = [];

    if (rawNote?.kanbanData?.cards && Array.isArray(rawNote.kanbanData.cards)) {
      const { cleanCards, extractedAssets } = extractAssetsFromKanbanCards(rawNote.kanbanData.cards);
      if (extractedAssets.length > 0) {
        extractedAssetsToSave.push(...extractedAssets);
        noteToSave = {
          ...note,
          kanbanData: {
            ...rawNote.kanbanData,
            cards: cleanCards,
          },
        };
      }
    }

    const outboxEntry: OutboxEntry = {
      id: outboxId,
      clientTimestamp: timestamp,
      mutationType,
      entityType: 'note',
      entityId: noteToSave.id,
      payload: structuredClone(noteToSave),
      status: 'pending',
      retryCount: 0,
      generation: ++this.currentGeneration,
    };

    try {
      await this.engine.runTransaction(
        ['notes', 'assets', 'outbox', 'editor_buffers'],
        'readwrite',
        (ctx) => {
          ctx.put('notes', noteToSave.id, noteToSave);

          for (const asset of extractedAssetsToSave) {
            ctx.put('assets', asset.id, asset);
            const assetOutboxId = `outbox-asset-${asset.id}-${Date.now()}`;
            const assetEntry: OutboxEntry = {
              id: assetOutboxId,
              clientTimestamp: timestamp,
              mutationType: 'create',
              entityType: 'asset',
              entityId: asset.id,
              payload: structuredClone(asset),
              status: 'pending',
              retryCount: 0,
              generation: ++this.currentGeneration,
            };
            ctx.put('outbox', assetOutboxId, assetEntry);
          }

          ctx.put('outbox', outboxId, outboxEntry);
          ctx.delete('editor_buffers', noteToSave.id);
        },
      );

      this.memoryEditorBuffers.delete(noteToSave.id);

      const event: SaveSuccessEvent = {
        entityType: 'note',
        entityId: noteToSave.id,
        outboxId,
        timestamp,
      };
      for (const listener of this.saveSuccessListeners) {
        try {
          listener(event);
        } catch {}
      }

      this.lockCoordinator.broadcast({
        type: 'WORKSPACE_MUTATED',
        tabId: this.lockCoordinator.tabId,
        entityType: 'note',
        entityId: noteToSave.id,
      });

      return {
        ok: true,
        committedAt: timestamp,
        outboxEntryId: outboxId,
      };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      const errorEvent: SaveErrorEvent = {
        entityType: 'note',
        entityId: note.id,
        error,
        rolledBack: true,
      };
      for (const listener of this.saveErrorListeners) {
        try {
          listener(errorEvent);
        } catch {}
      }

      return {
        ok: false,
        committedAt: null,
        outboxEntryId: null,
        error: error.message,
      };
    }
  }

  /**
   * Atomically saves a schedule/reminder task and records an outbox mutation.
   */
  async saveScheduleTaskAtomic(
    task: ScheduleTaskRecord,
    mutationType: MutationType = 'create',
  ): Promise<SaveResult> {
    const timestamp = new Date().toISOString();
    const outboxId = `outbox-sched-${task.id}-${Date.now()}`;
    const outboxEntry: OutboxEntry = {
      id: outboxId,
      clientTimestamp: timestamp,
      mutationType,
      entityType: 'schedule',
      entityId: task.id,
      payload: structuredClone(task),
      status: 'pending',
      retryCount: 0,
      generation: ++this.currentGeneration,
    };

    try {
      await this.engine.runTransaction(
        ['schedules', 'outbox'],
        'readwrite',
        (ctx) => {
          ctx.put('schedules', task.id, task);
          ctx.put('outbox', outboxId, outboxEntry);
        },
      );

      const event: SaveSuccessEvent = {
        entityType: 'schedule',
        entityId: task.id,
        outboxId,
        timestamp,
      };
      for (const listener of this.saveSuccessListeners) {
        try {
          listener(event);
        } catch {}
      }

      this.lockCoordinator.broadcast({
        type: 'WORKSPACE_MUTATED',
        tabId: this.lockCoordinator.tabId,
        entityType: 'schedule',
        entityId: task.id,
      });

      return {
        ok: true,
        committedAt: timestamp,
        outboxEntryId: outboxId,
      };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      const errorEvent: SaveErrorEvent = {
        entityType: 'schedule',
        entityId: task.id,
        error,
        rolledBack: true,
      };
      for (const listener of this.saveErrorListeners) {
        try {
          listener(errorEvent);
        } catch {}
      }

      return {
        ok: false,
        committedAt: null,
        outboxEntryId: null,
        error: error.message,
      };
    }
  }

  async getScheduleTask(id: string): Promise<ScheduleTaskRecord | null> {
    return this.engine.runTransaction(['schedules'], 'readonly', (ctx) => {
      return ctx.get<ScheduleTaskRecord>('schedules', id) || null;
    });
  }

  async getAllScheduleTasks(): Promise<ScheduleTaskRecord[]> {
    return this.engine.runTransaction(['schedules'], 'readonly', (ctx) => {
      return ctx.getAll<ScheduleTaskRecord>('schedules');
    });
  }

  async listScheduleTasks(): Promise<ScheduleTaskRecord[]> {
    return this.getAllScheduleTasks();
  }

  async deleteScheduleTaskAtomic(id: string): Promise<SaveResult> {
    return this.deleteEntityAtomic('schedule', id);
  }

  /**
   * Atomically deletes an entity and records a delete mutation in outbox.
   */
  async deleteEntityAtomic(
    entityType: EntityType,
    entityId: string,
  ): Promise<SaveResult> {
    const timestamp = new Date().toISOString();
    const outboxId = `outbox-del-${entityId}-${Date.now()}`;
    const targetStore: StoreName =
      entityType === 'notebook'
        ? 'notebooks'
        : entityType === 'note'
        ? 'notes'
        : entityType === 'schedule'
        ? 'schedules'
        : 'assets';

    const outboxEntry: OutboxEntry = {
      id: outboxId,
      clientTimestamp: timestamp,
      mutationType: 'delete',
      entityType,
      entityId,
      payload: null,
      status: 'pending',
      retryCount: 0,
      generation: ++this.currentGeneration,
    };

    try {
      await this.engine.runTransaction([targetStore, 'outbox'], 'readwrite', (ctx) => {
        ctx.delete(targetStore, entityId);
        ctx.put('outbox', outboxId, outboxEntry);
      });

      this.lockCoordinator.broadcast({
        type: 'WORKSPACE_MUTATED',
        tabId: this.lockCoordinator.tabId,
        entityType,
        entityId,
      });

      return { ok: true, committedAt: timestamp, outboxEntryId: outboxId };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      return { ok: false, committedAt: null, outboxEntryId: null, error: error.message };
    }
  }

  // ==========================================================================
  // Reading & Querying
  // ==========================================================================

  async getNotebook<T = NotebookRecord>(id: string): Promise<T | null> {
    return this.engine.runTransaction(['notebooks'], 'readonly', (ctx) => {
      return ctx.get<T>('notebooks', id) || null;
    });
  }

  async getAllNotebooks<T = NotebookRecord>(): Promise<T[]> {
    return this.engine.runTransaction(['notebooks'], 'readonly', (ctx) => {
      return ctx.getAll<T>('notebooks');
    });
  }

  async listNotebooks<T = NotebookRecord>(): Promise<T[]> {
    return this.getAllNotebooks<T>();
  }

  async getNote<T = NoteRecord>(id: string): Promise<T | null> {
    return this.engine.runTransaction(['notes'], 'readonly', (ctx) => {
      return ctx.get<T>('notes', id) || null;
    });
  }

  async getAllNotes<T = NoteRecord>(): Promise<T[]> {
    return this.engine.runTransaction(['notes'], 'readonly', (ctx) => {
      return ctx.getAll<T>('notes');
    });
  }

  async listNotes<T = NoteRecord>(): Promise<T[]> {
    return this.getAllNotes<T>();
  }

  async getAsset<T = AssetRecord>(id: string): Promise<T | null> {
    return this.engine.runTransaction(['assets'], 'readonly', (ctx) => {
      return ctx.get<T>('assets', id) || null;
    });
  }

  async getAllAssets<T = AssetRecord>(): Promise<T[]> {
    return this.engine.runTransaction(['assets'], 'readonly', (ctx) => {
      return ctx.getAll<T>('assets');
    });
  }

  async listAssets<T = AssetRecord>(): Promise<T[]> {
    return this.getAllAssets<T>();
  }

  async saveAsset<T extends { id: string } = AssetRecord>(asset: T): Promise<void> {
    await this.engine.runTransaction(['assets'], 'readwrite', (ctx) => {
      ctx.put('assets', asset.id, asset);
    });
  }

  async getPendingOutbox(): Promise<OutboxEntry[]> {
    return this.engine.runTransaction(['outbox'], 'readonly', (ctx) => {
      const all = ctx.getAll<OutboxEntry>('outbox');
      return all
        .filter((entry) => entry.status === 'pending' || entry.status === 'in_flight')
        .sort((a, b) => a.clientTimestamp.localeCompare(b.clientTimestamp));
    });
  }

  async listOutbox(): Promise<OutboxEntry[]> {
    return this.getPendingOutbox();
  }

  /**
   * Alias for getPendingOutbox conforming to client sync coordinator interface.
   */
  async getPendingOutboxMutations(): Promise<OutboxEntry[]> {
    return this.getPendingOutbox();
  }

  async acknowledgeOutboxUpTo(generation: number): Promise<void> {
    await this.engine.runTransaction(['outbox'], 'readwrite', (ctx) => {
      const all = ctx.getAll<OutboxEntry>('outbox');
      for (const entry of all) {
        if (entry.generation <= generation) {
          ctx.delete('outbox', entry.id);
        }
      }
    });
  }

  /**
   * Acknowledges and removes an explicit batch of outbox mutation IDs.
   * Conforms to generational and CAS sync coordinator ACK semantics.
   */
  async acknowledgeOutboxBatch(batchEntryIds: string[]): Promise<void> {
    if (!batchEntryIds || batchEntryIds.length === 0) return;
    const idSet = new Set(batchEntryIds);
    await this.engine.runTransaction(['outbox'], 'readwrite', (ctx) => {
      for (const id of idSet) {
        ctx.delete('outbox', id);
      }
    });
  }

  /**
   * Generic atomic note saver routing to canvas or kanban/markdown stores.
   */
  async saveNoteAtomic<T extends { id: string; contentType?: string } = NoteRecord>(
    note: T,
    mutationType: MutationType = 'create',
    referencedAssets: Array<{ id: string }> = [],
  ): Promise<SaveResult> {
    const rawNote = note as unknown as Record<string, unknown>;
    if (rawNote.contentType === 'canvas') {
      return this.saveCanvasNoteAtomic(
        note as unknown as Parameters<typeof this.saveCanvasNoteAtomic>[0],
        referencedAssets as unknown as Parameters<typeof this.saveCanvasNoteAtomic>[1],
        mutationType
      );
    }
    return this.saveKanbanNoteAtomic(note, mutationType);
  }

  // ==========================================================================
  // Live Editor Buffer Management (In-Memory Keystrokes / Uncommitted Edits)
  // ==========================================================================

  /**
   * Updates the live in-memory editor buffer.
   * Represents typing/drawing in progress that has NOT yet committed to disk.
   */
  updateEditorBuffer(
    noteId: string,
    payload: unknown,
    contentType: 'canvas' | 'kanban' | 'markdown' | string = 'canvas',
    schemaVersion = 1,
  ): void {
    const validContentType: 'canvas' | 'kanban' | 'markdown' =
      contentType === 'kanban' || contentType === 'markdown' ? contentType : 'canvas';

    const buffer: UnsavedEditorBuffer = {
      noteId,
      contentType: validContentType,
      bufferPayload: structuredClone(payload),
      lastKeystrokeAt: new Date().toISOString(),
      isDirty: true,
      schemaVersion,
    };
    this.memoryEditorBuffers.set(noteId, buffer);

    // Asynchronously stage to editor_buffers store for crash recovery
    this.engine
      .runTransaction(['editor_buffers'], 'readwrite', (ctx) => {
        ctx.put('editor_buffers', noteId, buffer);
      })
      .catch(() => {});
  }

  getEditorBuffer(noteId: string): UnsavedEditorBuffer | null {
    const mem = this.memoryEditorBuffers.get(noteId);
    if (mem) return structuredClone(mem);
    return null;
  }

  async getPersistedEditorBuffer(noteId: string): Promise<UnsavedEditorBuffer | null> {
    return this.engine.runTransaction(['editor_buffers'], 'readonly', (ctx) => {
      return ctx.get<UnsavedEditorBuffer>('editor_buffers', noteId) || null;
    });
  }

  discardEditorBuffer(noteId: string): void {
    this.memoryEditorBuffers.delete(noteId);
    this.engine
      .runTransaction(['editor_buffers'], 'readwrite', (ctx) => {
        ctx.delete('editor_buffers', noteId);
      })
      .catch(() => {});
  }

  // ==========================================================================
  // Export & Import Recovery Bundles
  // ==========================================================================

  /**
   * Generates a complete state recovery bundle.
   * Explicitly distinguishes committed crash-safe state from unsaved editor buffers.
   */
  async exportLocalStateBundle(includeUnsavedBuffers = true): Promise<LocalStateExportBundle> {
    const [notebooks, notes, assets, schedules, outbox, persistedBuffers, conflicts, metadata] =
      await this.engine.runTransaction(
        ['notebooks', 'notes', 'assets', 'schedules', 'outbox', 'editor_buffers', 'conflicts', 'metadata'],
        'readonly',
        (ctx) => {
          return [
            ctx.getAll<NotebookRecord>('notebooks'),
            ctx.getAll<NoteRecord>('notes'),
            ctx.getAll<AssetRecord>('assets'),
            ctx.getAll<ScheduleTaskRecord>('schedules'),
            ctx.getAll<OutboxEntry>('outbox'),
            ctx.getAll<UnsavedEditorBuffer>('editor_buffers'),
            ctx.getAll<Record<string, unknown>>('conflicts'),
            ctx.getAll<Record<string, unknown>>('metadata'),
          ] as const;
        },
      );

    const buffersMap = new Map<string, UnsavedEditorBuffer>();
    if (includeUnsavedBuffers) {
      for (const b of persistedBuffers) {
        buffersMap.set(b.noteId, b);
      }
      for (const [id, b] of this.memoryEditorBuffers) {
        buffersMap.set(id, b);
      }
    }

    const unsavedBuffers = Array.from(buffersMap.values());

    const committedState: CommittedWorkspaceState = {
      notebooks,
      notes,
      assets,
      schedules,
      outbox,
      conflicts,
      metadata,
    };

    const bundleWithoutChecksum = {
      formatVersion: '1.0.0' as const,
      exportedAt: new Date().toISOString(),
      sourceUserId: this.userId,
      storageName: this.storageName,
      committedState,
      unsavedBuffers,
    };

    const canonicalJson = JSON.stringify(bundleWithoutChecksum);
    const checksum = computeSha256(canonicalJson);

    return {
      ...bundleWithoutChecksum,
      checksum,
    };
  }

  /**
   * Imports an export bundle into this workspace repository.
   * Can restore into a completely clean/fresh local repository.
   */
  async importLocalStateBundle(
    bundle: LocalStateExportBundle,
    options: { restoreBuffers?: boolean } = { restoreBuffers: true },
  ): Promise<ImportBundleResult> {
    const { checksum, ...payload } = bundle;
    const computed = computeSha256(JSON.stringify(payload));
    if (!secureTimingSafeEqual(computed, checksum)) {
      throw new Error(`Bundle checksum mismatch! Expected ${checksum}, computed ${computed}`);
    }

    const { committedState, unsavedBuffers } = bundle;

    await this.engine.runTransaction(
      ['notebooks', 'notes', 'assets', 'schedules', 'outbox', 'editor_buffers', 'conflicts', 'metadata'],
      'readwrite',
      (ctx) => {
        for (const nb of committedState.notebooks || []) {
          ctx.put('notebooks', (nb as { id: string }).id, nb);
        }
        for (const note of committedState.notes || []) {
          ctx.put('notes', (note as { id: string }).id, note);
        }
        for (const asset of committedState.assets || []) {
          ctx.put('assets', (asset as { id: string }).id, asset);
        }
        for (const sched of (committedState as any).schedules || []) {
          ctx.put('schedules', (sched as { id: string }).id, sched);
        }
        for (const entry of committedState.outbox || []) {
          ctx.put('outbox', (entry as { id: string }).id, entry);
        }
        for (const conflict of committedState.conflicts || []) {
          const c = conflict as { id?: string; entityId?: string };
          ctx.put('conflicts', c.id || c.entityId || '', conflict);
        }
        for (const meta of committedState.metadata || []) {
          const m = meta as { key?: string; id?: string };
          ctx.put('metadata', m.key || m.id || '', meta);
        }

        if (options.restoreBuffers && unsavedBuffers) {
          for (const buffer of unsavedBuffers) {
            const restoredBuffer: UnsavedEditorBuffer = {
              ...buffer,
              recoveredFromBuffer: true,
            };
            ctx.put('editor_buffers', buffer.noteId, restoredBuffer);
            this.memoryEditorBuffers.set(buffer.noteId, restoredBuffer);
          }
        }
      },
    );

    return {
      importedCounts: {
        notebooks: committedState.notebooks?.length ?? 0,
        notes: committedState.notes?.length ?? 0,
        assets: committedState.assets?.length ?? 0,
        schedules: (committedState as any).schedules?.length ?? 0,
        outbox: committedState.outbox?.length ?? 0,
        buffers: options.restoreBuffers ? (unsavedBuffers?.length ?? 0) : 0,
        conflicts: committedState.conflicts?.length ?? 0,
      },
    };
  }

  /**
   * Resets and clears all storage for this account.
   */
  async clearAll(): Promise<void> {
    await this.engine.clear();
    this.memoryEditorBuffers.clear();
  }
}

/**
 * Backward compatibility alias for LocalWorkspaceRepository
 */
export { PersonalWorkspaceRepository as LocalWorkspaceRepository };
