import { cohortWorkspaceSchema, planCohortAction, type CohortWorkspace } from '@/src/shared/cohort-builder/contracts';
import type { DomainDefinition } from 'interaction-builder/runtime';

export const cohortDomain: DomainDefinition<CohortWorkspace> = {
  id: 'cohort',
  version: 1,
  initialState: bootstrap => cohortWorkspaceSchema.parse(bootstrap),
  plan: planCohortAction,
};
