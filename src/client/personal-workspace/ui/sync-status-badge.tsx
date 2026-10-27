'use client';

import React, { useState, useRef, useEffect, useId } from 'react';
import clsx from 'clsx';
import {
  Loader2,
  Check,
  CloudUpload,
  Cloud,
  CloudCheck,
  CloudOff,
  AlertTriangle,
  Key,
  AlertCircle,
  X,
  Download,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import type { SyncSummary } from '@/src/shared/personal-workspace/contracts';

export interface SyncStatusBadgeProps {
  summary: SyncSummary;
  onExportRecovery?: () => void;
  onReconnect?: () => void;
  onResolveConflict?: () => void;
  isDirty?: boolean;
  hasUnsavedBuffer?: boolean;
  className?: string;
  repoFullName?: string | null;
  installationId?: string | null;
  manageUrl?: string | null;
  authType?: 'github_app' | 'pat' | 'oauth';
  onSyncNow?: () => void | Promise<void>;
  onDisconnect?: () => void | Promise<void>;
}

export function formatLastSyncedAt(iso: string | null | undefined): string {
  if (!iso) return 'Never';
  const date = new Date(iso);
  if (isNaN(date.getTime())) return 'Never';

  const now = Date.now();
  const diffMs = now - date.getTime();
  if (diffMs < 0) return 'Just now';
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 5) return 'Just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface StatusConfig {
  label: string;
  description: string;
  icon: React.ReactNode;
  badgeClass: string;
  dotClass?: string;
  roleIconClass?: string;
}

export function getStatusConfig(summary: SyncSummary): StatusConfig {
  const { status, pendingMutations } = summary;

  switch (status) {
    case 'saving_locally':
      return {
        label: 'Saving locally...',
        description: 'Saving changes to local IndexedDB storage on this device.',
        icon: (
          <div className="flex items-center gap-1">
            <span
              className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"
              data-testid="status-dot"
            />
            <Loader2
              className="w-3.5 h-3.5 animate-spin text-amber-500"
              data-testid="icon-saving_locally"
            />
          </div>
        ),
        badgeClass:
          'text-amber-800 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-950/40 dark:border-amber-800/60',
      };

    case 'saved_locally':
      return {
        label: 'Saved on this device',
        description: 'All changes are committed to local IndexedDB storage.',
        icon: (
          <Check
            className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-300"
            data-testid="icon-saved_locally"
          />
        ),
        badgeClass:
          'text-zinc-400 bg-transparent border-transparent hover:border-zinc-800 hover:bg-zinc-900/60 hover:text-zinc-200',
      };

    case 'queued':
      return {
        label: `Changes queued (${pendingMutations ?? 0})`,
        description: 'Local changes are committed and queued for GitHub sync.',
        icon: (
          <CloudUpload
            className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400"
            data-testid="icon-queued"
          />
        ),
        badgeClass:
          'text-blue-800 bg-blue-50 border-blue-200 dark:text-blue-300 dark:bg-blue-950/40 dark:border-blue-800/60',
      };

    case 'syncing':
      return {
        label: 'Syncing with GitHub...',
        description: 'Syncing committed local changes with your GitHub repository.',
        icon: (
          <Cloud
            className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 animate-pulse"
            data-testid="icon-syncing"
          />
        ),
        badgeClass:
          'text-indigo-800 bg-indigo-50 border-indigo-200 dark:text-indigo-300 dark:bg-indigo-950/40 dark:border-indigo-800/60',
      };

    case 'synced':
      return {
        label: 'Synced',
        description: 'All notes and assets are fully synchronized with GitHub.',
        icon: (
          <CloudCheck
            className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400"
            data-testid="icon-synced"
          />
        ),
        badgeClass:
          'text-zinc-400 bg-transparent border-transparent hover:border-zinc-800 hover:bg-zinc-900/60 hover:text-zinc-200',
      };

    case 'offline':
      return {
        label: 'Offline (saved locally)',
        description: 'Working offline. Your notes are safely stored on this device.',
        icon: (
          <CloudOff
            className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400"
            data-testid="icon-offline"
          />
        ),
        badgeClass:
          'text-zinc-400 bg-transparent border-transparent hover:border-zinc-800 hover:bg-zinc-900/60 hover:text-zinc-200',
      };

    case 'conflict':
      return {
        label: 'Conflict detected',
        description: 'Remote GitHub changes conflict with local edits. Action required.',
        icon: (
          <AlertTriangle
            className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400"
            data-testid="icon-conflict"
          />
        ),
        badgeClass:
          'text-orange-800 bg-orange-50 border-orange-200 dark:text-orange-300 dark:bg-orange-950/40 dark:border-orange-800/60',
      };

    case 'reconnect_required':
      return {
        label: 'Reconnect required',
        description: 'GitHub credentials expired or revoked. Please reconnect.',
        icon: (
          <Key
            className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400"
            data-testid="icon-reconnect_required"
          />
        ),
        badgeClass:
          'text-amber-800 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-950/40 dark:border-amber-800/60',
      };

    case 'reconnecting':
      return {
        label: 'Reconnecting...',
        description: 'Attempting to reconnect to GitHub repository...',
        icon: (
          <Loader2
            className="w-3.5 h-3.5 animate-spin text-amber-600 dark:text-amber-400"
            data-testid="icon-reconnecting"
          />
        ),
        badgeClass:
          'text-amber-800 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-950/40 dark:border-amber-800/60',
      };

    case 'error':
      return {
        label: 'Local save failed',
        description: 'Failed to write changes to local storage. Working buffer is preserved.',
        icon: (
          <AlertCircle
            className="w-3.5 h-3.5 text-red-600 dark:text-red-400"
            data-testid="icon-error"
          />
        ),
        badgeClass:
          'text-red-800 bg-red-50 border-red-200 dark:text-red-300 dark:bg-red-950/40 dark:border-red-800/60',
      };

    case 'idle':
    default:
      if (pendingMutations > 0) {
        return {
          label: `Changes queued (${pendingMutations})`,
          description: 'Local changes are committed and queued for GitHub sync.',
          icon: (
            <CloudUpload
              className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400"
              data-testid="icon-queued"
            />
          ),
          badgeClass:
            'text-blue-800 bg-blue-50 border-blue-200 dark:text-blue-300 dark:bg-blue-950/40 dark:border-blue-800/60',
        };
      }
      return {
        label: 'Idle',
        description: 'Ready to edit notes. All local changes are up to date.',
        icon: (
          <Check
            className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400"
            data-testid="icon-idle"
          />
        ),
        badgeClass:
          'text-zinc-600 bg-zinc-50 border-zinc-200 dark:text-zinc-400 dark:bg-zinc-800/40 dark:border-zinc-700/60',
      };
  }
}

