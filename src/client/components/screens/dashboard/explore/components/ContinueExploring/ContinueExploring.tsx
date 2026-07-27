import styles from "./ContinueExploring.module.css";

import type { ContinueExploringItem } from "../../models";
import { ContinueExploringCard } from "./ContinueExploringCard";
import { ChevronRight } from "lucide-react";
import { HorizontalScroller } from "@/src/client/components/global/HorizontalScroller";

export interface ContinueExploringProps {
    items: ContinueExploringItem[];
    className?: string;
}

export function ContinueExploring({
                                      items,
                                      className,
                                  }: ContinueExploringProps) {
    return (
        <section
            className={`${styles.section} ${className ?? ""}`}
            aria-labelledby="continue-exploring-heading"
        >
            <div className={styles.header}>
                <h2
                    id="continue-exploring-heading"
                    className={styles.title}
                >
                    Continue Exploring
                </h2>

                <button
                    type="button"
                    className={styles.sectionArrow}
                    aria-label="View all Continue Exploring"
                >
                    <ChevronRight size={18} strokeWidth={2.5} />
                </button>
            </div>

            <HorizontalScroller>

                {items.map((item) => (
                    <ContinueExploringCard
                        key={item.id}
                        item={item}
                    />
                ))}

            </HorizontalScroller>
        </section>
    );
}