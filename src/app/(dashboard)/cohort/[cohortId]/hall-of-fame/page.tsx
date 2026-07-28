import { HallOfFame } from "@/src/client/components/screens/cohort";

export default async function HallOfFamePage({
    params,
}: {
    params: Promise<{ cohortId: string }>;
}) {
    const { cohortId } = await params;

    return <HallOfFame cohortId={cohortId} />;
}
