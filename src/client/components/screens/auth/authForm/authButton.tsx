import styles from "./authButton.module.css";

type AuthButtonProps = {
    children: React.ReactNode;
    loading?: boolean;
    disabled?: boolean;
};

export function AuthButton({
                               children,
                               loading = false,
                               disabled = false,
                           }: AuthButtonProps) {
    return (
        <button
            type="submit"
            disabled={disabled || loading}
            className={styles.button}
        >
            {loading ? (
                <span className={styles.loader} />
            ) : (
                children
            )}
        </button>
    );
}