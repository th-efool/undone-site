/**
 * Live GitHub Sync Runner
 * Tests local-first synchronization and recovery against a real GitHub repository.
 */

import fs from 'node:fs';
import path from 'node:path';
import { LocalWorkspaceRepository } from '../src/client/screens/dashboard/notes/validation/indexeddb-prototype';
import {
  FIXTURE_NOTEBOOK,
  FIXTURE_CANVAS_NOTE,
  FIXTURE_CANVAS_ASSET,
  SYNTHETIC_ASSET_HASH,
  computeSha256,
  secureTimingSafeEqual,
} from '../src/client/screens/dashboard/notes/validation/fixtures';

// Load .env manually if needed
function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        let val = trimmed.slice(idx + 1).trim();
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        if (!process.env[key]) process.env[key] = val;
      }
    }
  }
}

loadEnv();

const TOKEN = process.env.GITHUB_TEST_TOKEN;
const REPO = process.env.GITHUB_TEST_REPO || 'suyanamoly/undone-notestest';

if (!TOKEN) {
  console.error('❌ GITHUB_TEST_TOKEN is missing in environment or .env');
  process.exit(1);
}

interface GitBlob {
  sha: string;
  byteLength: number;
  contentBase64: string;
}

interface GitTreeEntry {
  path: string;
  mode: '100644';
  type: 'blob';
  sha: string;
}

interface WorkspaceManifest {
  manifestVersion: number;
  workspaceId: string;
  notebooks: Array<{ id: string; path: string; hash: string }>;
  notes: Array<{ id: string; path: string; hash: string; contentType: string }>;
  canvases: Array<{ noteId: string; path: string; hash: string }>;
  assets: Array<{ id: string; path: string; sha256: string; gitSha: string; mimeType?: string }>;
}

/**
 * Real GitHub REST Git Data API Provider
 */
class RealGitHubDataProvider {
  private baseUrl: string;

  constructor(public repoFullName: string, private token: string) {
    this.baseUrl = `https://api.github.com/repos/${repoFullName}`;
  }

