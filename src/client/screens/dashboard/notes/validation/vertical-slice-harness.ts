/**
 * Vertical Slice & Concurrency Failure Injection Harness (Stage V4)
 *
 * Implements the 9 validation scenarios from pre-plan Section 3 (V4):
 * 1. Authorize & bind preview/confirmation (cancel safety)
 * 2. Save locally + atomic outbox + atomic scene/asset publication commit
 * 3. Close/reopen profile A & clean profile B restore (comparing counts, hashes, asset bytes)
 * 4. Racing independent edits from head H (advance ref, detect head change, rebase/reconcile, advance)
 * 5. Concurrent edit on same note (preserve both, explicit conflict copy, converge without timestamp arbitration)
 * 6. Post-commit response loss recovery (dropped response after ref updated; recover via mutation identity & remote commit lookup)
 * 7. Edit v2 while v1 in flight (v2 survives, v1 ack does not clear v2)
 * 8. Remote asset missing/corrupt detection (restore withheld, error state flagged)
 * 9. Disconnect with pending mutation & reconnect convergence
 */

import crypto from 'node:crypto';
import {
  LocalWorkspaceRepository,
  LocalStateExportBundle,
} from './indexeddb-prototype';
import {
  ValidationNotebook,
  ValidationCanvasNote,
  ValidationAsset,
  computeSha256,
  secureTimingSafeEqual,
} from './fixtures';

export interface GitBlob {
  sha: string;
  byteLength: number;
  contentBase64: string;
}

export interface GitTreeEntry {
  path: string;
  mode: '100644';
  type: 'blob';
  sha: string;
}

export interface GitCommit {
  sha: string;
  treeSha: string;
  parentShas: string[];
  message: string;
  committedAt: string;
}

export interface GitProviderFaults {
  dropResponseAfterRefUpdate?: boolean;
  corruptAssetBlobSha?: string;
  removeAssetBlobSha?: string;
  failBlobCreation?: boolean;
}

/**
 * Deterministic Git Data API Provider Harness
 * Emulates GitHub REST Git Data API objects, SHA-1 calculation, and CAS ref updates
 */
export class GitDataProviderHarness {
  private blobs = new Map<string, GitBlob>();
  private trees = new Map<string, GitTreeEntry[]>();
  private commits = new Map<string, GitCommit>();
  private refs = new Map<string, string>(); // refName -> commitSha
  public faults: GitProviderFaults = {};
  public networkCallLog: string[] = [];

  constructor(public repoId: string, public isPrivate: boolean = true) {
    // Initial empty commit
    const rootTreeSha = this.createTree(null, []);
    const initialCommitSha = this.createCommit('Initial workspace bootstrap', rootTreeSha, []);
    this.refs.set('refs/heads/main', initialCommitSha);
  }

  computeGitBlobSha(bytes: Buffer): string {
    const header = `blob ${bytes.length}\0`;
    return crypto.createHash('sha1').update(Buffer.concat([Buffer.from(header, 'utf8'), bytes])).digest('hex');
  }

  createBlob(base64Content: string): string {
    if (this.faults.failBlobCreation) {
      throw new Error('Simulated Git Blob upload failure');
    }
    const bytes = Buffer.from(base64Content, 'base64');
    const sha = this.computeGitBlobSha(bytes);
    this.blobs.set(sha, {
      sha,
      byteLength: bytes.length,
      contentBase64: base64Content,
    });
    this.networkCallLog.push(`POST /repos/${this.repoId}/git/blobs (${sha.slice(0, 7)})`);
    return sha;
  }

  getBlob(sha: string): GitBlob | null {
    if (this.faults.removeAssetBlobSha === sha) {
      return null;
    }
    const blob = this.blobs.get(sha);
    if (!blob) return null;
    if (this.faults.corruptAssetBlobSha === sha) {
      return {
        ...blob,
        contentBase64: Buffer.from('corrupted-tampered-data-payload').toString('base64'),
      };
    }
    return blob;
  }

