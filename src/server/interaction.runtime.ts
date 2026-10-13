import 'server-only';
import { cohortWorkspaceSchema, planCohortAction, type CohortWorkspace } from '@/src/shared/cohort-builder/contracts';
import { createInteractionHandlers, type DomainDefinition } from './domain/interaction/handlers';
import { dispatchInteraction } from './domain/interaction/http';
import { postgresInteractionRepo } from './infrastructure/db/postgres/repositories/interaction.repo';
import { getCreationOwner } from './infrastructure/auth/getCreationOwner';

/** Host composition root: the only place that binds engine + cohort domain + Undone infra. */
const cohortDomain: DomainDefinition<CohortWorkspace> = {
  id: 'cohort', version: 1,
  initialState: bootstrap => cohortWorkspaceSchema.parse(bootstrap),
  plan: planCohortAction,
};

const handlers = createInteractionHandlers({ repo: postgresInteractionRepo, domains: new Map([[cohortDomain.id, cohortDomain]]) });

export function handleInteractionRequest(request: Request, segments: string[]) {
  return dispatchInteraction(request, segments, getCreationOwner, handlers);
}
