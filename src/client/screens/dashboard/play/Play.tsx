'use client';

import { useExperience } from '@/src/client/hooks/useExperience';
import { usePlayback } from './hooks/usePlayback';
import { PlayDesktop } from './PlayDesktop';
import { PlayMobile } from '@/src/client/mobile/screens/Play/PlayMobile';

export function Play() {
  const experience = useExperience();
  const playback = usePlayback();

  if (experience === 'mobile') {
    return <PlayMobile playback={playback} />;
  }

  return <PlayDesktop playback={playback} />;
}