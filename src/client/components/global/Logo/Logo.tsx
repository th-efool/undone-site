import Image from "next/image";
import Link from "next/link";

import clsx from "clsx";

import styles from "./Logo.module.css";

export interface LogoProps {
    href?: string;

    compact?: boolean;

    iconOnly?: boolean;

    className?: string;

    priority?: boolean;
}

/**
 * Brand logo link with optional compact or icon-only presentation.
 */
export function Logo({
    href = "/",
    compact = false,
    iconOnly = false,
    className,
    priority = false,
}: LogoProps) {
    // const logo = (
    //     <div className={clsx(styles.root, className)}>
    //         <Image
    //             src="/images/logos/sidequesthq-logo.webp"
    //             alt="SideQuestHQ logo"
    //             width={44}
    //             height={44}
    //             priority={priority}
    //         />

    //         {!iconOnly && (
    //             <div className={styles.text}>
    //                 <span className={styles.title}>SideQuestHQ</span>

    //                 {!compact && (
    //                     <span className={styles.tagline}>Learn Better.</span>
    //                 )}
    //             </div>
    //         )}
    //     </div>
    // );
const logo = (
  <div className={clsx(styles.root, className)}>
    <Image
      src="/images/logos/sidequesthq-logo.webp"
      alt="SideQuestHQ"
      width={64}
      height={64}
      priority={priority}
      className={styles.logoImage}
    />

    {!iconOnly && (
      <div className={styles.text}>
        <span className={styles.title}>SideQuestHQ</span>

        {!compact && (
          <span className={styles.tagline}>Built for Curious Minds.</span>
        )}
      </div>
    )}
  </div>
);

    return <Link href={href}>{logo}</Link>;
}
