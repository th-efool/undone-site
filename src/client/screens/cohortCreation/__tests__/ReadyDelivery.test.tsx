// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { creationSnapshotSchema } from '@/src/shared/cohort-creation/contracts';
import { applyCommand, type CreationCommand } from '@/src/shared/cohort-creation/flow';
import { draftId } from '@/src/shared/cohort-creation/__tests__/fixtures';
import { readyFixture, readyReview } from './ready.fixture';
const { api, push, observer } = vi.hoisted(() => ({ api: { create: vi.fn(), load: vi.fn(), command: vi.fn() }, push: vi.fn(), observer: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('../services/draftApi', async original => ({ ...await original<typeof import('../services/draftApi')>(), draftApi: api }));
vi.mock('../services/draftEvents', () => ({ observeDraftEvents: observer }));
import { DraftApiError } from '../services/draftApi';
import { CreationExperience } from '../CreationExperience';
let state = readyFixture();
beforeEach(() => {
  state = readyFixture(); Object.values(api).forEach(mock => mock.mockReset()); push.mockReset(); observer.mockReset();
  api.load.mockImplementation(async () => state);
  api.command.mockImplementation(async (_id: string, revision: number, command: CreationCommand) => {
    if (revision !== state.revision) throw new DraftApiError('Draft changed', 409, state);
    state = command.type === 'open_review' ? creationSnapshotSchema.parse({ ...state, revision: revision + 1, stage: 'review', review: readyReview }) : applyCommand(state, command);
    return state;
  });
  observer.mockImplementation(() => new Promise(() => {}));
});
afterEach(cleanup);
describe('Ready receipt-gated delivery', () => {
  it('navigates to the feed only after observing a committed private receipt', async () => {
    render(<CreationExperience draftId={draftId} resume />);
    fireEvent.click(await screen.findByRole('button', { name: 'Go to my feed' }));
    await screen.findByRole('heading', { name: 'Finalizing your cohort' }); expect(push).not.toHaveBeenCalled();
    const receipt = { requestId: state.activeRequestId!, mode: 'private_activation' as const, snapshotHash: 'a'.repeat(64), cohortId: draftId, committedAt: new Date().toISOString() };
    state = creationSnapshotSchema.parse({ ...state, revision: state.revision + 1, stage: 'published', status: 'succeeded', activeRequestId: null,
      publication: { ...state.publication!, cohortId: draftId, snapshotHash: receipt.snapshotHash, receipt } });
    await act(async () => observer.mock.calls[0][0].onEvent({ snapshot: state }));
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/play?cohort=${draftId}`));
  });
  it('resumes an activated draft without automatically navigating or activating again', async () => {
    const receipt = { requestId: draftId, mode: 'private_activation' as const, snapshotHash: 'a'.repeat(64), cohortId: draftId, committedAt: new Date().toISOString() };
    state = creationSnapshotSchema.parse({ ...state, stage: 'published', review: readyReview,
      publication: { requestId: draftId, mode: 'private_activation', cohortId: draftId, snapshotHash: receipt.snapshotHash, checkpoint: null, receipt } });
    render(<CreationExperience draftId={draftId} resume />); await screen.findByRole('heading', { name: 'Your private cohort is ready' });
    expect(screen.getByRole('link', { name: 'Start learning' }).getAttribute('href')).toBe(`/play?cohort=${draftId}`);
    expect(push).not.toHaveBeenCalled(); expect(api.command).not.toHaveBeenCalled();
  });
});