export function SyncStatusBadge({
  summary,
  onExportRecovery,
  onReconnect,
  onResolveConflict,
  isDirty = false,
  hasUnsavedBuffer = false,
  className,
  repoFullName,
  installationId,
  manageUrl,
  authType,
  onSyncNow,
  onDisconnect,
}: SyncStatusBadgeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const popoverId = useId();

  const dirty = isDirty || hasUnsavedBuffer;
  const config = getStatusConfig(summary);
  const effectiveManageUrl =
    manageUrl ||
    (installationId ? `https://github.com/settings/installations/${installationId}` : null);

  // Close popover on outside click or escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const togglePopover = () => {
    setIsOpen((prev) => !prev);
  };

  const handleBadgeKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      togglePopover();
    }
  };

  return (
    <div
      ref={containerRef}
      className={clsx('relative inline-flex items-center text-xs font-medium', className)}
    >
      <div
        role="button"
        tabIndex={0}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-controls={isOpen ? popoverId : undefined}
        aria-label={`Sync status: ${config.label}`}
        onClick={togglePopover}
        onKeyDown={handleBadgeKeyDown}
        className={clsx(
          'group inline-flex items-center gap-1.5 h-[30px] px-2.5 rounded-md border text-[11px] font-mono transition-all duration-150 cursor-pointer select-none',
          config.badgeClass,
        )}
      >
        {config.icon}
        <span className="font-medium tracking-tight">{config.label}</span>

        {/* Status-specific direct trigger buttons on the badge */}
        {summary.status === 'error' && onExportRecovery && (
          <button
            type="button"
            data-testid="export-backup-btn"
            onClick={(e) => {
              e.stopPropagation();
              onExportRecovery();
            }}
            className="ml-1 px-1.5 py-0.5 rounded text-[11px] font-semibold bg-red-600 hover:bg-red-700 text-white transition-colors cursor-pointer"
          >
            Export backup
          </button>
        )}

        {summary.status === 'reconnect_required' && onReconnect && (
          <button
            type="button"
            data-testid="reconnect-trigger"
            onClick={(e) => {
              e.stopPropagation();
              onReconnect();
            }}
            className="ml-1 px-1.5 py-0.5 rounded text-[11px] font-semibold bg-amber-600 hover:bg-amber-700 text-white transition-colors cursor-pointer"
          >
            Reconnect
          </button>
        )}

        {summary.status === 'conflict' && onResolveConflict && (
          <button
            type="button"
            data-testid="resolve-conflict-trigger"
            onClick={(e) => {
              e.stopPropagation();
              onResolveConflict();
            }}
            className="ml-1 px-1.5 py-0.5 rounded text-[11px] font-semibold bg-orange-600 hover:bg-orange-700 text-white transition-colors cursor-pointer"
          >
            Resolve
          </button>
        )}
      </div>

      {/* Interactive popover showing sync details */}
      {isOpen && (
        <div
          id={popoverId}
          role="dialog"
          aria-label="Sync details"
          data-testid="sync-status-popover"
          className="absolute right-0 top-full mt-2 w-80 p-3.5 bg-[var(--ud-color-surface-elevated)] border border-[var(--ud-color-border-subtle)] text-[var(--ud-color-text-primary)] rounded-xl shadow-xl z-50 text-xs space-y-3"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              {config.icon}
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">{config.label}</span>
            </div>
            <button
              type="button"
              aria-label="Close sync details"
              data-testid="close-popover-btn"
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Current State Description */}
          <p
            className="text-zinc-600 dark:text-zinc-400 text-xs leading-relaxed"
            data-testid="status-description"
          >
            {config.description}
          </p>

          {/* Error Message if present */}
          {summary.errorMessage && (
            <div
              className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-400 text-xs space-y-1"
              data-testid="error-message-box"
            >
              <span className="font-semibold">Error message:</span>
              <p className="font-mono text-[11px] break-words">{summary.errorMessage}</p>
            </div>
          )}

          {/* Sync Stats: Last Synced & Pending Mutations */}
          <div className="space-y-1.5 pt-1 text-zinc-600 dark:text-zinc-400">
            <div className="flex items-center justify-between">
              <span>Last synced:</span>
              <span
                className="font-semibold text-zinc-800 dark:text-zinc-200"
                data-testid="last-synced-time"
              >
                {formatLastSyncedAt(summary.lastSyncedAt)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Pending mutations:</span>
              <span
                className="font-semibold text-zinc-800 dark:text-zinc-200"
                data-testid="pending-mutations-count"
              >
                {summary.pendingMutations}
              </span>
            </div>
            {summary.conflictCount > 0 && (
              <div className="flex items-center justify-between text-orange-600 dark:text-orange-400">
                <span>Active conflicts:</span>
                <span
                  className="font-semibold"
                  data-testid="conflict-count"
                >
                  {summary.conflictCount}
                </span>
              </div>
            )}
          </div>

          {/* Unsaved Buffer Warning if dirty */}
          {dirty && (
            <div
              className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300"
              data-testid="unsaved-buffer-warning"
            >
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
              <div className="space-y-0.5">
                <p className="font-semibold text-[11px]">Unsaved buffer warning</p>
                <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-normal">
                  Active editor contains uncommitted changes. Working buffers are not crash-safe
                  until committed locally.
                </p>
              </div>
            </div>
          )}

          {/* Connected Repo & Manage Access Info */}
          {(repoFullName || effectiveManageUrl || authType === 'pat') && (
            <div
              className="p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/60 dark:border-zinc-700/60 space-y-1.5"
              data-testid="popover-repo-info"
            >
              {repoFullName && (
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500 dark:text-zinc-400">Repository:</span>
                  <a
                    href={`https://github.com/${repoFullName}`}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="font-mono text-[11px] font-medium text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                    data-testid="popover-repo-link"
                  >
                    <span className="truncate max-w-[140px]">{repoFullName}</span>
                    <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                  </a>
                </div>
              )}
              {effectiveManageUrl ? (
                <div className="flex items-center justify-between pt-1 border-t border-zinc-200/40 dark:border-zinc-700/40">
                  <span className="text-zinc-500 dark:text-zinc-400">Permissions:</span>
                  <a
                    href={effectiveManageUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                    data-testid="popover-manage-link"
                  >
                    <span>Configure on GitHub</span>
                    <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                  </a>
                </div>
              ) : authType === 'pat' ? (
                <div className="flex items-center justify-between pt-1 border-t border-zinc-200/40 dark:border-zinc-700/40">
                  <span className="text-zinc-500 dark:text-zinc-400">Auth:</span>
                  <a
                    href="https://github.com/settings/tokens"
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                    data-testid="popover-pat-link"
                  >
                    <span>Personal Access Token</span>
                    <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                  </a>
                </div>
              ) : null}
            </div>
          )}

          {/* Actions in popover */}
          <div className="flex flex-col gap-1.5 pt-1">
            {onSyncNow && (
              <button
                type="button"
                data-testid="popover-sync-now-btn"
                onClick={async () => {
                  setIsOpen(false);
                  await onSyncNow();
                }}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg font-medium text-xs bg-indigo-600 hover:bg-indigo-700 text-white transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Sync with GitHub now
              </button>
            )}
            {onExportRecovery && (
              <button
                type="button"
                data-testid="popover-export-backup-btn"
                onClick={() => {
                  setIsOpen(false);
                  onExportRecovery();
                }}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg font-medium text-xs bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Export recovery backup
              </button>
            )}

            {summary.status === 'reconnect_required' && onReconnect && (
              <button
                type="button"
                data-testid="popover-reconnect-btn"
                onClick={() => {
                  setIsOpen(false);
                  onReconnect();
                }}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg font-medium text-xs bg-amber-600 hover:bg-amber-700 text-white transition-colors cursor-pointer"
              >
                <Key className="w-3.5 h-3.5" />
                Reconnect GitHub
              </button>
            )}

            {summary.status === 'conflict' && onResolveConflict && (
              <button
                type="button"
                data-testid="popover-resolve-conflict-btn"
                onClick={() => {
                  setIsOpen(false);
                  onResolveConflict();
                }}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg font-medium text-xs bg-orange-600 hover:bg-orange-700 text-white transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Resolve conflict
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
