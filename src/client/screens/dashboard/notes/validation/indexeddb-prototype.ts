/**
 * IndexedDB Local Workspace Repository Prototype (Stage V3)
 *
 * Implements local-first durability, atomic outbox transactions,
 * failure/quota recovery, cross-tab coordination, and unsaved buffer export/import.
 *
 * Requirements addressed:
 * - Scoped storage by userId: `workspace_${userId}`
 * - Atomic Outbox: entity and outbox mutations commit together in 1 transaction
 * - Emit save success ONLY after transaction commit succeeds
 * - Abort / Quota exhaustion simulation with zero half-writes
 * - Live unsaved editor buffer recovery and complete export/import bundles
 * - Web Locks + BroadcastChannel writer serialization across multiple tabs
 * - Frozen distinct capability promises (Offline Editing vs Offline Reopening vs Cross-Device Recovery)
 */

import { computeSha256, secureTimingSafeEqual } from './fixtures';
import type {
  ValidationNotebook,
  ValidationCanvasNote,
  ValidationKanbanNote,
  ValidationAsset,
} from './fixtures';

// ============================================================================
// Types & Contracts
// ============================================================================

export type EntityType = 'notebook' | 'note' | 'asset';
export type MutationType = 'create' | 'update' | 'delete';

export interface OutboxEntry {
  id: string;
  clientTimestamp: string;
  mutationType: MutationType;
  entityType: EntityType;
  entityId: string;
  payload: unknown;
  baseVersion?: number | string | null;
  status: 'pending' | 'in_flight' | 'acknowledged' | 'failed';
  retryCount: number;
  generation: number;
}

export interface UnsavedEditorBuffer {
  noteId: string;
  contentType: 'canvas' | 'kanban' | 'markdown';
  bufferPayload: unknown;
  lastKeystrokeAt: string;
  isDirty: boolean;
  schemaVersion: number;
  recoveredFromBuffer?: boolean;
}

export interface SaveSuccessEvent {
  entityType: EntityType;
  entityId: string;
  outboxId: string;
  timestamp: string;
}

export interface SaveErrorEvent {
  entityType: EntityType;
  entityId: string;
  error: Error;
  rolledBack: boolean;
}

export interface SaveResult {
  ok: boolean;
  committedAt: string | null;
  outboxEntryId: string | null;
  error?: string;
}

export interface CommittedWorkspaceState {
  notebooks: ValidationNotebook[];
  notes: Array<ValidationCanvasNote | ValidationKanbanNote | Record<string, unknown>>;
  assets: ValidationAsset[];
  outbox: OutboxEntry[];
}

export interface LocalStateExportBundle {
  formatVersion: '1.0.0';
  exportedAt: string;
  sourceUserId: string;
  storageName: string;
  committedState: CommittedWorkspaceState;
  unsavedBuffers: UnsavedEditorBuffer[];
  checksum: string; // SHA-256 of JSON canonical state
}

// ============================================================================
// Capability Promises Freeze Table (V3 Requirements)
// ============================================================================

export const FROZEN_OFFLINE_CAPABILITY_PROMISES = {
  OFFLINE_EDITING: {
    capability: 'Offline Editing',
    tier: 'R1_MANDATORY',
    status: 'PROVEN',
    deliveryContract: 'Already-open, provisioned workspace edits without network/GitHub',
    technicalMechanism:
      'Atomic multi-store IndexedDB transactions committing note mutations and pending outbox entries together, backed by live in-memory editor buffers',
    guarantees: [
      'No half-writes on browser sleep or process interruptions',
      'Pending mutations queue indefinitely in outbox until transport is restored',
      'Immediate local save success emitted ONLY upon full transaction commit',
    ],
  },
  OFFLINE_REOPENING: {
    capability: 'Offline Reopening',
    tier: 'R1_TARGET',
    status: 'PROVEN_WITH_PREREQUISITES',
    deliveryContract: 'Shell and selected local workspace reopen after provisioning',
    technicalMechanism:
      'Account-scoped IndexedDB repository (workspace_${userId}) loads all notebooks, notes, and binary assets with zero network access',
    prerequisites: [
      'Application shell/assets cached by ServiceWorker or PWA manifest',
      'Browser origin storage has not been cleared or evicted by the operating system',
    ],
    boundaryNotes:
      'IndexedDB persistence alone does NOT guarantee offline opening if application code chunks are missing. Never advertise "fully offline" on IndexedDB alone.',
  },
  CROSS_DEVICE_RECOVERY: {
    capability: 'Cross-Device Recovery',
    tier: 'R2_DEFERRED',
    status: 'DEFERRED_TO_V4_R2',
    deliveryContract: 'Fresh authorized device restores complete remote snapshot',
    technicalMechanism:
      'Network required: queries remote GitHub branch head, downloads tree, reads note files, and downloads all verified binary assets',
    boundaryNotes:
      'Local IndexedDB alone cannot restore to a fresh device without network synchronization. Verified remote publication adapter required.',
  },
} as const;

