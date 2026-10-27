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
    expect(screen.getAllByTestId('icon-github').length).toBeGreaterThan(0);

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

  it('handles disconnect action with confirmation prompt and calls onDisconnected', async () => {
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

    // Clicking initial Disconnect button shows confirmation
    const disconnectBtn = screen.getByTestId('btn-disconnect');
    fireEvent.click(disconnectBtn);

    expect(screen.getByText('Disconnect sync?')).toBeDefined();
    const confirmBtn = screen.getByTestId('btn-disconnect-confirm');
    expect(confirmBtn).toBeDefined();

    // Confirm disconnect
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/personal-workspace/github/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      expect(onDisconnected).toHaveBeenCalled();
      expect(screen.queryByTestId('connected-banner')).toBeNull();
    });
  });

  it('allows canceling disconnect confirmation', () => {
    const mockFetch = vi.fn();

    render(
      <ConnectGitHubModal
        isOpen={true}
        onClose={vi.fn()}
        isConnected={true}
        initialRepo="octocat/connected-repo"
        fetchFn={mockFetch}
      />,
    );

    const disconnectBtn = screen.getByTestId('btn-disconnect');
    fireEvent.click(disconnectBtn);

    expect(screen.getByText('Disconnect sync?')).toBeDefined();
    const cancelBtn = screen.getByText('Cancel');
    fireEvent.click(cancelBtn);

    // Confirmation dismissed, initial Disconnect button restored
    expect(screen.queryByText('Disconnect sync?')).toBeNull();
    expect(screen.getByTestId('btn-disconnect')).toBeDefined();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('renders Manage Access link when manageUrl or installationId is provided', () => {
    const { rerender } = render(
      <ConnectGitHubModal
        isOpen={true}
        onClose={vi.fn()}
        isConnected={true}
        initialRepo="octocat/connected-repo"
        manageUrl="https://github.com/settings/installations/12345"
      />,
    );

    const manageLink = screen.getByTestId('link-manage-access') as HTMLAnchorElement;
    expect(manageLink).toBeDefined();
    expect(manageLink.href).toBe('https://github.com/settings/installations/12345');
    expect(manageLink.target).toBe('_blank');
    expect(manageLink.rel).toContain('noreferrer');

    // Test fallback when only installationId is provided
    rerender(
      <ConnectGitHubModal
        isOpen={true}
        onClose={vi.fn()}
        isConnected={true}
        initialRepo="octocat/connected-repo"
        installationId="987654"
      />,
    );

    const fallbackManageLink = screen.getByTestId('link-manage-access') as HTMLAnchorElement;
    expect(fallbackManageLink).toBeDefined();
    expect(fallbackManageLink.href).toBe('https://github.com/settings/installations/987654');
  });

  it('renders PAT guidance when authType is pat', () => {
    render(
      <ConnectGitHubModal
        isOpen={true}
        onClose={vi.fn()}
        isConnected={true}
        initialRepo="octocat/connected-repo"
        authType="pat"
      />,
    );

    expect(screen.getByText(/Connected via Personal Access Token/i)).toBeDefined();
    const patLink = screen.getByText('Manage PATs') as HTMLAnchorElement;
    expect(patLink).toBeDefined();
    expect(patLink.href).toBe('https://github.com/settings/tokens');
  });

  it('triggers onCheckAccess when Check Access button is clicked', async () => {
    const onCheckAccess = vi.fn().mockResolvedValue(undefined);

    render(
      <ConnectGitHubModal
        isOpen={true}
        onClose={vi.fn()}
        isConnected={true}
        initialRepo="octocat/connected-repo"
        onCheckAccess={onCheckAccess}
      />,
    );

    const checkAccessBtn = screen.getByTestId('btn-check-access');
    expect(checkAccessBtn).toBeDefined();

    fireEvent.click(checkAccessBtn);

    await waitFor(() => {
      expect(onCheckAccess).toHaveBeenCalledTimes(1);
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

  it('triggers 1-Click OAuth authorization popup when Connect with GitHub is clicked', () => {
    const mockOpen = vi.fn().mockReturnValue({ closed: false });
    window.open = mockOpen;

    render(<ConnectGitHubModal isOpen={true} onClose={vi.fn()} />);

    const oauthBtn = screen.getByTestId('btn-oauth-connect');
    expect(oauthBtn).toBeDefined();

    fireEvent.click(oauthBtn);
    expect(mockOpen).toHaveBeenCalled();
    const [openedUrl, targetName] = mockOpen.mock.calls[0];
    expect(openedUrl).toContain('/api/personal-workspace/github/oauth/authorize');
    expect(targetName).toBe('UndoneGitHubOAuth');
  });

  it('handles successful OAuth postMessage event and transitions to connected state', async () => {
    const onConnected = vi.fn();
    const mockOpen = vi.fn().mockReturnValue({ closed: false });
    window.open = mockOpen;

    render(<ConnectGitHubModal isOpen={true} onClose={vi.fn()} onConnected={onConnected} />);

    const oauthBtn = screen.getByTestId('btn-oauth-connect');
    fireEvent.click(oauthBtn);

    // Simulate popup sending postMessage event
    fireEvent(
      window,
      new MessageEvent('message', {
        origin: window.location.origin,
        data: {
          type: 'UNDONE_GITHUB_AUTH_SUCCESS',
          repoFullName: 'octocat/undone-notes',
          defaultBranch: 'main',
        },
      })
    );

    await waitFor(() => {
      expect(onConnected).toHaveBeenCalledWith({
        repoFullName: 'octocat/undone-notes',
        defaultBranch: 'main',
      });
      expect(screen.getByTestId('connected-banner')).toBeDefined();
      expect(screen.getByText('octocat/undone-notes')).toBeDefined();
    });
  });
});
