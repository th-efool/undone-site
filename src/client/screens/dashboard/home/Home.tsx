'use client';

import { useExperience } from '@/src/client/hooks/useExperience';
import { useHome } from './hooks/useHome';
import { HomeDesktop } from './HomeDesktop';
import { HomeMobile } from '@/src/client/mobile/screens/Home/HomeMobile';

export function Home() {
  const experience = useExperience();
  const home = useHome();

  if (experience === 'mobile') {
    return <HomeMobile model={home} />;
  }

  return <HomeDesktop model={home} />;
}
