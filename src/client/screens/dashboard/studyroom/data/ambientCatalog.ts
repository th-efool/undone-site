import type { AmbientPreset, AmbientPresetId } from '../types';

export const AMBIENT_PRESETS: readonly AmbientPreset[] = [
  { id: 'rain', label: 'Rain', icon: 'CloudRain' },
  { id: 'thunderstorm', label: 'Thunderstorm', icon: 'CloudLightning' },
  { id: 'fireplace', label: 'Fireplace', icon: 'Flame' },
  { id: 'ocean-waves', label: 'Ocean waves', icon: 'Waves' },
  { id: 'forest', label: 'Forest ambience', icon: 'Trees' },
  { id: 'wind', label: 'Wind', icon: 'Wind' },
  { id: 'white-noise', label: 'White noise', icon: 'AudioLines' },
  { id: 'pink-noise', label: 'Pink noise', icon: 'AudioLines' },
  { id: 'brown-noise', label: 'Brown noise', icon: 'AudioLines' },
  { id: 'cafe', label: 'Café ambience', icon: 'Coffee' },
] as const;

export function getAmbientPreset(
  id: AmbientPresetId | string | null | undefined
): AmbientPreset | undefined {
  if (!id) return undefined;
  return AMBIENT_PRESETS.find((preset) => preset.id === id);
}
