import {BrowseTopics} from "./components/BrowseTopics/BrowseTopics"
import {ContinueExploring} from "./components/ContinueExploring/ContinueExploring"
import {PeopleFinishing} from "./components/PeopleFinishing/PeopleFinishing"
import {RecentlyPublished} from "./components/RecentlyPublished/RecentlyPublished"
import {SearchBar} from "@/src/client/components/global/SearchBar/SearchBar"
import {TrendingSideQuests} from "./components/TrendingSideQuests/TrendingSideQuests"

import { useExplore } from "./hooks/useExplore";

import styles from "./Explore.module.css"

export function Explore(){
    const explore = useExplore();


    return (
        <main className={styles.explore}>
            <SearchBar />
            // SectionHeader
            <ContinueExploring
                items={explore.continueExploring}
            />
            <PeopleFinishing />
            <BrowseTopics />
            <TrendingSideQuests />
            <RecentlyPublished />
        </main>
    )
}
