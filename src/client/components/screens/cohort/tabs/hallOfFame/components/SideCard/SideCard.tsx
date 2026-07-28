import type { ReactNode } from "react";

import styles from "../../HallOfFame.module.css";

export function SideCard({ title, desc, children }: { title: string; desc: string; children: ReactNode }) {
    return <section className={styles.sideCard}><h3>{title}</h3><p>{desc}</p>{children}</section>;
}
