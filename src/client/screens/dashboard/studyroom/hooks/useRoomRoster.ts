'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { RoomRosterMemberDTO } from '@/src/shared/studyroom/contracts';
import { STUDY_ROOM_LIMITS } from '@/src/shared/studyroom/contracts';

export interface UseRoomRosterOptions {
  roomId: string;
  enabled?: boolean;
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
}: UseRoomRosterOptions): UseRoomRosterResult {
  const [roster, setRoster] = useState<RoomRosterMemberDTO[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isMountedRef = useRef(true);

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

  return {
    roster,
    isLoading,
    error,
    refresh: fetchRoster,
  };
}
