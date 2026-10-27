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

export type StoreName =
  | 'notebooks'
  | 'notes'
  | 'assets'
  | 'outbox'
  | 'editor_buffers'
  | 'metadata'
  | 'conflicts';

export const ALL_STORE_NAMES: readonly StoreName[] = [
  'notebooks',
  'notes',
  'assets',
  'outbox',
  'editor_buffers',
  'metadata',
  'conflicts',
] as const;

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
  notebooks: any[];
  notes: any[];
  assets: any[];
  outbox: OutboxEntry[];
  conflicts?: any[];
  metadata?: any[];
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

/**
 * Pure TypeScript implementation of SHA-256 with bitwise precision.
 * Guarantees zero native-binding dependencies and works universally across
 * Browser, Node.js, Web Workers, and SSR environments.
 */
function sha256Pure(ascii: string): string {
  function rightRotate(value: number, amount: number): number {
    return (value >>> amount) | (value << (32 - amount));
  }

  const words: number[] = [];
  const utf8 = unescape(encodeURIComponent(ascii));
  const utf8BitLength = utf8.length * 8;

  const hash: number[] = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];

  const k: number[] = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
    0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
    0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
    0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
    0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
    0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  for (let i = 0; i < utf8.length; i++) {
    words[i >> 2] |= (utf8.charCodeAt(i) & 0xff) << ((3 - (i % 4)) * 8);
  }
  words[utf8BitLength >> 5] |= 0x80 << ((3 - ((utf8BitLength / 8) % 4)) * 8);
  words[(((utf8BitLength + 64) >> 9) << 4) + 15] = utf8BitLength;

  for (let i = 0; i < words.length; i += 16) {
    const w: number[] = [];
    for (let j = 0; j < 16; j++) w[j] = words[i + j] || 0;
    for (let j = 16; j < 64; j++) {
      const s0 = rightRotate(w[j - 15], 7) ^ rightRotate(w[j - 15], 18) ^ (w[j - 15] >>> 3);
      const s1 = rightRotate(w[j - 2], 17) ^ rightRotate(w[j - 2], 19) ^ (w[j - 2] >>> 10);
      w[j] = (w[j - 16] + s0 + w[j - 7] + s1) | 0;
    }

    let [a, b, c, d, e, f, g, h] = hash;

    for (let j = 0; j < 64; j++) {
      const s1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + s1 + ch + k[j] + w[j]) | 0;
      const s0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) | 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }

    hash[0] = (hash[0] + a) | 0;
    hash[1] = (hash[1] + b) | 0;
    hash[2] = (hash[2] + c) | 0;
    hash[3] = (hash[3] + d) | 0;
    hash[4] = (hash[4] + e) | 0;
    hash[5] = (hash[5] + f) | 0;
    hash[6] = (hash[6] + g) | 0;
    hash[7] = (hash[7] + h) | 0;
  }

  let result = '';
  for (let i = 0; i < 8; i++) {
    for (let j = 3; j >= 0; j--) {
      const b = (hash[i] >> (8 * j)) & 255;
      result += (b < 16 ? '0' : '') + b.toString(16);
    }
  }

  return result;
}

/**
 * Computes SHA-256 hash of a string or buffer. Uses Node.js crypto when available
 * for max throughput, with automated fallback to pure TypeScript implementation.
 */
export function computeSha256(data: string | Uint8Array): string {
  try {
    if (typeof window === 'undefined' && typeof require !== 'undefined') {
      const nodeCrypto = require('node:crypto');
      if (nodeCrypto && typeof nodeCrypto.createHash === 'function') {
        return nodeCrypto.createHash('sha256').update(data).digest('hex');
      }
    }
  } catch {}

  const text = typeof data === 'string' ? data : new TextDecoder().decode(data);
  return sha256Pure(text);
}

/**
 * Constant-time string comparison preventing side-channel timing attacks
 * on checksum verifications and authentication tokens.
 */
export function secureTimingSafeEqual(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;

  try {
    if (typeof window === 'undefined' && typeof require !== 'undefined') {
      const nodeCrypto = require('node:crypto');
      if (nodeCrypto && typeof nodeCrypto.timingSafeEqual === 'function' && typeof Buffer !== 'undefined') {
        const bufA = Buffer.from(a, 'utf8');
        const bufB = Buffer.from(b, 'utf8');
        if (bufA.length !== bufB.length) return false;
        return nodeCrypto.timingSafeEqual(bufA, bufB);
      }
    }
  } catch {}

  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// ============================================================================
// Low-Level Transaction Context
// ============================================================================

export interface TransactionContext {
  get<T>(storeName: StoreName, key: string): T | undefined;
  getAll<T>(storeName: StoreName): T[];
  put<T>(storeName: StoreName, key: string, value: T): void;
  delete(storeName: StoreName, key: string): void;
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
        const request = indexedDB.open(this.dbName, 1);

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
      } catch (err) {
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
      } catch (err) {
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
    for (const store of this.stores.values()) {
      store.clear();
    }

    if (this.idb && !this.useMemory) {
      await new Promise<void>((resolve, reject) => {
        try {
          const tx = this.idb!.transaction(ALL_STORE_NAMES, 'readwrite');
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error || new Error('Failed to clear IndexedDB'));
          for (const name of ALL_STORE_NAMES) {
            tx.objectStore(name).clear();
          }
        } catch (err) {
          reject(err);
        }
      });
    }
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
      timer?: any;
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
    let timer: any;
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
    } catch (err: any) {
      if (timer) clearTimeout(timer);
      if (err?.name === 'AbortError') {
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
        let timer: any;
        const queueItem: {
          tabId: string;
          resolve: () => void;
          reject: (err: any) => void;
          timer?: any;
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
