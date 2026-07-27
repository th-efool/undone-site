import { Image as ImageIcon, Mic, Plus, Smile } from "lucide-react";
import styles from "./MessageComposer.module.css";
export function MessageComposer() {return <footer className={styles.composer}><button type="button" className={styles.plus}><Plus size={22}/></button><div className={styles.input}><input placeholder="Message #general" readOnly/><button type="button"><Smile size={21}/></button><button type="button"><ImageIcon size={20}/></button></div><button type="button" className={styles.mic}><Mic size={23}/></button></footer>}