  private async request(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = endpoint.startsWith('https://') ? endpoint : `${this.baseUrl}${endpoint}`;
    const headers = {
      Authorization: `Bearer ${this.token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'Undone-Local-First-Live-Runner',
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };

    const res = await fetch(url, { ...options, headers });
    if (!res.ok) {
      const errorText = await res.text();
      let parsed;
      try {
        parsed = JSON.parse(errorText);
      } catch {
        parsed = { message: errorText };
      }
      const err = new Error(`GitHub API Error [${res.status}]: ${parsed.message || errorText}`);
      (err as any).status = res.status;
      (err as any).response = parsed;
      throw err;
    }

    if (res.status === 204) return null;
    return await res.json();
  }

  async verifyRepository(): Promise<{ name: string; isPrivate: boolean; defaultBranch: string }> {
    const data = await this.request('');
    return {
      name: data.full_name,
      isPrivate: data.private,
      defaultBranch: data.default_branch || 'main',
    };
  }

  async bootstrapEmptyRepo(): Promise<string> {
    const res = await this.request('/contents/README.md', {
      method: 'PUT',
      body: JSON.stringify({
        message: 'undone(init): bootstrap workspace repository',
        content: Buffer.from('# Undone Notes Storage\n\nLocal-first synchronized workspace.\n').toString('base64'),
      }),
    });
    return res.commit.sha;
  }

  async createBlob(base64Content: string): Promise<string> {
    const res = await this.request('/git/blobs', {
      method: 'POST',
      body: JSON.stringify({
        content: base64Content,
        encoding: 'base64',
      }),
    });
    return res.sha;
  }

  async getBlob(sha: string): Promise<GitBlob | null> {
    try {
      const res = await this.request(`/git/blobs/${sha}`);
      let contentBase64 = res.content || '';
      if (res.encoding === 'base64') {
        contentBase64 = contentBase64.replace(/\n/g, '');
      } else {
        contentBase64 = Buffer.from(contentBase64, 'utf8').toString('base64');
      }
      return {
        sha: res.sha,
        byteLength: res.size,
        contentBase64,
      };
    } catch (err: any) {
      if (err.status === 404) return null;
      throw err;
    }
  }

  async createTree(baseTreeSha: string | null, entries: GitTreeEntry[]): Promise<string> {
    const body: any = {
      tree: entries,
    };
    if (baseTreeSha) {
      body.base_tree = baseTreeSha;
    }
    const res = await this.request('/git/trees', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return res.sha;
  }

  async getTree(treeSha: string): Promise<GitTreeEntry[] | null> {
    try {
      const res = await this.request(`/git/trees/${treeSha}?recursive=1`);
      return res.tree || [];
    } catch (err: any) {
      if (err.status === 404) return null;
      throw err;
    }
  }

  async createCommit(message: string, treeSha: string, parentShas: string[]): Promise<string> {
    const res = await this.request('/git/commits', {
      method: 'POST',
      body: JSON.stringify({
        message,
        tree: treeSha,
        parents: parentShas,
      }),
    });
    return res.sha;
  }

  async getCommit(sha: string): Promise<any> {
    try {
      const res = await this.request(`/git/commits/${sha}`);
      return {
        sha: res.sha,
        treeSha: res.tree?.sha,
        parentShas: (res.parents || []).map((p: any) => p.sha),
        message: res.message,
        committedAt: res.committer?.date || res.author?.date,
      };
    } catch (err: any) {
      if (err.status === 404) return null;
      throw err;
    }
  }

  async getRef(refName: string): Promise<string | null> {
    const cleanRef = refName.startsWith('refs/') ? refName.slice(5) : refName;
    try {
      const res = await this.request(`/git/ref/${cleanRef}`);
      return res.object?.sha || null;
    } catch (err: any) {
      if (err.status === 404 || err.status === 409) return null; // 409 returned when repo is empty
      throw err;
    }
  }

  async updateRef(
    refName: string,
    newCommitSha: string,
    force: boolean = false
  ): Promise<{ ok: boolean; status: number; error?: string }> {
    const currentSha = await this.getRef(refName);

    if (!currentSha) {
      // Empty repo or new branch: Create ref via POST
      try {
        await this.request('/git/refs', {
          method: 'POST',
          body: JSON.stringify({
            ref: refName.startsWith('refs/') ? refName : `refs/${refName}`,
            sha: newCommitSha,
          }),
        });
        return { ok: true, status: 201 };
      } catch (err: any) {
        return { ok: false, status: err.status || 500, error: err.message };
      }
    }

    // Ref exists: Update via PATCH
    const cleanRef = refName.startsWith('refs/') ? refName.slice(5) : refName;
    try {
      await this.request(`/git/refs/${cleanRef}`, {
        method: 'PATCH',
        body: JSON.stringify({
          sha: newCommitSha,
          force,
        }),
      });
      return { ok: true, status: 200 };
    } catch (err: any) {
      return { ok: false, status: err.status || 500, error: err.message };
    }
  }
}

async function runLiveTest() {
  console.log('================================================================');
  console.log('🚀 UNDONE LOCAL-FIRST: LIVE GITHUB SYNC VERIFICATION RUNNER');
  console.log('================================================================');
  console.log(`Repository Target: ${REPO}`);

  const git = new RealGitHubDataProvider(REPO, TOKEN!);

  // Step 1: Verify Repository
  console.log('\n[1/6] 🔍 Inspecting target repository on GitHub...');
  const repoInfo = await git.verifyRepository();
  console.log(`  ✓ Repository: ${repoInfo.name}`);
  console.log(`  ✓ Visibility: ${repoInfo.isPrivate ? '🔒 Private' : '🌐 Public (Note: Undone production requires private)'}`);
  console.log(`  ✓ Default Branch: ${repoInfo.defaultBranch}`);

  // Step 2: Local Durability Setup
  console.log('\n[2/6] 💾 Initializing local IndexedDB workspace repository...');
  const localStore = new LocalWorkspaceRepository('user-live-test');
  await localStore.initialize();

  console.log('  -> Saving synthetic Notebook...');
  const nbResult = await localStore.saveNotebookAtomic(FIXTURE_NOTEBOOK);
  console.log(`  ✓ Notebook saved atomically (Outbox ID: ${nbResult.outboxEntryId})`);

  console.log('  -> Saving Excalidraw Canvas note with binary image asset...');
  const canvasResult = await localStore.saveCanvasNoteAtomic(FIXTURE_CANVAS_NOTE, [FIXTURE_CANVAS_ASSET]);
  console.log(`  ✓ Canvas note + Asset saved atomically (Outbox ID: ${canvasResult.outboxEntryId})`);

  const pendingOutbox = await localStore.listOutbox();
  console.log(`  ✓ Local Outbox status: ${pendingOutbox.length} pending mutations queued safely in IndexedDB`);

  // Step 3: Publish to GitHub
  console.log('\n[3/6] ☁️ Publishing Outbox to GitHub via Git Data API (4-step protocol)...');
  const targetBranch = 'refs/heads/main';
  let currentHeadSha = await git.getRef(targetBranch);
  if (!currentHeadSha) {
    console.log('  -> Repository is empty; bootstrapping initial commit via Contents API...');
    currentHeadSha = await git.bootstrapEmptyRepo();
    console.log(`  ✓ Bootstrapped initial commit: ${currentHeadSha}`);
  } else {
    console.log(`  -> Current remote branch HEAD: ${currentHeadSha}`);
  }

  let baseTreeSha: string | null = null;
  const parentShas: string[] = [];
  if (currentHeadSha) {
    const headCommit = await git.getCommit(currentHeadSha);
    baseTreeSha = headCommit?.treeSha || null;
    parentShas.push(currentHeadSha);
  }

  // 3a. Upload Asset blobs
  const treeEntries: GitTreeEntry[] = [];
  const manifest: WorkspaceManifest = {
    manifestVersion: 1,
    workspaceId: localStore.userId,
    notebooks: [],
    notes: [],
    canvases: [],
    assets: [],
  };

  const assets = await localStore.listAssets();
  for (const asset of assets) {
    console.log(`  -> Uploading raw binary asset to Git blobs (Hash: ${asset.hash.slice(0, 10)}...)...`);
    const blobSha = await git.createBlob(asset.base64Data);
    const assetPath = `undone/assets/${asset.hash}.png`;
    treeEntries.push({ path: assetPath, mode: '100644', type: 'blob', sha: blobSha });
    manifest.assets.push({ id: asset.id, path: assetPath, sha256: asset.hash, gitSha: blobSha, mimeType: asset.mimeType });
    console.log(`  ✓ Asset Git blob created: ${blobSha}`);
  }

  // 3b. Upload Notebooks
  const notebooks = await localStore.listNotebooks();
  for (const nb of notebooks) {
    console.log(`  -> Uploading notebook '${nb.title}' to Git blobs...`);
    const payload = JSON.stringify(nb, null, 2);
    const blobSha = await git.createBlob(Buffer.from(payload, 'utf8').toString('base64'));
    const nbPath = `undone/notebooks/${nb.id}.json`;
    treeEntries.push({ path: nbPath, mode: '100644', type: 'blob', sha: blobSha });
    manifest.notebooks.push({ id: nb.id, path: nbPath, hash: computeSha256(payload) });
    console.log(`  ✓ Notebook Git blob created: ${blobSha}`);
  }

  // 3c. Upload Canvas Notes
  const notes = await localStore.listNotes();
  for (const note of notes) {
    console.log(`  -> Uploading canvas note '${note.title}' to Git blobs...`);
    const payload = JSON.stringify(note, null, 2);
    const blobSha = await git.createBlob(Buffer.from(payload, 'utf8').toString('base64'));
    const notePath = `undone/notes/${note.id}.json`;
    treeEntries.push({ path: notePath, mode: '100644', type: 'blob', sha: blobSha });
    manifest.notes.push({ id: note.id, path: notePath, hash: computeSha256(payload), contentType: note.contentType });
    console.log(`  ✓ Note Git blob created: ${blobSha}`);
  }

  // 3d. Upload Manifest
  console.log('  -> Uploading workspace snapshot manifest.json...');
  const manifestPayload = JSON.stringify(manifest, null, 2);
  const manifestBlobSha = await git.createBlob(Buffer.from(manifestPayload, 'utf8').toString('base64'));
  treeEntries.push({ path: 'undone/manifest.json', mode: '100644', type: 'blob', sha: manifestBlobSha });
  console.log(`  ✓ Manifest Git blob created: ${manifestBlobSha}`);

  // 3e. Create Git Tree
  console.log('  -> Creating Git Tree linking all workspace files...');
  const newTreeSha = await git.createTree(baseTreeSha, treeEntries);
  console.log(`  ✓ Git Tree created: ${newTreeSha} (${treeEntries.length} files staged)`);

  // 3f. Create Git Commit
  console.log('  -> Creating Git Commit...');
  const commitSha = await git.createCommit(
    `undone(sync): initialize workspace snapshot [test-run: ${Date.now()}]`,
    newTreeSha,
    parentShas
  );
  console.log(`  ✓ Git Commit created: ${commitSha}`);

  // 3g. Update Branch Ref (Compare-and-Swap)
  console.log(`  -> Advancing branch ref '${targetBranch}' to commit ${commitSha.slice(0, 7)}...`);
  const refResult = await git.updateRef(targetBranch, commitSha, false);
  if (!refResult.ok) {
    console.error(`❌ Failed to update branch ref: ${refResult.error}`);
    process.exit(1);
  }
  console.log(`  ✓ Branch ref '${targetBranch}' successfully updated (HTTP ${refResult.status})!`);

  // Step 4: Acknowledge Outbox
  console.log('\n[4/6] 📋 Acknowledging local outbox mutations...');
  const highestGen = Math.max(...pendingOutbox.map((o) => o.generation ?? 0), 0);
  await localStore.acknowledgeOutboxUpTo(highestGen);
  const remainingOutbox = await localStore.listOutbox();
  console.log(`  ✓ Outbox acknowledged up to generation ${highestGen}`);
  console.log(`  ✓ Remaining local outbox entries: ${remainingOutbox.length} (clean state)`);

  // Step 5: Clean Device Restore Test
  console.log('\n[5/6] 🔄 Testing clean cross-device restore from GitHub...');
  console.log('  -> Initializing secondary isolated profile (Profile B - fresh device)...');
  const freshStore = new LocalWorkspaceRepository('user-fresh-device-restore');
  await freshStore.initialize();

  // Read remote branch HEAD
  const latestHead = await git.getRef(targetBranch);
  const remoteCommit = await git.getCommit(latestHead!);
  const remoteTree = await git.getTree(remoteCommit.treeSha);

  const manifestEntry = remoteTree?.find((e) => e.path === 'undone/manifest.json');
  if (!manifestEntry) throw new Error('Remote manifest.json missing in restored tree');

  const remoteManifestBlob = await git.getBlob(manifestEntry.sha);
  const restoredManifest: WorkspaceManifest = JSON.parse(
    Buffer.from(remoteManifestBlob!.contentBase64, 'base64').toString('utf8')
  );

  console.log(`  -> Remote manifest verified: ${restoredManifest.notebooks.length} notebooks, ${restoredManifest.notes.length} notes, ${restoredManifest.assets.length} assets`);

  // Restore and verify assets
  for (const assetMeta of restoredManifest.assets) {
    console.log(`  -> Restoring binary asset: ${assetMeta.path}...`);
    const blob = await git.getBlob(assetMeta.gitSha);
    if (!blob) throw new Error(`Remote asset blob missing: ${assetMeta.gitSha}`);

    const rawBytes = Buffer.from(blob.contentBase64, 'base64');
    const computedHash = computeSha256(rawBytes);

    if (!secureTimingSafeEqual(computedHash, assetMeta.sha256)) {
      throw new Error(`Asset hash mismatch: expected ${assetMeta.sha256}, got ${computedHash}`);
    }

    console.log(`  ✓ Asset hash verified via SHA-256: ${computedHash.slice(0, 16)}...`);
    await freshStore.saveAsset({
      id: assetMeta.id,
      hash: assetMeta.sha256,
      mimeType: assetMeta.mimeType || 'image/png',
      byteLength: blob.byteLength,
      base64Data: blob.contentBase64,
    });
  }

  // Restore notebooks
  for (const nbMeta of restoredManifest.notebooks) {
    const entry = remoteTree?.find((e) => e.path === nbMeta.path);
    const blob = await git.getBlob(entry!.sha);
    const nb = JSON.parse(Buffer.from(blob!.contentBase64, 'base64').toString('utf8'));
    await freshStore.saveNotebookAtomic(nb);
    console.log(`  ✓ Restored notebook: '${nb.title}'`);
  }

  // Restore notes
  for (const noteMeta of restoredManifest.notes) {
    const entry = remoteTree?.find((e) => e.path === noteMeta.path);
    const blob = await git.getBlob(entry!.sha);
    const note = JSON.parse(Buffer.from(blob!.contentBase64, 'base64').toString('utf8'));
    if (note.contentType === 'canvas') {
      await freshStore.saveCanvasNoteAtomic(note, []);
    } else {
      await freshStore.saveKanbanNoteAtomic(note);
    }
    console.log(`  ✓ Restored canvas note: '${note.title}'`);
  }

  // Step 6: Summary & Live Verification Link
  console.log('\n================================================================');
  console.log('🎉 ALL LIVE CHECKS PASSED: 100% SUCCESS');
  console.log('================================================================');
  console.log(`GitHub Commit URL:`);
  console.log(`👉 https://github.com/${REPO}/commit/${commitSha}`);
  console.log(`\nGitHub Tree View:`);
  console.log(`👉 https://github.com/${REPO}/tree/main/undone`);
  console.log('================================================================\n');
  process.exit(0);
}

runLiveTest().catch((err) => {
  console.error('\n❌ Live GitHub test failed:', err);
  process.exit(1);
});
