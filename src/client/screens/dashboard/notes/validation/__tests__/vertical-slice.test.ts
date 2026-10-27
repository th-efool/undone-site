import { describe, it, expect, beforeEach } from 'vitest';
import {
  GitDataProviderHarness,
  LocalFirstSyncCoordinator,
} from '../vertical-slice-harness';
import { LocalWorkspaceRepository } from '../indexeddb-prototype';
import {
  FIXTURE_NOTEBOOK,
  FIXTURE_CANVAS_NOTE,
  FIXTURE_CANVAS_ASSET,
  SYNTHETIC_ASSET_HASH,
} from '../fixtures';

describe('V4 End-to-End Vertical Slice and Concurrency Failure Injection', () => {
  let gitProvider: GitDataProviderHarness;
  let localStoreA: LocalWorkspaceRepository;
  let coordinatorA: LocalFirstSyncCoordinator;

  beforeEach(async () => {
    gitProvider = new GitDataProviderHarness('user-org/undone-private-data', true);
    localStoreA = new LocalWorkspaceRepository('user-profile-A');
    await localStoreA.initialize();
    coordinatorA = new LocalFirstSyncCoordinator(localStoreA, gitProvider);
  });

  // Scenario 1: Authorize, select repository, preview, confirm intended bind (and test cancel)
  it('Scenario 1: Authorize, select repository, preview and bind (and cancel safety)', () => {
    // 1a. Cancel test: user cancels binding preview -> no binding created, no remote changes
    const cancelResult = coordinatorA.previewAndBindRepository('user-org/undone-private-data', false);
    expect(cancelResult.bound).toBe(false);
    expect(coordinatorA.binding).toBeNull();

    // 1b. Public repo rejection: must require private repo
    const publicProvider = new GitDataProviderHarness('user-org/public-data', false);
    const publicCoord = new LocalFirstSyncCoordinator(localStoreA, publicProvider);
    const publicResult = publicCoord.previewAndBindRepository('user-org/public-data', true);
    expect(publicResult.bound).toBe(false);
    expect(publicResult.error).toContain('private repository');

    // 1c. Valid confirm: establishes binding with active epoch
    const bindResult = coordinatorA.previewAndBindRepository('user-org/undone-private-data', true);
    expect(bindResult.bound).toBe(true);
    expect(coordinatorA.binding?.status).toBe('ACTIVE');
    expect(coordinatorA.binding?.bindingEpoch).toBe(1);
  });

  // Scenario 2: Save locally and verify atomic outbox; publish scene and asset references in one commit
  it('Scenario 2: Save locally + atomic outbox + atomic scene/asset publication commit', async () => {
    coordinatorA.previewAndBindRepository('user-org/undone-private-data', true);

    // Save notebook & canvas note with image asset locally
    await localStoreA.saveNotebookAtomic(FIXTURE_NOTEBOOK);
    await localStoreA.saveCanvasNoteAtomic(FIXTURE_CANVAS_NOTE, [FIXTURE_CANVAS_ASSET]);

    // Verify local outbox has staged pending mutations
    const outbox = await localStoreA.listOutbox();
    expect(outbox.length).toBeGreaterThanOrEqual(2);

    // Publish to remote repository
    const pubResult = await coordinatorA.publishOutbox();
    expect(pubResult.ok).toBe(true);
    expect(pubResult.commitSha).toBeDefined();

    // Verify remote branch advanced to the new commit
    const headRef = gitProvider.getRef('refs/heads/main');
    expect(headRef).toBe(pubResult.commitSha);

    // Verify outbox was cleanly acknowledged
    const remainingOutbox = await localStoreA.listOutbox();
    expect(remainingOutbox.length).toBe(0);
    expect(coordinatorA.syncStatus).toBe('synced');

    // Verify referenced blobs in remote tree
    const commit = gitProvider.getCommit(headRef!);
    const tree = gitProvider.getTree(commit!.treeSha);
    const assetEntry = tree?.find((e) => e.path.includes(SYNTHETIC_ASSET_HASH));
    expect(assetEntry).toBeDefined();
  });

  // Scenario 3: Close/reopen profile A & clean profile B restore (comparing counts, hashes, asset bytes)
  it('Scenario 3: Close/reopen profile A and clean profile B restore', async () => {
    coordinatorA.previewAndBindRepository('user-org/undone-private-data', true);
    await localStoreA.saveNotebookAtomic(FIXTURE_NOTEBOOK);
    await localStoreA.saveCanvasNoteAtomic(FIXTURE_CANVAS_NOTE, [FIXTURE_CANVAS_ASSET]);
    await coordinatorA.publishOutbox();

    // Simulate Profile B on a fresh authorized device with completely empty IndexedDB
    const localStoreB = new LocalWorkspaceRepository('user-profile-B');
    await localStoreB.initialize();
    const coordinatorB = new LocalFirstSyncCoordinator(localStoreB, gitProvider);
    coordinatorB.previewAndBindRepository('user-org/undone-private-data', true);

    // Restore from remote
    const restoreResult = await coordinatorB.restoreFromRemote(localStoreB);
    expect(restoreResult.ok).toBe(true);
    expect(restoreResult.notebookCount).toBe(1);
    expect(restoreResult.noteCount).toBe(1);
    expect(restoreResult.assetCount).toBe(1);

    // Verify exact content counts & asset bytes match on Profile B
    const restoredNotebooks = await localStoreB.listNotebooks();
    expect(restoredNotebooks[0].title).toBe(FIXTURE_NOTEBOOK.title);

    const restoredAssets = await localStoreB.listAssets();
    expect(restoredAssets[0].hash).toBe(SYNTHETIC_ASSET_HASH);
    expect(restoredAssets[0].base64Data).toBe(FIXTURE_CANVAS_ASSET.base64Data);
  });

  // Scenario 4: Racing independent edits from head H (detect head divergence, rebase/reconcile, advance)
  it('Scenario 4: Racing independent edits from head H on two profiles', async () => {
    coordinatorA.previewAndBindRepository('user-org/undone-private-data', true);
    await localStoreA.saveNotebookAtomic(FIXTURE_NOTEBOOK);
    await coordinatorA.publishOutbox();

    // Profile B restores up to head H
    const localStoreB = new LocalWorkspaceRepository('user-profile-B');
    await localStoreB.initialize();
    const coordinatorB = new LocalFirstSyncCoordinator(localStoreB, gitProvider);
    coordinatorB.previewAndBindRepository('user-org/undone-private-data', true);
    await coordinatorB.restoreFromRemote(localStoreB);

    // Independent edit on Profile A: creates Note 1
    await localStoreA.saveCanvasNoteAtomic(
      {
        ...FIXTURE_CANVAS_NOTE,
        id: 'note-from-A',
        title: 'Note from Profile A',
      },
      []
    );

    // Independent edit on Profile B: creates Note 2
    await localStoreB.saveCanvasNoteAtomic(
      {
        ...FIXTURE_CANVAS_NOTE,
        id: 'note-from-B',
        title: 'Note from Profile B',
      },
      []
    );

    // Profile A publishes first: advances branch ref to H'
    const pubA = await coordinatorA.publishOutbox();
    expect(pubA.ok).toBe(true);

    // Profile B attempts to publish from stale head H -> Git provider rejects with 422 Non-Fast-Forward
    const pubBStale = await coordinatorB.publishOutbox();
    expect(pubBStale.ok).toBe(false);
    expect(pubBStale.error).toContain('non-fast-forward');

    // Profile B reconciles from new remote head H' and rebuilds commit
    const recB = await coordinatorB.reconcileRemoteDivergence();
    expect(recB.resolved).toBe(true);

    const pubBRetry = await coordinatorB.publishOutbox();
    expect(pubBRetry.ok).toBe(true);

    // Clean restore from Profile C verifies BOTH independent notes survive!
    const localStoreC = new LocalWorkspaceRepository('user-profile-C');
    await localStoreC.initialize();
    const coordinatorC = new LocalFirstSyncCoordinator(localStoreC, gitProvider);
    coordinatorC.previewAndBindRepository('user-org/undone-private-data', true);
    await coordinatorC.restoreFromRemote(localStoreC);

    const finalNotes = await localStoreC.listNotes();
    expect(finalNotes.some((n) => n.id === 'note-from-A')).toBe(true);
    expect(finalNotes.some((n) => n.id === 'note-from-B')).toBe(true);
  });

  // Scenario 5: Edit the same note on both profiles (preserve both, explicit conflict copy, no clock arbitration)
  it('Scenario 5: Concurrent edit on same note generates explicit conflict copy', async () => {
    coordinatorA.previewAndBindRepository('user-org/undone-private-data', true);
    await localStoreA.saveNotebookAtomic(FIXTURE_NOTEBOOK);
    await localStoreA.saveCanvasNoteAtomic(FIXTURE_CANVAS_NOTE, []);
    await coordinatorA.publishOutbox();

    const localStoreB = new LocalWorkspaceRepository('user-profile-B');
    await localStoreB.initialize();
    const coordinatorB = new LocalFirstSyncCoordinator(localStoreB, gitProvider);
    coordinatorB.previewAndBindRepository('user-org/undone-private-data', true);
    await coordinatorB.restoreFromRemote(localStoreB);

    // Profile A edits note title
    await localStoreA.saveCanvasNoteAtomic(
      {
        ...FIXTURE_CANVAS_NOTE,
        title: 'Title Edited By Profile A',
      },
      []
    );

    // Profile B concurrently edits same note title
    await localStoreB.saveCanvasNoteAtomic(
      {
        ...FIXTURE_CANVAS_NOTE,
        title: 'Title Concurrently Edited By Profile B',
      },
      []
    );

    // Profile A publishes first
    await coordinatorA.publishOutbox();

    // Profile B detects remote divergence and reconciles
    const recResult = await coordinatorB.reconcileRemoteDivergence();
    expect(recResult.conflictsCreated).toBe(1);

    // Profile B now has original local note + non-destructive conflict copy
    const notesB = await localStoreB.listNotes();
    expect(notesB.length).toBe(2);
    expect(notesB.some((n) => n.title.includes('[Conflict]'))).toBe(true);

    // Both converge cleanly to remote
    const pubB = await coordinatorB.publishOutbox();
    expect(pubB.ok).toBe(true);
  });

  // Scenario 6: Repeat racing-writer case while dropping response after provider updates ref
  it('Scenario 6: Recover from lost response after provider successfully updates ref', async () => {
    coordinatorA.previewAndBindRepository('user-org/undone-private-data', true);
    await localStoreA.saveNotebookAtomic(FIXTURE_NOTEBOOK);
    await localStoreA.saveCanvasNoteAtomic(FIXTURE_CANVAS_NOTE, []);

    // Inject wire fault: drop network response immediately AFTER provider updates branch ref
    gitProvider.faults.dropResponseAfterRefUpdate = true;

    // First publish attempt throws network timeout
    const pubResult1 = await coordinatorA.publishOutbox();
    // Catch block inside coordinator verifies candidate commit against current branch HEAD and self-heals!
    expect(pubResult1.ok).toBe(true);
    expect(coordinatorA.syncStatus).toBe('synced');

    // Outbox was acknowledged; no duplicate logical commit created
    const outbox = await localStoreA.listOutbox();
    expect(outbox.length).toBe(0);
  });

  // Scenario 7: Edit v2 while v1 in flight (v2 survives, v1 acknowledgement never clears v2)
  it('Scenario 7: In-flight edit v2 survives and v1 acknowledgement does not clear v2', async () => {
    coordinatorA.previewAndBindRepository('user-org/undone-private-data', true);
    await localStoreA.saveNotebookAtomic(FIXTURE_NOTEBOOK);

    // Generation 1 in outbox
    const outboxBefore = await localStoreA.listOutbox();
    const gen1 = outboxBefore[0].generation;

    // Simulate edit v2 while v1 is in-flight
    await localStoreA.saveCanvasNoteAtomic(FIXTURE_CANVAS_NOTE, []);
    const outboxWithV2 = await localStoreA.listOutbox();
    expect(outboxWithV2.length).toBe(2);

    // Acknowledge ONLY Generation 1 (simulating v1 completed)
    await localStoreA.acknowledgeOutboxUpTo(gen1);

    // v2 survives in outbox!
    const outboxAfterV1Ack = await localStoreA.listOutbox();
    expect(outboxAfterV1Ack.length).toBe(1);
    expect(outboxAfterV1Ack[0].entityId).toBe(FIXTURE_CANVAS_NOTE.id);
  });

  // Scenario 8: Remote asset missing/corrupt detection (restore withheld, error state flagged)
  it('Scenario 8: Missing or corrupt remote asset halts clean restore', async () => {
    coordinatorA.previewAndBindRepository('user-org/undone-private-data', true);
    await localStoreA.saveCanvasNoteAtomic(FIXTURE_CANVAS_NOTE, [FIXTURE_CANVAS_ASSET]);
    await coordinatorA.publishOutbox();

    // 8a. Corrupt remote asset
    const headSha = gitProvider.getRef('refs/heads/main');
    const commit = gitProvider.getCommit(headSha!);
    const tree = gitProvider.getTree(commit!.treeSha);
    const assetEntry = tree!.find((e) => e.path.includes(SYNTHETIC_ASSET_HASH));

    gitProvider.faults.corruptAssetBlobSha = assetEntry!.sha;

    const freshStore = new LocalWorkspaceRepository('user-corrupt-probe');
    await freshStore.initialize();
    const freshCoord = new LocalFirstSyncCoordinator(freshStore, gitProvider);
    freshCoord.previewAndBindRepository('user-org/undone-private-data', true);

    const corruptRestore = await freshCoord.restoreFromRemote(freshStore);
    expect(corruptRestore.ok).toBe(false);
    expect(corruptRestore.error).toContain('Corrupt remote asset hash mismatch');

    // 8b. Missing remote asset
    gitProvider.faults.corruptAssetBlobSha = undefined;
    gitProvider.faults.removeAssetBlobSha = assetEntry!.sha;

    const missingRestore = await freshCoord.restoreFromRemote(freshStore);
    expect(missingRestore.ok).toBe(false);
    expect(missingRestore.error).toContain('Missing referenced remote asset blob');
  });

  // Scenario 9: Disconnect with pending mutation & reconnect convergence
  it('Scenario 9: Disconnect preserves queued mutations; reconnect converges without duplicates', async () => {
    coordinatorA.previewAndBindRepository('user-org/undone-private-data', true);
    await localStoreA.saveNotebookAtomic(FIXTURE_NOTEBOOK);
    await coordinatorA.publishOutbox();

    // Add new note
    await localStoreA.saveCanvasNoteAtomic(FIXTURE_CANVAS_NOTE, []);

    // User disconnects
    coordinatorA.disconnectRepository();
    expect(coordinatorA.binding?.status).toBe('DISCONNECTED');
    expect(coordinatorA.syncStatus).toBe('offline');

    // Local edits remain in outbox
    const queuedOutbox = await localStoreA.listOutbox();
    expect(queuedOutbox.length).toBe(1);

    // User can continue editing locally while disconnected
    await localStoreA.saveNotebookAtomic({
      ...FIXTURE_NOTEBOOK,
      title: 'Title Edited Offline While Disconnected',
    });
    const offlineOutbox = await localStoreA.listOutbox();
    expect(offlineOutbox.length).toBe(2);

    // Reconnect to same binding
    coordinatorA.reconnectRepository();
    expect(coordinatorA.binding?.status).toBe('ACTIVE');

    // Converges cleanly
    const pubAfterReconnect = await coordinatorA.publishOutbox();
    expect(pubAfterReconnect.ok).toBe(true);
    expect(coordinatorA.syncStatus).toBe('synced');

    const finalOutbox = await localStoreA.listOutbox();
    expect(finalOutbox.length).toBe(0);
  });
});
