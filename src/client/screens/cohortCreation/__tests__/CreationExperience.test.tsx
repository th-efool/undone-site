// @vitest-environment jsdom
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { draftId, result } from '@/src/shared/cohort-creation/__tests__/fixtures';
import { applyCommand, applyEvent, initialSnapshot, type CreationCommand } from '@/src/shared/cohort-creation/flow';
const { api, push } = vi.hoisted(() => ({ api: { create: vi.fn(), load: vi.fn(), command: vi.fn() }, push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('../services/draftApi', async original => ({ ...await original<typeof import('../services/draftApi')>(), draftApi: api }));
import { DraftApiError } from '../services/draftApi';
import { CreationExperience } from '../CreationExperience';
let saved = initialSnapshot(draftId);
beforeEach(() => {
  saved = initialSnapshot(draftId); push.mockReset();
  Object.values(api).forEach(mock => mock.mockReset());
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
