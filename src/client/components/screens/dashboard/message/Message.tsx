"use client";

import { SocialLanding } from "./components/SocialLanding/SocialLanding";
import styles from "./Message.module.css";

export function Message() {
    return <div className={styles.message}><SocialLanding /></div>;
}