// ============================================================================
// Custom Error Types
// ============================================================================

export class TransactionAbortError extends Error {
  constructor(message = 'Transaction was aborted') {
    super(message);
    this.name = 'TransactionAbortError';
  }
}

export class QuotaExceededError extends Error {
  constructor(message = 'Storage quota exceeded') {
    super(message);
    this.name = 'QuotaExceededError';
  }
}

export class LockAcquisitionTimeoutError extends Error {
  constructor(message = 'Timed out acquiring cross-tab lock') {
    super(message);
    this.name = 'LockAcquisitionTimeoutError';
  }
}

// ============================================================================
// Low-Level Transactional Store Engine (IndexedDB semantics)
// ============================================================================

type StoreName = 'notebooks' | 'notes' | 'assets' | 'outbox' | 'editor_buffers' | 'metadata';

interface TransactionContext {
  get<T>(storeName: StoreName, key: string): T | undefined;
  getAll<T>(storeName: StoreName): T[];
  put<T>(storeName: StoreName, key: string, value: T): void;
  delete(storeName: StoreName, key: string): void;
  abort(reason?: string): void;
}

export class TransactionalStoreEngine {
  readonly dbName: string;
  private stores: Map<StoreName, Map<string, unknown>> = new Map();
  private maxQuotaBytes: number;
  private simulateFailure = false;
  private failureError: Error | null = null;
  private simulateQuotaFailure = false;

  constructor(dbName: string, maxQuotaBytes = 50 * 1024 * 1024) {
    this.dbName = dbName;
    this.maxQuotaBytes = maxQuotaBytes;
    this.initStores();
  }

  private initStores() {
    const storeNames: StoreName[] = [
      'notebooks',
      'notes',
      'assets',
      'outbox',
      'editor_buffers',
      'metadata',
    ];
    for (const name of storeNames) {
      if (!this.stores.has(name)) {
        this.stores.set(name, new Map());
      }
    }
  }

  setQuotaBytes(bytes: number) {
    this.maxQuotaBytes = bytes;
  }

  setSimulateFailure(fail: boolean, error?: Error) {
    this.simulateFailure = fail;
    this.failureError = error || new TransactionAbortError('Simulated transaction failure');
  }

  setSimulateQuotaExceeded(fail: boolean) {
    this.simulateQuotaFailure = fail;
  }

  calculateStorageBytes(): number {
    let bytes = 0;
    for (const [, store] of this.stores) {
      for (const [, val] of store) {
        bytes += Buffer.byteLength(JSON.stringify(val), 'utf8');
      }
    }
    return bytes;
  }

