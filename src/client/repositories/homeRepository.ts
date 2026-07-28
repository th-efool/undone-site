import { homeMock } from "@/src/client/components/screens/dashboard/home/mock/home.mock";
import type { HomeModel } from "@/src/client/components/screens/dashboard/home/models";
import { cohortRepository } from "./cohortRepository";

function withCohortData<T extends { id: string; title: string; thumbnail: string; provider?: string }>(item: T): T {
    const cohort = cohortRepository.getById(item.id);
    return { ...item, cohortId: cohort.id, title: cohort.title, thumbnail: cohort.coverImage, provider: item.provider ? cohort.creator.name : item.provider };
}

export const homeRepository = {
    getHome(): HomeModel {
        return {
            ...homeMock,
            activeCohorts: homeMock.activeCohorts.map(withCohortData),
            continueLater: homeMock.continueLater.map(withCohortData),
            recentlyCompleted: homeMock.recentlyCompleted.map((item) => withCohortData({ ...item, provider: "" })).map((item) => ({ id: item.id, cohortId: item.cohortId, title: item.title, thumbnail: item.thumbnail, completedLabel: item.completedLabel, progressPercent: item.progressPercent })),
        };
    },
};
