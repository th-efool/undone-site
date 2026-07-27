import { FormEvent } from "react";
import { Send, Plus, Smile } from "lucide-react";
import styles from "./DMComposer.module.css";

interface Props {
    value: string;
    onChange(value: string): void;
    onSend(): void;
}

export function DMComposer({ value, onChange, onSend }: Props) {
    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        onSend();
    };

    return (
        <form className={styles.composer} onSubmit={submit}>
            <button type="button" className={styles.plus} aria-label="Add attachment"><Plus size={22} /></button>
            <div className={styles.input}>
                <input placeholder="Type a message..." value={value} onChange={(event) => onChange(event.target.value)} />
                <button type="button" aria-label="Add emoji"><Smile size={22} /></button>
                <button type="submit" aria-label="Send message"><Send size={21} /></button>
            </div>
        </form>
    );
}
