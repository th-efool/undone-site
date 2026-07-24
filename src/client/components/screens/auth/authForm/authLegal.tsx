import styles from "./authLegal.module.css";

export function AuthLegal() {
    return (
        <p className={styles.legal}>
            By continuing, you agree to our{" "}
            <a href="/terms" className={styles.link}>
                Terms of Service
            </a>{" "}
            and{" "}
            <a href="/privacy" className={styles.link}>
                Privacy Policy
            </a>
            .
        </p>
    );
}