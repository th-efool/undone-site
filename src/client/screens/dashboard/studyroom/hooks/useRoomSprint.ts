'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useRealtime } from '@/src/client/realtime';
import {
  studyRoomRepository,
  type RoomSprintSnapshotDTO,
} from '@/src/client/repositories/studyRoomRepository';

export interface UseRoomSprintOptions {
  roomSlug?: string;
  roomId?: string;
  streamGeneration?: number;
  enabled?: boolean;
  canControlSprint?: boolean;
  initialSprint?: RoomSprintSnapshotDTO | null;
}

export interface UseRoomSprintReturn {
  sprint: RoomSprintSnapshotDTO | null;
  isLoading: boolean;
  error: string | null;
  actionError: string | null;
  remainingSeconds: number;
  isJoined: boolean;
  canControl: boolean;
  startSprint: (targetDurationMinutes?: number, title?: string) => Promise<void>;
  pauseSprint: () => Promise<void>;
  resumeSprint: () => Promise<void>;
  stopSprint: () => Promise<void>;
  joinSprint: () => Promise<void>;
  leaveSprint: () => Promise<void>;
  refreshSprint: () => Promise<void>;
}

function useSafeRealtime() {
  try {
    return useRealtime();
  } catch {
    return null;
  }
}

export function useRoomSprint(options?: UseRoomSprintOptions): UseRoomSprintReturn {
  const { data: session } = useSession();
  const currentUserId = session?.user?.id;
  const realtime = useSafeRealtime();

  const [sprint, setSprint] = useState<RoomSprintSnapshotDTO | null>(
    options?.initialSprint ?? null
  );
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(() => {
    return options?.initialSprint?.remainingSeconds ?? 0;
  });

  const sprintRef = useRef<RoomSprintSnapshotDTO | null>(sprint);
  sprintRef.current = sprint;

  const roomSlug = options?.roomSlug;
  const roomId = options?.roomId;
  const streamGeneration = options?.streamGeneration ?? 1;
  const enabled = options?.enabled !== false && Boolean(roomSlug);
  const canControl = Boolean(options?.canControlSprint);

  // Sync initial sprint if provided
  useEffect(() => {
    if (options?.initialSprint) {
      setSprint(options.initialSprint);
      setRemainingSeconds(options.initialSprint.remainingSeconds);
    }
  }, [options?.initialSprint]);

  // Fetch current sprint from server
  const fetchSprint = useCallback(async () => {
    if (!roomSlug || !enabled) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await studyRoomRepository.getRoomSprint(roomSlug);
      setSprint(res.sprint);
      if (res.sprint) {
        setRemainingSeconds(res.sprint.remainingSeconds);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load group sprint');
    } finally {
      setIsLoading(false);
    }
  }, [roomSlug, enabled]);

  // Initial load
  useEffect(() => {
    void fetchSprint();
  }, [fetchSprint]);

  // Realtime subscription to room.sprint.updated
  useEffect(() => {
    if (!enabled || !roomId || typeof realtime?.subscribe !== 'function') return;

    const channel = `room:${roomId}:g${streamGeneration}`;
    const unsubscribe = realtime.subscribe(channel, (data: unknown) => {
      const envelope = data as { type?: string; payload?: RoomSprintSnapshotDTO };
      if (envelope?.type === 'room.sprint.updated' && envelope.payload) {
        setSprint(envelope.payload);
        setRemainingSeconds(envelope.payload.remainingSeconds);
        setActionError(null);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [enabled, roomId, streamGeneration, realtime]);

  // Live countdown timer for ACTIVE sprints
  useEffect(() => {
    if (!sprint || sprint.status !== 'ACTIVE' || !sprint.deadline) {
      if (sprint?.status === 'PAUSED') {
        setRemainingSeconds(sprint.remainingSeconds);
      }
      return;
    }

    const deadlineMs = new Date(sprint.deadline).getTime();

    const updateCountdown = () => {
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((deadlineMs - now) / 1000));
      setRemainingSeconds(remaining);

      if (remaining <= 0) {
        // Naturally expired: trigger server sync
        void fetchSprint();
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [sprint?.status, sprint?.deadline, sprint?.remainingSeconds, fetchSprint]);

  // Start sprint
  const startSprint = useCallback(
    async (targetDurationMinutes = 25, title?: string) => {
      if (!roomSlug) return;
      setActionError(null);
      try {
        const started = await studyRoomRepository.startRoomSprint(
          roomSlug,
          targetDurationMinutes * 60,
          title
        );
        setSprint(started);
        setRemainingSeconds(started.remainingSeconds);
      } catch (err: any) {
        if (err?.status === 409) {
          // Sprint already active; sync state
          await fetchSprint();
        }
        setActionError(err?.message || 'Failed to start group sprint');
      }
    },
    [roomSlug, fetchSprint]
  );

  // Pause sprint
  const pauseSprint = useCallback(async () => {
    if (!roomSlug || !sprintRef.current) return;
    const current = sprintRef.current;
    setActionError(null);
    try {
      const paused = await studyRoomRepository.pauseRoomSprint(
        roomSlug,
        current.id,
        current.revision
      );
      setSprint(paused);
      setRemainingSeconds(paused.remainingSeconds);
    } catch (err: any) {
      if (err?.status === 409) {
        await fetchSprint();
      }
      setActionError(err?.message || 'Failed to pause sprint');
    }
  }, [roomSlug, fetchSprint]);

  // Resume sprint
  const resumeSprint = useCallback(async () => {
    if (!roomSlug || !sprintRef.current) return;
    const current = sprintRef.current;
    setActionError(null);
    try {
      const resumed = await studyRoomRepository.resumeRoomSprint(
        roomSlug,
        current.id,
        current.revision
      );
      setSprint(resumed);
      setRemainingSeconds(resumed.remainingSeconds);
    } catch (err: any) {
      if (err?.status === 409) {
        await fetchSprint();
      }
      setActionError(err?.message || 'Failed to resume sprint');
    }
  }, [roomSlug, fetchSprint]);

  // Stop sprint
  const stopSprint = useCallback(async () => {
    if (!roomSlug || !sprintRef.current) return;
    const current = sprintRef.current;
    setActionError(null);
    try {
      const stopped = await studyRoomRepository.stopRoomSprint(
        roomSlug,
        current.id,
        current.revision
      );
      setSprint(stopped);
      setRemainingSeconds(stopped.remainingSeconds);
    } catch (err: any) {
      if (err?.status === 409) {
        await fetchSprint();
      }
      setActionError(err?.message || 'Failed to stop sprint');
    }
  }, [roomSlug, fetchSprint]);

  // Join sprint
  const joinSprint = useCallback(async () => {
    if (!roomSlug || !sprintRef.current) return;
    setActionError(null);
    try {
      const updated = await studyRoomRepository.joinRoomSprint(
        roomSlug,
        sprintRef.current.id
      );
      setSprint(updated);
    } catch (err: any) {
      if (err?.status === 409) {
        await fetchSprint();
      }
      setActionError(err?.message || 'Failed to join group sprint');
    }
  }, [roomSlug, fetchSprint]);

  // Leave sprint
  const leaveSprint = useCallback(async () => {
    if (!roomSlug || !sprintRef.current) return;
    setActionError(null);
    try {
      await studyRoomRepository.leaveRoomSprint(
        roomSlug,
        sprintRef.current.id
      );
      // Refresh to update participant list
      await fetchSprint();
    } catch (err: any) {
      setActionError(err?.message || 'Failed to leave group sprint');
    }
  }, [roomSlug, fetchSprint]);

  const isJoined = useMemo(() => {
    if (!sprint || !currentUserId) return false;
    return sprint.participants.some(
      (p) => p.userId === currentUserId && (p.status === 'JOINED' || p.status === 'COMPLETED')
    );
  }, [sprint, currentUserId]);

  return {
    sprint,
    isLoading,
    error,
    actionError,
    remainingSeconds,
    isJoined,
    canControl,
    startSprint,
    pauseSprint,
    resumeSprint,
    stopSprint,
    joinSprint,
    leaveSprint,
    refreshSprint: fetchSprint,
  };
}
