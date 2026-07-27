import { PersonPreview } from "../../../../models";
import styles from "./MembersStrip.module.css";
interface Props { members: PersonPreview[]; count: number; }
export function MembersStrip({ members, count }: Props) {return <div className={styles.strip}>{members.slice(0, 5).map((member) => <span key={member.id}><img src={member.avatar} alt={member.name}/>{member.online && <i/>}</span>)}<b>+{Math.max(count - members.length, 0)}</b></div>}
