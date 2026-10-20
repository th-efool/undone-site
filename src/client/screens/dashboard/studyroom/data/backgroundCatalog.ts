import type { BackgroundOption } from '../types';

export const BACKGROUND_OPTIONS: readonly BackgroundOption[] = [
  {
    id: 'library',
    label: 'Library',
    image: '/images/studyrooms/library.webp',
    gradient: 'linear-gradient(160deg,#4a3418 0%,#1a120a 100%)',
    focal: '50% 35%',
    extraScrim: 0,
  },
  {
    id: 'rainy-window',
    label: 'Rainy window',
    image: null,
    gradient: 'linear-gradient(160deg,#1b2a3a 0%,#2e4157 45%,#16212c 100%)',
    focal: '50% 50%',
    extraScrim: 0,
  },
  {
    id: 'cozy-fireplace',
    label: 'Cozy fireplace',
    image: '/images/studyrooms/fireplace.webp',
    gradient: 'linear-gradient(160deg,#5a2410 0%,#140806 100%)',
    focal: '60% 40%',
    extraScrim: 0,
  },
  {
    id: 'quiet-cafe',
    label: 'Quiet café',
    image: null,
    gradient: 'linear-gradient(155deg,#3b2a20 0%,#6b4a34 50%,#2a1d16 100%)',
    focal: '50% 50%',
    extraScrim: 0,
  },
  {
    id: 'forest',
    label: 'Forest',
    image: '/images/studyrooms/campside.webp',
    gradient: 'linear-gradient(160deg,#1f3d2b 0%,#0b1a12 100%)',
    focal: '50% 45%',
    extraScrim: 0.12,
  },
  {
    id: 'seaside',
    label: 'Ocean / seaside',
    image: '/images/studyrooms/seaside.webp',
    gradient: 'linear-gradient(160deg,#1e5a8a 0%,#0b2740 100%)',
    focal: '50% 50%',
    extraScrim: 0.22,
  },
  {
    id: 'night-sky',
    label: 'Night sky',
    image: null,
    gradient: 'radial-gradient(ellipse at 70% 15%,#2b3a67 0%,#0e1430 55%,#05070f 100%)',
    focal: '50% 50%',
    extraScrim: 0,
  },
  {
    id: 'minimal-workspace',
    label: 'Minimal workspace',
    image: null,
    gradient: 'linear-gradient(160deg,#20242b 0%,#2c323b 55%,#14171c 100%)',
    focal: '50% 50%',
    extraScrim: 0,
  },
] as const;

export function getBackground(id: string): BackgroundOption {
  const found = BACKGROUND_OPTIONS.find((bg) => bg.id === id);
  if (found) {
    return found;
  }
  // Defensive fallback: minimal-workspace (index 7)
  return BACKGROUND_OPTIONS[7];
}
