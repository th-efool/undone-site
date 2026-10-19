// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Auth } from '../Auth';
import { signInErrorMessage } from '@/src/shared/auth/signInError';

const mocks = vi.hoisted(() => ({ status: 'authenticated', replace: vi.fn(), refresh: vi.fn(), signOut: vi.fn() }));
const router = { replace: mocks.replace, refresh: mocks.refresh };
vi.mock('next-auth/react', () => ({ useSession: () => ({ status: mocks.status }), signOut: mocks.signOut }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));
vi.mock('../authShowcase/authShowcase', () => ({ default: () => null }));
vi.mock('../authForm/authForm', () => ({ AuthForm: () => <div>Sign-in actions</div> }));
beforeEach(() => { vi.clearAllMocks(); mocks.status = 'authenticated'; });
afterEach(cleanup);

describe('authentication continuation', () => {
  it('continues an authenticated user to the learning query without redundant server refresh', async () => {
    render(<Auth returnTo="/quest/new?q=rendering" />);
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/quest/new?q=rendering'));
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(screen.queryByText('Sign-in actions')).toBeNull();
  });
  it('offers session reset instead of looping a missing database owner', () => {
    render(<Auth returnTo="/quest/new?q=rendering" allowAuthenticatedRedirect={false} />);
    expect(mocks.replace).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Sign out and retry' }));
    expect(mocks.signOut).toHaveBeenCalledWith({ redirectTo: '/auth?returnTo=%2Fquest%2Fnew%3Fq%3Drendering' });
  });
  it('explains failed provider callbacks instead of silently showing the same form', () => {
    mocks.status = 'unauthenticated';
    render(<Auth signInError={signInErrorMessage('Configuration')} />);
    expect(screen.getByRole('alert').textContent).toContain('configuration needs attention');
    expect(mocks.replace).not.toHaveBeenCalled();
  });
  it('sanitizes unknown callback errors and rejects authentication return loops', () => {
    const message = signInErrorMessage('<private provider details>');
    expect(message).not.toContain('private provider');
    render(<Auth returnTo="/auth" />);
    expect(mocks.replace).toHaveBeenCalledWith('/home');
  });
});
