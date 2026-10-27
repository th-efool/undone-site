import { NextRequest, NextResponse } from 'next/server';
import { GitHubGitDataClient } from '@/src/server/infrastructure/github/personal-workspace';
import {
  NotebookRecord,
  NoteRecord,
  AssetRecord,
  WorkspaceManifest,
} from '@/src/shared/personal-workspace/contracts';
import { computeSha256 } from '@/src/shared/personal-workspace/serialization';
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
      if (manifestBlob?.contentBase64) {
        try {
          const jsonText = Buffer.from(manifestBlob.contentBase64, 'base64').toString('utf-8');
          manifest = JSON.parse(jsonText) as WorkspaceManifest;
        } catch {
          // Corrupt manifest file
        }
      }
    }

    // 2. Fetch notebooks
    const notebookItems = treeItems.filter(
      (item) =>
        item.type === 'blob' &&
        item.path.startsWith('undone/notebooks/') &&
        item.path.endsWith('.json')
    );
    const notebooksRaw = await pMap(notebookItems, async (item) => {
      const blob = await client.getBlob(item.sha);
      if (!blob?.contentBase64) return null;
      try {
        const text = Buffer.from(blob.contentBase64, 'base64').toString('utf-8');
        return JSON.parse(text) as NotebookRecord;
      } catch {
        return null;
      }
    });
    const notebooks: NotebookRecord[] = notebooksRaw.filter(
      (nb): nb is NotebookRecord => nb !== null
    );

    // 3. Fetch notes
    const noteItems = treeItems.filter(
      (item) =>
        item.type === 'blob' &&
        item.path.startsWith('undone/notes/') &&
        item.path.endsWith('.json')
    );
    const notesRaw = await pMap(noteItems, async (item) => {
      const blob = await client.getBlob(item.sha);
      if (!blob?.contentBase64) return null;
      try {
        const text = Buffer.from(blob.contentBase64, 'base64').toString('utf-8');
        return JSON.parse(text) as NoteRecord;
      } catch {
        return null;
      }
    });
    const notes: NoteRecord[] = notesRaw.filter((note): note is NoteRecord => note !== null);

    // 4. Fetch assets
    const assetItems = treeItems.filter(
      (item) => item.type === 'blob' && item.path.startsWith('undone/assets/')
    );
    const assetsRaw = await pMap(assetItems, async (item) => {
      const blob = await client.getBlob(item.sha);
      if (!blob?.contentBase64) return null;

      const manifestAsset = manifest?.assets?.find(
        (a) => a.path === item.path || a.gitSha === item.sha
      );
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
      return assetRecord;
    });
    const assets: AssetRecord[] = assetsRaw.filter((a): a is AssetRecord => a !== null);

    return NextResponse.json({
      ok: true,
      commitSha: headCommitSha,
      manifest,
      notebooks,
      notes,
      assets,
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
