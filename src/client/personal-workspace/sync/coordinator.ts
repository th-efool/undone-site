/**
 * Production Personal Workspace Client Sync Coordinator
 *
 * Implements client-side synchronization between local IndexedDB and remote GitHub repository.
 * Conforms to Evidence Artifact E4 (Frozen Local-First & GitHub Sync Contracts):
 * - Guarantees offline-first durability: local writes succeed immediately and durably.
 * - Atomic CAS publication: checks expected remote commit SHA before pushing trees.
 * - Conflict branching: on CAS divergence, remote conflicts are branched into explicit local copies
 *   so zero user edits are ever lost.
 * - Outbox lifecycle: acknowledges pending outbox batches upon verified remote commit.
 * - Auto-sync coordination: online/offline window listeners and periodic background sync.
 */

import type {
  SyncStatus,
  SyncSummary,
  NotebookRecord,
  NoteRecord,
  AssetRecord,
  ScheduleTaskRecord,
  OutboxMutation,
  OutboxEntry,
  WorkspaceManifest,
} from '@/src/shared/personal-workspace/contracts';
import {
  assetRecordSchema,
  noteRecordSchema,
  notebookRecordSchema,
  scheduleTaskRecordSchema,
  workspaceManifestSchema,
} from '@/src/shared/personal-workspace/contracts';
import { canonicalJsonStringify, computeSha256, validateAssetRecord } from '@/src/shared/personal-workspace/serialization';
import type { PersonalWorkspaceRepository } from '../local/repository';

export interface SyncCoordinatorOptions {
  autoSyncIntervalMs?: number;
  baseUrl?: string;
  fetchFn?: typeof fetch;
}

export interface SyncResult {
  ok: boolean;
  status: SyncStatus;
  newCommitSha?: string;
  conflict?: boolean;
  conflictCount?: number;
  error?: string;
}

export interface RemotePullState {
  notebooks?: NotebookRecord[];
  notes?: NoteRecord[];
  assets?: AssetRecord[];
  schedules?: ScheduleTaskRecord[];
}

export interface RemotePullResponse {
  ok?: boolean;
  commitSha?: string | null;
  manifest?: WorkspaceManifest | null;
  remoteCommitSha?: string;
  currentRemoteCommitSha?: string;
  state?: RemotePullState;
  notes?: NoteRecord[];
  notebooks?: NotebookRecord[];
  assets?: AssetRecord[];
  schedules?: ScheduleTaskRecord[];
  error?: string;
}

export interface RemoteStatusResponse {
  ok?: boolean;
  connected?: boolean;
  repoFullName?: string;
  defaultBranch?: string;
  lastCommitSha?: string;
  headSha?: string;
  error?: string;
}

export interface RemotePublishResponse {
  ok?: boolean;
  newCommitSha?: string;
  conflict?: boolean;
  currentRemoteCommitSha?: string;
  error?: string;
}

export interface IWorkspaceSyncRepository {
  userId?: string;
  storageName?: string;
  getPendingOutbox?(): Promise<OutboxEntry[]>;
  getPendingOutboxMutations?(): Promise<OutboxEntry[]>;
  acknowledgeOutboxBatch?(batchEntryIds: string[]): Promise<void>;
  acknowledgePublishedBatch(batchEntryIds: string[], remoteCommitSha: string): Promise<void>;
  acknowledgeOutboxUpTo?(generation: number): Promise<void>;
  getRemoteBaseCommitSha(): Promise<string | null>;
  applyRemoteSnapshot(
    snapshot: Required<RemotePullState>,
    remoteCommitSha: string | null,
  ): Promise<void>;
  getSyncSnapshot(): Promise<{
    notebooks: NotebookRecord[];
    notes: NoteRecord[];
    assets: AssetRecord[];
    schedules: ScheduleTaskRecord[];
    outbox: OutboxEntry[];
  }>;
  getAllNotebooks<T = NotebookRecord>(): Promise<T[]>;
  getAllNotes<T = NoteRecord>(): Promise<T[]>;
  getAllAssets<T = AssetRecord>(): Promise<T[]>;
  saveCanvasNoteAtomic?<TNote extends { id: string } = NoteRecord, TAsset extends { id: string } = AssetRecord>(
    note: TNote,
    referencedAssets?: TAsset[],
    mutationType?: 'create' | 'update' | 'delete',
  ): Promise<{ ok: boolean }>;
  saveKanbanNoteAtomic?<T extends { id: string } = NoteRecord>(
    note: T,
    mutationType?: 'create' | 'update' | 'delete',
  ): Promise<{ ok: boolean }>;
  saveNoteAtomic?<T extends { id: string; contentType?: string } = NoteRecord>(
    note: T,
    mutationType?: 'create' | 'update' | 'delete',
    referencedAssets?: Array<{ id: string }>,
  ): Promise<{ ok: boolean }>;
  getDatabase?(): {
    runTransaction<T>(
      storeNames: string[],
      mode: 'readonly' | 'readwrite',
      callback: (ctx: {
        get<V>(store: string, key: string): V | undefined;
        getAll<V>(store: string): V[];
        put(store: string, key: string, value: unknown): void;
        delete(store: string, key: string): void;
      }) => Promise<T> | T,
    ): Promise<T>;
  };
}

