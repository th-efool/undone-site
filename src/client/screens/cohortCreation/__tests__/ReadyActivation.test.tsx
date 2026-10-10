// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { creationSnapshotSchema } from '@/src/shared/cohort-creation/contracts';
import { applyCommand, type CreationCommand } from '@/src/shared/cohort-creation/flow';
import { draftId } from '@/src/shared/cohort-creation/__tests__/fixtures';
import { readyFixture, readyReview } from './ready.fixture';
const { api, push, observer } = vi.hoisted(() => ({ api: { create: vi.fn(), load: vi.fn(), command: vi.fn() }, push: vi.fn(), observer: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('../services/draftApi', async original => ({ ...await original<typeof import('../services/draftApi')>(), draftApi: api }));
vi.mock('../services/draftEvents', () => ({ observeDraftEvents: observer }));
import { DraftApiError } from '../services/draftApi';
import { useCreation } from '../hooks/useCreation';
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
describe('Ready private activation commands', () => {
  it('prepares owned review then queues only private activation using the accepted revision', async () => {
    const hook = renderHook(() => useCreation(draftId, '', true)); await waitFor(() => expect(hook.result.current.hydrated).toBe(true));
    await act(async () => { expect(await hook.result.current.activateReady()).toBe(true); });
    expect(api.command.mock.calls.map(call => [call[1], call[2].type])).toEqual([[0, 'open_review'], [1, 'finalize_creation']]);
    expect(api.command.mock.calls[1][2]).toMatchObject({ mode: 'private_activation' });
    expect(hook.result.current.snapshot.stage).toBe('finalizing'); expect(hook.result.current.activatingReady).toBe(false);
  });
  it('rejects duplicate clicks and does not finalize after failed preparation', async () => {
    const hook = renderHook(() => useCreation(draftId, '', true)); await waitFor(() => expect(hook.result.current.hydrated).toBe(true));
    let fail!: (error: Error) => void; api.command.mockImplementationOnce(() => new Promise((_resolve, reject) => { fail = reject; }));
    let pending!: Promise<boolean>;
    await act(async () => { pending = hook.result.current.activateReady(); expect(await hook.result.current.activateReady()).toBe(false); });
    expect(hook.result.current.activatingReady).toBe(true);
    await act(async () => { fail(new Error('storage unavailable')); expect(await pending).toBe(false); });
    expect(api.command).toHaveBeenCalledOnce(); expect(hook.result.current.snapshot.stage).toBe('ready'); expect(hook.result.current.saved).toBe(false);
  });
  it('preserves prepared review when finalization conflicts instead of retrying a newer draft', async () => {
    const hook = renderHook(() => useCreation(draftId, '', true)); await waitFor(() => expect(hook.result.current.hydrated).toBe(true));
    const normal = api.command.getMockImplementation()!;
    api.command.mockImplementation(async (...args) => {
      if (args[2].type === 'open_review') return normal(...args);
      state = { ...state, revision: state.revision + 1 }; throw new DraftApiError('Draft changed', 409, state);
    });
    await act(async () => { expect(await hook.result.current.activateReady()).toBe(false); });
    expect(api.command).toHaveBeenCalledTimes(2); expect(hook.result.current.snapshot.stage).toBe('review');
    expect(hook.result.current.snapshot.revision).toBe(2); expect(hook.result.current.saved).toBe(false);
  });
});
