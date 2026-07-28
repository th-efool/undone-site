import { cohortRepository } from "@/src/client/repositories/cohortRepository";

export function useCohort(cohortId: string) {
    return cohortRepository.getById(cohortId);
}
