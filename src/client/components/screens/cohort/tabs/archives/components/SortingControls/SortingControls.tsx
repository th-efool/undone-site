import { SlidersHorizontal } from "lucide-react";

import type { CohortArchives } from "../../../../models";

import styles from "../../Archives.module.css";

export function SortingControls({ archives }: { archives: CohortArchives }) { return <div className={styles.sort}>{archives.sortControls.map((c) => <button key={c.id}>{c.id === "filters" ? <SlidersHorizontal size={15} /> : null}{c.label}⌄</button>)}</div>; }