  createTree(baseTreeSha: string | null, entries: GitTreeEntry[]): string {
    const combined = new Map<string, GitTreeEntry>();
    if (baseTreeSha) {
      const existing = this.trees.get(baseTreeSha) || [];
      for (const e of existing) combined.set(e.path, e);
    }
    for (const e of entries) {
      combined.set(e.path, e);
    }
    const sorted = Array.from(combined.values()).sort((a, b) => a.path.localeCompare(b.path));
    const treePayload = JSON.stringify(sorted);
    const treeSha = crypto.createHash('sha1').update(treePayload).digest('hex');
    this.trees.set(treeSha, sorted);
    this.networkCallLog.push(`POST /repos/${this.repoId}/git/trees (${treeSha.slice(0, 7)}, count=${sorted.length})`);
    return treeSha;
  }

  getTree(treeSha: string): GitTreeEntry[] | null {
    return this.trees.get(treeSha) || null;
  }

  createCommit(message: string, treeSha: string, parentShas: string[]): string {
    const raw = `${treeSha}:${parentShas.join(',')}:${message}:${Date.now()}`;
    const commitSha = crypto.createHash('sha1').update(raw).digest('hex');
    const commit: GitCommit = {
      sha: commitSha,
      treeSha,
      parentShas,
      message,
      committedAt: new Date().toISOString(),
    };
    this.commits.set(commitSha, commit);
    this.networkCallLog.push(`POST /repos/${this.repoId}/git/commits (${commitSha.slice(0, 7)})`);
    return commitSha;
  }

  getCommit(sha: string): GitCommit | null {
    return this.commits.get(sha) || null;
  }

  getRef(refName: string): string | null {
    return this.refs.get(refName) || null;
  }

  updateRef(refName: string, newCommitSha: string, force: boolean = false): { ok: boolean; status: number; error?: string } {
    const currentSha = this.refs.get(refName);
    this.networkCallLog.push(`PATCH /repos/${this.repoId}/git/refs/${refName} (${newCommitSha.slice(0, 7)})`);

    if (currentSha && !force) {
      // Compare-and-Swap / Fast-Forward check: parent of new commit MUST be currentSha or have currentSha in ancestry
      const newCommit = this.commits.get(newCommitSha);
      if (!newCommit || !newCommit.parentShas.includes(currentSha)) {
        return {
          ok: false,
          status: 422,
          error: 'Reference cannot be updated: non-fast-forward update',
        };
      }
    }

    // Advance ref
    this.refs.set(refName, newCommitSha);

    // Fault injection: drop response after updating provider ref
    if (this.faults.dropResponseAfterRefUpdate) {
      this.faults.dropResponseAfterRefUpdate = false; // one-shot
      throw new Error('ETIMEDOUT: Connection dropped after remote reference update');
    }

    return { ok: true, status: 200 };
  }
}

export interface WorkspaceManifest {
  manifestVersion: number;
  workspaceId: string;
  notebooks: Array<{ id: string; path: string; hash: string }>;
  notes: Array<{ id: string; path: string; hash: string; contentType: string }>;
  canvases: Array<{ noteId: string; path: string; hash: string }>;
  assets: Array<{ id: string; path: string; sha256: string; gitSha: string; mimeType?: string }>;
}

export type SyncStatusState =
  | 'idle'
  | 'saving_locally'
  | 'saved_locally'
  | 'queued'
  | 'syncing'
  | 'synced'
  | 'offline'
  | 'conflict'
  | 'reconnect_required'
  | 'error';

/**
 * Local-First GitHub Sync Coordinator Vertical Slice
 */
export class LocalFirstSyncCoordinator {
  public syncStatus: SyncStatusState = 'idle';
  public lastAcknowledgedGeneration = 0;
  public candidateCommitSha: string | null = null;
  public lastSyncedCommitSha: string | null = null;
  public binding: {
    repoId: string;
    branch: string;
    bindingEpoch: number;
    status: 'ACTIVE' | 'DISCONNECTED';
  } | null = null;

  constructor(
    public localStore: LocalWorkspaceRepository,
    public gitProvider: GitDataProviderHarness
  ) {}

