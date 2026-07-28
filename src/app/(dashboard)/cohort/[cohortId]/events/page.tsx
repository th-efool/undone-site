import { Events } from "@/src/client/components/screens/cohort";

export default async function EventsPage({
    params,
}: {
    params: Promise<{ cohortId: string }>;
}) {
    const { cohortId } = await params;

    return <Events cohortId={cohortId} />;
}
