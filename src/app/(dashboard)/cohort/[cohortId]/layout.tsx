import { Cohort } from "@/src/client/components/screens/cohort";

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
