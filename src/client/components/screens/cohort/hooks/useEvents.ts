import { useCohort } from "./useCohort";

export function useEvents(cohortId: string) {
    return useCohort(cohortId).events;
}
