import { cohortsMock } from "../mocks/cohortMock";

export function useCohort(cohortId: string) {
    return cohortsMock.find((cohort) => cohort.id === cohortId) ?? cohortsMock[0];
}
