/* eslint-disable @next/next/no-img-element */
import { ArrowLeft, MoreHorizontal, Phone, Video } from "lucide-react";
import { DMUser } from "../../../../models";
import styles from "./DMHeader.module.css";
interface Props { user: DMUser; onBack(): void; }
export function DMHeader({ user, onBack }: Props) {return <header className={styles.header}><button type="button" className={styles.back} onClick={onBack} aria-label="Back"><ArrowLeft size={22}/></button><span className={styles.avatar}><img src={user.avatar} alt=""/><i/></span><div className={styles.info}><h1>{user.name}</h1><p>Online</p></div><div className={styles.actions}>{[Video, Phone, MoreHorizontal].map((Icon, index) => <button key={index} type="button" aria-label="DM action"><Icon size={22}/></button>)}</div></header>}
