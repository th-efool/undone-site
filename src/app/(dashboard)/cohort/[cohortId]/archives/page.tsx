import { Archives } from "@/src/client/components/screens/cohort";

export default async function ArchivesPage({
    params,
}: {
    params: Promise<{ cohortId: string }>;
}) {
    const { cohortId } = await params;

    return <Archives cohortId={cohortId} />;
}
