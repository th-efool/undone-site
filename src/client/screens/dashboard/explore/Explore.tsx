'use client';

import { useExperience } from '@/src/client/hooks/useExperience';
import { useExplore } from './hooks/useExplore';
import { ExploreDesktop } from './ExploreDesktop';
import { ExploreMobile } from '@/src/client/mobile/screens/Explore/ExploreMobile';

export function Explore() {
  const experience = useExperience();
  const explore = useExplore();

  if (experience === 'mobile') {
    return <ExploreMobile model={explore} />;
  }

  return <ExploreDesktop model={explore} />;
}
