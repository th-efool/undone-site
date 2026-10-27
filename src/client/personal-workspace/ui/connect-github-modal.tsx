'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Lock,
  Key,
  AlertTriangle,
  AlertCircle,
  Loader2,
  X,
  ExternalLink,
  RefreshCw,
  Download,
  ShieldCheck,
} from 'lucide-react';

export interface ConnectGitHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnected?: (info: { repoFullName: string; defaultBranch?: string }) => void;
  onDisconnected?: () => void;
  initialRepo?: string;
  isConnected?: boolean;
  baseUrl?: string;
  fetchFn?: typeof fetch;
  onSyncNow?: () => Promise<void> | void;
  onExportBackup?: () => Promise<void> | void;
  isSyncing?: boolean;
  lastSyncedAt?: number | null;
}

/**
 * Custom SVG GitHub mark conforming to brand guidelines.
 */
export function Github({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      data-testid="icon-github"
      aria-hidden="true"
    >
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

export const GithubIcon = Github;

const REPO_REGEX = /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/;

export function ConnectGitHubModal({
  isOpen,
  onClose,
  onConnected,
  onDisconnected,
  initialRepo = '',
  isConnected = false,
  baseUrl = '',
  fetchFn,
  onSyncNow,
  onExportBackup,
  isSyncing = false,
  lastSyncedAt,
}: ConnectGitHubModalProps) {
  const [repoFullName, setRepoFullName] = useState(initialRepo);
  const [token, setToken] = useState('');
  const [allowPublic, setAllowPublic] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isOAuthLoading, setIsOAuthLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(isConnected);
  const [connectedRepo, setConnectedRepo] = useState<string | null>(
    isConnected ? initialRepo || null : null,
  );
  const [touched, setTouched] = useState({ repo: false, token: false });

  const [prevProps, setPrevProps] = useState({ initialRepo, isConnected });
  if (prevProps.initialRepo !== initialRepo || prevProps.isConnected !== isConnected) {
    setPrevProps({ initialRepo, isConnected });
    if (initialRepo) {
      setRepoFullName(initialRepo);
    }
    setConnected(isConnected);
    if (isConnected && initialRepo) {
      setConnectedRepo(initialRepo);
    }
  }

  const effectiveFetch = fetchFn ?? ((...args) => globalThis.fetch(...args));

  const handleOAuthConnect = () => {
    setIsOAuthLoading(true);
    setError(null);

    const width = 1024;
    const height = 800;    const left = typeof window !== 'undefined' ? window.screenX + (window.outerWidth - width) / 2 : 0;
    const top = typeof window !== 'undefined' ? window.screenY + (window.outerHeight - height) / 2 : 0;

    const authUrl = `${baseUrl}/api/personal-workspace/github/oauth/authorize`;
    const popup =
      typeof window !== 'undefined' && window.open
        ? window.open(
            authUrl,
            'UndoneGitHubOAuth',
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
        setConnected(true);
        setConnectedRepo(resolvedRepo);
        setIsOAuthLoading(false);
        setError(null);
        if (typeof window !== 'undefined') {
          window.removeEventListener('message', handleMessage);
        }
        onConnected?.({
          repoFullName: resolvedRepo,
          defaultBranch: event.data.defaultBranch || 'main',
        });
      } else if (event.data?.type === 'UNDONE_GITHUB_AUTH_ERROR') {
        setError(event.data.description || event.data.error || 'GitHub authorization failed');
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
      }
    }, 1000);
  };

  // Handle escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        onClose();
      }
    },
    [isLoading, onClose],
  );

  useEffect(() => {
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const isRepoValid = REPO_REGEX.test(repoFullName.trim());
  const isTokenValid = token.trim().length > 0;
  const showRepoError = touched.repo && !isRepoValid;
  const showTokenError = touched.token && !isTokenValid;

  const canConnect = isRepoValid && isTokenValid && !isLoading;

  const handleConnect = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setTouched({ repo: true, token: true });

    if (!isRepoValid || !isTokenValid) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const url = `${baseUrl}/api/personal-workspace/github/connect`;
      const res = await effectiveFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoFullName: repoFullName.trim(),
          token: token.trim(),
          allowPublic,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        connected?: boolean;
        repoFullName?: string;
        defaultBranch?: string;
        error?: string;
      };

      if (res.ok && data.ok) {
        const resolvedRepo = data.repoFullName || repoFullName.trim();
        setConnected(true);
        setConnectedRepo(resolvedRepo);
        setToken('');
        setError(null);
        onConnected?.({
          repoFullName: resolvedRepo,
          defaultBranch: data.defaultBranch || 'main',
        });
      } else {
        setError(data.error || `Connection failed (HTTP ${res.status})`);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Network error occurred while connecting to GitHub',
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const url = `${baseUrl}/api/personal-workspace/github/disconnect`;
      const res = await effectiveFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };

      if (res.ok && data.ok !== false) {
        setConnected(false);
        setConnectedRepo(null);
        setToken('');
        setError(null);
        onDisconnected?.();
      } else {
        setError(data.error || `Failed to disconnect (HTTP ${res.status})`);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Network error occurred while disconnecting repository',
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity duration-200"
      data-testid="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="connect-github-title"
        className="w-full max-w-md overflow-hidden rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl text-zinc-900 dark:text-zinc-100 transition-all"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800/80 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200">
              <Github className="w-5 h-5" />
            </div>
            <div>
              <h2 id="connect-github-title" className="text-base font-semibold leading-none">
                {connected ? 'GitHub Sync Settings' : 'Connect GitHub'}
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                {connected
                  ? 'Manage versioned synchronization'
                  : 'Local-first backup and version control'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            aria-label="Close dialog"
            className="rounded-lg p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* VIEW 1: Already Connected Dashboard */}
        {connected ? (
          <div className="p-6 space-y-5">
            {/* Connected Banner / Account Card */}
            <div
              className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-200 space-y-3"
              data-testid="connected-banner"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">Repository Connected</h3>
                    <p className="text-xs text-emerald-700 dark:text-emerald-400">
                      Private snapshot repository linked
                    </p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-100 dark:bg-emerald-900/80 text-emerald-800 dark:text-emerald-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Active
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/70 dark:bg-zinc-900/80 border border-emerald-200/60 dark:border-emerald-800/40 font-mono text-xs">
                <span className="truncate font-medium">{connectedRepo || repoFullName}</span>
                <a
                  href={`https://github.com/${connectedRepo || repoFullName}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline shrink-0 ml-2"
                >
                  <span>View</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              {lastSyncedAt ? (
                <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80">
                  Last synced: {new Date(lastSyncedAt).toLocaleTimeString()}
                </p>
              ) : null}
            </div>

            {/* Error Banner if any */}
            {error ? (
              <div
                role="alert"
                className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs"
                data-testid="error-banner"
              >
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <p className="flex-1 leading-relaxed">{error}</p>
              </div>
            ) : null}

            {/* Quick Actions (Sync Now & Export Backup) */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={async () => {
                  if (onSyncNow) {
                    setIsLoading(true);
                    try {
                      await onSyncNow();
                    } finally {
                      setIsLoading(false);
                    }
                  }
                }}
                disabled={isLoading || isSyncing}
                className="flex items-center justify-center gap-2 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs font-medium transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isSyncing || isLoading ? 'animate-spin' : ''}`}
                />
                <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
              </button>

              <button
                type="button"
                onClick={async () => {
                  if (onExportBackup) {
                    await onExportBackup();
                  }
                }}
                className="flex items-center justify-center gap-2 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs font-medium transition-colors cursor-pointer shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Backup</span>
              </button>
            </div>

            {/* Security Note */}
            <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 dark:text-zinc-500">
              <Lock className="w-3 h-3 shrink-0" />
              <span>Tokens and session data are encrypted at rest with AES-GCM.</span>
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={handleDisconnect}
                disabled={isLoading}
                data-testid="btn-disconnect"
                className="px-3.5 py-2 text-xs font-medium text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 hover:bg-rose-100 dark:hover:bg-rose-900/50 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
              >
                {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                Disconnect
              </button>

              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                data-testid="btn-close"
                className="px-4 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          /* VIEW 2: Connect Flow (1-Click Primary + Manual Custom Fallback) */
          <form onSubmit={handleConnect} className="p-6 space-y-4">
            {/* Error Banner */}
            {error ? (
              <div
                role="alert"
                className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs"
                data-testid="error-banner"
              >
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <p className="flex-1 leading-relaxed">{error}</p>
              </div>
            ) : null}

            {/* 1-Click GitHub Authorization Card (HERO) */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-50/70 via-zinc-50 to-zinc-100 dark:from-indigo-950/30 dark:via-zinc-800/60 dark:to-zinc-800/30 border border-indigo-200/60 dark:border-indigo-800/40 space-y-3.5 shadow-xs">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shrink-0 shadow-xs">
                  <Github className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    1-Click GitHub Authorization
                  </h3>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 leading-relaxed">
                    Authorize once to automatically create and sync with your private repository (
                    <span className="font-mono text-zinc-800 dark:text-zinc-200 font-semibold">
                      undone-notes
                    </span>
                    ). Zero manual tokens or typing required.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleOAuthConnect}
                disabled={isLoading || isOAuthLoading}
                data-testid="btn-oauth-connect"
                className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {isOAuthLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" data-testid="spinner-oauth" />
                    <span>Connecting with GitHub...</span>
                  </>
                ) : (
                  <>
                    <Github className="w-4 h-4" />
                    <span>Connect with GitHub (1-Click)</span>
                  </>
                )}
              </button>
            </div>

            {/* Divider */}
            <div className="relative my-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-zinc-200 dark:border-zinc-800" />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase font-medium">
                <span className="bg-white dark:bg-zinc-900 px-2 text-zinc-400 dark:text-zinc-500">
                  or custom repository &amp; token
                </span>
              </div>
            </div>

            {/* Repository Name Input */}
            <div className="space-y-1.5">
              <label
                htmlFor="repo-name"
                className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300"
              >
                Repository Name
              </label>
              <div className="relative">
                <input
                  id="repo-name"
                  name="repoFullName"
                  type="text"
                  placeholder="username/undone-notes"
                  value={repoFullName}
                  onChange={(e) => {
                    setRepoFullName(e.target.value);
                    setError(null);
                  }}
                  onBlur={() => setTouched((prev) => ({ ...prev, repo: true }))}
                  disabled={isLoading}
                  aria-invalid={showRepoError}
                  aria-describedby={showRepoError ? 'repo-error' : 'repo-hint'}
                  className="w-full px-3.5 py-2 text-sm rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/80 focus:border-zinc-400 dark:focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-400 font-mono placeholder:font-sans placeholder:text-zinc-400 disabled:opacity-60"
                />
              </div>
              {showRepoError ? (
                <p id="repo-error" className="text-xs text-rose-600 dark:text-rose-400">
                  Please enter a valid repository in &apos;owner/repo&apos; format.
                </p>
              ) : (
                <p id="repo-hint" className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  Format: <span className="font-mono">owner/repo</span> (e.g. username/undone-notes)
                </p>
              )}
            </div>

            {/* Personal Access Token Input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="github-token"
                  className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300"
                >
                  <Key className="w-3.5 h-3.5 text-zinc-400" />
                  Personal Access Token
                </label>
              </div>
              <div className="relative">
                <input
                  id="github-token"
                  name="token"
                  type="password"
                  placeholder="ghp_... or fine-grained PAT"
                  value={token}
                  onChange={(e) => {
                    setToken(e.target.value);
                    setError(null);
                  }}
                  onBlur={() => setTouched((prev) => ({ ...prev, token: true }))}
                  disabled={isLoading}
                  aria-invalid={showTokenError}
                  aria-describedby={showTokenError ? 'token-error' : 'token-hint'}
                  className="w-full px-3.5 py-2 text-sm rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/80 focus:border-zinc-400 dark:focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-400 font-mono placeholder:font-sans placeholder:text-zinc-400 disabled:opacity-60"
                />
              </div>
              {showTokenError ? (
                <p id="token-error" className="text-xs text-rose-600 dark:text-rose-400">
                  Personal access token is required to authenticate.
                </p>
              ) : (
                <p id="token-hint" className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  Must include <span className="font-mono">repo</span> scope or Contents read/write.
                </p>
              )}
            </div>

            {/* Allow Public Repository Checkbox & Warning */}
            <div className="pt-1 space-y-2">
              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  id="allow-public-repo"
                  name="allowPublic"
                  checked={allowPublic}
                  onChange={(e) => setAllowPublic(e.target.checked)}
                  disabled={isLoading}
                  className="mt-0.5 w-[18px] h-[18px] p-0 shrink-0 rounded border-zinc-300 dark:border-zinc-700 text-zinc-900 focus:ring-zinc-500"
                />
                <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Allow Public Repository
                </span>
              </label>

              <div
                className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/40 text-amber-800 dark:text-amber-300 text-xs"
                data-testid="public-repo-warning"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <p className="leading-snug">
                  <strong>Warning:</strong> Undone workspace notes may contain private information.
                  Public repositories make all notes and uploaded files publicly accessible.
                </p>
              </div>
            </div>

            {/* Security Assurance */}
            <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 dark:text-zinc-500">
              <Lock className="w-3 h-3" />
              <span>Tokens are stored securely and encrypted at rest in your session.</span>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                data-testid="btn-close"
                className="px-3.5 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
              >
                Close
              </button>

              <button
                type="submit"
                disabled={!canConnect}
                data-testid="btn-connect"
                className="px-4 py-2 text-xs font-medium text-white bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" data-testid="spinner-loading" />
                    <span>Connecting...</span>
                  </>
                ) : (
                  <span>Connect Repository</span>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
