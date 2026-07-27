import { DMMessageStatus } from "../../../../models";
import styles from "./MessageStatus.module.css";
interface Props { status?: DMMessageStatus; }
export function MessageStatus({ status }: Props) {if (!status) return null; return <span className={styles.status}>{status === "sent" ? "✓" : "✓✓"}</span>}
