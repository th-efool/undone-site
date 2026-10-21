import { useMemo, useState, useEffect, useRef } from 'react';
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
}

export interface UseSharedEnvironmentReturn {
  environment: SharedRoomEnvironment;
  actions: SharedEnvironmentActions;
}

export function useSharedEnvironment(
  initialEnvironment: SharedRoomEnvironment,
  adminUserId: string,
  options?: UseSharedEnvironmentOptions
): UseSharedEnvironmentReturn {
  const [environment, setEnvironment] = useState<SharedRoomEnvironment>(initialEnvironment);
  const optionsRef = useRef(options);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  // Initial load from server environment service if roomSlug provided
  useEffect(() => {
    const slug = options?.roomSlug;
    if (!slug) return;

    let ignore = false;
    void fetch(`/api/studyroom/${slug}/environment`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!ignore && data) {
          const parsedMusic = data.musicStreamUrl ? parseMusicUrl(data.musicStreamUrl) : null;
          const nextMusic = parsedMusic && parsedMusic.ok ? parsedMusic.source : null;
          setEnvironment((prev) => ({
            ...prev,
            backgroundId: (data.sceneId as BackgroundId) || prev.backgroundId,
            music: nextMusic || prev.music,
            ambience: {
              ...prev.ambience,
              presetId: (data.soundscapeId as AmbientPresetId) || prev.ambience.presetId,
            },
            updatedAt: data.updatedAt ? new Date(data.updatedAt).getTime() : prev.updatedAt,
            updatedByUserId: data.updatedByUserId || prev.updatedByUserId,
          }));
        }
      })
      .catch(() => {
        // Fall back gracefully to catalog preset
      });

    return () => {
      ignore = true;
    };
  }, [options?.roomSlug]);

  const persistServerEnvironment = (patch: {
    sceneId?: string;
    soundscapeId?: string | null;
    musicStreamUrl?: string | null;
  }) => {
    const slug = optionsRef.current?.roomSlug;
    const canControl = optionsRef.current?.canControlEnvironment;
    if (!slug || !canControl) return;

    void fetch(`/api/studyroom/${slug}/environment`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }).catch(() => {
      // Local state remains responsive
    });
  };

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
        persistServerEnvironment({ sceneId: id });
      },

      setMusic(source: MusicSource | null) {
        setEnvironment((prev) => ({
          ...prev,
          music: source,
          updatedAt: Date.now(),
          updatedByUserId: adminUserId,
        }));
        persistServerEnvironment({ musicStreamUrl: source ? source.originalUrl : null });
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
        persistServerEnvironment({ soundscapeId: id });
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
    [adminUserId]
  );

  return {
    environment,
    actions,
  };
}
