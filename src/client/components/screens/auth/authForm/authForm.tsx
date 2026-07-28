import styles from "./authForm.module.css";
import { AuthProviders } from "./authProviders";
import { AuthDivider } from "./authDivider";
import { AuthInput } from "./authInput";
import {AuthButton} from "./authButton";
import { AuthLegal } from "./authLegal";
import { AuthStats } from "./authStats";

export function AuthForm() {
    return (
        <aside className={styles.form}>

            <header className={styles.header}>

                <p className={styles.login}>
                    Already have an account?
                    <button className={styles.loginButton}>
                        Log in
                    </button>
                </p>

                <h1 className={styles.title}>
                    Every great skill
                    <br />
                    starts as a{" "}
                    <span className={styles.highlight}>
                        SideQuest.
                    </span>
                </h1>

                <p className={styles.description}>
                    Turn long playlists, courses, and rabbit holes into
                    progress you can actually stick with.
                </p>

            </header>

            <section className={styles.oauth}>
                <AuthProviders />
            </section>

            <section className={styles.divider}>
                <AuthDivider />
            </section>

            <section className={styles.inputs}>

                <AuthInput
                    label="Email"
                    type="email"
                    placeholder="example@example.in"
                />

                <AuthInput
                    label="Password"
                    type="password"
                    placeholder="Enter your password"
                />

            </section>

            <section className={styles.cta}>
                <AuthButton href="/explore">
                    Create Account
                </AuthButton>

                <AuthButton href="/explore" variant="secondary">
                    Continue as Guest
                </AuthButton>
            </section>

            <section className={styles.legal}>
                <AuthLegal />
            </section>

            <section className={styles.stats}>
                <AuthStats />
            </section>

            <footer className={styles.footer}>
                <p className={styles.footerText}>
                    Already Inside?
                    <button
                        type="button"
                        className={styles.footerLink}
                    >
                        Continue where you left off →
                    </button>
                </p>
            </footer>

        </aside>
    );
}