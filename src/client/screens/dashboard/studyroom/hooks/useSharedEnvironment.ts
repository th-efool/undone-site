import { useMemo, useState } from 'react';
import type {
  AmbientPresetId,
  BackgroundId,
  MusicSource,
  SharedEnvironmentActions,
  SharedRoomEnvironment,
} from '../types';

export interface UseSharedEnvironmentReturn {
  environment: SharedRoomEnvironment;
  actions: SharedEnvironmentActions;
}

export function useSharedEnvironment(
  initialEnvironment: SharedRoomEnvironment,
  adminUserId: string
): UseSharedEnvironmentReturn {
  const [environment, setEnvironment] = useState<SharedRoomEnvironment>(initialEnvironment);

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
      },

      setMusic(source: MusicSource | null) {
        setEnvironment((prev) => ({
          ...prev,
          music: source,
          updatedAt: Date.now(),
          updatedByUserId: adminUserId,
        }));
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
