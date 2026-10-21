'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { RoomRosterMemberDTO } from '@/src/shared/studyroom/contracts';
import { STUDY_ROOM_LIMITS } from '@/src/shared/studyroom/contracts';
import { useRealtime } from '@/src/client/realtime';

export interface UseRoomRosterOptions {
  roomId: string;
  enabled?: boolean;
  streamGeneration?: number;
}

function useSafeRealtime() {
  try {
    return useRealtime();
  } catch {
    return null;
  }
}

export interface UseRoomRosterResult {
  roster: RoomRosterMemberDTO[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useRoomRoster({
  roomId,
  enabled = true,
  streamGeneration = 1,
}: UseRoomRosterOptions): UseRoomRosterResult {
  const [roster, setRoster] = useState<RoomRosterMemberDTO[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isMountedRef = useRef(true);
  const realtime = useSafeRealtime();

  const fetchRoster = useCallback(async () => {
    if (!roomId || !enabled) return;

    try {
      const res = await fetch(`/api/studyroom/roster?roomId=${encodeURIComponent(roomId)}`);
      if (!res.ok) {
        throw new Error(`Failed to load roster (${res.status})`);
      }
      const data: unknown = await res.json();
      if (isMountedRef.current) {
        let members: RoomRosterMemberDTO[] = [];
        if (Array.isArray(data)) {
          members = data;
        } else if (data && typeof data === 'object') {
          if ('members' in data && Array.isArray((data as { members: unknown }).members)) {
            members = (data as { members: RoomRosterMemberDTO[] }).members;
          } else if ('roster' in data && Array.isArray((data as { roster: unknown }).roster)) {
            members = (data as { roster: RoomRosterMemberDTO[] }).roster;
          }
        }
        setRoster(members);
        setError(null);
      }
    } catch (err: unknown) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : 'Unable to fetch roster');
      }
    }
  }, [roomId, enabled]);

  useEffect(() => {
    isMountedRef.current = true;
    if (!enabled || !roomId) return;

    let ignore = false;
    void Promise.resolve().then(async () => {
      if (ignore || !isMountedRef.current) return;
      setIsLoading(true);
      await fetchRoster().finally(() => {
        if (isMountedRef.current && !ignore) setIsLoading(false);
      });
    });

    const interval = setInterval(() => {
      void fetchRoster();
    }, STUDY_ROOM_LIMITS.ROSTER_POLL_INTERVAL_MS);

    const onFocus = () => {
      void fetchRoster();
    };
    window.addEventListener('focus', onFocus);

    return () => {
      ignore = true;
      isMountedRef.current = false;
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [enabled, roomId, fetchRoster]);

  // Realtime subscription for immediate roster changes
  useEffect(() => {
    if (!enabled || !roomId || typeof realtime?.subscribe !== 'function') return;

    const roomChannel = `room:${roomId}:g${streamGeneration}`;
    const unsubscribe = realtime.subscribe(roomChannel, (data: unknown) => {
      const envelope = data as {
        type?: string;
        payload?: { userId?: string; publicGoal?: string | null };
      };
      if (
        envelope?.type === 'room.roster.changed' ||
        envelope?.type === 'room.participant.joined' ||
        envelope?.type === 'room.participant.left'
      ) {
        void fetchRoster();
      } else if (envelope?.type === 'room.participant.updated' && envelope.payload?.userId) {
        const { userId, publicGoal } = envelope.payload;
        setRoster((prev) =>
          prev.map((m) =>
            m.userId === userId ? { ...m, publicGoal: publicGoal ?? null } : m
          )
        );
      }
    });

    return () => {
      unsubscribe();
    };
  }, [enabled, roomId, streamGeneration, realtime, fetchRoster]);

  return {
    roster,
    isLoading,
    error,
    refresh: fetchRoster,
  };
}
