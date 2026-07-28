import Link from "next/link";
import styles from "./authButton.module.css";

type AuthButtonProps = {
    children: React.ReactNode;
    loading?: boolean;
    disabled?: boolean;
    href?: string;
    variant?: "primary" | "secondary";
};

export function AuthButton({
                               children,
                               loading = false,
                               disabled = false,
                               href,
                               variant = "primary",
                           }: AuthButtonProps) {
    const className = `${styles.button} ${variant === "secondary" ? styles.secondary : ""}`;

    if (href) {
        return (
            <Link href={href} className={className}>
                {children}
            </Link>
        );
    }

    return (
        <button
            type="submit"
            disabled={disabled || loading}
            className={className}
        >
            {loading ? (
                <span className={styles.loader} />
            ) : (
                children
            )}
        </button>
    );
}