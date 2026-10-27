'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { SyncStatusBadge } from '@/src/client/personal-workspace/ui/sync-status-badge';
import { ConnectGitHubModal, Github } from '@/src/client/personal-workspace/ui/connect-github-modal';
import { getLocalWorkspace } from '@/src/client/personal-workspace/local/facade';
import { SyncCoordinator } from '@/src/client/personal-workspace/sync/coordinator';
import type { SyncSummary } from '@/src/shared/personal-workspace/contracts';

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

  const isConnected = Boolean(githubStatus?.connected);

  return (
    <div className="flex items-center gap-2">
      {/* 1. Connect / Connected Repository Trigger Button */}
      {isConnected ? (
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-1.5 h-[35px] px-3 rounded-lg border border-emerald-900/60 bg-emerald-950/30 hover:bg-emerald-950/50 text-emerald-300 font-mono text-xs transition-colors cursor-pointer shadow-xs"
          title={`Connected to GitHub: ${githubStatus?.repoFullName || 'repository'}. Click to configure.`}
          data-testid="github-connected-btn"
        >
          <Github className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="truncate max-w-[140px]">{githubStatus?.repoFullName}</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-1.5 h-[35px] px-3 rounded-lg border border-indigo-500/40 bg-indigo-950/40 hover:bg-indigo-900/50 text-indigo-200 text-xs font-medium transition-all cursor-pointer shadow-xs hover:border-indigo-400 hover:text-white"
          title="Connect your GitHub repository for continuous versioned backups"
          data-testid="connect-github-btn"
        >
          <Github className="w-3.5 h-3.5 shrink-0" />
          <span>Connect GitHub</span>
        </button>
      )}

      {/* 2. Interactive Status Badge (Shows Synced, Syncing, Offline, Conflicts) */}
      <SyncStatusBadge
        summary={syncSummary}
        onReconnect={() => setIsModalOpen(true)}
        onExportRecovery={handleExportRecovery}
        className="shrink-0"
      />

      {/* 3. Connect GitHub Modal */}
      <ConnectGitHubModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          fetchStatus();
        }}
        isConnected={isConnected}
        initialRepo={githubStatus?.repoFullName || ''}
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
