/* eslint-disable @next/next/no-img-element */
import { DMUser } from "../../../../models";
import styles from "./UserHero.module.css";
interface Props { user: DMUser; }
export function UserHero({ user }: Props) {return <section className={styles.hero}><span><img src={user.avatar} alt=""/><i/></span><h2>{user.name}</h2><p>Online</p></section>}
