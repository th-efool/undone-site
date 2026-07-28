import type { CohortArchives } from "../../../../models";

import styles from "../../Archives.module.css";

export function ArchiveFilters({ archives }: { archives: CohortArchives }) { return <div className={styles.filters}>{archives.categories.map((c) => <button key={c.id} className={c.active ? styles.active : ""}>{c.label}{c.id === "flashcards" || c.id === "more" ? "⌄" : ""}</button>)}</div>; }
