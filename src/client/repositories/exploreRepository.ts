import { exploreMock } from "@/src/client/components/screens/dashboard/explore/mock/explore.mock";
import type { ExploreModel } from "@/src/client/components/screens/dashboard/explore/models";
import { cohortRepository } from "./cohortRepository";

const idMap: Record<string, string> = {
    "deep-work": "deep-work-mastery",
    "system-design": "system-design-bootcamp",
    psychology: "history-psychology",
    german: "german-language-a1",
    python: "python-data-science",
    docker: "docker-kubernetes",
    react: "modern-react",
    design: "ui-design-fundamentals",
    reader: "become-a-reader-again",
    "body-double": "body-doubling-room",
    "content-bottle": "content-in-a-bottle",
    "100-days": "100-days-of-code",
};

function cohortId(id: string) { return idMap[id] ?? id; }
function cohort(id: string) { return cohortRepository.getById(cohortId(id)); }

export const exploreRepository = {
    getExplore(): ExploreModel {
        return {
            ...exploreMock,
            continueExploring: exploreMock.continueExploring.map((item) => {
                const c = cohort(item.id);
                return { ...item, cohortId: c.id, title: c.title };
            }),
            peopleFinishing: exploreMock.peopleFinishing.map((item) => {
                const c = cohort(item.id);
                return { ...item, id: c.id, cohortId: c.id, title: c.title, thumbnail: c.coverImage, learnerCount: `${(c.stats.explorerCount / 1000).toFixed(1)}k learners`, rating: c.stats.rating };
            }),
            trendingSideQuests: exploreMock.trendingSideQuests.map((item) => {
                const c = cohort(item.id);
                return { ...item, id: c.id, cohortId: c.id, title: c.title, thumbnail: c.coverImage, participantCount: `${c.stats.explorerCount.toLocaleString()} participants` };
            }),
            recentlyPublished: exploreMock.recentlyPublished.map((item) => {
                const c = cohort(item.id);
                return { ...item, id: c.id, cohortId: c.id, title: `${c.title} Field Notes`, thumbnail: c.coverImage, author: c.creator.name, learnerCount: `${(c.stats.explorerCount / 1000).toFixed(1)}K learners` };
            }),
        };
    },
};
