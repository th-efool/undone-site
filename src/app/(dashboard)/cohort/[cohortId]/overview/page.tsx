import { getPublicCohort } from '@/src/server/domain/cohort/public-cohort';
import { buildCohortMetadata, buildCohortJsonLd, serializeJsonLd, NOINDEX_METADATA } from '@/src/server/domain/cohort/cohort-seo-render';
import { mapDbCohortToUiCohort } from '@/src/server/infrastructure/db/postgres/mappers/cohortMapper';
import { OverviewViewer } from '@/src/client/screens/cohort/OverviewViewer';
import { PrivateOverview } from './PrivateOverview';

export async function generateMetadata({ params }: { params: Promise<{ cohortId: string }> }) {
  const { cohortId } = await params;
  const pub = await getPublicCohort(cohortId);
  return pub ? buildCohortMetadata(pub.row, pub.seo, 'overview') : NOINDEX_METADATA;
}

export default async function OverviewPage({ params }: { params: Promise<{ cohortId: string }> }) {
  const { cohortId } = await params;
  const pub = await getPublicCohort(cohortId);
  if (!pub) return <PrivateOverview cohortId={cohortId} />;
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(buildCohortJsonLd(pub.row, pub.seo)) }}
      />
      <OverviewViewer cohortId={cohortId} cohort={mapDbCohortToUiCohort(pub.row)} />
    </>
  );
}