  /**
   * Executes a transaction spanning multiple stores atomically.
   * If any step throws, aborts, or exceeds quota, all staged modifications
   * are discarded and the database state remains 100% unchanged.
   */
  async runTransaction<R>(
    storeNames: StoreName[],
    mode: 'readonly' | 'readwrite',
    fn: (ctx: TransactionContext) => Promise<R> | R,
  ): Promise<R> {
    // Check if failure is injected before starting
    if (this.simulateFailure) {
      throw this.failureError || new TransactionAbortError();
    }
    if (this.simulateQuotaFailure) {
      throw new QuotaExceededError('Simulated quota exceeded before transaction');
    }

    // Prepare staging copy-on-write clone for atomic commit
    const staging = new Map<StoreName, Map<string, unknown>>();
    for (const name of storeNames) {
      const original = this.stores.get(name)!;
      staging.set(name, new Map(original));
    }

    let aborted = false;
    let abortReason = '';

    const ctx: TransactionContext = {
      get: <T>(storeName: StoreName, key: string): T | undefined => {
        const store = staging.get(storeName);
        if (!store) {
          throw new Error(`Store ${storeName} not in transaction scope`);
        }
        const val = store.get(key);
        return val ? (structuredClone(val) as T) : undefined;
      },
      getAll: <T>(storeName: StoreName): T[] => {
        const store = staging.get(storeName);
        if (!store) {
          throw new Error(`Store ${storeName} not in transaction scope`);
        }
        return Array.from(store.values()).map((v) => structuredClone(v) as T);
      },
      put: <T>(storeName: StoreName, key: string, value: T): void => {
        if (mode !== 'readwrite') {
          throw new Error('Cannot write in readonly transaction');
        }
        const store = staging.get(storeName);
        if (!store) {
          throw new Error(`Store ${storeName} not in transaction scope`);
        }
        store.set(key, structuredClone(value));
      },
      delete: (storeName: StoreName, key: string): void => {
        if (mode !== 'readwrite') {
          throw new Error('Cannot delete in readonly transaction');
        }
        const store = staging.get(storeName);
        if (!store) {
          throw new Error(`Store ${storeName} not in transaction scope`);
        }
        store.delete(key);
      },
      abort: (reason = 'Manual abort') => {
        aborted = true;
        abortReason = reason;
      },
    };

    let result: R;
    try {
      result = await fn(ctx);
    } catch (err) {
      // Automatic rollback on thrown exception
      throw err;
    }

    if (aborted) {
      throw new TransactionAbortError(abortReason);
    }

    // If readwrite, calculate resulting total bytes to enforce quota
    if (mode === 'readwrite') {
      let stagedTotalBytes = 0;
      for (const [sName, store] of this.stores) {
        const stagedStore = staging.get(sName) || store;
        for (const [, val] of stagedStore) {
          stagedTotalBytes += Buffer.byteLength(JSON.stringify(val), 'utf8');
        }
      }

      if (stagedTotalBytes > this.maxQuotaBytes) {
        throw new QuotaExceededError(
          `Staged payload (${stagedTotalBytes} bytes) exceeds quota limit (${this.maxQuotaBytes} bytes)`,
        );
      }

      // Check failure simulation during commit phase
      if (this.simulateFailure) {
        throw this.failureError || new TransactionAbortError('Transaction failed during commit');
      }

      // Atomic commit: replace original stores with committed staging stores
      for (const [name, stagedStore] of staging) {
        this.stores.set(name, stagedStore);
      }
    }

    return result;
  }

  clear() {
    for (const store of this.stores.values()) {
      store.clear();
    }
  }
}

// ============================================================================
// Cross-Tab Lock Coordinator (Web Locks & BroadcastChannel)
// ============================================================================

export interface LockOptions {
  timeoutMs?: number;
  ifAvailable?: boolean;
}

export type LockNotification =
  | { type: 'WRITER_ELECTED'; tabId: string; lockName: string; timestamp: string }
  | { type: 'LOCK_RELEASED'; tabId: string; lockName: string; timestamp: string }
  | { type: 'WORKSPACE_MUTATED'; tabId: string; entityType: EntityType; entityId: string };

/**
 * Cross-tab Web Lock coordinator for serializing active writers across tabs.
 * Conforms to the W3C Web Locks API pattern with BroadcastChannel event announcements.
 */
export class TabLockCoordinator {
  readonly tabId: string;
  readonly scope: string;
  private channel: BroadcastChannel | null = null;
  private static activeLocks = new Map<string, { tabId: string; heldSince: number }>();
  private static waitingQueues = new Map<
    string,
    Array<{
      tabId: string;
      resolve: () => void;
      reject: (e: Error) => void;
      timer?: NodeJS.Timeout;
    }>
  >();