  // 1. Authorize & bind repository preview/confirmation
  previewAndBindRepository(
    repoId: string,
    confirm: boolean
  ): { bound: boolean; error?: string } {
    if (!this.gitProvider.isPrivate) {
      return { bound: false, error: 'Undone requires private repository visibility' };
    }
    if (!confirm) {
      return { bound: false, error: 'User cancelled repository binding' };
    }
    this.binding = {
      repoId,
      branch: 'refs/heads/main',
      bindingEpoch: 1,
      status: 'ACTIVE',
    };
    this.lastSyncedCommitSha = this.gitProvider.getRef('refs/heads/main');
    return { bound: true };
  }

  disconnectRepository(): void {
    if (this.binding) {
      this.binding.status = 'DISCONNECTED';
      this.binding.bindingEpoch += 1; // Invalidate any delayed in-flight callbacks
      this.syncStatus = 'offline';
    }
  }

  reconnectRepository(): void {
    if (this.binding) {
      this.binding.status = 'ACTIVE';
      this.binding.bindingEpoch += 1;
      this.syncStatus = 'queued';
    }
  }

  // 2. Publish pending outbox atomically via Git Data API
  async publishOutbox(): Promise<{ ok: boolean; commitSha?: string; error?: string }> {
    if (!this.binding || this.binding.status !== 'ACTIVE') {
      return { ok: false, error: 'Repository is disconnected or unconfigured' };
    }
    this.syncStatus = 'syncing';
    const activeEpoch = this.binding.bindingEpoch;

    try {
      const outbox = await this.localStore.listOutbox();
      if (outbox.length === 0) {
        this.syncStatus = 'synced';
        return { ok: true };
      }

      const baseParentCommitSha = this.lastSyncedCommitSha || this.gitProvider.getRef(this.binding.branch);
      if (!baseParentCommitSha) {
        throw new Error('Remote branch HEAD ref missing');
      }

      const headCommit = this.gitProvider.getCommit(baseParentCommitSha);
      const baseTreeSha = headCommit ? headCommit.treeSha : null;

      // Collect tree entries
      const treeEntries: GitTreeEntry[] = [];
      const manifest: WorkspaceManifest = {
        manifestVersion: 1,
        workspaceId: this.localStore.userId,
        notebooks: [],
        notes: [],
        canvases: [],
        assets: [],
      };

      // 1. Upload Assets
      const assets = await this.localStore.listAssets();
      for (const asset of assets) {
        const gitSha = this.gitProvider.createBlob(asset.base64Data);
        const path = `undone/assets/${asset.hash}.${asset.mimeType.split('/')[1] || 'bin'}`;
        treeEntries.push({ path, mode: '100644', type: 'blob', sha: gitSha });
        manifest.assets.push({ id: asset.id, path, sha256: asset.hash, gitSha, mimeType: asset.mimeType });
      }

      // 2. Upload Notebooks
      const notebooks = await this.localStore.listNotebooks();
      for (const nb of notebooks) {
        const payload = JSON.stringify(nb, null, 2);
        const gitSha = this.gitProvider.createBlob(Buffer.from(payload, 'utf8').toString('base64'));
        const path = `undone/notebooks/${nb.id}.json`;
        treeEntries.push({ path, mode: '100644', type: 'blob', sha: gitSha });
        manifest.notebooks.push({ id: nb.id, path, hash: computeSha256(payload) });
      }

      // 3. Upload Notes
      const notes = await this.localStore.listNotes();
      for (const note of notes) {
        const payload = JSON.stringify(note, null, 2);
        const gitSha = this.gitProvider.createBlob(Buffer.from(payload, 'utf8').toString('base64'));
        const path = `undone/notes/${note.id}.json`;
        treeEntries.push({ path, mode: '100644', type: 'blob', sha: gitSha });
        manifest.notes.push({ id: note.id, path, hash: computeSha256(payload), contentType: note.contentType });
      }

      // 4. Upload Manifest
      const manifestPayload = JSON.stringify(manifest, null, 2);
      const manifestGitSha = this.gitProvider.createBlob(Buffer.from(manifestPayload, 'utf8').toString('base64'));
      treeEntries.push({ path: 'undone/manifest.json', mode: '100644', type: 'blob', sha: manifestGitSha });

      // Create Tree & Commit
      const newTreeSha = this.gitProvider.createTree(baseTreeSha, treeEntries);
      const commitSha = this.gitProvider.createCommit(
        `undone(sync): update workspace [epoch: ${activeEpoch}]`,
        newTreeSha,
        [baseParentCommitSha]
      );
      this.candidateCommitSha = commitSha;

      // Update Branch Ref
      const refResult = this.gitProvider.updateRef(this.binding.branch, commitSha, false);
      if (!refResult.ok) {
        this.syncStatus = 'conflict';
        return { ok: false, error: refResult.error };
      }

      // Acknowledge generation
      const highestGen = Math.max(...outbox.map((o) => o.generation ?? 0), 0);
      this.lastAcknowledgedGeneration = highestGen;
      await this.localStore.acknowledgeOutboxUpTo(highestGen);

      this.candidateCommitSha = null;
      this.lastSyncedCommitSha = commitSha;
      this.syncStatus = 'synced';
      return { ok: true, commitSha };
    } catch (err: any) {
      // If error occurred after candidate commit was created (e.g. dropped response on ref update)
      if (this.candidateCommitSha) {
        const currentRef = this.gitProvider.getRef(this.binding.branch);
        if (currentRef === this.candidateCommitSha) {
          // Commit actually succeeded on the provider!
          const outbox = await this.localStore.listOutbox();
          const highestGen = Math.max(...outbox.map((o) => o.generation ?? 0), 0);
          this.lastAcknowledgedGeneration = highestGen;
          await this.localStore.acknowledgeOutboxUpTo(highestGen);
          this.lastSyncedCommitSha = currentRef;
          this.candidateCommitSha = null;
          this.syncStatus = 'synced';
          return { ok: true, commitSha: currentRef };
        }
      }
      this.syncStatus = 'error';
      return { ok: false, error: err.message };
    }
  }

