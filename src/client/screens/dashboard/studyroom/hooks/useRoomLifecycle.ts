'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { STUDY_ROOM_LIMITS } from '@/src/shared/studyroom/contracts';

export interface UseRoomLifecycleOptions {
  roomId: string;
  enabled?: boolean;
  onEvicted?: (reason: string) => void;
}

export interface UseRoomLifecycleResult {
  isJoined: boolean;
  isJoining: boolean;
  generation: number | null;
  error: string | null;
  leave: (global?: boolean) => Promise<void>;
  rejoin: () => Promise<void>;
}

function getTabId(): string {
  if (typeof window === 'undefined') return 'server-tab';
  try {
    let tabId = window.sessionStorage.getItem('studyroom_tab_id');
    if (!tabId) {
      tabId =
        'tab-' +
        (typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2));
      window.sessionStorage.setItem('studyroom_tab_id', tabId);
    }
    return tabId;
  } catch {
    return 'tab-fallback';
  }
}

export function useRoomLifecycle({
  roomId,
  enabled = true,
  onEvicted,
}: UseRoomLifecycleOptions): UseRoomLifecycleResult {
  const [isJoined, setIsJoined] = useState(false);
  const [isJoining, setIsJoining] = useState(() => Boolean(enabled && roomId));
  const [generation, setGeneration] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generationRef = useRef<number | null>(generation);
  const onEvictedRef = useRef(onEvicted);

  useEffect(() => {
    generationRef.current = generation;
  }, [generation]);

  useEffect(() => {
    onEvictedRef.current = onEvicted;
  }, [onEvicted]);

  const join = useCallback(async () => {
    if (!roomId || !enabled) return;
    await Promise.resolve();
    setIsJoining(true);
    setError(null);

    const tabId = getTabId();

    try {
      const res = await fetch('/api/studyroom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'join',
          roomId,
          tabId,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to join study room');
      }

      setGeneration(data.generation ?? 1);
      setIsJoined(true);
    } catch (err: unknown) {
      setIsJoined(false);
      setError(err instanceof Error ? err.message : 'Failed to join room');
    } finally {
      setIsJoining(false);
    }
  }, [roomId, enabled]);

  const leave = useCallback(
    async (global = false) => {
      const tabId = getTabId();
      try {
        await fetch('/api/studyroom', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'leave',
            roomId,
            tabId,
            global,
          }),
        });
      } catch {
        // Silently catch leave network errors on teardown
      } finally {
        setIsJoined(false);
        setGeneration(null);
      }
    },
    [roomId]
  );

  // Initial Join & Cleanup
  useEffect(() => {
    if (!enabled || !roomId) return;

    let ignore = false;
    void Promise.resolve().then(async () => {
      if (ignore) return;
      await join();
    });

    const handleBeforeUnload = () => {
      const tabId = getTabId();
      const payload = JSON.stringify({
        action: 'leave',
        roomId,
        tabId,
      });

      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        const blob = new Blob([payload], { type: 'application/json' });
        navigator.sendBeacon('/api/studyroom', blob);
      } else {
        void fetch('/api/studyroom', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          keepalive: true,
        });
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      ignore = true;
      window.removeEventListener('beforeunload', handleBeforeUnload);
      void leave(false);
    };
  }, [enabled, roomId, join, leave]);

  // Periodic 30-second Lease Renewal Heartbeat
  useEffect(() => {
    if (!isJoined || !roomId || !enabled) return;

    const interval = setInterval(async () => {
      const currentGen = generationRef.current;
      if (currentGen === null) return;

      const tabId = getTabId();

      try {
        const res = await fetch('/api/studyroom', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'renew',
            roomId,
            tabId,
            generation: currentGen,
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          setIsJoined(false);
          setGeneration(null);
          onEvictedRef.current?.(data.reason || 'Lease expired');
        }
      } catch {
        // Retry on next cycle
      }
    }, STUDY_ROOM_LIMITS.LEASE_RENEWAL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [isJoined, roomId, enabled]);

  return {
    isJoined,
    isJoining,
    generation,
    error,
    leave,
    rejoin: join,
  };
}
