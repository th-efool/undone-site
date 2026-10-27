/**
 * Production Transactional IndexedDB Engine & Multi-Tab Lock Coordinator
 *
 * Conforms to Evidence Artifact E4 (Frozen Local-First & GitHub Sync Contracts):
 * - Account-scoped database: `workspace_${userId}` (rejects empty / whitespace userId)
 * - Atomic multi-store transactions: runTransaction(stores, mode, callback) with complete rollback on failure
 * - Store names: `notebooks`, `notes`, `assets`, `outbox`, `editor_buffers`, `metadata`, `conflicts`
 * - In-memory fallback for SSR/test environments or simulated quota/failure testing
 * - Single-writer TabLockCoordinator with Web Locks API (`navigator.locks.request`) and BroadcastChannel,
 *   with tested queue fallback and acquisition timeout.
 */

// ============================================================================
// Types & Contracts
// ============================================================================

import {
  computeSha256,
  secureTimingSafeEqual,
} from '@/src/shared/personal-workspace/serialization';
export { computeSha256, secureTimingSafeEqual };

export type StoreName =
  | 'notebooks'
  | 'notes'
  | 'assets'
  | 'outbox'
  | 'editor_buffers'
  | 'metadata'
  | 'conflicts'
  | 'schedules';

export const ALL_STORE_NAMES: readonly StoreName[] = [
  'notebooks',
  'notes',
  'assets',
  'outbox',
  'editor_buffers',
  'metadata',
  'conflicts',
  'schedules',
] as const;

export type EntityType = 'notebook' | 'note' | 'asset' | 'schedule';
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
  notebooks: unknown[];
  notes: unknown[];
  assets: unknown[];
  schedules?: unknown[];
  outbox: OutboxEntry[];
  conflicts?: unknown[];
  metadata?: unknown[];
}

export interface LocalStateExportBundle {
  formatVersion: '1.0.0';
  exportedAt: string;
  sourceUserId: string;
  storageName: string;
  committedState: CommittedWorkspaceState;
  unsavedBuffers: UnsavedEditorBuffer[];
  checksum: string; // SHA-256 of canonical JSON state
}

// ============================================================================
// Capability Promises Freeze Table (E4 Authoritative Contracts)
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
// Cryptographic & Byte Length Utilities
// ============================================================================

/**
 * Calculates byte length in utf8 across both Node.js and Browser environments.
 */
export function calculateObjectBytes(value: unknown): number {
  try {
    const json = JSON.stringify(value);
    if (typeof Buffer !== 'undefined' && typeof Buffer.byteLength === 'function') {
      return Buffer.byteLength(json, 'utf8');
    }
    return new TextEncoder().encode(json).length;
  } catch {
    return 0;
  }
}

// ============================================================================
// Low-Level Transaction Context
// ============================================================================

export interface TransactionContext {
  get<T>(storeName: StoreName, key: string): T | undefined;
  getAll<T>(storeName: StoreName): T[];
  put<T>(storeName: StoreName, key: string, value: T): void;
  delete(storeName: StoreName, key: string): void;
  clear(storeName: StoreName): void;
  abort(reason?: string): void;
}

export interface PersonalWorkspaceDatabaseOptions {
  maxQuotaBytes?: number;
  useMemory?: boolean;
}

// ============================================================================
// Production Transactional IndexedDB Engine
// ============================================================================

export class PersonalWorkspaceDatabase {
  readonly dbName: string;
  readonly userId: string;
  private stores: Map<StoreName, Map<string, unknown>> = new Map();
  private maxQuotaBytes: number;
  private simulateFailure = false;
  private failureError: Error | null = null;
  private simulateQuotaFailure = false;
  private useMemory: boolean;
  private idb: IDBDatabase | null = null;
  private isInitialized = false;
  private transactionQueue: Promise<void> = Promise.resolve();

