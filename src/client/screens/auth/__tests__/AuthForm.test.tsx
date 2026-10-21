// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AuthForm } from '../authForm/authForm';

const mocks = vi.hoisted(() => ({ signIn: vi.fn(), replace: vi.fn(), refresh: vi.fn() }));
vi.mock('next-auth/react', () => ({ signIn: mocks.signIn }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }) }));
vi.mock('next/image', () => ({ default: () => null }));
beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn();
});
afterEach(cleanup);

describe('honest authentication actions', () => {
  it('renders interactive sign-up form with enabled controls', () => {
    render(<AuthForm returnTo="/quest/new?q=rendering" />);
    const submitBtn = screen.getByRole('button', { name: 'Create Account' });
    expect((submitBtn as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByPlaceholderText('you@email.com') as HTMLInputElement).disabled).toBe(false);
    expect((screen.getByPlaceholderText('At least 6 characters') as HTMLInputElement).disabled).toBe(false);
    expect(screen.queryByText(/Email\/password sign-in is not available/)).toBeNull();
  });

  it('submits registration form and signs in automatically on success', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        user: { id: 'u123', email: 'newuser@undone.com', username: 'newuser', name: 'New User' },
      }),
    });
    mocks.signIn.mockResolvedValueOnce({ ok: true });

    render(<AuthForm returnTo="/messages" />);

    fireEvent.change(screen.getByPlaceholderText('Alex Rivers'), { target: { value: 'New User' } });
    fireEvent.change(screen.getByPlaceholderText('alex_rivers'), { target: { value: 'newuser' } });
    fireEvent.change(screen.getByPlaceholderText('you@email.com'), { target: { value: 'newuser@undone.com' } });
    fireEvent.change(screen.getByPlaceholderText('At least 6 characters'), { target: { value: 'Secret123!' } });

    const submitBtn = screen.getByRole('button', { name: 'Create Account' });
    expect((submitBtn as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'New User',
          username: 'newuser',
          email: 'newuser@undone.com',
          password: 'Secret123!',
        }),
      });
      expect(mocks.signIn).toHaveBeenCalledWith('credentials', {
        email: 'newuser',
        password: 'Secret123!',
        redirect: false,
        redirectTo: '/messages',
      });
      expect(mocks.replace).toHaveBeenCalledWith('/messages');
    });
  });

  it('displays error if registration fails (e.g. duplicate email)', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'An account with this email already exists.' }),
    });

    render(<AuthForm returnTo="/messages" />);

    fireEvent.change(screen.getByPlaceholderText('you@email.com'), { target: { value: 'user_alpha@undone.com' } });
    fireEvent.change(screen.getByPlaceholderText('At least 6 characters'), { target: { value: 'Password123!' } });

    const submitBtn = screen.getByRole('button', { name: 'Create Account' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('An account with this email already exists.');
    });
    expect(mocks.signIn).not.toHaveBeenCalled();
    expect(mocks.replace).not.toHaveBeenCalled();
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

  it('submits email and password on login tab and redirects on success', async () => {
    mocks.signIn.mockResolvedValue({ ok: true });
    render(<AuthForm returnTo="/messages" />);

    // Switch to Log In tab via the header toggle button
    const loginToggle = screen.getByRole('button', { name: 'Log in' });
    fireEvent.click(loginToggle);

    const idInput = screen.getByPlaceholderText(/e\.g\. user_alpha/);
    const passInput = screen.getByPlaceholderText('••••••••');
    
    // Find the submit button
    const submitBtn = screen.getByRole('button', { name: 'Log In' });
    expect((submitBtn as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(idInput, { target: { value: 'user_alpha' } });
    expect((submitBtn as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(passInput, { target: { value: 'Password123!' } });
    expect((submitBtn as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mocks.signIn).toHaveBeenCalledWith('credentials', {
        email: 'user_alpha',
        password: 'Password123!',
        redirect: false,
        redirectTo: '/messages',
      });
      expect(mocks.replace).toHaveBeenCalledWith('/messages');
    });
  });

  it('displays error on invalid credentials in login tab', async () => {
    mocks.signIn.mockResolvedValue({ ok: false, error: 'CredentialsSignin' });
    render(<AuthForm returnTo="/messages" />);

    const loginToggle = screen.getByRole('button', { name: 'Log in' });
    fireEvent.click(loginToggle);

    fireEvent.change(screen.getByPlaceholderText(/e\.g\. user_alpha/), { target: { value: 'user_alpha' } });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'WrongPass' } });
    
    const submitBtn = screen.getByRole('button', { name: 'Log In' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('Invalid email/username or password');
    });
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it('allows toggling between Log In and Sign Up using the footer link', () => {
    render(<AuthForm returnTo="/home" />);
    expect(screen.getByRole('button', { name: 'Create Account' })).toBeTruthy();

    // Click footer link to switch to login
    fireEvent.click(screen.getByRole('button', { name: 'Log in instead →' }));
    expect(screen.getByRole('button', { name: 'Log In' })).toBeTruthy();

    // Click footer link to switch back to signup
    fireEvent.click(screen.getByRole('button', { name: 'Create an account →' }));
    expect(screen.getByRole('button', { name: 'Create Account' })).toBeTruthy();
  });
});
