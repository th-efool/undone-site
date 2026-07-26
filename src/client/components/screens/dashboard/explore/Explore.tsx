import {BrowseTopics} from "./components/BrowseTopics/BrowseTopics"
import {ContinueExploring} from "./components/ContinueExploring/ContinueExploring"
import {PeopleFinishing} from "./components/PeopleFinishing/PeopleFinishing"
import {RecentlyPublished} from "./components/RecentlyPublished/RecentlyPublished"
import {SearchBar} from "./components/SearchBar/SearchBar"
import {TrendingSideQuests} from "./components/TrendingSideQuests/TrendingSideQuests"
import styles from "./Explore.module.css"

export function Explore(){
    return (
        <main className={styles.explore}>
            <SearchBar />
            <ContinueExploring />
            <PeopleFinishing />
            <BrowseTopics />
            <TrendingSideQuests />
            <RecentlyPublished />
        </main>
    )
}
