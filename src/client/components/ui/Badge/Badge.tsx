import React from "react";
import clsx from "clsx";

import styles from "./Badge.module.css";

type Variant =
    | "brand"
    | "momentum"
    | "success"
    | "warning"
    | "danger"
    | "neutral";

type Size =
    | "sm"
    | "md"
    | "lg";

export interface BadgeProps
    extends React.HTMLAttributes<HTMLSpanElement> {
    variant?: Variant;
    size?: Size;
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
    (
        {
            variant = "brand",
            size = "md",
            className,
            style,
            children,
            ...props
        },
        ref
    ) => (
        <span
            ref={ref}
            className={clsx(styles.badge, styles[variant], styles[size], className)}
            style={style}
            {...props}
        >
      {children}
    </span>
    )
);

Badge.displayName = "Badge";
