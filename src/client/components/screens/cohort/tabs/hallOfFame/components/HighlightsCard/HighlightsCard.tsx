import type { CohortHallOfFame } from "../../../../models";
import { HighlightRow } from "../HighlightRow/HighlightRow";
import { SideCard } from "../SideCard/SideCard";

import styles from "../../HallOfFame.module.css";

export function HighlightsCard({ hall }: { hall: CohortHallOfFame }) {
    return (
        <SideCard title="Your Highlights" desc="See how you rank across categories.">
            <div className={styles.highlights}>{hall.userHighlights.map((item) => <HighlightRow key={item.id} item={item} />)}</div>
            <button className={styles.profileButton}>View My Profile</button>
        </SideCard>
    );
}
