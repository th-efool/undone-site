'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import type { RoomSlug, Viewer, ViewerRole, RoomDefinition, BackgroundId } from '../types';
import type { RoomBootstrapResponse } from '@/src/shared/studyroom/contracts';
import { STUDY_ROOM_LIMITS } from '@/src/shared/studyroom/contracts';
import { getRoomBySlug } from '../data/roomCatalog';
import { deriveViewer } from '../utils/deriveParticipants';
import { studyRoomRepository } from '@/src/client/repositories/studyRoomRepository';
import { useRoomRefresh } from './useRoomRefresh';
import { useRealtime } from '@/src/client/realtime';

export type RoomOrchestrationState =
  | 'loading'
  | 'eligible'
  | 'joining'
  | 'joined'
  | 'reconnecting'
  | 'switched_elsewhere'
  | 'denied'
  | 'unavailable';

export interface UseRoomOrchestrationOptions {
  roomSlug: string;
  viewAsOverride?: ViewerRole;
  enabled?: boolean;
}

export interface UseRoomOrchestrationResult {
  state: RoomOrchestrationState;
  bootstrap: RoomBootstrapResponse | null;
  roomDefinition: RoomDefinition;
  viewer: Viewer;
  generation: number | null;
  error: string | null;
  tabId: string;
  leave: (global?: boolean) => Promise<void>;
  rejoin: () => Promise<void>;
  refreshBootstrap: () => Promise<void>;
}

