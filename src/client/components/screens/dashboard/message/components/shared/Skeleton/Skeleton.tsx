import styles from "./Skeleton.module.css";

type Variant = "conversation" | "message" | "card";

interface Props {
    variant?: Variant;
    count?: number;
}

export function Skeleton({ variant = "card", count = 3 }: Props) {
    return (
        <div className={styles.stack} aria-hidden="true">
            {Array.from({ length: count }, (_, index) => (
                <div key={index} className={`${styles.item} ${styles[variant]}`}>
                    <span />
                    <div>
                        <i />
                        <b />
                    </div>
                </div>
            ))}
        </div>
    );
}
