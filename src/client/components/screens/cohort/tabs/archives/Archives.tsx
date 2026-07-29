import { useCohort } from '../../hooks';
import { ArchivesPage } from './components/ArchivesPage/ArchivesPage';

interface ArchivesProps {
  cohortId: string;
}

export function Archives({ cohortId }: ArchivesProps) {
  const { archives } = useCohort(cohortId);
  return <ArchivesPage archives={archives} />;
}
