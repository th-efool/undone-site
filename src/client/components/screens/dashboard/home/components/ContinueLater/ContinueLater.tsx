import { HorizontalScroller } from "@/src/client/components/global/HorizontalScroller";

import type { HomeSectionContent, PausedCohort } from "../../models";
import { ContinueLaterCard } from "../ContinueLaterCard/ContinueLaterCard";
import { SectionHeader } from "../SectionHeader/SectionHeader";

import styles from "./ContinueLater.module.css";

export interface ContinueLaterProps {
    heading: HomeSectionContent;
    items: PausedCohort[];
}

export function ContinueLater({ heading, items }: ContinueLaterProps) {
    return (
        <section className={styles.section} aria-labelledby="continue-later-heading">
            <SectionHeader
                title={heading.title}
                subtitle={heading.subtitle}
            />

            <HorizontalScroller scrollAmount={520}>
                {items.map((item) => (
                    <ContinueLaterCard key={item.id} item={item} />
                ))}
            </HorizontalScroller>
        </section>
    );
}
