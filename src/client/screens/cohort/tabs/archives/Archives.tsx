'use client';

import { ArchivesPage } from './components/ArchivesPage/ArchivesPage';
import type { Cohort } from '../../models';

interface ArchivesProps {
  cohortId: string;
  cohort: Cohort;
}

export function Archives({ cohortId, cohort }: ArchivesProps) {
  const archives = cohort?.archives;
  if (!archives) return null;
  return <ArchivesPage archives={archives} />;
}
