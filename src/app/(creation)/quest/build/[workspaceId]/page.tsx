import { notFound, redirect } from 'next/navigation';
import { z } from 'zod';
import { getCreationOwner } from '@/src/server/infrastructure/auth/getCreationOwner';
import { creationSignInUrl } from '@/src/shared/auth/returnTo';
import { postgresInteractionRepo } from '@/src/server/infrastructure/db/postgres/repositories/interaction.repo';
import { CohortInteractionScreen } from '@/src/client/screens/cohortBuilder/CohortInteractionScreen';
import type { CohortWorkspace } from '@/src/shared/cohort-builder/contracts';
import type { Metadata } from 'next';
import { dispatchInteractionExecution } from '@/src/server/interaction-dispatch.runtime';

export const metadata: Metadata = {
  title: 'Quest Builder',
};

export default async function QuestBuildPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  if (!z.uuid().safeParse(workspaceId).success) notFound();

  const owner = await getCreationOwner();
  if (!owner) {
    redirect(creationSignInUrl(`/quest/build/${workspaceId}`));
  }

  const ws = await postgresInteractionRepo.loadWorkspace<CohortWorkspace>({
    workspaceId,
    ownerId: owner,
  });

  if (!ws) notFound();

  // Recover a missed wake-up after a lost acknowledgement or hosting interruption.
  await dispatchInteractionExecution().catch((err) => {
    console.warn('[quest/build] interaction dispatch skipped:', err);
  });

  return (
    <CohortInteractionScreen
      workspaceId={workspaceId}
      ownerId={owner}
      initialView={ws.snapshot}
      initialRevision={ws.revision}
    />
  );
}
