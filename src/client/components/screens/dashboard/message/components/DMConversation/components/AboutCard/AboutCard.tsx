import { DMUser } from "../../../../models";
import styles from "./AboutCard.module.css";
interface Props { user: DMUser; }
export function AboutCard({ user }: Props) {return <section className={styles.card}><h2>About</h2><p>{user.role} @ {user.company}<br/>{user.bio}</p></section>}
