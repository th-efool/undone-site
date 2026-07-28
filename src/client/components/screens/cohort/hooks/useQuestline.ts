import { useCohort } from "./useCohort";

export function useQuestline(cohortId: string) {
    return useCohort(cohortId).questline;
}
