import { NextRequest, NextResponse } from 'next/server';
import {
  GitHubGitDataClient,
  GitHubApiError,
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
  MAX_PUBLICATION_GROUP_BYTES,
  validateAssetRecord,
  validateWorkspaceAssetDependencies,
} from '@/src/shared/personal-workspace/serialization';
import { getExtensionForMimeType } from '@/src/shared/personal-workspace/media';
import { resolveAuthUser, resolveCredentials } from '../vault';
import { buildPublishCommitMessage } from './commit-message';

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

  if (!Object.prototype.hasOwnProperty.call(body, 'expectedRemoteCommitSha')) {
    return NextResponse.json(
      { error: 'expectedRemoteCommitSha is required for safe publication' },
      { status: 400 },
    );
  }

  const notebooks = body.state.notebooks || [];
  const notes = body.state.notes || [];
  const assets = body.state.assets || [];
  try {
    let assetBytes = 0;
    for (const asset of assets) {
      validateAssetRecord(asset, { isChunked: true });
      assetBytes += asset.byteLength;
    }
    if (assetBytes > MAX_PUBLICATION_GROUP_BYTES) {
      return NextResponse.json({ ok: false, error: 'Workspace assets exceed the supported publication size; local edits remain available.' }, { status: 413 });
    }
    validateWorkspaceAssetDependencies(notes, assets);
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Workspace assets failed validation' },
      { status: 400 },
    );
  }

  try {
    const client = new GitHubGitDataClient({
      token: credentials.token,
      repoFullName: credentials.repoFullName,
    });
    const refName = `refs/heads/${credentials.defaultBranch}`;
    const expectedHead = body.expectedRemoteCommitSha ?? null;
    const currentHead = await client.getRef(refName);
    if (currentHead !== expectedHead) {
      return NextResponse.json(
        { ok: false, conflict: true, currentRemoteCommitSha: currentHead, error: 'Remote ref has moved' },
        { status: 422 },
      );
    }
    let effectiveExpectedHead = expectedHead;
    let baseTreeSha: string | null = null;
    if (effectiveExpectedHead) {
      const parentCommit = await client.getCommit(effectiveExpectedHead);
      if (!parentCommit?.treeSha) {
        return NextResponse.json(
          { ok: false, conflict: true, currentRemoteCommitSha: currentHead, error: 'Expected remote commit is unavailable' },
          { status: 422 },
        );
      }
      baseTreeSha = parentCommit.treeSha;
    }

    const createBlobSafe = async (contentBase64: string): Promise<string> => {
      try {
        return await client.createBlob(contentBase64);
      } catch (err) {
        if (err instanceof GitHubApiError && err.status === 409 && !effectiveExpectedHead) {
          const bootstrappedSha = await client.bootstrapEmptyRepo();
          effectiveExpectedHead = bootstrappedSha;
          const bootstrappedCommit = await client.getCommit(bootstrappedSha);
          baseTreeSha = bootstrappedCommit?.treeSha ?? null;
          return await client.createBlob(contentBase64);
        }
        throw err;
      }
    };

    const treeEntries: TreeEntryInput[] = [];
    const manifestNotebooks: ManifestNotebookEntry[] = [];
    const manifestNotes: ManifestNoteEntry[] = [];
    const manifestCanvases: ManifestCanvasEntry[] = [];
    const manifestAssets: ManifestAssetEntry[] = [];
    const manifestSchedules: ManifestScheduleEntry[] = [];

    // 1. Upload new asset blobs
    for (const asset of assets) {
      const ext = getExtensionForMimeType(asset.mimeType);
      const path = `undone/assets/${asset.hash}.${ext}`;
      const sha = await createBlobSafe(asset.base64Data);

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
      const sha = await createBlobSafe(base64Data);
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
      const sha = await createBlobSafe(base64Data);
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
      const sha = await createBlobSafe(base64Data);
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
    const manifestSha = await createBlobSafe(
      Buffer.from(manifestContent, 'utf-8').toString('base64')
    );

    treeEntries.push({
      path: 'undone/manifest.json',
      mode: '100644',
      type: 'blob',
      sha: manifestSha,
    });

    // 6. Remove deleted undone/* blobs from baseTreeSha so zombie files never remain in the Git tree
    if (baseTreeSha) {
      try {
        const existingTreeItems = await client.getTree(baseTreeSha, true);
        if (existingTreeItems && existingTreeItems.length > 0) {
          const activePaths = new Set(treeEntries.map((entry) => entry.path));
          for (const item of existingTreeItems) {
            if (
              item.type === 'blob' &&
              (item.path.startsWith('undone/notebooks/') ||
                item.path.startsWith('undone/notes/') ||
                item.path.startsWith('undone/assets/') ||
                item.path.startsWith('undone/schedules/')) &&
              !activePaths.has(item.path)
            ) {
              treeEntries.push({
                path: item.path,
                mode: '100644',
                type: 'blob',
                sha: null,
              });
            }
          }
        }
      } catch (treeErr) {
        console.warn('[publish] Non-fatal error inspecting baseTreeSha for deleted files:', treeErr);
      }
    }

    // 7. Create tree
    const treeSha = await client.createTree(
      baseTreeSha,
      treeEntries
    );

    // Guard against no-op commits when the resulting Git tree is identical to the parent commit's tree
    if (effectiveExpectedHead && baseTreeSha && treeSha === baseTreeSha) {
      return NextResponse.json({
        ok: true,
        newCommitSha: effectiveExpectedHead,
        treeSha,
        noOp: true,
      });
    }

    // 7. Create commit with descriptive message when mutations are present
    const parentShas = effectiveExpectedHead ? [effectiveExpectedHead] : [];
    const commitMessage = buildPublishCommitMessage(body.mutations, {
      notebooks,
      notes,
      assets,
      schedules,
    });
    const newCommitSha = await client.createCommit(
      commitMessage,
      treeSha,
      parentShas
    );

    // 8. Update ref
    const refUpdate = await client.updateRef(refName, newCommitSha, { expectedSha: effectiveExpectedHead });

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
