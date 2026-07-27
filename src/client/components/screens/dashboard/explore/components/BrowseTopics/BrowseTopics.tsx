import { ChevronRight } from "lucide-react";

import { HorizontalScroller } from "@/src/client/components/global/HorizontalScroller";

import type { Topic } from "../../models";

import { TopicChip } from "./TopicChip";

import styles from "./BrowseTopics.module.css";

export interface BrowseTopicsProps {
    items: Topic[];
}

export function BrowseTopics({
                                 items,
                             }: BrowseTopicsProps) {
    return (
        <section
            className={styles.section}
            aria-labelledby="browse-topics-heading"
        >
            <div className={styles.header}>
                <h2
                    id="browse-topics-heading"
                    className={styles.title}
                >
                    Browse Topics
                </h2>

                <button
                    type="button"
                    className={styles.arrow}
                    aria-label="Browse Topics"
                >
                    <ChevronRight
                        size={18}
                        strokeWidth={2.5}
                    />
                </button>
            </div>

            <HorizontalScroller>

                {items.map((item) => (
                    <TopicChip
                        key={item.id}
                        item={item}
                    />
                ))}

            </HorizontalScroller>

        </section>
    );
}