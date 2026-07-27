import { FormEvent } from "react";
import { Image as ImageIcon, Send, Plus, Smile } from "lucide-react";
import styles from "./MessageComposer.module.css";

interface Props {
    value: string;
    onChange(value: string): void;
    onSend(): void;
}

export function MessageComposer({ value, onChange, onSend }: Props) {
    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        onSend();
    };

    return (
        <form className={styles.composer} onSubmit={submit}>
            <button type="button" className={styles.plus} aria-label="Add attachment"><Plus size={22} /></button>
            <div className={styles.input}>
                <input placeholder="Message #general" value={value} onChange={(event) => onChange(event.target.value)} />
                <button type="button" aria-label="Add emoji"><Smile size={21} /></button>
                <button type="button" aria-label="Add image"><ImageIcon size={20} /></button>
            </div>
            <button type="submit" className={styles.mic} aria-label="Send message"><Send size={21} /></button>
        </form>
    );
}