class ReconnectRequiredError extends Error {}

function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export class SyncCoordinator {
  public status: SyncStatus = 'idle';
  public lastSyncedAt: string | null = null;
  public lastRemoteCommitSha: string | null = null;
  public isSyncing = false;
  public conflictCount = 0;
  public errorMessage?: string;

  private readonly repo: IWorkspaceSyncRepository;
  private readonly autoSyncIntervalMs: number;
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;

  private subscribers = new Set<(summary: SyncSummary) => void>();
  private autoSyncTimer: ReturnType<typeof setInterval> | null = null;
  private onlineHandler: (() => void) | null = null;
  private offlineHandler: (() => void) | null = null;
  private visibilityHandler: (() => void) | null = null;
  private focusHandler: (() => void) | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private retryAttempt = 0;

  private activeSyncPromise: Promise<SyncResult> | null = null;
  private queuedSyncPromise: Promise<SyncResult> | null = null;

  constructor(
    repo: PersonalWorkspaceRepository | IWorkspaceSyncRepository,
    options: SyncCoordinatorOptions = {},
  ) {
    this.repo = repo;
    this.autoSyncIntervalMs = options.autoSyncIntervalMs ?? 30000;
    this.baseUrl = options.baseUrl ?? '';
    this.fetchFn = options.fetchFn ?? ((...args) => globalThis.fetch(...args));
  }

  /**
   * Retrieves pending outbox mutations from repository.
   */
  private async getPendingMutations(): Promise<OutboxMutation[]> {
    if (typeof this.repo.getPendingOutboxMutations === 'function') {
      return (await this.repo.getPendingOutboxMutations()) as OutboxMutation[];
    }
    if (typeof this.repo.getPendingOutbox === 'function') {
      return (await this.repo.getPendingOutbox()) as OutboxMutation[];
    }
    return [];
  }

  private async getLocalSnapshot() {
    return this.repo.getSyncSnapshot();
  }

  private verifyRemotePullData(data: RemotePullResponse): {
    snapshot: Required<RemotePullState>;
    commitSha: string | null;
    hasManifest: boolean;
  } {
    const notebooks = data.notebooks;
    const notes = data.notes;
    const assets = data.assets;
    const schedules = data.schedules ?? [];
    if (
      data.ok !== true ||
      (data.commitSha !== null && typeof data.commitSha !== 'string') ||
      !Array.isArray(notebooks) ||
      !Array.isArray(notes) ||
      !Array.isArray(assets) ||
      !Array.isArray(schedules)
    ) {
      throw new Error('Remote pull returned an incomplete workspace snapshot');
    }

    const manifest = data.manifest;
    if (manifest) {
      const parsedManifest = workspaceManifestSchema.safeParse(manifest);
      if (
        data.commitSha === null ||
        !parsedManifest.success
      ) {
        throw new Error('Remote workspace manifest is invalid');
      }
      const verifiedManifest = parsedManifest.data;
      const parsedNotebooks = notebookRecordSchema.array().safeParse(notebooks);
      const parsedNotes = noteRecordSchema.array().safeParse(notes);
      const parsedAssets = assetRecordSchema.array().safeParse(assets);
      const parsedSchedules = scheduleTaskRecordSchema.array().safeParse(schedules);
      if (!parsedNotebooks.success || !parsedNotes.success || !parsedAssets.success || !parsedSchedules.success) {
        throw new Error('Remote workspace contains an invalid record');
      }
      if (
        verifiedManifest.notebooks.length !== notebooks.length ||
        verifiedManifest.notes.length !== notes.length ||
        verifiedManifest.assets.length !== assets.length ||
        (verifiedManifest.schedules?.length ?? 0) !== (schedules.length ? 1 : 0)
      ) {
        throw new Error('Remote workspace manifest does not match its records');
      }
      const hashesMatch = <T extends { id: string }>(
        records: T[],
        entries: Array<{ id: string; hash: string }>,
      ) => records.every((record) => {
        const entry = entries.find((candidate) => candidate.id === record.id);
        return entry?.hash === computeSha256(canonicalJsonStringify(record));
      });
      if (
        !hashesMatch(parsedNotebooks.data, verifiedManifest.notebooks) ||
        !hashesMatch(parsedNotes.data, verifiedManifest.notes)
      ) {
        throw new Error('Remote workspace record hashes do not match its manifest');
      }
      const assetsById = new Map(verifiedManifest.assets.map((entry) => [entry.id, entry]));
      for (const asset of parsedAssets.data) {
        validateAssetRecord(asset);
        if (assetsById.get(asset.id)?.sha256 !== asset.hash) {
          throw new Error('Remote asset hash does not match its manifest');
        }
      }
      if (schedules.length) {
        const taskEntry = verifiedManifest.schedules?.[0];
        if (
          verifiedManifest.schedules?.length !== 1 ||
          taskEntry?.id !== 'tasks' ||
          taskEntry.hash !== computeSha256(canonicalJsonStringify(schedules))
        ) {
          throw new Error('Remote schedule hash does not match its manifest');
        }
      }
    } else if (
      (data.commitSha === null && (notebooks.length || notes.length || assets.length || schedules.length)) ||
      (data.commitSha !== null && (notebooks.length || notes.length || assets.length || schedules.length))
    ) {
      throw new Error('Remote workspace records have no verifiable manifest');
    }

    return {
      snapshot: { notebooks, notes, assets, schedules },
      commitSha: data.commitSha ?? null,
      hasManifest: Boolean(manifest),
    };
  }

  private async applyVerifiedRemoteSnapshot(verified: ReturnType<SyncCoordinator['verifyRemotePullData']>): Promise<string | null> {
    const local = await this.getLocalSnapshot();
    const hasCleanRecords = (
      entityType: OutboxMutation['entityType'],
      records: Array<{ id: string }>,
    ) => {
      const dirtyIds = new Set(local.outbox
        .filter((mutation) => mutation.entityType === entityType)
        .map((mutation) => mutation.entityId));
      return records.some((record) => !dirtyIds.has(record.id));
    };
    if (
      !verified.hasManifest &&
      (hasCleanRecords('notebook', local.notebooks) || hasCleanRecords('note', local.notes) ||
        hasCleanRecords('asset', local.assets) || hasCleanRecords('schedule', local.schedules))
    ) {
      throw new Error('Connected repository has no Undone workspace manifest; local notes were preserved');
    }

    await this.repo.applyRemoteSnapshot(verified.snapshot, verified.commitSha);
    this.lastRemoteCommitSha = verified.commitSha;
    return this.lastRemoteCommitSha;
  }

  private async pullAndApplyRemoteSnapshot(): Promise<string | null> {
    const response = await this.fetchFn(`${this.baseUrl}/api/personal-workspace/github/pull`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (response.status === 401 || response.status === 403) {
      throw new ReconnectRequiredError('GitHub authorization expired or was revoked');
    }
    if (!response.ok) throw new Error(`Remote pull returned HTTP ${response.status}`);
    const verified = this.verifyRemotePullData((await response.json()) as RemotePullResponse);
    return this.applyVerifiedRemoteSnapshot(verified);
  }

  /**
   * Subscribes a listener to sync state updates.
   * Immediately delivers current summary to new listener.
   */
  subscribe(listener: (summary: SyncSummary) => void): () => void {
    this.subscribers.add(listener);
    try {
      listener(this.getCurrentSummary());
    } catch {}
    return () => {
      this.subscribers.delete(listener);
    };
  }

  /**
   * Returns current synchronous snapshot of sync state.
   */
  getCurrentSummary(): SyncSummary {
    return {
      status: this.status,
      pendingMutations: 0,
      lastSyncedAt: this.lastSyncedAt,
      conflictCount: this.conflictCount,
      errorMessage: this.errorMessage,
    };
  }

  /**
   * Returns authoritative sync summary including pending outbox depth.
   */
  async getSummary(): Promise<SyncSummary> {
    let pendingMutations = 0;
    try {
      const mutations = await this.getPendingMutations();
      pendingMutations = mutations.length;
    } catch {}

    return {
      status: this.status,
      pendingMutations,
      lastSyncedAt: this.lastSyncedAt,
      conflictCount: this.conflictCount,
      errorMessage: this.errorMessage,
    };
  }

  /**
   * Broadcasts sync state update to all registered listeners.
   */
  private async broadcastUpdate(): Promise<void> {
    const summary = await this.getSummary();
    for (const listener of this.subscribers) {
      try {
        listener(summary);
      } catch {}
    }
  }

  /**
   * Synchronizes local workspace mutations with remote GitHub repository.
   * Handles CAS concurrency, conflict branching, and atomic outbox acknowledgement.
   */
  async syncNow(): Promise<SyncResult> {
    // 1. Check if already syncing: queue or await current
    if (this.isSyncing && this.activeSyncPromise) {
      if (!this.queuedSyncPromise) {
        this.queuedSyncPromise = this.activeSyncPromise.then(() => {
          this.queuedSyncPromise = null;
          return this.syncNow();
        });
      }
      return this.queuedSyncPromise;
    }

    this.isSyncing = true;
    this.activeSyncPromise = this.executeSync();
    try {
      const result = await this.activeSyncPromise;
      if (result.ok) {
        this.retryAttempt = 0;
        if (this.retryTimer) clearTimeout(this.retryTimer);
        this.retryTimer = null;
      } else if (result.status === 'error') {
        this.scheduleRetry();
      }
      return result;
    } finally {
      this.isSyncing = false;
      this.activeSyncPromise = null;
    }
  }

  private scheduleRetry(): void {
    if (this.retryTimer || this.retryAttempt >= 5) return;
    const delay = Math.min(1000 * 2 ** this.retryAttempt, 30000);
    this.retryAttempt += 1;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      if (typeof navigator === 'undefined' || navigator.onLine) void this.syncNow();
    }, delay);
  }

  private async executeSync(): Promise<SyncResult> {
    try {
      // 2. Check connection status via GET /api/personal-workspace/github/status
      const statusUrl = `${this.baseUrl}/api/personal-workspace/github/status`;
      let statusRes: Response;
      try {
        statusRes = await this.fetchFn(statusUrl, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (networkErr) {
        this.status = 'error';
        this.errorMessage =
          networkErr instanceof Error ? networkErr.message : 'Network failure during status check';
        await this.broadcastUpdate();
        return { ok: false, status: this.status, error: this.errorMessage };
      }

      if (statusRes.status === 401 || statusRes.status === 403) {
        this.status = 'reconnect_required';
        this.errorMessage = 'GitHub authentication expired or revoked';
        await this.broadcastUpdate();
        return { ok: false, status: this.status, error: 'Not connected' };
      }

      if (!statusRes.ok) {
        this.status = 'error';
        this.errorMessage = `Status check returned HTTP ${statusRes.status}`;
        await this.broadcastUpdate();
        return { ok: false, status: this.status, error: 'Not connected' };
      }

      const statusData = (await statusRes.json()) as RemoteStatusResponse;
      if (!statusData.connected || statusData.ok === false) {
        this.status = 'reconnect_required';
        this.errorMessage = statusData.error || 'Repository is not connected';
        await this.broadcastUpdate();
        return { ok: false, status: this.status, error: 'Not connected' };
      }

      this.status = 'syncing';
      this.errorMessage = undefined;
      await this.broadcastUpdate();

      if (this.lastRemoteCommitSha === null) {
        this.lastRemoteCommitSha = await this.repo.getRemoteBaseCommitSha();
      }

      // Pull every cycle, including empty-outbox cycles, so remote-only changes appear without reload.
      await this.pullAndApplyRemoteSnapshot();
      const snapshot = await this.getLocalSnapshot();
      const mutations = snapshot.outbox;

      if (mutations.length === 0) {
        this.lastSyncedAt = new Date().toISOString();
        this.status = 'synced';
        this.errorMessage = undefined;
        await this.broadcastUpdate();
        return { ok: true, status: 'synced', newCommitSha: this.lastRemoteCommitSha ?? undefined };
      }

      const publishUrl = `${this.baseUrl}/api/personal-workspace/github/publish`;
      const publishPayload = {
        expectedRemoteCommitSha: this.lastRemoteCommitSha,
        mutations,
        state: {
          notebooks: snapshot.notebooks,
          notes: snapshot.notes,
          assets: snapshot.assets,
          schedules: snapshot.schedules,
        },
      };

      let publishRes: Response;
      try {
        publishRes = await this.fetchFn(publishUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(publishPayload),
        });
      } catch (pubErr) {
        this.status = 'error';
        this.errorMessage =
          pubErr instanceof Error ? pubErr.message : 'Network failure during publish';
        await this.broadcastUpdate();
        return { ok: false, status: this.status, error: this.errorMessage };
      }

      let publishData: RemotePublishResponse | null = null;
      try {
        publishData = (await publishRes.json()) as RemotePublishResponse;
      } catch {
        publishData = null;
      }

      // 6. If server returns { ok: true, newCommitSha }
      if (publishRes.ok && publishData?.ok && publishData.newCommitSha) {
        const batchEntryIds = mutations.map((m) => m.id);

        await this.repo.acknowledgePublishedBatch(batchEntryIds, publishData.newCommitSha);

        this.lastRemoteCommitSha = publishData.newCommitSha;
        this.lastSyncedAt = new Date().toISOString();
        this.status = 'synced';
        this.errorMessage = undefined;
        await this.broadcastUpdate();
        return { ok: true, status: 'synced', newCommitSha: publishData.newCommitSha };
      }

      // 7. If server returns CAS conflict (status 422, 409, or conflict: true)
      const isConflict =
        publishRes.status === 422 || publishRes.status === 409 || publishData?.conflict === true;

      if (isConflict) {
        return await this.handleCasConflict(snapshot.notes, mutations);
      }

      if (publishRes.status === 401 || publishRes.status === 403) {
        this.status = 'reconnect_required';
        this.errorMessage = 'GitHub authentication expired or was revoked';
        await this.broadcastUpdate();
        return { ok: false, status: this.status, error: this.errorMessage };
      }

      // Other failure response
      this.status = 'error';
      this.errorMessage =
        publishData?.error || `Remote publish failed with HTTP ${publishRes.status}`;
      await this.broadcastUpdate();
      return { ok: false, status: this.status, error: this.errorMessage };
    } catch (unexpectedError) {
      if (unexpectedError instanceof ReconnectRequiredError) {
        this.status = 'reconnect_required';
        this.errorMessage = unexpectedError.message;
        await this.broadcastUpdate();
        return { ok: false, status: this.status, error: this.errorMessage };
      }
      this.status = 'error';
      this.errorMessage =
        unexpectedError instanceof Error ? unexpectedError.message : String(unexpectedError);
      await this.broadcastUpdate();
      return { ok: false, status: this.status, error: this.errorMessage };
    }
  }

  /**
   * Handles CAS Divergence: pulls remote state, detects modified note overlaps,
   * branches conflicting notes into explicit local copies with human-readable titles,
   * updates conflictCount, and advances lastRemoteCommitSha.
   */
  private async handleCasConflict(
    localNotes: NoteRecord[],
    pendingMutations: OutboxMutation[],
  ): Promise<SyncResult> {
    const pullUrl = `${this.baseUrl}/api/personal-workspace/github/pull`;
    let pullRes: Response;
    try {
      pullRes = await this.fetchFn(pullUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expectedRemoteCommitSha: this.lastRemoteCommitSha,
        }),
      });
    } catch (pullErr) {
      this.status = 'error';
      this.errorMessage =
        pullErr instanceof Error ? pullErr.message : 'Failed to pull remote state during conflict';
      await this.broadcastUpdate();
      return { ok: false, status: this.status, error: this.errorMessage };
    }

    if (!pullRes.ok) {
      if (pullRes.status === 401 || pullRes.status === 403) {
        this.status = 'reconnect_required';
        this.errorMessage = 'GitHub authentication expired or was revoked';
        await this.broadcastUpdate();
        return { ok: false, status: this.status, error: this.errorMessage };
      }
      this.status = 'error';
      this.errorMessage = `Pull failed with HTTP ${pullRes.status}`;
      await this.broadcastUpdate();
      return { ok: false, status: this.status, error: this.errorMessage };
    }

    const verified = this.verifyRemotePullData((await pullRes.json()) as RemotePullResponse);
    await this.applyVerifiedRemoteSnapshot(verified);
    const remoteNotes = verified.snapshot.notes;
    const currentRemoteCommitSha = verified.commitSha;

    // Detect note IDs locally modified in pending outbox
    const localModifiedNoteIds = new Set(
      pendingMutations.filter((m) => m.entityType === 'note').map((m) => m.entityId),
    );

    let conflictsCreated = 0;

    for (const remoteNote of remoteNotes) {
      if (localModifiedNoteIds.has(remoteNote.id)) {
        // Both local and remote have modified this note since last sync:
        // Create an explicit branched conflict copy locally
        const conflictNoteId = generateUuid();
        const conflictTime = new Date().toLocaleTimeString();
        const conflictTitle = `${remoteNote.title} (Remote Conflict ${conflictTime})`;

        const conflictCopyNote: NoteRecord = {
          ...remoteNote,
          id: conflictNoteId,
          title: conflictTitle,
          updatedAt: new Date().toISOString(),
        };

        // Save conflict copy to local repo so zero user edits are ever lost!
        if (typeof this.repo.saveNoteAtomic === 'function') {
          await this.repo.saveNoteAtomic(conflictCopyNote, 'create');
        } else if (
          conflictCopyNote.contentType === 'canvas' &&
          typeof this.repo.saveCanvasNoteAtomic === 'function'
        ) {
          await this.repo.saveCanvasNoteAtomic(conflictCopyNote, [], 'create');
        } else if (typeof this.repo.saveKanbanNoteAtomic === 'function') {
          await this.repo.saveKanbanNoteAtomic(conflictCopyNote, 'create');
        } else if (typeof this.repo.getDatabase === 'function') {
          await this.repo.getDatabase()!.runTransaction(['notes'], 'readwrite', (ctx) => {
            ctx.put('notes', conflictCopyNote.id, conflictCopyNote);
          });
        }

        // Record in conflicts store
        if (typeof this.repo.getDatabase === 'function') {
          try {
            await this.repo.getDatabase()!.runTransaction(['conflicts'], 'readwrite', (ctx) => {
              ctx.put('conflicts', conflictNoteId, {
                id: conflictNoteId,
                originalNoteId: remoteNote.id,
                conflictCopyId: conflictNoteId,
                detectedAt: new Date().toISOString(),
                remoteCommitSha: currentRemoteCommitSha,
              });
            });
          } catch {}
        }

        conflictsCreated++;
      }
    }

    this.conflictCount += conflictsCreated;
    this.status = 'conflict';
    this.errorMessage = `Sync conflict: ${conflictsCreated} branched conflict ${
      conflictsCreated === 1 ? 'copy' : 'copies'
    } created`;
    await this.broadcastUpdate();
    return {
      ok: false,
      status: 'conflict',
      conflict: true,
      conflictCount: this.conflictCount,
      error: this.errorMessage,
    };
  }

  /**
   * Starts periodic background synchronization and listens to online/offline network changes.
   */
  startAutoSync(): void {
    if (this.autoSyncTimer !== null) return;

    if (typeof window !== 'undefined') {
      this.onlineHandler = () => {
        if (this.retryTimer) clearTimeout(this.retryTimer);
        this.retryTimer = null;
        if (this.status === 'offline') {
          this.status = 'idle';
          void this.broadcastUpdate();
        }
        void this.syncNow();
      };

      this.offlineHandler = () => {
        this.status = 'offline';
        void this.broadcastUpdate();
      };

      window.addEventListener('online', this.onlineHandler);
      window.addEventListener('offline', this.offlineHandler);

      this.visibilityHandler = () => {
        if (document.visibilityState === 'visible') void this.syncNow();
      };
      this.focusHandler = () => void this.syncNow();
      document.addEventListener('visibilitychange', this.visibilityHandler);
      window.addEventListener('focus', this.focusHandler);
    }

    this.autoSyncTimer = setInterval(() => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return;
      }
      void this.syncNow();
    }, this.autoSyncIntervalMs);
  }

  /**
   * Stops background synchronization and cleans up browser listeners.
   */
  stopAutoSync(): void {
    if (this.autoSyncTimer !== null) {
      clearInterval(this.autoSyncTimer);
      this.autoSyncTimer = null;
    }
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }

    if (typeof window !== 'undefined') {
      if (this.onlineHandler) {
        window.removeEventListener('online', this.onlineHandler);
        this.onlineHandler = null;
      }
      if (this.offlineHandler) {
        window.removeEventListener('offline', this.offlineHandler);
        this.offlineHandler = null;
      }
      if (this.focusHandler) {
        window.removeEventListener('focus', this.focusHandler);
        this.focusHandler = null;
      }
      if (this.visibilityHandler) {
        document.removeEventListener('visibilitychange', this.visibilityHandler);
        this.visibilityHandler = null;
      }
    }
  }

  /**
   * Disposes coordinator and all active timers and subscriptions.
   */
  dispose(): void {
    this.stopAutoSync();
    this.subscribers.clear();
  }
}
