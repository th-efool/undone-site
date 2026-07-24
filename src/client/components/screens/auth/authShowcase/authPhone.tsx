import Image from "next/image";
import styles from "./authPhone.module.css";

export function AuthPhone() {
    return (
        <div
            className={styles.phone}
            aria-hidden="true"
        >
            <Image
                src="/images/auth/phone.webp"
                alt=""
                fill
                priority
                sizes="500px"
                className={styles.image}
            />
        </div>
    );
}