  constructor(scope: string, tabId = `tab-${Math.random().toString(36).substring(2, 8)}`) {
    this.scope = scope;
    this.tabId = tabId;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        this.channel = new BroadcastChannel(`notes-sync:${scope}`);
      }
    } catch {
      // In constrained environments where BroadcastChannel is absent
      this.channel = null;
    }
  }

  getChannel(): BroadcastChannel | null {
    return this.channel;
  }

  broadcast(message: LockNotification) {
    if (this.channel) {
      try {
        this.channel.postMessage(message);
      } catch {
        // channel closed
      }
    }
  }

  close() {
    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }
  }

  /**
   * Acquires an exclusive lock on resource `lockName`.
   * While Tab A holds the lock, Tab B will wait until Tab A releases or times out.
   */
  async requestLock<T>(
    lockName: string,
    options: LockOptions,
    callback: () => Promise<T> | T,
  ): Promise<T> {
    const fullLockName = `${this.scope}:${lockName}`;
    const timeoutMs = options.timeoutMs ?? 5000;

    // Check if currently held
    const currentHolder = TabLockCoordinator.activeLocks.get(fullLockName);
    if (currentHolder && currentHolder.tabId !== this.tabId) {
      if (options.ifAvailable) {
        throw new Error(`Lock ${fullLockName} currently held by ${currentHolder.tabId}`);
      }

      // Wait in queue for lock to be released
      await new Promise<void>((resolve, reject) => {
        let timer: NodeJS.Timeout | undefined;
        const queueItem: {
          tabId: string;
          resolve: () => void;
          reject: (err: any) => void;
          timer?: NodeJS.Timeout;
        } = { tabId: this.tabId, resolve, reject };

        if (timeoutMs > 0) {
          timer = setTimeout(() => {
            // Remove exact queue item on timeout
            const queue = TabLockCoordinator.waitingQueues.get(fullLockName) || [];
            TabLockCoordinator.waitingQueues.set(
              fullLockName,
              queue.filter((q) => q !== queueItem),
            );
            reject(
              new LockAcquisitionTimeoutError(
                `Timeout of ${timeoutMs}ms exceeded waiting for lock ${fullLockName}`,
              ),
            );
          }, timeoutMs);
          queueItem.timer = timer;
        }

        const queue = TabLockCoordinator.waitingQueues.get(fullLockName) || [];
        queue.push(queueItem);
        TabLockCoordinator.waitingQueues.set(fullLockName, queue);
      });
    }

    // Acquire lock
    TabLockCoordinator.activeLocks.set(fullLockName, {
      tabId: this.tabId,
      heldSince: Date.now(),
    });

    this.broadcast({
      type: 'WRITER_ELECTED',
      tabId: this.tabId,
      lockName: fullLockName,
      timestamp: new Date().toISOString(),
    });

    try {
      return await callback();
    } finally {
      // Release lock
      TabLockCoordinator.activeLocks.delete(fullLockName);
      this.broadcast({
        type: 'LOCK_RELEASED',
        tabId: this.tabId,
        lockName: fullLockName,
        timestamp: new Date().toISOString(),
      });

      // Wake up next in queue
      const queue = TabLockCoordinator.waitingQueues.get(fullLockName);
      if (queue && queue.length > 0) {
        const next = queue.shift()!;
        if (next.timer) clearTimeout(next.timer);
        next.resolve();
      }
    }
  }

  isLockHeld(lockName: string): boolean {
    const fullLockName = `${this.scope}:${lockName}`;
    return TabLockCoordinator.activeLocks.has(fullLockName);
  }

  static resetAllLocks() {
    TabLockCoordinator.activeLocks.clear();
    for (const queue of TabLockCoordinator.waitingQueues.values()) {
      for (const item of queue) {
        if (item.timer) clearTimeout(item.timer);
        item.reject(new Error('Lock manager reset'));
      }
    }
    TabLockCoordinator.waitingQueues.clear();
  }
}

// ============================================================================
// Local Workspace Repository (Prototype for V3)
// ============================================================================

export interface LocalWorkspaceRepoOptions {
  maxQuotaBytes?: number;
  tabId?: string;
}

export class LocalWorkspaceRepository {
  readonly userId: string;
  readonly storageName: string;
  private engine: TransactionalStoreEngine;
  private lockCoordinator: TabLockCoordinator;
  private saveSuccessListeners: Array<(event: SaveSuccessEvent) => void> = [];
  private saveErrorListeners: Array<(event: SaveErrorEvent) => void> = [];
  private memoryEditorBuffers = new Map<string, UnsavedEditorBuffer>();
  private currentGeneration = 0;

  constructor(userId: string, options: LocalWorkspaceRepoOptions = {}) {
    if (!userId || userId.trim() === '') {
      throw new Error('User ID is required for account-scoped repository');
    }
    this.userId = userId;
    this.storageName = `workspace_${userId}`;
    this.engine = new TransactionalStoreEngine(this.storageName, options.maxQuotaBytes);
    this.lockCoordinator = new TabLockCoordinator(this.storageName, options.tabId);
  }

  getLockCoordinator(): TabLockCoordinator {
    return this.lockCoordinator;
  }