  constructor(
    userIdOrDbName: string,
    options: PersonalWorkspaceDatabaseOptions = {},
  ) {
    if (!userIdOrDbName || userIdOrDbName.trim() === '') {
      throw new Error('User ID is required for account-scoped repository');
    }

    let parsedUserId: string;
    let computedDbName: string;

    if (userIdOrDbName.startsWith('workspace_')) {
      parsedUserId = userIdOrDbName.replace(/^workspace_/, '');
      if (!parsedUserId || parsedUserId.trim() === '') {
        throw new Error('User ID is required for account-scoped repository');
      }
      computedDbName = userIdOrDbName;
    } else {
      parsedUserId = userIdOrDbName;
      computedDbName = `workspace_${parsedUserId}`;
    }

    this.userId = parsedUserId;
    this.dbName = computedDbName;
    // Default 500 MiB quota threshold per Contract E4 Section 4
    this.maxQuotaBytes = options.maxQuotaBytes ?? 500 * 1024 * 1024;
    this.useMemory = options.useMemory ?? (typeof indexedDB === 'undefined');

    this.initStores();
  }

  private initStores() {
    for (const name of ALL_STORE_NAMES) {
      if (!this.stores.has(name)) {
        this.stores.set(name, new Map());
      }
    }
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    if (this.useMemory || typeof indexedDB === 'undefined') {
      this.isInitialized = true;
      return;
    }

    await new Promise<void>((resolve) => {
      try {
        const request = indexedDB.open(this.dbName, 2);

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          for (const storeName of ALL_STORE_NAMES) {
            if (!db.objectStoreNames.contains(storeName)) {
              db.createObjectStore(storeName);
            }
          }
        };

        request.onsuccess = (event) => {
          this.idb = (event.target as IDBOpenDBRequest).result;
          this.idb.onversionchange = () => {
            this.idb?.close();
            this.idb = null;
          };

          this.hydrateFromIndexedDB()
            .then(() => {
              this.isInitialized = true;
              resolve();
            })
            .catch((err) => {
              console.warn(`IndexedDB hydration warning for ${this.dbName}:`, err);
              this.isInitialized = true;
              resolve();
            });
        };

        request.onerror = () => {
          // Graceful fallback to in-memory mode if browser IndexedDB is blocked
          console.warn(`IndexedDB open failed for ${this.dbName}, continuing in memory mode`);
          this.useMemory = true;
          this.isInitialized = true;
          resolve();
        };
      } catch {
        this.useMemory = true;
        this.isInitialized = true;
        resolve();
      }
    });
  }

  private async hydrateFromIndexedDB(): Promise<void> {
    if (!this.idb) return;
    const storeNames = Array.from(this.idb.objectStoreNames) as StoreName[];
    if (storeNames.length === 0) return;

    await new Promise<void>((resolve, reject) => {
      try {
        const tx = this.idb!.transaction(storeNames, 'readonly');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error || new Error('Hydration error'));
        tx.onabort = () => reject(new Error('Hydration aborted'));

        for (const name of storeNames) {
          if (!ALL_STORE_NAMES.includes(name)) continue;
          const store = tx.objectStore(name);
          const map = this.stores.get(name) || new Map<string, unknown>();
          const req = store.openCursor();
          req.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
            if (cursor) {
              map.set(String(cursor.key), cursor.value);
              cursor.continue();
            }
          };
          this.stores.set(name, map);
        }
      } catch {
        reject(err);
      }
    });
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
        bytes += calculateObjectBytes(val);
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
    const previous = this.transactionQueue;
    let release!: () => void;
    this.transactionQueue = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await this.runTransactionExclusive(storeNames, mode, fn);
    } finally {
      release();
    }
  }

  private async runTransactionExclusive<R>(
    storeNames: StoreName[],
    mode: 'readonly' | 'readwrite',
    fn: (ctx: TransactionContext) => Promise<R> | R,
  ): Promise<R> {
    if (!this.isInitialized && !this.useMemory && typeof indexedDB !== 'undefined') {
      await this.initialize();
    }

    if (this.simulateFailure) {
      throw this.failureError || new TransactionAbortError();
    }
    if (this.simulateQuotaFailure) {
      throw new QuotaExceededError('Simulated quota exceeded before transaction');
    }

    // Prepare staging copy-on-write clone for atomic commit
    const staging = new Map<StoreName, Map<string, unknown>>();
    const stagedPuts = new Map<StoreName, Map<string, unknown>>();
    const stagedDeletions = new Map<StoreName, Set<string>>();

    for (const name of storeNames) {
      const original = this.stores.get(name) || new Map();
      staging.set(name, new Map(original));
      stagedPuts.set(name, new Map());
      stagedDeletions.set(name, new Set());
    }

    let aborted = false;
    let abortReason = 'Manual abort';

    const ctx: TransactionContext = {
      get: <T>(sName: StoreName, key: string): T | undefined => {
        const store = staging.get(sName);
        if (!store) {
          throw new Error(`Store ${sName} not in transaction scope`);
        }
        const val = store.get(key);
        return val !== undefined ? (structuredClone(val) as T) : undefined;
      },
      getAll: <T>(sName: StoreName): T[] => {
        const store = staging.get(sName);
        if (!store) {
          throw new Error(`Store ${sName} not in transaction scope`);
        }
        return Array.from(store.values()).map((v) => structuredClone(v) as T);
      },
      put: <T>(sName: StoreName, key: string, value: T): void => {
        if (mode !== 'readwrite') {
          throw new Error('Cannot write in readonly transaction');
        }
        const store = staging.get(sName);
        if (!store) {
          throw new Error(`Store ${sName} not in transaction scope`);
        }
        const cloned = structuredClone(value);
        store.set(key, cloned);
        stagedPuts.get(sName)!.set(key, cloned);
        stagedDeletions.get(sName)!.delete(key);
      },
      delete: (sName: StoreName, key: string): void => {
        if (mode !== 'readwrite') {
          throw new Error('Cannot delete in readonly transaction');
        }
        const store = staging.get(sName);
        if (!store) {
          throw new Error(`Store ${sName} not in transaction scope`);
        }
        store.delete(key);
        stagedPuts.get(sName)!.delete(key);
        stagedDeletions.get(sName)!.add(key);
      },
      clear: (sName: StoreName): void => {
        if (mode !== 'readwrite') {
          throw new Error('Cannot clear in readonly transaction');
        }
        const store = staging.get(sName);
        if (!store) {
          throw new Error(`Store ${sName} not in transaction scope`);
        }
        const deletions = stagedDeletions.get(sName)!;
        for (const key of store.keys()) deletions.add(key);
        store.clear();
        stagedPuts.get(sName)!.clear();
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

    if (mode === 'readwrite') {
      let stagedTotalBytes = 0;
      for (const [sName, store] of this.stores) {
        const stagedStore = staging.get(sName) || store;
        for (const [, val] of stagedStore) {
          stagedTotalBytes += calculateObjectBytes(val);
        }
      }

      if (stagedTotalBytes > this.maxQuotaBytes) {
        throw new QuotaExceededError(
          `Staged payload (${stagedTotalBytes} bytes) exceeds quota limit (${this.maxQuotaBytes} bytes)`,
        );
      }

      if (this.simulateFailure) {
        throw this.failureError || new TransactionAbortError('Transaction failed during commit');
      }

      // If active IndexedDB connection exists, atomically flush staged mutations to disk
      if (this.idb && !this.useMemory) {
        await new Promise<void>((resolve, reject) => {
          try {
            const tx = this.idb!.transaction(storeNames, 'readwrite');
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error || new Error('IndexedDB transaction commit failed'));
            tx.onabort = () => reject(new TransactionAbortError('IndexedDB transaction commit aborted'));

            for (const sName of storeNames) {
              const store = tx.objectStore(sName);
              const deletions = stagedDeletions.get(sName);
              if (deletions) {
                for (const key of deletions) {
                  store.delete(key);
                }
              }
              const puts = stagedPuts.get(sName);
              if (puts) {
                for (const [key, val] of puts) {
                  store.put(val, key);
                }
              }
            }
          } catch (err) {
            reject(err);
          }
        });
      }

      // Atomic commit: replace in-memory stores with staging stores only after all validations pass
      for (const [name, stagedStore] of staging) {
        this.stores.set(name, stagedStore);
      }
    }

    return result;
  }

  async clear(): Promise<void> {
    await this.runTransaction(ALL_STORE_NAMES, 'readwrite', (ctx) => {
      for (const name of ALL_STORE_NAMES) {
        ctx.clear(name);
      }
    });
  }

  async close(): Promise<void> {
    if (this.idb) {
      this.idb.close();
      this.idb = null;
    }
    this.isInitialized = false;
  }
}

