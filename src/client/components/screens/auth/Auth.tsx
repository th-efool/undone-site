import styles from "./Auth.module.css";
import AuthShowcase from "./authShowcase/authShowcase";
import { AuthForm } from "./authForm/authForm";


export function Auth() {
    return (
        <section className={styles.auth}>
            <div className={styles.showcase}>
                <AuthShowcase />
            </div>
            <aside className={styles.panel}>
                <AuthForm />
            </aside>
        </section>
    );
}