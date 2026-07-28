import { SearchBar } from "@/src/client/components/global/SearchBar";

import type { Cohort, NavigationItem } from "../../models";
import { CohortHero } from "../CohortHero/CohortHero";
import { CohortNavigation } from "../CohortNavigation/CohortNavigation";

import styles from "./CohortLayout.module.css";

interface CohortLayoutProps {
    cohort: Cohort;
    navigationItems: NavigationItem[];
    children: React.ReactNode;
}

export function CohortLayout({ cohort, navigationItems, children }: CohortLayoutProps) {
    return (
        <main className={styles.layout}>
            <SearchBar className={styles.searchBar} />
            <CohortHero cohort={cohort} />
            <CohortNavigation items={navigationItems} />
            <section className={styles.content}>{children}</section>
        </main>
    );
}
