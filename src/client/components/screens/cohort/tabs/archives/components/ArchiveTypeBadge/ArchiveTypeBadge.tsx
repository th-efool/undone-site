import { ArchiveType } from "../../../../models";

import styles from "../../Archives.module.css";

export function ArchiveTypeBadge({ type }: { type: ArchiveType }) { return <span className={`${styles.badge} ${styles[typeClass[type]]}`}>{type}</span>; }

const typeClass = { [ArchiveType.FieldNote]: "field", [ArchiveType.MindMap]: "mind", [ArchiveType.CheatSheet]: "cheat", [ArchiveType.Diagram]: "diagram", [ArchiveType.CodeSnippet]: "code", [ArchiveType.Flashcard]: "flash" };
