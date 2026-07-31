import { cohortNavigationItems } from '@/src/client/components/screens/cohort/mocks/cohortMock';
import type { Cohort } from '@/src/client/components/screens/cohort/models';
import { cohortStore } from './cohortStore';

export const cohortRepository = {
  list(): Cohort[] {
    return cohortStore.getAll();
  },
  getById(id: string): Cohort {
    return cohortStore.getById(id) ?? cohortStore.getAll()[0];
  },
  registerPublishedCohort(data: any): Cohort {
    return cohortStore.registerPublishedCohort(data);
  },
  navigationItems: cohortNavigationItems,
};
