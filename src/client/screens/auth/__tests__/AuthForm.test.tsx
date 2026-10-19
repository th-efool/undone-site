// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AuthForm } from '../authForm/authForm';

const mocks = vi.hoisted(() => ({ signIn: vi.fn(), replace: vi.fn(), refresh: vi.fn() }));
vi.mock('next-auth/react', () => ({ signIn: mocks.signIn }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }) }));
vi.mock('next/image', () => ({ default: () => null }));
beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe('honest authentication actions', () => {
  it('does not pretend unwired email/password controls authenticate', () => {
    render(<AuthForm returnTo="/quest/new?q=rendering" />);
    expect((screen.getByRole('button', { name: 'Create Account' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole('link', { name: 'Create Account' })).toBeNull();
    expect((screen.getByPlaceholderText('you@email.com') as HTMLInputElement).matches(':disabled')).toBe(true);
    expect(screen.getByText(/Email\/password sign-in is not available/)).toBeTruthy();
  });
  it.each([{ ok: false, error: 'CredentialsSignin' }, undefined])('keeps failed guest sign-in on the page with a visible error: %s', async result => {
    mocks.signIn.mockResolvedValue(result);
    render(<AuthForm returnTo="/quest/new?q=rendering" />);
    fireEvent.click(screen.getByRole('button', { name: 'Continue as Guest' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('could not create a saved account'));
    expect(mocks.replace).not.toHaveBeenCalled();
    expect((screen.getByRole('button', { name: 'Continue as Guest' }) as HTMLButtonElement).disabled).toBe(false);
  });
  it('serializes guest sign-in and resumes the local learning query only after success', async () => {
    let finish!: (value: { ok: boolean }) => void;
    mocks.signIn.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    render(<AuthForm returnTo="/quest/new?q=rendering" />);
    const button = screen.getByRole('button', { name: 'Continue as Guest' });
    fireEvent.click(button); fireEvent.click(button);
    expect(mocks.signIn).toHaveBeenCalledOnce();
    expect(mocks.signIn).toHaveBeenCalledWith('credentials', { email: 'guest@undone.com', redirect: false, redirectTo: '/quest/new?q=rendering' });
    finish({ ok: true });
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/quest/new?q=rendering'));
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
  it('shows network failures without navigating', async () => {
    mocks.signIn.mockRejectedValue(new Error('network'));
    render(<AuthForm />); fireEvent.click(screen.getByRole('button', { name: 'Continue as Guest' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Sign-in is unavailable'));
    expect(mocks.replace).not.toHaveBeenCalled();
  });
});