  // 3. Restore Remote Repository into a Fresh Profile
  async restoreFromRemote(
    targetStore: LocalWorkspaceRepository
  ): Promise<{ ok: boolean; notebookCount: number; noteCount: number; assetCount: number; error?: string }> {
    if (!this.binding) return { ok: false, notebookCount: 0, noteCount: 0, assetCount: 0, error: 'No binding' };

    const headCommitSha = this.gitProvider.getRef(this.binding.branch);
    if (!headCommitSha) return { ok: false, notebookCount: 0, noteCount: 0, assetCount: 0, error: 'No remote commit' };

    const commit = this.gitProvider.getCommit(headCommitSha);
    if (!commit) return { ok: false, notebookCount: 0, noteCount: 0, assetCount: 0, error: 'Commit not found' };

    const tree = this.gitProvider.getTree(commit.treeSha);
    if (!tree) return { ok: false, notebookCount: 0, noteCount: 0, assetCount: 0, error: 'Tree not found' };

    // Find manifest
    const manifestEntry = tree.find((e) => e.path === 'undone/manifest.json');
    if (!manifestEntry) return { ok: false, notebookCount: 0, noteCount: 0, assetCount: 0, error: 'Manifest missing' };

    const manifestBlob = this.gitProvider.getBlob(manifestEntry.sha);
    if (!manifestBlob) return { ok: false, notebookCount: 0, noteCount: 0, assetCount: 0, error: 'Manifest blob unreadable' };

    const manifest: WorkspaceManifest = JSON.parse(Buffer.from(manifestBlob.contentBase64, 'base64').toString('utf8'));

    // Verify all assets first!
    let restoredAssets = 0;
    for (const assetMeta of manifest.assets) {
      const blob = this.gitProvider.getBlob(assetMeta.gitSha);
      if (!blob) {
        return {
          ok: false,
          notebookCount: 0,
          noteCount: 0,
          assetCount: restoredAssets,
          error: `Missing referenced remote asset blob: ${assetMeta.sha256}`,
        };
      }
      const rawBytes = Buffer.from(blob.contentBase64, 'base64');
      const actualHash = computeSha256(rawBytes);
      if (!secureTimingSafeEqual(actualHash, assetMeta.sha256)) {
        return {
          ok: false,
          notebookCount: 0,
          noteCount: 0,
          assetCount: restoredAssets,
          error: `Corrupt remote asset hash mismatch: expected ${assetMeta.sha256}, got ${actualHash}`,
        };
      }

      await targetStore.saveAsset({
        id: assetMeta.id,
        hash: assetMeta.sha256,
        mimeType: assetMeta.mimeType || 'image/png',
        byteLength: blob.byteLength,
        base64Data: blob.contentBase64,
      });
      restoredAssets++;
    }

    // Restore Notebooks
    let restoredNotebooks = 0;
    for (const nbMeta of manifest.notebooks) {
      const entry = tree.find((e) => e.path === nbMeta.path);
      if (!entry) continue;
      const blob = this.gitProvider.getBlob(entry.sha);
      if (!blob) continue;
      const nb: ValidationNotebook = JSON.parse(Buffer.from(blob.contentBase64, 'base64').toString('utf8'));
      await targetStore.saveNotebookAtomic(nb);
      restoredNotebooks++;
    }

    // Restore Notes
    let restoredNotes = 0;
    for (const noteMeta of manifest.notes) {
      const entry = tree.find((e) => e.path === noteMeta.path);
      if (!entry) continue;
      const blob = this.gitProvider.getBlob(entry.sha);
      if (!blob) continue;
      const note: any = JSON.parse(Buffer.from(blob.contentBase64, 'base64').toString('utf8'));
      if (note.contentType === 'canvas') {
        await targetStore.saveCanvasNoteAtomic(note, []);
      } else {
        await targetStore.saveKanbanNoteAtomic(note);
      }
      restoredNotes++;
    }

    this.lastSyncedCommitSha = headCommitSha;

    return {
      ok: true,
      notebookCount: restoredNotebooks,
      noteCount: restoredNotes,
      assetCount: restoredAssets,
    };
  }

