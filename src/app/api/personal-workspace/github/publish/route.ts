import { NextRequest, NextResponse } from 'next/server';
import {
  GitHubGitDataClient,
  TreeEntryInput,
} from '@/src/server/infrastructure/github/personal-workspace';
import {
  NotebookRecord,
  NoteRecord,
  AssetRecord,
  ScheduleTaskRecord,
  OutboxMutation,
  WorkspaceManifest,
  ManifestNotebookEntry,
  ManifestNoteEntry,
  ManifestCanvasEntry,
  ManifestAssetEntry,
  ManifestScheduleEntry,
} from '@/src/shared/personal-workspace/contracts';
import {
  canonicalJsonStringify,
  computeSha256,
} from '@/src/shared/personal-workspace/serialization';
import { getExtensionForMimeType } from '@/src/shared/personal-workspace/media';
import { resolveAuthUser, resolveCredentials } from '../vault';

interface PublishRequestBody {
  expectedRemoteCommitSha?: string | null;
  mutations?: OutboxMutation[];
  state?: {
    notebooks?: NotebookRecord[];
    notes?: NoteRecord[];
    assets?: AssetRecord[];
    schedules?: ScheduleTaskRecord[];
  };
}

export async function POST(req: NextRequest): Promise<NextResponse> {
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

  let body: PublishRequestBody;
  try {
    body = (await req.json()) as PublishRequestBody;
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON request body' },
      { status: 400 }
    );
  }

  if (!body || !body.state) {
    return NextResponse.json(
      { error: 'Invalid publish request: missing state' },
      { status: 400 }
    );
  }

  const notebooks = body.state.notebooks || [];
  const notes = body.state.notes || [];
  const assets = body.state.assets || [];

  try {
    const client = new GitHubGitDataClient({
      token: credentials.token,
      repoFullName: credentials.repoFullName,
    });

    const treeEntries: TreeEntryInput[] = [];
    const manifestNotebooks: ManifestNotebookEntry[] = [];
    const manifestNotes: ManifestNoteEntry[] = [];
    const manifestCanvases: ManifestCanvasEntry[] = [];
    const manifestAssets: ManifestAssetEntry[] = [];
    const manifestSchedules: ManifestScheduleEntry[] = [];

    // 1. Upload new asset blobs
    for (const asset of assets) {
      if (!asset.base64Data) continue;
      const ext = getExtensionForMimeType(asset.mimeType);
      const path = `undone/assets/${asset.hash}.${ext}`;
      const sha = await client.createBlob(asset.base64Data);

      treeEntries.push({
        path,
        mode: '100644',
        type: 'blob',
        sha,
      });

      manifestAssets.push({
        id: asset.id,
        path,
        sha256: asset.hash,
        gitSha: sha,
        mimeType: asset.mimeType,
      });
    }

    // 2. Build notebook JSON files & blobs
    for (const nb of notebooks) {
      const content = canonicalJsonStringify(nb);
      const base64Data = Buffer.from(content, 'utf-8').toString('base64');
      const sha = await client.createBlob(base64Data);
      const path = `undone/notebooks/${nb.id}.json`;

      treeEntries.push({
        path,
        mode: '100644',
        type: 'blob',
        sha,
      });

      manifestNotebooks.push({
        id: nb.id,
        path,
        hash: computeSha256(content),
      });
    }

    // 3. Build note JSON files & blobs
    for (const note of notes) {
      const content = canonicalJsonStringify(note);
      const base64Data = Buffer.from(content, 'utf-8').toString('base64');
      const sha = await client.createBlob(base64Data);
      const path = `undone/notes/${note.id}.json`;

      treeEntries.push({
        path,
        mode: '100644',
        type: 'blob',
        sha,
      });

      const hash = computeSha256(content);
      manifestNotes.push({
        id: note.id,
        path,
        hash,
        contentType: note.contentType,
      });

      if (note.contentType === 'canvas') {
        manifestCanvases.push({
          noteId: note.id,
          path,
          hash,
        });
      }
    }

    // 4. Build schedule tasks JSON blob
    const schedules = body.state.schedules || [];
    if (schedules.length > 0) {
      const schedContent = canonicalJsonStringify(schedules);
      const base64Data = Buffer.from(schedContent, 'utf-8').toString('base64');
      const sha = await client.createBlob(base64Data);
      const path = 'undone/schedules/tasks.json';

      treeEntries.push({
        path,
        mode: '100644',
        type: 'blob',
        sha,
      });

      manifestSchedules.push({
        id: 'tasks',
        path,
        hash: computeSha256(schedContent),
      });
    }

    // 5. Build manifest.json blob
    const manifest: WorkspaceManifest = {
      manifestVersion: 1,
      workspaceId: user.id,
      notebooks: manifestNotebooks,
      notes: manifestNotes,
      canvases: manifestCanvases.length > 0 ? manifestCanvases : undefined,
      assets: manifestAssets,
      schedules: manifestSchedules.length > 0 ? manifestSchedules : undefined,
    };
    const manifestContent = canonicalJsonStringify(manifest);
    const manifestSha = await client.createBlob(
      Buffer.from(manifestContent, 'utf-8').toString('base64')
    );

    treeEntries.push({
      path: 'undone/manifest.json',
      mode: '100644',
      type: 'blob',
      sha: manifestSha,
    });

    // 5. Create tree
    let baseTreeSha: string | null = null;
    if (body.expectedRemoteCommitSha) {
      try {
        const parentCommit = await client.getCommit(body.expectedRemoteCommitSha);
        baseTreeSha = parentCommit?.treeSha || null;
      } catch {
        baseTreeSha = null;
      }
    }

    const treeSha = await client.createTree(
      body.expectedRemoteCommitSha ? baseTreeSha : null,
      treeEntries
    );

    // 6. Create commit
    const parentShas = body.expectedRemoteCommitSha ? [body.expectedRemoteCommitSha] : [];
    const newCommitSha = await client.createCommit(
      'undone(sync): batch publish',
      treeSha,
      parentShas
    );

    // 7. Update ref
    const refUpdate = await client.updateRef(
      `refs/heads/${credentials.defaultBranch}`,
      newCommitSha
    );

    if (!refUpdate.ok) {
      if (refUpdate.status === 422) {
        const currentSha = await client.getRef(`refs/heads/${credentials.defaultBranch}`);
        return NextResponse.json(
          {
            ok: false,
            conflict: true,
            currentRemoteCommitSha: currentSha,
            error: 'Remote ref has moved',
          },
          { status: 422 }
        );
      }

      return NextResponse.json(
        { ok: false, error: refUpdate.error || 'Failed to update remote ref' },
        { status: refUpdate.status || 500 }
      );
    }

    return NextResponse.json({ ok: true, newCommitSha, treeSha });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to publish workspace to GitHub' },
      { status: 500 }
    );
  }
}
