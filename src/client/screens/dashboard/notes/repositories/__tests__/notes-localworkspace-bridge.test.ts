// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { notesRepository } from '../notes.repository';
import { CanvasRepository } from '../canvas.repository';
import { LocalWorkspace } from '@/src/client/personal-workspace/local/facade';
import type { NotesStateEntity } from '../../models/notes.models';

describe('NotesRepository -> LocalWorkspace Bridge', () => {
  const TEST_USER = 'test-bridge-user-1';

  beforeEach(async () => {
    LocalWorkspace.resetAllInstances();
    localStorage.clear();
  });

  afterEach(() => vi.unstubAllGlobals());

  it('mirrors state into LocalWorkspace and creates outbox mutations', async () => {
    const workspace = LocalWorkspace.getLocalWorkspace(TEST_USER);
    await workspace.open({ userId: TEST_USER });

    const state: NotesStateEntity = {
      notebooks: [
        {
          id: 'nb-monkey',
          title: 'Monkey King Adventures',
          description: 'Journey notes',
          color: '#e11d48',
          favorite: true,
          shared: false,
          archived: false,
          collapsed: false,
          order: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      notes: [
        {
          id: 'note-pikachu',
          notebookId: 'nb-monkey',
          title: 'Pikachu Sketch',
          contentType: 'canvas',
          order: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          ownerId: TEST_USER,
          permission: 'owner',
          tags: ['electric', 'starter'],
          favorite: true,
          shared: false,
          archived: false,
          sharedWith: [],
          publicLink: false,
          linkedConceptIds: [],
          linkedResourceIds: [],
          learningPathId: null,
          revision: 1,
        },
      ],
      selectedNotebookId: 'nb-monkey',
      selectedNoteId: 'note-pikachu',
      notebookSort: 'manual',
      noteSort: 'manual',
      filter: 'all',
    };

    await notesRepository.syncWithLocalWorkspace(state, TEST_USER);

    // Verify notebooks in IndexedDB
    const idbNotebooks = await workspace.getRepository().getAllNotebooks();
    expect(idbNotebooks).toHaveLength(1);
    expect(idbNotebooks[0].id).toBe('nb-monkey');
    expect(idbNotebooks[0].title).toBe('Monkey King Adventures');

    // Verify notes in IndexedDB
    const idbNotes = await workspace.getRepository().getAllNotes();
    expect(idbNotes).toHaveLength(1);
    expect(idbNotes[0].id).toBe('note-pikachu');
    expect(idbNotes[0].title).toBe('Pikachu Sketch');

    // Verify outbox mutations were generated for GitHub sync!
    const outbox = await workspace.getRepository().getPendingOutbox();
    expect(outbox.length).toBeGreaterThanOrEqual(2);
    const mutationEntities = outbox.map((m) => m.entityId);
    expect(mutationEntities).toContain('nb-monkey');
    expect(mutationEntities).toContain('note-pikachu');

    const staleRemote = { ...state, notebooks: [], notes: [] };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => staleRemote,
    });
    vi.stubGlobal('fetch', fetchMock);
    const reloaded = await notesRepository.load(TEST_USER);
    expect(reloaded.notes.map((note) => note.id)).toContain('note-pikachu');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports local quota failure before attempting the legacy API write', async () => {
    const workspace = LocalWorkspace.getLocalWorkspace(TEST_USER);
    await workspace.open({ userId: TEST_USER });
    workspace.getRepository().setSimulateQuotaExceeded(true);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await notesRepository.save({
      notebooks: [{
        id: 'nb-quota', title: 'Notebook', description: '', color: '#000000', favorite: false,
        shared: false, archived: false, collapsed: false, createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(), order: 0,
      }],
      notes: [], selectedNotebookId: null, selectedNoteId: null, notebookSort: 'manual',
      noteSort: 'manual', filter: 'all',
    }, TEST_USER);

    expect(result.localSaved).toBe(false);
    expect(result.remoteSaved).toBe(false);
    expect(result.error).toContain('quota');
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('does not report a canvas save when the atomic local transaction fails', async () => {
    const workspace = LocalWorkspace.getLocalWorkspace(TEST_USER);
    await workspace.open({ userId: TEST_USER });
    workspace.getRepository().setSimulateFailure(true, new Error('disk write failed'));
    const canvas = new CanvasRepository();
    canvas.setActiveUserId(TEST_USER);

    const result = await canvas.save({
      noteId: 'canvas-failure', scene: JSON.stringify({ elements: [], appState: {}, files: {} }),
      schemaVersion: 1, savedAt: new Date().toISOString(),
    });

    expect(result).toEqual({ ok: false, error: 'disk write failed' });
  });

  it('removes deleted notes from LocalWorkspace and queues outbox deletion', async () => {
    const workspace = LocalWorkspace.getLocalWorkspace(TEST_USER);
    await workspace.open({ userId: TEST_USER });

    const initial: NotesStateEntity = {
      notebooks: [
        {
          id: 'nb-1',
          title: 'Notebook 1',
          description: '',
          color: '#3b82f6',
          favorite: false,
          shared: false,
          archived: false,
          collapsed: false,
          order: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      notes: [
        {
          id: 'note-to-delete',
          notebookId: 'nb-1',
          title: 'Will be deleted',
          contentType: 'canvas',
          order: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          ownerId: null,
          permission: 'owner',
          tags: [],
          favorite: false,
          shared: false,
          archived: false,
          sharedWith: [],
          publicLink: false,
          linkedConceptIds: [],
          linkedResourceIds: [],
          learningPathId: null,
          revision: null,
        },
      ],
      selectedNotebookId: 'nb-1',
      selectedNoteId: 'note-to-delete',
      notebookSort: 'manual',
      noteSort: 'manual',
      filter: 'all',
    };

    await notesRepository.syncWithLocalWorkspace(initial, TEST_USER);
    expect(await workspace.getRepository().getAllNotes()).toHaveLength(1);

    // Now sync with note removed
    const updated: NotesStateEntity = {
      ...initial,
      notes: [],
      selectedNoteId: null,
    };

    await notesRepository.syncWithLocalWorkspace(updated, TEST_USER);

    const remainingNotes = await workspace.getRepository().getAllNotes();
    expect(remainingNotes).toHaveLength(0);

    const outbox = await workspace.getRepository().getPendingOutbox();
    const deleteMutation = outbox.find((m) => m.entityId === 'note-to-delete' && m.mutationType === 'delete');
    expect(deleteMutation).toBeDefined();
  });
});
