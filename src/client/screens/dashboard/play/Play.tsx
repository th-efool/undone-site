'use client';

import { useExperience } from '@/src/client/hooks/useExperience';
import { usePlayback, INITIAL_PLAYBACK_STATE } from './hooks/usePlayback';
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

export function PlayFallback() {
  const experience = useExperience();

  if (experience === 'mobile') {
    return <PlayMobile playback={INITIAL_PLAYBACK_STATE} />;
  }

  return <PlayDesktop playback={INITIAL_PLAYBACK_STATE} />;
}