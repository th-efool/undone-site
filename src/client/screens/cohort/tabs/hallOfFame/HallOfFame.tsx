'use client';

import { HallOfFamePage } from './components/HallOfFamePage/HallOfFamePage';
import type { Cohort } from '../../models';

interface HallOfFameProps {
  cohortId: string;
  cohort: Cohort;
}

export function HallOfFame({ cohortId, cohort }: HallOfFameProps) {
  return <HallOfFamePage hall={cohort.hallOfFame} />;
}
