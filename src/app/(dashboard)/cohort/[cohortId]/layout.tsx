import { mapDbCohortToUiCohort } from '@/src/server/infrastructure/db/postgres/mappers/cohortMapper';
import { getPublicCohort } from '@/src/server/domain/cohort/public-cohort';
import { CohortViewerBoundary } from '@/src/client/screens/cohort/CohortViewerBoundary';
import { PrivateCohortLayout } from './PrivateCohortLayout';

export const revalidate = 3600;
export const dynamicParams = true; // Render on demand, then cache (avoids build-time DB flooding)

export async function generateStaticParams() {
  return [];
}

export default async function CohortRouteLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ cohortId: string }>;
}) {
  const { cohortId } = await params;
  const pub = await getPublicCohort(cohortId);
  if (!pub) {
    return <PrivateCohortLayout cohortId={cohortId}>{children}</PrivateCohortLayout>;
  }
  const ui = mapDbCohortToUiCohort(pub.row);
  return <CohortViewerBoundary cohort={ui}>{children}</CohortViewerBoundary>;
}
