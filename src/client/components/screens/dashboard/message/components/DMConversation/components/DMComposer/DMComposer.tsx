import { Mic, Plus, Smile } from "lucide-react";
import styles from "./DMComposer.module.css";
export function DMComposer() {return <footer className={styles.composer}><button type="button" className={styles.plus}><Plus size={22}/></button><div className={styles.input}><input readOnly placeholder="Type a message..."/><button type="button"><Smile size={22}/></button><button type="button"><Mic size={22}/></button></div></footer>}
