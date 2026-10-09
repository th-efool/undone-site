// @vitest-environment jsdom
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { draftId, result } from '@/src/shared/cohort-creation/__tests__/fixtures';
import { applyCommand, applyEvent, initialSnapshot, type CreationCommand } from '@/src/shared/cohort-creation/flow';
const { api, push, observer } = vi.hoisted(() => ({ api: { create: vi.fn(), load: vi.fn(), command: vi.fn() }, push: vi.fn(), observer: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('../services/draftApi', async original => ({ ...await original<typeof import('../services/draftApi')>(), draftApi: api }));
vi.mock('../services/draftEvents', () => ({ observeDraftEvents: observer }));
import { DraftApiError } from '../services/draftApi';
import { CreationExperience } from '../CreationExperience';
let saved = initialSnapshot(draftId);
beforeEach(() => {
  saved = initialSnapshot(draftId); push.mockReset();
  Object.values(api).forEach(mock => mock.mockReset());
  observer.mockReset();
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
