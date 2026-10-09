// @vitest-environment jsdom
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { draftId, result } from '@/src/shared/cohort-creation/__tests__/fixtures';
import { applyCommand, applyEvent, initialSnapshot, type CreationCommand } from '@/src/shared/cohort-creation/flow';
const { api, push, observer, upload } = vi.hoisted(() => ({ api: { create: vi.fn(), load: vi.fn(), command: vi.fn() }, push: vi.fn(), observer: vi.fn(), upload: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('../services/draftApi', async original => ({ ...await original<typeof import('../services/draftApi')>(), draftApi: api }));
vi.mock('../services/draftEvents', () => ({ observeDraftEvents: observer }));
vi.mock('../services/materialApi', () => ({ materialApi: { upload } }));
import { DraftApiError } from '../services/draftApi';
import { CreationExperience } from '../CreationExperience';
let saved = initialSnapshot(draftId);
beforeEach(() => {
  saved = initialSnapshot(draftId); push.mockReset();
  Object.values(api).forEach(mock => mock.mockReset());
  observer.mockReset();
  upload.mockReset();
  // Transport is covered independently. Exercise the hook's canonical reload callback
  // without allowing these UI tests to create real event connections.
  observer.mockImplementation((options: Parameters<typeof import('../services/draftEvents').observeDraftEvents>[0]) => new Promise<void>(resolve => {
    if (options.signal.aborted) { resolve(); return; }
    const interval = setInterval(() => { void options.reload().catch(() => {}); }, 2000);
    options.signal.addEventListener('abort', () => { clearInterval(interval); resolve(); }, { once: true });
  }));
  api.create.mockImplementation(async () => saved);
  api.load.mockImplementation(async () => saved);
  api.command.mockImplementation(async (_id: string, revision: number, command: CreationCommand) => {
    if (revision !== saved.revision) throw new DraftApiError('Draft changed. Your edit was not saved.', 409, saved);
    saved = applyCommand(saved, command);
    if (command.type === 'request_recommendations') saved = applyEvent(saved, { type: 'recommendations_received', result: { ...result, requestId: command.requestId } });
    return saved;
  });
});
afterEach(cleanup);
describe('owned creation workspace', () => {
  function materialDraft() {
    saved = applyCommand(saved, { type: 'request_recommendations', query: result.intent.rawQuery, requestId: result.requestId });
    saved = applyEvent(saved, { type: 'recommendations_received', result });
    saved = applyCommand(saved, { type: 'create_own' });
    saved = applyCommand(saved, { type: 'choose_starting_point', startingPoint: 'have_material' });
  }
  async function paste() {
    fireEvent.click(await screen.findByRole('button', { name: 'Paste text' }));
    fireEvent.change(screen.getByLabelText('Learning text'), { target: { value: 'Real retained notes' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save and acquire material' }));
  }
  const asset = { id: '44444444-4444-4444-8444-444444444444', kind: 'upload', byteLength: 19, checksum: 'a'.repeat(64) };
  it('queues acknowledged uploads and resumes acquisition without reuploading', async () => {
    materialDraft(); const revision = saved.revision; upload.mockResolvedValue(asset);
    render(<CreationExperience draftId={draftId} resume />); await paste();
    await screen.findByRole('button', { name: 'Cancel acquisition' });
    expect(upload.mock.calls[0].slice(0, 4)).toEqual([draftId, expect.any(Blob), revision, 'pasted-text.txt']);
    expect(api.command.mock.calls[0]).toEqual([draftId, revision, expect.objectContaining({ type: 'acquire_text', assetId: asset.id }), undefined]);
    expect(saved.materials[0].status).toBe('acquiring');
    cleanup(); render(<CreationExperience draftId={draftId} resume />);
    await screen.findByRole('button', { name: 'Cancel acquisition' });
    expect(upload).toHaveBeenCalledOnce(); expect(api.command).toHaveBeenCalledOnce();
  });
  it('rejects an upload attachment when another tab changes the intent', async () => {
    materialDraft(); const revision = saved.revision;
    let resolve!: (value: typeof asset) => void; upload.mockImplementation(() => new Promise(done => { resolve = done; }));
    render(<CreationExperience draftId={draftId} resume />); await paste();
    await waitFor(() => expect(upload).toHaveBeenCalledOnce());
    saved = applyCommand(saved, { type: 'request_recommendations', query: 'A different learning goal', requestId: '55555555-5555-4555-8555-555555555555' });
    await act(async () => resolve(asset));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(api.command.mock.calls[0][1]).toBe(revision);
    expect(saved.materials).toEqual([]); expect(saved.query).toBe('A different learning goal');
    expect(api.command).toHaveBeenCalledOnce();
  });
  it('cancels the upload transport before any durable acquisition is queued', async () => {
    materialDraft(); upload.mockImplementation((_id, _bytes, _revision, _filename, signal: AbortSignal) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('Canceled', 'AbortError')), { once: true });
    }));
    render(<CreationExperience draftId={draftId} resume />); await paste();
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel upload' }));
    await screen.findByText('Upload canceled. Select material to retry.');
    expect(api.command).not.toHaveBeenCalled(); expect(saved.materials).toEqual([]);
    expect((screen.getByLabelText('Learning text') as HTMLTextAreaElement).value).toBe('Real retained notes');
  });
  it('does not replace an observed completion with an older command conflict', async () => {
    let rejectCommand!: (error: Error) => void;
    api.command.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectCommand = reject; }));
    render(<CreationExperience draftId={draftId} initialQuery={result.intent.rawQuery} />);
    await waitFor(() => expect(observer).toHaveBeenCalled());
    const command = api.command.mock.calls[0][2] as Extract<CreationCommand, { type: 'request_recommendations' }>;
    const running = applyCommand(saved, command);
    const completed = applyEvent(running, { type: 'recommendations_received', result: { ...result, requestId: command.requestId } });
    await act(async () => {
      observer.mock.calls.at(-1)![0].onEvent({ snapshot: completed });
      rejectCommand(new DraftApiError('Old command conflicted.', 409, running));
    });
    expect(await screen.findByText('Real rendering cohort')).toBeTruthy();
    expect(screen.queryByText('Understanding your intent and finding public cohorts…')).toBeNull();
    expect(api.command).toHaveBeenCalledOnce();
  });

  it('does not cancel a newer request created by another tab', async () => {
    saved = applyCommand(saved, { type: 'request_recommendations', query: result.intent.rawQuery, requestId: result.requestId });
    render(<CreationExperience draftId={draftId} resume />);
    await screen.findByRole('button', { name: 'Cancel' });
    saved = applyCommand(saved, { type: 'request_recommendations', query: 'Learn another topic', requestId: '00000000-0000-4000-8000-000000000123' });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(await screen.findByText('The active request changed. Review the current draft before canceling.')).toBeTruthy();
    expect(api.command).not.toHaveBeenCalled();
    expect(saved.status).toBe('running');
  });

  it('observes durable recommendations after reload without resubmitting or canceling work', async () => {
    saved = applyCommand(saved, { type: 'request_recommendations', query: result.intent.rawQuery, requestId: result.requestId });
    render(<CreationExperience draftId={draftId} resume />);
    await screen.findByText('Understanding your intent and finding public cohorts…');
    saved = applyEvent(saved, { type: 'recommendations_received', result });
    expect(await screen.findByText('Real rendering cohort', {}, { timeout: 3500 })).toBeTruthy();
    cleanup();
    expect(api.command).not.toHaveBeenCalled();
    expect(api.load.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
  it('creates once in StrictMode and resumes server-saved starting point after reload', async () => {
    render(<StrictMode><CreationExperience draftId={draftId} initialQuery={result.intent.rawQuery} /></StrictMode>);
    expect(await screen.findByText('Real rendering cohort')).toBeTruthy();
    expect(api.create).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Create my own cohort' }));
    fireEvent.click(await screen.findByRole('button', { name: 'I just have a goal' }));
    await waitFor(() => expect(saved.startingPoint).toBe('have_goal'));
    cleanup(); render(<CreationExperience draftId={draftId} resume />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'I just have a goal' }).getAttribute('aria-pressed')).toBe('true'));
    expect(api.load).toHaveBeenCalledTimes(1);
    expect(api.create).toHaveBeenCalledTimes(1);
  });
  it('shows revision conflicts and loads canonical state without silently retrying an edit', async () => {
    const running = applyCommand(saved, { type: 'request_recommendations', query: result.intent.rawQuery, requestId: result.requestId });
    saved = applyCommand(applyEvent(running, { type: 'recommendations_received', result }), { type: 'create_own' });
    render(<CreationExperience draftId={draftId} resume />);
    const button = await screen.findByRole('button', { name: 'I already have material' });
    saved = applyCommand(saved, { type: 'choose_starting_point', startingPoint: 'have_goal' });
    fireEvent.click(button);
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(saved.startingPoint).toBe('have_goal');
    expect(api.command).toHaveBeenCalledTimes(1);
  });
});
