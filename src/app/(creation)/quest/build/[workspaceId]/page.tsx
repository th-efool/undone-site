import { notFound, redirect } from 'next/navigation';
import { z } from 'zod';
import { getCreationOwner } from '@/src/server/infrastructure/auth/getCreationOwner';
import { creationSignInUrl } from '@/src/shared/auth/returnTo';
import { postgresInteractionRepo } from '@/src/server/infrastructure/db/postgres/repositories/interaction.repo';
import { CohortInteractionScreen } from '@/src/client/screens/cohortBuilder/CohortInteractionScreen';
import type { CohortWorkspace } from '@/src/shared/cohort-builder/contracts';

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

  let ws = await postgresInteractionRepo.loadWorkspace<CohortWorkspace>({
    workspaceId,
    ownerId: owner,
  });

  if (!ws) {
    // Auto-create initial workspace for this ID if none exists yet
    ws = await postgresInteractionRepo.createWorkspace({
      id: workspaceId,
      ownerId: owner,
      domainId: 'cohort',
      domainVersion: 1,
      initialSnapshot: {
        schemaVersion: 1,
        title: 'Draft Curriculum',
        intent: 'Build a rigorous, hands-on learning cohort from first principles.',
        audience: 'Self-directed practitioners aiming to build deep competence.',
        dailyMinutes: 25,
        lessons: [
          {
            id: crypto.randomUUID(),
            version: 0,
            title: '1. Core Foundations & First Principles',
            objective: 'Master foundational concepts and understand system boundaries.',
            sourceChunkIds: [],
            pinned: false,
          },
          {
            id: crypto.randomUUID(),
            version: 0,
            title: '2. Deep Architecture & Execution Patterns',
            objective: 'Build hands-on prototypes and analyze trade-offs under real constraints.',
            sourceChunkIds: [],
            pinned: false,
          },
          {
            id: crypto.randomUUID(),
            version: 0,
            title: '3. Capstone Synthesis & Production Readiness',
            objective: 'Consolidate learnings into a production-grade artifact and review failures.',
            sourceChunkIds: [],
            pinned: false,
          },
        ],
        sources: [],
        chunks: [],
        understanding: [],
        analyses: [],
        processing: { status: 'idle', stage: 'done', generation: 0, sourceFingerprint: null, error: null },
      },
    });
  }

  return (
    <CohortInteractionScreen
      workspaceId={workspaceId}
      initialView={ws.snapshot}
    />
  );
}
