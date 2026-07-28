import { useCohort } from "./useCohort";

export function useArchives(cohortId: string) {
    return useCohort(cohortId).archives;
}
