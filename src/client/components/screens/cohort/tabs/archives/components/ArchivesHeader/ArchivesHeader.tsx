import type { CohortArchives } from "../../../../models";

export function ArchivesHeader({ archives }: { archives: CohortArchives }) { return <header><h2>{archives.title}</h2><p>{archives.description}</p></header>; }