export function getTabId(): string {
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

function useSafeRealtime() {
  try {
    return useRealtime();
  } catch {
    return null;
  }
}

export function createDynamicRoomDefinition(
  slug: string,
  bootstrap?: RoomBootstrapResponse['room'] | null
): RoomDefinition {
  const title =
    bootstrap?.title ||
    slug
      .split('-')
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(' ');
  const visualPresetId = (bootstrap?.visualPresetId as BackgroundId) || 'library';
  return {
    slug: slug as RoomSlug,
    title,
    atmosphere: bootstrap?.description || 'Focus and quiet company',
    previewImage: bootstrap?.thumbnail || null,
    adminUserId: bootstrap?.ownerId || 'admin',
    adminDisplayName: bootstrap?.ownerName || 'Host',
    defaultEnvironment: {
      backgroundId: visualPresetId,
      music: null,
      ambience: {
        presetId: 'rain',
        volume: 40,
        isPlaying: false,
      },
      updatedAt: 0,
      updatedByUserId: bootstrap?.ownerId || 'admin',
    },
  };
}

export function useRoomOrchestration({
  roomSlug,
  viewAsOverride,
  enabled = true,
}: UseRoomOrchestrationOptions): UseRoomOrchestrationResult {
  const realtime = useSafeRealtime();
  const realtimeRef = useRef(realtime);
  const runIdRef = useRef(0);
  const generationRef = useRef<number | null>(null);
  const bootstrapRef = useRef<RoomBootstrapResponse | null>(null);

  const [state, setState] = useState<RoomOrchestrationState>('loading');
  const [bootstrap, setBootstrap] = useState<RoomBootstrapResponse | null>(null);
  const [generation, setGeneration] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tabId] = useState<string>(() => getTabId());

  useEffect(() => {
    realtimeRef.current = realtime;
  }, [realtime]);

  useEffect(() => {
    generationRef.current = generation;
  }, [generation]);

  useEffect(() => {
    bootstrapRef.current = bootstrap;
  }, [bootstrap]);

  const initializeRoom = useCallback(async () => {
    if (!enabled || !roomSlug) return;

    const currentRunId = ++runIdRef.current;
    generationRef.current=null;
    setGeneration(null);
    void Promise.resolve().then(() => {
      if (currentRunId === runIdRef.current) {
        setState('loading');
        setError(null);
      }
    });

    try {
      // 1. Fetch Room Bootstrap
      let bootstrapData: RoomBootstrapResponse;
      try {
        bootstrapData = await studyRoomRepository.getBootstrap(roomSlug);
      } catch (bootErr: unknown) {
        if (currentRunId !== runIdRef.current) return;
        const err = bootErr as { status?: number; data?: { error?: string }; message?: string };
        if (err?.status === 404) {
          setState('unavailable');
          setError('Study room not found');
          return;
        }
        if (err?.status === 403) {
          setState('denied');
          setError(err?.data?.error || err?.message || 'Access restricted');
          return;
        }
        throw bootErr;
      }
      if (currentRunId !== runIdRef.current) return;

      setBootstrap(bootstrapData);
      bootstrapRef.current = bootstrapData;

      // 2. Eligibility Gate
      const isEligible = bootstrapData.capabilities?.canJoin || bootstrapData.viewer?.isJoined;
      if (!isEligible) {
        setState('denied');
        return;
      }

      // 3. Join Room with stable tabId
      setState('joining');
      const currentTabId = getTabId();
      const actualRoomId = bootstrapData.room?.id || roomSlug;

      const joinResult = await studyRoomRepository.joinRoom(actualRoomId, currentTabId);
      if (currentRunId !== runIdRef.current) return;

      generationRef.current = joinResult.generation;
      const joinedBootstrap = await studyRoomRepository.getBootstrap(roomSlug);
      if (currentRunId !== runIdRef.current) return;
      if (!joinedBootstrap.viewer.isJoined || !joinedBootstrap.capabilities.canJoin) {
        setState('denied');
        return;
      }
      bootstrapRef.current = joinedBootstrap;
      setBootstrap(joinedBootstrap);
      setGeneration(joinResult.generation);
      generationRef.current = joinResult.generation;
      setState('joined');

      // 4. Refresh Realtime Subscription Manifest after assignment change
      if (typeof realtimeRef.current?.refreshManifest === 'function') {
        void Promise.resolve(realtimeRef.current.refreshManifest()).catch(() => {});
      }
    } catch (err: unknown) {
      if (currentRunId !== runIdRef.current) return;
      const errMsg = err instanceof Error ? err.message : 'Failed to join room';
      setError(errMsg);
      const lower = errMsg.toLowerCase();
      if (lower.includes('not found') || lower.includes('404')) {
        setState('unavailable');
      } else if (lower.includes('closed') || lower.includes('full') || lower.includes('banned') || lower.includes('restricted')) {
        setState('denied');
      } else {
        setState('reconnecting');
      }
    }
  }, [enabled, roomSlug]);

  // Initial Room Setup & Teardown
  useEffect(() => {
    if (!enabled || !roomSlug) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    void initializeRoom();

    const handleBeforeUnload = () => {
      const currentTabId = getTabId();
      const activeRoomId = bootstrapRef.current?.room?.id || roomSlug;
      if (generationRef.current === null) return;
      const payload = JSON.stringify({
        generation: generationRef.current,
        action: 'leave',
        roomId: activeRoomId,
        tabId: currentTabId,
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

    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', handleBeforeUnload);
    }

    const currentRunRef = runIdRef;
    return () => {
      currentRunRef.current++;
      if (typeof window !== 'undefined') {
        window.removeEventListener('beforeunload', handleBeforeUnload);
      }
      const currentTabId = getTabId();
      const activeRoomId = bootstrapRef.current?.room?.id || roomSlug;
      void studyRoomRepository.leaveRoom(activeRoomId, currentTabId, false, generationRef.current ?? undefined).catch(() => {});
    };
  }, [initializeRoom, roomSlug, enabled]);

  useEffect(() => {
    if (state !== 'reconnecting' || generation !== null) return;
    const timer = setTimeout(() => { void initializeRoom(); }, 5000);
    return () => clearTimeout(timer);
  }, [state,generation,initializeRoom]);

  // Periodic Lease Renewal Loop
  useEffect(() => {
    if (state !== 'joined' && state !== 'reconnecting') return;
    const currentRunId = runIdRef.current;

    const interval = setInterval(async () => {
      const currentGen = generationRef.current;
      if (currentGen === null) return;
      const currentTabId = getTabId();
      const activeRoomId = bootstrapRef.current?.room?.id || roomSlug;

      try {
        const res = await fetch('/api/studyroom', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'renew',
            roomId: activeRoomId,
            tabId: currentTabId,
            generation: currentGen,
          }),
        });

        if (currentRunId !== runIdRef.current) return;

        if (res.status === 409) {
          const data = await res.json().catch(() => ({}));
          if (data.reason === 'stale_generation') {
            setState('switched_elsewhere');
          } else {
            setState('unavailable');
          }
          return;
        }

        if (res.status === 403) {
          setState('denied');
          setError('Access revoked');
          return;
        }

        if (res.ok) {
          if (state === 'reconnecting') {
            setState('joined');
          }
        } else {
          setState('reconnecting');
        }
      } catch {
        if (currentRunId === runIdRef.current) {
          setState('reconnecting');
        }
      }
    }, STUDY_ROOM_LIMITS.LEASE_RENEWAL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [state, roomSlug]);

  // Realtime authorization status watcher
  useEffect(() => {
    if (state === 'joined' && realtime?.status === 'unauthorized') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState('denied');
      setError('Realtime authorization revoked');
    }
  }, [state, realtime?.status]);

  const refreshBootstrap = useCallback(async () => {
    if (!roomSlug) return;
    const run = runIdRef.current;
    try {
      const data = await studyRoomRepository.getBootstrap(roomSlug);
      if (run !== runIdRef.current) return;
      if (!data.viewer.isJoined || !data.capabilities.canJoin) setState('denied');
      setBootstrap(data);
      bootstrapRef.current = data;

    } catch (cause) {
      if (run === runIdRef.current && [401,403,404].includes((cause as {status:number}).status)) { setBootstrap(null); bootstrapRef.current=null; setState('denied'); }
    }
  }, [roomSlug]);

  // Realtime room events and cursor catchup
  const cursorRef = useRef<number>(0);


  const applyRoomEvent = useCallback(
    (event: { type?: string; payload?: Record<string, unknown> }) => {
      if (!event || !event.type) return;
      const payload = event.payload || {};

      switch (event.type) {
        case 'room.governance.changed':
          void refreshBootstrap();
          break;
        case 'room.participant.left': {
          const currentUserId = bootstrapRef.current?.viewer?.userId;
          if (payload.userId && currentUserId && payload.userId === currentUserId) {
            if (payload.reason === 'KICKED' || payload.reason === 'BANNED') {
              setState('denied');
              setError(
                payload.reason === 'BANNED'
                  ? 'You have been banned from this room'
                  : 'You were removed from this room'
              );
            } else if (payload.reason === 'SWITCHED_ROOM') {
              setState('switched_elsewhere');
            } else if (payload.reason === 'LEASE_EXPIRED') {
              setState('unavailable');
              setError('Session lease expired');
            }
          }
          break;
        }
        case 'room.lifecycle.changed': {
          const status = String(payload.status || '').toUpperCase();
          if (status === 'CLOSED' || status === 'ARCHIVED') {
            setState('denied');
            setError('This room has been closed');
            void refreshBootstrap();
          }
          break;
        }
        case 'room.roster.changed': {
          if (typeof payload.onlineCount === 'number') {
            setBootstrap((prev) =>
              prev
                ? {
                    ...prev,
                    room: {
                      ...prev.room,
                      onlineCount: payload.onlineCount as number,
                    },
                  }
                : null
            );
          }
          break;
        }
        default:
          break;
      }
    },
    [refreshBootstrap]
  );

  const roomChannel = bootstrap?.room.id ? `room:${bootstrap.room.id}:g${bootstrap.room.streamGeneration ?? 1}` : undefined;
  useRoomRefresh(state === 'joined' ? roomChannel : undefined, refreshBootstrap);
  useEffect(() => {
    const revoked = (event:Event) => {
      if ((event as CustomEvent<string>).detail !== roomChannel) return;
      setBootstrap(null); bootstrapRef.current=null; setState('denied'); setError('Access revoked');
    };
    window.addEventListener('studyroom:revoked',revoked);
    return () => window.removeEventListener('studyroom:revoked',revoked);
  },[roomChannel]);
  useEffect(() => { cursorRef.current = 0; }, [roomChannel]);

  // Subscribe to room stream channel
  useEffect(() => {
    if (
      state !== 'joined' ||
      !bootstrap?.room?.id ||
      realtime?.status !== 'connected' || typeof realtimeRef.current?.subscribe !== 'function'
    ) {
      return;
    }

    const roomId = bootstrap.room.id;
    const streamGen = bootstrap.room.streamGeneration ?? 1;
    const roomChannel = `room:${roomId}:g${streamGen}`;

    const unsubscribe = realtimeRef.current.subscribe(roomChannel, (data: unknown) => {
      const envelope = data as {
        eventId?: string;
        sequence?: number;
        type?: string;
        payload?: Record<string, unknown>;
      };

      if (typeof envelope?.sequence === 'number') {
        const incomingSeq = envelope.sequence;
        if (incomingSeq <= cursorRef.current) return;
        if (incomingSeq !== cursorRef.current + 1) {
          window.dispatchEvent(new CustomEvent('studyroom:resync',{detail:roomChannel}));
        }
        cursorRef.current = incomingSeq;
        applyRoomEvent(envelope);
      } else {
        applyRoomEvent(envelope);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [state, bootstrap?.room?.id, bootstrap?.room?.streamGeneration, applyRoomEvent, realtime?.status]);

  const leave = useCallback(
    async (global = false) => {
      const currentTabId = getTabId();
      const activeRoomId = bootstrapRef.current?.room?.id || roomSlug;
      try {
        await studyRoomRepository.leaveRoom(activeRoomId, currentTabId, global, generationRef.current ?? undefined);
      } catch {
        // Silently catch leave network errors on exit
      } finally {
        setState('unavailable');
        setGeneration(null);
        generationRef.current = null;
      }
    },
    [roomSlug]
  );

  const rejoin = useCallback(async () => {
    await initializeRoom();
  }, [initializeRoom]);

  // Visual Room Definition
  const catalogRoom = useMemo(() => getRoomBySlug(roomSlug), [roomSlug]);
  const roomDefinition = useMemo(() => {
    if (catalogRoom) return catalogRoom;
    return createDynamicRoomDefinition(roomSlug, bootstrap?.room);
  }, [catalogRoom, roomSlug, bootstrap?.room]);

  // Viewer derivation based on server bootstrap capabilities
  const { data: session } = useSession();
  const viewer: Viewer = useMemo(
    () =>
      deriveViewer({
        session,
        room: roomDefinition,
        viewAsOverride,
        roomRole: bootstrap?.viewer?.role,
        capabilities: bootstrap?.capabilities,
      }),
    [session, roomDefinition, viewAsOverride, bootstrap?.viewer?.role, bootstrap?.capabilities]
  );

  return {
    state,
    bootstrap,
    roomDefinition,
    viewer,
    generation,
    error,
    tabId,
    leave,
    rejoin,
    refreshBootstrap,
  };
}
