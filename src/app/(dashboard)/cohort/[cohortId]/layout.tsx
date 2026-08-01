import { Cohort } from '@/src/client/components/screens/cohort';
import { getCohortStaticParams } from '@/src/shared/mobile/cohortStaticParams';

export function generateStaticParams() {
  return getCohortStaticParams();
}

export default async function CohortRouteLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ cohortId: string }>;
}) {
  const { cohortId } = await params;

  return <Cohort cohortId={cohortId}>{children}</Cohort>;
}
