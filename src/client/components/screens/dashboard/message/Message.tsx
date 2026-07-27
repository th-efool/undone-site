"use client";

import { SocialLanding } from "./components/SocialLanding/SocialLanding";
import { useMessage } from "./hooks";
import styles from "./Message.module.css";

export function Message() {
    const message = useMessage();

    return <div className={styles.message}><SocialLanding message={message} /></div>;
}
