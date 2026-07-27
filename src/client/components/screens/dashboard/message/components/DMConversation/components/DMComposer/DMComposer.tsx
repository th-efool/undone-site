import { Mic, Plus, Smile } from "lucide-react";
import styles from "./DMComposer.module.css";

interface Props {
    value: string;
    onChange(value: string): void;
}

export function DMComposer({ value, onChange }: Props) {
    return (
        <footer className={styles.composer}>
            <button type="button" className={styles.plus}><Plus size={22} /></button>
            <div className={styles.input}>
                <input placeholder="Type a message..." value={value} onChange={(event) => onChange(event.target.value)} />
                <button type="button"><Smile size={22} /></button>
                <button type="button"><Mic size={22} /></button>
            </div>
        </footer>
    );
}
