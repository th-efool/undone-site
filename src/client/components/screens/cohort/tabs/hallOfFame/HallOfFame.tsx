'use client';

import { useCohort } from '../../hooks';
import { HallOfFamePage } from './components/HallOfFamePage/HallOfFamePage';

interface HallOfFameProps {
  cohortId: string;
}

export function HallOfFame({ cohortId }: HallOfFameProps) {
  const { hallOfFame } = useCohort(cohortId);

  return <HallOfFamePage hall={hallOfFame} />;
}
