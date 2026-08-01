import { cohortCatalog } from '@/src/client/mock/cohorts/cohortCatalog';

export function getCohortStaticParams() {
  return cohortCatalog.map((cohort) => ({ cohortId: cohort.id }));
}
