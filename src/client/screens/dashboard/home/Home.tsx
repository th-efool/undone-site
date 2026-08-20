'use client';

import { useExperience } from '@/src/client/hooks/useExperience';
import { useHome } from './hooks/useHome';
import { HomeDesktop } from './HomeDesktop';
import { HomeMobile } from '@/src/client/mobile/screens/Home/HomeMobile';
import type { ActiveCohort, CompletedCourse, PausedCohort } from './models';

export function Home(props: {
  activeCohorts?: ActiveCohort[];
  continueLater?: PausedCohort[];
  recentlyCompleted?: CompletedCourse[];
}) {
  const experience = useExperience();
  const home = useHome(props);

  if (experience === 'mobile') {
    return <HomeMobile model={home} />;
  }

  return <HomeDesktop model={home} />;
}