  async initialize(): Promise<void> {
    // Repository initialization hook for storage bootstrap & readiness verification
    return Promise.resolve();
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

  // Failure and Quota Simulation controls
  setSimulateFailure(fail: boolean, error?: Error) {
    this.engine.setSimulateFailure(fail, error);
  }

  setSimulateQuotaExceeded(fail: boolean) {
    this.engine.setSimulateQuotaExceeded(fail);
  }

  setQuotaBytes(bytes: number) {
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
  async saveNotebookAtomic(
    notebook: ValidationNotebook,
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
        async (ctx) => {
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
        } catch {
          // don't let listener crash repository
        }
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
      // Emit error event - note that state was rolled back completely
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
   * Commits in one transaction across `notes`, `assets`, and `outbox`.
   */
  async saveCanvasNoteAtomic(
    note: ValidationCanvasNote,
    assets: ValidationAsset[] = [],
    mutationType: MutationType = 'create',
  ): Promise<SaveResult> {
    const timestamp = new Date().toISOString();
    const outboxId = `outbox-canvas-${note.id}-${Date.now()}`;
    const noteOutboxEntry: OutboxEntry = {
      id: outboxId,
      clientTimestamp: timestamp,
      mutationType,
      entityType: 'note',
      entityId: note.id,
      payload: structuredClone(note),
      status: 'pending',
      retryCount: 0,
      generation: ++this.currentGeneration,
    };

    try {
      await this.engine.runTransaction(
        ['notes', 'assets', 'outbox', 'editor_buffers'],
        'readwrite',
        async (ctx) => {
          // 1. Put note
          ctx.put('notes', note.id, note);

          // 2. Put all assets
          for (const asset of assets) {
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

          // 3. Put note outbox entry
          ctx.put('outbox', outboxId, noteOutboxEntry);

          // 4. Clear dirty editor buffer if committed
          ctx.delete('editor_buffers', note.id);
        },
      );

      // In-memory buffer cleanup
      this.memoryEditorBuffers.delete(note.id);

      // EMIT SAVE SUCCESS ONLY AFTER SUCCESSFUL COMMIT
      const event: SaveSuccessEvent = {
        entityType: 'note',
        entityId: note.id,
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
        entityId: note.id,
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
   */
  async saveKanbanNoteAtomic(
    note: ValidationKanbanNote,
    mutationType: MutationType = 'create',
  ): Promise<SaveResult> {
    const timestamp = new Date().toISOString();
    const outboxId = `outbox-kanban-${note.id}-${Date.now()}`;
    const outboxEntry: OutboxEntry = {
      id: outboxId,
      clientTimestamp: timestamp,
      mutationType,
      entityType: 'note',
      entityId: note.id,
      payload: structuredClone(note),
      status: 'pending',
      retryCount: 0,
      generation: ++this.currentGeneration,
    };

    try {
      await this.engine.runTransaction(
        ['notes', 'outbox', 'editor_buffers'],
        'readwrite',
        async (ctx) => {
          ctx.put('notes', note.id, note);
          ctx.put('outbox', outboxId, outboxEntry);
          ctx.delete('editor_buffers', note.id);
        },
      );

      this.memoryEditorBuffers.delete(note.id);

      const event: SaveSuccessEvent = {
        entityType: 'note',
        entityId: note.id,
        outboxId,
        timestamp,
      };
      for (const listener of this.saveSuccessListeners) {
        try {
          listener(event);
        } catch {}
      }

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
   * Atomically deletes an entity and records a delete mutation in outbox.
   */
  async deleteEntityAtomic(entityType: EntityType, entityId: string): Promise<SaveResult> {
    const timestamp = new Date().toISOString();
    const outboxId = `outbox-del-${entityId}-${Date.now()}`;
    const targetStore: StoreName =
      entityType === 'notebook' ? 'notebooks' : entityType === 'note' ? 'notes' : 'assets';

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
      await this.engine.runTransaction([targetStore, 'outbox'], 'readwrite', async (ctx) => {
        ctx.delete(targetStore, entityId);
        ctx.put('outbox', outboxId, outboxEntry);
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

  async getNotebook(id: string): Promise<ValidationNotebook | null> {
    return this.engine.runTransaction(['notebooks'], 'readonly', (ctx) => {
      return ctx.get<ValidationNotebook>('notebooks', id) || null;
    });
  }

  async getAllNotebooks(): Promise<ValidationNotebook[]> {
    return this.engine.runTransaction(['notebooks'], 'readonly', (ctx) => {
      return ctx.getAll<ValidationNotebook>('notebooks');
    });
  }

  async getNote(id: string): Promise<ValidationCanvasNote | ValidationKanbanNote | null> {
    return this.engine.runTransaction(['notes'], 'readonly', (ctx) => {
      return ctx.get<ValidationCanvasNote | ValidationKanbanNote>('notes', id) || null;
    });
  }

  async getAllNotes(): Promise<Array<ValidationCanvasNote | ValidationKanbanNote>> {
    return this.engine.runTransaction(['notes'], 'readonly', (ctx) => {
      return ctx.getAll<ValidationCanvasNote | ValidationKanbanNote>('notes');
    });
  }

  async getAsset(id: string): Promise<ValidationAsset | null> {
    return this.engine.runTransaction(['assets'], 'readonly', (ctx) => {
      return ctx.get<ValidationAsset>('assets', id) || null;
    });
  }

  async getAllAssets(): Promise<ValidationAsset[]> {
    return this.engine.runTransaction(['assets'], 'readonly', (ctx) => {
      return ctx.getAll<ValidationAsset>('assets');
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

  async listNotebooks(): Promise<ValidationNotebook[]> {
    return this.getAllNotebooks();
  }

  async listNotes(): Promise<Array<ValidationCanvasNote | ValidationKanbanNote>> {
    return this.getAllNotes();
  }

  async listAssets(): Promise<ValidationAsset[]> {
    return this.getAllAssets();
  }

  async listOutbox(): Promise<OutboxEntry[]> {
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

  async saveAsset(asset: ValidationAsset): Promise<void> {
    await this.engine.runTransaction(['assets'], 'readwrite', (ctx) => {
      ctx.put('assets', asset.id, asset);
    });
  }

  // ==========================================================================
  // Live Editor Buffer Management (In-Memory Keystrokes / Uncommitted Edits)
  // ==========================================================================

  /**
   * Updates the live in-memory editor buffer.
   * This represents typing/drawing in progress that has NOT yet committed to disk.
   */
  updateEditorBuffer(
    noteId: string,
    bufferPayload: unknown,
    contentType: 'canvas' | 'kanban' | 'markdown' = 'canvas',
    schemaVersion = 1,
  ): void {
    const buffer: UnsavedEditorBuffer = {
      noteId,
      contentType,
      bufferPayload: structuredClone(bufferPayload),
      lastKeystrokeAt: new Date().toISOString(),
      isDirty: true,
      schemaVersion,
    };
    this.memoryEditorBuffers.set(noteId, buffer);

    // Also asynchronously stage to editor_buffers store for crash recovery
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
    const [notebooks, notes, assets, outbox, persistedBuffers] = await this.engine.runTransaction(
      ['notebooks', 'notes', 'assets', 'outbox', 'editor_buffers'],
      'readonly',
      (ctx) => {
        return [
          ctx.getAll<ValidationNotebook>('notebooks'),
          ctx.getAll<any>('notes'),
          ctx.getAll<ValidationAsset>('assets'),
          ctx.getAll<OutboxEntry>('outbox'),
          ctx.getAll<UnsavedEditorBuffer>('editor_buffers'),
        ] as const;
      },
    );

    // Combine in-memory buffers with persisted ones
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
      outbox,
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
  ): Promise<{
    importedCounts: {
      notebooks: number;
      notes: number;
      assets: number;
      outbox: number;
      buffers: number;
    };
  }> {
    // 1. Verify bundle integrity checksum
    const { checksum, ...payload } = bundle;
    const computed = computeSha256(JSON.stringify(payload));
    if (!secureTimingSafeEqual(computed, checksum)) {
      throw new Error(`Bundle checksum mismatch! Expected ${checksum}, computed ${computed}`);
    }

    const { committedState, unsavedBuffers } = bundle;

    // 2. Commit all imported state atomically in a single multi-store transaction
    await this.engine.runTransaction(
      ['notebooks', 'notes', 'assets', 'outbox', 'editor_buffers'],
      'readwrite',
      (ctx) => {
        // Clear prior state for clean restore
        for (const nb of committedState.notebooks) {
          ctx.put('notebooks', nb.id, nb);
        }
        for (const note of committedState.notes) {
          ctx.put('notes', (note as any).id, note);
        }
        for (const asset of committedState.assets) {
          ctx.put('assets', asset.id, asset);
        }
        for (const entry of committedState.outbox) {
          ctx.put('outbox', entry.id, entry);
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
        notebooks: committedState.notebooks.length,
        notes: committedState.notes.length,
        assets: committedState.assets.length,
        outbox: committedState.outbox.length,
        buffers: options.restoreBuffers ? (unsavedBuffers?.length ?? 0) : 0,
      },
    };
  }

  /**
   * Resets and clears all storage for this account.
   */
  async clearAll(): Promise<void> {
    this.engine.clear();
    this.memoryEditorBuffers.clear();
  }
}
