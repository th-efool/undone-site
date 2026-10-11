// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
const { push, refresh } = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh }) }));
import { JoinCohortButton } from '../JoinCohortButton';
afterEach(() => { cleanup(); vi.unstubAllGlobals(); push.mockReset(); refresh.mockReset(); });
describe('cohort join recovery', () => {
  it('preserves the cohort return path when sign-in is required', () => {
    render(<JoinCohortButton cohortId="cohort-a" isLoggedIn={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'Join Cohort' }));
    expect(push).toHaveBeenCalledWith('/auth?returnTo=%2Fcohort%2Fcohort-a');
  });
  it.each([403, 404, 503])('shows an actionable error for HTTP %s', async status => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status })));
    render(<JoinCohortButton cohortId="cohort-a" isLoggedIn />);
    fireEvent.click(screen.getByRole('button', { name: 'Join Cohort' }));
    expect(await screen.findByRole('alert')).toBeTruthy(); expect(refresh).not.toHaveBeenCalled();
    expect((screen.getByRole('button', { name: 'Join Cohort' }) as HTMLButtonElement).disabled).toBe(false);
  });
  it('bounds duplicate clicks and refreshes membership only on confirmation', async () => {
    let complete!: (response: Response) => void;
    const fetcher = vi.fn(() => new Promise<Response>(resolve => { complete = resolve; })); vi.stubGlobal('fetch', fetcher);
    render(<JoinCohortButton cohortId="cohort-a" isLoggedIn />);
    const button = screen.getByRole('button', { name: 'Join Cohort' }); fireEvent.click(button); fireEvent.click(button);
    expect(fetcher).toHaveBeenCalledOnce(); expect(fetcher.mock.calls[0]).toEqual(['/api/cohort/cohort-a/join', expect.objectContaining({ method: 'POST', credentials: 'include', signal: expect.any(AbortSignal) })]);
    complete(new Response('', { status: 200 })); await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
  });
  it('explains uncertain membership after a connection failure', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    render(<JoinCohortButton cohortId="cohort-a" isLoggedIn />); fireEvent.click(screen.getByRole('button', { name: 'Join Cohort' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Reload the cohort to check your membership');
  });
});
