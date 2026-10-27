// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ConnectGitHubModal } from '../connect-github-modal';

afterEach(cleanup);

describe('ConnectGitHubModal', () => {
  it('does not render anything when isOpen is false', () => {
    const { container } = render(
      <ConnectGitHubModal isOpen={false} onClose={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders all required form elements and warning when isOpen is true', () => {
    render(<ConnectGitHubModal isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByText('Connect GitHub')).toBeDefined();
    expect(screen.getByTestId('icon-github')).toBeDefined();

    // Form inputs
    expect(screen.getByLabelText(/Repository Name/i)).toBeDefined();
    expect(screen.getByLabelText(/Personal Access Token/i)).toBeDefined();
    expect(screen.getByLabelText(/Allow Public Repository/i)).toBeDefined();

    // Public repo warning
    expect(screen.getByTestId('public-repo-warning')).toBeDefined();
    expect(
      screen.getByText(/Undone workspace notes may contain private information/i),
    ).toBeDefined();

    // Buttons
    expect(screen.getByTestId('btn-connect')).toBeDefined();
    expect(screen.getByTestId('btn-close')).toBeDefined();
  });

  it('validates repository name and token fields', () => {
    render(<ConnectGitHubModal isOpen={true} onClose={vi.fn()} />);

    const connectBtn = screen.getByTestId('btn-connect') as HTMLButtonElement;
    expect(connectBtn.disabled).toBe(true);

    const repoInput = screen.getByLabelText(/Repository Name/i);
    const tokenInput = screen.getByLabelText(/Personal Access Token/i);

    // Type invalid repo format
    fireEvent.change(repoInput, { target: { value: 'invalid-repo-without-slash' } });
    fireEvent.blur(repoInput);
    expect(
      screen.getByText(/Please enter a valid repository in 'owner\/repo' format/i),
    ).toBeDefined();
    expect(connectBtn.disabled).toBe(true);

    // Type valid repo format
    fireEvent.change(repoInput, { target: { value: 'octocat/hello-world' } });
    expect(
      screen.queryByText(/Please enter a valid repository in 'owner\/repo' format/i),
    ).toBeNull();
    // Still disabled because token is empty
    expect(connectBtn.disabled).toBe(true);

    // Type valid token
    fireEvent.change(tokenInput, { target: { value: 'ghp_secrettoken123' } });
    expect(connectBtn.disabled).toBe(false);
  });

  it('handles successful repository connection and calls onConnected', async () => {
    const onConnected = vi.fn();
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        connected: true,
        repoFullName: 'octocat/notes',
        defaultBranch: 'main',
      }),
    });

    render(
      <ConnectGitHubModal
        isOpen={true}
        onClose={vi.fn()}
        onConnected={onConnected}
        fetchFn={mockFetch}
      />,
    );

    const repoInput = screen.getByLabelText(/Repository Name/i);
    const tokenInput = screen.getByLabelText(/Personal Access Token/i);
    const publicCheckbox = screen.getByLabelText(/Allow Public Repository/i);
    const connectBtn = screen.getByTestId('btn-connect');

    fireEvent.change(repoInput, { target: { value: 'octocat/notes' } });
    fireEvent.change(tokenInput, { target: { value: 'ghp_123456789' } });
    fireEvent.click(publicCheckbox);

    fireEvent.click(connectBtn);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/personal-workspace/github/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoFullName: 'octocat/notes',
          token: 'ghp_123456789',
          allowPublic: true,
        }),
      });
    });

    await waitFor(() => {
      expect(onConnected).toHaveBeenCalledWith({
        repoFullName: 'octocat/notes',
        defaultBranch: 'main',
      });
      expect(screen.getByTestId('connected-banner')).toBeDefined();
      expect(screen.getByTestId('btn-disconnect')).toBeDefined();
    });
  });

  it('displays error banner when connection fails', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({
        ok: false,
        error: 'Repository octocat/private-notes does not exist or token lacks permission',
      }),
    });

    render(
      <ConnectGitHubModal
        isOpen={true}
        onClose={vi.fn()}
        fetchFn={mockFetch}
      />,
    );

    const repoInput = screen.getByLabelText(/Repository Name/i);
    const tokenInput = screen.getByLabelText(/Personal Access Token/i);
    const connectBtn = screen.getByTestId('btn-connect');

    fireEvent.change(repoInput, { target: { value: 'octocat/private-notes' } });
    fireEvent.change(tokenInput, { target: { value: 'ghp_badtoken' } });

    fireEvent.click(connectBtn);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeDefined();
      expect(
        screen.getByText(
          'Repository octocat/private-notes does not exist or token lacks permission',
        ),
      ).toBeDefined();
    });
  });

  it('handles disconnect action and calls onDisconnected', async () => {
    const onDisconnected = vi.fn();
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    });

    render(
      <ConnectGitHubModal
        isOpen={true}
        onClose={vi.fn()}
        isConnected={true}
        initialRepo="octocat/connected-repo"
        onDisconnected={onDisconnected}
        fetchFn={mockFetch}
      />,
    );

    // Connected state elements
    expect(screen.getByTestId('connected-banner')).toBeDefined();
    expect(screen.getByText('octocat/connected-repo')).toBeDefined();

    const disconnectBtn = screen.getByTestId('btn-disconnect');
    fireEvent.click(disconnectBtn);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/personal-workspace/github/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      expect(onDisconnected).toHaveBeenCalled();
      expect(screen.queryByTestId('connected-banner')).toBeNull();
    });
  });

  it('triggers onClose when Close button, X button, backdrop, or Escape key is pressed', () => {
    const onClose = vi.fn();
    render(<ConnectGitHubModal isOpen={true} onClose={onClose} />);

    // 1. Close button in footer
    const closeBtn = screen.getByTestId('btn-close');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);

    // 2. X button in header
    const xBtn = screen.getByLabelText('Close dialog');
    fireEvent.click(xBtn);
    expect(onClose).toHaveBeenCalledTimes(2);

    // 3. Backdrop click
    const backdrop = screen.getByTestId('modal-backdrop');
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(3);

    // 4. Escape key press
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(4);
  });
});
