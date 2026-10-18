import { getPublicCohort } from '@/src/server/domain/cohort/public-cohort';
import { buildCohortMetadata, NOINDEX_METADATA } from '@/src/server/domain/cohort/cohort-seo-render';
import { mapDbCohortToUiCohort } from '@/src/server/infrastructure/db/postgres/mappers/cohortMapper';
import { QuestlineViewer } from '@/src/client/screens/cohort/QuestlineViewer';
import { PrivateQuestline } from './PrivateQuestline';

export async function generateMetadata({ params }: { params: Promise<{ cohortId: string }> }) {
  const { cohortId } = await params;
  const pub = await getPublicCohort(cohortId);
  return pub ? buildCohortMetadata(pub.row, pub.seo, 'questline') : NOINDEX_METADATA;
}

export default async function QuestlinePage({ params }: { params: Promise<{ cohortId: string }> }) {
  const { cohortId } = await params;
  const pub = await getPublicCohort(cohortId);
  if (!pub) return <PrivateQuestline cohortId={cohortId} />;
  return <QuestlineViewer cohortId={cohortId} cohort={mapDbCohortToUiCohort(pub.row)} />;
}
