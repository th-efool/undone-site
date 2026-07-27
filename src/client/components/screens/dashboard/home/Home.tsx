import { SearchBar } from "@/src/client/components/global/SearchBar";

import { ActiveCohorts } from "./components/ActiveCohorts/ActiveCohorts";
import { ContinueLater } from "./components/ContinueLater/ContinueLater";
import { HomeHero } from "./components/HomeHero/HomeHero";
import { RecentlyCompleted } from "./components/RecentlyCompleted/RecentlyCompleted";
import { SummaryCards } from "./components/SummaryCards/SummaryCards";
import { useHome } from "./hooks/useHome";

import styles from "./Home.module.css";

export function Home() {
    const home = useHome();

    return (
        <main className={styles.home}>
            <SearchBar
                className={styles.searchBar}
                placeholder={home.searchPlaceholder}
            />

            <HomeHero content={home.hero} />

            <SummaryCards items={home.summaries} />

            <ActiveCohorts
                heading={home.sections.activeCohorts}
                items={home.activeCohorts}
            />

            <ContinueLater
                heading={home.sections.continueLater}
                items={home.continueLater}
            />

            <RecentlyCompleted
                heading={home.sections.recentlyCompleted}
                items={home.recentlyCompleted}
            />
        </main>
    );
}