/**
 * Backward compatibility alias for TransactionalStoreEngine
 */
export { PersonalWorkspaceDatabase as TransactionalStoreEngine };

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
 * Uses W3C Web Locks API (`navigator.locks.request`) when available with BroadcastChannel,
 * backed by a robust queue fallback and acquisition timeout.
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
      timer?: ReturnType<typeof setTimeout>;
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
      try {
        this.channel.close();
      } catch {}
      this.channel = null;
    }
  }

  async requestLock<T>(
    lockName: string,
    options: LockOptions,
    callback: () => Promise<T> | T,
  ): Promise<T> {
    const fullLockName = `${this.scope}:${lockName}`;
    const timeoutMs = options.timeoutMs ?? 5000;

    // Use Web Locks API if available in browser
    const hasWebLocks =
      typeof navigator !== 'undefined' &&
      typeof navigator.locks?.request === 'function';

    if (hasWebLocks) {
      return this.requestWebLock(fullLockName, options, timeoutMs, callback);
    }

    return this.requestQueueLock(fullLockName, options, timeoutMs, callback);
  }

  private async requestWebLock<T>(
    fullLockName: string,
    options: LockOptions,
    timeoutMs: number,
    callback: () => Promise<T> | T,
  ): Promise<T> {
    const currentHolder = TabLockCoordinator.activeLocks.get(fullLockName);
    if (currentHolder && currentHolder.tabId !== this.tabId) {
      if (options.ifAvailable) {
        throw new Error(`Lock ${fullLockName} currently held by ${currentHolder.tabId}`);
      }
    }

    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        controller.abort();
      }, timeoutMs);
    }

    try {
      return await navigator.locks.request(
        fullLockName,
        {
          mode: 'exclusive',
          ifAvailable: options.ifAvailable,
          signal: controller.signal,
        },
        async (lock) => {
          if (timer) clearTimeout(timer);
          if (!lock) {
            const holder = TabLockCoordinator.activeLocks.get(fullLockName);
            const holderMsg = holder ? ` by ${holder.tabId}` : '';
            throw new Error(`Lock ${fullLockName} currently held${holderMsg}`);
          }

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
            TabLockCoordinator.activeLocks.delete(fullLockName);
            this.broadcast({
              type: 'LOCK_RELEASED',
              tabId: this.tabId,
              lockName: fullLockName,
              timestamp: new Date().toISOString(),
            });
          }
        },
      );
    } catch (err: unknown) {
      if (timer) clearTimeout(timer);
      const errorObj = err as { name?: string } | undefined;
      if (errorObj?.name === 'AbortError') {
        throw new LockAcquisitionTimeoutError(
          `Timeout of ${timeoutMs}ms exceeded waiting for lock ${fullLockName}`,
        );
      }
      throw err;
    }
  }

  private async requestQueueLock<T>(
    fullLockName: string,
    options: LockOptions,
    timeoutMs: number,
    callback: () => Promise<T> | T,
  ): Promise<T> {
    const currentHolder = TabLockCoordinator.activeLocks.get(fullLockName);
    if (currentHolder && currentHolder.tabId !== this.tabId) {
      if (options.ifAvailable) {
        throw new Error(`Lock ${fullLockName} currently held by ${currentHolder.tabId}`);
      }

      await new Promise<void>((resolve, reject) => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        const queueItem: {
          tabId: string;
          resolve: () => void;
          reject: (err: Error) => void;
          timer?: ReturnType<typeof setTimeout>;
        } = { tabId: this.tabId, resolve, reject };

        if (timeoutMs > 0) {
          timer = setTimeout(() => {
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
      TabLockCoordinator.activeLocks.delete(fullLockName);
      this.broadcast({
        type: 'LOCK_RELEASED',
        tabId: this.tabId,
        lockName: fullLockName,
        timestamp: new Date().toISOString(),
      });

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
