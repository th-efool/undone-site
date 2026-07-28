import { ArrowRight, Crown } from "lucide-react";

import type { CohortHallOfFame } from "../../../../models";
import { LegendsRow } from "../LegendsRow/LegendsRow";

import styles from "../../HallOfFame.module.css";

export function HallOfLegends({ hall }: { hall: CohortHallOfFame }) {
    return (
        <section className={styles.legends}>
            <div className={styles.legendsHead}>
                <div><h3><Crown size={19} />Hall of Legends</h3><p>All-time legends of this cohort.</p></div>
                <button>View Hall of Legends <ArrowRight size={16} /></button>
            </div>
            <div className={styles.legendRows}>{hall.legends.map((item) => <LegendsRow key={item.id} item={item} />)}</div>
        </section>
    );
}
