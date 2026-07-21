import Link from "next/link";
import Image from "next/image";
import clsx from "clsx";

import "./logo.css";

export interface LogoProps {
    href?: string;

    compact?: boolean;

    iconOnly?: boolean;

    className?: string;

    priority?: boolean;
}

export function Logo({
                         href = "/",
                         compact = false,
                         iconOnly = false,
                         className,
                         priority = false,
                     }: LogoProps) {
    const logo = (
        <div className={clsx("logo", className)}>
            <Image
                src="/images/logo/sidequesthq-logo.webp"
                alt="SideQuestHQ"
                width={44}
                height={44}
                priority
            />

            {!iconOnly && (
                <div className="logo-text">
          <span className="logo-title">
            SideQuestHQ
          </span>

                    {!compact && (
                        <span className="logo-tagline">
              Learn Better.
            </span>
                    )}
                </div>
            )}
        </div>
    );

    return <Link href={href}>{logo}</Link>;
}