import { cohortNavigationItems } from '@/src/client/components/screens/cohort/mocks/cohortMock';
import type { Cohort } from '@/src/client/components/screens/cohort/models';
import { cohortCatalog } from '@/src/client/mock/cohorts/cohortCatalog';

export const cohortRepository = {
  list(): Cohort[] {
    return cohortCatalog;
  },
  getById(id: string): Cohort {
    return cohortCatalog.find((cohort) => cohort.id === id) ?? cohortCatalog[0];
  },
  navigationItems: cohortNavigationItems,
};