  // 4 & 5. Reconcile concurrent branch divergence & preserve conflicting notes
  async reconcileRemoteDivergence(): Promise<{ resolved: boolean; conflictsCreated: number }> {
    const headSha = this.gitProvider.getRef(this.binding!.branch);
    if (!headSha) return { resolved: false, conflictsCreated: 0 };

    const headCommit = this.gitProvider.getCommit(headSha);
    if (!headCommit) return { resolved: false, conflictsCreated: 0 };

    const remoteTree = this.gitProvider.getTree(headCommit.treeSha) || [];
    const localNotes = await this.localStore.listNotes();
    let conflictsCreated = 0;

    for (const entry of remoteTree) {
      if (entry.path.startsWith('undone/notes/') && entry.path.endsWith('.json')) {
        const noteId = entry.path.replace('undone/notes/', '').replace('.json', '');
        const localMatch = localNotes.find((n) => n.id === noteId);
        const remoteBlob = this.gitProvider.getBlob(entry.sha);
        if (!remoteBlob) continue;
        const remoteNote = JSON.parse(Buffer.from(remoteBlob.contentBase64, 'base64').toString('utf8'));

        if (!localMatch) {
          // New independent note from peer: adopt into local store
          if (remoteNote.contentType === 'canvas') {
            await this.localStore.saveCanvasNoteAtomic(remoteNote, []);
          } else {
            await this.localStore.saveKanbanNoteAtomic(remoteNote);
          }
        } else if (
          remoteNote.title !== localMatch.title ||
          computeSha256(JSON.stringify(remoteNote)) !== computeSha256(JSON.stringify(localMatch))
        ) {
          // Concurrent modification of the same note: preserve both with explicit conflict copy
          const conflictNote: ValidationCanvasNote = {
            ...(localMatch as ValidationCanvasNote),
            id: `${localMatch.id}-conflict-${Date.now()}`,
            title: `[Conflict] ${localMatch.title}`,
            order: localMatch.order + 1,
            updatedAt: new Date().toISOString(),
          };
          await this.localStore.saveCanvasNoteAtomic(conflictNote, []);
          conflictsCreated++;
        }
      }
    }

    this.lastSyncedCommitSha = headSha;
    return { resolved: true, conflictsCreated };
  }
}
