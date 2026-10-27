// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SyncStatusBadge, formatLastSyncedAt } from '../sync-status-badge';
import type { SyncSummary } from '@/src/shared/personal-workspace/contracts';

afterEach(cleanup);

describe('formatLastSyncedAt helper', () => {
  it('returns "Never" when timestamp is null or undefined or invalid', () => {
    expect(formatLastSyncedAt(null)).toBe('Never');
    expect(formatLastSyncedAt(undefined)).toBe('Never');
    expect(formatLastSyncedAt('invalid-date')).toBe('Never');
  });

  it('formats recent timestamps human-readably', () => {
    const now = new Date();
    expect(formatLastSyncedAt(now.toISOString())).toBe('Just now');

    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    expect(formatLastSyncedAt(twoMinutesAgo.toISOString())).toBe('2m ago');

    const twoHoursAgo = new Date(Date.now() - 2 * 3600 * 1000);
    expect(formatLastSyncedAt(twoHoursAgo.toISOString())).toBe('2h ago');
  });
});

describe('SyncStatusBadge - Status Variants and UI Indicators', () => {
  it('renders "saving_locally" variant with spinner and dot', () => {
    const summary: SyncSummary = {
      status: 'saving_locally',
      pendingMutations: 0,
      lastSyncedAt: null,
      conflictCount: 0,
    };

    render(<SyncStatusBadge summary={summary} />);

    expect(screen.getByText('Saving locally...')).toBeDefined();
    expect(screen.getByTestId('icon-saving_locally')).toBeDefined();
    expect(screen.getByTestId('status-dot')).toBeDefined();
  });

  it('renders "saved_locally" variant with check icon', () => {
    const summary: SyncSummary = {
      status: 'saved_locally',
      pendingMutations: 0,
      lastSyncedAt: null,
      conflictCount: 0,
    };

    render(<SyncStatusBadge summary={summary} />);

    expect(screen.getByText('Saved on this device')).toBeDefined();
    expect(screen.getByTestId('icon-saved_locally')).toBeDefined();
  });

  it('renders "queued" variant with cloud upload icon and pending mutations count', () => {
    const summary: SyncSummary = {
      status: 'queued',
      pendingMutations: 5,
      lastSyncedAt: null,
      conflictCount: 0,
    };

    render(<SyncStatusBadge summary={summary} />);

    expect(screen.getByText('Changes queued (5)')).toBeDefined();
    expect(screen.getByTestId('icon-queued')).toBeDefined();
  });

  it('renders "syncing" variant with animated pulse cloud icon', () => {
    const summary: SyncSummary = {
      status: 'syncing',
      pendingMutations: 2,
      lastSyncedAt: null,
      conflictCount: 0,
    };

    render(<SyncStatusBadge summary={summary} />);

    expect(screen.getByText('Syncing with GitHub...')).toBeDefined();
    expect(screen.getByTestId('icon-syncing')).toBeDefined();
  });

  it('renders "synced" variant with green check cloud icon', () => {
    const summary: SyncSummary = {
      status: 'synced',
      pendingMutations: 0,
      lastSyncedAt: '2026-10-27T05:00:00.000Z',
      conflictCount: 0,
    };

    render(<SyncStatusBadge summary={summary} />);

    expect(screen.getByText('Synced')).toBeDefined();
    expect(screen.getByTestId('icon-synced')).toBeDefined();
  });

  it('renders "offline" variant with cloud-off icon', () => {
    const summary: SyncSummary = {
      status: 'offline',
      pendingMutations: 1,
      lastSyncedAt: null,
      conflictCount: 0,
    };

    render(<SyncStatusBadge summary={summary} />);

    expect(screen.getByText('Offline (saved locally)')).toBeDefined();
    expect(screen.getByTestId('icon-offline')).toBeDefined();
  });

  it('renders "conflict" variant with orange alert icon and triggers conflict resolution', () => {
    const onResolveConflict = vi.fn();
    const summary: SyncSummary = {
      status: 'conflict',
      pendingMutations: 1,
      lastSyncedAt: null,
      conflictCount: 2,
    };

    render(
      <SyncStatusBadge
        summary={summary}
        onResolveConflict={onResolveConflict}
      />,
    );

    expect(screen.getByText('Conflict detected')).toBeDefined();
    expect(screen.getByTestId('icon-conflict')).toBeDefined();

    const resolveBtn = screen.getByTestId('resolve-conflict-trigger');
    expect(resolveBtn).toBeDefined();
    fireEvent.click(resolveBtn);
    expect(onResolveConflict).toHaveBeenCalledTimes(1);
  });

  it('renders "reconnect_required" variant with key icon and triggers reconnect action', () => {
    const onReconnect = vi.fn();
    const summary: SyncSummary = {
      status: 'reconnect_required',
      pendingMutations: 3,
      lastSyncedAt: null,
      conflictCount: 0,
    };

    render(
      <SyncStatusBadge
        summary={summary}
        onReconnect={onReconnect}
      />,
    );

    expect(screen.getByText('Reconnect required')).toBeDefined();
    expect(screen.getByTestId('icon-reconnect_required')).toBeDefined();

    const reconnectBtn = screen.getByTestId('reconnect-trigger');
    expect(reconnectBtn).toBeDefined();
    fireEvent.click(reconnectBtn);
    expect(onReconnect).toHaveBeenCalledTimes(1);
  });

  it('renders "error" variant with red alert icon and "Export backup" button', () => {
    const onExportRecovery = vi.fn();
    const summary: SyncSummary = {
      status: 'error',
      pendingMutations: 1,
      lastSyncedAt: null,
      conflictCount: 0,
      errorMessage: 'IndexedDB transaction quota exceeded',
    };

    render(
      <SyncStatusBadge
        summary={summary}
        onExportRecovery={onExportRecovery}
      />,
    );

    expect(screen.getByText('Local save failed')).toBeDefined();
    expect(screen.getByTestId('icon-error')).toBeDefined();

    const exportBtn = screen.getByTestId('export-backup-btn');
    expect(exportBtn).toBeDefined();
    expect(exportBtn.textContent).toBe('Export backup');

    fireEvent.click(exportBtn);
    expect(onExportRecovery).toHaveBeenCalledTimes(1);
  });

  it('renders "idle" variant when no operations are pending', () => {
    const summary: SyncSummary = {
      status: 'idle',
      pendingMutations: 0,
      lastSyncedAt: null,
      conflictCount: 0,
    };

    render(<SyncStatusBadge summary={summary} />);
    expect(screen.getByText('Idle')).toBeDefined();
    expect(screen.getByTestId('icon-idle')).toBeDefined();
  });
});

