import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { useRoomRefresh } from './useRoomRefresh';
import { useRealtime } from '@/src/client/realtime';
import {
  studyRoomRepository,
  type RoomEnvironmentSnapshotDTO,
} from '@/src/client/repositories/studyRoomRepository';
import { parseMusicUrl } from '../utils/parseMusicUrl';
import type {
  AmbientPresetId,
  BackgroundId,
  MusicSource,
  SharedEnvironmentActions,
  SharedRoomEnvironment,
} from '../types';

export interface UseSharedEnvironmentOptions {
  roomSlug?: string;
  canControlEnvironment?: boolean;
  roomId?: string;
  streamGeneration?: number;
}

export interface UseSharedEnvironmentReturn {
  environment: SharedRoomEnvironment;
  actions: SharedEnvironmentActions;
  revision: number;
  reloadEnvironment: () => Promise<void>;
}

function useSafeRealtime() {
  try {
    return useRealtime();
  } catch {
    return null;
  }
}

export function useSharedEnvironment(
  initialEnvironment: SharedRoomEnvironment,
  adminUserId: string,
  options?: UseSharedEnvironmentOptions
): UseSharedEnvironmentReturn {
  const [environment, setEnvironment] = useState<SharedRoomEnvironment>(initialEnvironment);
  const [revision, setRevision] = useState<number>(1);
  const confirmed = useRef(initialEnvironment);
  const revisionRef = useRef<number>(1);
  const optionsRef = useRef(options);
  const realtime = useSafeRealtime();
  const subscribe = realtime?.status === 'connected' ? realtime.subscribe : undefined;

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const applyServerSnapshot = useCallback((data: RoomEnvironmentSnapshotDTO) => {
    if (data.revision < revisionRef.current) return;
    setRevision(data.revision);
    revisionRef.current = data.revision;

    const parsedMusic = data.musicStreamUrl ? parseMusicUrl(data.musicStreamUrl) : null;
    const nextMusic = parsedMusic && parsedMusic.ok ? parsedMusic.source : null;

    const prev = confirmed.current;
    confirmed.current = {
      ...prev,
      backgroundId: (data.sceneId as BackgroundId) || prev.backgroundId,
      music: nextMusic !== undefined ? nextMusic : prev.music,
      ambience: {
        ...prev.ambience,
        presetId: (data.soundscapeId as AmbientPresetId | null) ?? null,
      },
      updatedAt: data.updatedAt ? new Date(data.updatedAt).getTime() : prev.updatedAt,
      updatedByUserId: data.updatedByUserId || prev.updatedByUserId,
    };
    setEnvironment(local => ({...confirmed.current,ambience:{...confirmed.current.ambience,volume:local.ambience.volume,isPlaying:confirmed.current.ambience.presetId !== null && local.ambience.isPlaying}}));
  }, []);

  const reloadEnvironment = useCallback(async () => {
    const slug = optionsRef.current?.roomSlug;
    if (!slug) return;
    try {
      const data = await studyRoomRepository.getRoomEnvironment(slug);
      if (optionsRef.current?.roomSlug === slug) applyServerSnapshot(data);
    } catch {
      // Fall back gracefully to local state
    }
  }, [applyServerSnapshot]);

  // Initial load from server environment service if roomSlug provided
  useEffect(() => {
    revisionRef.current = 0;
    const slug = options?.roomSlug;
    if (!slug) return;

    let ignore = false;
    void studyRoomRepository
      .getRoomEnvironment(slug)
      .then((data) => {
        if (!ignore && data) {
          applyServerSnapshot(data);
        }
      })
      .catch(() => {
        // Fall back gracefully to catalog preset
      });

    return () => {
      ignore = true;
    };
  }, [options?.roomSlug, applyServerSnapshot]);

  useRoomRefresh(options?.roomId ? `room:${options.roomId}:g${options.streamGeneration ?? 1}` : undefined, reloadEnvironment);

  // Realtime subscription for room.environment.updated events
  useEffect(() => {
    const roomId = options?.roomId;
    const streamGeneration = options?.streamGeneration ?? 1;
    if (!roomId || typeof subscribe !== 'function') return;

    const channel = `room:${roomId}:g${streamGeneration}`;
    const unsubscribe = subscribe(channel, (data: unknown) => {
      const envelope = data as { type?: string; payload?: RoomEnvironmentSnapshotDTO };
      if (envelope?.type === 'room.environment.updated' && envelope.payload) {
        applyServerSnapshot(envelope.payload);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [options?.roomId, options?.streamGeneration, subscribe, applyServerSnapshot]);

  const persistServerEnvironment = useCallback(
    async (patch: {
      sceneId?: string;
      soundscapeId?: string | null;
      musicStreamUrl?: string | null;
    }) => {
      const slug = optionsRef.current?.roomSlug;
      const canControl = optionsRef.current?.canControlEnvironment;
      if (!slug || !canControl) return;

      try {
        const updated = await studyRoomRepository.updateRoomEnvironment(slug, {
          ...patch,
          expectedRevision: revisionRef.current,
        });
        if (optionsRef.current?.roomSlug === slug) applyServerSnapshot(updated);
      } catch {
        if (optionsRef.current?.roomSlug !== slug) return;
        setEnvironment(confirmed.current);
        await reloadEnvironment();
        window.dispatchEvent(new Event('studyroom:environment-error'));
      }
    },
    [reloadEnvironment,applyServerSnapshot]
  );

  const actions: SharedEnvironmentActions = useMemo(
    () => ({
      setBackground(id: BackgroundId) {
        setEnvironment((prev) => {
          if (prev.backgroundId === id) return prev;
          return {
            ...prev,
            backgroundId: id,
            updatedAt: Date.now(),
            updatedByUserId: adminUserId,
          };
        });
        void persistServerEnvironment({ sceneId: id });
      },

      setMusic(source: MusicSource | null) {
        setEnvironment((prev) => ({
          ...prev,
          music: source,
          updatedAt: Date.now(),
          updatedByUserId: adminUserId,
        }));
        void persistServerEnvironment({ musicStreamUrl: source ? source.originalUrl : null });
      },

      setAmbiencePreset(id: AmbientPresetId | null) {
        setEnvironment((prev) => ({
          ...prev,
          ambience: {
            ...prev.ambience,
            presetId: id,
            isPlaying: id !== null,
          },
          updatedAt: Date.now(),
          updatedByUserId: adminUserId,
        }));
        void persistServerEnvironment({ soundscapeId: id });
      },

      setAmbiencePlaying(isPlaying: boolean) {
        setEnvironment((prev) => {
          if (prev.ambience.presetId === null) return prev;
          return {
            ...prev,
            ambience: {
              ...prev.ambience,
              isPlaying,
            },
            updatedAt: Date.now(),
            updatedByUserId: adminUserId,
          };
        });
      },

      setAmbienceVolume(volume: number) {
        const raw = Number.isFinite(volume) ? volume : 0;
        const clamped = Math.max(0, Math.min(100, Math.round(raw)));
        setEnvironment((prev) => ({
          ...prev,
          ambience: {
            ...prev.ambience,
            volume: clamped,
          },
          updatedAt: Date.now(),
          updatedByUserId: adminUserId,
        }));
      },
    }),
    [adminUserId, persistServerEnvironment]
  );

  return {
    environment,
    actions,
    revision,
    reloadEnvironment,
  };
}
