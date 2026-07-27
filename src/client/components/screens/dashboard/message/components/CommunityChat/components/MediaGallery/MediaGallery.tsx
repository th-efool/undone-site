import { ChatAttachment } from "../../../../models";
import { MessageAttachment } from "../MessageAttachment/MessageAttachment";
import styles from "./MediaGallery.module.css";
interface Props { items: ChatAttachment[]; }
export function MediaGallery({ items }: Props) {return <div className={styles.grid}>{items.slice(0, 6).map((item) => <MessageAttachment key={item.id} attachment={item} compact />)}</div>}
