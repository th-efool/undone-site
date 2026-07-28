import { Questline } from "@/src/client/components/screens/cohort";

export default async function QuestlinePage({
    params,
}: {
    params: Promise<{ cohortId: string }>;
}) {
    const { cohortId } = await params;

    return <Questline cohortId={cohortId} />;
}
