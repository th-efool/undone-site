import { NextRequest, NextResponse } from 'next/server';
import { GitHubGitDataClient } from '@/src/server/infrastructure/github/personal-workspace';
import {
  NotebookRecord,
  NoteRecord,
  AssetRecord,
  ScheduleTaskRecord,
  WorkspaceManifest,
  ManifestAssetEntry,
} from '@/src/shared/personal-workspace/contracts';
import {
  computeSha256,
  validateAssetRecord,
  validateWorkspaceAssetDependencies,
} from '@/src/shared/personal-workspace/serialization';
import { workspaceManifestSchema } from '@/src/shared/personal-workspace/contracts';
import { resolveAuthUser, resolveCredentials } from '../vault';

async function pMap<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency = 4
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

async function handlePull(req: NextRequest): Promise<NextResponse> {
  const user = await resolveAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const credentials = await resolveCredentials(req, user.id);
  if (!credentials) {
    return NextResponse.json(
      { error: 'Not connected to GitHub personal workspace' },
      { status: 400 }
    );
  }

  try {
    const client = new GitHubGitDataClient({
      token: credentials.token,
      repoFullName: credentials.repoFullName,
    });

    const headCommitSha = await client.getRef(`refs/heads/${credentials.defaultBranch}`);
    if (!headCommitSha) {
      return NextResponse.json({
        ok: true,
        commitSha: null,
        manifest: null,
        notebooks: [],
        notes: [],
        assets: [],
      });
    }

    const commit = await client.getCommit(headCommitSha);
    if (!commit?.treeSha) {
      return NextResponse.json({
        ok: true,
        commitSha: headCommitSha,
        manifest: null,
        notebooks: [],
        notes: [],
        assets: [],
      });
    }

    const treeItems = await client.getTree(commit.treeSha, true);
    if (!treeItems || treeItems.length === 0) {
      return NextResponse.json({
        ok: true,
        commitSha: headCommitSha,
        manifest: null,
        notebooks: [],
        notes: [],
        assets: [],
      });
    }

    // 1. Fetch manifest.json if present
    const manifestItem = treeItems.find((item) => item.path === 'undone/manifest.json');
    let manifest: WorkspaceManifest | null = null;
    if (manifestItem) {
      const manifestBlob = await client.getBlob(manifestItem.sha);
      if (!manifestBlob?.contentBase64) throw new Error('Workspace manifest blob is missing');
      const jsonText = Buffer.from(manifestBlob.contentBase64, 'base64').toString('utf-8');
      const parsedManifest = workspaceManifestSchema.safeParse(JSON.parse(jsonText));
      if (!parsedManifest.success) throw new Error('Workspace manifest is invalid');
      manifest = parsedManifest.data;
      if (
        manifest.workspaceId !== user.id &&
        manifest.workspaceId !== 'local-user' &&
        user.id !== 'local-user'
      ) {
        return NextResponse.json(
          { ok: false, error: 'Repository is bound to a different Undone account' },
          { status: 409 },
        );
      }
    }

    const manifestNotebookPaths = manifest
      ? new Set(manifest.notebooks.map((entry) => entry.path))
      : null;
    const manifestNotePaths = manifest
      ? new Set(manifest.notes.map((entry) => entry.path))
      : null;

    // 2. Fetch notebooks (scoped to manifest entries when manifest is present to ignore zombie blobs)
    const notebookItems = treeItems.filter(
      (item) =>
        item.type === 'blob' &&
        item.path.startsWith('undone/notebooks/') &&
        item.path.endsWith('.json') &&
        (!manifestNotebookPaths || manifestNotebookPaths.has(item.path))
    );
    const notebooksRaw = await pMap(notebookItems, async (item) => {
      const blob = await client.getBlob(item.sha);
      if (!blob?.contentBase64) throw new Error(`Notebook blob is missing: ${item.path}`);
      return JSON.parse(Buffer.from(blob.contentBase64, 'base64').toString('utf-8')) as NotebookRecord;
    });
    const notebooks: NotebookRecord[] = notebooksRaw.filter(
      (nb): nb is NotebookRecord => nb !== null
    );

    // 3. Fetch notes (scoped to manifest entries when manifest is present to ignore zombie blobs)
    const noteItems = treeItems.filter(
      (item) =>
        item.type === 'blob' &&
        item.path.startsWith('undone/notes/') &&
        item.path.endsWith('.json') &&
        (!manifestNotePaths || manifestNotePaths.has(item.path))
    );
    const notesRaw = await pMap(noteItems, async (item) => {
      const blob = await client.getBlob(item.sha);
      if (!blob?.contentBase64) throw new Error(`Note blob is missing: ${item.path}`);
      return JSON.parse(Buffer.from(blob.contentBase64, 'base64').toString('utf-8')) as NoteRecord;
    });
    const notes: NoteRecord[] = notesRaw.filter((note): note is NoteRecord => note !== null);

    // 4. Fetch assets
    const assetItems: Array<{ item: (typeof treeItems)[number]; manifestAsset?: ManifestAssetEntry }> = manifest
      ? manifest.assets.map((entry) => {
          const item = treeItems.find((candidate) => candidate.type === 'blob' && candidate.path === entry.path);
          if (!item || item.sha !== entry.gitSha) throw new Error(`Manifest asset is missing or changed: ${entry.id}`);
          return { item, manifestAsset: entry };
        })
      : treeItems
          .filter((item) => item.type === 'blob' && item.path.startsWith('undone/assets/'))
          .map((item) => ({ item, manifestAsset: undefined }));
    const assetsRaw = await pMap(assetItems, async ({ item, manifestAsset }) => {
      const blob = await client.getBlob(item.sha);
      if (!blob?.contentBase64) throw new Error(`Asset blob is missing: ${item.path}`);
      const filename = item.path.split('/').pop() || '';
      const fallbackHash =
        filename.split('.')[0] || computeSha256(Buffer.from(blob.contentBase64, 'base64'));
      const id = manifestAsset?.id || fallbackHash;
      const hash = manifestAsset?.sha256 || fallbackHash;
      const mimeType = manifestAsset?.mimeType || 'application/octet-stream';

      const assetRecord: AssetRecord = {
        id,
        hash,
        mimeType,
        byteLength: blob.byteLength,
        base64Data: blob.contentBase64,
      };
      return validateAssetRecord(assetRecord, { isChunked: true });
    });
    const assets: AssetRecord[] = assetsRaw;
    validateWorkspaceAssetDependencies(notes, assets);

    // 5. Fetch schedules if present
    const scheduleItem = treeItems.find((item) => item.path === 'undone/schedules/tasks.json');
    let schedules: ScheduleTaskRecord[] = [];
    if (scheduleItem) {
      const schedBlob = await client.getBlob(scheduleItem.sha);
      if (schedBlob?.contentBase64) {
        try {
          const schedText = Buffer.from(schedBlob.contentBase64, 'base64').toString('utf-8');
          schedules = JSON.parse(schedText) as ScheduleTaskRecord[];
        } catch {}
      }
    }

    return NextResponse.json({
      ok: true,
      commitSha: headCommitSha,
      manifest,
      notebooks,
      notes,
      assets,
      schedules,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to pull from GitHub' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  return handlePull(req);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  return handlePull(req);
}
