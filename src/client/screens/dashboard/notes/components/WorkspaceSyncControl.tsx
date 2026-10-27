'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { SyncStatusBadge } from '@/src/client/personal-workspace/ui/sync-status-badge';
import { ConnectGitHubModal, Github } from '@/src/client/personal-workspace/ui/connect-github-modal';
import { getLocalWorkspace } from '@/src/client/personal-workspace/local/facade';
import { SyncCoordinator } from '@/src/client/personal-workspace/sync/coordinator';
import type { SyncSummary } from '@/src/shared/personal-workspace/contracts';
import { notesRepository } from '../repositories/notes.repository';

interface GitHubStatusInfo {
  connected: boolean;
  repoFullName?: string;
  defaultBranch?: string;
  isPrivate?: boolean;
}

const DEFAULT_SYNC_SUMMARY: SyncSummary = {
  status: 'offline',
  pendingMutations: 0,
  lastSyncedAt: null,
  conflictCount: 0,
};

export function WorkspaceSyncControl({ userId }: { userId?: string | null }) {
  const activeUserId = userId || 'local-user';
  const [githubStatus, setGithubStatus] = useState<GitHubStatusInfo | null>(null);
  const [syncSummary, setSyncSummary] = useState<SyncSummary>(DEFAULT_SYNC_SUMMARY);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isOAuthLoading, setIsOAuthLoading] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const coordinatorRef = useRef<SyncCoordinator | null>(null);

  // 1. Fetch remote GitHub connection status
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/personal-workspace/github/status');
      if (res.ok) {
        const data = (await res.json()) as GitHubStatusInfo;
        setGithubStatus(data);
        return data;
      } else {
        const fallback: GitHubStatusInfo = { connected: false };
        setGithubStatus(fallback);
        return fallback;
      }
    } catch {
      const fallback: GitHubStatusInfo = { connected: false };
      setGithubStatus(fallback);
      return fallback;
    }
  }, []);

  // 2. Setup LocalWorkspace and SyncCoordinator
  useEffect(() => {
    let isMounted = true;
    const facade = getLocalWorkspace(activeUserId);

    facade
      .open({ userId: activeUserId })
      .then(async () => {
        if (!isMounted) return;

        // Check if IndexedDB has notes; if empty, seed from notesRepository
        const idbNotes = await facade.getRepository().getAllNotes();
        if (idbNotes.length === 0) {
          const initialState = notesRepository.getInitialState(activeUserId);
          if (initialState.notes.length > 0 || initialState.notebooks.length > 0) {
            await notesRepository.syncWithLocalWorkspace(initialState, activeUserId);
          }
        }

        const localSummary = await facade.getSyncSummary();
        if (isMounted) setSyncSummary(localSummary);

        // Check remote GitHub status
        const remote = await fetchStatus();
        if (!isMounted) return;

        if (remote.connected) {
          const coordinator = new SyncCoordinator(facade.getRepository(), {
            autoSyncIntervalMs: 20000,
          });
          coordinatorRef.current = coordinator;

          coordinator.subscribe((summary) => {
            if (isMounted) setSyncSummary(summary);
          });

          coordinator.startAutoSync();
          // Initial background sync
          coordinator.syncNow().catch(() => {});
        } else {
          setSyncSummary((prev) => ({
            ...prev,
            status: prev.pendingMutations > 0 ? 'queued' : 'offline',
          }));
        }
      })
      .catch((err) => {
        console.warn('[WorkspaceSyncControl] Local workspace error:', err);
      });

    // Handle return from redirect OAuth flow (?github_connected=true)
    if (typeof window !== 'undefined' && window.location.search.includes('github_connected=true')) {
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
      fetchStatus();
    }

    // Subscribe to local mutations
    const unsubscribe = facade.subscribe(async () => {
      if (!isMounted) return;
      try {
        const summary = await facade.getSyncSummary();
        if (isMounted) {
          setSyncSummary(summary);
          // Trigger coordinator sync if connected
          if (coordinatorRef.current) {
            coordinatorRef.current.syncNow().catch(() => {});
          }
        }
      } catch {}
    });

    return () => {
      isMounted = false;
      unsubscribe();
      if (coordinatorRef.current) {
        coordinatorRef.current.stopAutoSync();
        coordinatorRef.current = null;
      }
    };
  }, [activeUserId, fetchStatus]);

  // GitHub App installation flow: opens GitHub's native repo picker popup.
  // GitHub renders: account selector → repo access selector → permission breakdown → "Install & Authorize"
  const handle1ClickConnect = useCallback(() => {
    setIsOAuthLoading(true);
    setOauthError(null);

    const width = 1024;
    const height = 800;
    const left = typeof window !== 'undefined' ? window.screenX + (window.outerWidth - width) / 2 : 0;
    const top = typeof window !== 'undefined' ? window.screenY + (window.outerHeight - height) / 2 : 0;

    const authUrl = '/api/personal-workspace/github/app/install';
    const popup =
      typeof window !== 'undefined' && window.open
        ? window.open(
            authUrl,
            'UndoneGitHubApp',
            `width=${width},height=${height},left=${left},top=${top},status=no,toolbar=no,menubar=no`,
          )
        : null;

    if (!popup) {
      if (typeof window !== 'undefined') {
        window.location.href = authUrl;
      }
      return;
    }

    const handleMessage = (event: MessageEvent) => {
      if (typeof window !== 'undefined' && event.origin !== window.location.origin) return;
      if (event.data?.type === 'UNDONE_GITHUB_AUTH_SUCCESS') {
        const resolvedRepo = event.data.repoFullName || 'undone-notes';
        setGithubStatus({ connected: true, repoFullName: resolvedRepo });
        setIsOAuthLoading(false);
        setOauthError(null);
        if (typeof window !== 'undefined') {
          window.removeEventListener('message', handleMessage);
        }

        const facade = getLocalWorkspace(activeUserId);
        const coordinator = new SyncCoordinator(facade.getRepository(), {
          autoSyncIntervalMs: 20000,
        });
        coordinatorRef.current = coordinator;
        coordinator.subscribe(setSyncSummary);
        coordinator.startAutoSync();
        facade.getRepository().getAllNotes().then(async (idbNotes) => {
          if (idbNotes.length === 0) {
            const initialState = notesRepository.getInitialState(activeUserId);
            if (initialState.notes.length > 0 || initialState.notebooks.length > 0) {
              await notesRepository.syncWithLocalWorkspace(initialState, activeUserId);
            }
          }
          coordinator.syncNow().catch(() => {});
        });
      } else if (event.data?.type === 'UNDONE_GITHUB_AUTH_ERROR') {
        setOauthError(event.data.description || event.data.error || 'GitHub authorization failed');
        setIsOAuthLoading(false);
        if (typeof window !== 'undefined') {
          window.removeEventListener('message', handleMessage);
        }
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('message', handleMessage);
    }

    const checkClosed = setInterval(() => {
      if (popup?.closed) {
        clearInterval(checkClosed);
        if (typeof window !== 'undefined') {
          window.removeEventListener('message', handleMessage);
        }
        setIsOAuthLoading(false);
        fetchStatus();
      }
    }, 1000);
  }, [activeUserId, fetchStatus]);

  // Export recovery backup bundle
  const handleExportRecovery = useCallback(async () => {
    const facade = getLocalWorkspace(activeUserId);
    const blob = await facade.exportRecoveryBundle();
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
      a.download = `undone-notes-backup-${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }, [activeUserId]);

  // Trigger manual sync
  const handleSyncNow = useCallback(async () => {
    if (coordinatorRef.current) {
      const currentState = notesRepository.getInitialState(activeUserId);
      await notesRepository.syncWithLocalWorkspace(currentState, activeUserId);
      await coordinatorRef.current.syncNow();
    }
  }, [activeUserId]);

  const isConnected = Boolean(githubStatus?.connected);

  return (
    <div className="flex items-center gap-2">
      {/* 1. Connect / Connected Repository Trigger Button */}
      {isConnected ? (
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-1.5 h-[35px] px-3 rounded-lg border border-emerald-900/60 bg-emerald-950/30 hover:bg-emerald-950/50 text-emerald-300 font-mono text-xs transition-colors cursor-pointer shadow-xs"
          title={`Connected to GitHub: ${githubStatus?.repoFullName || 'repository'}. Click to manage settings.`}
          data-testid="github-connected-btn"
        >
          <Github className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="truncate max-w-[140px]">{githubStatus?.repoFullName}</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
        </button>
      ) : (
        <div className="inline-flex items-center rounded-lg border border-indigo-500/40 bg-indigo-950/40 shadow-xs divide-x divide-indigo-500/30">
          <button
            type="button"
            onClick={handle1ClickConnect}
            disabled={isOAuthLoading}
            className="inline-flex items-center gap-1.5 h-[35px] px-3 text-indigo-200 hover:text-white hover:bg-indigo-900/50 text-xs font-medium transition-all cursor-pointer disabled:opacity-60"
            title="Connect GitHub: 1-click authorize & select repository"
            data-testid="connect-github-btn"
          >
            {isOAuthLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400 shrink-0" />
                <span>Connecting...</span>
              </>
            ) : (
              <>
                <Github className="w-3.5 h-3.5 shrink-0" />
                <span>Connect GitHub</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="h-[35px] px-2 text-indigo-300 hover:text-white hover:bg-indigo-900/50 text-xs transition-colors cursor-pointer"
            title="Manual repository settings or personal access token"
            aria-label="GitHub settings & manual token setup"
            data-testid="github-settings-btn"
          >
            ⚙
          </button>
        </div>
      )}

      {/* 2. Interactive Status Badge (Shows Synced, Syncing, Offline, Conflicts) */}
      <SyncStatusBadge
        summary={syncSummary}
        onReconnect={() => setIsModalOpen(true)}
        onExportRecovery={handleExportRecovery}
        className="shrink-0"
      />

      {/* Error Toast if OAuth fails */}
      {oauthError && !isConnected && (
        <div
          role="alert"
          className="fixed bottom-4 right-4 z-50 p-3.5 rounded-xl bg-rose-950/95 border border-rose-800 text-rose-200 text-xs shadow-2xl flex items-center gap-2.5 max-w-sm transition-opacity duration-200"
        >
          <span className="flex-1">{oauthError}</span>
          <button
            type="button"
            onClick={() => setOauthError(null)}
            className="p-1 text-rose-400 hover:text-white"
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      )}

      {/* 3. GitHub Workspace Settings Modal */}
      <ConnectGitHubModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          fetchStatus();
        }}
        isConnected={isConnected}
        initialRepo={githubStatus?.repoFullName || ''}
        isSyncing={syncSummary.status === 'syncing'}
        lastSyncedAt={syncSummary.lastSyncedAt}
        onSyncNow={handleSyncNow}
        onExportBackup={handleExportRecovery}
        onConnected={({ repoFullName }) => {
          setGithubStatus({ connected: true, repoFullName });
          fetchStatus();
          // Initialize coordinator immediately
          const facade = getLocalWorkspace(activeUserId);
          const coordinator = new SyncCoordinator(facade.getRepository(), {
            autoSyncIntervalMs: 20000,
          });
          coordinatorRef.current = coordinator;
          coordinator.subscribe(setSyncSummary);
          coordinator.startAutoSync();
          coordinator.syncNow().catch(() => {});
        }}
        onDisconnected={() => {
          setGithubStatus({ connected: false });
          if (coordinatorRef.current) {
            coordinatorRef.current.stopAutoSync();
            coordinatorRef.current = null;
          }
          setSyncSummary((prev) => ({
            ...prev,
            status: 'offline',
          }));
        }}
      />
    </div>
  );
}
