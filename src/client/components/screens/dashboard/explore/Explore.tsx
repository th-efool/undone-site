import { SearchBar } from "@/src/client/components/global/SearchBar";

import { ExploreHero } from "./components/ExploreHero/ExploreHero";
import { BrowseTopics } from "./components/BrowseTopics/BrowseTopics";
import { ContinueExploring } from "./components/ContinueExploring/ContinueExploring";
import { PeopleFinishing } from "./components/PeopleFinishing/PeopleFinishing";
import { RecentlyPublished } from "./components/RecentlyPublished/RecentlyPublished";
import { TrendingSideQuests } from "./components/TrendingSideQuests/TrendingSideQuests";

import { useExplore } from "./hooks/useExplore";

import styles from "./Explore.module.css";

export function Explore() {
    const explore = useExplore();

    return (
        <main className={styles.explore}>

            <SearchBar className={styles.searchBar} />

            <ExploreHero />

            <ContinueExploring
                items={explore.continueExploring}
            />

            <PeopleFinishing
                items={explore.peopleFinishing}
            />
            <BrowseTopics
                items={explore.topics}
            />
            <TrendingSideQuests
                items={explore.trendingSideQuests}
            />
            <RecentlyPublished
                items={explore.recentlyPublished}
            />
        </main>
    );
}