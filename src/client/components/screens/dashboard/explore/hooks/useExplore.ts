import { exploreRepository } from "@/src/client/repositories/exploreRepository";

export function useExplore() {
    return exploreRepository.getExplore();
}
