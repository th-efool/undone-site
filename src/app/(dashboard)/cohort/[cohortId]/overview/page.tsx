import { Overview } from '@/src/client/components/screens/cohort';

export default async function OverviewPage({ params }: { params: Promise<{ cohortId: string }> }) {
  const { cohortId } = await params;

  return <Overview cohortId={cohortId} />;
}
