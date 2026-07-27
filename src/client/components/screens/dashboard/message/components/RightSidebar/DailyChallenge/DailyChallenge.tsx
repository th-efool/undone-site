import { ChevronRight, Trophy } from "lucide-react";
import { ChallengeCard } from "../../../models";
import styles from "./DailyChallenge.module.css";
interface Props{challenge:ChallengeCard;}
export function DailyChallenge({challenge}:Props){return <section className={styles.panel}><header><span><Trophy size={18}/></span><h2>Today&apos;s Challenge</h2><ChevronRight className={styles.chev} size={21}/></header><b>{challenge.tag}</b><h3>{challenge.title}</h3><p>{challenge.description}</p><div className={styles.participants}>{challenge.participants.map((person)=><img key={person.id} src={person.avatar} alt=""/>)}<span>{challenge.participantCount} participating</span></div></section>}
