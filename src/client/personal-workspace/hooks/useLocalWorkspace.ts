'use client';

/**
 * Production useLocalWorkspace Hook
 *
 * Implements Section 4.2 of `plans/undone-local-first-github-sync.md`:
 * - React hook for local-first personal workspace integration
 * - Manages LocalWorkspace lifecycle (open, subscribe, close on unmount or user switch)
 * - Exposes live NotesStateEntity for dashboard screens
 * - Provides transactional mutations for notebooks, canvas scenes with embedded image assets,
 *   live uncommitted editor buffers, and recovery bundle exports
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { NotesStateEntity } from '@/src/client/screens/dashboard/notes/models/notes.models';
import type {
  LocalReceipt,
  SyncSummary,
} from '@/src/shared/personal-workspace/contracts';
import {
  getLocalWorkspace,
  type LocalWorkspace,
  type WorkspaceCommand,
} from '../local/facade';

export interface UseLocalWorkspaceResult {
  state: NotesStateEntity | null;
  syncSummary: SyncSummary;
  applyCommand: (command: WorkspaceCommand) => Promise<LocalReceipt>;
  saveCanvas: (
    noteId: string,
    scene: {
      elements: unknown[];
      appState: unknown;
      files?: Record<string, unknown>;
    }
  ) => Promise<LocalReceipt>;
  updateCanvasBuffer: (noteId: string, scene: unknown) => void;
  exportRecovery: () => Promise<void>;
  isLoading: boolean;
}

const DEFAULT_SYNC_SUMMARY: SyncSummary = {
  status: 'idle',
  pendingMutations: 0,
  lastSyncedAt: null,
  conflictCount: 0,
};

// Global active reference counter per userId to safely close workspace only when all hooks unmount
const activeWorkspaceRefCounts = new Map<string, number>();

export function useLocalWorkspace(userId: string | null): UseLocalWorkspaceResult {
  const [prevUserId, setPrevUserId] = useState<string | null>(userId);
  const [state, setState] = useState<NotesStateEntity | null>(null);
  const [syncSummary, setSyncSummary] = useState<SyncSummary>(DEFAULT_SYNC_SUMMARY);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(userId));

  if (userId !== prevUserId) {
    setPrevUserId(userId);
    setIsLoading(Boolean(userId));
    if (!userId) {
      setState(null);
      setSyncSummary(DEFAULT_SYNC_SUMMARY);
    }
  }

  const facadeRef = useRef<LocalWorkspace | null>(null);
  const currentUserIdRef = useRef<string | null>(userId);

  useEffect(() => {
    currentUserIdRef.current = userId;

    if (!userId || userId.trim() === '') {
      facadeRef.current = null;
      return;
    }

    const cleanUserId = userId.trim();
    let isMounted = true;

    const facade = getLocalWorkspace(cleanUserId);
    facadeRef.current = facade;

    // Increment active subscriber reference count
    const prevCount = activeWorkspaceRefCounts.get(cleanUserId) || 0;
    activeWorkspaceRefCounts.set(cleanUserId, prevCount + 1);

    // 1. Open the workspace with account scope
    facade
      .open({ userId: cleanUserId })
      .then(async () => {
        if (!isMounted) return;
        setState(facade.getNotesState());
        const summary = await facade.getSyncSummary();
        if (!isMounted) return;
        setSyncSummary(summary);
        setIsLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error(`[useLocalWorkspace] Failed to open workspace for ${cleanUserId}:`, err);
        setIsLoading(false);
      });

    // 2. Subscribe to local mutations, outbox commits, and cross-tab broadcasts
    const unsubscribe = facade.subscribe(async () => {
      if (!isMounted) return;
      setState(facade.getNotesState());
      try {
        const summary = await facade.getSyncSummary();
        if (isMounted) {
          setSyncSummary(summary);
        }
      } catch (err) {
        console.warn('[useLocalWorkspace] Failed to fetch updated sync summary:', err);
      }
    });

    // 3. Cleanup on unmount or user switch
    return () => {
      isMounted = false;
      unsubscribe();

      const currentCount = (activeWorkspaceRefCounts.get(cleanUserId) || 1) - 1;
      if (currentCount <= 0) {
        activeWorkspaceRefCounts.delete(cleanUserId);
        facade.close().catch((err) => {
          console.warn(`[useLocalWorkspace] Error closing workspace for ${cleanUserId}:`, err);
        });
      } else {
        activeWorkspaceRefCounts.set(cleanUserId, currentCount);
      }

      if (currentUserIdRef.current !== cleanUserId) {
        facadeRef.current = null;
      }
    };
  }, [userId]);

  const applyCommand = useCallback(
    async (command: WorkspaceCommand): Promise<LocalReceipt> => {
      if (!userId || !facadeRef.current) {
        return {
          ok: false,
          committedAt: null,
          outboxEntryId: null,
          error: 'No active user workspace',
        };
      }
      return facadeRef.current.apply(command);
    },
    [userId]
  );

  const saveCanvas = useCallback(
    async (
      noteId: string,
      scene: {
        elements: unknown[];
        appState: unknown;
        files?: Record<string, unknown>;
      }
    ): Promise<LocalReceipt> => {
      if (!userId || !facadeRef.current) {
        return {
          ok: false,
          committedAt: null,
          outboxEntryId: null,
          error: 'No active user workspace',
        };
      }
      return facadeRef.current.saveCanvasScene(noteId, scene);
    },
    [userId]
  );

  const updateCanvasBuffer = useCallback(
    (noteId: string, scene: unknown): void => {
      if (!userId || !facadeRef.current) return;
      facadeRef.current.updateCanvasEditorBuffer(noteId, scene);
    },
    [userId]
  );

  const exportRecovery = useCallback(async (): Promise<void> => {
    if (!userId || !facadeRef.current) return;
    const blob = await facadeRef.current.exportRecoveryBundle();

    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
      a.download = `undone-recovery-${userId}-${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }, [userId]);

  return {
    state,
    syncSummary,
    applyCommand,
    saveCanvas,
    updateCanvasBuffer,
    exportRecovery,
    isLoading,
  };
}