describe('SyncStatusBadge - Interactive Popover and Details', () => {
  it('toggles the popover when clicking the badge', () => {
    const summary: SyncSummary = {
      status: 'saved_locally',
      pendingMutations: 0,
      lastSyncedAt: null,
      conflictCount: 0,
    };

    render(<SyncStatusBadge summary={summary} />);

    // Initially popover is closed
    expect(screen.queryByTestId('sync-status-popover')).toBeNull();

    // Click badge to open
    const badge = screen.getByRole('button', { name: /Sync status:/i });
    fireEvent.click(badge);

    expect(screen.getByTestId('sync-status-popover')).toBeDefined();
    expect(screen.getByTestId('status-description').textContent).toContain(
      'All changes are committed to local IndexedDB storage.',
    );

    // Close button works
    const closeBtn = screen.getByTestId('close-popover-btn');
    fireEvent.click(closeBtn);
    expect(screen.queryByTestId('sync-status-popover')).toBeNull();
  });

  it('displays last synced timestamp and pending mutations count in popover', () => {
    const summary: SyncSummary = {
      status: 'synced',
      pendingMutations: 0,
      lastSyncedAt: null,
      conflictCount: 0,
    };

    render(<SyncStatusBadge summary={summary} />);

    const badge = screen.getByRole('button', { name: /Sync status:/i });
    fireEvent.click(badge);

    expect(screen.getByTestId('last-synced-time').textContent).toBe('Never');
    expect(screen.getByTestId('pending-mutations-count').textContent).toBe('0');
  });

  it('displays unsaved buffer warning if isDirty is true', () => {
    const summary: SyncSummary = {
      status: 'saving_locally',
      pendingMutations: 0,
      lastSyncedAt: null,
      conflictCount: 0,
    };

    render(
      <SyncStatusBadge
        summary={summary}
        isDirty={true}
      />,
    );

    const badge = screen.getByRole('button', { name: /Sync status:/i });
    fireEvent.click(badge);

    const warning = screen.getByTestId('unsaved-buffer-warning');
    expect(warning).toBeDefined();
    expect(warning.textContent).toContain('Unsaved buffer warning');
    expect(warning.textContent).toContain('not crash-safe until committed locally');
  });

  it('displays unsaved buffer warning if hasUnsavedBuffer is true', () => {
    const summary: SyncSummary = {
      status: 'saved_locally',
      pendingMutations: 0,
      lastSyncedAt: null,
      conflictCount: 0,
    };

    render(
      <SyncStatusBadge
        summary={summary}
        hasUnsavedBuffer={true}
      />,
    );

    const badge = screen.getByRole('button', { name: /Sync status:/i });
    fireEvent.click(badge);

    expect(screen.getByTestId('unsaved-buffer-warning')).toBeDefined();
  });

  it('does NOT display unsaved buffer warning when clean', () => {
    const summary: SyncSummary = {
      status: 'saved_locally',
      pendingMutations: 0,
      lastSyncedAt: null,
      conflictCount: 0,
    };

    render(
      <SyncStatusBadge
        summary={summary}
        isDirty={false}
        hasUnsavedBuffer={false}
      />,
    );

    const badge = screen.getByRole('button', { name: /Sync status:/i });
    fireEvent.click(badge);

    expect(screen.queryByTestId('unsaved-buffer-warning')).toBeNull();
  });

  it('displays error details in popover when errorMessage is provided', () => {
    const summary: SyncSummary = {
      status: 'error',
      pendingMutations: 1,
      lastSyncedAt: null,
      conflictCount: 0,
      errorMessage: 'Local storage transaction aborted unexpectedly',
    };

    render(<SyncStatusBadge summary={summary} />);

    const badge = screen.getByRole('button', { name: /Sync status:/i });
    fireEvent.click(badge);

    const errorBox = screen.getByTestId('error-message-box');
    expect(errorBox).toBeDefined();
    expect(errorBox.textContent).toContain('Local storage transaction aborted unexpectedly');
  });

  it('displays conflict count when conflictCount > 0', () => {
    const summary: SyncSummary = {
      status: 'conflict',
      pendingMutations: 2,
      lastSyncedAt: null,
      conflictCount: 3,
    };

    render(<SyncStatusBadge summary={summary} />);

    const badge = screen.getByRole('button', { name: /Sync status:/i });
    fireEvent.click(badge);

    expect(screen.getByTestId('conflict-count').textContent).toBe('3');
  });

  it('allows actions inside popover to trigger corresponding callbacks', () => {
    const onExportRecovery = vi.fn();
    const onResolveConflict = vi.fn();

    const summary: SyncSummary = {
      status: 'conflict',
      pendingMutations: 2,
      lastSyncedAt: null,
      conflictCount: 1,
    };

    render(
      <SyncStatusBadge
        summary={summary}
        onExportRecovery={onExportRecovery}
        onResolveConflict={onResolveConflict}
      />,
    );

    const badge = screen.getByRole('button', { name: /Sync status:/i });
    fireEvent.click(badge);

    const popoverExport = screen.getByTestId('popover-export-backup-btn');
    fireEvent.click(popoverExport);
    expect(onExportRecovery).toHaveBeenCalledTimes(1);

    // Reopen popover and click resolve conflict
    fireEvent.click(badge);
    const popoverResolve = screen.getByTestId('popover-resolve-conflict-btn');
    fireEvent.click(popoverResolve);
    expect(onResolveConflict).toHaveBeenCalledTimes(1);
  });

  it('closes popover on Escape key', () => {
    const summary: SyncSummary = {
      status: 'synced',
      pendingMutations: 0,
      lastSyncedAt: null,
      conflictCount: 0,
    };

    render(<SyncStatusBadge summary={summary} />);

    const badge = screen.getByRole('button', { name: /Sync status:/i });
    fireEvent.click(badge);
    expect(screen.getByTestId('sync-status-popover')).toBeDefined();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('sync-status-popover')).toBeNull();
  });

  it('renders repository info and manage access link inside popover', () => {
    const summary: SyncSummary = {
      status: 'synced',
      pendingMutations: 0,
      lastSyncedAt: null,
      conflictCount: 0,
    };

    const { rerender } = render(
      <SyncStatusBadge
        summary={summary}
        repoFullName="octocat/undone-notes"
        manageUrl="https://github.com/settings/installations/54321"
      />,
    );

    const badge = screen.getByRole('button', { name: /Sync status:/i });
    fireEvent.click(badge);

    expect(screen.getByTestId('popover-repo-info')).toBeDefined();
    expect(screen.getByText('octocat/undone-notes')).toBeDefined();
    const repoLink = screen.getByTestId('popover-repo-link') as HTMLAnchorElement;
    expect(repoLink.href).toBe('https://github.com/octocat/undone-notes');

    const manageLink = screen.getByTestId('popover-manage-link') as HTMLAnchorElement;
    expect(manageLink.href).toBe('https://github.com/settings/installations/54321');

    // Test PAT fallback
    rerender(
      <SyncStatusBadge
        summary={summary}
        repoFullName="octocat/undone-notes"
        authType="pat"
      />,
    );

    const patLink = screen.getByTestId('popover-pat-link') as HTMLAnchorElement;
    expect(patLink).toBeDefined();
    expect(patLink.href).toBe('https://github.com/settings/tokens');
  });

  it('renders and handles "Sync with GitHub now" button in popover', async () => {
    const onSyncNow = vi.fn().mockResolvedValue(undefined);
    const summary: SyncSummary = {
      status: 'synced',
      pendingMutations: 0,
      lastSyncedAt: null,
      conflictCount: 0,
    };

    render(
      <SyncStatusBadge
        summary={summary}
        onSyncNow={onSyncNow}
      />,
    );

    const badge = screen.getByRole('button', { name: /Sync status:/i });
    fireEvent.click(badge);

    const syncNowBtn = screen.getByTestId('popover-sync-now-btn');
    expect(syncNowBtn).toBeDefined();

    fireEvent.click(syncNowBtn);
    expect(onSyncNow).toHaveBeenCalledTimes(1);
    // Should close popover on click
    expect(screen.queryByTestId('sync-status-popover')).toBeNull();
  });
});
