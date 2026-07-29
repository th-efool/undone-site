import { MessageComposer } from "../MessageComposer";
import styles from "./DMComposer.module.css";

interface Props {
    value: string;
    onChange(value: string): void;
    onSend(): void;
    onUpload(file: File, kind: "image" | "pdf" | "file" | "video" | "audio"): void;
}

export function DMComposer(props: Props) {
    return (
        <MessageComposer
            {...props}
            placeholder="Type a message..."
            submitInsideInput
            inputClassName={styles.input}
        />
    );
}
