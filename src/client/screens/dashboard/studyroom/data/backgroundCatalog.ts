import type { BackgroundOption } from '../types';

/** User-supplied illustrations from ai-context/Studyroom Backgrounds. */
export const SCENE_BACKGROUNDS: readonly BackgroundOption[] = [
  { id: 'cozy-fireplace', label: 'Cozy fireplace', image: '/images/studyrooms/scenes/fireplace.webp', gradient: '#29170f', focal: '50% 50%', extraScrim: 0 },
  { id: 'rainy-window', label: 'Rain', image: '/images/studyrooms/scenes/rain.webp', gradient: '#152535', focal: '50% 50%', extraScrim: 0 },
  { id: 'quiet-cafe', label: 'Café', image: '/images/studyrooms/scenes/cafe.webp', gradient: '#352319', focal: '50% 50%', extraScrim: 0 },
  { id: 'library', label: 'Library', image: '/images/studyrooms/scenes/library.webp', gradient: '#261b12', focal: '50% 50%', extraScrim: 0 },
  { id: 'seaside', label: 'Seaside', image: '/images/studyrooms/scenes/seaside.webp', gradient: '#423044', focal: '50% 50%', extraScrim: 0 },
  { id: 'forest', label: 'Forest', image: '/images/studyrooms/scenes/forest.webp', gradient: '#102927', focal: '50% 50%', extraScrim: 0 },
  { id: 'night-sky', label: 'Night sky', image: '/images/studyrooms/scenes/night-sky.webp', gradient: '#121b35', focal: '50% 50%', extraScrim: 0 },
];

export const SOLID_BACKGROUNDS: readonly BackgroundOption[] = [
  { id: 'minimal-workspace', label: 'Charcoal', image: null, gradient: '#202126', focal: 'center', extraScrim: 0 },
  { id: 'solid-midnight', label: 'Midnight', image: null, gradient: '#18243e', focal: 'center', extraScrim: 0 },
  { id: 'solid-forest', label: 'Sage', image: null, gradient: '#29443c', focal: 'center', extraScrim: 0 },
  { id: 'solid-plum', label: 'Plum', image: null, gradient: '#44304c', focal: 'center', extraScrim: 0 },
  { id: 'solid-clay', label: 'Clay', image: null, gradient: '#704b40', focal: 'center', extraScrim: 0 },
  { id: 'solid-slate', label: 'Slate', image: null, gradient: '#465266', focal: 'center', extraScrim: 0 },
];

export const BACKGROUND_OPTIONS: readonly BackgroundOption[] = [...SCENE_BACKGROUNDS, ...SOLID_BACKGROUNDS];

export function getBackground(id: string): BackgroundOption {
  return BACKGROUND_OPTIONS.find((bg) => bg.id === id) ?? SOLID_BACKGROUNDS[0];
}
