// @vitest-environment jsdom
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { draftId, result } from '@/src/shared/cohort-creation/__tests__/fixtures';
import type { RecommendationRequest } from '@/src/shared/cohort-creation/contracts';

const { push, requestRecommendations } = vi.hoisted(() => ({ push: vi.fn(), requestRecommendations: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('../services/creationApi', async importOriginal => ({
  ...await importOriginal<typeof import('../services/creationApi')>(), requestRecommendations,
}));
import { CreationExperience } from '../CreationExperience';

beforeEach(() => {
  sessionStorage.clear(); push.mockReset(); requestRecommendations.mockReset();
  requestRecommendations.mockImplementation(async (input: RecommendationRequest) => ({
    ...result, requestId: input.requestId, inputRevision: input.inputRevision,
    intent: { ...result.intent, revision: input.inputRevision, rawQuery: input.query },
  }));
});
afterEach(cleanup);

describe('minimal creation workspace', () => {
  it('submits a landing query only once in StrictMode, renders cards and saves the starting point', async () => {
    render(<StrictMode><CreationExperience draftId={draftId} initialQuery={result.intent.rawQuery} /></StrictMode>);
    expect(await screen.findByText('Real rendering cohort')).toBeTruthy();
    expect(requestRecommendations).toHaveBeenCalledTimes(1);
    expect(screen.getByText('7 members · 3 lessons · beginner')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Create my own cohort' }));
    expect(push).toHaveBeenCalledWith(`/quest/draft/${draftId}`);
    fireEvent.click(screen.getByRole('button', { name: 'I just have a goal' }));
    expect(screen.getByRole('button', { name: 'I just have a goal' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText(/Material acquisition will be added/)).toBeTruthy();
    cleanup();
    render(<CreationExperience draftId={draftId} resume />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'I just have a goal' }).getAttribute('aria-pressed')).toBe('true'));
    expect(requestRecommendations).toHaveBeenCalledTimes(1);
  });
  it('shows missing session recovery and lets the user replace the query', async () => {
    render(<CreationExperience draftId={draftId} resume />);
    expect(await screen.findByText(/unavailable or expired/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Your learning query'), { target: { value: 'Learn watercolor' } });
    fireEvent.click(screen.getByRole('button', { name: 'Find cohorts' }));
    await waitFor(() => expect(requestRecommendations).toHaveBeenCalledWith(expect.objectContaining({ query: 'Learn watercolor' }), expect.any(AbortSignal)));
  });
  it('ignores a late completion after cancel and keeps the query retryable', async () => {
    let resolve: (value: unknown) => void = () => {};
    let pending: RecommendationRequest;
    requestRecommendations.mockImplementation((input: RecommendationRequest) => { pending = input; return new Promise(done => { resolve = done; }); });
    render(<CreationExperience draftId={draftId} initialQuery={result.intent.rawQuery} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(screen.getByText(/Generation stopped/)).toBeTruthy();
    resolve({ ...result, requestId: pending!.requestId });
    await waitFor(() => expect(screen.queryByText('Real rendering cohort')).toBeNull());
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
  });
});
